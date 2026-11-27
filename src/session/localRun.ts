// 이 기기가 방장일 때 팀 시도 상태를 돌린다: 리듀서 + 저장소 + HUD 연결.
// 네트워크(STEP 03)가 붙으면 참가자 명령도 같은 dispatch로 들어온다.
import {
  createRun,
  fromCheckpoint,
  reduce,
  remainingAt,
  toCheckpoint,
  type Checkpoint,
  type ClientMeta,
  type RunCommand,
  type RunEffect,
  type RunState,
} from '../core/run';
import type { CheckpointStore } from '../save/store';
import type { Hud } from '../ui/hud';

/** 탭이 다시 보일 때 모두에게 알리는 재개 대기 시간 */
export const RESUME_DELAY_MS = 3000;

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

export class LocalRun {
  state: RunState;
  readonly log: RunEffect[] = [];
  private seq = 0;

  private readonly listeners: ((e: RunEffect) => void)[] = [];

  /**
   * @param firstCheckpoint 저장된 기록이 없을 때 시작할 장(개발용 장 바로 열기). 없으면 새 시도(0장).
   */
  constructor(
    private readonly store: CheckpointStore,
    private readonly hud: Hud,
    readonly roomId: string,
    readonly playerId: string,
    firstCheckpoint?: (runId: string, seed: number) => Checkpoint,
  ) {
    const saved = store.load(roomId);
    const runId = newId();
    const seed = Math.floor(Math.random() * 2 ** 31);
    this.state = saved
      ? fromCheckpoint(saved)
      : firstCheckpoint
        ? fromCheckpoint(firstCheckpoint(runId, seed))
        : createRun(runId, roomId, seed);
    hud.onRetry(() => this.retry(performance.now()));
  }

  /** 저장된 기록이 없으면 지금 상태를 저장한다(여러 기기 방장: 방장 창을 다시 열어도 같은 시도로 이어지게) */
  ensureSaved(): void {
    if (this.store.load(this.roomId) === null) this.hud.setSaveError(!this.store.save(toCheckpoint(this.state)).ok);
  }

  /** 리듀서가 낸 효과(저장·재시도·장 완료 등)를 받는다 */
  onEffect(fn: (e: RunEffect) => void): void {
    this.listeners.push(fn);
  }

  /** 참가자 이벤트 머리표(runId, epoch, playerId, eventId) */
  meta(): ClientMeta {
    return { runId: this.state.runId, epoch: this.state.epoch, playerId: this.playerId, eventId: `${this.playerId}-${++this.seq}` };
  }

  dispatch(cmd: RunCommand): void {
    const r = reduce(this.state, cmd);
    this.state = r.state;
    for (const e of r.effects) {
      this.log.push(e);
      if (e.type === 'save') this.hud.setSaveError(!this.store.save(e.checkpoint).ok);
      for (const fn of this.listeners) fn(e);
    }
  }

  retry(at: number): void {
    this.dispatch({ type: 'retry', at, ...this.meta() });
  }

  /** 지금 요정이 움직여도 되는가(연출·일시중지·시간 초과·엔딩 중에는 멈춘다) */
  get canPlay(): boolean {
    const s = this.state;
    return s.phase === 'play' && s.pauseReasons.length === 0 && s.resumeAt === null;
  }

  frame(at: number): void {
    this.dispatch({ type: 'tick', at });
    const s = this.state;
    this.hud.setTime(remainingAt(s, at));
    if (s.phase === 'timeout') this.hud.setOverlay({ kind: 'timeout' });
    else if (s.pauseReasons.length > 0) this.hud.setOverlay({ kind: 'paused' });
    else if (s.resumeAt !== null) this.hud.setOverlay({ kind: 'countdown', secondsLeft: Math.max(1, Math.ceil((s.resumeAt - at) / 1000)) });
    else this.hud.setOverlay({ kind: 'none' });
  }

  /** 방장 탭이 숨으면 팀 전체 일시중지, 다시 보이면 같은 재개 시각을 알린다 */
  attachVisibility(doc: Document): void {
    doc.addEventListener('visibilitychange', () => {
      const at = performance.now();
      if (doc.visibilityState === 'hidden') this.dispatch({ type: 'pause', at, reason: 'hostHidden' });
      else this.dispatch({ type: 'resume', at, reason: 'hostHidden', resumeAt: at + RESUME_DELAY_MS });
    });
  }
}
