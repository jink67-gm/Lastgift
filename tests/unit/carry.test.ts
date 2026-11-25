import { describe, expect, it } from 'vitest';
import { applyAction, chooseTarget, planAction, type Item } from '../../src/core/carry';
import type { Bounds, Collider } from '../../src/core/collision';
import type { PlayerState } from '../../src/core/player';

const B: Bounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
const facingPlusX: PlayerState = { x: 0, z: 0, facing: Math.PI / 2, moving: false };
const item = (id: string, x: number, z: number, light = true): Item => ({ id, x, z, light, carriedBy: null });

describe('chooseTarget: 가까운 대상 하나 고르기', () => {
  it('바라보는 쪽에 있는 물건을 고른다', () => {
    const items = [item('front', 1, 0), item('back', -1, 0)];
    expect(chooseTarget(facingPlusX, items)?.id).toBe('front');
  });

  it('겹쳐 있으면 바라보는 방향에 더 가까운 쪽', () => {
    const items = [item('side', 0.2, 0.9), item('ahead', 1.0, 0)];
    expect(chooseTarget(facingPlusX, items)?.id).toBe('ahead');
  });

  it('등 뒤라도 아주 가까우면 고를 수 있다', () => {
    expect(chooseTarget(facingPlusX, [item('feet', -0.5, 0)])?.id).toBe('feet');
  });

  it('길쭉한 물건은 끝에 붙어 서면 닿는다', () => {
    const long: Item = { ...item('sewing', 1.95, 0, false), reach: 0.8 };
    expect(chooseTarget(facingPlusX, [long])?.id).toBe('sewing');
  });

  it('멀면 고르지 않는다', () => {
    expect(chooseTarget(facingPlusX, [item('far', 3, 0)])).toBeNull();
  });
});

describe('들기·놓기', () => {
  it('들고 → 앞에 놓는다', () => {
    let items: readonly Item[] = [item('a', 1, 0)];
    const pick = planAction('p0', facingPlusX, items, [], B);
    expect(pick.kind).toBe('pick');
    items = applyAction('p0', items, pick);
    expect(items[0]!.carriedBy).toBe('p0');
    const drop = planAction('p0', facingPlusX, items, [], B);
    expect(drop.kind).toBe('drop');
    items = applyAction('p0', items, drop);
    expect(items[0]!.carriedBy).toBeNull();
    expect(items[0]!.x).toBeCloseTo(0.75);
  });

  it('무거운 재봉틀은 혼자 들 수 없다', () => {
    const items = [item('sewing', 1, 0, false)];
    const a = planAction('p0', facingPlusX, items, [], B);
    expect(a.kind).toBe('tooHeavy');
    expect(applyAction('p0', items, a)).toBe(items);
  });

  it('벽 앞에서는 놓지 못한다', () => {
    const wall: Collider = { kind: 'box', x: 1, z: 0, hx: 0.3, hz: 2 };
    const items: Item[] = [{ ...item('a', 0, 0), carriedBy: 'p0' }];
    expect(planAction('p0', facingPlusX, items, [wall], B).kind).toBe('blocked');
  });

  it('같은 pick을 두 번 적용해도 물건은 하나만 든다(복제 없음)', () => {
    let items: readonly Item[] = [item('a', 1, 0), item('b', 1.1, 0.1)];
    const a = planAction('p0', facingPlusX, items, [], B);
    items = applyAction('p0', items, a);
    items = applyAction('p0', items, a);
    items = applyAction('p0', items, { kind: 'pick', itemId: 'b' });
    expect(items.filter((i) => i.carriedBy === 'p0')).toHaveLength(1);
  });

  it('다른 요정이 든 물건은 집지 못한다', () => {
    const items: Item[] = [{ ...item('a', 1, 0), carriedBy: 'p1' }];
    expect(applyAction('p0', items, { kind: 'pick', itemId: 'a' })).toBe(items);
  });
});
