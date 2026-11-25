// 2장 · 수선집: 뒤뜰 → 덧문을 단 반입 통로 → 작업실 (명세서 §3.2, §5).
// 공간 셋을 한 장면에 이어 붙이고, 카메라 범위와 "공간 확정"만 나눈다.
// 좌표: x 오른쪽, z 카메라 쪽. 위쪽(−z)으로 갈수록 작업실에 가까워진다.
import type { Bounds, Collider } from '../core/collision';

export type SpaceId = 'yard' | 'workshop';

const box = (x: number, z: number, w: number, d: number): Collider => ({ kind: 'box', x, z, hx: w / 2, hz: d / 2 });
const circle = (x: number, z: number, r: number): Collider => ({ kind: 'circle', x, z, r });

export const CH2 = {
  bounds: { minX: -6, maxX: 6, minZ: -12, maxZ: 12 } as Bounds,

  /** 덧문(뒤뜰과 통로 사이). 문틈 반 너비 */
  door: { x: 0, z: 2, halfGap: 0.95 },
  /** 통로 끝 = 작업실 입구. 이 선을 팀원·재봉틀이 모두 넘으면 작업실로 확정 */
  boundaryZ: -2,
  /** 확정 전에 먼저 넘어온 요정이 기다릴 수 있는 곳의 끝(작은 대기 구역) */
  waitZ: -5.6,

  /** 2인 팀: 문 앞 받침대(쉼터)와 덧문 걸쇠 */
  stand: { x: 0, z: 4.4, w: 2.0, d: 0.9, zone: 0.9 },
  latch: { x: 1.65, z: 2.45, range: 0.9 },

  /** 작업대와 빨간 코트. 상자를 긴 쪽이 x축을 따라 놓이게 올려야 한다 */
  bench: { x: 0, z: -9, w: 1.4, d: 0.9, zone: 0.6, yaw: Math.PI / 2, yawTolerance: (20 * Math.PI) / 180 },
  coat: { x: 0, z: -10.7 },

  crateStart: { x: 2.5, z: 9.2, yaw: Math.PI / 2 },
  spawns: [
    { x: 0.9, z: 10.4 },
    { x: 4.1, z: 10.4 },
    { x: 2.5, z: 11.2 },
    { x: -0.6, z: 10.8 },
  ],

  /** 공간마다 카메라가 볼 범위(팀 중심을 이 안으로 자른다) */
  camera: {
    yard: { minX: -2.5, maxX: 2.5, minZ: -1.5, maxZ: 9 },
    workshop: { minX: -2.5, maxX: 2.5, minZ: -9.5, maxZ: -3 },
  } as Record<SpaceId, Bounds>,

  /** 벽과 장애물(모두에게) */
  walls: [
    // 뒤뜰 뒷벽(덧문 양옆)
    box(-3.475, 2, 5.05, 0.3),
    box(3.475, 2, 5.05, 0.3),
    // 통로 양옆 건물(통로 폭 2.6 m)
    box(-3.65, 0, 4.7, 4),
    box(3.65, 0, 4.7, 4),
    // 뒤뜰 장애물: 장작더미, 창고, 빨랫줄 기둥
    box(-3.9, 6.6, 1.8, 2.8),
    box(4.6, 5.8, 2.8, 2.0),
    circle(-4.8, 10.6, 0.15),
    circle(4.9, 10.6, 0.15),
    // 작업실 가구: 옛 재봉틀 탁자, 옷 더미
    box(-4.4, -8.2, 2.0, 1.2),
    box(4.4, -6.8, 1.6, 1.6),
  ] as Collider[],
} as const;

/** 확정 전에만 있는 보이지 않는 벽: 먼저 넘은 요정은 대기 구역 안에서만 움직인다 */
export const WAIT_WALL: Collider = { kind: 'box', x: 0, z: CH2.waitZ - 0.1, hx: 6, hz: 0.1 };

/** 닫힌 덧문 */
export const DOOR_CLOSED: Collider = { kind: 'box', x: CH2.door.x, z: CH2.door.z, hx: CH2.door.halfGap, hz: 0.12 };

/** 작업대: 맨몸 요정만 막는다(운반 중인 상자와 운반자는 상판 위로 손을 뻗는다) */
export const BENCH_COLLIDER: Collider = box(CH2.bench.x, CH2.bench.z, CH2.bench.w, CH2.bench.d);
