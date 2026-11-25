// 명세서 §7 「재현 가능한 테스트」 표를 그대로 옮긴다. 시간은 모두 가짜(방장 시각 ms).
import { describe, expect, it } from 'vitest';
import {
  createRun,
  fromCheckpoint,
  reduce,
  reduceAll,
  remainingAt,
  toCheckpoint,
  type Checkpoint,
  type ClientMeta,
  type RunEffect,
  type RunState,
} from '../../src/core/run';
import type { ChapterId, MemoryId } from '../../src/data/chapters';

const S = 1000;
const RUN = 'run-1';

function cp(chapterId: ChapterId, savedRemainingMs: number, extra: Partial<Checkpoint> = {}): Checkpoint {
  const done = Array.from({ length: chapterId }, (_, i) => i as ChapterId);
  const memories = done.filter((c) => c >= 1 && c <= 4) as MemoryId[];
  return {
    schemaVersion: 1,
    runId: RUN,
    roomId: 'room-A',
    chapterId,
    savedRemainingMs,
    completedChapters: done,
    memories,
    timeAssistMs: 0,
    retryCount: 0,
    seed: 7,
    ...extra,
  };
}

/** 체크포인트에서 이어 하고 t=0에 플레이 시작 */
function playingFrom(c: Checkpoint): RunState {
  const r = reduce(fromCheckpoint(c), { type: 'start', at: 0 });
  expect(r.state.phase).toBe('play');
  return r.state;
}

let n = 0;
const meta = (s: RunState, playerId: string, extra: Partial<ClientMeta> = {}): ClientMeta => ({
  runId: s.runId,
  epoch: s.epoch,
  playerId,
  eventId: `${playerId}-${++n}`,
  ...extra,
});

const count = (fx: RunEffect[], type: RunEffect['type']) => fx.filter((e) => e.type === type).length;

