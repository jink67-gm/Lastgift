// 2장 재봉틀 운반 규칙(명세서 §5, §3.2). 방장만 계산한다. three.js·DOM에 의존하지 않는다.
//
// - 상자 손잡이 2개. 두 손잡이가 모두 잡히면 상자가 들린다.
// - 두 운반자가 같은 방향으로 밀면 이동, 한쪽이 멈추고 다른 쪽이 움직이면 멈춘 손잡이를 축으로 회전.
// - 무게를 든 사람만 체력이 준다. 25% 이하면 교대 표시. 0이면 그 자리에 조심히 내려놓는다.
// - 쉬던 요정이 잡힌 손잡이에서 행동하면 한 틱 안에 소유권을 넘긴다(상자는 들린 채).
// - 덧문은 저절로 닫힌다. 걸쇠를 걸거나, 누가 잡고 있거나, 문틀에 사람·상자가 있으면 열려 있다.
// - 팀원(연결 중)과 재봉틀이 모두 통로 끝을 넘으면 작업실을 한 번만 확정한다(체크포인트는 그대로).
import { moveCircle, obbCorners, obbOverlaps, overlaps, type Collider, type ObbCollider } from './collision';
import { screenToGround } from './screenSpace';
import type { SpaceId } from '../data/chapter2';
import { SEWING_LAYOUTS, type SewingLayout, type SewingLayoutId } from '../data/sewingLayouts';

export const ELF_R = 0.35;
export const FREE_SPEED = 3.6; // m/s
// 무거운 짐을 함께 들면 맨몸(3.6)의 절반 아래로 천천히 걷는다(화면에서도 느린 걸음 동작)
export const CARRY_SPEED = 1.6; // m/s, 손잡이 하나가 움직이는 속도
export const CRATE_HALF_LEN = 0.8;
export const CRATE_HALF_WID = 0.4;
/** 상자 중심에서 운반자 위치까지 */
export const GRIP = CRATE_HALF_LEN + 0.35;
export const GRAB_RANGE = 0.85;
export const DOOR_RANGE = 1.2;
export const STAMINA_MAX = 100;
// 들고 있을 때 초당 감소. 가득 찬 상태로 약 39초 버틴다(걸음이 느려진 만큼 늘려 들고 갈 수 있는 거리는 그대로 약 63 m).
// 받침대(쉼터)→덧문→통로→작업대 구간을 2인 팀이 문턱에서 잠깐 기다려도 한 번에 닿도록 잡은 값(명세서 §2장 쉼터 간격).
export const STAMINA_DRAIN = 3.5 * (CARRY_SPEED / 2.2);
export const STAMINA_REGEN = 20; // 초당(들고 있지 않을 때)
export const STAMINA_WARN = 25;
export const DOOR_OPEN_SEC = 4;

export type HandleIndex = 0 | 1;
export type CratePlace = 'ground' | 'stand' | 'bench';

export interface CarryPlayer {
  id: string;
  x: number;
  z: number;
  facing: number;
  moving: boolean;
  stamina: number;
  holding: HandleIndex | null;
  connected: boolean;
}

export interface Crate {
  x: number;
  z: number;
  /** 긴 축 방향(손잡이 0 → 1) = (sin yaw, cos yaw) */
  yaw: number;
  lifted: boolean;
  place: CratePlace;
}

export interface SewingState {
  /** 어느 장의 배치인지(벽·문·목적지) */
  layout: SewingLayoutId;
  players: CarryPlayer[];
  crate: Crate;
  handles: [string | null, string | null];
  door: { latched: boolean; openTimer: number; held: boolean; open: boolean };
  space: SpaceId;
  /** 공간 전환 번호(포털 이벤트 중복 제거용) */
  transition: number;
  delivered: boolean;
}

export interface SewingInput {
  move: { x: number; y: number };
  actionDown: boolean;
  actionHeld: boolean;
}

