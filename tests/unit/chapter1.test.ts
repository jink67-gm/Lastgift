import { describe, expect, it } from 'vitest';
import { createChapter1, planAction, step, type Ch1State } from '../../src/core/chapter1';
import { ARCH, CH1_HOUSES, LANE_HALF, MAP_FEATURES, W, YARD, mailboxOf, toLane } from '../../src/data/chapter1';

const DT = 1 / 60;
const idle = { move: { x: 0, y: 0 }, actionDown: false, actionHeld: false };
/** 땅 방향 → 화면 의도(카메라 45°) */
const toScreen = (gx: number, gz: number) => {
  const l = Math.hypot(gx, gz) || 1;
  return { x: (gx - gz) / Math.SQRT2 / l, y: -(gx + gz) / Math.SQRT2 / l };
};

/** p0을 골목 좌표 (s, t)까지 걸린다(최대 sec초) */
function walkTo(s0: Ch1State, s: number, t: number, sec = 30): { state: Ch1State; events: string[] } {
  let st = s0;
  const ev: string[] = [];
  const goal = W(s, t);
  for (let i = 0; i < sec * 60; i++) {
    const p = st.players[0]!;
    const dx = goal.x - p.x, dz = goal.z - p.z;
    if (Math.hypot(dx, dz) < 0.2) break;
    const r = step(st, { p0: { ...idle, move: toScreen(dx, dz) }, p1: idle }, DT);
    st = r.state;
    ev.push(...r.events.map((e) => e.type));
  }
  return { state: st, events: ev };
}

describe('1장 공간', () => {
  it('지도와 모두 맞는 집은 유나네 하나뿐(물고기 우편함·대문 왼쪽, 풍차 화분·문 오른쪽, 낮은 담)', () => {
    const match = CH1_HOUSES.filter(
      (h) => h.mail === MAP_FEATURES.mail && h.mailSide === MAP_FEATURES.mailSide && h.pot === MAP_FEATURES.pot && h.potSide === MAP_FEATURES.potSide && !!h.lowWall,
    );
    expect(match.map((h) => h.id)).toEqual(['yuna']);
    // 미끼: 물고기 우편함인데 반대쪽, 풍차 화분만 같음, 물고기·왼쪽은 맞는데 화분이 다름
    expect(CH1_HOUSES.filter((h) => h.mail === 'fish').length).toBe(3);
    expect(CH1_HOUSES.filter((h) => h.pot === 'windmill').length).toBe(2);
  });
  it('아치 사이로 유나네 물고기 우편함이 보인다(같은 골목 줄, 아치보다 위쪽)', () => {
    const m = mailboxOf(CH1_HOUSES.find((h) => h.yuna)!);
    expect(m.s).toBeGreaterThan(ARCH.s + 30);
    expect(Math.abs(m.t)).toBeLessThan(ARCH.halfSpan + 3.5);
  });
});

describe('1장 규칙', () => {
  it('골목을 걸어 올라가 낮은 담 오른쪽 끝을 돌아 들어가면 "찾았다"(한 번만)', () => {
    let s = createChapter1(['p0', 'p1']);
    let r = walkTo(s, 38, 0, 25);
    expect(r.events).not.toContain('found');
    // 담 앞에서 곧장 위로는 못 들어간다
    s = walkTo(r.state, 46, 0, 3).state;
    expect(toLane(s.players[0]!).s).toBeLessThan(YARD.front);
    r = walkTo(s, 40.5, 8.5, 8);
    r = walkTo(r.state, 46, 8.4, 8);
    expect(r.events.filter((e) => e === 'found')).toEqual(['found']);
    expect(r.state.found).toBe(true);
    r = walkTo(r.state, 47, 4, 4);
    expect(r.events).not.toContain('found');
  });
  it('골목 울타리 밖으로 나가지 못한다', () => {
    const s = walkTo(createChapter1(['p0', 'p1']), 10, -12, 6).state;
    expect(toLane(s.players[0]!).t).toBeGreaterThan(-LANE_HALF);
  });
  it('빈손이고 집을 것이 없을 때만 지도를 편다. 편 동안은 움직이지 않고, 한 번 더 누르면 접는다', () => {
    let s = createChapter1(['p0', 'p1']);
    // 시작 자리 발치에 선물이 있다 → 먼저 줍는다
    expect(planAction(s, 'p0').kind).toBe('pick');
    s = walkTo(s, 0, 0, 8).state; // 선물에서 멀리
    expect(planAction(s, 'p0')).toEqual({ kind: 'map', open: true });
    let r = step(s, { p0: { ...idle, actionDown: true }, p1: idle }, DT);
    expect(r.events).toEqual([{ type: 'map', playerId: 'p0', open: true }]);
    s = r.state;
    const before = { ...s.players[0]! };
    for (let i = 0; i < 30; i++) s = step(s, { p0: { ...idle, move: { x: 0, y: 1 } }, p1: idle }, DT).state;
    expect(s.players[0]!.x).toBeCloseTo(before.x);
    r = step(s, { p0: { ...idle, actionDown: true }, p1: idle }, DT);
    expect(r.state.players[0]!.mapOpen).toBe(false);
  });
  it('선물을 든 요정은 지도를 펴지 못한다(놓기만)', () => {
    let s = createChapter1(['p0', 'p1']);
    s = step(s, { p0: { ...idle, actionDown: true }, p1: idle }, DT).state;
    expect(s.items.some((i) => i.carriedBy === 'p0')).toBe(true);
    const a = planAction(s, 'p0');
    expect(['drop', 'blocked']).toContain(a.kind);
  });
});

