import { describe, expect, it } from 'vitest';
import { createFinale, leave, planAction, step, stockingChecked, type FinaleEvent, type FinaleState } from '../../src/core/finale';
import { BAG, GLOBE_SAFE, SANTA_SPOT, STOCKING } from '../../src/data/finale';

const DT = 1 / 60;
const idle = { move: { x: 0, y: 0 }, actionDown: false, actionHeld: false };
const press = { ...idle, actionDown: true };
const at = (st: FinaleState, id: string, x: number, z: number): FinaleState => ({ ...st, players: st.players.map((p) => (p.id === id ? { ...p, x, z } : p)) });
function act(st: FinaleState, ids: string[]): { state: FinaleState; events: FinaleEvent[] } {
  return step(st, Object.fromEntries(ids.map((i) => [i, press])), DT);
}
const two = () => createFinale(5, [{ id: 'p0', x: 0, z: 0, facing: 0 }, { id: 'p1', x: 1, z: 0, facing: 0 }]);

describe('5장 빈 양말·가방', () => {
  it('둘이면 서로 다른 두 요정이 양말을 들여다봐야 가방을 열 수 있다(같은 요정 두 번은 안 된다)', () => {
    let st = at(two(), 'p0', STOCKING.x, STOCKING.z + 0.9);
    expect(planAction(st, 'p0').kind).toBe('peek');
    let r = act(st, ['p0']);
    expect(r.events).toContainEqual({ type: 'peek', playerId: 'p0', first: true });
    st = r.state;
    expect(planAction(st, 'p0').kind).toBe('none'); // 이미 들여다봤다
    expect(stockingChecked(st)).toBe(false);
    // 가방 앞: 아직
    st = at(st, 'p0', BAG.x, BAG.z + 0.8);
    expect(planAction(st, 'p0').kind).toBe('notYet');
    // 친구도 들여다본다
    st = at(st, 'p1', STOCKING.x + 0.3, STOCKING.z + 0.9);
    r = act(st, ['p1']);
    expect(r.events.map((e) => e.type)).toEqual(['peek', 'stockingChecked']);
    st = r.state;
    expect(planAction(st, 'p0').kind).toBe('openBag');
    r = act(st, ['p0']);
    expect(r.events).toContainEqual({ type: 'opened', playerId: 'p0' });
    // 한 번만 연다
    expect(planAction(r.state, 'p0').kind).toBe('none');
    expect(act(r.state, ['p0']).events.filter((e) => e.type === 'opened').length).toBe(0);
  });
  it('혼자면 한 번 들여다보면 된다', () => {
    let st = createFinale(5, [{ id: 'p0', x: STOCKING.x, z: STOCKING.z + 0.9, facing: 0 }]);
    st = act(st, ['p0']).state;
    expect(stockingChecked(st)).toBe(true);
  });
  it('가방을 연 뒤에는 움직이지 않는다(연출)', () => {
    let st = at(two(), 'p0', STOCKING.x, STOCKING.z + 0.9);
    st = act(st, ['p0']).state;
    st = at(st, 'p1', STOCKING.x + 0.3, STOCKING.z + 0.9);
    st = act(st, ['p1']).state;
    st = at(st, 'p0', BAG.x, BAG.z + 0.8);
    st = act(st, ['p0']).state;
    const r = step(st, { p0: { ...idle, move: { x: 1, y: 0 } } }, DT);
    expect(r.state.players[0]!.x).toBe(st.players[0]!.x);
  });
});

describe('6장 건네기', () => {
  it('스노글로브를 든 요정만, 산타 앞에서만 건넨다(자동 전달 없음)', () => {
    let st = createFinale(6, [{ id: 'p0', x: 0, z: 0, facing: 0 }, { id: 'p1', x: 1, z: 0, facing: 0 }], 'p1');
    // 안 든 요정은 산타 앞에서도 못 건넨다
    st = at(st, 'p0', SANTA_SPOT.x - 1.2, SANTA_SPOT.z + 0.6);
    expect(planAction(st, 'p0').kind).toBe('none');
    // 든 요정이 멀리 있으면 아무 일 없음, 서 있기만 해서는 건네지지 않는다
    st = step(st, { p1: idle }, 1).state;
    expect(st.delivered).toBe(false);
    st = at(st, 'p1', SANTA_SPOT.x - 1.2, SANTA_SPOT.z + 0.4);
    expect(planAction(st, 'p1').kind).toBe('deliver');
    const r = act(st, ['p1']);
    expect(r.events).toContainEqual({ type: 'deliver', playerId: 'p1' });
    expect(r.state.delivered).toBe(true);
  });
  it('든 요정이 나가면 스노글로브는 안전 지점에 남고, 다른 요정이 들어 건넬 수 있다', () => {
    let st = createFinale(6, [{ id: 'p0', x: 0, z: 0, facing: 0 }, { id: 'p1', x: 1, z: 0, facing: 0 }], 'p1');
    st = leave(st, 'p1');
    expect(st.globe).toEqual({ holder: null, x: GLOBE_SAFE.x, z: GLOBE_SAFE.z });
    st = at(st, 'p0', GLOBE_SAFE.x, GLOBE_SAFE.z + 0.6);
    expect(planAction(st, 'p0').kind).toBe('take');
    st = act(st, ['p0']).state;
    expect(st.globe!.holder).toBe('p0');
    st = at(st, 'p0', SANTA_SPOT.x - 1.2, SANTA_SPOT.z + 0.4);
    expect(act(st, ['p0']).state.delivered).toBe(true);
  });
});
