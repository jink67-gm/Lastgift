// 5장 연출 시간표(명세서 §4 5장). 대사·글 없이 행동과 소품으로만. three.js 없음.
//
// ① 단체사진(5장 시작): 마지막 배달을 마치고 광장으로 돌아오니 산타가 썰매 옆에서 손을 흔든다 → 산타가 사진기 타이머를
//    맞추고 요정들 옆에 선다 → 불빛이 두 번, 세 번 깜박 → 장화 앞을 스치는 꼬리 하나 → 다 같이 고개를 숙이는 순간 찰칵
//    (프롤로그 첫 사진과 같은 구도·같은 순간) → 산타가 사진을 한 장씩 나눠 준다(모두 발끝을 보고 있다) → 썰매로 돌아간다.
// ② 가방 열기(5장 끝): 한 요정이 산타 쪽을 살피는 동안 다른 요정이 배달 가방을 끌어당겨 연다 → 스케치북 한 권이 빛으로
//    그려지고 책장이 팔랑 → 작은 재봉틀, 축구공, 꼭대기에 별을 단 트리 모양의 빛이 차례로 → 네 빛이 손 위에서 둥글게 포개짐 →
//    손바닥에 작은 스노글로브(유리 안에 눈, 눈발 사이로 유나가 스케치북을 펴는 모습) → 한 요정이 두 손으로 받쳐 들고, 친구가
//    빨간 양말을 살짝 들어 보인다 → 나란히 산타에게 다가간다(6장: 건네기는 직접).
// 선물 모양의 빛은 여기서 처음 보인다(명세서 §2). 뼈다귀는 보이지 않는다(6장 끝).
import type { Span } from './prologue';

export const CH5_PHOTO = {
  /** 요정들이 광장으로 돌아와 사진 자리로, 산타가 썰매 옆에서 손을 흔든다 */
  arrive: [0, 3.2] as Span,
  wave: [0.6, 3.0] as Span,
  /** 산타가 사진기로 가서 타이머를 맞춘다 */
  toCamera: [3.2, 5.0] as Span,
  setTimer: [5.0, 5.6] as Span,
  /** 요정들 옆 자기 자리로 */
  back: [5.6, 7.4] as Span,
  /** 예약 셔터 깜박임(두 번, 세 번) */
  blinks: [7.8, 8.5, 9.0] as const,
  /** 장화 앞을 스치는 꼬리 */
  tail: [8.9, 9.65] as Span,
  /** 다 같이 고개를 숙인다 */
  lookDown: [9.05, 9.45] as Span,
  shutter: 9.85,
  /** 사진 카드(모두 발끝을 보고 있다) */
  card: [10.3, 13.2] as Span,
  /** 산타가 한 장씩 나눠 준다 */
  handout: [10.4, 14.2] as Span,
  /** 썰매로 돌아간다 */
  toSleigh: [14.2, 16.0] as Span,
  end: 16.4,
} as const;

export const CH5_LIGHTS = {
  /** 한 요정은 산타 쪽을 살피고, 다른 요정은 가방을 끌어당긴다 */
  pull: [0, 1.4] as Span,
  /** 덮개가 열리고 안에서 빛이 샌다 */
  open: [1.4, 2.2] as Span,
  /** 선물 모양의 빛이 차례로 그려지며 떠오른다(스케치북은 책장이 팔랑) */
  sketchbook: [2.2, 4.8] as Span,
  sewing: [4.3, 6.5] as Span,
  ball: [6.0, 8.2] as Span,
  tree: [7.7, 10.0] as Span,
  /** 네 빛이 손 위에서 둥글게 돌며 포개진다 */
  merge: [10.4, 12.8] as Span,
  /** 빛이 잦아들고 손바닥에 스노글로브 */
  globe: [12.6, 13.6] as Span,
  /** 유리 안 눈발 사이로 유나가 스케치북을 편다 */
  glimpse: [13.8, 16.2] as Span,
  /** 한 요정은 스노글로브를 받쳐 들고, 친구는 빨간 양말을 살짝 들어 보인다 */
  stocking: [16.2, 17.8] as Span,
  /** 나란히 산타에게 다가간다 */
  approach: [17.8, 20.0] as Span,
  end: 20.4,
} as const;

