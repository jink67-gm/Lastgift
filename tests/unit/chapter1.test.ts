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
    // 우체통은 갈림길 한가운데가 아니라 위쪽 울타리 앞, 골목 입구 밖
    expect(LANDMARKS.postBox.s).toBeGreaterThan(STREETS.X.s1 - 1);
    expect(Math.abs(LANDMARKS.postBox.t)).toBeGreaterThan(LANE_HALF + 0.6);
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
    r = walkTo(r.state, 44.2, 4.2, 4);
    expect(r.events).not.toContain('found');
    // 정원길을 따라 막힘 없이 현관 앞까지
    const end = GARDEN_PATH[GARDEN_PATH.length - 1]!;
    // (유나가 창가를 떠나 있게 해 길만 본다)
    const g2 = walkPath({ ...r.state, yunaAway: 999 }, GARDEN_PATH.map((p) => [p.s, p.t] as [number, number]), 6).state;
    expect(Math.hypot(toLane(g2.players[0]!).s - end.s, toLane(g2.players[0]!).t - end.t)).toBeLessThan(0.4);
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

import { gazeAt, gazeOf, hiddenFromDoor, hiddenFromWindow, throwTarget, CAUGHT_PAUSE, DOOR_GRACE, GAZE, LOOK_GRACE, YUNA_AWAY } from '../../src/core/chapter1';
import { COVERS, DOOR_EYE, DOOR_TRIP, DOORBELL, GARDEN_PATH, OUTSIDE_GATE, PEER, PORCH, SENSOR_MELT, THROW, UNPACK_SEC, WINDOW_TARGET, YUNA_EYE, inPorch } from '../../src/data/chapter1';

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
/** 대문을 열고, 창밖을 본 지 봐주는 시간이 지난 때로 맞춘 상태 */
function looking(seed = 7): Ch1State {
  const s = createChapter1(['p0', 'p1'], seed);
  return { ...s, gateOpen: true, time: firstLook(seed) + LOOK_GRACE + 0.05 };
}
const walkRight = { ...idle, move: { x: 1, y: 0 } };
/** 눈뭉치를 쥔 요정이 초인종까지 거리에 맞게 누르고 있다가 뗀다 */
function throwAt(s0: Ch1State, id: 'p0' | 'p1'): Ch1State {
  let s = s0;
  const p = s.players.find((q) => q.id === id)!;
  const c = W(DOORBELL.s, DOORBELL.t);
  const power = (Math.hypot(c.x - p.x, c.z - p.z) - THROW.min) / (THROW.max - THROW.min);
  const tg = throwTarget(p, power);
  expect(Math.hypot(tg.x - c.x, tg.z - c.z)).toBeLessThan(DOORBELL.r * 0.5); // 대략 집 쪽을 보면 초인종 쪽으로 맞춰 준다
  const held = { ...idle, actionHeld: true };
  const inp = (x: typeof idle) => (id === 'p0' ? { p0: x, p1: idle } : { p0: idle, p1: x });
  s = step(s, inp({ ...held, actionDown: true }), DT).state;
  for (let i = 1; i < Math.round((power * THROW.chargeSec) / DT); i++) s = step(s, inp(held), DT).state;
  return step(s, inp(idle), DT).state;
}
/** 날아가는 눈뭉치가 떨어질 때까지(그 사건이 나오면 hit) */
function flyUntil(s0: Ch1State, type: string): { state: Ch1State; hit: boolean } {
  let s = s0;
  for (let i = 0; i < 180; i++) {
    const r = step(s, { p0: idle, p1: idle }, DT);
    s = r.state;
    if (r.events.some((e) => e.type === type)) return { state: s, hit: true };
  }
  return { state: s, hit: false };
}
const behind = (c: (typeof COVERS)[number]) => {
  const ds = c.s - YUNA_EYE.s, dt = c.t - YUNA_EYE.t, l = Math.hypot(ds, dt);
  return { s: c.s + (ds / l) * (c.r + 0.5), t: c.t + (dt / l) * (c.r + 0.5) };
};