describe('§7 재현 가능한 테스트', () => {
  it('4장 진입 시간 80초 → 300초 저장, 220초 보정. 실패 두 번 뒤에도 각각 300초', () => {
    // 3장을 300초로 시작해 220초 쓰고 완료 → 남은 80초로 4장 진입
    let s = playingFrom(cp(3, 300 * S));
    let r = reduce(s, { type: 'completeChapter', at: 220 * S, chapterId: 3 });
    s = r.state;
    expect(s.chapterId).toBe(4);
    expect(s.savedRemainingMs).toBe(300 * S);
    expect(s.remainingMs).toBe(300 * S);
    expect(s.timeAssistMs).toBe(220 * S);
    expect(r.effects.filter((e) => e.type === 'save')).toHaveLength(1);

    s = reduce(s, { type: 'cutsceneDone', at: 230 * S }).state;
    let t = 230 * S;
    for (let fail = 1; fail <= 2; fail++) {
      // 시간을 다 써서 0초 → 시간 초과
      t += 300 * S + 1;
      r = reduce(s, { type: 'tick', at: t });
      s = r.state;
      expect(s.phase).toBe('timeout');
      expect(count(r.effects, 'timeout')).toBe(1);
      r = reduce(s, { type: 'retry', at: t, ...meta(s, 'p0') });
      s = r.state;
      expect(s.phase).toBe('play');
      expect(s.chapterId).toBe(4);
      expect(remainingAt(s, t)).toBe(300 * S);
      expect(s.savedRemainingMs).toBe(300 * S);
      expect(s.timeAssistMs).toBe(220 * S); // 재진입에는 추가 보정 없음
      expect(s.retryCount).toBe(fail);
    }
  });

  it('4장 CP 750초, 스위치 실패 → CP 750초 유지, 현재 시간은 흐르고 전선·충전 유지', () => {
    let s = playingFrom(cp(4, 750 * S));
    s = reduceAll(s, [
      { type: 'setProgress', at: 5 * S, key: 'wires', value: 3 },
      { type: 'setProgress', at: 6 * S, key: 'charged', value: true },
      { type: 'setProgress', at: 7 * S, key: 'switchA', value: true },
      { type: 'setProgress', at: 7 * S, key: 'switchTimerAt', value: 7 * S },
    ]).state;
    const r = reduce(s, { type: 'lightFail', at: 20 * S });
    s = r.state;
    expect(r.effects.filter((e) => e.type === 'save')).toHaveLength(0);
    expect(s.savedRemainingMs).toBe(750 * S);
    expect(remainingAt(s, 20 * S)).toBe(730 * S);
    expect(remainingAt(s, 30 * S)).toBe(720 * S); // 시계는 계속 흐른다
    expect(s.progress).toEqual({ wires: 3, charged: true });
  });

  it('4장 0초 → 현재 장 시작으로, 전선·충전·스위치 초기화, 기억 1~3 유지', () => {
    let s = playingFrom(cp(4, 300 * S));
    s = reduceAll(s, [
      { type: 'setProgress', at: 1 * S, key: 'wires', value: 3 },
      { type: 'setProgress', at: 2 * S, key: 'charged', value: true },
      { type: 'setProgress', at: 3 * S, key: 'switchA', value: true },
      { type: 'tick', at: 300 * S + 1 },
    ]).state;
    expect(s.phase).toBe('timeout');
    s = reduce(s, { type: 'retry', at: 305 * S, ...meta(s, 'p1') }).state;
    expect(s.chapterId).toBe(4);
    expect(s.progress).toEqual({});
    expect(s.memories).toEqual([1, 2, 3]);
    expect(remainingAt(s, 305 * S)).toBe(300 * S);
  });

  it('두 기기의 동일 재시도 · 동일 기억 이벤트 → 시도 횟수와 기억 각각 한 번만 반영', () => {
    // 재시도: 두 기기가 같은 시간 초과에 대해 동시에 재시도를 보낸다
    let s = playingFrom(cp(2, 300 * S));
    s = reduce(s, { type: 'tick', at: 301 * S }).state;
    const m0 = meta(s, 'p0');
    const m1 = meta(s, 'p1'); // 같은 epoch
    let r = reduceAll(s, [
      { type: 'retry', at: 302 * S, ...m0 },
      { type: 'retry', at: 302 * S + 40, ...m1 },
      { type: 'retry', at: 302 * S + 90, ...m0 }, // 재전송
    ]);
    s = r.state;
    expect(s.retryCount).toBe(1);
    expect(count(r.effects, 'retry')).toBe(1);

    // 기억: 1장 완료 이벤트가 두 기기에서 오고, 하나는 재전송된다
    s = playingFrom(cp(1, 400 * S));
    const a = meta(s, 'p0');
    const b = meta(s, 'p1');
    r = reduceAll(s, [
      { type: 'completeChapter', at: 100 * S, chapterId: 1, ...a },
      { type: 'completeChapter', at: 100 * S + 30, chapterId: 1, ...b },
      { type: 'completeChapter', at: 100 * S + 80, chapterId: 1, ...a },
    ]);
    s = r.state;
    expect(s.memories).toEqual([1]);
    expect(s.completedChapters).toEqual([0, 1]);
    expect(count(r.effects, 'memory')).toBe(1);
    expect(count(r.effects, 'chapterComplete')).toBe(1);
    expect(count(r.effects, 'save')).toBe(1);
  });

  it('5장 가방 열기 두 번 · 6장 재접속 → 완성품 하나, 컷신과 다음 장 전이 중복 없음', () => {
    let s = playingFrom(cp(5, 200 * S));
    const first = meta(s, 'p0');
    const second = meta(s, 'p1');
    const r = reduceAll(s, [
      { type: 'openBag', at: 10 * S, ...first },
      { type: 'openBag', at: 10 * S + 20, ...second },
      { type: 'openBag', at: 10 * S + 50, ...first },
    ]);
    s = r.state;
    expect(s.snowglobe).toEqual({ holder: 'p0' });
    expect(s.chapterId).toBe(6);
    expect(count(r.effects, 'chapterComplete')).toBe(1);
    expect(count(r.effects, 'cutscene')).toBe(1);
    const saves = r.effects.filter((e): e is Extract<RunEffect, { type: 'save' }> => e.type === 'save');
    expect(saves).toHaveLength(1);

    // 6장에서 방장이 다시 접속: 마지막 저장에서 이어 한다
    const resumed = fromCheckpoint(saves[0]!.checkpoint);
    const r2 = reduce(resumed, { type: 'start', at: 0 });
    expect(r2.state.chapterId).toBe(6);
    expect(r2.state.phase).toBe('play');
    expect(r2.state.snowglobe).toEqual({ holder: null }); // 하나, 안전 지점에
    expect(r2.effects.filter((e) => e.type !== 'rejected')).toEqual([]); // 컷신·전이·저장 다시 없음
    const again = reduce(r2.state, { type: 'openBag', at: 1 * S, ...meta(r2.state, 'p1') });
    expect(again.state.snowglobe).toEqual({ holder: null });
    expect(count(again.effects, 'rejected')).toBe(1);
  });

  describe('마감과 전달', () => {
    function readyToDeliver(): RunState {
      let s = playingFrom(cp(6, 180 * S)); // 마감 = 180000
      s = reduce(s, { type: 'takeSnowglobe', at: 1 * S, ...meta(s, 'p2') }).state;
      expect(s.snowglobe?.holder).toBe('p2');
      return s;
    }

    it('마감과 같은 시각에 전달 → 승리, 이중 엔딩 없음', () => {
      const s = readyToDeliver();
      const r = reduceAll(s, [
        { type: 'tick', at: 180 * S }, // 같은 시각의 시계 틱이 먼저 와도
        { type: 'deliver', at: 180 * S, ...meta(s, 'p2') },
        { type: 'tick', at: 200 * S },
      ]);
      expect(r.state.phase).toBe('ending');
      expect(r.state.outcome).toBe('win');
      expect(count(r.effects, 'ending')).toBe(1);
      expect(count(r.effects, 'timeout')).toBe(0);
    });

    it('마감 1ms 후 전달 → 시간 초과(클라이언트가 적은 시각은 무시)', () => {
      const s = readyToDeliver();
      const r = reduce(s, { type: 'deliver', at: 180 * S + 1, ...meta(s, 'p2', { clientAt: 179 * S }) });
      expect(r.state.phase).toBe('timeout');
      expect(r.state.outcome).toBeNull();
      expect(count(r.effects, 'timeout')).toBe(1);
      expect(count(r.effects, 'ending')).toBe(0);
    });
  });
});

