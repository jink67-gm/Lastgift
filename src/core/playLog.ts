// 플레이 기록(명세서 §11 STEP 08: 첫 팀 실제 조작 시간·프레임 기록). three.js·DOM 없음.
// 장마다 한 줄: 실제로 움직인 시간(놀이), 연출을 본 시간, 평균 FPS와 느린 5% FPS, 품질, 기기, 인원.
// 수업 리허설에서 선생님이 설정 창 「기록」으로 보고 복사해 TEST_CHECKLIST에 옮긴다. 이 기기에만 저장한다.

export interface DeviceInfo {
  /** 화면(CSS px)·배율·터치 */
  w: number;
  h: number;
  dpr: number;
  touch: boolean;
  /** 브라우저 짧은 이름(Whale·Edge·Chrome·Safari·Firefox) + OS */
  ua: string;
}

export interface ChapterLog {
  runId: string;
  roomId: string;
  chapterId: number;
  role: 'local' | 'host' | 'guest';
  players: number;
  /** 이 장을 연 시각(기기 시계, ms) */
  startedAt: number;
  /** 요정이 움직일 수 있던 시간(초) */
  playSec: number;
  /** 연출·끝 장면 시간(초) */
  cutSec: number;
  /** 일시중지·시간 초과·대기 시간(초) */
  waitSec: number;
  fpsAvg: number;
  /** 가장 느린 5% 프레임의 FPS(끊김 체감) */
  fpsLow: number;
  quality: 'low' | 'normal';
  retries: number;
  done: boolean;
  device: DeviceInfo;
}

/** FPS 모으기: 1~120 FPS 칸에 센다(메모리 일정) */
export class FrameStats {
  private readonly bins = new Uint32Array(121);
  private n = 0;
  private sum = 0;

  add(frameSec: number): void {
    if (!(frameSec > 0)) return;
    // 탭 전환 등으로 아주 긴 프레임(1초 넘음)은 FPS 통계에서 뺀다
    if (frameSec > 1) return;
    const fps = Math.max(1, Math.min(120, Math.round(1 / frameSec)));
    this.bins[fps]!++;
    this.n++;
    this.sum += frameSec;
  }

  get count(): number {
    return this.n;
  }

  /** 평균 FPS(전체 프레임 수 / 전체 시간) */
  avg(): number {
    return this.n ? this.n / this.sum : 0;
  }

  /** 가장 느린 p 비율 프레임의 FPS 경계 */
  low(p = 0.05): number {
    if (!this.n) return 0;
    const target = Math.max(1, Math.ceil(this.n * p));
    let seen = 0;
    for (let f = 1; f <= 120; f++) {
      seen += this.bins[f]!;
      if (seen >= target) return f;
    }
    return 120;
  }
}

export function shortUa(ua: string): string {
  const os = /Windows/.test(ua) ? 'Windows' : /CrOS/.test(ua) ? 'ChromeOS' : /iPad|iPhone|Macintosh.*Mobile/.test(ua) ? 'iPadOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '?';
  const br = /Whale\//.test(ua)
    ? 'Whale'
    : /Edg\//.test(ua)
      ? 'Edge'
      : /SamsungBrowser\//.test(ua)
        ? 'Samsung'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Chrome\//.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : '?';
  const ver = (ua.match(new RegExp(`${br === 'Edge' ? 'Edg' : br === 'Samsung' ? 'SamsungBrowser' : br}/(\\d+)`)) ?? [])[1];
  return `${br}${ver ? ` ${ver}` : ''} · ${os}`;
}

export const LOG_LIMIT = 60;

/** 같은 시도·장·역할의 줄은 고쳐 쓰고, 새 줄은 뒤에 붙인다(오래된 것부터 버린다) */
export function upsertLog(list: readonly ChapterLog[], e: ChapterLog): ChapterLog[] {
  const i = list.findIndex((q) => q.runId === e.runId && q.chapterId === e.chapterId && q.role === e.role);
  const out = i >= 0 ? list.map((q, k) => (k === i ? e : q)) : [...list, e];
  return out.slice(-LOG_LIMIT);
}

export function isChapterLog(v: unknown): v is ChapterLog {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.runId === 'string' && typeof o.chapterId === 'number' && typeof o.playSec === 'number' && typeof o.device === 'object' && o.device !== null;
}

const two = (n: number) => String(n).padStart(2, '0');
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${two(Math.round(sec % 60))}`;
const ROLE = { local: '한 기기', host: '방장', guest: '참가자' } as const;

/** 표(탭으로 나눈 글): 스프레드시트·점검표에 그대로 붙인다 */
export function formatLog(list: readonly ChapterLog[]): string {
  const head = ['날짜', '시각', '장', '역할', '인원', '놀이', '연출', '대기', '평균FPS', '느린5%', '품질', '재시도', '마침', '화면', '터치', '브라우저'];
  const rows = list.map((e) => {
    const d = new Date(e.startedAt);
    return [
      `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`,
      `${two(d.getHours())}:${two(d.getMinutes())}`,
      `${e.chapterId}장`,
      ROLE[e.role],
      String(e.players),
      mmss(e.playSec),
      mmss(e.cutSec),
      mmss(e.waitSec),
      e.fpsAvg.toFixed(0),
      e.fpsLow.toFixed(0),
      e.quality === 'low' ? '낮음' : '보통',
      String(e.retries),
      e.done ? 'O' : '-',
      `${e.device.w}×${e.device.h}@${e.device.dpr}`,
      e.device.touch ? 'O' : '-',
      e.device.ua,
    ].join('\t');
  });
  return [head.join('\t'), ...rows].join('\n');
}
