import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { holdPlace, holdShape, placeHeld } from '../../src/scene/hold';

describe('품에 안기', () => {
  it('납작한 물건은 세워서 안는다(폭은 그대로, 높이·두께가 바뀐다)', () => {
    const s = holdShape('sketchbook', new THREE.Vector3(0.42, 0.08, 0.32));
    expect(s.upright).toBe(true);
    expect(s.across).toBeCloseTo(0.42);
    expect(s.height).toBeCloseTo(0.32);
    expect(s.depth).toBeCloseTo(0.08);
    expect(holdShape('pencils', new THREE.Vector3(0.3, 0.5, 0.3)).upright).toBe(false);
  });
  it('키 큰 물건은 낮춰서 윗면이 턱 높이를 넘지 않는다', () => {
    const s = holdShape('pencils', new THREE.Vector3(0.3, 0.7, 0.3));
    const p = holdPlace(s, { y: 0.88, fwd: 0.32 }, 1.2);
    expect(p.top).toBeLessThanOrEqual(0.88 * 1.2 + 1e-9);
    expect(p.bottom).toBeGreaterThanOrEqual(0.12 * 1.2);
  });
  it('몸과 겹치지 않게 배 앞에 둔다(두꺼운 물건은 더 앞으로)', () => {
    const s = holdShape('repair', new THREE.Vector3(0.42, 0.3, 0.5));
    expect(holdPlace(s, { y: 0.88, fwd: 0.2 }, 1.2).ahead).toBeCloseTo(0.12 + 0.25);
  });
  it('세운 물건은 가운데가 계산한 자리에 온다', () => {
    const v = new THREE.Group();
    v.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.32).translate(0, 0.04, 0)));
    const s = holdShape('sketchbook', new THREE.Vector3(0.42, 0.08, 0.32));
    const p = placeHeld(v, s, { x: 0, z: 0, yaw: 0 }, { y: 0.88, fwd: 0.32 }, 1.2);
    v.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(v);
    expect(box.min.y).toBeCloseTo(p.bottom, 3);
    expect(box.max.y).toBeCloseTo(p.top, 3);
    expect((box.min.z + box.max.z) / 2).toBeCloseTo(p.ahead, 3);
    expect(box.max.x - box.min.x).toBeCloseTo(0.42, 3);
  });
});
