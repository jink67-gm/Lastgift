// 플레이 기록: FPS 통계·줄 고쳐 쓰기·표 글·브라우저 이름
import { describe, expect, it } from 'vitest';
import { formatLog, FrameStats, LOG_LIMIT, shortUa, upsertLog, type ChapterLog } from '../../src/core/playLog';

const entry = (o: Partial<ChapterLog> = {}): ChapterLog => ({
  runId: 'r1',
  roomId: 'story',
  chapterId: 3,
  role: 'local',
  players: 2,
  startedAt: new Date(2026, 10, 27, 9, 5).getTime(),
  playSec: 125,
  cutSec: 38,
  waitSec: 0,
  fpsAvg: 58.4,
  fpsLow: 41,
  quality: 'normal',
  retries: 0,
  done: true,
  device: { w: 1366, h: 768, dpr: 1, touch: false, ua: 'Whale 4 · Windows' },
  ...o,
});

describe('FrameStats', () => {
  it('평균과 느린 5%: 60FPS 95프레임 + 20FPS 5프레임', () => {
    const f = new FrameStats();
    for (let i = 0; i < 95; i++) f.add(1 / 60);
    for (let i = 0; i < 5; i++) f.add(1 / 20);
    expect(f.count).toBe(100);
    expect(f.low()).toBe(20);
    expect(f.avg()).toBeCloseTo(100 / (95 / 60 + 5 / 20), 5);
  });
  it('1초 넘는 프레임(탭 전환)과 0은 세지 않는다', () => {
    const f = new FrameStats();
    f.add(3);
    f.add(0);
    f.add(1 / 30);
    expect(f.count).toBe(1);
    expect(f.low()).toBe(30);
  });
});

describe('upsertLog / formatLog', () => {
  it('같은 시도·장·역할이면 고쳐 쓰고, 개수는 한도까지', () => {
    let l = upsertLog([], entry({ playSec: 10, done: false }));
    l = upsertLog(l, entry({ playSec: 20, done: true }));
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ playSec: 20, done: true });
    l = upsertLog(l, entry({ chapterId: 4 }));
    expect(l).toHaveLength(2);
    for (let i = 0; i < LOG_LIMIT + 5; i++) l = upsertLog(l, entry({ runId: `x${i}` }));
    expect(l).toHaveLength(LOG_LIMIT);
  });
  it('표: 머리줄 + 한 줄, 분:초·한국어 역할', () => {
    const t = formatLog([entry()]).split('\n');
    expect(t).toHaveLength(2);
    expect(t[1]!.split('\t')).toEqual(['2026-11-27', '09:05', '3장', '한 기기', '2', '2:05', '0:38', '0:00', '58', '41', '보통', '0', 'O', '1366×768@1', '-', 'Whale 4 · Windows']);
  });
});

describe('shortUa', () => {
  it('웨일·엣지·크롬·사파리', () => {
    expect(shortUa('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Whale/3.26.244.21 Safari/537.36')).toBe('Whale 3 · Windows');
    expect(shortUa('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/124.0 Safari/537.36 Edg/124.0')).toBe('Edge 124 · Windows');
    expect(shortUa('Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36')).toBe('Chrome 124 · ChromeOS');
    expect(shortUa('Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1')).toBe('Safari 604 · iPadOS');
    expect(shortUa('Mozilla/5.0 (Linux; Android 14; SM-X200) AppleWebKit/537.36 Chrome/124.0 Safari/537.36')).toBe('Chrome 124 · Android');
  });
});
