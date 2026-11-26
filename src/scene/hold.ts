// 품에 안기(가벼운 선물): 두 팔을 앞으로 모아 물건을 가슴에 꼭 안는다.
// (1차: 손바닥 위에 얹어 얼굴이 파묻힘 → 2차: 가슴 아래로 내리고 팔을 크게 벌림, 큰 물건이 몸을 가려 더 어색 → 지금)
// - 물건은 몸 바로 앞, 두 손 사이(손이 옆면 위쪽을 감싼다). 윗면은 턱 높이를 넘지 않는다(얼굴이 파묻히지 않게).
// - 납작한 물건(스케치북)은 세워서 가슴에 댄다(표지가 밖, 스프링이 위).
// - 판정과 무관(보이는 자리만).
import * as THREE from 'three';
import type { GiftKind } from '../data/gifts';

/** 요정 크기 1 기준: 물건 윗면 한계(턱), 배 앞면(몸 가운데에서 앞으로), 손이 없을 때 손목 자리 */
const TOP = 0.88;
const BELLY = 0.1;
const HAND_Y = 0.74;
const HAND_FWD = 0.27;

/**
 * 선물 크기(배, 0장 요정 크기 1.2 기준): 두 팔을 앞으로 모아 안을 수 있는 폭(약 0.3~0.45 m)에 맞춘다.
 * 바닥에 놓였을 때도 같은 크기(이름표·윤곽·고리로 찾는다)
 */
const GIFT_SCALE: Record<GiftKind, number> = { sketchbook: 0.85, pencils: 1.3, ball: 0.9, repair: 0.85, sewing: 1 };
export function giftScale(kind: GiftKind, elfScale: number): number {
  return (GIFT_SCALE[kind] * elfScale) / 1.2;
}

/** 둥근 물건은 손이 닿는 높이에서 폭이 좁아 더 위쪽을 감싼다 */
const ROUND: Partial<Record<GiftKind, boolean>> = { ball: true };

export interface HoldShape {
  /** 두 손 사이 폭(m) */
  across: number;
  /** 앞뒤 두께(m) */
  depth: number;
  height: number;
  /** 세워서 안는다(납작한 물건) */
  upright: boolean;
  /** 손이 닿는 높이(물건 아래에서 높이 비율) */
  grip: number;
  /** 턱 높이와 비교할 높이(공 위 작은 리본 고리는 빼고 잰다) */
  faceH: number;
}

/** size: 물건 크기(바닥 가운데가 원점, 돌리기 전) */
export function holdShape(kind: GiftKind, size: THREE.Vector3): HoldShape {
  const upright = size.y < 0.3 * Math.min(size.x, size.z);
  const round = ROUND[kind] === true;
  if (upright) return { across: size.x, depth: size.y, height: size.z, upright, grip: 0.6, faceH: size.z };
  // 공: 두 손이 가운데 둘레(높이의 약 42%)를 감싼다
  return { across: size.x * (round ? 0.9 : 1), depth: size.z, height: size.y, upright, grip: round ? 0.42 : 0.6, faceH: size.y * (round ? 0.8 : 1) };
}

/** 물건을 둘 자리: 요정 앞 거리(가운데)와 바닥·윗면 높이. hands: 두 손목 가운데의 높이·앞 거리(없으면 기본 자세) */
export function holdPlace(hs: HoldShape, hands: { y: number; fwd: number } | null, scale: number): { ahead: number; bottom: number; top: number } {
  const hy = hands?.y ?? HAND_Y * scale;
  const hf = hands?.fwd ?? HAND_FWD * scale;
  const ahead = Math.max(hf, BELLY * scale + hs.depth / 2);
  const bottom = Math.max(0.12 * scale, Math.min(hy - hs.height * hs.grip, TOP * scale - hs.faceH));
  return { ahead, bottom, top: bottom + hs.faceH };
}

/** 물건 v를 요정(at: 자리·방향) 품에 놓는다 */
export function placeHeld(
  v: THREE.Object3D,
  hs: HoldShape,
  at: { x: number; z: number; yaw: number },
  hands: { y: number; fwd: number } | null,
  scale: number,
): { ahead: number; bottom: number; top: number } {
  const p = holdPlace(hs, hands, scale);
  const fx = Math.sin(at.yaw), fz = Math.cos(at.yaw);
  let fwd = p.ahead;
  let y = p.bottom;
  if (hs.upright) {
    // 눕힌 물건을 세운다: 바닥면(표지)이 바깥, 뒤쪽 모서리(스프링)가 위. 원점(바닥 가운데)이 바깥 면 가운데로 온다
    v.rotation.set(Math.PI / 2, at.yaw + Math.PI, 0, 'YXZ');
    fwd += hs.depth / 2;
    y += hs.height / 2;
  } else {
    v.rotation.set(0, at.yaw, 0, 'YXZ');
  }
  v.position.set(at.x + fx * fwd, y, at.z + fz * fwd);
  return p;
}

/** 바닥에 내려놓을 때 자세를 되돌린다 */
export function placeOnGround(v: THREE.Object3D, x: number, z: number): void {
  v.rotation.set(0, 0, 0, 'XYZ');
  v.position.set(x, 0, z);
}
