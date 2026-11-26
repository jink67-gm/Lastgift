import { describe, expect, it } from 'vitest';
import { createChapter4, createPractice, CRANK, planAction, progressOf, step, timerLeft, type Ch4Event, type Ch4State } from '../../src/core/chapter4';
import { ELF_SPEED } from '../../src/core/player';
import { PADS, SOLO_ROUND_TRIP_SEC, SWITCHES, SWITCH_WINDOW, TERMINALS, TREE, W, toLane } from '../../src/data/chapter4';

const DT = 1 / 60;
const idle = { move: { x: 0, y: 0 }, actionDown: false, actionHeld: false };
const press = { ...idle, actionDown: true, actionHeld: true };
const holdBtn = { ...idle, actionHeld: true };
const toScreen = (gx: number, gz: number) => {
  const l = Math.hypot(gx, gz) || 1;
  return { x: (gx - gz) / Math.SQRT2 / l, y: -(gx + gz) / Math.SQRT2 / l };
};
function put(st: Ch4State, id: string, s: number, t: number): Ch4State {
  const p = W(s, t);
  return {
    ...st,
    players: st.players.map((q) => (q.id === id ? { ...q, x: p.x, z: p.z } : q)),
    items: st.items.map((i) => (i.carriedBy === id ? { ...i, x: p.x, z: p.z } : i)),
  };
}
function run(st0: Ch4State, inputs: Record<string, typeof idle>, sec: number): { state: Ch4State; events: Ch4Event[] } {
  let st = st0;
  const ev: Ch4Event[] = [];
  for (let i = 0; i < Math.round(sec * 60); i++) {
    const inp = i === 0 ? inputs : Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, { ...v, actionDown: false }]));
    const r = step(st, inp, DT);
    st = r.state;
    ev.push(...r.events);
  }
  return { state: st, events: ev };
}
function walk(st0: Ch4State, id: string, s: number, t: number, sec: number): Ch4State {
  let st = st0;
  const goal = W(s, t);
  for (let i = 0; i < sec * 60; i++) {
    const p = st.players.find((q) => q.id === id)!;
    const dx = goal.x - p.x, dz = goal.z - p.z;
    if (Math.hypot(dx, dz) < 0.15) break;
    st = step(st, { [id]: { ...idle, move: toScreen(dx, dz) } }, DT).state;
  }
  return st;
}
/** 전선 셋을 끼운 상태 */
function wired(mode: 'coop' | 'solo' = 'coop'): Ch4State {
  let st = mode === 'solo' ? createPractice('p0') : createChapter4(['p0', 'p1']);
  if (mode === 'coop') {
    st = { ...st, items: [], placed: { generator: true, board: true } };
  }
  return { ...st, items: st.items.filter((i) => !i.id.startsWith('plug-')), plugged: { red: true, blue: true, yellow: true } };
}

describe('4장 발전기·연결판·전선', () => {
  it('발전기·연결판을 들고 트리 앞 자리에 내려놓으면 붙고, 연결판이 붙으면 전선 끝 셋이 놓인다', () => {
    let st = createChapter4(['p0', 'p1']);
    st = run(st, { p0: press, p1: press }, 0.05).state;
    expect(st.items.find((i) => i.id === 'generator')!.carriedBy).toBe('p0');
    expect(st.items.find((i) => i.id === 'board')!.carriedBy).toBe('p1');
    st = put(st, 'p0', PADS.generator.s - 0.6, PADS.generator.t);
    st = put(st, 'p1', PADS.board.s - 0.6, PADS.board.t);
    expect(planAction(st, 'p0')).toEqual({ kind: 'place', itemId: 'generator' });
    const r = run(st, { p0: press, p1: press }, 0.05);
    expect(r.state.placed).toEqual({ generator: true, board: true });
    expect(r.state.items.map((i) => i.id).sort()).toEqual(['plug-blue', 'plug-red', 'plug-yellow']);
    expect(r.events.filter((e) => e.type === 'placed').length).toBe(2);
  });
  it('전선 끝은 같은 표시 단자에만 끼워지고(다르면 안 맞음), 끼운 전선은 남는다', () => {
    let st = createPractice('p0');
    st = put(st, 'p0', toLane(st.items.find((i) => i.id === 'plug-red')!).s - 0.6, toLane(st.items.find((i) => i.id === 'plug-red')!).t);
    st = { ...st, players: st.players.map((q) => ({ ...q, facing: Math.atan2(W(1, 0).x, W(1, 0).z) })) };
    st = run(st, { p0: press }, 0.05).state;
    expect(st.items.find((i) => i.carriedBy === 'p0')!.id).toBe('plug-red');
    // 파랑·세모 단자 앞: 안 맞는다
    st = put(st, 'p0', TERMINALS.blue.s - 0.9, TERMINALS.blue.t);
    expect(planAction(st, 'p0')).toEqual({ kind: 'wrong', color: 'red' });
    let r = run(st, { p0: press }, 0.05);
    expect(r.events.some((e) => e.type === 'wrong')).toBe(true);
    expect(r.state.plugged.red).toBe(false);
    // 빨강·동그라미 단자 앞: 끼워진다
    st = put(r.state, 'p0', TERMINALS.red.s, TERMINALS.red.t - 0.9);
    r = run(st, { p0: press }, 0.05);
    expect(r.state.plugged.red).toBe(true);
    expect(r.state.items.some((i) => i.id === 'plug-red')).toBe(false);
    expect(progressOf(r.state)).toMatchObject({ wires: 1, charged: false });
  });
});

