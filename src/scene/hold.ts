// 품에 안기(가벼운 선물): 물건을 가슴 아래에 품고, 두 손이 물건 옆면을 잡는다.
// - 물건 윗면은 턱 높이를 크게 넘지 않게 낮춘다(얼굴이 물건에 파묻히지 않게).
// - 가로가 긴 물건은 90° 돌려 좁은 쪽을 잡는다. 둥근 물건은 손이 닿는 높이의 폭이 더 좁다.
// - 몸과 겹치지 않게 배 앞에 둔다. 판정과 무관(보이는 자리만).
import * as THREE from 'three';
import type { GiftKind } from '../data/gifts';

/** 요정 크기 1 기준: 턱 높이, 배 앞면(몸 가운데에서 앞으로), 손이 없을 때 손목 자리 */
const CHIN = 0.86;
const BELLY = 0.1;
const HAND_Y = 0.7;
const HAND_FWD = 0.22;

const ROUND: Partial<Record<GiftKind, boolean>> = { ball: true };

export interface HoldShape {
  /** 두 손 사이 폭(m) */
  across: number;
  /** 앞뒤 길이(m) */
  depth: number;
  height: number;
  /** 요정 방향에서 90° 돌려 잡는다 */
  turn: boolean;
  /** 손이 닿는 높이(물건 높이 비율) */
  grip: number;
}

/** size: 물건 크기(바닥 가운데가 원점, 돌리기 전) */
export function holdShape(kind: GiftKind, size: THREE.Vector3): HoldShape {
  const turn = size.x > 0.6 && size.x > size.z + 0.1;
  const round = ROUND[kind] === true;
  return { across: (turn ? size.z : size.x) * (round ? 0.85 : 1), depth: turn ? size.x : size.z, height: size.y, turn, grip: round ? 0.6 : 0.45 };
}

/**
 * 물건을 둘 자리. hands: 두 손목 가운데의 높이와 앞 거리(요정 기준, 없으면 기본 자세 값). scale: 요정 크기.
 * 돌려주는 값: 요정 앞 거리(ahead)와 물건 바닥 높이(bottom)
 */
export function holdPlace(hs: HoldShape, hands: { y: number; fwd: number } | null, scale: number): { ahead: number; bottom: number } {
  const hy = hands?.y ?? HAND_Y * scale;
  const hf = hands?.fwd ?? HAND_FWD * scale;
  const ahead = Math.max(hf, BELLY * scale + hs.depth / 2);
  const bottom = Math.max(0.12 * scale, Math.min(hy - hs.height * hs.grip, (CHIN + 0.07) * scale - hs.height));
  return { ahead, bottom };
}
