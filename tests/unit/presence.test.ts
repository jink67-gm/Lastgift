// 여러 기기: 요정이 나가고 다시 들어올 때 장 상태(들던 것 내려놓기·복제 없음·같은 자리)
import { describe, expect, it } from 'vitest';
import { createChapter1 } from '../../src/core/chapter1';
import { createChapter3 } from '../../src/core/chapter3';
import { createChapter4 } from '../../src/core/chapter4';
import { createFinale } from '../../src/core/finale';
import { playerBack, playerGone } from '../../src/core/presence';
import { createSewing } from '../../src/core/sewing';
import { createSorting } from '../../src/core/sorting';

const P4 = ['p0', 'p1', 'p2', 'p3'];

describe('playerGone / playerBack', () => {
  it('3장: 공을 든 요정이 나가면 공은 그 자리에 놓이고 다른 요정은 그대로', () => {
    let s = createChapter3(P4);
    s = { ...s, ball: { ...s.ball, carriedBy: 'p2' }, players: s.players.map((p) => (p.id === 'p2' ? { ...p, x: 5, z: 6, handUp: true } : p)) };
    const g = playerGone(s, 'p2');
    expect(g.ball.carriedBy).toBeNull();
    expect(g.ball.x).toBe(5);
    expect(g.ball.z).toBe(6);
    expect(g.players.find((p) => p.id === 'p2')).toMatchObject({ connected: false, handUp: false, moving: false });
    expect(g.players.filter((p) => p.connected)).toHaveLength(3);
    const b = playerBack(g, 'p2');
    expect(b.players.find((p) => p.id === 'p2')!.connected).toBe(true);
    expect(b.ball.carriedBy).toBeNull(); // 다시 와도 손은 빈손(복제 없음)
  });

  it('1장: 선물·지도, 4장: 발전기 돌리기, 5·6장: 스노글로브', () => {
    let c1 = createChapter1(P4);
    c1 = { ...c1, items: c1.items.map((it, i) => (i === 0 ? { ...it, carriedBy: 'p1' } : it)), players: c1.players.map((p) => (p.id === 'p1' ? { ...p, mapOpen: true } : p)) };
    const g1 = playerGone(c1, 'p1');
    expect(g1.items[0]!.carriedBy).toBeNull();
    expect(g1.players[1]!.mapOpen).toBe(false);

    const c4 = { ...createChapter4(['p0', 'p1', 'p2']), cranking: 'p2' };
    expect(playerGone(c4, 'p2').cranking).toBeNull();
    expect(playerGone(c4, 'p1').cranking).toBe('p2');

    const f = createFinale(6, [
      { id: 'p0', x: 0, z: 0, facing: 0 },
      { id: 'p1', x: 3, z: 4, facing: 0 },
    ], 'p1');
    const gf = playerGone(f, 'p1');
    expect(gf.globe!.holder).toBeNull();
    expect(gf.globe).toMatchObject({ x: 3, z: 4 });
  });

  it('2장 재봉틀·0장 분류: 함께 들기 손잡이를 놓는다', () => {
    let s = createSewing(['p0', 'p1', 'p2']);
    s = { ...s, handles: ['p1', null], players: s.players.map((p) => (p.id === 'p1' ? { ...p, holding: 0 } : p)) };
    const g = playerGone(s, 'p1');
    expect(g.handles[0]).toBeNull();
    expect(g.players[1]!.connected).toBe(false);
    expect(playerBack(g, 'p1').players[1]!.connected).toBe(true);

    let so = createSorting(['p0', 'p1']);
    so = { ...so, items: so.items.map((it, i) => (i === 0 ? { ...it, carriedBy: 'p1' } : it)) };
    const gs = playerGone(so, 'p1');
    expect(gs.items[0]!.carriedBy).toBeNull();
    expect(gs.sewing.players[1]!.connected).toBe(false);
    expect(playerBack(gs, 'p1').sewing.players[1]!.connected).toBe(true);
  });

  it('없는 요정은 아무것도 바꾸지 않는다', () => {
    const s = createChapter3(['p0', 'p1']);
    expect(playerGone(s, 'p9')).toBe(s);
  });
});
