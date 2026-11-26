// 4장 규칙(명세서 §4 4장 ①②③, §5 4장, §7). 방장만 계산한다. three.js·DOM 없음.
//
// - 발전기·연결판(가벼운 짐, 혼자 든다)을 트리 앞 자기 자리(PADS)에 내려놓으면 제자리에 붙는다.
//   연결판이 붙으면 그 위에 전선 끝 셋(빨강·동그라미, 파랑·세모, 노랑·네모)이 놓인다.
// - ① 전선 끝을 들고 트리 밑동 단자 앞에서 행동 → 같은 표시면 끼워진다(그 전구 줄이 잠깐 빛난다). 다른 표시면 안 맞는다.
// - ② 세 줄이 다 맞고 발전기가 제자리에 있으면, 손잡이 앞에서 행동 버튼을 **길게 눌러** 돌린다. 손을 떼면 바늘이 천천히
//   내려간다. 별 표시(1)에 닿으면 충전이 고정돼 손을 놓고 움직여도 된다.
// - ③ 충전 뒤 트리 양쪽 스위치를 하나씩 누른다. 첫 스위치를 누르는 순간 시간 막대가 줄기 시작하고, 제한 시간 안에
//   **서로 다른** 두 스위치가 켜지면 아래 가지부터 꼭대기 별까지 불이 켜진다(완료). 순서는 자유, 같은 스위치 연타는 무효.
//   누가 눌렀는지는 따지지 않는다(한 사람이 둘 다 눌러도 된다). 시간이 지나면 스위치 쌍만 풀리고 전선·충전은 그대로.
// - 제한 시간: 협동 4초, 1인 연습 max(12초, 왕복 + 3초).
import { applyAction, chooseTarget, planAction as planCarry, PICK_RANGE, type Item } from './carry';
import { stepPlayer, type PlayerState, type World } from './player';
import type { SewingInput } from './sewing';
import {
  CH4_BOUNDS,
  CH4_COLLIDERS,
  CH4_START,
  PADS,
  PLUG_R,
  PLUG_START,
  REACH,
  SOLO_SPAWN,
  SWITCHES,
  SWITCH_WINDOW,
  TERMINALS,
  W,
  WIRES,
  inGarden,
  near,
  type SwitchId,
  type WireColor,
} from '../data/chapter4';

export const CAMERA_YAW = Math.PI / 4;
/** 손잡이를 쉬지 않고 돌려 별까지 걸리는 시간(초), 손을 떼면 내려가는 빠르기(1/초) */
export const CRANK = { sec: 5.0, decay: 0.12 };

export type Mode = 'coop' | 'solo';

export interface Ch4Player extends PlayerState {
  id: string;
  connected: boolean;
}

export interface Ch4State {
  mode: Mode;
  players: Ch4Player[];
  /** 들 수 있는 것: generator, board, plug-red/blue/yellow */
  items: Item[];
  /** 제자리에 붙었다 */
  placed: { generator: boolean; board: boolean };
  plugged: Record<WireColor, boolean>;
  /** 발전기 바늘(0~1), 별에 닿아 고정됐는가, 지금 돌리는 요정 */
  charge: number;
  charged: boolean;
  cranking: string | null;
  switches: Record<SwitchId, boolean>;
  /** 첫 스위치를 누른 시각(null = 시간 막대 없음) */
  timerAt: number | null;
  window: number;
  /** 정원문을 처음 지났다 */
  entered: boolean;
  time: number;
  complete: boolean;
}

export type Ch4Event =
  | { type: 'pick'; playerId: string; itemId: string }
  | { type: 'drop'; playerId: string; itemId: string }
  | { type: 'blocked'; playerId: string }
  | { type: 'placed'; itemId: 'generator' | 'board' }
  | { type: 'plugged'; color: WireColor; playerId: string }
  | { type: 'wrong'; playerId: string; color: WireColor }
  | { type: 'charged'; playerId: string }
  | { type: 'switch'; id: SwitchId; playerId: string; first: boolean }
  | { type: 'needPower'; playerId: string }
  | { type: 'timeout' }
  | { type: 'entered'; playerId: string }
  | { type: 'complete' };

export type Ch4Action =
  | { kind: 'pick'; itemId: string }
  | { kind: 'drop'; itemId: string }
  | { kind: 'place'; itemId: 'generator' | 'board' }
  | { kind: 'plug'; color: WireColor }
  | { kind: 'wrong'; color: WireColor }
  | { kind: 'crank' }
  | { kind: 'switch'; id: SwitchId }
  | { kind: 'needPower'; id: SwitchId }
  | { kind: 'blocked' }
  | { kind: 'none' };

