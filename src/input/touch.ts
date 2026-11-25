// 터치 → Intent.
// 포인터 ID별로 스틱과 행동 버튼을 따로 추적해 두 손가락을 동시에 쓸 수 있다.
// 손가락을 떼거나(pointerup), 취소되거나(pointercancel), 화면이 바뀌면 그 입력만 해제한다.
import type { Intent } from './intent';

export const STICK_RADIUS = 56; // px. 이만큼 끌면 최고 속도
export const STICK_DEADZONE = 0.15;

interface StickTouch {
  id: number;
  ox: number;
  oy: number;
  x: number;
  y: number;
}

/** DOM에 의존하지 않는 터치 상태. 좌표는 CSS px(화면 아래가 +y). */
export class TouchState {
  private stick: StickTouch | null = null;
  private readonly actionIds = new Set<number>();
  private actionDown = false;
  private actionUp = false;

  /** 스틱 영역에 손가락이 닿았다. 이미 스틱을 쓰는 손가락이 있으면 무시한다. */
  stickStart(id: number, x: number, y: number): boolean {
    if (this.stick) return false;
    this.stick = { id, ox: x, oy: y, x, y };
    return true;
  }

  move(id: number, x: number, y: number): void {
    if (this.stick?.id === id) {
      this.stick.x = x;
      this.stick.y = y;
    }
  }

  /** 행동 버튼에 손가락이 닿았다. 다른 손가락이 이미 누르고 있으면 새 입력으로 치지 않는다. */
  actionStart(id: number): void {
    if (this.actionIds.size === 0) this.actionDown = true;
    this.actionIds.add(id);
  }

  /** 손가락을 뗐거나 취소됐다. 어느 쪽 손가락인지 상관없이 그 손가락만 해제한다. */
  end(id: number): void {
    if (this.stick?.id === id) this.stick = null;
    if (this.actionIds.delete(id) && this.actionIds.size === 0) this.actionUp = true;
  }

  clear(): void {
    this.stick = null;
    if (this.actionIds.size > 0) this.actionUp = true;
    this.actionIds.clear();
    this.actionDown = false;
  }

  /** 스틱 손잡이의 화면 위치(그리기용). 스틱을 안 쓰면 null */
  stickView(): { ox: number; oy: number; kx: number; ky: number } | null {
    if (!this.stick) return null;
    const { ox, oy, x, y } = this.stick;
    const dx = x - ox;
    const dy = y - oy;
    const d = Math.hypot(dx, dy);
    const k = d > STICK_RADIUS ? STICK_RADIUS / d : 1;
    return { ox, oy, kx: ox + dx * k, ky: oy + dy * k };
  }

  get actionHeld(): boolean {
    return this.actionIds.size > 0;
  }

  get usingStick(): boolean {
    return this.stick !== null;
  }

  sample(): Intent {
    let mx = 0;
    let my = 0;
    if (this.stick) {
      const dx = (this.stick.x - this.stick.ox) / STICK_RADIUS;
      const dy = (this.stick.y - this.stick.oy) / STICK_RADIUS;
      const len = Math.hypot(dx, dy);
      if (len > STICK_DEADZONE) {
        const mag = Math.min(1, (len - STICK_DEADZONE) / (1 - STICK_DEADZONE));
        mx = (dx / len) * mag;
        my = (-dy / len) * mag; // 화면 위로 끌면 +y
      }
    }
    const intent: Intent = {
      move: { x: mx, y: my },
      action: { down: this.actionDown, held: this.actionIds.size > 0, up: this.actionUp },
    };
    this.actionDown = false;
    this.actionUp = false;
    return intent;
  }
}
