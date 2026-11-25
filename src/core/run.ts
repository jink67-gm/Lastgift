// 팀 시도(run) 상태: 팀 시계, 장 전이, 기억, 체크포인트, 재시도, 산타 전달.
// 방장만 이 리듀서를 돌린다. 모든 명령은 방장이 받은 시각(at, ms)을 달고 들어온다.
// 클라이언트가 적어 보낸 시각(clientAt)은 판정에 쓰지 않는다.
// three.js·DOM·실제 시계에 의존하지 않으므로 테스트는 가짜 시간을 그대로 넣는다.
import { chapter, RUN_MS, type ChapterId, type MemoryId } from '../data/chapters';

export const SCHEMA_VERSION = 1;
const SEEN_LIMIT = 256;

export type Phase = 'lobby' | 'cutscene' | 'play' | 'timeout' | 'ending';
export type PauseReason = 'hostHidden' | 'alone';

export interface Snowglobe {
  /** 들고 있는 요정. null이면 안전 지점(썰매 옆)에 놓여 있다 */
  holder: string | null;
}

export interface RunState {
  schemaVersion: number;
  runId: string;
  roomId: string;
  seed: number;
  /** 재시도·장 전이마다 1 증가. 예전 시도에서 늦게 도착한 명령을 거른다 */
  epoch: number;
  phase: Phase;
  cutscene: string | null;
  /** 새 시도라면 시작할 때 공동 도입 연출을 튼다. 체크포인트에서 이어 하면 틀지 않는다 */
  introPending: boolean;
  chapterId: ChapterId;
  /** 시계가 멈춘 시점의 남은 시간. 시계가 가는 중이면 runningSince 기준 값 */
  remainingMs: number;
  /** 시계가 가기 시작한 방장 시각. 멈춰 있으면 null */
  runningSince: number | null;
  /** 이 장 최초 진입 때 한 번 저장한 남은 시간(0초가 되면 여기로 복구) */
  savedRemainingMs: number;
  completedChapters: ChapterId[];
  memories: MemoryId[];
  /** 장 바닥값으로 보태 준 시간의 합 */
  timeAssistMs: number;
  retryCount: number;
  /** 이 장의 임시 진행(장마다 키가 다르다). 0초가 되면 비운다 */
  progress: Record<string, unknown>;
  snowglobe: Snowglobe | null;
  pauseReasons: PauseReason[];
  /** 모두에게 알린 재개 시각. 이 시각에 시계가 다시 간다 */
  resumeAt: number | null;
  /** 최근 처리한 이벤트 ID(재전송·중복 방지) */
  seen: string[];
  outcome: 'win' | null;
}

/** 참가자 기기가 보낸 미션 이벤트에 붙는 값(명세서 §8) */
export interface ClientMeta {
  runId: string;
  epoch: number;
  playerId: string;
  eventId: string;
  /** 참가자 기기의 시각. 기록만 하고 판정에는 쓰지 않는다 */
  clientAt?: number;
}

export type RunCommand =
  | { type: 'start'; at: number }
  | { type: 'cutsceneDone'; at: number }
  | { type: 'tick'; at: number }
  | { type: 'setProgress'; at: number; key: string; value: unknown }
  | { type: 'lightFail'; at: number }
  | { type: 'pause'; at: number; reason: PauseReason }
  | { type: 'resume'; at: number; reason: PauseReason; resumeAt: number }
  | { type: 'playerLeft'; at: number; playerId: string }
  | ({ type: 'completeChapter'; at: number; chapterId: ChapterId } & Partial<ClientMeta>)
  | ({ type: 'retry'; at: number } & ClientMeta)
  | ({ type: 'openBag'; at: number } & ClientMeta)
  | ({ type: 'takeSnowglobe'; at: number } & ClientMeta)
  | ({ type: 'deliver'; at: number } & ClientMeta);

export type RunEffect =
  | { type: 'save'; checkpoint: Checkpoint }
  | { type: 'cutscene'; id: string }
  | { type: 'chapterComplete'; chapterId: ChapterId }
  | { type: 'memory'; memory: MemoryId }
  | { type: 'timeout'; chapterId: ChapterId }
  | { type: 'retry'; chapterId: ChapterId }
  | { type: 'ending'; outcome: 'win' }
  | { type: 'paused'; reasons: PauseReason[] }
  | { type: 'resumeAt'; at: number }
  | { type: 'rejected'; command: RunCommand['type']; reason: string };

export interface Result {
  state: RunState;
  effects: RunEffect[];
}

