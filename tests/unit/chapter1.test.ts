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
