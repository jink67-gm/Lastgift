import { describe, expect, it } from 'vitest';
import { moveCircle, overlaps, type Bounds, type Collider } from '../../src/core/collision';
import { ELF_RADIUS, ELF_SPEED, stepPlayer, type PlayerState, type World } from '../../src/core/player';
import { ELF_SPAWN, PLAZA_BOUNDS, PLAZA_COLLIDERS } from '../../src/data/plaza';

const BIG: Bounds = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };
const wall: Collider = { kind: 'box', x: 0, z: 0, hx: 1, hz: 3 };

describe('moveCircle: 충돌과 미끄러짐', () => {
  it('벽으로 곧장 걸어가면 벽 앞에서 멈춘다', () => {
    const p = moveCircle({ x: -3, z: 0 }, { x: 5, z: 0 }, 0.35, [wall], BIG);
    expect(p.x).toBeCloseTo(-1.35, 3);
    expect(overlaps(p, 0.349, wall)).toBe(false);
  });

  it('비스듬히 부딪히면 벽을 따라 미끄러진다', () => {
    const p = moveCircle({ x: -1.4, z: 0 }, { x: 1, z: 1 }, 0.35, [wall], BIG);
    expect(p.x).toBeCloseTo(-1.35, 3);
    expect(p.z).toBeCloseTo(1, 3);
  });

  it('한 틱에 크게 움직여도 얇은 기둥을 뚫지 못한다', () => {
    const pole: Collider = { kind: 'circle', x: 0, z: 0, r: 0.1 };
    const p = moveCircle({ x: -2, z: 0 }, { x: 4, z: 0 }, 0.35, [pole], BIG);
    expect(p.x).toBeLessThan(0);
  });

  it('광장 경계 밖으로 나가지 않는다', () => {
    const b: Bounds = { minX: -5, maxX: 5, minZ: -5, maxZ: 5 };
    const p = moveCircle({ x: 0, z: 0 }, { x: 20, z: -20 }, 0.35, [], b);
    expect(p).toEqual({ x: 4.65, z: -4.65 });
  });
});

describe('stepPlayer: 요정 이동', () => {
  const world: World = { colliders: [], bounds: BIG, cameraYaw: 0 };
  const start: PlayerState = { x: 0, z: 0, facing: 0, moving: false };

  it('1초 동안 ELF_SPEED만큼 간다', () => {
    let p = start;
    for (let i = 0; i < 60; i++) p = stepPlayer(p, { x: 1, y: 0 }, 1 / 60, world);
    expect(p.x).toBeCloseTo(ELF_SPEED, 5);
    expect(p.moving).toBe(true);
  });

  it('입력을 놓으면 멈추고 바라보던 방향은 유지한다', () => {
    let p = stepPlayer(start, { x: 1, y: 0 }, 1 / 60, world);
    const facing = p.facing;
    p = stepPlayer(p, { x: 0, y: 0 }, 1 / 60, world);
    expect(p.moving).toBe(false);
    expect(p.facing).toBe(facing);
  });
});

describe('광장 배치', () => {
  it('요정 시작 위치는 어떤 소품과도 겹치지 않는다', () => {
    expect(PLAZA_COLLIDERS.some((c) => overlaps(ELF_SPAWN, ELF_RADIUS, c))).toBe(false);
  });

  it('소품은 모두 광장 안에 있다', () => {
    for (const c of PLAZA_COLLIDERS) {
      expect(c.x).toBeGreaterThanOrEqual(PLAZA_BOUNDS.minX);
      expect(c.x).toBeLessThanOrEqual(PLAZA_BOUNDS.maxX);
      expect(c.z).toBeGreaterThanOrEqual(PLAZA_BOUNDS.minZ);
      expect(c.z).toBeLessThanOrEqual(PLAZA_BOUNDS.maxZ);
    }
  });
});
