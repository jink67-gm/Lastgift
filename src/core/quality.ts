// 그래픽 품질(three.js 없음). 설정은 자동·낮음·보통. 자동이면 실제 프레임 시간을 보고 한 번만 낮음으로 내린다.
//   - 시작 직후(장면을 불러오며 느린 2초)는 보지 않는다.
//   - 그 뒤 3초 동안의 평균 FPS가 24 아래면 낮음. 다시 올리지는 않는다(왔다 갔다 하면 화면이 번쩍인다).
// 낮음 = 실시간 그림자 끔 · 해상도 절반 · 눈송이 적게(길·표식·요정은 그대로 보인다).

export type QualitySetting = 'auto' | 'low' | 'normal';
export type Quality = 'low' | 'normal';

export const AUTO_QUALITY = {
  warmupSec: 2,
  windowSec: 3,
  minFps: 24,
};

export class AutoQuality {
  private t = 0;
  private sum = 0;
  private n = 0;
  private decided: Quality | null = null;

  /** 한 프레임의 실제 시간(초)을 넣는다. 판단이 나면 그 품질을 돌려준다(한 번만) */
  feed(frameSec: number): Quality | null {
    if (this.decided) return null;
    this.t += frameSec;
    if (this.t <= AUTO_QUALITY.warmupSec) return null;
    this.sum += frameSec;
    this.n++;
    if (this.sum < AUTO_QUALITY.windowSec) return null;
    const fps = this.n / this.sum;
    this.decided = fps < AUTO_QUALITY.minFps ? 'low' : 'normal';
    return this.decided;
  }

  get result(): Quality | null {
    return this.decided;
  }
}

/** 설정 + 자동 판단 → 지금 쓸 품질 */
export function effectiveQuality(setting: QualitySetting, auto: Quality | null): Quality {
  if (setting === 'auto') return auto ?? 'normal';
  return setting;
}

/** 품질·눈발 설정 → 눈송이 수 */
export function snowCount(q: Quality, reducedSnow: boolean): number {
  const base = q === 'low' ? 160 : 520;
  return reducedSnow ? Math.round(base * 0.3) : base;
}
