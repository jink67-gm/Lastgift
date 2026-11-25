// 입력 장치와 무관한 한 프레임의 플레이어 의도.
// 키보드와 터치가 모두 이 형태를 만들고, 게임 규칙은 어느 장치에서 왔는지 모른다.

export interface Intent {
  /** 화면 기준 이동. x: 오른쪽 +, y: 위쪽 +. 길이 0~1. */
  move: { x: number; y: number };
  /** 행동(E 키 · 행동 버튼) */
  action: {
    /** 이번 샘플에서 새로 눌렸다(한 번만 참이 된다) */
    down: boolean;
    /** 누르고 있는 중 */
    held: boolean;
    /** 이번 샘플에서 떼어졌다 */
    up: boolean;
  };
}

export const IDLE_INTENT: Intent = Object.freeze({
  move: Object.freeze({ x: 0, y: 0 }),
  action: Object.freeze({ down: false, held: false, up: false }),
}) as Intent;
