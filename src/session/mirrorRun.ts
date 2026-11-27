// 참가자 기기의 팀 시도(run): 직접 계산하지 않고 방장 스냅샷을 비춘다.
// 장 코드는 방장·한 기기와 같은 모양(TeamRun)으로 쓰고, 참가자에서는
//   - dispatch: 다시 하기(retry)만 방장에게 보내고 나머지는 버린다(판정은 방장만)
//   - frame: 방장이 보낸 남은 시간·일시중지·카운트다운을 HUD에 그린다
import type { ClientMeta, RunCommand, RunEffect, RunState } from '../core/run';
import type { TeamSnapMsg } from '../net/protocol';
import type { Hud } from '../ui/hud';

/** 장 코드가 쓰는 팀 시도 모양(LocalRun과 MirrorRun이 같이 맞춘다) */
export interface TeamRun {
  readonly state: RunState;
  readonly log: RunEffect[];
  readonly canPlay: boolean;
  onEffect(fn: (e: RunEffect) => void): void;
  meta(): ClientMeta;
  dispatch(cmd: RunCommand): void;
  retry(at: number): void;
  frame(at: number): void;
  attachVisibility(doc: Document): void;
}

export interface MirrorLink {
  readonly slot: string;
  /** 방장과 이어져 있고 최근 스냅샷이 있다 */
  readonly connected: boolean;
  readonly snap: TeamSnapMsg | null;
  /** 스냅샷을 받은 이 기기 시각(ms) */
  readonly snapAt: number;
  sendRetry(meta: ClientMeta): void;
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  }
}

export class MirrorRun implements TeamRun {
  readonly log: RunEffect[] = [];
  private readonly listeners: ((e: RunEffect) => void)[] = [];
  private lastRetry = -1;
  private lastRunId = '';

  constructor(
    private readonly link: MirrorLink,
    private readonly hud: Hud,
    private readonly initial: RunState,
  ) {
    hud.onRetry(() => this.retry(performance.now()));
  }

  get view(): TeamSnapMsg['run'] | null {
    return this.link.snap?.run ?? null;
  }

  get state(): RunState {
    const full = this.link.snap?.run.full;
    return full ? ({ ...full, seen: [] } as RunState) : this.initial;
  }

  get canPlay(): boolean {
    const r = this.view;
    return this.link.connected && !!r && r.phase === 'play' && !r.paused && r.resumeIn === null;
  }

  onEffect(fn: (e: RunEffect) => void): void {
    this.listeners.push(fn);
  }

  meta(): ClientMeta {
    const s = this.state;
    return { runId: s.runId, epoch: s.epoch, playerId: this.link.slot, eventId: newId() };
  }

  dispatch(cmd: RunCommand): void {
    if (cmd.type === 'retry') this.retry(cmd.at);
  }

  retry(_at: number): void {
    if (this.link.connected && this.state.phase === 'timeout') this.link.sendRetry(this.meta());
  }

  frame(at: number): void {
    const r = this.view;
    if (!r) return;
    // 방장이 다시 하기를 받아들이면 재시도 횟수가 오른다 → 장 코드가 화면 쪽 임시 상태를 비우게 알린다
    if (r.runId === this.lastRunId && this.lastRetry >= 0 && r.full.retryCount > this.lastRetry) {
      const e: RunEffect = { type: 'retry', chapterId: r.full.chapterId };
      this.log.push(e);
      for (const fn of this.listeners) fn(e);
    }
    this.lastRetry = r.full.retryCount;
    this.lastRunId = r.runId;
    const since = at - this.link.snapAt;
    const running = r.phase === 'play' && !r.paused && r.resumeIn === null && this.link.connected;
    this.hud.setTime(running ? Math.max(0, r.remaining - since) : r.remaining);
    if (r.phase === 'timeout') this.hud.setOverlay({ kind: 'timeout' });
    else if (r.paused || !this.link.connected) this.hud.setOverlay({ kind: 'paused' });
    else if (r.resumeIn !== null) this.hud.setOverlay({ kind: 'countdown', secondsLeft: Math.max(1, Math.ceil((r.resumeIn - since) / 1000)) });
    else this.hud.setOverlay({ kind: 'none' });
  }

  attachVisibility(_doc: Document): void {
    // 참가자 탭이 숨는 것은 팀을 멈추지 않는다(방장이 소식이 끊긴 것으로 처리한다)
  }
}
