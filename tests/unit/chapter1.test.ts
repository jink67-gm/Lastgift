import { describe, expect, it } from 'vitest';
import { createChapter1, planAction, SACK, step, type Ch1State } from '../../src/core/chapter1';
import { CH1_HOUSES, GATES, LANDMARKS, LANE_HALF, MAP_FEATURES, STREETS, W, YARD, gateById, mailboxOf, toLane } from '../../src/data/chapter1';

const DT = 1 / 60;
const idle = { move: { x: 0, y: 0 }, actionDown: false, actionHeld: false };
/** 땅 방향 → 화면 의도(카메라 45°) */
const toScreen = (gx: number, gz: number) => {
  const l = Math.hypot(gx, gz) || 1;
  return { x: (gx - gz) / Math.SQRT2 / l, y: -(gx + gz) / Math.SQRT2 / l };
};

/** p0을 골목 좌표 경유점들을 차례로 걷게 한다 */
function walkPath(s0: Ch1State, pts: [number, number][], sec = 20): { state: Ch1State; events: string[] } {
  let st = s0;
  const ev: string[] = [];
  for (const [s, t] of pts) {
    const r = walkTo(st, s, t, sec);
    st = r.state;
    ev.push(...r.events);
  }
  return { state: st, events: ev };
}
const press = (st: Ch1State, id = 'p0') => step(st, { p0: { ...idle, actionDown: id === 'p0' }, p1: { ...idle, actionDown: id === 'p1' } }, DT);
/** 아치 → 골목 → 우체통에서 왼쪽 → 끝에서 위로 → 윗길 오른쪽 → 유나네 대문 앞 */
const ROUTE: [number, number][] = [[-4, 0], [18.6, 1.5], [19, -25], [38, -25], [38, 4], [41.0, 8.6]];

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
    expect(CH1_HOUSES.filter((h) => h.pot === 'windmill').length).toBe(3);
    // 낮은 담 + 대문 집이 넷(가짜 셋 + 유나네): 대문만 보고는 못 고른다
    expect(CH1_HOUSES.filter((h) => h.lowWall).map((h) => h.id).sort()).toEqual(GATES.map((g) => g.id).sort());
  });
  it('유나네는 골목 끝이 아니다: 아치에서 곧장 올라가면 우체통 갈림길에서 막힌다(유나네는 갈림길 왼쪽으로 돌아 윗길)', () => {
    expect(LANDMARKS.postBox.s).toBeGreaterThan(STREETS.M.s1);
    const yuna = gateById('yuna');
    expect(yuna.s).toBeGreaterThan(STREETS.U.s0);
    // 우편함은 모두 길(담 밖) 쪽에 있다
    for (const h of CH1_HOUSES.filter((x) => x.lowWall)) {
      const m = mailboxOf(h);
      const inside = Object.values(STREETS).some((r) => m.s > r.s0 && m.s < r.s1 && m.t > r.t0 && m.t < r.t1);
      expect(inside, h.id).toBe(true);
    }
  });
});

describe('1장 규칙', () => {
  it('골목 → 우체통에서 왼쪽 → 끝에서 위로 → 윗길 → 유나네 나무 대문: 닫힌 대문은 막고, 행동으로 열면 들어가 "찾았다"(한 번만)', () => {
    let r = walkPath(createChapter1(['p0', 'p1']), ROUTE);
    let s = r.state;
    expect(Math.hypot(toLane(s.players[0]!).s - 41.0, toLane(s.players[0]!).t - 8.6)).toBeLessThan(0.5);
    expect(r.events).not.toContain('found');
    // 닫힌 대문: 곧장 위로 못 들어간다
    s = walkTo(s, 46, 8.6, 3).state;
    expect(toLane(s.players[0]!).s).toBeLessThan(YARD.front);
    // 자루를 멘 채로도 대문 앞에서 행동 → 빗장이 풀려 열린다(지도·내려놓기보다 먼저)
    expect(planAction(s, 'p0')).toEqual({ kind: 'gate', gateId: 'yuna' });
    const o = press(s);
    expect(o.events).toEqual([{ type: 'gateOpened', playerId: 'p0' }]);
    s = o.state;
    expect(s.gateOpen).toBe(true);
    expect(s.items.find((i) => i.id === SACK)!.carriedBy).toBe('p0');
    expect(planAction(s, 'p0').kind).not.toBe('gate');
    r = walkTo(s, 45.3, 9.1, 4);
    expect(r.events.filter((e) => e === 'found')).toEqual(['found']);
    expect(r.state.found).toBe(true);
    r = walkTo(r.state, 47, 4, 4);
    expect(r.events).not.toContain('found');
  });
  it('가짜 집 대문(A·B·C)은 행동하면 덜컹거릴 뿐 열리지 않는다', () => {
    let s = walkPath(createChapter1(['p0', 'p1']), [[-4, 0], [8.6, 0], [8.6, -16.6]]).state;
    expect(planAction(s, 'p0')).toEqual({ kind: 'gate', gateId: 'A' });
    const r = press(s);
    expect(r.events).toEqual([{ type: 'gateLocked', playerId: 'p0', gateId: 'A' }]);
    s = walkTo(r.state, 8.6, -22, 3).state;
    expect(toLane(s.players[0]!).t).toBeGreaterThan(STREETS.D.t0);
    expect(s.gateOpen).toBe(false);
  });
  it('골목 울타리 밖으로 나가지 못한다', () => {
    const s = walkTo(createChapter1(['p0', 'p1']), 2, -12, 6).state;
    expect(toLane(s.players[0]!).t).toBeGreaterThan(-LANE_HALF);
  });
  it('갈림길에서 곧장 위로는 못 간다(우체통 뒤는 울타리)', () => {
    const s = walkPath(createChapter1(['p0', 'p1']), [[-4, 0], [18.6, 1.5], [30, 1.5]], 6).state;
    expect(toLane(s.players[0]!).s).toBeLessThan(STREETS.X.s1);
  });
  it('빈손 요정(2P)은 지도를 편다. 편 동안은 움직이지 않고, 한 번 더 누르면 접는다', () => {
    let s = createChapter1(['p0', 'p1']);
    // 자루 속 선물은 집을 수 없다 → 2P는 빈손이라 지도를 편다
    expect(planAction(s, 'p1')).toEqual({ kind: 'map', open: true });
    let r = step(s, { p0: idle, p1: { ...idle, actionDown: true } }, DT);
    expect(r.events).toEqual([{ type: 'map', playerId: 'p1', open: true }]);
    s = r.state;
    const before = { ...s.players[1]! };
    for (let i = 0; i < 30; i++) s = step(s, { p0: idle, p1: { ...idle, move: { x: 0, y: 1 } } }, DT).state;
    expect(s.players[1]!.x).toBeCloseTo(before.x);
    r = step(s, { p0: idle, p1: { ...idle, actionDown: true } }, DT);
    expect(r.state.players[1]!.mapOpen).toBe(false);
  });
  it('1P는 물고기 자루를 멘 채 시작하고, 자루를 멘 요정은 지도를 펴지 못한다(내려놓기만). 내려놓은 자루는 누구든 다시 멘다', () => {
    let s = createChapter1(['p0', 'p1']);
    expect(s.packed).toBe(true);
    expect(s.items.find((i) => i.id === SACK)!.carriedBy).toBe('p0');
    expect(['drop', 'blocked']).toContain(planAction(s, 'p0').kind);
    s = step(s, { p0: { ...idle, actionDown: true }, p1: idle }, DT).state;
    const sack = s.items.find((i) => i.id === SACK)!;
    expect(sack.carriedBy).toBeNull();
    s = at(s, 'p1', toLane(sack).s - 0.6, toLane(sack).t, 0);
    s = { ...s, players: s.players.map((q) => (q.id === 'p1' ? { ...q, facing: Math.atan2(sack.x - q.x, sack.z - q.z) } : q)) };
    expect(planAction(s, 'p1')).toEqual({ kind: 'pick', itemId: SACK });
  });
});