describe('4장 발전기 돌리기', () => {
  it('세 줄이 맞기 전에는 손잡이를 못 돌린다', () => {
    let st = { ...wired(), plugged: { red: true, blue: false, yellow: true } };
    st = put(st, 'p0', PADS.generator.s - 0.8, PADS.generator.t);
    expect(planAction(st, 'p0').kind).not.toBe('crank');
  });
  it('길게 누르는 동안 바늘이 오르고, 손을 떼면 천천히 내려가며, 별에 닿으면 고정된다(그 뒤엔 움직여도 된다)', () => {
    let st = put(wired(), 'p0', PADS.generator.s - 0.8, PADS.generator.t);
    expect(planAction(st, 'p0').kind).toBe('crank');
    st = run(st, { p0: holdBtn }, CRANK.sec * 0.5).state;
    expect(st.charge).toBeGreaterThan(0.45);
    expect(st.cranking).toBe('p0');
    const mid = st.charge;
    st = run(st, {}, 1).state;
    expect(st.charge).toBeLessThan(mid);
    expect(st.charged).toBe(false);
    const r = run(st, { p0: holdBtn }, CRANK.sec);
    expect(r.state.charged).toBe(true);
    expect(r.events.filter((e) => e.type === 'charged').length).toBe(1);
    const after = run(r.state, {}, 3).state;
    expect(after.charge).toBe(1);
  });
});

describe('4장 스위치', () => {
  const charged = (mode: 'coop' | 'solo' = 'coop') => ({ ...wired(mode), charge: 1, charged: true });
  it('충전 전에는 스위치가 듣지 않는다', () => {
    let st = put(wired(), 'p0', SWITCHES.A.s - 0.9, SWITCHES.A.t);
    expect(planAction(st, 'p0').kind).toBe('needPower');
    st = run(st, { p0: press }, 0.05).state;
    expect(st.switches.A).toBe(false);
  });
  it('협동: 첫 스위치에 시간 막대(4초)가 시작되고, 그 안에 다른 스위치를 누르면 불이 켜진다(순서 자유)', () => {
    let st = charged();
    st = put(st, 'p0', SWITCHES.B.s - 0.9, SWITCHES.B.t);
    st = put(st, 'p1', SWITCHES.A.s - 0.9, SWITCHES.A.t);
    let r = run(st, { p0: press }, 0.05);
    expect(r.events.find((e) => e.type === 'switch')).toMatchObject({ id: 'B', first: true });
    expect(timerLeft(r.state)).toBeGreaterThan(0.9);
    expect(r.state.window).toBe(4);
    // 같은 스위치 연타는 무효
    expect(planAction(r.state, 'p0').kind).toBe('none');
    r = run(r.state, {}, 3);
    r = run(r.state, { p1: press }, 0.05);
    expect(r.state.complete).toBe(true);
    expect(r.events.filter((e) => e.type === 'complete').length).toBe(1);
  });
  it('시간이 지나면 스위치 쌍만 풀리고 전선·충전은 그대로', () => {
    let st = put(charged(), 'p0', SWITCHES.A.s - 0.9, SWITCHES.A.t);
    let r = run(st, { p0: press }, 0.05);
    r = run(r.state, {}, SWITCH_WINDOW.coop + 0.2);
    expect(r.events.some((e) => e.type === 'timeout')).toBe(true);
    expect(r.state.switches).toEqual({ A: false, B: false });
    expect(r.state.timerAt).toBeNull();
    expect(r.state.charged).toBe(true);
    expect(r.state.plugged).toEqual({ red: true, blue: true, yellow: true });
    expect(progressOf(r.state)).toEqual({ wires: 3, charged: true });
    // 다시 하면 된다
    st = put(r.state, 'p1', SWITCHES.B.s - 0.9, SWITCHES.B.t);
    r = run(st, { p0: press }, 0.05);
    r = run(r.state, { p1: press }, 0.05);
    expect(r.state.complete).toBe(true);
  });
  it('1인 연습: 제한 시간은 max(12초, 왕복 + 3초)이고, 혼자 A를 누르고 트리를 돌아 B까지 걸어가 누를 수 있다', () => {
    expect(SWITCH_WINDOW.solo).toBe(Math.max(12, SOLO_ROUND_TRIP_SEC + 3));
    expect(SWITCH_WINDOW.solo).toBeGreaterThanOrEqual(12);
    // 왕복은 직선 거리 이상
    expect(SOLO_ROUND_TRIP_SEC).toBeGreaterThan((2 * Math.abs(SWITCHES.B.t - SWITCHES.A.t)) / ELF_SPEED);
    let st = put(charged('solo'), 'p0', SWITCHES.A.s - 0.9, SWITCHES.A.t);
    expect(st.mode).toBe('solo');
    st = run(st, { p0: press }, 0.05).state;
    expect(st.switches.A).toBe(true);
    // 트리 앞을 돌아 B로
    st = walk(st, 'p0', TREE.s - TREE.r - 1.4, TREE.t - 1, 8);
    st = walk(st, 'p0', TREE.s - TREE.r - 1.4, TREE.t + 1, 3);
    st = walk(st, 'p0', SWITCHES.B.s - 0.9, SWITCHES.B.t, 8);
    expect(timerLeft(st)).not.toBeNull();
    const r = run(st, { p0: press }, 0.05);
    expect(r.state.complete).toBe(true);
  });
});