describe('§7 팀 시계 규칙', () => {
  it('새 시도는 30:00(1,800,000ms)이고 도입 연출 동안 멈춘다', () => {
    let s = createRun(RUN, 'room-A', 1);
    expect(s.remainingMs).toBe(1_800_000);
    let r = reduce(s, { type: 'start', at: 0 });
    s = r.state;
    expect(s.phase).toBe('cutscene');
    expect(count(r.effects, 'save')).toBe(1);
    expect(remainingAt(s, 90 * S)).toBe(1_800_000);
    s = reduce(s, { type: 'cutsceneDone', at: 90 * S }).state;
    expect(remainingAt(s, 100 * S)).toBe(1_790_000);
  });

  it('장 완료 연출 동안 멈추고, 연출이 끝나면 다시 흐른다', () => {
    let s = playingFrom(cp(1, 600 * S));
    s = reduce(s, { type: 'completeChapter', at: 100 * S, chapterId: 1 }).state;
    expect(s.phase).toBe('cutscene');
    expect(remainingAt(s, 160 * S)).toBe(500 * S);
    s = reduce(s, { type: 'cutsceneDone', at: 160 * S }).state;
    expect(remainingAt(s, 170 * S)).toBe(490 * S);
  });

  it('바닥값보다 많이 남았으면 보정하지 않는다', () => {
    let s = playingFrom(cp(1, 900 * S));
    s = reduce(s, { type: 'completeChapter', at: 100 * S, chapterId: 1 }).state;
    expect(s.savedRemainingMs).toBe(800 * S);
    expect(s.timeAssistMs).toBe(0);
  });

  it('방장 탭이 숨으면 팀 전체 일시중지, 알린 재개 시각부터 다시 흐른다', () => {
    let s = playingFrom(cp(2, 500 * S));
    s = reduce(s, { type: 'pause', at: 100 * S, reason: 'hostHidden' }).state;
    expect(remainingAt(s, 400 * S)).toBe(400 * S); // 숨어 있는 동안 멈춤
    const r = reduce(s, { type: 'resume', at: 400 * S, reason: 'hostHidden', resumeAt: 403 * S });
    s = r.state;
    expect(r.effects).toContainEqual({ type: 'resumeAt', at: 403 * S });
    expect(remainingAt(s, 402 * S)).toBe(400 * S); // 재개 시각 전까지 멈춤
    s = reduce(s, { type: 'tick', at: 410 * S }).state;
    expect(remainingAt(s, 410 * S)).toBe(393 * S);
  });

  it('일시중지 사유가 둘이면 둘 다 풀려야 다시 흐른다', () => {
    let s = playingFrom(cp(2, 500 * S));
    s = reduceAll(s, [
      { type: 'pause', at: 10 * S, reason: 'hostHidden' },
      { type: 'pause', at: 11 * S, reason: 'alone' },
      { type: 'resume', at: 20 * S, reason: 'hostHidden', resumeAt: 20 * S },
      { type: 'tick', at: 50 * S },
    ]).state;
    expect(remainingAt(s, 50 * S)).toBe(490 * S);
    s = reduceAll(s, [
      { type: 'resume', at: 60 * S, reason: 'alone', resumeAt: 63 * S },
      { type: 'tick', at: 73 * S },
    ]).state;
    expect(remainingAt(s, 73 * S)).toBe(480 * S);
  });

  it('스노글로브를 든 요정이 나가면 안전 지점에 남고, 다른 요정이 들어 전달할 수 있다', () => {
    let s = playingFrom(cp(6, 180 * S));
    s = reduceAll(s, [
      { type: 'takeSnowglobe', at: 1 * S, ...meta(s, 'p0') },
      { type: 'playerLeft', at: 2 * S, playerId: 'p0' },
    ]).state;
    expect(s.snowglobe).toEqual({ holder: null });
    s = reduce(s, { type: 'takeSnowglobe', at: 3 * S, ...meta(s, 'p1') }).state;
    const r = reduce(s, { type: 'deliver', at: 4 * S, ...meta(s, 'p1') });
    expect(r.state.outcome).toBe('win');
  });

  it('스노글로브를 안 든 요정의 전달, 6장 아닌 곳의 전달은 무효(자동 전달 없음)', () => {
    let s = playingFrom(cp(6, 180 * S));
    s = reduce(s, { type: 'takeSnowglobe', at: 1 * S, ...meta(s, 'p0') }).state;
    const r = reduce(s, { type: 'deliver', at: 2 * S, ...meta(s, 'p1') });
    expect(r.state.phase).toBe('play');
    expect(r.effects).toContainEqual({ type: 'rejected', command: 'deliver', reason: 'notHolder' });
  });

  it('다른 방(다른 runId)의 이벤트, 지난 epoch의 이벤트는 거른다', () => {
    const s = playingFrom(cp(1, 400 * S));
    const other = reduce(s, { type: 'completeChapter', at: 5 * S, chapterId: 1, ...meta(s, 'p0', { runId: 'run-2' }) });
    expect(other.state.completedChapters).toEqual([0]);
    expect(other.effects).toContainEqual({ type: 'rejected', command: 'completeChapter', reason: 'otherRun' });
    const stale = reduce(s, { type: 'completeChapter', at: 5 * S, chapterId: 1, ...meta(s, 'p0', { epoch: s.epoch - 1 }) });
    expect(stale.effects).toContainEqual({ type: 'rejected', command: 'completeChapter', reason: 'staleEpoch' });
  });

  it('체크포인트는 최소 필드만 담고, 되읽으면 같은 값이 된다', () => {
    const s = fromCheckpoint(cp(3, 321 * S, { retryCount: 2, timeAssistMs: 12 * S }));
    const c = toCheckpoint(s);
    expect(Object.keys(c).sort()).toEqual(
      ['chapterId', 'completedChapters', 'memories', 'retryCount', 'roomId', 'runId', 'savedRemainingMs', 'schemaVersion', 'seed', 'timeAssistMs'].sort(),
    );
    expect(toCheckpoint(fromCheckpoint(c))).toEqual(c);
  });
});
