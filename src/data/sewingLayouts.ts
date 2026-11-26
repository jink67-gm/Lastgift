// 재봉틀 운반 규칙(core/sewing.ts)이 쓰는 배치. 장마다 하나씩 선언한다.
//   ch2: 수선집 뒤뜰 → 덧문 → 반입 통로 → 작업실(문·걸쇠·받침대·공간 확정 있음)
//   ch0: 광장(처음 분류): 문·공간 없이, 수선집 그림 표식이 내려놓을 자리
import type { Bounds, Collider } from '../core/collision';
import { BENCH_COLLIDER, CH2, DOOR_CLOSED, WAIT_WALL } from './chapter2';
import { CH0 } from './chapter0';

export type SewingLayoutId = 'ch2' | 'ch0';

export interface SewingLayout {
  bounds: Bounds;
  walls: readonly Collider[];
  crateStart: { x: number; z: number; yaw: number };
  spawns: readonly { x: number; z: number }[];
  /** 내려놓으면 배달이 끝나는 자리. yawTolerance가 π면 방향 상관없음 */
  bench: { x: number; z: number; zone: number; yaw: number; yawTolerance: number };
  /** 맨몸 요정만 막는 목적지 가구(없으면 null) */
  benchCollider: Collider | null;
  /** 저절로 닫히는 덧문·걸쇠(2장만) */
  door?: { x: number; z: number; halfGap: number; closed: Collider };
  latch?: { x: number; z: number; range: number };
  /** 쉼터 받침대(2장만) */
  stand?: { x: number; z: number; zone: number };
  /** 공간 확정 경계와, 확정 전 대기 구역의 보이지 않는 벽(2장만) */
  spaces?: { boundaryZ: number; waitWall: Collider };
}

export const SEWING_LAYOUTS: Record<SewingLayoutId, SewingLayout> = {
  ch2: {
    bounds: CH2.bounds,
    walls: CH2.walls,
    crateStart: CH2.crateStart,
    spawns: CH2.spawns,
    bench: CH2.bench,
    benchCollider: BENCH_COLLIDER,
    door: { ...CH2.door, closed: DOOR_CLOSED },
    latch: CH2.latch,
    stand: CH2.stand,
    spaces: { boundaryZ: CH2.boundaryZ, waitWall: WAIT_WALL },
  },
  ch0: {
    bounds: CH0.bounds,
    walls: CH0.walls,
    crateStart: CH0.crateStart,
    spawns: CH0.spawns,
    bench: { ...CH0.tailorZone, yaw: 0, yawTolerance: Math.PI },
    benchCollider: null,
  },
};