/** 체크포인트에 남기는 최소 필드(명세서 §7) */
export interface Checkpoint {
  schemaVersion: number;
  runId: string;
  roomId: string;
  chapterId: ChapterId;
  savedRemainingMs: number;
  completedChapters: ChapterId[];
  memories: MemoryId[];
  timeAssistMs: number;
  retryCount: number;
  seed: number;
}

// ── 시계 ────────────────────────────────────────────────

/** 방장 시각 at에서의 남은 시간(0 아래로 내려가지 않는다) */
export function remainingAt(s: RunState, at: number): number {
  const r = s.runningSince === null ? s.remainingMs : s.remainingMs - (at - s.runningSince);
  return Math.max(0, r);
}

/** 시계가 0이 되는 방장 시각. 멈춰 있으면 null */
export function deadline(s: RunState): number | null {
  return s.runningSince === null ? null : s.runningSince + s.remainingMs;
}

function freeze(s: RunState, at: number): RunState {
  if (s.runningSince === null) return s;
  return { ...s, remainingMs: remainingAt(s, at), runningSince: null };
}

function maybeRun(s: RunState, at: number): RunState {
  const canRun = s.phase === 'play' && s.pauseReasons.length === 0 && s.resumeAt === null;
  if (!canRun || s.runningSince !== null) return s;
  return { ...s, runningSince: at };
}

/**
 * 명령을 처리하기 전에 방장 시각 at까지 시간을 흘린다.
 * 마감과 정확히 같은 시각의 명령은 아직 유효하다(시간 초과는 마감을 넘긴 뒤에 확정한다).
 */
function advanceTo(s: RunState, at: number, fx: RunEffect[]): RunState {
  if (s.resumeAt !== null && s.pauseReasons.length === 0 && at >= s.resumeAt) {
    const resumeAt = s.resumeAt;
    s = maybeRun({ ...s, resumeAt: null }, resumeAt);
  }
  const end = deadline(s);
  if (s.phase === 'play' && end !== null && at > end) {
    s = { ...s, phase: 'timeout', remainingMs: 0, runningSince: null };
    fx.push({ type: 'timeout', chapterId: s.chapterId });
  }
  return s;
}

// ── 생성·체크포인트 ─────────────────────────────────────

export function createRun(runId: string, roomId: string, seed: number): RunState {
  return {
    schemaVersion: SCHEMA_VERSION,
    runId,
    roomId,
    seed,
    epoch: 0,
    phase: 'lobby',
    cutscene: null,
    introPending: true,
    chapterId: 0,
    remainingMs: RUN_MS,
    runningSince: null,
    savedRemainingMs: Math.max(RUN_MS, chapter(0).floorMs),
    completedChapters: [],
    memories: [],
    timeAssistMs: 0,
    retryCount: 0,
    progress: {},
    snowglobe: null,
    pauseReasons: [],
    resumeAt: null,
    seen: [],
    outcome: null,
  };
}

export function toCheckpoint(s: RunState): Checkpoint {
  return {
    schemaVersion: s.schemaVersion,
    runId: s.runId,
    roomId: s.roomId,
    chapterId: s.chapterId,
    savedRemainingMs: s.savedRemainingMs,
    completedChapters: [...s.completedChapters],
    memories: [...s.memories],
    timeAssistMs: s.timeAssistMs,
    retryCount: s.retryCount,
    seed: s.seed,
  };
}

/**
 * 체크포인트에서 이어 한다: 해당 장 시작, 저장한 남은 시간.
 * 이미 확정한 장에 다시 들어오는 것이므로 바닥값 보정을 다시 하지 않는다.
 * 5장 완료 기록이 있으면 6장 시작의 스노글로브를 복원한다.
 */
export function fromCheckpoint(cp: Checkpoint): RunState {
  const base = createRun(cp.runId, cp.roomId, cp.seed);
  return {
    ...base,
    introPending: false,
    chapterId: cp.chapterId,
    remainingMs: cp.savedRemainingMs,
    savedRemainingMs: cp.savedRemainingMs,
    completedChapters: [...cp.completedChapters],
    memories: [...cp.memories],
    timeAssistMs: cp.timeAssistMs,
    retryCount: cp.retryCount,
    snowglobe: cp.completedChapters.includes(5) ? { holder: null } : null,
  };
}

// ── 리듀서 ──────────────────────────────────────────────

function reject(s: RunState, cmd: RunCommand, reason: string, fx: RunEffect[]): RunState {
  fx.push({ type: 'rejected', command: cmd.type, reason });
  return s;
}