describe('4장 길', () => {
  it('발전기를 든 채 담장길 → 정원문 → 장식을 피해 트리 앞 자리까지 걸어가 놓을 수 있다(정원에 들어서면 한 번 알림)', async () => {
    const { GARDEN_WALL } = await import('../../src/data/chapter4');
    let st = createChapter4(['p0', 'p1']);
    st = run(st, { p0: press }, 0.05).state;
    expect(st.items.find((i) => i.id === 'generator')!.carriedBy).toBe('p0');
    const ev: string[] = [];
    for (const [s, t] of [[GARDEN_WALL.s - 1.5, 0], [GARDEN_WALL.s + 1.5, 0], [17.5, -1.8], [PADS.generator.s - 0.6, PADS.generator.t]] as [number, number][]) {
      const goal = W(s, t);
      for (let i = 0; i < 8 * 60; i++) {
        const p = st.players[0]!;
        const dx = goal.x - p.x, dz = goal.z - p.z;
        if (Math.hypot(dx, dz) < 0.15) break;
        const r = step(st, { p0: { ...idle, move: toScreen(dx, dz) } }, DT);
        st = r.state;
        ev.push(...r.events.map((e) => e.type));
      }
    }
    expect(ev.filter((e) => e === 'entered').length).toBe(1);
    expect(planAction(st, 'p0')).toEqual({ kind: 'place', itemId: 'generator' });
  });
});

describe('4장 앞뒤 장면 시간표', () => {
  it('시작: 사진기 놓기 → 스위치까지 → 누름 → 깜박이다 만다 → 고개 젓기 → 대문 밖으로, 겹치지 않는다', async () => {
    const { TREE_INTRO: I } = await import('../../src/core/treePhoto');
    const order = [I.setCamera, I.toSwitch, I.press, I.flicker, I.shake, I.leave];
    for (let i = 1; i < order.length; i++) expect(order[i]![0]).toBeGreaterThanOrEqual(order[i - 1]![1] - 1e-9);
    expect(I.end).toBeGreaterThanOrEqual(I.leave[1]);
  });
  it('끝: 불 → 아이들 → 할머니 → 타이머 → 자리 비워 주기 → 브이 → 찰칵 → 올해 사진 → 작년 사진 포개짐', async () => {
    const { TREE_END: E, treeEndBeat, PHOTO_LINE } = await import('../../src/core/treePhoto');
    expect(E.kidsIn[0]).toBeGreaterThanOrEqual(E.lights[1] - 0.5);
    expect(E.timer[0]).toBeGreaterThanOrEqual(E.grandmaIn[1]);
    expect(E.makeRoom[0]).toBeGreaterThanOrEqual(E.timer[1]); // 할머니가 돌아서는 순간 비워 준다
    expect(E.shutter).toBeGreaterThan(E.vsign[0]);
    expect(E.overlay[0]).toBeGreaterThan(E.shutter);
    expect([2, 4.6, 7, 8.8, 11, 13.5, 16].map(treeEndBeat)).toEqual(['lights', 'kids', 'grandma', 'timer', 'pose', 'photo', 'overlay']);
    // 비워 준 뒤 가운데(할머니 자리)는 양옆 아이와 1 m 넘게 떨어진다
    const left = Math.max(...PHOTO_LINE.after.filter((t) => t < PHOTO_LINE.grandma));
    const right = Math.min(...PHOTO_LINE.after.filter((t) => t > PHOTO_LINE.grandma));
    expect(PHOTO_LINE.grandma - left).toBeGreaterThan(1);
    expect(right - PHOTO_LINE.grandma).toBeGreaterThan(1);
  });
});