export type SewingEvent =
  | { type: 'grab'; playerId: string; handle: HandleIndex }
  | { type: 'lift' }
  | { type: 'release'; playerId: string; place: CratePlace }
  | { type: 'handover'; from: string; to: string; handle: HandleIndex }
  | { type: 'exhausted'; playerId: string }
  | { type: 'latched'; playerId: string }
  | { type: 'doorOpened' }
  | { type: 'doorClosed' }
  | { type: 'spaceCommitted'; space: SpaceId; transition: number }
  | { type: 'delivered' };

export type SewingAction =
  | { kind: 'grab'; handle: HandleIndex }
  | { kind: 'handover'; handle: HandleIndex }
  | { kind: 'release' }
  | { kind: 'latch' }
  | { kind: 'door' }
  | { kind: 'none' };

// ── 기하 ────────────────────────────────────────────────

export function axisOf(yaw: number) {
  return { x: Math.sin(yaw), z: Math.cos(yaw) };
}

export function gripPos(c: { x: number; z: number; yaw: number }, h: HandleIndex) {
  const a = axisOf(c.yaw);
  const s = h === 0 ? -1 : 1;
  return { x: c.x + a.x * GRIP * s, z: c.z + a.z * GRIP * s };
}

export function crateObb(c: { x: number; z: number; yaw: number }): ObbCollider {
  return { kind: 'obb', x: c.x, z: c.z, yaw: c.yaw, ha: CRATE_HALF_LEN, hb: CRATE_HALF_WID };
}

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

/** 이 상태의 배치 */
export function layoutOf(s: { layout: SewingLayoutId }): SewingLayout {
  return SEWING_LAYOUTS[s.layout];
}

// ── 생성 ────────────────────────────────────────────────

export function createSewing(playerIds: readonly string[], layout: SewingLayoutId = 'ch2'): SewingState {
  const ids = [...playerIds].sort();
  const L = SEWING_LAYOUTS[layout];
  return {
    layout,
    players: ids.map((id, i) => ({
      id,
      ...L.spawns[i % L.spawns.length]!,
      facing: Math.PI,
      moving: false,
      stamina: STAMINA_MAX,
      holding: null,
      connected: true,
    })),
    crate: { ...L.crateStart, lifted: false, place: 'ground' },
    handles: [null, null],
    door: { latched: false, openTimer: 0, held: false, open: false },
    space: 'yard',
    transition: 0,
    delivered: false,
  };
}

// ── 공간별 충돌체 ───────────────────────────────────────

function worldColliders(s: SewingState): Collider[] {
  const L = layoutOf(s);
  const out: Collider[] = [...L.walls];
  if (L.door && !s.door.open) out.push(L.door.closed);
  if (L.spaces && s.space === 'yard') out.push(L.spaces.waitWall);
  return out;
}

// ── 미리보기와 실제 판정이 함께 쓰는 행동 선택 ─────────────

export function planAction(s: SewingState, playerId: string): SewingAction {
  const p = s.players.find((q) => q.id === playerId);
  if (!p || !p.connected || s.delivered) return { kind: 'none' };
  if (p.holding !== null) return { kind: 'release' };
  const options: { d: number; a: SewingAction }[] = [];
  for (const h of [0, 1] as const) {
    const d = dist(p, gripPos(s.crate, h));
    if (d > GRAB_RANGE) continue;
    if (s.handles[h] === null) options.push({ d, a: { kind: 'grab', handle: h } });
    else options.push({ d: d + 0.01, a: { kind: 'handover', handle: h } });
  }
  const L = layoutOf(s);
  if (L.door && L.latch && !s.door.latched) {
    const dl = dist(p, L.latch);
    if (dl <= L.latch.range) options.push({ d: dl, a: { kind: 'latch' } });
    const dd = dist(p, L.door);
    if (dd <= DOOR_RANGE) options.push({ d: dd + 0.05, a: { kind: 'door' } });
  }
  options.sort((a, b) => a.d - b.d);
  return options[0]?.a ?? { kind: 'none' };
}

// ── 상자 내려놓기 ───────────────────────────────────────

function angleDiffMod(a: number, b: number, period: number): number {
  let d = (a - b) % period;
  if (d < 0) d += period;
  return Math.min(d, period - d);
}

