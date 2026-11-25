// 2장 재봉틀 운반 규칙. 실제 입력과 같은 "화면 기준 이동 + 행동 버튼"을 틱마다 넣어 시뮬레이션한다.
import { describe, expect, it } from 'vitest';
import { groundToScreen } from '../../src/core/screenSpace';
import {
  allPassed,
  CARRY_SPEED,
  createSewing,
  FREE_SPEED,
  gripPos,
  needsSwap,
  planAction,
  playerLeft,
  step,
  STAMINA_DRAIN,
  STAMINA_MAX,
  STAMINA_WARN,
  type HandleIndex,
  type SewingEvent,
  type SewingInput,
  type SewingState,
} from '../../src/core/sewing';
import { CH2 } from '../../src/data/chapter2';

const DT = 1 / 60;
const YAW = Math.PI / 4;
const idle: SewingInput = { move: { x: 0, y: 0 }, actionDown: false, actionHeld: false };

class Sim {
  s: SewingState;
  events: SewingEvent[] = [];
  constructor(ids: string[]) {
    this.s = createSewing(ids);
  }
  p(id: string) {
    return this.s.players.find((q) => q.id === id)!;
  }
  tick(inputs: Record<string, Partial<SewingInput>> = {}) {
    const full: Record<string, SewingInput> = {};
    for (const p of this.s.players) full[p.id] = { ...idle, ...inputs[p.id] };
    const r = step(this.s, full, DT);
    this.s = r.state;
    this.events.push(...r.events);
    return r.events;
  }
  press(id: string) {
    return this.tick({ [id]: { actionDown: true, actionHeld: true } });
  }
  count(type: SewingEvent['type']) {
    return this.events.filter((e) => e.type === type).length;
  }
  /** 맨몸 요정을 목표 지점까지 걷게 한다(화면 기준 입력으로) */
  walk(id: string, to: { x: number; z: number }, maxSec = 10) {
    for (let i = 0; i < maxSec / DT; i++) {
      const p = this.p(id);
      const dx = to.x - p.x, dz = to.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.05) return;
      const k = Math.min(1, d / (FREE_SPEED * DT)) / d;
      this.tick({ [id]: { move: groundToScreen({ x: dx * k, z: dz * k }, YAW) } });
    }
    throw new Error(`${id} could not reach ${JSON.stringify(to)} (at ${this.p(id).x.toFixed(2)}, ${this.p(id).z.toFixed(2)})`);
  }
  /** 두 운반자가 각자 자기 손잡이의 목표 위치로 걸어 상자를 목표 자세로 옮긴다 */
  carry(to: { x: number; z: number; yaw: number }, opts: { maxSec?: number; hold?: Partial<Record<HandleIndex, boolean>>; until?: () => boolean } = {}) {
    const maxSec = opts.maxSec ?? 20;
    for (let i = 0; i < maxSec / DT; i++) {
      if (opts.until?.()) return;
      const inputs: Record<string, Partial<SewingInput>> = {};
      let done = true;
      for (const h of [0, 1] as const) {
        const id = this.s.handles[h];
        if (!id) throw new Error('handle not held');
        const cur = gripPos(this.s.crate, h);
        const tgt = gripPos(to, h);
        const dx = tgt.x - cur.x, dz = tgt.z - cur.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.03 || opts.hold?.[h]) continue;
        done = false;
        const k = Math.min(1, d / (CARRY_SPEED * DT)) / d;
        inputs[id] = { move: groundToScreen({ x: dx * k, z: dz * k }, YAW) };
      }
      if (done) return;
      this.tick(inputs);
    }
    if (opts.until) return;
    throw new Error(`crate could not reach ${JSON.stringify(to)} (at ${JSON.stringify(this.s.crate)})`);
  }
}

