// 공유 구도(연출 가이드 §5): 두 요정이 늘 화면 안, 목적지 쪽으로 앞세움, 작은 흔들림은 무시.
import { describe, expect, it } from 'vitest';
import { baseViewH, deadZone, frameFor, FRAMING, screenAxes } from '../../src/core/framing';

const YAW = Math.PI / 4;
const PITCH = Math.atan(1 / Math.SQRT2);

/** 정사영 화면 안에 들어오는지(땅 기준 좌표 → 화면 좌표) */
function inside(f: { x: number; z: number; viewH: number }, p: { x: number; z: number }, aspect: number) {
  const { right, away } = screenAxes(YAW);
  const sx = (p.x - f.x) * right.x + (p.z - f.z) * right.z;
  const sy = ((p.x - f.x) * away.x + (p.z - f.z) * away.z) * Math.sin(PITCH);
  return Math.abs(sx) < (f.viewH * aspect) / 2 && Math.abs(sy) < f.viewH / 2;
}

describe('공유 구도', () => {
  it('가까이 있으면 기본 거리로 다가가 있다', () => {
    const f = frameFor([{ x: 0, z: 0 }, { x: 1, z: 0 }], null, 16 / 9, YAW, PITCH);
    expect(f.viewH).toBeCloseTo(FRAMING.baseH);
  });

  it('멀어지면 넓혀서 두 요정이 모두 화면 안에 있다(가로·세로 화면)', () => {
    for (const [aspect, ps] of [
      [16 / 9, [{ x: -6, z: 3 }, { x: 5, z: -4 }]],
      [1180 / 820, [{ x: -6, z: 3 }, { x: 5, z: -4 }]],
      [390 / 844, [{ x: -3, z: 3 }, { x: 3, z: -3 }]], // 세로 폰: 폭이 좁아 가까운 거리까지만
    ] as const) {
      const f = frameFor(ps, null, aspect, YAW, PITCH);
      expect(f.viewH).toBeGreaterThan(baseViewH(aspect) - 1e-9);
      for (const p of ps) expect(inside(f, p, aspect)).toBe(true);
    }
  });

  it('아주 멀어져도 상한 이상 넓히지 않는다(요정이 점처럼 작아지지 않게)', () => {
    const f = frameFor([{ x: -18, z: 12 }, { x: 18, z: -12 }], null, 16 / 9, YAW, PITCH);
    expect(f.viewH).toBeCloseTo(FRAMING.maxH);
  });

  it('목적지 쪽으로 화면 중심을 앞세우되 최대 거리를 넘지 않는다', () => {
    const f = frameFor([{ x: 0, z: 0 }], { x: 20, z: 0 }, 16 / 9, YAW, PITCH);
    expect(f.x).toBeCloseTo(FRAMING.leadMax);
    const g = frameFor([{ x: 0, z: 0 }], { x: 4, z: 0 }, 16 / 9, YAW, PITCH);
    expect(g.x).toBeCloseTo(4 * FRAMING.lead);
  });

  it('여유 영역 안의 작은 움직임에는 따라가지 않고, 밖이면 경계까지만 끌려간다', () => {
    expect(deadZone({ x: 0, z: 0 }, { x: 0.5, z: 0 })).toEqual({ x: 0, z: 0 });
    const d = deadZone({ x: 0, z: 0 }, { x: 3, z: 0 });
    expect(d.x).toBeCloseTo(3 - FRAMING.dead);
  });
});
