// 길 좌표: 고정 사진기(남동쪽 위)에서 길이 "화면 위쪽"으로 나도록 잡은 좌표계(1장·3장 공용).
//   s = 화면 위쪽(북서)으로 길을 따라, t = 화면 오른쪽(북동). 판정은 이 값만 쓴다.
import type { Collider } from '../core/collision';

/** 길 앞쪽(화면 위쪽, 북서) */
const F = { x: -Math.SQRT1_2, z: -Math.SQRT1_2 };
/** 길 오른쪽(화면 오른쪽, 북동) */
const R = { x: Math.SQRT1_2, z: -Math.SQRT1_2 };

/** 길 좌표(s, t) → 월드 */
export function W(s: number, t: number): { x: number; z: number } {
  return { x: s * F.x + t * R.x, z: s * F.z + t * R.z };
}

/** 월드 → 길 좌표 */
export function toLane(p: { x: number; z: number }): { s: number; t: number } {
  return { s: p.x * F.x + p.z * F.z, t: p.x * R.x + p.z * R.z };
}

/** 길 방향 각(바라보는 방향 = atan2(x, z)): 앞(화면 위)·오른쪽·뒤(사진기 쪽)·왼쪽 */
export const YAW = {
  forward: Math.atan2(F.x, F.z),
  right: Math.atan2(R.x, R.z),
  back: Math.atan2(-F.x, -F.z),
  left: Math.atan2(-R.x, -R.z),
};

/** 길 좌표의 선분을 두께 있는 벽(회전 사각형)으로 */
export function laneWall(a: { s: number; t: number }, b: { s: number; t: number }, thick: number): Collider {
  const pa = W(a.s, a.t);
  const pb = W(b.s, b.t);
  const dx = pb.x - pa.x, dz = pb.z - pa.z;
  return { kind: 'obb', x: (pa.x + pb.x) / 2, z: (pa.z + pb.z) / 2, yaw: Math.atan2(dx, dz), ha: Math.hypot(dx, dz) / 2, hb: thick / 2 };
}

/** 길 좌표의 원 */
export function laneCircle(s: number, t: number, r: number): Collider {
  const p = W(s, t);
  return { kind: 'circle', x: p.x, z: p.z, r };
}