function placeFor(s: SewingState): CratePlace {
  const c = s.crate;
  const L = layoutOf(s);
  const b = L.bench;
  if ((!L.spaces || s.space === 'workshop') && dist(c, b) <= b.zone && angleDiffMod(c.yaw, b.yaw, Math.PI) <= b.yawTolerance) return 'bench';
  if (L.stand && dist(c, L.stand) <= L.stand.zone) return 'stand';
  return 'ground';
}

/** 운반자 한 명이 손을 놓는다. 들려 있었다면 그 자리에 내려놓는다 */
function releaseHolder(s: SewingState, p: CarryPlayer, fx: SewingEvent[]): SewingState {
  if (p.holding === null) return s;
  const handles: [string | null, string | null] = [...s.handles];
  handles[p.holding] = null;
  const place = placeFor(s);
  let crate = { ...s.crate, lifted: false, place };
  let players = s.players.map((q) => (q.id === p.id ? { ...q, holding: null } : q));
  fx.push({ type: 'release', playerId: p.id, place });
  let delivered = s.delivered;
  if (place === 'bench') {
    // 작업대에 바르게 올렸다: 다른 운반자도 손을 뗀다
    players = players.map((q) => ({ ...q, holding: null }));
    handles[0] = handles[1] = null;
    const b = layoutOf(s).bench;
    crate = { ...crate, x: b.x, z: b.z, yaw: b.yawTolerance >= Math.PI ? crate.yaw : b.yaw };
    delivered = true;
    fx.push({ type: 'delivered' });
  }
  return { ...s, players, handles, crate, delivered };
}

// ── 운반 이동 ───────────────────────────────────────────

function crateFits(s: SewingState, c: { x: number; z: number; yaw: number }, carriers: readonly string[]): boolean {
  const world = worldColliders(s);
  const obb = crateObb(c);
  if (world.some((w) => obbOverlaps(obb, w))) return false;
  const free = s.players.filter((q) => q.connected && q.holding === null);
  if (free.some((q) => obbOverlaps(obb, { kind: 'circle', x: q.x, z: q.z, r: ELF_R }))) return false;
  const b = layoutOf(s).bounds;
  for (const corner of obbCorners(obb)) if (corner.x < b.minX || corner.x > b.maxX || corner.z < b.minZ || corner.z > b.maxZ) return false;
  for (const h of [0, 1] as const) {
    if (!carriers[h]) continue;
    const g = gripPos(c, h);
    if (g.x - ELF_R < b.minX || g.x + ELF_R > b.maxX || g.z - ELF_R < b.minZ || g.z + ELF_R > b.maxZ) return false;
    if (world.some((w) => overlaps(g, ELF_R, w))) return false;
    if (free.some((q) => Math.hypot(q.x - g.x, q.z - g.z) < ELF_R * 2)) return false;
  }
  return true;
}