/** 예약 셔터 불빛이 켜져 있는가(깜박임마다 0.2초) */
export function ch5BlinkOn(t: number): boolean {
  return CH5_PHOTO.blinks.some((b) => t >= b && t < b + 0.2);
}

export type LightsBeat = 'pull' | 'open' | 'gifts' | 'merge' | 'globe' | 'glimpse' | 'stocking' | 'approach' | 'done';
export function lightsBeat(t: number): LightsBeat {
  const L = CH5_LIGHTS;
  if (t >= L.end) return 'done';
  if (t < L.open[0]) return 'pull';
  if (t < L.sketchbook[0]) return 'open';
  if (t < L.merge[0]) return 'gifts';
  if (t < L.globe[0]) return 'merge';
  if (t < L.glimpse[0]) return 'globe';
  if (t < L.stocking[0]) return 'glimpse';
  if (t < L.approach[0]) return 'stocking';
  return 'approach';
}

// ③ 6장 끝(명세서 §4 6장): 요정들이 스노글로브를 산타 손에 직접 건넨다 → 산타가 유리 안을 들여다보면 기억이 차례로 비친다
//    (유나의 고래 꼬리 → 수선집 창가의 빨간 코트 → 콩이와 민재 → 트리 앞 할머니의 브이 → 콩이가 요정 장갑에 볼을 비비고 돌아와
//    민재 무릎에 턱을 괴면 눈이 잦아든다) → 산타가 스노글로브를 썰매 앞자리에 내려놓고 손을 떼는 순간 받침 위 하얀 뼈다귀가
//    처음 보인다 → 요정 하나가 제 장갑의 볼 닿았던 자리를 엄지로 쓸며 웃는다. 다시 보기·건너뛰기는 결과를 바꾸지 않는다.
export const CH6_END = {
  give: [0, 1.6] as Span,
  look: [1.6, 3.4] as Span,
  /** 유리 안 기억 다섯(파일 이름은 docs/VIDEO_PROMPTS.md와 같다) */
  memories: [
    { id: 'yuna', file: 'ch6-memory-1-yuna.mp4', span: [3.4, 8.6] as Span },
    { id: 'tailor', file: 'ch6-memory-2-tailor.mp4', span: [8.6, 13.8] as Span },
    { id: 'kongi', file: 'ch6-memory-3-kongi.mp4', span: [13.8, 19.0] as Span },
    { id: 'tree', file: 'ch6-memory-4-tree.mp4', span: [19.0, 24.2] as Span },
    { id: 'glove', file: 'ch6-memory-5-glove.mp4', span: [24.2, 30.4] as Span },
  ],
  /** 눈이 잦아들고 다시 산타 */
  settle: [30.4, 31.6] as Span,
  /** 썰매 앞자리에 내려놓는다 → 손을 떼는 순간 뼈다귀 */
  place: [31.6, 34.0] as Span,
  boneReveal: 33.6,
  bone: [34.0, 36.6] as Span,
  /** 요정이 장갑의 볼 닿았던 자리를 엄지로 쓸며 웃는다 */
  thumb: [36.6, 40.0] as Span,
  end: 41.0,
} as const;

export type EndingBeat = 'give' | 'look' | `memory:${string}` | 'settle' | 'place' | 'bone' | 'thumb' | 'done';
export function endingBeat(t: number): EndingBeat {
  const E = CH6_END;
  if (t >= E.end) return 'done';
  if (t < E.look[0]) return 'give';
  if (t < E.memories[0]!.span[0]) return 'look';
  for (const m of E.memories) if (t < m.span[1]) return `memory:${m.id}`;
  if (t < E.place[0]) return 'settle';
  if (t < E.bone[0]) return 'place';
  if (t < E.thumb[0]) return 'bone';
  return 'thumb';
}