describe('1장 들키지 않기(무궁화 꽃이 피었습니다 + 종)', () => {
  it('유나 시선: 그림 → 일어나 돌아서기(예고 1초) → 창밖 보기 → 다시 그림, 시드마다 같은 순서', () => {
    const seen: string[] = [];
    for (let t = 0; t < 20; t += 0.05) {
      const p = gazeAt(t, 7).phase;
      if (seen[seen.length - 1] !== p) seen.push(p);
    }
    expect(seen.slice(0, 5)).toEqual(['away', 'turn', 'look', 'back', 'away']);
    const L = firstLook(7);
    expect(gazeAt(L - 0.5, 7).phase).toBe('turn');
    expect(GAZE.turn).toBeGreaterThanOrEqual(0.8);
    expect(firstLook(7)).not.toBeCloseTo(firstLook(8), 1);
  });
  it('창에서 보이는가: 엄폐물 바로 뒤·창 바로 아래·앞마당 밖은 안 보이고, 앞마당 한가운데는 보인다', () => {
    for (const c of COVERS) {
      const b = behind(c);
      // 엄폐물 뒤에서 앉아야 숨는다(서 있으면 머리가 보인다)
      expect(hiddenFromWindow({ ...W(b.s, b.t), crouching: true }), c.id).toBe(true);
      expect(hiddenFromWindow({ ...W(b.s, b.t), crouching: false }), c.id).toBe(false);
    }
    expect(hiddenFromWindow(W(46, 0))).toBe(false);
    expect(hiddenFromWindow(W(YUNA_EYE.s - 0.9, YUNA_EYE.t + 0.5))).toBe(true);
    expect(hiddenFromWindow(W(40, 0))).toBe(true);
    expect(hiddenFromWindow(W(41, -8))).toBe(true); // 담 밖
  });
  it('창밖을 보는 동안: 앞마당에서 움직이면 들키고, 멈춰 있으면 괜찮다', () => {
    let s = at(looking(), 'p0', 46, 0);
    s = at(s, 'p1', 46, 2);
    const r = step(s, { p0: walkRight, p1: idle }, DT);
    expect(r.events.filter((e) => e.type === 'caught').map((e) => (e as { playerId: string }).playerId)).toEqual(['p0']);
    expect(r.state.caughtPause).toBeCloseTo(CAUGHT_PAUSE);
  });
  it('돌아본 첫 순간(봐주는 시간)에는 움직여도 괜찮다 — 돌아서는 걸 보고 멈출 틈', () => {
    let s = createChapter1(['p0', 'p1'], 7);
    s = at({ ...s, gateOpen: true, time: firstLook(7) + 0.05 }, 'p0', 46, 0);
    expect(step(s, { p0: walkRight, p1: idle }, DT).events.some((e) => e.type === 'caught')).toBe(false);
  });
  it('엄폐물 뒤에서 앉은 채로는 살금살금 움직여도 괜찮고(느리게 걷는다), 서서 움직이면 들킨다. 앞마당 밖은 괜찮다', () => {
    const c = COVERS[1]!;
    const b = behind(c);
    let s = at(looking(), 'p0', b.s, b.t);
    s = at(s, 'p1', 40, -2);
    const tiny = { ...idle, move: { x: 0.1, y: 0 } };
    const r = step(s, { p0: { ...tiny, crouch: true }, p1: walkRight }, DT);
    expect(r.events.some((e) => e.type === 'caught')).toBe(false);
    expect(r.state.players[0]!.crouching).toBe(true);
    const moved = Math.hypot(r.state.players[0]!.x - s.players[0]!.x, r.state.players[0]!.z - s.players[0]!.z);
    const r2 = step(s, { p0: tiny, p1: idle }, DT);
    const moved2 = Math.hypot(r2.state.players[0]!.x - s.players[0]!.x, r2.state.players[0]!.z - s.players[0]!.z);
    expect(moved).toBeLessThan(moved2 * 0.7); // 앉으면 느리다
    expect(r2.events.some((e) => e.type === 'caught' && (e as { playerId: string }).playerId === 'p0')).toBe(true);
  });
  it('들키면 검은 화면 동안 모두 멈추고, 가장 깜깜할 때 들킨 요정은 (멘 자루와 함께) 대문 앞으로. 밝아지면 유나는 다시 그림부터', () => {
    let s = at(looking(), 'p0', 46, 0);
    let r = step(s, { p0: walkRight, p1: idle }, DT);
    s = r.state;
    const p1Before = { ...s.players[1]! };
    let t = 0;
    let moved = false;
    while (s.caughtPause > 0 && t < 5) {
      r = step(s, { p0: walkRight, p1: walkRight }, DT);
      s = r.state;
      t += DT;
      if (Math.hypot(s.players[1]!.x - p1Before.x, s.players[1]!.z - p1Before.z) > 1e-6) moved = true;
    }
    expect(t).toBeGreaterThan(CAUGHT_PAUSE - 0.05);
    expect(moved).toBe(false); // 암전 동안은 다른 요정도 멈춘다
    const back = W(OUTSIDE_GATE.s, OUTSIDE_GATE.t);
    expect(Math.hypot(s.players[0]!.x - back.x, s.players[0]!.z - back.z)).toBeLessThan(0.3);
    expect(s.items.find((i) => i.carriedBy === 'p0')!.x).toBeCloseTo(s.players[0]!.x);
    expect(gazeOf(s).phase).toBe('away');
    expect(s.caughtIds).toEqual([]);
  });
  it('초인종: 앞마당 빈손 행동으로 눈을 뭉치고, 누르고 있다 떼어 던져 초인종을 맞히면 띵동 → 유나가 현관으로(창이 빔) → 문을 열고 두리번(엄폐물 뒤에 앉지 않으면 멈춰 있어도 들킴) → 들어가 창가에서 그림부터', () => {
    // p1: 앞마당 가운데에서 집 쪽(위)을 본다
    let s = at(looking(), 'p1', 50, 2, Math.PI * 1.25);
    s = at(s, 'p0', 40, -2); // 담 밖
    expect(planAction(s, 'p1')).toEqual({ kind: 'snowball' });
    s = step(s, { p0: idle, p1: { ...idle, actionDown: true } }, DT).state;
    expect(s.players[1]!.snowball).toBe(true);
    s = throwAt(s, 'p1');
    let r = flyUntil(s, 'doorbell');
    s = r.state;
    expect(r.hit).toBe(true);
    expect(gazeOf(s).phase).toBe('gone');
    // 현관까지 걸어오는 동안(창이 빔) 마당에서 움직여도 괜찮다
    let caught = false;
    for (let i = 0; i < Math.round((DOOR_TRIP.toDoor - 0.2) / DT); i++) {
      const q = step(s, { p0: idle, p1: { ...idle, move: { x: i % 60 < 30 ? 1 : -1, y: 0 } } }, DT);
      s = q.state;
      if (q.events.some((e) => e.type === 'caught')) caught = true;
    }
    expect(caught).toBe(false);
    // 문을 연다: p1이 마당 한가운데 서 있으면(멈춰 있어도) 두리번거리다 들킨다
    const ev: string[] = [];
    for (let i = 0; i < Math.round((0.4 + DOOR_GRACE + 0.2) / DT); i++) {
      const q = step(s, { p0: idle, p1: idle }, DT);
      s = q.state;
      ev.push(...q.events.map((e) => e.type));
    }
    expect(ev).toContain('doorOpen');
    expect(ev).toContain('caught');
  });
  it('문간에서 두리번거릴 때 엄폐물 뒤에 앉아 있으면 안 들킨다. 다 끝나면 창가에서 그림부터', () => {
    let s = looking();
    // 문간에서 본 엄폐물 바로 뒤(창 쪽 엄폐물 중 문간에서도 가리는 것)를 찾는다
    const spot = COVERS.map((c) => {
      const ds = c.s - DOOR_EYE.s, dt = c.t - DOOR_EYE.t, l = Math.hypot(ds, dt);
      return { s: c.s + (ds / l) * (c.r + 0.5), t: c.t + (dt / l) * (c.r + 0.5) };
    }).find((b) => hiddenFromDoor({ ...W(b.s, b.t), crouching: true }))!;
    expect(spot).toBeTruthy();
    s = at(s, 'p0', spot.s, spot.t);
    s = at(s, 'p1', 40, -2);
    s = { ...s, yunaAway: YUNA_AWAY, gazeShift: s.time }; // 방금 초인종이 울렸다
    let caught = false;
    for (let i = 0; i < Math.round((YUNA_AWAY + 0.5) / DT); i++) {
      const q = step(s, { p0: { ...idle, crouch: true }, p1: idle }, DT);
      s = q.state;
      if (q.events.some((e) => e.type === 'caught')) caught = true;
    }
    expect(caught).toBe(false);
    expect(gazeOf(s).phase).toBe('away');
  });
  it('눈뭉치가 빗나가면 퍽(유나는 그대로), 살짝 누르면 가까이 떨어진다', () => {
    let s = at(looking(), 'p1', 50, 2, Math.PI * 1.25);
    s = step(s, { p0: idle, p1: { ...idle, actionDown: true } }, DT).state;
    s = step(s, { p0: idle, p1: { ...idle, actionDown: true, actionHeld: true } }, DT).state;
    const r = flyUntil(step(s, { p0: idle, p1: idle }, DT).state, 'splat');
    expect(r.hit).toBe(true);
    expect(r.state.yunaAway).toBe(0);
  });
  it('역할: 자루를 든 요정은 눈을 뭉치지 못한다(앞마당에서 E는 내려놓기), 빈손 요정은 앞마당에서 눈을 뭉친다', () => {
    let s = at(looking(), 'p0', 50, 2, Math.PI * 1.25);
    s = at(s, 'p1', 50, 4, Math.PI * 1.25);
    expect(s.items.find((i) => i.id === SACK)!.carriedBy).toBe('p0');
    expect(['drop', 'blocked']).toContain(planAction(s, 'p0').kind);
    expect(planAction(s, 'p1')).toEqual({ kind: 'snowball' });
  });
  it('현관 센서등: 덮여 있지 않으면 현관 가까이 간 순간 불이 켜지고 유나가 곧장 창밖을 본다. 눈뭉치로 덮으면 한동안 꺼진다', () => {
    let s = createChapter1(['p0', 'p1'], 7);
    s = { ...s, gateOpen: true, time: 0.5 };
    expect(gazeOf(s).phase).toBe('away');
    s = at(s, 'p0', PORCH.s - 2.0, PORCH.t);
    let r = step(s, { p0: idle, p1: idle }, DT);
    expect(r.events.some((e) => e.type === 'porchLight')).toBe(true);
    expect(gazeOf(r.state).phase).toBe('look');
    // 덮으면(눈뭉치가 센서에 떨어짐) 꺼진다
    s = { ...s, sensorOff: SENSOR_MELT };
    r = step(s, { p0: idle, p1: idle }, DT);
    expect(r.events.some((e) => e.type === 'porchLight')).toBe(false);
    expect(gazeOf(r.state).phase).toBe('away');
  });
  it('창문 톡: 창가의 유나가 창 쪽만 한동안 본다 — 반대쪽(왼쪽)은 움직여도 괜찮고, 창 쪽에서 움직이면 들킨다', () => {
    let s = createChapter1(['p0', 'p1'], 7);
    s = { ...s, gateOpen: true, time: 0.5, sensorOff: SENSOR_MELT };
    // 창문에 맞는 눈뭉치
    const c = W(WINDOW_TARGET.s, WINDOW_TARGET.t);
    s = { ...s, balls: [{ from: 'p1', x0: c.x, z0: c.z, x1: c.x, z1: c.z, t: 0, dur: 0.001, target: 'window' }] };
    s = at(s, 'p0', 50, -6); // 왼쪽
    s = at(s, 'p1', 50, 8); // 창 쪽(오른쪽)
    let r = step(s, { p0: idle, p1: idle }, DT);
    expect(r.events.some((e) => e.type === 'windowTap')).toBe(true);
    expect(gazeOf(r.state).phase).toBe('peer');
    s = r.state;
    let caughtIds: string[] = [];
    for (let i = 0; i < Math.round((PEER.sec - 0.2) / DT) && !caughtIds.length; i++) {
      r = step(s, { p0: walkRight, p1: { ...idle, move: { x: -1, y: 0 } } }, DT);
      s = r.state;
      caughtIds = r.events.filter((e) => e.type === 'caught').map((e) => (e as { playerId: string }).playerId);
    }
    expect(caughtIds).toEqual(['p1']);
  });
  it('현관 발판에서 자루를 열면 두 선물을 한 번에 꺼내 놓고(다시 못 집음, 빈 자루는 그대로 멘다), 그 뒤 초인종을 울리면 유나가 문을 열고 발견 → 완료(한 번만)', () => {
    let s = createChapter1(['p0', 'p1'], 7);
    s = { ...s, time: 0, sensorOff: SENSOR_MELT }; // 센서등은 눈으로 덮어 둔 상태
    const facePorch = Math.PI * 1.25; // 화면 위(집 쪽)를 본다
    s = at(s, 'p0', PORCH.s - 0.75, PORCH.t, facePorch);
    expect(planAction(s, 'p0')).toEqual({ kind: 'place', itemId: SACK });
    // 누르고 있어야 열린다: 잠깐 누르고 떼면 그만둔다
    let r = step(s, { p0: { ...idle, actionDown: true, actionHeld: true }, p1: idle }, DT);
    r = step(r.state, { p0: idle, p1: idle }, DT);
    expect(r.state.packed).toBe(true);
    expect(r.state.players[0]!.unpack).toBeUndefined();
    // UNPACK_SEC 동안 누르고 있으면 두 선물을 한 번에 꺼낸다
    r = step(r.state, { p0: { ...idle, actionDown: true, actionHeld: true }, p1: idle }, DT);
    const evs: string[] = [];
    for (let i = 0; i < Math.round(UNPACK_SEC / DT) + 2; i++) {
      r = step(r.state, { p0: { ...idle, actionHeld: true }, p1: idle }, DT);
      evs.push(...r.events.map((e) => e.type));
    }
    s = r.state;
    expect(evs.filter((e) => e === 'unpack').length).toBe(1);
    expect(evs.filter((e) => e === 'placed').length).toBe(2);
    r = { state: s, events: [] };
    expect(s.packed).toBe(false);
    expect(s.items.filter((i) => i.id !== SACK).every((i) => inPorch(i) && i.carriedBy === null)).toBe(true);
    expect(s.items.find((i) => i.id === SACK)!.carriedBy).toBe('p0');
    // 한 번 더 눌러도 다시 꺼내지 않는다
    expect(step(s, { p0: { ...idle, actionDown: true }, p1: idle }, DT).events.some((e) => e.type === 'placed')).toBe(false);
    // 물러나기만 해서는 끝나지 않는다
    s = at(s, 'p0', 40, 8);
    s = at(s, 'p1', 40, 9.5);
    r = step(s, { p0: idle, p1: idle }, DT);
    expect(r.events.some((e) => e.type === 'complete')).toBe(false);
    // 초인종 → 문을 열고 발견 → 완료(한 번만)
    s = { ...r.state, yunaAway: YUNA_AWAY, gazeShift: r.state.time };
    const ev: { type: string; found?: boolean }[] = [];
    for (let i = 0; i < Math.round((DOOR_TRIP.toDoor + 0.5) / DT); i++) {
      const q = step(s, { p0: idle, p1: idle }, DT);
      s = q.state;
      ev.push(...(q.events as { type: string; found?: boolean }[]));
    }
    expect(ev.filter((e) => e.type === 'complete').length).toBe(1);
    expect(ev.find((e) => e.type === 'doorOpen')!.found).toBe(true);
    expect(s.complete).toBe(true);
  });
});
