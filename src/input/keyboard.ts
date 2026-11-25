// 키보드 → Intent.
// 키는 event.code(물리 키 위치)로 판정한다. 웨일북·크롬북에서 한글 입력 상태여도
// W 자리 키는 code가 'KeyW'이므로 그대로 동작한다(event.key는 'ㅈ'이나 'Process'가 된다).
import type { Intent } from './intent';

export interface KeyMap {
  up: readonly string[];
  down: readonly string[];
  left: readonly string[];
  right: readonly string[];
  action: readonly string[];
}

/** 한 사람이 쓰는 기본 배치: WASD와 방향키 둘 다 이동, E가 행동 */
export const KEYMAP_ALL: KeyMap = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  action: ['KeyE'],
};

/** 한 키보드를 둘이 나눠 쓸 때(로컬 2인 시험): 1P = WASD + E */
export const KEYMAP_P1: KeyMap = { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], action: ['KeyE'] };

/** 한 키보드를 둘이 나눠 쓸 때: 2P = 방향키 + Enter(또는 /) */
export const KEYMAP_P2: KeyMap = {
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  action: ['Enter', 'NumpadEnter', 'Slash'],
};

function keysOf(m: KeyMap): Set<string> {
  return new Set([...m.up, ...m.down, ...m.left, ...m.right, ...m.action]);
}

/** 기본 배치에서 게임이 쓰는 키(페이지 스크롤 같은 기본 동작을 막는다) */
export const GAME_KEYS: ReadonlySet<string> = keysOf(KEYMAP_ALL);

/** DOM에 의존하지 않는 키 상태. 단위 테스트에서 직접 쓴다. */
export class KeyState {
  private readonly pressed = new Set<string>();
  private actionDown = false;
  private actionUp = false;
  private readonly keys: Set<string>;
  private readonly UP: Set<string>;
  private readonly DOWN: Set<string>;
  private readonly LEFT: Set<string>;
  private readonly RIGHT: Set<string>;
  private readonly ACTION: Set<string>;

  constructor(map: KeyMap = KEYMAP_ALL) {
    this.keys = keysOf(map);
    this.UP = new Set(map.up);
    this.DOWN = new Set(map.down);
    this.LEFT = new Set(map.left);
    this.RIGHT = new Set(map.right);
    this.ACTION = new Set(map.action);
  }

  /** 이 배치가 쓰는 키인가 */
  handles(code: string): boolean {
    return this.keys.has(code);
  }

  keydown(code: string, repeat = false): void {
    if (!this.keys.has(code)) return;
    // 길게 누를 때 브라우저가 보내는 반복 keydown은 새 입력으로 치지 않는다.
    if (repeat || this.pressed.has(code)) return;
    this.pressed.add(code);
    if (this.ACTION.has(code)) this.actionDown = true;
  }

  keyup(code: string): void {
    if (!this.pressed.delete(code)) return;
    if (this.ACTION.has(code)) this.actionUp = true;
  }

  /** 창 전환·탭 숨김 등으로 keyup을 못 받을 때 눌린 키가 남지 않게 모두 해제한다. */
  clear(): void {
    const hadAction = [...this.pressed].some((c) => this.ACTION.has(c));
    this.pressed.clear();
    this.actionDown = false;
    if (hadAction) this.actionUp = true;
  }

  /** 현재 의도를 읽는다. down/up 신호는 한 번 읽으면 사라진다. */
  sample(): Intent {
    const any = (keys: Set<string>) => [...keys].some((k) => this.pressed.has(k));
    const x = (any(this.RIGHT) ? 1 : 0) - (any(this.LEFT) ? 1 : 0);
    const y = (any(this.UP) ? 1 : 0) - (any(this.DOWN) ? 1 : 0);
    const len = Math.hypot(x, y);
    const intent: Intent = {
      move: len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 },
      action: {
        down: this.actionDown,
        held: any(this.ACTION),
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
    // 버튼에 포커스가 있을 때의 Enter는 그 버튼(예: 「다시 하기」)이 쓴다
    if (e.target instanceof HTMLButtonElement && (e.code === 'Enter' || e.code === 'Space')) return;
    if (state.handles(e.code)) e.preventDefault();
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
