// 4장 앞뒤 장면의 시간표(명세서 §4 4장). 대사·글 없이 행동과 소품으로만. three.js 없음.
//
// 시작(봉투를 펼쳐 사진 두 장을 보고 내린 뒤): 눈앞에 사진 속 마당(같은 구도) → 할머니가 사진기를 삼각대에 올려 놓고
//   트리 스위치를 다시 눌러 본다 → 불이 들어오지 않자 고개를 젓고 → 아이들을 데리러 대문 밖으로 나간다.
// 끝(마지막 전구까지 켜진 뒤): 대문으로 들어오던 아이들이 트리 앞으로 달려간다 → 할머니가 사진기의 타이머를 누르고
//   돌아서는 순간, 아이들이 가운데를 한 자리 비워 준다 → 할머니가 그 자리에 서서 아이들처럼 양손으로 브이 → 찰칵 →
//   화면을 채운 올해 사진이 작년 사진과 같은 구도로 포개진다.
import type { Span } from './prologue';

export const TREE_INTRO = {
  /** 사진을 내리면 같은 구도의 마당: 할머니가 사진기를 삼각대에 올려 놓는다 */
  setCamera: [0.4, 2.2] as Span,
  /** 트리 스위치까지 걸어간다 */
  toSwitch: [2.2, 5.6] as Span,
  /** 스위치를 누른다 → 전구가 아주 잠깐 깜박였다가 꺼진다 */
  press: [5.6, 6.2] as Span,
  flicker: [6.2, 6.8] as Span,
  /** 트리를 올려다보고 고개를 젓는다 */
  shake: [6.8, 8.2] as Span,
  /** 대문 쪽으로 나간다(사진기가 대문 쪽으로 바뀐다) */
  leave: [8.4, 11.2] as Span,
  fadeOut: [10.8, 11.6] as Span,
  end: 11.6,
} as const;

export const TREE_END = {
  /** 아래 가지부터 꼭대기 별까지 */
  lights: [0.8, 4.4] as Span,
  /** 요정들은 트리 뒤로 숨는다(사진에는 할머니와 아이들만) */
  elvesHide: [0.2, 3.4] as Span,
  /** 아이들이 대문으로 들어와 트리 앞으로 달려간다 */
  kidsIn: [4.2, 7.6] as Span,
  /** 할머니가 뒤따라 들어와 사진기 앞으로 */
  grandmaIn: [5.0, 8.6] as Span,
  /** 타이머를 누른다(사진기 등이 깜박이기 시작) */
  timer: [8.6, 9.2] as Span,
  /** 돌아서는 순간 아이들이 가운데를 한 자리 비워 준다 → 할머니가 그 자리로 */
  makeRoom: [9.2, 10.2] as Span,
  toSpot: [9.2, 11.2] as Span,
  /** 모두 양손 브이 */
  vsign: [11.2, 13.0] as Span,
  /** 찰칵 */
  shutter: 12.8,
  /** 올해 사진이 화면을 채운다 → 작년 사진이 같은 구도로 포개진다 */
  photo: [13.0, 14.0] as Span,
  overlay: [15.0, 17.2] as Span,
  end: 19.0,
} as const;

export type TreeEndBeat = 'lights' | 'kids' | 'grandma' | 'timer' | 'pose' | 'photo' | 'overlay';

export function treeEndBeat(t: number): TreeEndBeat {
  const E = TREE_END;
  if (t < E.kidsIn[0]) return 'lights';
  if (t < E.grandmaIn[1]) return t < E.grandmaIn[0] ? 'kids' : 'grandma';
  if (t < E.makeRoom[0]) return 'timer';
  if (t < E.shutter) return 'pose';
  if (t < E.overlay[0]) return 'photo';
  return 'overlay';
}

/** 사진 속 자리(트리 앞 한 줄, 길 좌표 t): 아이 셋 + 가운데 빈자리(할머니) */
export const PHOTO_LINE = { s: 21.6, before: [-1.9, -0.6, 0.7] as const, after: [-2.6, -1.3, 1.35] as const, grandma: 0.05 };