const WORLD: World = { colliders: CH4_COLLIDERS, bounds: CH4_BOUNDS, cameraYaw: CAMERA_YAW };
const plugId = (c: WireColor) => `plug-${c}`;
const plugColor = (id: string): WireColor | null => (id.startsWith('plug-') ? (id.slice(5) as WireColor) : null);

export function createChapter4(playerIds: readonly string[], mode: Mode = playerIds.length > 1 ? 'coop' : 'solo'): Ch4State {
  const solo = mode === 'solo';
  return {
    mode,
    players: playerIds.map((id, i) => {
      const sp = solo ? SOLO_SPAWN : CH4_START.spawns[i % CH4_START.spawns.length]!;
      return { id, x: sp.x, z: sp.z, facing: Math.PI + Math.PI / 4, moving: false, connected: true };
    }),
    items: solo
      ? []
      : [
          { id: 'generator', ...CH4_START.generator, light: true, carriedBy: null },
          { id: 'board', ...CH4_START.board, light: true, carriedBy: null },
        ],
    // 1인 연습은 정원에서 바로: 발전기·연결판은 이미 제자리, 전선 끝은 연결판 위
    placed: { generator: solo, board: solo },
    plugged: { red: false, blue: false, yellow: false },
    charge: 0,
    charged: false,
    cranking: null,
    switches: { A: false, B: false },
    timerAt: null,
    window: SWITCH_WINDOW[mode],
    entered: solo,
    time: 0,
    complete: false,
  };
}

/** 1인 연습 시작 상태(전선 끝이 연결판 위에 놓여 있다) */
export function createPractice(playerId = 'p0'): Ch4State {
  return withPlugs(createChapter4([playerId], 'solo'));
}

function withPlugs(s: Ch4State): Ch4State {
  const plugs = WIRES.map((w) => ({ id: plugId(w.color), ...W(PLUG_START[w.color].s, PLUG_START[w.color].t), light: true, carriedBy: null }));
  return { ...s, items: [...s.items.filter((i) => !plugColor(i.id)), ...plugs] };
}

const allPlugged = (s: Ch4State) => WIRES.every((w) => s.plugged[w.color]);

/** 지금 행동하면 무엇을 하는지(미리보기와 실제 판정이 같이 쓴다) */
export function planAction(s: Ch4State, playerId: string): Ch4Action {
  const p = s.players.find((q) => q.id === playerId);
  if (!p || !p.connected || s.complete) return { kind: 'none' };
  const held = s.items.find((i) => i.carriedBy === playerId);
  if (held) {
    const c = plugColor(held.id);
    if (c) {
      // 가장 가까운 단자
      const term = WIRES.map((w) => w.color).find((k) => near(p, TERMINALS[k], PLUG_R) && !s.plugged[k]);
      if (term) return term === c ? { kind: 'plug', color: c } : { kind: 'wrong', color: c };
    } else if ((held.id === 'generator' || held.id === 'board') && near(p, PADS[held.id], PADS[held.id].r + 0.6)) {
      return { kind: 'place', itemId: held.id };
    }
    const a = planCarry(playerId, p, s.items, CH4_COLLIDERS, CH4_BOUNDS);
    return a.kind === 'drop' ? { kind: 'drop', itemId: held.id } : { kind: 'blocked' };
  }
  const t = chooseTarget(p, s.items);
  if (t && Math.hypot(t.x - p.x, t.z - p.z) <= PICK_RANGE) return { kind: 'pick', itemId: t.id };
  // 발전기 손잡이
  if (s.placed.generator && !s.charged && allPlugged(s) && near(p, PADS.generator, REACH)) return { kind: 'crank' };
  // 스위치
  for (const id of ['A', 'B'] as SwitchId[]) {
    if (!near(p, SWITCHES[id], REACH)) continue;
    if (!s.charged) return { kind: 'needPower', id };
    if (s.switches[id]) return { kind: 'none' }; // 같은 스위치 연타는 무효
    return { kind: 'switch', id };
  }
  return { kind: 'none' };
}