function moveCrate(s: SewingState, inputs: Record<string, SewingInput>, dt: number): SewingState {
  const [id0, id1] = s.handles;
  if (!id0 || !id1 || !s.crate.lifted) return s;
  const step = CARRY_SPEED * dt;
  const u = [id0, id1].map((id) => {
    const g = screenToGround(inputs[id]?.move ?? { x: 0, y: 0 }, Math.PI / 4);
    return { x: g.x * step, z: g.z * step, len: Math.hypot(g.x, g.z) };
  });
  const [u0, u1] = u as [typeof u[0], typeof u[0]];
  if (u0.len < 1e-3 && u1.len < 1e-3) return s;
  const h0 = gripPos(s.crate, 0);
  const h1 = gripPos(s.crate, 1);
  const cur = s.crate;
  const carriers = [id0, id1];
  const fits = (t: { x: number; z: number; yaw: number }) =>
    !(t.x === cur.x && t.z === cur.z && t.yaw === cur.yaw) && crateFits(s, t, carriers);
  const done = (t: { x: number; z: number; yaw: number }) => ({ ...s, crate: { ...cur, ...t, place: 'ground' as const } });

  if (u0.len < 1e-3 || u1.len < 1e-3) {
    // 한쪽이 멈춤 → 멈춘 손잡이를 축으로 돈다(혼자서 끌고 갈 수는 없다).
    // 막히면 덜 돌 뿐, 멈춘 손잡이는 어떤 경우에도 움직이지 않는다.
    const pivotIs0 = u0.len < 1e-3;
    const pivot = pivotIs0 ? h0 : h1;
    const mover = pivotIs0 ? { x: h1.x + u1.x, z: h1.z + u1.z } : { x: h0.x + u0.x, z: h0.z + u0.z };
    const tx = pivotIs0 ? mover.x - pivot.x : pivot.x - mover.x;
    const tz = pivotIs0 ? mover.z - pivot.z : pivot.z - mover.z;
    const target = Math.atan2(tx, tz);
    const pose = (yaw: number) => {
      const a = axisOf(yaw);
      const sgn = pivotIs0 ? 1 : -1;
      return { x: pivot.x + a.x * GRIP * sgn, z: pivot.z + a.z * GRIP * sgn, yaw };
    };
    const d = angleDelta(target, cur.yaw);
    for (const k of [1, 0.5, 0.25, 0.125]) {
      const t = pose(cur.yaw + d * k);
      if (fits(t)) return done(t);
    }
    return s;
  }

  // 둘 다 움직임 → 두 손잡이 목표의 가운데·방향으로 맞춘다(같은 방향이면 평행이동)
  const p0 = { x: h0.x + u0.x, z: h0.z + u0.z };
  const p1 = { x: h1.x + u1.x, z: h1.z + u1.z };
  const cx = (p0.x + p1.x) / 2, cz = (p0.z + p1.z) / 2;
  const tx = p1.x - p0.x, tz = p1.z - p0.z;
  const l = Math.hypot(tx, tz);
  const yaw = l > 1e-6 ? Math.atan2(tx, tz) : cur.yaw;
  // 막히면: x만 → z만 → 회전만 → 절반씩 줄여 가며(벽을 따라 미끄러진다)
  const tries = [
    { x: cx, z: cz, yaw },
    { x: cx, z: cur.z, yaw: cur.yaw },
    { x: cur.x, z: cz, yaw: cur.yaw },
    { x: cur.x, z: cur.z, yaw },
  ];
  for (let k = 0.5; k > 0.05; k /= 2) tries.push({ x: cur.x + (cx - cur.x) * k, z: cur.z + (cz - cur.z) * k, yaw: cur.yaw + angleDelta(yaw, cur.yaw) * k });
  for (const t of tries) if (fits(t)) return done(t);
  return s;
}