/** 참가자 이벤트 공통 검사: 다른 방·다른 시도·지난 epoch·이미 받은 이벤트를 거른다 */
function checkClient(s: RunState, m: Partial<ClientMeta>): string | null {
  if (m.runId !== undefined && m.runId !== s.runId) return 'otherRun';
  if (m.eventId !== undefined && s.seen.includes(m.eventId)) return 'duplicate';
  if (m.epoch !== undefined && m.epoch !== s.epoch) return 'staleEpoch';
  return null;
}

function markSeen(s: RunState, m: Partial<ClientMeta>): RunState {
  if (m.eventId === undefined) return s;
  const seen = [...s.seen, m.eventId];
  return { ...s, seen: seen.length > SEEN_LIMIT ? seen.slice(-SEEN_LIMIT) : seen };
}

/**
 * 장 완료 → 기억 → 다음 장 최초 체크포인트를 한 번에 확정하고 한 번만 저장한다.
 * 다음 장 최초 진입: savedRemainingMs = max(남은 시간, 바닥값), 보정한 양을 기록.
 */
function completeChapter(s: RunState, at: number, id: ChapterId, fx: RunEffect[]): RunState {
  s = freeze(s, at);
  const def = chapter(id);
  const completedChapters = [...s.completedChapters, id];
  const memories = def.memory !== null && !s.memories.includes(def.memory) ? [...s.memories, def.memory] : s.memories;
  fx.push({ type: 'chapterComplete', chapterId: id });
  if (def.memory !== null && memories !== s.memories) fx.push({ type: 'memory', memory: def.memory });

  const next = (id + 1) as ChapterId;
  const floor = chapter(next).floorMs;
  const saved = Math.max(s.remainingMs, floor);
  s = {
    ...s,
    completedChapters,
    memories,
    chapterId: next,
    epoch: s.epoch + 1,
    remainingMs: saved,
    savedRemainingMs: saved,
    timeAssistMs: s.timeAssistMs + (saved - s.remainingMs),
    progress: {},
    phase: 'cutscene',
    cutscene: `chapter${id}End`,
  };
  fx.push({ type: 'cutscene', id: s.cutscene! });
  fx.push({ type: 'save', checkpoint: toCheckpoint(s) });
  return s;
}

