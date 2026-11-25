import { describe, expect, it } from 'vitest';
import { assignSlot, checkMission, elfNickname, parseGuestMsg, parseHostMsg, type Slot } from '../../src/net/protocol';
import { isRoomCode, newRoomCode, normalizeRoomCode, ROOM_ALPHABET } from '../../src/net/signaling';

describe('방 코드', () => {
  it('5글자이고 헷갈리는 글자(0·1·I·O)를 쓰지 않는다', () => {
    for (let i = 0; i < 200; i++) {
      const c = newRoomCode();
      expect(isRoomCode(c)).toBe(true);
      expect(c).not.toMatch(/[01IO]/);
    }
    expect(ROOM_ALPHABET).not.toMatch(/[01IO]/);
  });

  it('입력한 코드의 소문자·공백·붙임표를 정리한다', () => {
    expect(normalizeRoomCode(' ab-c 7k ')).toBe('ABC7K');
    expect(isRoomCode('ABC7K')).toBe(true);
    expect(isRoomCode('ABC1K')).toBe(false);
    expect(isRoomCode('ABCD')).toBe(false);
  });
});

describe('참가자 메시지 검사', () => {
  it('이동 입력: 모양이 맞으면 받고, 속도는 1로 자른다', () => {
    const m = parseGuestMsg(JSON.stringify({ t: 'in', n: 3, mx: 3, my: 4, held: false }));
    expect(m).toMatchObject({ t: 'in', n: 3, held: false });
    if (m?.t !== 'in') throw new Error('not input');
    expect(m.mx).toBeCloseTo(0.6);
    expect(m.my).toBeCloseTo(0.8);
  });

  it('깨진 값·모르는 종류·빠진 칸은 버린다', () => {
    expect(parseGuestMsg('{not json')).toBeNull();
    expect(parseGuestMsg(JSON.stringify({ t: 'teleport', x: 0 }))).toBeNull();
    expect(parseGuestMsg(JSON.stringify({ t: 'in', n: 1, mx: 'a', my: 0, held: false }))).toBeNull();
    expect(parseGuestMsg(JSON.stringify({ t: 'act', runId: 'r', epoch: 1, playerId: 'p1' }))).toBeNull();
    expect(parseGuestMsg('x'.repeat(70_000))).toBeNull();
  });

  it('방장 메시지도 모양을 검사한다', () => {
    expect(parseHostMsg(JSON.stringify({ t: 'welcome', slot: 'p2', runId: 'r' }))?.t).toBe('welcome');
    expect(parseHostMsg(JSON.stringify({ t: 'welcome', slot: 'p9', runId: 'r' }))).toBeNull();
    expect(parseHostMsg(JSON.stringify({ t: 'refuse', reason: 'nope' }))).toBeNull();
  });
});

describe('미션 이벤트: 이 연결의 자리·이 시도·지금 epoch·처음 보는 eventId', () => {
  const ctx = (seen: string[] = []) => ({ slot: 'p1' as Slot, runId: 'run-1', epoch: 3, seen: new Set(seen) });
  const act = (o: Partial<{ runId: string; epoch: number; playerId: string; eventId: string }> = {}) => ({
    t: 'act' as const,
    runId: 'run-1',
    epoch: 3,
    playerId: 'p1',
    eventId: 'e1',
    ...o,
  });

  it('정상', () => expect(checkMission(act(), ctx())).toBe('ok'));
  it('다른 자리를 사칭하면 거른다', () => expect(checkMission(act({ playerId: 'p0' }), ctx())).toBe('wrongSlot'));
  it('다른 방·시도의 이벤트', () => expect(checkMission(act({ runId: 'run-2' }), ctx())).toBe('otherRun'));
  it('지난 epoch', () => expect(checkMission(act({ epoch: 2 }), ctx())).toBe('staleEpoch'));
  it('재전송', () => expect(checkMission(act(), ctx(['e1']))).toBe('duplicate'));
});

describe('자리 배정', () => {
  it('방장은 p0, 참가자는 빈자리 순서대로, 같은 uid는 같은 자리', () => {
    const seats = new Map<string, Slot>([['host', 'p0']]);
    expect(assignSlot(seats, 'a', false)).toBe('p1');
    seats.set('a', 'p1');
    expect(assignSlot(seats, 'b', false)).toBe('p2');
    seats.set('b', 'p2');
    expect(assignSlot(seats, 'a', true)).toBe('p1'); // 시작 뒤 재접속도 같은 자리
  });

  it('4명이 차면 full, 시작한 뒤 처음 보는 사람은 started', () => {
    const seats = new Map<string, Slot>([['h', 'p0'], ['a', 'p1'], ['b', 'p2'], ['c', 'p3']]);
    expect(assignSlot(seats, 'd', false)).toBe('full');
    expect(assignSlot(new Map([['h', 'p0' as Slot]]), 'z', true)).toBe('started');
  });

  it('자동 요정 별명은 uid마다 같고 실명이 아니다', () => {
    expect(elfNickname('abc')).toBe(elfNickname('abc'));
    expect(elfNickname('abc')).toMatch(/요정$/);
  });
});
