// 요정 한 명의 이동 규칙. 화면 기준 의도 → 바닥 방향 → 충돌 처리.
import { moveCircle, type Bounds, type Collider } from './collision';
import { screenToGround } from './screenSpace';

export const ELF_RADIUS = 0.35; // m
export const ELF_SPEED = 3.6; // m/s, 광장 30 m를 약 8초에 가로지른다

export interface PlayerState {
  x: number;
  z: number;
  /** 바라보는 방향(라디안). 0이면 +z(화면 아래쪽 카메라 방향)를 본다. */
  facing: number;
  /** 이번 틱에 움직였는지(걷기 애니메이션용) */
  moving: boolean;
}

export interface World {
  colliders: readonly Collider[];
  bounds: Bounds;
  cameraYaw: number;
}

export function stepPlayer(
  p: PlayerState,
  move: { x: number; y: number },
  dtSec: number,
  world: World,
): PlayerState {
  const dir = screenToGround(move, world.cameraYaw);
  const speed = Math.hypot(dir.x, dir.z);
  if (speed === 0) return p.moving ? { ...p, moving: false } : p;
  const next = moveCircle(
    { x: p.x, z: p.z },
    { x: dir.x * ELF_SPEED * dtSec, z: dir.z * ELF_SPEED * dtSec },
    ELF_RADIUS,
    world.colliders,
    world.bounds,
  );
  return { x: next.x, z: next.z, facing: Math.atan2(dir.x, dir.z), moving: true };
}
