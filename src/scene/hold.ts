// 가벼운 선물 들기: 두 팔을 앞으로 모아 두 손 위에 얹는다(사용자가 고른 방식).
// - 물건은 두 손목 가운데 바로 위(손바닥 두께만큼)에 앉고, 손·몸통과 한 덩어리로 움직인다
//   (걸을 때 몸이 출렁이면 물건도 같이 출렁이고, 두 손 높이가 다르면 같이 기운다). 따로 흔들거나 늦게 따라가지 않는다.
// - 크기는 요정이 두 손에 얹어 얼굴을 덜 가리는 정도(바닥에서도 같은 크기, 그림 표시·윤곽·고리로 찾는다).
// - 판정과 무관(보이는 자리만).
// 지난 시도: 1차 손바닥 위(선물이 커서 얼굴이 파묻힘) → 2차 가슴 아래·팔 크게 벌림(더 어색) → 3차 가슴에 꼭 안기
// (걸을 때 물건이 제자리에 고정되고 몸만 움직임) → 지금: 1차 방식 + 작은 선물 + 손·몸통을 그대로 따라감
import * as THREE from 'three';
import type { GiftKind } from '../data/gifts';

/** 선물 크기(배, 0장 요정 크기 1.2 기준) */
const GIFT_SCALE: Record<GiftKind, number> = { sketchbook: 0.95, pencils: 0.9, ball: 0.8, repair: 0.9, sewing: 1 };
export function giftScale(kind: GiftKind, elfScale: number): number {
  return (GIFT_SCALE[kind] * elfScale) / 1.2;
}

/** 손 위에 얹은 물건의 가로 폭(요정 크기 1 기준). 요정이 이 폭에 맞춰 두 손 사이를 맞춘다 */
export function holdSpan(v: THREE.Object3D, elfScale: number): number {
  const r = v.rotation.clone();
  const p = v.position.clone();
  v.rotation.set(0, 0, 0);
  v.position.set(0, 0, 0);
  const w = new THREE.Box3().setFromObject(v).getSize(new THREE.Vector3()).x;
  v.rotation.copy(r);
  v.position.copy(p);
  return w / elfScale;
}

/** 요정 크기 1 기준: 손목 위 손바닥 두께, 손목에서 손바닥 가운데까지(앞으로). 물건이 손목이 아니라 손바닥 위에 앉게 */
const PALM_UP = 0.025;
const PALM_FWD = 0.07;
/** 손 뼈가 없는 기본 도형 요정: 가슴 앞 높이·거리 */
const PLAIN_Y = 0.62;
const PLAIN_FWD = 0.3;

const tmp = new THREE.Vector3();

/** 손 위 자리(frame: 두 손목 가운데·방향, 없으면 기본 자리)에 물건 v를 얹는다. 물건 원점은 바닥 가운데 */
export function placeOnHands(
  v: THREE.Object3D,
  frame: { pos: THREE.Vector3; quat: THREE.Quaternion } | null,
  at: { x: number; z: number; yaw: number },
  scale: number,
): void {
  if (frame) {
    v.quaternion.copy(frame.quat);
    tmp.set(0, PALM_UP * scale, PALM_FWD * scale).applyQuaternion(frame.quat);
    v.position.copy(frame.pos).add(tmp);
  } else {
    v.rotation.set(0, at.yaw, 0, 'XYZ');
    v.position.set(at.x + Math.sin(at.yaw) * PLAIN_FWD * scale, PLAIN_Y * scale, at.z + Math.cos(at.yaw) * PLAIN_FWD * scale);
  }
}

/** 바닥에 내려놓을 때 자세를 되돌린다 */
export function placeOnGround(v: THREE.Object3D, x: number, z: number): void {
  v.rotation.set(0, 0, 0, 'XYZ');
  v.position.set(x, 0, z);
}

/**
 * 집기·놓기 이어 주기: 들거나 내려놓는 순간 물건이 바닥 ↔ 손으로 순간 이동하지 않게, 바뀌기 직전 보이던 자리에서
 * 새 자리까지 짧게(0.25초) 옮긴다. 집을 때는 살짝 들어 올리는 호를 그린다. 판정과 무관.
 */
export function createHoldTween(sec = 0.25) {
  const st = new Map<string, { held: boolean; pos: THREE.Vector3; quat: THREE.Quaternion; from?: { pos: THREE.Vector3; quat: THREE.Quaternion; t0: number; up: boolean } }>();
  return {
    /** v를 이번 프레임 목표 자리에 놓은 뒤 부른다 */
    apply(id: string, v: THREE.Object3D, held: boolean, now: number): void {
      let s = st.get(id);
      if (!s) {
        s = { held, pos: v.position.clone(), quat: v.quaternion.clone() };
        st.set(id, s);
      }
      if (s.held !== held) {
        s.from = { pos: s.pos.clone(), quat: s.quat.clone(), t0: now, up: held };
        s.held = held;
      }
      if (s.from) {
        const t = (now - s.from.t0) / sec;
        if (t >= 1 || t < 0) s.from = undefined;
        else {
          const e = t * t * (3 - 2 * t);
          v.position.lerpVectors(s.from.pos, v.position, e);
          if (s.from.up) v.position.y += Math.sin(Math.PI * e) * 0.08;
          v.quaternion.slerpQuaternions(s.from.quat, v.quaternion.clone(), e);
        }
      }
      s.pos.copy(v.position);
      s.quat.copy(v.quaternion);
    },
  };
}
