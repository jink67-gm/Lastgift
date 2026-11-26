import { describe, expect, it } from 'vitest';
import { createChapter3, KONGI, PASS, planAction, step, type Ch3Event, type Ch3State } from '../../src/core/chapter3';
import { BALL_SPOT, FENCES, KONGI_DEN, SAFE, W, regionOf, toLane } from '../../src/data/chapter3';

const DT = 1 / 60;
const idle = { move: { x: 0, y: 0 }, actionDown: false, actionHeld: false };
const press = { ...idle, actionDown: true };
const toScreen = (gx: number, gz: number) => {
  const l = Math.hypot(gx, gz) || 1;
  return { x: (gx - gz) / Math.SQRT2 / l, y: -(gx + gz) / Math.SQRT2 / l };
};

/** 요정을 길 좌표 (s, t)에 세운다 */
function put(st: Ch3State, id: string, s: number, t: number): Ch3State {
  const p = W(s, t);
  const players = st.players.map((q) => (q.id === id ? { ...q, x: p.x, z: p.z, handUp: false } : q));
  const ball = st.ball.carriedBy === id ? { ...st.ball, x: p.x, z: p.z } : st.ball;
  return { ...st, players, ball };
}
/** 콩이를 멀리 재워 둔다(던지기만 시험할 때) */
const noDog = (st: Ch3State): Ch3State => ({ ...st, kongi: { ...st.kongi, x: 999, z: 999, mode: 'sleep' } });

function run(st0: Ch3State, inputs: Record<string, typeof idle>, sec: number, keepDogAway = false): { state: Ch3State; events: Ch3Event[] } {
  let st = st0;
  const ev: Ch3Event[] = [];
  for (let i = 0; i < Math.round(sec * 60); i++) {
    const r = step(keepDogAway ? noDog(st) : st, i === 0 ? inputs : Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, { ...v, actionDown: false }])), DT);
    st = r.state;
    ev.push(...r.events);
  }
  return { state: st, events: ev };
}

/** id를 길 좌표 쪽으로 sec초 걸린다 */
function walk(st0: Ch3State, id: string, s: number, t: number, sec: number): Ch3State {
  let st = st0;
  const goal = W(s, t);
  for (let i = 0; i < sec * 60; i++) {
    const p = st.players.find((q) => q.id === id)!;
    const dx = goal.x - p.x, dz = goal.z - p.z;
    if (Math.hypot(dx, dz) < 0.15) break;
    st = step(noDog(st), { [id]: { ...idle, move: toScreen(dx, dz) } }, DT).state;
  }
  return st;
}

const lane = (p: { x: number; z: number }) => toLane(p);

describe('3장 공 들기와 쪽문', () => {
  it('발치의 공을 들고, 공을 든 채로는 쪽문을 지나지 못하지만 빈손이면 지나간다', () => {
    let st = noDog(createChapter3(['p0', 'p1']));
    st = run(st, { p0: press }, 0.05, true).state;
    expect(st.ball.carriedBy).toBe('p0');
    // 쪽문 바로 앞에서 위(s+)로 걷기
    const gt = (FENCES.first.gate[0] + FENCES.first.gate[1]) / 2;
    st = put(st, 'p0', FENCES.first.s - 1.2, gt);
    st = walk(st, 'p0', FENCES.first.s + 2, gt, 2);
    expect(lane(st.players[0]!).s).toBeLessThan(FENCES.first.s);
    // 빈손 p1은 지나간다
    st = put(st, 'p1', FENCES.first.s - 1.2, gt);
    st = walk(st, 'p1', FENCES.first.s + 2, gt, 2);
    expect(lane(st.players[1]!).s).toBeGreaterThan(FENCES.first.s + 1);
    // 쪽문이 아닌 울타리는 빈손도 못 넘는다
    st = put(st, 'p1', FENCES.first.s - 1.2, -2);
    st = walk(st, 'p1', FENCES.first.s + 2, -2, 2);
    expect(lane(st.players[1]!).s).toBeLessThan(FENCES.first.s);
  });
});

