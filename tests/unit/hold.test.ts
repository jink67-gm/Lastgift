import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createHoldTween, giftScale, placeOnGround, placeOnHands } from '../../src/scene/hold';

describe('손 위에 얹기', () => {
  it('두 손목 가운데에서 손바닥만큼 위·앞에, 손과 같은 방향으로 놓는다', () => {
    const v = new THREE.Group();
    const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2); // 요정이 +x를 본다
    placeOnHands(v, { pos: new THREE.Vector3(1, 0.8, 2), quat }, { x: 1, z: 2, yaw: Math.PI / 2 }, 1.2);
    expect(v.position.y).toBeCloseTo(0.8 + 0.025 * 1.2);
    expect(v.position.x).toBeCloseTo(1 + 0.07 * 1.2); // 앞(+x)으로
    expect(v.position.z).toBeCloseTo(2);
    expect(v.quaternion.angleTo(quat)).toBeLessThan(1e-6);
  });
  it('손 뼈가 없으면 가슴 앞 기본 자리', () => {
    const v = new THREE.Group();
    placeOnHands(v, null, { x: 0, z: 0, yaw: 0 }, 1);
    expect(v.position.z).toBeGreaterThan(0.2);
    expect(v.position.y).toBeGreaterThan(0.4);
  });
  it('내려놓으면 눕혀 바닥에', () => {
    const v = new THREE.Group();
    v.rotation.set(0.3, 1, 0.2);
    placeOnGround(v, 3, 4);
    expect(v.position.toArray()).toEqual([3, 0, 4]);
    expect(v.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(1e-6);
  });
  it('집을 때 바닥에서 손까지 순간 이동하지 않고 0.25초 동안 옮긴다', () => {
    const tw = createHoldTween(0.25);
    const v = new THREE.Group();
    v.position.set(0, 0, 0);
    tw.apply('a', v, false, 0);
    // 들었다: 목표는 손(1, 1, 0)
    v.position.set(1, 1, 0);
    tw.apply('a', v, true, 0.1);
    expect(v.position.x).toBeCloseTo(0); // 막 바뀐 순간은 이전 자리
    v.position.set(1, 1, 0);
    tw.apply('a', v, true, 0.225);
    expect(v.position.x).toBeGreaterThan(0.2);
    expect(v.position.x).toBeLessThan(0.8);
    v.position.set(1, 1, 0);
    tw.apply('a', v, true, 0.4);
    expect(v.position.toArray()).toEqual([1, 1, 0]);
  });
  it('선물 크기는 요정 크기에 비례', () => {
    expect(giftScale('ball', 1.2)).toBeCloseTo(0.8);
    expect(giftScale('ball', 1)).toBeCloseTo(0.8 / 1.2);
  });
});
