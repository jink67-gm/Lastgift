import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { holdPlace, holdShape } from '../../src/scene/hold';

describe('품에 안기', () => {
  it('가로가 긴 물건은 돌려서 좁은 쪽을 잡는다', () => {
    const s = holdShape('repair', new THREE.Vector3(0.8, 0.4, 0.45));
    expect(s.turn).toBe(true);
    expect(s.across).toBeCloseTo(0.45);
    expect(s.depth).toBeCloseTo(0.8);
    expect(holdShape('pencils', new THREE.Vector3(0.3, 0.5, 0.3)).turn).toBe(false);
  });
  it('키 큰 물건은 낮춰서 윗면이 턱 높이 근처를 넘지 않는다', () => {
    const s = holdShape('pencils', new THREE.Vector3(0.3, 0.7, 0.3));
    const { bottom } = holdPlace(s, { y: 0.84, fwd: 0.27 }, 1.2);
    expect(bottom + 0.7).toBeLessThanOrEqual((0.86 + 0.07) * 1.2 + 1e-9);
    expect(bottom).toBeGreaterThanOrEqual(0.12 * 1.2);
  });
  it('몸과 겹치지 않게 배 앞에 둔다(앞뒤로 긴 물건은 더 앞으로)', () => {
    const s = holdShape('repair', new THREE.Vector3(0.8, 0.4, 0.45));
    const { ahead } = holdPlace(s, { y: 0.84, fwd: 0.2 }, 1.2);
    expect(ahead).toBeCloseTo(0.12 + 0.4);
  });
  it('손이 없으면(기본 도형 요정) 기본 손 자리를 쓴다', () => {
    const s = holdShape('ball', new THREE.Vector3(0.5, 0.6, 0.5));
    const p = holdPlace(s, null, 1);
    expect(p.bottom).toBeGreaterThan(0);
    expect(p.ahead).toBeGreaterThanOrEqual(0.22);
  });
});