import { gazeAt, hiddenFromWindow, lookoutAt, GAZE } from '../../src/core/chapter1';
import { COVERS, LOOKOUTS, OUTSIDE_GATE, PORCH, YUNA_EYE, inPorch } from '../../src/data/chapter1';

/** 골목 좌표에 요정을 세운 상태 */
function at(s: Ch1State, id: string, ls: number, lt: number, facing = Math.PI * 1.25): Ch1State {
  const p = W(ls, lt);
  return { ...s, players: s.players.map((q) => (q.id === id ? { ...q, x: p.x, z: p.z, facing } : q)) };
}
/** 유나가 처음 창밖을 보기 시작하는 시각 */
function firstLook(seed: number): number {
  for (let t = 0; t < 30; t += 0.01) if (gazeAt(t, seed).phase === 'look') return t;
  return -1;
}

describe('1장 망보기(04-4b)', () => {
  it('유나 시선: 그림 → 몸 돌리기(예고 1초) → 창밖 보기 → 다시 그림, 시드마다 같은 순서', () => {
    const seen: string[] = [];
    for (let t = 0; t < 20; t += 0.05) {
      const p = gazeAt(t, 7).phase;
      if (seen[seen.length - 1] !== p) seen.push(p);
    }
    expect(seen.slice(0, 5)).toEqual(['away', 'turn', 'look', 'back', 'away']);
    const L = firstLook(7);
    expect(gazeAt(L - 0.5, 7).phase).toBe('turn');
    expect(GAZE.turn).toBeGreaterThanOrEqual(0.8);
    expect(firstLook(7)).toBeCloseTo(firstLook(7));
    expect(firstLook(7)).not.toBeCloseTo(firstLook(8), 1);
  });
  it('창에서 보이는가: 엄폐물 바로 뒤·창 바로 아래·앞마당 밖은 안 보이고, 앞마당 한가운데는 보인다', () => {
    const behind = (c: (typeof COVERS)[number]) => {
      const ds = c.s - YUNA_EYE.s, dt = c.t - YUNA_EYE.t, l = Math.hypot(ds, dt);
      return W(c.s + (ds / l) * (c.r + 0.5), c.t + (dt / l) * (c.r + 0.5));
    };
    for (const c of COVERS) expect(hiddenFromWindow(behind(c))).toBe(true);
    expect(hiddenFromWindow(W(46, 0))).toBe(false);
    expect(hiddenFromWindow(W(YUNA_EYE.s - 0.9, YUNA_EYE.t + 0.5))).toBe(true);
    expect(hiddenFromWindow(W(40, 0))).toBe(true);
    // 망보는 자리 둘 다 창에서 안 보인다
    for (const l of LOOKOUTS) expect(hiddenFromWindow(W(l.s, l.t))).toBe(true);
  });
  it('창밖을 볼 때 드러난 요정은 마지막 엄폐물 뒤로(숨은 적 없으면 대문 밖), 든 선물도 같이. 시각은 계속 간다', () => {
    let s = createChapter1(['p0', 'p1'], 7);
    s = step(s, { p0: { ...idle, actionDown: true }, p1: idle }, DT).state; // 스케치북 들기
    const L = firstLook(7);
    s = { ...s, time: L - 0.2 };
    s = at(s, 'p0', 46, 0);
    let caught = false;
    for (let i = 0; i < 30 && !caught; i++) {
      const r = step(s, { p0: idle, p1: idle }, DT);
      s = r.state;
      caught = r.events.some((e) => e.type === 'caught' && e.playerId === 'p0');
    }
    expect(caught).toBe(true);
    const back = W(OUTSIDE_GATE.s, OUTSIDE_GATE.t);
    expect(Math.hypot(s.players[0]!.x - back.x, s.players[0]!.z - back.z)).toBeLessThan(0.3);
    expect(s.items.find((i) => i.carriedBy === 'p0')!.x).toBeCloseTo(s.players[0]!.x);
    expect(s.time).toBeGreaterThanOrEqual(L - 0.02);
  });
  it('엄폐물 뒤에 숨었던 적이 있으면 그 자리로 돌아간다', () => {
    let s = createChapter1(['p0', 'p1'], 7);
    const c = COVERS[1];
    const ds = c.s - YUNA_EYE.s, dt = c.t - YUNA_EYE.t, l = Math.hypot(ds, dt);
    s = at(s, 'p0', c.s + (ds / l) * (c.r + 0.5), c.t + (dt / l) * (c.r + 0.5));
    s = { ...s, time: 0.1 };
    s = step(s, { p0: idle, p1: idle }, DT).state;
    const hide = { ...s.players[0]!.lastCover! };
    s = at(s, 'p0', 46, 0);
    s = { ...s, time: firstLook(7) + 0.05 };
    s = step(s, { p0: idle, p1: idle }, DT).state;
    expect(Math.hypot(s.players[0]!.x - hide.x, s.players[0]!.z - hide.z)).toBeLessThan(0.05);
  });
  it('망보는 자리의 빈손 요정: 행동 버튼으로 손 들기·내리기, 자리를 떠나면 손을 내린다', () => {
    let s = createChapter1(['p0', 'p1'], 7);
    s = at(s, 'p1', LOOKOUTS[0].s, LOOKOUTS[0].t);
    expect(lookoutAt(s.players[1]!)).not.toBeNull();
    expect(planAction(s, 'p1')).toEqual({ kind: 'signal', up: true });
    s = step(s, { p0: idle, p1: { ...idle, actionDown: true } }, DT).state;
    expect(s.players[1]!.handUp).toBe(true);
    for (let i = 0; i < 60; i++) s = step(s, { p0: idle, p1: { ...idle, move: { x: -1, y: 0 } } }, DT).state;
    expect(s.players[1]!.handUp).toBe(false);
  });
  it('현관 발판에 놓으면 고정(다시 못 집음), 둘 다 놓고 모두 앞마당 밖으로 물러나면 완료(한 번만)', () => {
    let s = createChapter1(['p0', 'p1'], 7);
    // 두 요정이 하나씩 들고 현관 앞에(유나가 보지 않는 동안)
    s = step(s, { p0: { ...idle, actionDown: true }, p1: { ...idle, actionDown: true } }, DT).state;
    expect(s.items.every((i) => i.carriedBy)).toBe(true);
    s = { ...s, time: 0 };
    const facePorch = Math.PI * 1.25; // 화면 위(집 쪽)를 본다
    s = at(s, 'p0', PORCH.s - 0.75, PORCH.t - 0.6, facePorch);
    s = at(s, 'p1', PORCH.s - 0.75, PORCH.t + 0.6, facePorch);
    expect(planAction(s, 'p0').kind).toBe('place');
    let r = step(s, { p0: { ...idle, actionDown: true }, p1: { ...idle, actionDown: true } }, DT);
    s = r.state;
    expect(r.events.filter((e) => e.type === 'placed').length).toBe(2);
    expect(s.items.every((i) => inPorch(i))).toBe(true);
    expect(planAction(s, 'p0').kind).not.toBe('pick');
    expect(s.complete).toBe(false); // 아직 앞마당 안
    s = at(s, 'p0', 40, 8);
    s = at(s, 'p1', 40, 9.5);
    r = step(s, { p0: idle, p1: idle }, DT);
    expect(r.events.filter((e) => e.type === 'complete').length).toBe(1);
    expect(step(r.state, { p0: idle, p1: idle }, DT).events.some((e) => e.type === 'complete')).toBe(false);
  });
});