describe('3장 던져 받기', () => {
  it('받을 요정이 손을 들면, 공을 든 요정의 행동이 "던지기"가 되고 울타리 너머 손으로 포물선 비행 뒤 받는다', () => {
    let st = noDog(createChapter3(['p0', 'p1']));
    st = run(st, { p0: press }, 0.05, true).state;
    st = put(st, 'p0', 6, 0);
    st = put(st, 'p1', 12, 0); // 울타리① 너머
    expect(planAction(st, 'p0').kind).toBe('drop');
    st = run(st, { p1: press }, 0.05, true).state;
    expect(st.players[1]!.handUp).toBe(true);
    expect(planAction(st, 'p0')).toEqual({ kind: 'throw', to: 'p1' });
    const r = run(st, { p0: press }, 0.3, true);
    expect(r.events.some((e) => e.type === 'throw')).toBe(true);
    expect(r.state.ball.flight).not.toBeNull();
    const done = run(r.state, {}, 1.0, true);
    expect(done.events.some((e) => e.type === 'catch' && e.playerId === 'p1')).toBe(true);
    expect(done.state.ball.carriedBy).toBe('p1');
    expect(done.state.players[1]!.handUp).toBe(false);
    expect(done.state.passes).toBe(1);
  });
  it('너무 먼(보이는 거리 밖) 동료에게는 던지지 않는다', () => {
    let st = noDog(createChapter3(['p0', 'p1']));
    st = run(st, { p0: press }, 0.05, true).state;
    st = put(st, 'p0', 2, 0);
    st = put(st, 'p1', 2 + PASS.max + 1, 0);
    st = run(st, { p1: press }, 0.05, true).state;
    expect(planAction(st, 'p0').kind).toBe('drop');
  });
  it('던진 뒤 받을 요정이 자리를 떠나면 공은 떨어질 구역의 안전 지점으로', () => {
    let st = noDog(createChapter3(['p0', 'p1']));
    st = run(st, { p0: press }, 0.05, true).state;
    st = put(st, 'p0', 6, 0);
    st = put(st, 'p1', 12, 0);
    st = run(st, { p1: press }, 0.05, true).state;
    st = run(st, { p0: press }, 0.05, true).state;
    st = put(st, 'p1', 16, -3); // 날아오는 동안 자리를 뜬다
    const r = run(st, {}, 1.2, true);
    expect(r.events.some((e) => e.type === 'miss')).toBe(true);
    expect(r.state.ball.carriedBy).toBeNull();
    expect(regionOf(r.state.ball)).toBe('alley');
    expect(Math.hypot(r.state.ball.x - SAFE.alley.x, r.state.ball.z - SAFE.alley.z)).toBeLessThan(1e-6);
  });
  it('움직이면 든 손을 내린다', () => {
    let st = noDog(createChapter3(['p0', 'p1']));
    st = run(st, { p1: press }, 0.05, true).state;
    expect(st.players[1]!.handUp).toBe(true);
    st = walk(st, 'p1', -2, 3, 0.3);
    expect(st.players[1]!.handUp).toBe(false);
  });
});

describe('3장 콩이', () => {
  it('공이 가까이 오면 깨어 쫓고, 공을 든 요정에게 닿으면 리본을 물어 그동안 요정이 멈춘다 → 놓아주고 비켜 앉았다가 다시 쫓는다', () => {
    let st = createChapter3(['p0', 'p1']);
    st = run(st, { p0: press }, 0.05).state;
    expect(st.kongi.mode).toBe('sleep');
    // 콩이 상자 가까이 공을 든 채 선다
    const den = lane(KONGI_DEN);
    st = put(st, 'p0', den.s - 4, den.t + 3);
    let r = run(st, {}, 0.1);
    expect(r.events.some((e) => e.type === 'wake')).toBe(true);
    r = run(r.state, {}, 3);
    expect(r.events.some((e) => e.type === 'bite' && e.playerId === 'p0')).toBe(true);
    expect(r.state.kongi.mode === 'bite' || r.state.kongi.mode === 'rest').toBe(true);
    // 물린 동안: 움직이지도, 던지지도 못한다
    let b = r.state;
    // 막 문 순간을 잡는다(물린 시간이 넉넉히 남았을 때)
    for (let i = 0; i < 900 && !(b.kongi.mode === 'bite' && b.kongi.left > KONGI.biteSec - 0.1); i++) b = step(b, {}, DT).state;
    expect(b.kongi.biting).toBe('p0');
    expect(planAction(b, 'p0').kind).toBe('held');
    const before = { ...b.players[0]! };
    const m = run(b, { p0: { ...idle, move: { x: 0, y: 1 } } }, 0.4);
    expect(Math.hypot(m.state.players[0]!.x - before.x, m.state.players[0]!.z - before.z)).toBeLessThan(1e-6);
    // 놓아준다 → 비켜 앉는다 → 다시 쫓는다
    const rel = run(m.state, {}, KONGI.biteSec + 0.2);
    expect(rel.events.some((e) => e.type === 'release')).toBe(true);
    expect(rel.state.kongi.mode).toBe('rest');
    const back = run(rel.state, {}, KONGI.restSec + 0.1);
    expect(['chase', 'bite']).toContain(back.state.kongi.mode);
  });
  it('공이 날아가면 콩이는 떨어질 곳으로, 땅에 있으면 공 둘레를 맴돈다', () => {
    let st = createChapter3(['p0', 'p1']);
    st = { ...st, kongi: { ...st.kongi, mode: 'chase' } };
    // 공은 땅(시작 자리). 콩이가 가서 맴돈다
    const r = run(st, {}, 12);
    expect(r.state.kongi.mode).toBe('circle');
    expect(Math.hypot(r.state.kongi.x - st.ball.x, r.state.kongi.z - st.ball.z)).toBeLessThan(KONGI.circleR + 0.4);
  });
});

