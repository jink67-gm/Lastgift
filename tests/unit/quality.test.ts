// 그래픽 품질: 자동 판단(시작 2초 뒤 3초 평균 FPS < 24면 한 번만 낮음), 설정 적용, 눈송이 수
import { describe, expect, it } from 'vitest';
import { AUTO_QUALITY, AutoQuality, effectiveQuality, snowCount } from '../../src/core/quality';

const feed = (a: AutoQuality, fps: number, sec: number) => {
  let out = null as ReturnType<AutoQuality['feed']>;
  for (let t = 0; t < sec; t += 1 / fps) out = a.feed(1 / fps) ?? out;
  return out;
};

describe('자동 품질', () => {
  it('빠른 기기는 보통으로 정해진다', () => {
    const a = new AutoQuality();
    expect(feed(a, 60, AUTO_QUALITY.warmupSec + AUTO_QUALITY.windowSec + 0.5)).toBe('normal');
  });
  it('느린 기기(15 FPS)는 낮음으로 한 번만 정해진다', () => {
    const a = new AutoQuality();
    expect(feed(a, 15, AUTO_QUALITY.warmupSec + AUTO_QUALITY.windowSec + 0.5)).toBe('low');
    expect(feed(a, 60, 10)).toBeNull(); // 다시 올리지 않는다
    expect(a.result).toBe('low');
  });
  it('시작 직후 느린 2초는 판단에 넣지 않는다', () => {
    const a = new AutoQuality();
    feed(a, 8, AUTO_QUALITY.warmupSec - 0.1);
    expect(a.result).toBeNull();
    expect(feed(a, 60, AUTO_QUALITY.windowSec + 1)).toBe('normal');
  });
});

describe('품질 설정', () => {
  it('자동은 판단 전엔 보통, 판단 뒤엔 그 결과. 낮음·보통은 그대로', () => {
    expect(effectiveQuality('auto', null)).toBe('normal');
    expect(effectiveQuality('auto', 'low')).toBe('low');
    expect(effectiveQuality('low', 'normal')).toBe('low');
    expect(effectiveQuality('normal', 'low')).toBe('normal');
  });
  it('눈발 줄이기·낮은 품질이면 눈송이가 줄어든다', () => {
    expect(snowCount('normal', false)).toBeGreaterThan(snowCount('low', false));
    expect(snowCount('normal', true)).toBeLessThan(snowCount('normal', false) / 2);
  });
});
