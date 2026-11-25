import { describe, expect, it } from 'vitest';
import { KeyState } from '../../src/input/keyboard';

describe('KeyState: 키보드 → Intent', () => {
  it('WASD와 방향키가 같은 화면 방향을 낸다', () => {
    const pairs: [string, string, { x: number; y: number }][] = [
      ['KeyW', 'ArrowUp', { x: 0, y: 1 }],
      ['KeyS', 'ArrowDown', { x: 0, y: -1 }],
      ['KeyA', 'ArrowLeft', { x: -1, y: 0 }],
      ['KeyD', 'ArrowRight', { x: 1, y: 0 }],
    ];
    for (const [wasd, arrow, dir] of pairs) {
      for (const code of [wasd, arrow]) {
        const k = new KeyState();
        k.keydown(code);
        expect(k.sample().move).toEqual(dir);
      }
    }
  });

  it('반대 방향을 함께 누르면 그 축은 멈춘다', () => {
    const k = new KeyState();
    k.keydown('KeyA');
    k.keydown('ArrowRight');
    expect(k.sample().move).toEqual({ x: 0, y: 0 });
  });

  it('대각선 입력 길이는 1', () => {
    const k = new KeyState();
    k.keydown('KeyW');
    k.keydown('KeyD');
    const m = k.sample().move;
    expect(Math.hypot(m.x, m.y)).toBeCloseTo(1);
  });

  it('같은 키를 W와 ↑로 함께 눌렀다 하나만 떼도 계속 위로 간다', () => {
    const k = new KeyState();
    k.keydown('KeyW');
    k.keydown('ArrowUp');
    k.keyup('KeyW');
    expect(k.sample().move).toEqual({ x: 0, y: 1 });
  });

  it('E를 누르면 down은 한 번만, held는 뗄 때까지', () => {
    const k = new KeyState();
    k.keydown('KeyE');
    const a = k.sample();
    expect(a.action).toEqual({ down: true, held: true, up: false });
    k.keydown('KeyE', true); // 길게 누를 때의 반복 keydown
    k.keydown('KeyE'); // repeat 플래그 없이 다시 온 keydown
    expect(k.sample().action).toEqual({ down: false, held: true, up: false });
    k.keyup('KeyE');
    expect(k.sample().action).toEqual({ down: false, held: false, up: true });
    expect(k.sample().action).toEqual({ down: false, held: false, up: false });
  });

  it('창 전환(clear) 시 눌린 키가 남지 않는다', () => {
    const k = new KeyState();
    k.keydown('KeyD');
    k.keydown('KeyE');
    k.sample();
    k.clear();
    const s = k.sample();
    expect(s.move).toEqual({ x: 0, y: 0 });
    expect(s.action.held).toBe(false);
    expect(s.action.up).toBe(true);
  });

  it('게임에 쓰지 않는 키는 무시한다', () => {
    const k = new KeyState();
    k.keydown('KeyQ');
    k.keydown('Space');
    const s = k.sample();
    expect(s.move).toEqual({ x: 0, y: 0 });
    expect(s.action.down).toBe(false);
  });
});
