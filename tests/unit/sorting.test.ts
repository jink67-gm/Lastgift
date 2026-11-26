// 0장 선물 분류 규칙. 실제 입력과 같은 "화면 기준 이동 + 행동"을 틱마다 넣는다.
// 먼 거리는 시험을 짧게 하려고 상태에서 요정 위치를 옮겨 놓고 시작한다(이동 규칙은 sewing.test에서 따로 검증).
import { describe, expect, it } from 'vitest';
import { groundToScreen } from '../../src/core/screenSpace';
import { gripPos, type SewingInput } from '../../src/core/sewing';
import { createSorting, markerAt, planAction, step, type SortEvent, type SortState } from '../../src/core/sorting';
import { CH0, markerOf, SORT_GIFTS } from '../../src/data/chapter0';

const DT = 1 / 60;
const YAW = Math.PI / 4;
const idle: SewingInput = { move: { x: 0, y: 0 }, actionDown: false, actionHeld: false };

class Sim {
  s: SortState = createSorting(['a', 'b']);
  events: SortEvent[] = [];
  tick(inp: Record<string, Partial<SewingInput>> = {}) {
    const full: Record<string, SewingInput> = {};
    for (const p of this.s.sewing.players) full[p.id] = { ...idle, ...inp[p.id] };
    const r = step(this.s, full, DT);
    this.s = r.state;
    this.events.push(...r.events);
  }
  press(id: string) {
    this.tick({ [id]: { actionDown: true, actionHeld: true } });
  }
  /** 요정을 (x, z)에 세우고 facing 방향을 보게 한다 */
  place(id: string, x: number, z: number, facing: number) {
    this.s = { ...this.s, sewing: { ...this.s.sewing, players: this.s.sewing.players.map((p) => (p.id === id ? { ...p, x, z, facing } : p)) } };
  }
  walk(id: string, to: { x: number; z: number }, maxSec = 10) {
    for (let i = 0; i < maxSec / DT; i++) {
      const p = this.s.sewing.players.find((q) => q.id === id)!;
      const dx = to.x - p.x, dz = to.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.05) return;
      const k = Math.min(1, d / (3.6 * DT)) / d;
      this.tick({ [id]: { move: groundToScreen({ x: dx * k, z: dz * k }, YAW) } });
    }
    throw new Error(`could not reach ${JSON.stringify(to)}`);
  }
  item(id: string) {
    return this.s.items.find((i) => i.id === id)!;
  }
  count(t: SortEvent['type']) {
    return this.events.filter((e) => e.type === t).length;
  }
  /** 선물을 집어 표식 자리(가운데에서 dx만큼)에 내려놓는다 */
  deliver(id: string, itemId: string, dest: 'yuna' | 'tailor' | 'minjae' | 'grandma', dx = 0) {
    const it = this.item(itemId);
    this.place(id, it.x - 0.6, it.z, Math.PI / 2);
    this.press(id);
    expect(this.item(itemId).carriedBy).toBe(id);
    const m = markerOf(dest);
    // 표식 자리 바로 앞에서 +x를 보고 서면, 앞쪽 0.75 m에 놓인다
    this.place(id, m.x + dx - 0.75, m.z, Math.PI / 2);
    this.press(id);
  }
}

