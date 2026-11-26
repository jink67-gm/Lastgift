// 3장 끝: 콩이가 민재네 식구가 되는 장면의 시간표(명세서 §4 3장 마지막 문단, §2 "바뀌면 안 되는 연출").
// 대사·글 없이 행동과 소품으로만. 감사는 요정 장갑에 볼을 한 번 꾹 비비는 동작으로. 뼈다귀는 여기서 보여 주지 않는다.
// 시각 단위: 초(끝 장면 시작 = 공을 내려놓은 순간). three.js 없음.
import { seg, type Span } from './prologue';

export const ADOPTION = {
  /** 요정들이 손을 떼고 대문 쪽으로 물러선다. 콩이는 공 둘레를 빙빙 */
  elvesBack: [0.4, 2.6] as Span,
  /** 현관문이 열리고 민재가 나와 공 앞까지 걸어온다 */
  door: [3.0, 3.7] as Span,
  minjaeOut: [3.6, 5.8] as Span,
  /** 콩이가 돌기를 멈추고 민재 쪽으로 돌아서 앞발을 쭉 뻗고(엎드려 인사) 얼굴을 올려다본다 */
  bow: [5.8, 7.4] as Span,
  lookUp: [7.0, 8.6] as Span,
  /** 민재가 쪼그려 앉아 공을 살짝 굴린다 → 콩이가 코로 밀어 돌려준다 */
  crouch: [8.4, 9.2] as Span,
  roll: [9.2, 10.4] as Span,
  nudge: [10.6, 12.0] as Span,
  /** 민재가 일어나 현관 쪽으로 손짓한다 */
  beckon: [12.2, 13.8] as Span,
  /** 식구 둘이 나와 콩이 옆에 쪼그려 앉는다(아빠가 쓰다듬는다) */
  familyOut: [13.4, 15.6] as Span,
  familyCrouch: [15.6, 16.6] as Span,
  /** 엄마가 안에서 담요를 가져와 현관 안쪽에 펴고 민재에게 물그릇을 건넨다 */
  momIn: [16.6, 17.8] as Span,
  momBack: [18.4, 19.6] as Span,
  blanket: [19.6, 20.4] as Span,
  bowlGive: [20.4, 21.2] as Span,
  /** 민재가 물그릇을 안에 놓고 문 옆에 서서 문을 잡아 준다 */
  bowlPlace: [21.2, 22.6] as Span,
  /** 콩이가 공을 코로 밀어 문 안으로 */
  ballIn: [22.8, 25.2] as Span,
  /** 민재를 따라 들어가려다 돌아서서, 떠나려는 요정에게 달려가 장갑에 볼을 한 번 꾹 비빈다 */
  turnBack: [25.4, 26.2] as Span,
  toElf: [26.2, 27.4] as Span,
  rub: [27.4, 28.8] as Span,
  /** 요정이 귀 뒤를 긁어 주자 그제야 민재에게 달려간다 */
  scratch: [28.8, 30.2] as Span,
  toMinjae: [30.2, 31.6] as Span,
  /** 민재가 한 팔로 콩이를 안고 다른 손으로 요정들에게 손을 흔든다 */
  hug: [31.4, 32.4] as Span,
  wave: [32.2, 36.0] as Span,
  end: 36.0,
} as const;

export type AdoptionBeat = 'settle' | 'minjae' | 'greet' | 'ball' | 'family' | 'blanket' | 'ballIn' | 'glove' | 'hug';

/** 시각 t의 장면 이름(시험·사진기 고르기) */
export function adoptionBeat(t: number): AdoptionBeat {
  const A = ADOPTION;
  if (t < A.door[0]) return 'settle';
  if (t < A.bow[0]) return 'minjae';
  if (t < A.crouch[0]) return 'greet';
  if (t < A.beckon[0]) return 'ball';
  if (t < A.momIn[0]) return 'family';
  if (t < A.ballIn[0]) return 'blanket';
  if (t < A.turnBack[0]) return 'ballIn';
  if (t < A.toMinjae[0]) return 'glove';
  return 'hug';
}

/** 구간 [a, b]의 진행(0~1) */
export const at = (t: number, s: Span) => seg(t, s);