describe('재봉틀 들기', () => {
  it('손잡이 하나만 잡으면 들리지 않고, 둘 다 잡으면 들린다', () => {
    const sim = new Sim(['a', 'b']);
    sim.walk('a', gripPos(sim.s.crate, 0));
    sim.press('a');
    expect(sim.s.handles).toEqual(['a', null]);
    expect(sim.s.crate.lifted).toBe(false);
    sim.walk('b', gripPos(sim.s.crate, 1));
    sim.press('b');
    expect(sim.s.crate.lifted).toBe(true);
    expect(sim.count('lift')).toBe(1);
  });

  it('같은 방향으로 밀면 이동, 한쪽이 멈추고 다른 쪽만 밀면 멈춘 손잡이를 축으로 돈다', () => {
    const sim = new Sim(['a', 'b']);
    sim.walk('a', gripPos(sim.s.crate, 0));
    sim.press('a');
    sim.walk('b', gripPos(sim.s.crate, 1));
    sim.press('b');
    const up = groundToScreen({ x: 0, z: -1 }, YAW);
    const z0 = sim.s.crate.z;
    for (let i = 0; i < 30; i++) sim.tick({ a: { move: up }, b: { move: up } });
    expect(sim.s.crate.z).toBeCloseTo(z0 - CARRY_SPEED * 0.5, 1);
    expect(sim.s.crate.yaw).toBeCloseTo(Math.PI / 2, 6);
    // 피벗: a는 멈추고 b만 아래(카메라 쪽)로
    const pivot = gripPos(sim.s.crate, 0);
    const down = groundToScreen({ x: 0, z: 1 }, YAW);
    for (let i = 0; i < 30; i++) sim.tick({ b: { move: down } });
    const after = gripPos(sim.s.crate, 0);
    expect(after.x).toBeCloseTo(pivot.x, 6);
    expect(after.z).toBeCloseTo(pivot.z, 6);
    expect(sim.s.crate.yaw).not.toBeCloseTo(Math.PI / 2, 2);
  });

  it('한 사람이 긴 축 방향으로 혼자 끌어도 상자는 따라오지 않는다', () => {
    const sim = new Sim(['a', 'b']);
    sim.walk('a', gripPos(sim.s.crate, 0));
    sim.press('a');
    sim.walk('b', gripPos(sim.s.crate, 1));
    sim.press('b');
    const before = { ...sim.s.crate };
    const right = groundToScreen({ x: 1, z: 0 }, YAW); // 긴 축(+x) 방향
    for (let i = 0; i < 60; i++) sim.tick({ b: { move: right } });
    expect(sim.s.crate.x).toBeCloseTo(before.x, 6);
    expect(sim.s.crate.z).toBeCloseTo(before.z, 6);
  });
});

