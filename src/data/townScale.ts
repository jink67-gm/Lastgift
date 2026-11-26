// 사람 마을의 치수: 모두 "요정 하나의 키"를 기준으로 잡는다.
// 요정 키 = 발바닥 ~ 정수리(길게 휜 모자는 빼고) = 게임 단위 1.1(src/scene/miniElf.ts BODY_HEIGHT, 실제 장면에서 재어 확인).
// 명세서·코드에 사람 물건의 확정 치수가 없어 이번 시안에서는 요정 키를 약 45 cm로 가정한다(게임 1단위 ≈ 41 cm).
// 사람이 쓰는 집·벤치·가로등·울타리·우편함은 이 기준을 함께 쓴다. 산타·썰매·선물·요정 장비·그림 표식은 물건마다 따로 정한다.

/** 요정 키(게임 단위) */
export const ELF_H = 1.1;

export const TOWN = {
  /** 사람용 벤치 앉는 면: 요정의 어깨 ~ 정수리 사이(요정이 앉으려면 기어올라야 한다) */
  benchSeat: 0.9 * ELF_H,
  /** 벤치 전체 폭: 요정 키의 3~4배 */
  benchWidth: 3.6 * ELF_H,
  /** 현관문 열린 부분 높이: 요정 키의 4.5배 */
  doorOpening: 4.5 * ELF_H,
  /** 문손잡이 높이: 요정 키의 2배(요정 머리보다 확실히 높다) */
  doorKnob: 2 * ELF_H,
  /** 가로등: 눈 바닥 ~ 등불 가운데, 요정 키의 7배 */
  lampLight: 7 * ELF_H,
  /** 가로등 기둥 굵기(지름). 키와 따로 정해 전봇대처럼 두꺼워지지 않게 */
  lampPoleDiameter: 0.2 * ELF_H,
  /** 사람 무릎~허리 높이의 낮은 울타리 */
  fence: 1.6 * ELF_H,
  /** 사람 우편함(받침 포함) */
  mailbox: 2.7 * ELF_H,
};

/** Kenney 통나무집: 문 열린 부분이 0.8단위(모델에서 잼) → 사람 문 높이에 맞춘 배율 */
export const KENNEY_HOUSE_SCALE = TOWN.doorOpening / 0.8;
/** Tiny Treats 집: 문 높이 2.5단위(모델에서 잼) */
export const TT_HOUSE_SCALE = TOWN.doorOpening / 2.5;
/** Kenney 벤치(폭 1.12, 앉는 면 0.43단위): 폭과 높이를 따로 맞춘다 */
export const BENCH_SCALE = { x: TOWN.benchWidth / 1.12, y: TOWN.benchSeat / 0.43, z: TOWN.benchSeat / 0.43 };
/** Tiny Treats 울타리(높이 1.28단위) */
export const FENCE_SCALE = TOWN.fence / 1.28;
/** Tiny Treats 우편함(높이 2.1단위) */
export const MAILBOX_SCALE = TOWN.mailbox / 2.1;
