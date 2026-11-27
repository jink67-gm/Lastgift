// 장 화면마다 하나: 프레임 시간을 모아 FPS 표시(설정에서 켰을 때)를 갱신하고,
// 이 장의 플레이 기록(core/playLog)을 3초마다·창을 닫을 때·장을 마칠 때 이 기기에 저장한다.
// 5·6장처럼 한 화면에서 장이 바뀌면(6장 놀이 시작) 새 줄을 연다.
import { FrameStats, isChapterLog, shortUa, upsertLog, type ChapterLog } from '../core/playLog';
import type { Quality } from '../core/quality';
import { browserStorage } from '../save/store';
import type { TeamRun } from './mirrorRun';

export const PLAY_LOG_KEY = 'lastgift.playlog.v1';

type Kv = ReturnType<typeof browserStorage>;

export function readPlayLog(kv: Kv = browserStorage()): ChapterLog[] {
  try {
    const v = JSON.parse(kv?.getItem(PLAY_LOG_KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter(isChapterLog) : [];
  } catch {
    return [];
  }
}

export function clearPlayLog(kv: Kv = browserStorage()): void {
  try {
    kv?.removeItem(PLAY_LOG_KEY);
  } catch {
    /* 저장이 막힌 기기 */
  }
}

function saveEntry(kv: Kv, e: ChapterLog): void {
  try {
    kv?.setItem(PLAY_LOG_KEY, JSON.stringify(upsertLog(readPlayLog(kv), e)));
  } catch {
    /* 저장이 막혀도 게임은 계속 */
  }
}

export interface PlayMeterOptions {
  chapterId: number;
  run: TeamRun;
  players: number;
  role: ChapterLog['role'];
  quality: () => Quality;
  /** FPS 표시(설정의 FPS 칩) */
  showFps?: (fps: number, note: string) => void;
}

export interface PlayMeter {
  /** 매 화면: 이번 프레임의 실제 시간(초, 자르기 전) */
  frame(rawSec: number): void;
  /** 지금 줄(시험·점검용) */
  current(): ChapterLog;
}

export function createPlayMeter(o: PlayMeterOptions): PlayMeter {
  const kv = browserStorage();
  const device = () => ({
    w: Math.round(window.innerWidth),
    h: Math.round(window.innerHeight),
    dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
    touch: (navigator.maxTouchPoints ?? 0) > 0 || (window.matchMedia?.('(pointer: coarse)').matches ?? false),
    ua: shortUa(navigator.userAgent),
  });
  let chapterId = o.chapterId;
  let stats = new FrameStats();
  let retry0 = o.run.state.retryCount;
  let entry: ChapterLog = fresh();
  let fpsT = 0;
  let fpsN = 0;
  let saveT = 0;

  function fresh(): ChapterLog {
    const s = o.run.state;
    return {
      runId: s.runId,
      roomId: s.roomId,
      chapterId,
      role: o.role,
      players: o.players,
      startedAt: Date.now(),
      playSec: 0,
      cutSec: 0,
      waitSec: 0,
      fpsAvg: 0,
      fpsLow: 0,
      quality: o.quality(),
      retries: 0,
      done: false,
      device: device(),
    };
  }

  function flush(): void {
    const s = o.run.state;
    entry = {
      ...entry,
      runId: s.runId,
      fpsAvg: Math.round(stats.avg() * 10) / 10,
      fpsLow: stats.low(),
      quality: o.quality(),
      retries: Math.max(0, s.retryCount - retry0),
      done: entry.done || s.completedChapters.includes(chapterId as never) || s.outcome === 'win',
      device: device(),
    };
    saveEntry(kv, entry);
  }

  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());

  return {
    frame(raw) {
      if (document.visibilityState !== 'visible') return;
      const s = o.run.state;
      // 한 화면에서 다음 장 놀이가 시작됐다(5장 → 6장)
      if (s.chapterId > chapterId && s.phase === 'play' && !s.completedChapters.includes(s.chapterId as never)) {
        flush();
        chapterId = s.chapterId;
        stats = new FrameStats();
        retry0 = s.retryCount;
        entry = fresh();
      }
      const dt = Math.max(0, Math.min(raw, 1)); // 첫 화면은 rAF 시각이 시작 시각보다 앞설 수 있다(음수)
      stats.add(raw);
      if (o.run.canPlay) entry.playSec += dt;
      else if (s.phase === 'cutscene' || s.phase === 'ending' || s.phase === 'lobby' || document.body.classList.contains('cutscene')) entry.cutSec += dt;
      else entry.waitSec += dt;
      fpsT += raw;
      fpsN++;
      if (fpsT >= 0.5) {
        o.showFps?.(fpsN / fpsT, o.quality() === 'low' ? '낮음' : '보통');
        fpsT = 0;
        fpsN = 0;
      }
      saveT += dt;
      if (saveT >= 3) {
        saveT = 0;
        flush();
      }
    },
    current() {
      flush();
      return { ...entry };
    },
  };
}