export function reduce(state: RunState, cmd: RunCommand): Result {
  const fx: RunEffect[] = [];
  let s = advanceTo(state, cmd.at, fx);

  switch (cmd.type) {
    case 'tick':
      break;

    case 'start': {
      if (s.phase !== 'lobby') {
        s = reject(s, cmd, 'notInLobby', fx);
        break;
      }
      if (s.introPending) {
        s = { ...s, introPending: false, phase: 'cutscene', cutscene: 'intro' };
        fx.push({ type: 'cutscene', id: 'intro' });
        fx.push({ type: 'save', checkpoint: toCheckpoint(s) });
      } else {
        s = maybeRun({ ...s, phase: 'play' }, cmd.at);
      }
      break;
    }

    case 'cutsceneDone': {
      if (s.phase !== 'cutscene') {
        s = reject(s, cmd, 'noCutscene', fx);
        break;
      }
      s = maybeRun({ ...s, phase: 'play', cutscene: null }, cmd.at);
      break;
    }

    case 'setProgress': {
      if (s.phase !== 'play') {
        s = reject(s, cmd, 'notPlaying', fx);
        break;
      }
      s = { ...s, progress: { ...s.progress, [cmd.key]: cmd.value } };
      break;
    }

    case 'lightFail': {
      // 가벼운 실수: 같은 장 안전 지점으로. 시계·체크포인트는 그대로, 정해진 임시 진행만 푼다.
      if (s.phase !== 'play') {
        s = reject(s, cmd, 'notPlaying', fx);
        break;
      }
      const progress = { ...s.progress };
      for (const k of chapter(s.chapterId).lightResetKeys) delete progress[k];
      s = { ...s, progress };
      break;
    }

    case 'completeChapter': {
      const bad = checkClient(s, cmd);
      if (bad) {
        s = reject(s, cmd, bad, fx);
        break;
      }
      s = markSeen(s, cmd);
      if (s.phase !== 'play') {
        s = reject(s, cmd, 'notPlaying', fx);
        break;
      }
      if (cmd.chapterId !== s.chapterId || s.completedChapters.includes(cmd.chapterId)) {
        s = reject(s, cmd, 'notCurrentChapter', fx);
        break;
      }
      if (cmd.chapterId === 5 || cmd.chapterId === 6) {
        // 5장은 배달 가방 열기, 6장은 산타 전달로만 끝난다.
        s = reject(s, cmd, 'useSpecificAction', fx);
        break;
      }
      s = completeChapter(s, cmd.at, cmd.chapterId, fx);
      break;
    }

    case 'retry': {
      // 0초 뒤: 같은 장 시작으로, 저장한 시간 복구, 임시 진행 초기화. 기억은 유지.
      const bad = checkClient(s, cmd);
      if (bad) {
        s = reject(s, cmd, bad, fx);
        break;
      }
      s = markSeen(s, cmd);
      if (s.phase !== 'timeout') {
        s = reject(s, cmd, 'notTimedOut', fx);
        break;
      }
      s = {
        ...s,
        phase: 'play',
        epoch: s.epoch + 1,
        retryCount: s.retryCount + 1,
        remainingMs: s.savedRemainingMs,
        runningSince: null,
        progress: {},
        snowglobe: s.completedChapters.includes(5) ? { holder: null } : null,
      };
      s = maybeRun(s, cmd.at);
      fx.push({ type: 'retry', chapterId: s.chapterId });
      fx.push({ type: 'save', checkpoint: toCheckpoint(s) });
      break;
    }

    case 'openBag': {
      // 유효한 가방 입력 한 번에 빛 넷이 합쳐져 스노글로브 하나가 된다.
      const bad = checkClient(s, cmd);
      if (bad) {
        s = reject(s, cmd, bad, fx);
        break;
      }
      s = markSeen(s, cmd);
      if (s.phase !== 'play' || s.chapterId !== 5) {
        s = reject(s, cmd, 'notChapter5', fx);
        break;
      }
      if (s.snowglobe) {
        s = reject(s, cmd, 'alreadyMade', fx);
        break;
      }
      s = { ...s, snowglobe: { holder: cmd.playerId } };
      s = completeChapter(s, cmd.at, 5, fx);
      break;
    }

    case 'takeSnowglobe': {
      const bad = checkClient(s, cmd);
      if (bad) {
        s = reject(s, cmd, bad, fx);
        break;
      }
      s = markSeen(s, cmd);
      if (s.phase !== 'play' || !s.snowglobe || s.snowglobe.holder !== null) {
        s = reject(s, cmd, 'notAvailable', fx);
        break;
      }
      s = { ...s, snowglobe: { holder: cmd.playerId } };
      break;
    }

    case 'deliver': {
      // 자동 전달 금지: 운반자가 직접 건넨 명령만. 방장이 받은 시각이 마감 이하일 때 승리.
      const bad = checkClient(s, cmd);
      if (bad) {
        s = reject(s, cmd, bad, fx);
        break;
      }
      s = markSeen(s, cmd);
      if (s.phase !== 'play' || s.chapterId !== 6) {
        s = reject(s, cmd, 'notPlaying', fx);
        break;
      }
      if (s.snowglobe?.holder !== cmd.playerId) {
        s = reject(s, cmd, 'notHolder', fx);
        break;
      }
      s = freeze(s, cmd.at);
      s = { ...s, phase: 'ending', outcome: 'win', completedChapters: [...s.completedChapters, 6], epoch: s.epoch + 1 };
      fx.push({ type: 'ending', outcome: 'win' });
      fx.push({ type: 'save', checkpoint: toCheckpoint(s) });
      break;
    }

    case 'pause': {
      if (s.pauseReasons.includes(cmd.reason)) break;
      s = freeze(s, cmd.at);
      s = { ...s, pauseReasons: [...s.pauseReasons, cmd.reason], resumeAt: null };
      fx.push({ type: 'paused', reasons: s.pauseReasons });
      break;
    }

    case 'resume': {
      if (!s.pauseReasons.includes(cmd.reason)) break;
      const pauseReasons = s.pauseReasons.filter((r) => r !== cmd.reason);
      s = { ...s, pauseReasons };
      if (pauseReasons.length === 0) {
        // 전원에게 같은 재개 시각을 알린다. 그때까지 시계는 멈춰 있다.
        const resumeAt = Math.max(cmd.resumeAt, cmd.at);
        s = { ...s, resumeAt };
        fx.push({ type: 'resumeAt', at: resumeAt });
        s = advanceTo(s, cmd.at, fx);
      }
      break;
    }

    case 'playerLeft': {
      // 나간 요정이 스노글로브를 들고 있었다면 안전 지점에 남긴다.
      if (s.snowglobe?.holder === cmd.playerId) s = { ...s, snowglobe: { holder: null } };
      break;
    }
  }
  return { state: s, effects: fx };
}

/** 명령 여러 개를 차례로 처리한다(테스트·재생용) */
export function reduceAll(state: RunState, cmds: readonly RunCommand[]): Result {
  const effects: RunEffect[] = [];
  let s = state;
  for (const c of cmds) {
    const r = reduce(s, c);
    s = r.state;
    effects.push(...r.effects);
  }
  return { state: s, effects };
}
