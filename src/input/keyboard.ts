// 키보드 → Intent.
// 키는 event.code(물리 키 위치)로 판정한다. 웨일북·크롬북에서 한글 입력 상태여도
// W 자리 키는 code가 'KeyW'이므로 그대로 동작한다(event.key는 'ㅈ'이나 'Process'가 된다).
import type { Intent } from './intent';

const UP = new Set(['KeyW', 'ArrowUp']);
const DOWN = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const ACTION = new Set(['KeyE']);

/** 게임이 쓰는 키. 이 키들은 페이지 스크롤 같은 기본 동작을 막는다. */
export const GAME_KEYS: ReadonlySet<string> = new Set([...UP, ...DOWN, ...LEFT, ...RIGHT, ...ACTION]);

/** DOM에 의존하지 않는 키 상태. 단위 테스트에서 직접 쓴다. */
export class KeyState {
  private readonly pressed = new Set<string>();
  private actionDown = false;
  private actionUp = false;

  keydown(code: string, repeat = false): void {
    if (!GAME_KEYS.has(code)) return;
    // 길게 누를 때 브라우저가 보내는 반복 keydown은 새 입력으로 치지 않는다.
    if (repeat || this.pressed.has(code)) return;
    this.pressed.add(code);
    if (ACTION.has(code)) this.actionDown = true;
  }

  keyup(code: string): void {
    if (!this.pressed.delete(code)) return;
    if (ACTION.has(code)) this.actionUp = true;
  }

  /** 창 전환·탭 숨김 등으로 keyup을 못 받을 때 눌린 키가 남지 않게 모두 해제한다. */
  clear(): void {
    const hadAction = [...this.pressed].some((c) => ACTION.has(c));
    this.pressed.clear();
    this.actionDown = false;
    if (hadAction) this.actionUp = true;
  }

  /** 현재 의도를 읽는다. down/up 신호는 한 번 읽으면 사라진다. */
  sample(): Intent {
    const any = (keys: Set<string>) => [...keys].some((k) => this.pressed.has(k));
    const x = (any(RIGHT) ? 1 : 0) - (any(LEFT) ? 1 : 0);
    const y = (any(UP) ? 1 : 0) - (any(DOWN) ? 1 : 0);
    const len = Math.hypot(x, y);
    const intent: Intent = {
      move: len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 },
      action: {
        down: this.actionDown,
        held: any(ACTION),
        up: this.actionUp,
      },
    };
    this.actionDown = false;
    this.actionUp = false;
    return intent;
  }
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** 창에 키보드 리스너를 붙인다. 반환값을 호출하면 떼어 낸다. */
export function attachKeyboard(win: Window, state: KeyState): () => void {
  const onDown = (e: KeyboardEvent) => {
    if (isEditable(e.target)) return;
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    state.keydown(e.code, e.repeat);
  };
  const onUp = (e: KeyboardEvent) => state.keyup(e.code);
  const onClear = () => state.clear();
  const onVisibility = () => {
    if (win.document.visibilityState !== 'visible') state.clear();
  };
  win.addEventListener('keydown', onDown);
  win.addEventListener('keyup', onUp);
  win.addEventListener('blur', onClear);
  win.document.addEventListener('visibilitychange', onVisibility);
  return () => {
    win.removeEventListener('keydown', onDown);
    win.removeEventListener('keyup', onUp);
    win.removeEventListener('blur', onClear);
    win.document.removeEventListener('visibilitychange', onVisibility);
  };
}
