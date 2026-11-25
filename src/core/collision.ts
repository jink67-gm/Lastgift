// 바닥면 단순 충돌: 원(요정) 대 사각형·원(소품). 벽에 부딪히면 벽을 따라 미끄러진다.
// three.js에 의존하지 않는다.
import type { Ground } from './screenSpace';

export interface BoxCollider {
  kind: 'box';
  /** 중심 */
  x: number;
  z: number;
  /** 반 너비(x)·반 깊이(z) */
  hx: number;
  hz: number;
}

export interface CircleCollider {
  kind: 'circle';
  x: number;
  z: number;
  r: number;
}

export type Collider = BoxCollider | CircleCollider;

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** 원이 충돌체와 겹친 만큼 밀어낼 벡터. 겹치지 않으면 null. */
function pushOut(p: Ground, radius: number, c: Collider): Ground | null {
  if (c.kind === 'circle') {
    const dx = p.x - c.x;
    const dz = p.z - c.z;
    const d = Math.hypot(dx, dz);
    const min = radius + c.r;
    if (d >= min) return null;
    if (d === 0) return { x: min, z: 0 };
    const k = (min - d) / d;
    return { x: dx * k, z: dz * k };
  }
  const cx = Math.max(c.x - c.hx, Math.min(p.x, c.x + c.hx));
  const cz = Math.max(c.z - c.hz, Math.min(p.z, c.z + c.hz));
  const dx = p.x - cx;
  const dz = p.z - cz;
  const d = Math.hypot(dx, dz);
  if (d > 0) {
    if (d >= radius) return null;
    const k = (radius - d) / d;
    return { x: dx * k, z: dz * k };
  }
  // 중심이 사각형 안에 들어온 경우: 가장 가까운 변 밖으로 꺼낸다.
  const left = p.x - (c.x - c.hx);
  const right = c.x + c.hx - p.x;
  const back = p.z - (c.z - c.hz);
  const front = c.z + c.hz - p.z;
  const m = Math.min(left, right, back, front);
  if (m === left) return { x: -(left + radius), z: 0 };
  if (m === right) return { x: right + radius, z: 0 };
  if (m === back) return { x: 0, z: -(back + radius) };
  return { x: 0, z: front + radius };
}

export function overlaps(p: Ground, radius: number, c: Collider): boolean {
  return pushOut(p, radius, c) !== null;
}

function clampToBounds(p: Ground, radius: number, b: Bounds): Ground {
  return {
    x: Math.max(b.minX + radius, Math.min(b.maxX - radius, p.x)),
    z: Math.max(b.minZ + radius, Math.min(b.maxZ - radius, p.z)),
  };
}

/**
 * 원을 delta만큼 옮기고 충돌을 풀어 최종 위치를 돌려준다.
 * 한 번에 반지름의 절반 이상 움직이지 않도록 쪼개서 얇은 충돌체를 뚫지 않게 한다.
 */
export function moveCircle(
  from: Ground,
  delta: Ground,
  radius: number,
  colliders: readonly Collider[],
  bounds: Bounds,
): Ground {
  const dist = Math.hypot(delta.x, delta.z);
  const steps = Math.max(1, Math.ceil(dist / (radius * 0.5)));
  let p = { ...from };
  for (let s = 0; s < steps; s++) {
    p = { x: p.x + delta.x / steps, z: p.z + delta.z / steps };
    for (let iter = 0; iter < 4; iter++) {
      let moved = false;
      for (const c of colliders) {
        const push = pushOut(p, radius, c);
        if (push) {
          p = { x: p.x + push.x, z: p.z + push.z };
          moved = true;
        }
      }
      p = clampToBounds(p, radius, bounds);
      if (!moved) break;
    }
  }
  return p;
}
