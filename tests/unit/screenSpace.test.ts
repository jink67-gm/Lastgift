import { describe, expect, it } from 'vitest';
import { groundToScreen, screenToGround } from '../../src/core/screenSpace';

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('screenToGround: 화면 기준 방향을 바닥 방향으로', () => {
  it('입력이 없으면 멈춘다', () => {
    expect(screenToGround({ x: 0, y: 0 }, 0)).toEqual({ x: 0, z: 0 });
  });

  it('카메라 회전 0: 화면 위 = -z, 화면 오른쪽 = +x', () => {
    const up = screenToGround({ x: 0, y: 1 }, 0);
    close(up.x, 0);
    close(up.z, -1);
    const right = screenToGround({ x: 1, y: 0 }, 0);
    close(right.x, 1);
    close(right.z, 0);
  });

  it('쿼터뷰 45°: 화면 위는 카메라에서 멀어지는 방향', () => {
    const yaw = Math.PI / 4;
    const up = screenToGround({ x: 0, y: 1 }, yaw);
    // 카메라 위치 방향(sin, cos)의 반대
    close(up.x, -Math.sin(yaw));
    close(up.z, -Math.cos(yaw));
  });

  it('대각선 입력도 속도 1을 넘지 않는다', () => {
    const d = screenToGround({ x: 1, y: 1 }, Math.PI / 4);
    close(Math.hypot(d.x, d.z), 1);
  });

  it('스틱을 반만 밀면 반 속도', () => {
    const d = screenToGround({ x: 0.5, y: 0 }, 1.1);
    close(Math.hypot(d.x, d.z), 0.5);
  });
});

describe('groundToScreen', () => {
  it('screenToGround를 되돌린다', () => {
    for (const s of [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -0.6, y: 0.8 }]) {
      const g = screenToGround(s, Math.PI / 4);
      const back = groundToScreen(g, Math.PI / 4);
      expect(back.x).toBeCloseTo(s.x, 6);
      expect(back.y).toBeCloseTo(s.y, 6);
    }
  });
});
