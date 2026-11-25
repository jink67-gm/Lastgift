// 화면 기준 입력(위·아래·좌·우)을 월드 바닥면(x, z) 방향으로 바꾼다.
// 카메라는 고정 회전 쿼터뷰이므로 이 변환은 카메라의 수평 회전값 하나로 정해진다.
// game-core와 scene이 같은 함수를 써서 "화면 위 = 화면에서 위로 가는 방향"을 보장한다.
// three.js에 의존하지 않는 순수 함수다.

export interface Vec2 {
  x: number;
  y: number;
}

/** 월드 바닥면 벡터. three.js 좌표계 기준 x = 오른쪽, z = 카메라 쪽(화면 아래). */
export interface Ground {
  x: number;
  z: number;
}

/**
 * @param screen 화면 기준 입력. x: 오른쪽 +, y: 위쪽 +. 길이는 0~1.
 * @param cameraYaw 카메라가 월드 원점을 바라보는 수평 회전(라디안). 0이면 카메라가 +z 쪽에서 -z를 본다.
 */
export function screenToGround(screen: Vec2, cameraYaw: number): Ground {
  const len = Math.hypot(screen.x, screen.y);
  if (len === 0) return { x: 0, z: 0 };
  // 입력 길이는 1을 넘지 않게 자른다(대각선 키 입력이 더 빨라지지 않게).
  const k = len > 1 ? 1 / len : 1;
  const sx = screen.x * k;
  const sy = screen.y * k;
  // yaw = 0일 때 화면 오른쪽 = +x, 화면 위 = -z.
  const cos = Math.cos(cameraYaw);
  const sin = Math.sin(cameraYaw);
  return {
    x: sx * cos - sy * sin,
    z: -sx * sin - sy * cos,
  };
}