describe('0장 선물 분류', () => {
  it('맞는 표식에 놓으면 그 자리에 고정되고 다시 집을 수 없다', () => {
    const sim = new Sim();
    sim.deliver('a', 'sketchbook', 'yuna');
    expect(sim.item('sketchbook').sorted).toBe(true);
    expect(markerAt(sim.item('sketchbook'))?.dest).toBe('yuna');
    const it = sim.item('sketchbook');
    sim.place('a', it.x - 0.6, it.z, Math.PI / 2);
    expect(planAction(sim.s, 'a').kind).not.toBe('pick');
  });

  it('틀린 표식에 놓으면 원래 자리로 돌아가고 다시 집을 수 있다', () => {
    const sim = new Sim();
    sim.deliver('a', 'ball', 'yuna');
    const ball = sim.item('ball');
    const home = SORT_GIFTS.find((g) => g.id === 'ball')!;
    expect(ball.sorted).toBe(false);
    expect(ball.carriedBy).toBeNull();
    expect({ x: ball.x, z: ball.z }).toEqual({ x: home.x, z: home.z });
    expect(sim.count('wrong')).toBe(1);
    sim.place('a', home.x - 0.6, home.z, Math.PI / 2);
    expect(planAction(sim.s, 'a')).toEqual({ kind: 'pick', itemId: 'ball' });
  });

  it('유나네 두 물건(스케치북·색연필 통)이 같은 표식에 겹치지 않게 놓인다', () => {
    const sim = new Sim();
    sim.deliver('a', 'sketchbook', 'yuna');
    sim.deliver('a', 'pencils', 'yuna');
    const a = sim.item('sketchbook'), b = sim.item('pencils');
    expect(a.sorted && b.sorted).toBe(true);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(0.5);
  });

  it('재봉틀은 혼자 들리지 않고, 가벼운 선물을 든 요정은 손잡이를 잡지 않는다', () => {
    const sim = new Sim();
    const g0 = gripPos(sim.s.sewing.crate, 0);
    sim.place('a', g0.x - 0.4, g0.z, Math.PI / 2);
    sim.press('a');
    expect(sim.s.sewing.handles).toEqual(['a', null]);
    expect(sim.s.sewing.crate.lifted).toBe(false);
    // b는 공을 든 채 다른 손잡이에 가서 행동하면 공을 내려놓을 뿐 손잡이를 잡지 않는다
    const ball = sim.item('ball');
    sim.place('b', ball.x - 0.6, ball.z, Math.PI / 2);
    sim.press('b');
    const g1 = gripPos(sim.s.sewing.crate, 1);
    sim.place('b', g1.x + 0.4, g1.z, -Math.PI / 2);
    expect(planAction(sim.s, 'b').kind).toMatch(/drop|blocked/);
  });

  it('두 요정이 양끝을 들어 수선집 표식에 내려놓으면 고정, 다른 표식에 내려놓으면 원래 자리로', () => {
    const sim = new Sim();
    const lift = () => {
      const c = sim.s.sewing.crate;
      const g0 = gripPos(c, 0), g1 = gripPos(c, 1);
      sim.place('a', g0.x - 0.3, g0.z, Math.PI / 2);
      sim.press('a');
      sim.place('b', g1.x + 0.3, g1.z, -Math.PI / 2);
      sim.press('b');
      expect(sim.s.sewing.crate.lifted).toBe(true);
    };
    // 상자를 들어 유나네 표식 근처로 옮겨 놓고(상태 이동) 내려놓기 → 원래 자리로
    lift();
    const yuna = markerOf('yuna');
    sim.s = { ...sim.s, sewing: { ...sim.s.sewing, crate: { ...sim.s.sewing.crate, x: yuna.x + 0.3, z: yuna.z } } };
    sim.tick();
    sim.press('a');
    expect(sim.count('wrong')).toBe(1);
    expect(sim.s.sewing.crate.x).toBeCloseTo(CH0.crateStart.x);
    expect(sim.s.sewing.handles).toEqual([null, null]);
    // 다시 들어 수선집 표식에 내려놓기
    lift();
    const t = markerOf('tailor');
    sim.s = { ...sim.s, sewing: { ...sim.s.sewing, crate: { ...sim.s.sewing.crate, x: t.x, z: t.z + 0.3 } } };
    sim.tick();
    sim.press('b');
    expect(sim.s.crateSorted).toBe(true);
    expect(sim.events).toContainEqual({ type: 'sorted', itemId: 'sewing', dest: 'tailor' });
  });

  it('다섯 물건이 모두 제자리면 0장 완료를 한 번만 낸다', () => {
    const sim = new Sim();
    sim.deliver('a', 'sketchbook', 'yuna');
    sim.deliver('a', 'pencils', 'yuna');
    sim.deliver('a', 'ball', 'minjae');
    sim.deliver('b', 'repair', 'grandma');
    expect(sim.s.complete).toBe(false); // 재봉틀이 아직
    const c = sim.s.sewing.crate;
    const g0 = gripPos(c, 0), g1 = gripPos(c, 1);
    sim.place('a', g0.x - 0.3, g0.z, Math.PI / 2);
    sim.press('a');
    sim.place('b', g1.x + 0.3, g1.z, -Math.PI / 2);
    sim.press('b');
    // 실제로 함께 걸어 옮겨 본다: 같은 방향(+x)으로 1초
    const right = groundToScreen({ x: 1, z: 0 }, YAW);
    const x0 = sim.s.sewing.crate.x;
    for (let i = 0; i < 60; i++) sim.tick({ a: { move: right }, b: { move: right } });
    expect(sim.s.sewing.crate.x).toBeGreaterThan(x0 + 1.5);
    const t = markerOf('tailor');
    sim.s = { ...sim.s, sewing: { ...sim.s.sewing, crate: { ...sim.s.sewing.crate, x: t.x, z: t.z } } };
    sim.tick();
    sim.press('a');
    expect(sim.s.complete).toBe(true);
    for (let i = 0; i < 30; i++) sim.tick();
    expect(sim.count('complete')).toBe(1);
  });

  it('벽·표지판에 막히면 놓지 못한다', () => {
    const sim = new Sim();
    const it = sim.item('sketchbook');
    sim.place('a', it.x - 0.6, it.z, Math.PI / 2);
    sim.press('a');
    const m = markerOf('yuna');
    // 표지판(바깥쪽) 바로 앞에서 표지판 쪽을 보고 놓으려 하면 막힌다
    sim.place('a', m.signX + 0.75, m.signZ, -Math.PI / 2);
    expect(planAction(sim.s, 'a').kind).toBe('blocked');
  });
});
