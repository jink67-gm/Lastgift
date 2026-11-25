import { describe, expect, it } from 'vitest';
import { KeyState } from '../../src/input/keyboard';
import { mergeIntents } from '../../src/input/merge';
import { STICK_RADIUS, TouchState } from '../../src/input/touch';

describe('TouchState: 가상 스틱', () => {
  it('위로 끝까지 끌면 화면 위 방향 최고 속도', () => {
    const t = new TouchState();
    t.stickStart(1, 100, 500);
    t.move(1, 100, 500 - STICK_RADIUS * 2);
    const m = t.sample().move;
    expect(m.x).toBeCloseTo(0);
    expect(m.y).toBeCloseTo(1);
  });

  it('조금만 끌면(데드존 안) 움직이지 않는다', () => {
    const t = new TouchState();
    t.stickStart(1, 100, 500);
    t.move(1, 105, 500);
    expect(t.sample().move).toEqual({ x: 0, y: 0 });
  });

  it('손을 떼면 정지', () => {
    const t = new TouchState();
    t.stickStart(1, 100, 500);
    t.move(1, 200, 500);
    t.end(1);
    expect(t.sample().move).toEqual({ x: 0, y: 0 });
  });

  it('두 번째 손가락은 스틱을 빼앗지 않는다', () => {
    const t = new TouchState();
    t.stickStart(1, 100, 500);
    t.move(1, 200, 500);
    expect(t.stickStart(2, 50, 50)).toBe(false);
    t.move(2, 0, 0);
    expect(t.sample().move.x).toBeCloseTo(1);
  });
});

describe('TouchState: 두 손가락 이동 + 행동', () => {
  it('스틱을 쥔 채 행동 버튼을 탭하면 이동은 계속되고 행동은 한 번만', () => {
    const t = new TouchState();
    t.stickStart(1, 100, 500);
    t.move(1, 200, 500);
    t.actionStart(2);
    const a = t.sample();
    expect(a.move.x).toBeCloseTo(1);
    expect(a.action.down).toBe(true);
    const b = t.sample();
    expect(b.action.down).toBe(false); // 같은 탭을 두 번 쓰지 않는다
    expect(b.move.x).toBeCloseTo(1);
    t.end(2);
    const c = t.sample();
    expect(c.action).toEqual({ down: false, held: false, up: true });
    expect(c.move.x).toBeCloseTo(1); // 행동 손가락만 떼도 이동 유지
  });

  it('스틱 손가락만 떼면 행동 누름은 유지된다', () => {
    const t = new TouchState();
    t.stickStart(1, 100, 500);
    t.move(1, 200, 500);
    t.actionStart(2);
    t.sample();
    t.end(1);
    const s = t.sample();
    expect(s.move).toEqual({ x: 0, y: 0 });
    expect(s.action.held).toBe(true);
  });

  it('행동 버튼에 손가락이 두 개 닿아도 행동은 한 번', () => {
    const t = new TouchState();
    t.actionStart(2);
    t.actionStart(3);
    expect(t.sample().action.down).toBe(true);
    t.end(2);
    expect(t.sample().action).toEqual({ down: false, held: true, up: false });
  });

  it('터치 취소·화면 전환(clear)은 모든 손가락을 해제한다', () => {
    const t = new TouchState();
    t.stickStart(1, 100, 500);
    t.move(1, 200, 500);
    t.actionStart(2);
    t.sample();
    t.clear();
    const s = t.sample();
    expect(s.move).toEqual({ x: 0, y: 0 });
    expect(s.action.held).toBe(false);
  });
});

describe('mergeIntents: 키보드와 터치를 섞어 쓰기', () => {
  it('E 키와 행동 버튼은 같은 행동 신호가 된다', () => {
    const k = new KeyState();
    const t = new TouchState();
    k.keydown('KeyE');
    expect(mergeIntents(k.sample(), t.sample()).action.down).toBe(true);
    t.actionStart(1);
    expect(mergeIntents(k.sample(), t.sample()).action.down).toBe(true);
  });

  it('둘을 동시에 밀어도 속도는 1을 넘지 않는다', () => {
    const k = new KeyState();
    const t = new TouchState();
    k.keydown('KeyD');
    t.stickStart(1, 0, 0);
    t.move(1, 200, 0);
    const m = mergeIntents(k.sample(), t.sample()).move;
    expect(Math.hypot(m.x, m.y)).toBeCloseTo(1);
  });
});