describe('§3.2 두 사람 운반: 받침대·걸쇠 → 덧문 → 통로 → 작업실 → 작업대', () => {
  it('앞 요정이 먼저 문을 넘고 뒤 요정이 문턱에서 멈췄다가 따라가도, 같은 재봉틀을 계속 든 채 작업대에 내려놓는다', () => {
    const sim = new Sim(['a', 'b']);
    // 1) 뒤뜰에서 양끝 잡기
    sim.walk('a', gripPos(sim.s.crate, 0));
    sim.press('a');
    sim.walk('b', gripPos(sim.s.crate, 1));
    sim.press('b');
    expect(sim.s.crate.lifted).toBe(true);

    // 덧문은 닫혀 있고 저절로 열리지 않는다
    expect(sim.s.door.open).toBe(false);

    // 2) 문 앞 받침대까지 옮기고 긴 쪽을 문 방향(−z)으로 튼다. 앞 = 손잡이 1(b)
    sim.carry({ x: CH2.stand.x, z: CH2.stand.z, yaw: Math.PI / 2 });
    sim.carry({ x: CH2.stand.x, z: CH2.stand.z, yaw: Math.PI });
    // 3) 받침대에 내려놓고 쉬는 동안 b가 걸쇠를 건다
    sim.press('b');
    expect(sim.s.crate.place).toBe('stand');
    expect(sim.s.crate.lifted).toBe(false);
    sim.walk('b', CH2.latch);
    sim.press('b');
    expect(sim.s.door.latched).toBe(true);
    sim.tick();
    expect(sim.s.door.open).toBe(true);
    // 4) 다시 함께 든다
    sim.walk('b', gripPos(sim.s.crate, 1));
    sim.press('b');
    expect(sim.s.crate.lifted).toBe(true);
    expect(sim.count('lift')).toBe(2);
    const grabsBefore = sim.count('grab');
    const staminaAt = () => sim.s.players.map((p) => p.stamina);

    // 5) 앞 요정(b)이 문턱을 넘고 통로 끝(작업실 입구)까지 먼저 간다
    sim.carry({ x: 0, z: -2.6, yaw: Math.PI }, { until: () => sim.p('b').z < CH2.boundaryZ });
    expect(sim.p('b').z).toBeLessThan(CH2.boundaryZ);
    expect(sim.p('a').z).toBeGreaterThan(CH2.boundaryZ);
    expect(sim.s.space).toBe('yard'); // 아직 확정하지 않는다
    expect(sim.count('spaceCommitted')).toBe(0);

    // 6) 뒤 요정(a)이 문턱 근처에서 멈춘다. 앞 요정이 계속 밀어도 상자·뒤 요정은 끌려가지 않는다(순간이동 없음)
    const rear = { x: sim.p('a').x, z: sim.p('a').z };
    const crateBefore = { ...sim.s.crate };
    const s0 = staminaAt();
    const up = groundToScreen({ x: 0, z: -1 }, YAW);
    for (let i = 0; i < 60; i++) sim.tick({ b: { move: up } });
    // mm 단위까지 제자리(앞 요정 입력이 긴 축과 아주 조금 어긋나면 뒤 손잡이를 축으로 미세하게 돈다)
    expect(sim.p('a').x).toBeCloseTo(rear.x, 3);
    expect(sim.p('a').z).toBeCloseTo(rear.z, 3);
    expect(sim.s.crate.z).toBeCloseTo(crateBefore.z, 3);
    expect(sim.s.crate.lifted).toBe(true);
    expect(sim.s.space).toBe('yard');
    // 옆(통로 벽 쪽)으로 밀어 벽에 막혀도 뒤 요정은 그대로다
    const side = groundToScreen({ x: -1, z: 0 }, YAW);
    for (let i = 0; i < 60; i++) sim.tick({ b: { move: side } });
    expect(sim.p('a').x).toBeCloseTo(rear.x, 3);
    expect(sim.p('a').z).toBeCloseTo(rear.z, 3);
    // 체력은 이어서 줄어든다(초기화되지 않는다)
    staminaAt().forEach((v, i) => expect(v).toBeLessThan(s0[i]!));

    // 7) 뒤 요정이 다시 출발 → 둘 다 넘으면 작업실을 한 번 확정
    sim.carry({ x: 0, z: -3.4, yaw: Math.PI });
    expect(allPassed(sim.s)).toBe(true);
    expect(sim.s.space).toBe('workshop');
    expect(sim.count('spaceCommitted')).toBe(1);
    expect(sim.events.find((e) => e.type === 'spaceCommitted')).toEqual({ type: 'spaceCommitted', space: 'workshop', transition: 1 });
    expect(sim.s.handles).toEqual(['a', 'b']); // 같은 손잡이를 그대로 쥐고 있다
    expect(sim.count('grab')).toBe(grabsBefore); // 다시 집지 않았다
    expect(sim.count('release')).toBe(1); // 받침대에서 한 번뿐

    // 8) 작업실 안에서 작업대 쪽으로 옮기고 긴 쪽을 작업대와 맞춘다
    sim.carry({ x: 0, z: -7.2, yaw: Math.PI });
    sim.carry({ x: CH2.bench.x, z: CH2.bench.z, yaw: CH2.bench.yaw });
    for (let i = 0; i < 120; i++) sim.tick(); // 확정 조건이 계속 참이어도
    expect(sim.count('spaceCommitted')).toBe(1); // 한 번만

    // 9) 내려놓기
    sim.press('a');
    expect(sim.s.delivered).toBe(true);
    expect(sim.s.crate.place).toBe('bench');
    expect(sim.count('delivered')).toBe(1);
    expect(sim.s.handles).toEqual([null, null]);
    expect(sim.count('exhausted')).toBe(0); // 2인 팀도 쉼터에서 작업대까지 한 번에 닿는다
  });

  it('맨몸 요정이 먼저 넘으면 작은 대기 구역까지만 가고, 친구가 넘을 때까지 확정하지 않는다', () => {
    const sim = new Sim(['a', 'b']);
    // 상자가 경계를 넘어야 하므로, 이 시험에서는 상자를 통로 너머로 미리 옮겨 둔다
    sim.s = { ...sim.s, crate: { ...sim.s.crate, x: 3.5, z: -4.5, yaw: Math.PI / 2 }, door: { ...sim.s.door, latched: true, open: true } };
    sim.walk('a', { x: 0, z: 1.5 });
    sim.walk('a', { x: 0, z: -4.9 });
    // 대기 구역 끝을 넘어 작업대 쪽으로는 못 간다
    const down = groundToScreen({ x: 0, z: -1 }, YAW);
    for (let i = 0; i < 120; i++) sim.tick({ a: { move: down } });
    expect(sim.p('a').z).toBeGreaterThan(CH2.waitZ);
    expect(sim.s.space).toBe('yard');
    sim.walk('b', { x: 0, z: 1.5 });
    sim.walk('b', { x: -1, z: -3 });
    expect(sim.s.space).toBe('workshop');
    expect(sim.count('spaceCommitted')).toBe(1);
    // 확정 뒤에는 작업대 쪽으로 갈 수 있다
    sim.walk('a', { x: 2, z: -8 });
  });

  it('재봉틀이 아직 뒤뜰에 있으면 팀원이 모두 넘어도 확정하지 않는다', () => {
    const sim = new Sim(['a', 'b']);
    sim.s = { ...sim.s, door: { ...sim.s.door, latched: true, open: true } };
    for (const id of ['a', 'b']) {
      sim.walk(id, { x: 0, z: 1.5 });
      sim.walk(id, { x: id === 'a' ? -0.8 : 0.8, z: -3 });
    }
    expect(sim.s.space).toBe('yard');
  });
});