export function step(state: Ch4State, inputs: Record<string, SewingInput>, dt: number): { state: Ch4State; events: Ch4Event[] } {
  const fx: Ch4Event[] = [];
  let s: Ch4State = { ...state, time: state.time + dt };

  // 1) 누르는 행동
  for (const p of s.players) {
    if (!inputs[p.id]?.actionDown) continue;
    const a = planAction(s, p.id);
    const me = s.players.find((q) => q.id === p.id)!;
    if (a.kind === 'pick') {
      s = { ...s, items: applyAction(p.id, s.items, { kind: 'pick', itemId: a.itemId }) as Item[] };
      fx.push({ type: 'pick', playerId: p.id, itemId: a.itemId });
    } else if (a.kind === 'drop') {
      const plan = planCarry(p.id, me, s.items, CH4_COLLIDERS, CH4_BOUNDS);
      if (plan.kind === 'drop') {
        s = { ...s, items: applyAction(p.id, s.items, plan) as Item[] };
        fx.push({ type: 'drop', playerId: p.id, itemId: a.itemId });
      }
    } else if (a.kind === 'place') {
      s = {
        ...s,
        items: s.items.filter((i) => i.id !== a.itemId),
        placed: { ...s.placed, [a.itemId]: true },
      };
      if (a.itemId === 'board') s = withPlugs(s);
      fx.push({ type: 'drop', playerId: p.id, itemId: a.itemId }, { type: 'placed', itemId: a.itemId });
    } else if (a.kind === 'plug') {
      s = { ...s, items: s.items.filter((i) => i.id !== plugId(a.color)), plugged: { ...s.plugged, [a.color]: true } };
      fx.push({ type: 'plugged', color: a.color, playerId: p.id });
    } else if (a.kind === 'wrong') {
      fx.push({ type: 'wrong', playerId: p.id, color: a.color });
    } else if (a.kind === 'switch') {
      const first = s.timerAt === null;
      s = { ...s, switches: { ...s.switches, [a.id]: true }, timerAt: first ? s.time : s.timerAt };
      fx.push({ type: 'switch', id: a.id, playerId: p.id, first });
      if (s.switches.A && s.switches.B && !s.complete) {
        s = { ...s, complete: true };
        fx.push({ type: 'complete' });
      }
    } else if (a.kind === 'needPower') {
      fx.push({ type: 'needPower', playerId: p.id });
    } else if (a.kind === 'blocked') {
      fx.push({ type: 'blocked', playerId: p.id });
    }
  }

  // 2) 발전기: 손잡이 앞에서 길게 누르는 동안 바늘이 오른다(돌리는 동안은 서 있다)
  let cranker: string | null = null;
  if (!s.charged && !s.complete) {
    for (const p of s.players) {
      if (inputs[p.id]?.actionHeld && planAction(s, p.id).kind === 'crank') {
        cranker = p.id;
        break;
      }
    }
    let charge = s.charge + (cranker ? dt / CRANK.sec : -CRANK.decay * dt);
    charge = Math.max(0, Math.min(1, charge));
    s = { ...s, charge, cranking: cranker };
    if (charge >= 1) {
      s = { ...s, charged: true, cranking: null };
      fx.push({ type: 'charged', playerId: cranker! });
    }
  } else if (s.cranking) s = { ...s, cranking: null };

  // 3) 이동(돌리는 요정은 서 있다)
  s = {
    ...s,
    players: s.players.map((p) => {
      const inp = inputs[p.id];
      if (!p.connected || !inp || p.id === s.cranking) return p.moving ? { ...p, moving: false } : p;
      return { ...p, ...stepPlayer(p, inp.move, dt, WORLD) };
    }),
  };
  s = {
    ...s,
    items: s.items.map((i) => {
      if (!i.carriedBy) return i;
      const p = s.players.find((q) => q.id === i.carriedBy);
      return p ? { ...i, x: p.x, z: p.z } : i;
    }),
  };

  // 4) 정원문을 처음 지났다
  if (!s.entered) {
    const who = s.players.find((p) => p.connected && inGarden(p));
    if (who) {
      s = { ...s, entered: true };
      fx.push({ type: 'entered', playerId: who.id });
    }
  }

  // 5) 스위치 시간 막대: 지나면 스위치 쌍만 풀린다
  if (!s.complete && s.timerAt !== null && s.time - s.timerAt > s.window) {
    s = { ...s, switches: { A: false, B: false }, timerAt: null };
    fx.push({ type: 'timeout' });
  }
  return { state: s, events: fx };
}

/** 시간 막대: 남은 비율(1 → 0). 없으면 null */
export function timerLeft(s: Ch4State): number | null {
  if (s.timerAt === null || s.complete) return null;
  return Math.max(0, 1 - (s.time - s.timerAt) / s.window);
}

/** 팀 시계 저장용 진행(명세서 §7: wires·charged·switchA·switchB·switchTimerAt) */
export function progressOf(s: Ch4State): Record<string, unknown> {
  const p: Record<string, unknown> = { wires: WIRES.filter((w) => s.plugged[w.color]).length, charged: s.charged };
  if (s.switches.A) p.switchA = true;
  if (s.switches.B) p.switchB = true;
  if (s.timerAt !== null) p.switchTimerAt = s.timerAt;
  return p;
}
