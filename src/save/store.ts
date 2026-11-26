// 팀 체크포인트(방장 기기)와 개인 설정을 따로 저장한다.
// 저장소가 없거나(사생활 보호 모드) 가득 차도 게임은 계속되고, 실패는 결과로 알려 UI가 표시한다.
import type { QualitySetting } from '../core/quality';
import { SCHEMA_VERSION, type Checkpoint } from '../core/run';

/** localStorage와 같은 모양. 테스트에서는 메모리 구현을 넣는다 */
export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type SaveResult = { ok: true } | { ok: false; error: 'unavailable' | 'writeFailed' };

const CP_PREFIX = `lastgift.cp.v${SCHEMA_VERSION}.`;
const SETTINGS_KEY = 'lastgift.settings.v1';

/** 방마다 키를 나눠 다른 방의 진도·시간이 섞이지 않게 한다 */
export function checkpointKey(roomId: string): string {
  return CP_PREFIX + roomId;
}

function isCheckpoint(v: unknown): v is Checkpoint {
  if (!v || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  const ints = ['schemaVersion', 'chapterId', 'savedRemainingMs', 'timeAssistMs', 'retryCount', 'seed'];
  return (
    c.schemaVersion === SCHEMA_VERSION &&
    typeof c.runId === 'string' &&
    typeof c.roomId === 'string' &&
    ints.every((k) => Number.isInteger(c[k]) && (c[k] as number) >= 0) &&
    (c.chapterId as number) <= 6 &&
    Array.isArray(c.completedChapters) &&
    Array.isArray(c.memories)
  );
}

export class CheckpointStore {
  constructor(private readonly kv: KeyValue | null) {}

  /** 장 완료·기억·다음 장 최초 CP를 한 번의 쓰기로 확정한다 */
  save(cp: Checkpoint): SaveResult {
    if (!this.kv) return { ok: false, error: 'unavailable' };
    try {
      this.kv.setItem(checkpointKey(cp.roomId), JSON.stringify(cp));
      return { ok: true };
    } catch {
      return { ok: false, error: 'writeFailed' };
    }
  }

  /** 같은 방의 최신 체크포인트. 없거나 버전이 다르거나 깨졌으면 null */
  load(roomId: string): Checkpoint | null {
    if (!this.kv) return null;
    try {
      const raw = this.kv.getItem(checkpointKey(roomId));
      if (!raw) return null;
      const v: unknown = JSON.parse(raw);
      return isCheckpoint(v) && v.roomId === roomId ? v : null;
    } catch {
      return null;
    }
  }

  clear(roomId: string): void {
    try {
      this.kv?.removeItem(checkpointKey(roomId));
    } catch {
      /* 지우지 못해도 다음 저장이 덮어쓴다 */
    }
  }
}

// ── 개인 설정(팀 진도와 분리) ────────────────────────────

export interface Settings {
  muted: boolean;
  /** 눈발 축소 */
  reducedSnow: boolean;
  /** 카메라 흔들림 끄기 */
  noShake: boolean;
  /** 확대 글씨 */
  largeText: boolean;
  /** 그래픽 품질: 자동·낮음·보통 */
  quality: QualitySetting;
  /** 화면 구석 FPS 표시 */
  showFps: boolean;
}

export const DEFAULT_SETTINGS: Settings = { muted: false, reducedSnow: false, noShake: false, largeText: false, quality: 'auto', showFps: false };
const QUALITY_VALUES: readonly QualitySetting[] = ['auto', 'low', 'normal'];

export function loadSettings(kv: KeyValue | null): Settings {
  try {
    const raw = kv?.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const v = JSON.parse(raw) as Partial<Settings>;
    const out = { ...DEFAULT_SETTINGS };
    for (const k of ['muted', 'reducedSnow', 'noShake', 'largeText', 'showFps'] as const) if (typeof v[k] === 'boolean') out[k] = v[k];
    if (typeof v.quality === 'string' && QUALITY_VALUES.includes(v.quality)) out.quality = v.quality;
    return out;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(kv: KeyValue | null, s: Settings): SaveResult {
  if (!kv) return { ok: false, error: 'unavailable' };
  try {
    kv.setItem(SETTINGS_KEY, JSON.stringify(s));
    return { ok: true };
  } catch {
    return { ok: false, error: 'writeFailed' };
  }
}

/** 브라우저 저장소. 접근 자체가 막힌 환경이면 null */
export function browserStorage(): KeyValue | null {
  try {
    const ls = window.localStorage;
    const probe = 'lastgift.probe';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}