function angleDelta(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** 운반자를 손잡이 위치에 붙이고 상자 쪽을 보게 한다 */
function snapCarriers(s: SewingState, before: Crate): SewingState {
  const moved = before.x !== s.crate.x || before.z !== s.crate.z || before.yaw !== s.crate.yaw;
  return {
    ...s,
    players: s.players.map((p) => {
      if (p.holding === null) return p;
      const g = gripPos(s.crate, p.holding);
      return { ...p, x: g.x, z: g.z, facing: Math.atan2(s.crate.x - g.x, s.crate.z - g.z), moving: moved };
    }),
  };
}

// ── 한 틱 ───────────────────────────────────────────────

export function step(state: SewingState, inputs: Record<string, SewingInput>, dt: number): { state: SewingState; events: SewingEvent[] } {
  const fx: SewingEvent[] = [];
  let s = state;

  // 1) 행동(E·행동 버튼): 플레이어 ID 순서로 하나씩, 매번 현재 상태로 다시 검사한다(원자적 인계·복제 없음).
  //    한 틱에 손잡이 하나의 주인은 한 번만 바뀐다(같은 순간 두 명이 넘겨받으려 하면 먼저 처리된 한 명만).
  const changed = new Set<HandleIndex>();
  for (const p0 of s.players) {
    const inp = inputs[p0.id];
    if (!inp?.actionDown) continue;
    const p = s.players.find((q) => q.id === p0.id)!;
    const a = planAction(s, p.id);
    if ((a.kind === 'grab' || a.kind === 'handover') && changed.has(a.handle)) continue;
    if (a.kind === 'grab' || a.kind === 'handover') changed.add(a.handle);
    if (a.kind === 'grab') {
      const g = gripPos(s.crate, a.handle);
      const handles: [string | null, string | null] = [...s.handles];
      handles[a.handle] = p.id;
      s = { ...s, handles, players: s.players.map((q) => (q.id === p.id ? { ...q, holding: a.handle, x: g.x, z: g.z } : q)) };
      fx.push({ type: 'grab', playerId: p.id, handle: a.handle });
    } else if (a.kind === 'handover') {
      const fromId = s.handles[a.handle]!;
      const from = s.players.find((q) => q.id === fromId)!;
      const g = gripPos(s.crate, a.handle);
      const handles: [string | null, string | null] = [...s.handles];
      handles[a.handle] = p.id;
      // 넘겨준 요정은 넘겨받은 요정이 서 있던 자리로 비켜난다
      s = {
        ...s,
        handles,
        players: s.players.map((q) =>
          q.id === p.id ? { ...q, holding: a.handle, x: g.x, z: g.z } : q.id === from.id ? { ...q, holding: null, x: p.x, z: p.z } : q,
        ),
      };
      fx.push({ type: 'handover', from: from.id, to: p.id, handle: a.handle });
    } else if (a.kind === 'release') {
      s = releaseHolder(s, p, fx);
    } else if (a.kind === 'latch') {
      s = { ...s, door: { ...s.door, latched: true } };
      fx.push({ type: 'latched', playerId: p.id });
    } else if (a.kind === 'door') {
      s = { ...s, door: { ...s.door, openTimer: DOOR_OPEN_SEC } };
    }
  }

  // 2) 두 손잡이가 다 잡히면 든다(작업대에 놓인 뒤에는 들지 않는다)
  if (s.handles[0] && s.handles[1] && !s.crate.lifted && !s.delivered) {
    const tired = s.players.some((p) => p.holding !== null && p.stamina <= 0);
    if (!tired) {
      s = { ...s, crate: { ...s.crate, lifted: true } };
      fx.push({ type: 'lift' });
    }
  }

  // 3) 운반
  const before = s.crate;
  s = moveCrate(s, inputs, dt);
  s = snapCarriers(s, before);

  // 4) 맨몸 요정 이동(상자·운반자·작업대·닫힌 문에 막힌다)
  const world = worldColliders(s);
  const carriers = s.players.filter((p) => p.holding !== null);
  const L = layoutOf(s);
  const freeBlockers: Collider[] = [...world, ...(L.benchCollider ? [L.benchCollider] : []), crateObb(s.crate), ...carriers.map((c) => ({ kind: 'circle', x: c.x, z: c.z, r: ELF_R }) as Collider)];
  s = {
    ...s,
    players: s.players.map((p) => {
      if (p.holding !== null || !p.connected) return p;
      const g = screenToGround(inputs[p.id]?.move ?? { x: 0, y: 0 }, Math.PI / 4);
      const sp = Math.hypot(g.x, g.z);
      if (sp === 0) return p.moving ? { ...p, moving: false } : p;
      const next = moveCircle(p, { x: g.x * FREE_SPEED * dt, z: g.z * FREE_SPEED * dt }, ELF_R, freeBlockers, L.bounds);
      return { ...p, x: next.x, z: next.z, facing: Math.atan2(g.x, g.z), moving: true };
    }),
  };

  // 5) 체력: 무게를 든 사람만 준다. 0이면 그 자리에 내려놓는다
  s = {
    ...s,
    players: s.players.map((p) => {
      const bearing = p.holding !== null && s.crate.lifted;
      const stamina = bearing ? Math.max(0, p.stamina - STAMINA_DRAIN * dt) : Math.min(STAMINA_MAX, p.stamina + STAMINA_REGEN * dt);
      return stamina === p.stamina ? p : { ...p, stamina };
    }),
  };
  for (const p of s.players) {
    if (p.holding !== null && s.crate.lifted && p.stamina <= 0) {
      fx.push({ type: 'exhausted', playerId: p.id });
      s = releaseHolder(s, p, fx);
    }
  }

  // 6) 덧문
  s = updateDoor(s, inputs, dt, fx);

  // 7) 공간 확정(한 번만)
  s = maybeCommit(s, fx);
  return { state: s, events: fx };
}

function updateDoor(s: SewingState, inputs: Record<string, SewingInput>, dt: number, fx: SewingEvent[]): SewingState {
  const door = layoutOf(s).door;
  if (!door) return s;
  const held = s.players.some((p) => p.connected && p.holding === null && inputs[p.id]?.actionHeld && dist(p, door) <= DOOR_RANGE);
  const openTimer = Math.max(0, s.door.openTimer - dt);
  // 문틀(문이 닫히며 지나갈 자리)에 누가 있거나 상자가 걸쳐 있으면 닫지 않는다
  const frame: Collider = { kind: 'box', x: door.x, z: door.z, hx: door.halfGap + 0.2, hz: 0.7 };
  const occupied =
    s.players.some((p) => p.connected && overlaps(p, ELF_R, frame)) || obbOverlaps(crateObb(s.crate), frame);
  const open = s.door.latched || held || openTimer > 0 || (s.door.open && occupied);
  if (open !== s.door.open) fx.push({ type: open ? 'doorOpened' : 'doorClosed' });
  return { ...s, door: { ...s.door, openTimer, held, open } };
}

/** 연결 중인 팀원 전원과 재봉틀이 통로 끝을 넘었는가 */
export function allPassed(s: SewingState): boolean {
  const spaces = layoutOf(s).spaces;
  if (!spaces) return false;
  const z = spaces.boundaryZ;
  const people = s.players.filter((p) => p.connected);
  if (people.length === 0) return false;
  if (people.some((p) => p.z >= z)) return false;
  return obbCorners(crateObb(s.crate)).every((c) => c.z < z);
}

function maybeCommit(s: SewingState, fx: SewingEvent[]): SewingState {
  if (s.space !== 'yard' || !allPassed(s)) return s;
  const transition = s.transition + 1;
  fx.push({ type: 'spaceCommitted', space: 'workshop', transition });
  return { ...s, space: 'workshop', transition };
}

/** 연결이 끊긴 요정: 손잡이를 놓고(상자는 그 자리에) 공간 판정에서 뺀다 */
export function playerLeft(s: SewingState, playerId: string): { state: SewingState; events: SewingEvent[] } {
  const fx: SewingEvent[] = [];
  const p = s.players.find((q) => q.id === playerId);
  if (!p) return { state: s, events: fx };
  let next = releaseHolder(s, p, fx);
  next = { ...next, players: next.players.map((q) => (q.id === playerId ? { ...q, connected: false, holding: null } : q)) };
  next = maybeCommit(next, fx);
  return { state: next, events: fx };
}

/** 체력 25% 이하로 무게를 든 운반자(교대 표시 대상) */
export function needsSwap(s: SewingState, p: CarryPlayer): boolean {
  return p.holding !== null && s.crate.lifted && p.stamina <= STAMINA_WARN;
}

/** 작업실이 확정된 뒤 다시 들어온 요정이 설 안전 위치(대기 구역 안) */
const WORKSHOP_SAFE = [
  { x: -0.8, z: -3.2 },
  { x: 0.8, z: -3.2 },
  { x: -0.8, z: -4.6 },
  { x: 0.8, z: -4.6 },
];

/**
 * 연결이 끊겼던 요정이 다시 들어왔다. 방장의 현재 공간·소유권을 그대로 두고 그 요정만 되살린다.
 * 팀이 이미 작업실로 넘어갔는데 그 요정이 뒤쪽에 남아 있었다면 작업실 안전 위치로 옮긴다.
 */
export function playerRejoined(s: SewingState, playerId: string): SewingState {
  const i = s.players.findIndex((q) => q.id === playerId);
  if (i < 0) return s;
  const p = s.players[i]!;
  if (p.connected) return s;
  let pos = { x: p.x, z: p.z };
  const spaces = layoutOf(s).spaces;
  if (spaces && s.space === 'workshop' && p.z >= spaces.boundaryZ) pos = WORKSHOP_SAFE[i % WORKSHOP_SAFE.length]!;
  return { ...s, players: s.players.map((q) => (q.id === playerId ? { ...q, ...pos, connected: true, holding: null, moving: false } : q)) };
}
