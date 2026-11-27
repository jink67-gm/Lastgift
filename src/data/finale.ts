// 5장 · 빈 양말 하나 / 6장 · 마지막 배달 — 공간(명세서 §4 5·6장, §5 5·6장). 처음의 광장(0장과 같은 곳).
// 썰매는 도토가 고쳐 바로 서 있다. 산타는 썰매 앞 오른쪽에 서 있고, 썰매 앞면에 산타 얼굴이 수놓인 빨간 양말이 기대어 있다.
// 그 옆 눈 위에 요정들의 배달 가방. 단체사진 자리는 프롤로그와 같다(core/prologue PHOTO_SPOT).
import type { Collider } from '../core/collision';
import { PLAZA_BOUNDS, PLAZA_COLLIDERS, SLEIGH } from './plaza';

/** 썰매 앞면(남쪽) z */
const SLEIGH_FRONT = SLEIGH.z + 1.4;

/** 산타 얼굴이 수놓인 빨간 양말: 썰매 앞면 왼쪽에 기대어 있다 */
export const STOCKING = { x: SLEIGH.x - 1.5, z: SLEIGH_FRONT + 0.35, r: 0.3 };
/** 요정들의 배달 가방(양말과 산타 사이 앞쪽 눈 위). 서쪽에 두면 가운데 트리 화단에 붙어 연출 사진기가 트리 가지 속에 들어간다 */
export const BAG = { x: SLEIGH.x + 0.4, z: SLEIGH_FRONT + 2.4, r: 0.35 };
/** 산타(사진을 나눠 준 뒤 썰매 앞 오른쪽에 선다) */
export const SANTA_SPOT = { x: SLEIGH.x + 2.2, z: SLEIGH_FRONT + 1.0, facing: -0.55 };
/** 스노글로브가 남는 안전 지점(들고 있던 요정이 나가면) */
export const GLOBE_SAFE = { x: BAG.x + 0.6, z: BAG.z + 0.5 };

/** 들여다보기·가방 열기·건네기 손 닿는 거리 */
export const FINALE_REACH = { stocking: 1.2, bag: 1.2, santa: 1.8, globe: 1.1 };

export const FINALE_COLLIDERS: readonly Collider[] = [
  ...PLAZA_COLLIDERS,
  { kind: 'circle', x: STOCKING.x, z: STOCKING.z, r: STOCKING.r },
  { kind: 'circle', x: SANTA_SPOT.x, z: SANTA_SPOT.z, r: 0.9 },
];
export const FINALE_BOUNDS = PLAZA_BOUNDS;