import { gazeAt, hiddenFromWindow, lookoutAt, GAZE } from '../../src/core/chapter1';
import { COVERS, GARDEN_PATH, LOOKOUTS, OUTSIDE_GATE, PORCH, YUNA_EYE, inPorch } from '../../src/data/chapter1';

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
  it('대문 → 현관 정원길은 비어 있다: 길 위 어느 점도 엄폐물(눈사람·나무·덤불·장작)에 막히지 않는다', () => {
    for (let i = 0; i + 1 < GARDEN_PATH.length; i++) {
      const a = GARDEN_PATH[i]!, b = GARDEN_PATH[i + 1]!;
      for (let k = 0; k <= 10; k++) {
        const ps = a.s + ((b.s - a.s) * k) / 10, pt = a.t + ((b.t - a.t) * k) / 10;
        for (const c of COVERS) expect(Math.hypot(ps - c.s, pt - c.t), `${c.id} @${ps.toFixed(1)},${pt.toFixed(1)}`).toBeGreaterThan(c.r * 0.8 + 0.35);
      }
    }
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
  it('창밖을 볼 때 드러난 요정은 마지막 엄폐물 뒤로(숨은 적 없으면 대문 밖), 멘 자루도 같이. 시각은 계속 간다', () => {
    let s = createChapter1(['p0', 'p1'], 7);
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
    const c = COVERS[1]!;
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
  it('현관 발판에서 자루를 열면 두 선물을 꺼내 놓고(다시 못 집음, 빈 자루는 그대로 멘다), 모두 앞마당 밖으로 물러나면 완료(한 번만)', () => {
    let s = createChapter1(['p0', 'p1'], 7);
    s = { ...s, time: 0 };
    const facePorch = Math.PI * 1.25; // 화면 위(집 쪽)를 본다
    s = at(s, 'p0', PORCH.s - 0.75, PORCH.t, facePorch);
    expect(planAction(s, 'p0')).toEqual({ kind: 'place', itemId: SACK });
    let r = step(s, { p0: { ...idle, actionDown: true }, p1: idle }, DT);
    s = r.state;
    expect(r.events.filter((e) => e.type === 'unpack').length).toBe(1);
    expect(r.events.filter((e) => e.type === 'placed').length).toBe(2);
    expect(s.packed).toBe(false);
    expect(s.items.filter((i) => i.id !== SACK).every((i) => inPorch(i) && i.carriedBy === null)).toBe(true);
    expect(s.items.find((i) => i.id === SACK)!.carriedBy).toBe('p0');
    // 한 번 더 눌러도 다시 꺼내지 않는다
    expect(step(s, { p0: { ...idle, actionDown: true }, p1: idle }, DT).events.some((e) => e.type === 'placed')).toBe(false);
    expect(s.complete).toBe(false); // 아직 앞마당 안
    s = at(s, 'p0', 40, 8);
    s = at(s, 'p1', 40, 9.5);
    r = step(s, { p0: idle, p1: idle }, DT);
    expect(r.events.filter((e) => e.type === 'complete').length).toBe(1);
    expect(step(r.state, { p0: idle, p1: idle }, DT).events.some((e) => e.type === 'complete')).toBe(false);
  });
});