describe('덧문·걸쇠', () => {
  it('문을 밀면 열렸다가 저절로 닫히고, 문틀에 사람이 있으면 닫히지 않는다', () => {
    const sim = new Sim(['a', 'b']);
    sim.walk('a', { x: 0, z: 2.9 });
    expect(planAction(sim.s, 'a').kind).toBe('door');
    sim.press('a');
    expect(sim.s.door.open).toBe(true);
    // 문틀 안으로 들어가 서 있으면 시간이 지나도 열려 있다
    sim.walk('a', { x: 0, z: 2.0 });
    for (let i = 0; i < 6 / DT; i++) sim.tick();
    expect(sim.s.door.open).toBe(true);
    // 통로 쪽으로 빠져나가면 닫힌다
    sim.walk('a', { x: 0, z: 0 });
    sim.tick();
    expect(sim.s.door.open).toBe(false);
    expect(sim.count('doorClosed')).toBe(1);
  });

  it('행동 버튼을 누르고 있는 동안 문을 잡고 있다', () => {
    const sim = new Sim(['a', 'b']);
    sim.walk('a', { x: -0.3, z: 3.1 }); // 문에 손이 닿되 문틀에는 걸치지 않는 자리
    sim.press('a');
    for (let i = 0; i < 8 / DT; i++) sim.tick({ a: { actionHeld: true } });
    expect(sim.s.door.open).toBe(true);
    for (let i = 0; i < 0.2 / DT; i++) sim.tick();
    expect(sim.s.door.open).toBe(false);
  });
});

