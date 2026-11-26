// 공유 구도 계산(three.js 없음). 연출 가이드(LAST_GIFT_SCENE_DIRECTION.md §5):
// - 두 요정이 늘 함께 보이게 화면 높이(정사영 viewH)를 넓히고 좁힌다. 가까우면 다가가 행동이 보이게.
// - 들고 가는 짐의 목적지 쪽으로 화면 중심을 조금 앞세워 다음 목표가 미리 보이게 한다.
// - 작은 흔들림(손잡이 교대, 제자리 돌기)에는 카메라가 따라가지 않도록 여유 영역을 둔다.
// 카메라의 yaw·pitch는 바꾸지 않는다(같은 키를 누르면 늘 같은 화면 방향으로 간다).

export interface Pt {
  x: number;
  z: number;
}

export interface Framing {
  x: number;
  z: number;
  viewH: number;
}

export const FRAMING = {
  /** 가로 화면에서 기본 화면 높이(m). 요정 1.1 m가 화면 높이의 약 1/9 */
  baseH: 9.5,
  /** 세로 화면에서 최소로 보여 줄 폭(m) */
  minWidth: 8,
  /** 두 요정이 멀어져도 이보다 넓히지 않는다(그 이상은 요정이 점처럼 작아진다) */
  maxH: 15,
  /** 화면 가장자리와 요정 사이 여백(m, 땅 기준) */
  margin: 2.4,
  /** 목적지 쪽으로 앞세우는 비율과 최대 거리 */
  lead: 0.3,
  leadMax: 3.5,
  /** 이 안의 움직임은 카메라가 따라가지 않는다(m) */
  dead: 0.8,
};

/** 화면 오른쪽·화면 위쪽(땅 위 먼 쪽)의 땅 기준 단위 벡터 */
export function screenAxes(yaw: number): { right: Pt; away: Pt } {
  return { right: { x: Math.cos(yaw), z: -Math.sin(yaw) }, away: { x: -Math.sin(yaw), z: -Math.cos(yaw) } };
}

export function baseViewH(aspect: number): number {
  return Math.max(FRAMING.baseH, FRAMING.minWidth / Math.max(aspect, 0.3));
}

/** 요정들(과 다음 목표)을 담는 구도 */
export function frameFor(players: readonly Pt[], goal: Pt | null, aspect: number, yaw: number, pitch: number): Framing {
  const n = Math.max(players.length, 1);
  let x = players.reduce((a, p) => a + p.x, 0) / n;
  let z = players.reduce((a, p) => a + p.z, 0) / n;
  if (goal) {
    const dx = goal.x - x, dz = goal.z - z, d = Math.hypot(dx, dz);
    const k = d > 0 ? Math.min(d * FRAMING.lead, FRAMING.leadMax) / d : 0;
    x += dx * k;
    z += dz * k;
  }
  const { right, away } = screenAxes(yaw);
  const sp = Math.sin(pitch);
  let needH = baseViewH(aspect);
  for (const p of players) {
    const sx = Math.abs((p.x - x) * right.x + (p.z - z) * right.z) + FRAMING.margin;
    const sy = Math.abs((p.x - x) * away.x + (p.z - z) * away.z) * sp + FRAMING.margin * sp + 0.9; // 0.9: 모자 끝까지
    needH = Math.max(needH, 2 * sy, (2 * sx) / aspect);
  }
  const maxH = Math.max(FRAMING.maxH, baseViewH(aspect) * 1.4);
  return { x, z, viewH: Math.min(needH, maxH) };
}

/** 여유 영역: 목표 중심이 지금 중심에서 dead 안이면 그대로, 밖이면 경계까지만 끌려간다 */
export function deadZone(cur: Pt, want: Pt, dead = FRAMING.dead): Pt {
  const dx = want.x - cur.x, dz = want.z - cur.z, d = Math.hypot(dx, dz);
  if (d <= dead) return { x: cur.x, z: cur.z };
  const k = (d - dead) / d;
  return { x: cur.x + dx * k, z: cur.z + dz * k };
}