describe('3장 완료', () => {
  it('민재네 대문 안쪽 자리에 공을 내려놓으면 한 번만 완료, 콩이는 공 둘레를 돈다', () => {
    let st = noDog(createChapter3(['p0', 'p1']));
    st = run(st, { p0: press }, 0.05, true).state;
    // 대문 안쪽 자리 바로 앞(내려놓는 자리가 요정 앞 0.75)
    st = put(st, 'p0', BALL_SPOT.s - 0.75, BALL_SPOT.t);
    st = { ...st, players: st.players.map((q) => (q.id === 'p0' ? { ...q, facing: Math.atan2(W(1, 0).x, W(1, 0).z) } : q)) };
    expect(planAction(st, 'p0').kind).toBe('place');
    const r = run({ ...st, kongi: { ...st.kongi, x: W(34, 3).x, z: W(34, 3).z, mode: 'chase' } }, { p0: press }, 3);
    expect(r.events.filter((e) => e.type === 'complete').length).toBe(1);
    expect(r.state.complete).toBe(true);
    expect(r.state.kongi.mode).toBe('circle');
    expect(planAction(r.state, 'p1').kind).toBe('none');
  });
});

describe('3장 길', () => {
  it('빈손 요정은 쪽문 셋을 지나 오른쪽 줄까지 가고, 공을 든 요정은 오른쪽 줄에서 열린 대문으로 마당 자리까지 간다', () => {
    let st = noDog(createChapter3(['p0', 'p1']));
    const g1 = (FENCES.first.gate[0] + FENCES.first.gate[1]) / 2;
    const g2 = (FENCES.second.gate[0] + FENCES.second.gate[1]) / 2;
    const gm = (FENCES.middle.gate[0] + FENCES.middle.gate[1]) / 2;
    const route: [number, number][] = [[7.5, g1], [10.5, g1], [19.5, g2], [22.5, g2], [gm, -1.5], [gm, 1.5], [24, 2]];
    for (const [s, t] of route) st = walk(st, 'p1', s, t, 8);
    const at = lane(st.players[1]!);
    expect(regionOf(st.players[1]!)).toBe('right');
    expect(Math.hypot(at.s - 24, at.t - 2)).toBeLessThan(0.5);
    // 공을 든 채로 오른쪽 줄 → 대문 → 마당
    st = { ...st, ball: { ...st.ball, carriedBy: 'p1' } };
    const gy = (FENCES.yard.gate[0] + FENCES.yard.gate[1]) / 2;
    for (const [s, t] of [[31.5, gy], [34.5, gy], [BALL_SPOT.s - 0.75, BALL_SPOT.t]] as [number, number][]) st = walk(st, 'p1', s, t, 8);
    expect(regionOf(st.players[1]!)).toBe('yard');
  });
});

describe('3장 입양 장면 시간표', () => {
  it('정해진 순서(민재 → 인사 → 공 주고받기 → 식구 → 담요·물그릇 → 공을 문 안으로 → 장갑 → 안고 손 흔들기)로 이어지고 겹치지 않는다', async () => {
    const { ADOPTION, adoptionBeat } = await import('../../src/core/adoption');
    const order = [ADOPTION.door, ADOPTION.minjaeOut, ADOPTION.bow, ADOPTION.roll, ADOPTION.nudge, ADOPTION.beckon, ADOPTION.familyOut, ADOPTION.momIn, ADOPTION.momBack, ADOPTION.blanket, ADOPTION.bowlGive, ADOPTION.bowlPlace, ADOPTION.ballIn, ADOPTION.turnBack, ADOPTION.toElf, ADOPTION.rub, ADOPTION.scratch, ADOPTION.toMinjae, ADOPTION.wave];
    for (let i = 1; i < order.length; i++) expect(order[i]![0]).toBeGreaterThanOrEqual(order[i - 1]![0]);
    for (const s of order) expect(s[1]).toBeGreaterThan(s[0]);
    // 장갑에 볼 비비기는 공을 문 안에 넣은 뒤, 요정이 긁어 준 뒤에야 민재에게 달려간다
    expect(ADOPTION.rub[0]).toBeGreaterThanOrEqual(ADOPTION.ballIn[1]);
    expect(ADOPTION.toMinjae[0]).toBeGreaterThanOrEqual(ADOPTION.scratch[1]);
    const beats = [1, 4, 7, 10, 14, 20, 24, 28, 33].map(adoptionBeat);
    expect(beats).toEqual(['settle', 'minjae', 'greet', 'ball', 'family', 'blanket', 'ballIn', 'glove', 'hug']);
    expect(ADOPTION.end).toBeGreaterThan(ADOPTION.wave[0]);
  });
});