describe('체력·교대(3~4인)', () => {
  function lifted(ids: string[]) {
    const sim = new Sim(ids);
    sim.walk(ids[0]!, gripPos(sim.s.crate, 0));
    sim.press(ids[0]!);
    sim.walk(ids[1]!, gripPos(sim.s.crate, 1));
    sim.press(ids[1]!);
    return sim;
  }

  it('무게를 든 사람만 체력이 줄고, 25% 이하면 교대 표시', () => {
    const sim = lifted(['a', 'b', 'c']);
    const toWarn = (STAMINA_MAX - STAMINA_WARN) / STAMINA_DRAIN;
    for (let i = 0; i < (toWarn - 1) / DT; i++) sim.tick();
    expect(needsSwap(sim.s, sim.p('a'))).toBe(false);
    for (let i = 0; i < 1.5 / DT; i++) sim.tick();
    expect(sim.p('a').stamina).toBeLessThanOrEqual(STAMINA_WARN);
    expect(needsSwap(sim.s, sim.p('a'))).toBe(true);
    expect(sim.p('c').stamina).toBe(STAMINA_MAX);
  });

  it('쉬던 요정이 잡힌 손잡이에서 행동하면 상자는 들린 채 소유권이 넘어간다(복제 없음)', () => {
    const sim = lifted(['a', 'b', 'c']);
    for (let i = 0; i < ((STAMINA_MAX - STAMINA_WARN) / STAMINA_DRAIN + 0.5) / DT; i++) sim.tick();
    const g = gripPos(sim.s.crate, 0);
    sim.walk('c', { x: g.x - 0.75, z: g.z });
    expect(planAction(sim.s, 'c')).toEqual({ kind: 'handover', handle: 0 });
    sim.press('c');
    expect(sim.s.handles).toEqual(['c', 'b']);
    expect(sim.p('a').holding).toBeNull();
    expect(sim.s.crate.lifted).toBe(true);
    expect(sim.s.players.filter((p) => p.holding !== null)).toHaveLength(2);
    expect(sim.count('handover')).toBe(1);
  });

  it('두 요정이 같은 틱에 같은 손잡이를 넘겨받으려 하면 한 명만 된다', () => {
    const sim = lifted(['a', 'b', 'c', 'd']);
    const g = gripPos(sim.s.crate, 0);
    sim.walk('c', { x: g.x - 0.75, z: g.z });
    sim.walk('d', { x: g.x - 0.3, z: g.z + 0.75 });
    sim.tick({ c: { actionDown: true }, d: { actionDown: true } });
    expect(sim.count('handover')).toBe(1);
    expect(sim.s.handles[0]).toBe('c'); // ID 순서로 먼저 처리된 c만
    const holders = sim.s.players.filter((p) => p.holding !== null).map((p) => p.id).sort();
    expect(holders).toHaveLength(2);
    expect(new Set(sim.s.handles).size).toBe(2);
    // 손잡이 하나에 한 명, 한 사람은 손잡이 하나
    for (const p of sim.s.players) if (p.holding !== null) expect(sim.s.handles[p.holding]).toBe(p.id);
  });

  it('체력이 0이면 그 자리에 조심히 내려놓고, 내려놓으면 회복한다', () => {
    const sim = lifted(['a', 'b']);
    for (let i = 0; i < (STAMINA_MAX / STAMINA_DRAIN + 1) / DT; i++) sim.tick();
    expect(sim.count('exhausted')).toBeGreaterThanOrEqual(1);
    expect(sim.s.crate.lifted).toBe(false);
    const st = sim.p('a').stamina;
    for (let i = 0; i < 1 / DT; i++) sim.tick();
    expect(sim.p('a').stamina).toBeGreaterThan(st);
  });

  it('운반자 연결이 끊기면 손잡이를 놓고 상자는 그 자리에 남는다', () => {
    const sim = lifted(['a', 'b']);
    const at = { ...sim.s.crate };
    const r = playerLeft(sim.s, 'a');
    expect(r.state.handles).toEqual([null, 'b']);
    expect(r.state.crate.lifted).toBe(false);
    expect(r.state.crate.x).toBe(at.x);
    expect(r.state.players.find((p) => p.id === 'a')!.connected).toBe(false);
  });
});
