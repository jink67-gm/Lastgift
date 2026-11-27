// 여러 기기 공통 층(net/team.ts) 시험: 0~6장 어느 장이든 방장이 판정하고 참가자는 입력만 보내 같은 화면을 그린다.
// 창(브라우저 문맥)마다 다른 기기다(저장소·익명 uid가 따로). 처음 소개는 Firebase 에뮬레이터, 게임 데이터는 WebRTC.
// 실행: npm run test:net
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

type Hooks = Record<string, (...a: unknown[]) => unknown>;
const net = <T>(page: Page, name: string, ...args: unknown[]) =>
  page.evaluate(([n, a]) => (window as unknown as { __lastgiftNet: Hooks }).__lastgiftNet[n as string]!(...(a as unknown[])), [name, args] as const) as Promise<T>;
const game = <T>(page: Page, name: string, ...args: unknown[]) =>
  page.evaluate(([n, a]) => (window as unknown as { __lastgift: Hooks }).__lastgift[n as string]!(...(a as unknown[])), [name, args] as const) as Promise<T>;
const hasNet = (page: Page, name: string) =>
  page.waitForFunction((n) => !!(window as unknown as { __lastgiftNet?: Record<string, unknown> }).__lastgiftNet?.[n], name, { timeout: 30_000 });
const hasGame = (page: Page, name: string, timeout = 40_000) =>
  page.waitForFunction((n) => !!(window as unknown as { __lastgift?: Record<string, unknown> }).__lastgift?.[n], name, { timeout });

const FLAGS = '&emu&test&noshadow&quality=low';

interface Device {
  ctx: BrowserContext;
  page: Page;
  errors: string[];
}

/** 이 시험에서 연 기기들(끝나면 닫는다: 남겨 두면 다음 시험 내내 그리느라 컴퓨터가 느려진다) */
const opened: BrowserContext[] = [];
test.afterEach(async () => {
  for (const c of opened.splice(0)) await c.close().catch(() => {});
});

async function device(browser: Browser, url: string): Promise<Device> {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
  opened.push(ctx);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  return { ctx, page, errors };
}

async function openHost(browser: Browser, search: string): Promise<Device & { code: string }> {
  const d = await device(browser, `/${search}${FLAGS}`);
  await hasNet(d.page, 'roomCode');
  return { ...d, code: await net<string>(d.page, 'roomCode') };
}

async function openGuest(browser: Browser, code: string): Promise<Device> {
  const d = await device(browser, `/?join=${code}${FLAGS}`);
  await d.page.waitForFunction(() => !!(window as unknown as { __lastgiftNet?: { slot?: () => string | null } }).__lastgiftNet?.slot?.(), null, { timeout: 30_000 });
  return d;
}

async function waitOpen(host: Page, n: number) {
  await host.waitForFunction((k) => (window as unknown as { __lastgiftNet: { openSlots(): string[] } }).__lastgiftNet.openSlots().length === k, n, { timeout: 30_000 });
}

type P = { id: string; x: number; z: number; connected: boolean };
type Ch3 = { players: P[]; ball: { carriedBy: string | null; x: number; z: number }; complete: boolean };

test('3장 두 기기: 참가자 입력이 방장 판정으로, 같은 상태가 참가자 화면에 · 이탈과 재접속', async ({ browser }) => {
  test.setTimeout(240_000);
  const host = await openHost(browser, '?chapter=3&host');
  const guest = await openGuest(browser, host.code);
  await waitOpen(host.page, 2);
  expect(await net<boolean>(host.page, 'start')).toBe(true);
  await hasGame(host.page, 'ch3');
  await hasGame(guest.page, 'ch3');
  expect(await net<string>(guest.page, 'slot')).toBe('p1');

  // 참가자가 자기 키보드로 움직이면 방장 판정에 반영되고, 참가자 화면 상태도 따라온다
  const before = (await game<Ch3>(host.page, 'ch3')).players.find((p) => p.id === 'p1')!;
  await guest.page.keyboard.down('KeyD');
  await guest.page.waitForTimeout(700);
  await guest.page.keyboard.up('KeyD');
  await host.page.waitForTimeout(400);
  const hs = await game<Ch3>(host.page, 'ch3');
  const after = hs.players.find((p) => p.id === 'p1')!;
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(0.8);
  expect(hs.players.find((p) => p.id === 'p0')!).toMatchObject({ x: expect.any(Number) });
  const gs = await game<Ch3>(guest.page, 'ch3');
  const mirrored = gs.players.find((p) => p.id === 'p1')!;
  expect(Math.hypot(mirrored.x - after.x, mirrored.z - after.z)).toBeLessThan(0.3);

  // 참가자 행동(E): 공 옆으로 옮겨 두고 누르면 방장이 집기를 판정 → 사건이 참가자에게도
  const ball = hs.ball;
  const lane = await game<{ s: number; t: number }>(host.page, 'lane', ball.x, ball.z);
  await game(host.page, 'debugPlace', 'p1', lane.s - 0.6, lane.t, 0);
  await host.page.waitForTimeout(300);
  await guest.page.keyboard.press('KeyE');
  await host.page.waitForFunction(() => (window as unknown as { __lastgift: { ch3(): Ch3 } }).__lastgift.ch3().ball.carriedBy === 'p1', null, { timeout: 5_000 });
  await guest.page.waitForFunction(
    () => (window as unknown as { __lastgift: { ch3Events(): { type: string; playerId?: string }[] } }).__lastgift.ch3Events().some((e) => e.type === 'pick' && e.playerId === 'p1'),
    null,
    { timeout: 5_000 },
  );

  // 참가자 창이 닫힘 → 방장: 공은 그 자리에, 요정은 빠지고, 혼자라 팀 일시중지
  await guest.page.close();
  await host.page.waitForFunction(() => (window as unknown as { __lastgift: { ch3(): Ch3 } }).__lastgift.ch3().players.find((p) => p.id === 'p1')!.connected === false, null, { timeout: 10_000 });
  const gone = await game<Ch3>(host.page, 'ch3');
  expect(gone.ball.carriedBy).toBeNull();
  expect(await game<{ pauseReasons: string[] }>(host.page, 'run')).toMatchObject({ pauseReasons: ['alone'] });

  // 같은 기기에서 다시 열면 같은 자리(p1)로 이어진다
  const back = await guest.ctx.newPage();
  await back.goto(`/?join=${host.code}${FLAGS}`);
  await hasGame(back, 'ch3');
  expect(await net<string>(back, 'slot')).toBe('p1');
  await host.page.waitForFunction(() => (window as unknown as { __lastgift: { ch3(): Ch3 } }).__lastgift.ch3().players.find((p) => p.id === 'p1')!.connected === true, null, { timeout: 10_000 });
  await host.page.waitForFunction(() => (window as unknown as { __lastgift: { run(): { pauseReasons: string[] } } }).__lastgift.run().pauseReasons.length === 0, null, { timeout: 10_000 });
  expect(host.errors).toEqual([]);
  expect(guest.errors).toEqual([]);
});

type RunLite = { chapterId: number; memories: number[]; outcome: string | null; roomId: string; runId: string };

/** 이 기기가 이 장을 열 때까지(참가자는 방장이 연 장을 따라 페이지를 다시 연다) */
async function onPage(page: Page, chapterId: number, timeout = 90_000) {
  await page.waitForFunction(
    (ch) => {
      const w = window as unknown as { __lastgift?: { run?: () => { chapterId: number }; debugWin?: unknown }; __lastgiftNet?: { role(): string; page?: () => number } };
      const g = w.__lastgift;
      // 참가자: 방장이 장을 마치면 기록(chapterId)은 먼저 바뀌고 페이지는 잠시 뒤 다시 열린다 → 연 장(page)까지 확인
      const net = w.__lastgiftNet;
      const opened = !net || net.role() === 'host' || net.page?.() === Math.min(ch, 5);
      return opened && !!g?.debugWin && g.run?.().chapterId === ch;
    },
    chapterId,
    { timeout },
  );
}

for (const n of [2, 3, 4]) test(`이야기 모드 ${n}기기: 0장부터 6장 끝까지 방장이 장을 넘기면 참가자가 따라오고, 기억·시도가 이어진다`, async ({ browser }) => {
  test.setTimeout(900_000);
  const host = await openHost(browser, '?host');
  const guests: Device[] = [];
  for (let i = 1; i < n; i++) guests.push(await openGuest(browser, host.code));
  const last = `p${n - 1}`;
  await waitOpen(host.page, n);
  const shot = (d: Device, name: string) => (n === 4 ? d.page.screenshot({ path: `docs/screens/07/${name}.png` }) : Promise.resolve());
  await host.page.waitForTimeout(400);
  await shot(host, 'lobby_host_4');
  await shot(guests[n - 2]!, 'lobby_guest_4');
  expect(await net<boolean>(host.page, 'start')).toBe(true);
  const all = [host, ...guests];
  const runOf = (d: Device) => game<RunLite>(d.page, 'run');

  // 0~4장: 방장이 장을 마치면(시험 창구) 끝 장면이 지나고 방장 페이지가 다시 읽혀 다음 장 → 참가자도 그 장으로
  const finishEnding: Record<number, (p: Page) => Promise<void>> = {
    0: async () => {},
    1: async (p) => {
      await p.waitForFunction(() => (window as unknown as { __lastgift: { ending(): number } }).__lastgift.ending() >= 0);
      await game(p, 'seekEnding', 11.2);
    },
    2: async (p) => {
      await p.waitForFunction(() => (window as unknown as { __lastgift: { clip(): unknown } }).__lastgift.clip() !== null, null, { timeout: 15_000 });
      await game(p, 'skipClip');
    },
    3: async (p) => {
      await p.waitForFunction(() => (window as unknown as { __lastgift: { ending(): number } }).__lastgift.ending() >= 0);
      await game(p, 'seekEnding', 40);
    },
    4: async (p) => {
      await p.waitForFunction(() => (window as unknown as { __lastgift: { ending(): number } }).__lastgift.ending() >= 0);
      await game(p, 'seekEnding', 22);
    },
  };
  let runId = '';
  for (let ch = 0; ch <= 4; ch++) {
    for (const d of all) await onPage(d.page, ch);
    const r = await runOf(host);
    if (ch === 0) runId = r.runId;
    expect(r).toMatchObject({ chapterId: ch, roomId: `net-${host.code}`, runId });
    for (const g of guests) expect(await runOf(g)).toMatchObject({ chapterId: ch, runId, memories: r.memories });
    // 참가자 모두 자기 자리로 이어져 있다
    await waitOpen(host.page, n);
    if (ch === 3) {
      await host.page.waitForTimeout(3500); // 처음 몇 초 전체 구도가 지나고
      await shot(host, 'ch3_host_p0');
      await shot(guests[n - 2]!, `ch3_guest_${last}`);
    }
    const reload = host.page.waitForEvent('load', { timeout: 60_000 });
    await game(host.page, 'debugWin');
    await finishEnding[ch]!(host.page);
    await reload;
  }

  // 5장: 가방 열기(마지막 참가자) → 네 빛 → 6장(같은 페이지) → 그 요정이 산타에게 건넴 → 모든 화면 끝 장면
  for (const d of all) await onPage(d.page, 5);
  expect((await runOf(host)).memories).toEqual([1, 2, 3, 4]);
  await waitOpen(host.page, n);
  await game(host.page, 'debugWin', 'opened', last);
  await host.page.waitForTimeout(500);
  await game(host.page, 'seekCut', 30);
  await host.page.waitForFunction(() => (window as unknown as { __lastgift: { finale(): { chapter: number } } }).__lastgift.finale().chapter === 6, null, { timeout: 15_000 });
  for (const g of guests) await g.page.waitForFunction(() => (window as unknown as { __lastgift: { finale(): { chapter: number } } }).__lastgift.finale().chapter === 6, null, { timeout: 30_000 });
  await game(host.page, 'debugWin', 'deliver', last);
  for (const d of all) await d.page.waitForFunction(() => (window as unknown as { __lastgift: { ending(): { t: number } } }).__lastgift.ending().t >= 0, null, { timeout: 20_000 });
  await guests[n - 2]!.page.waitForTimeout(2500);
  await shot(guests[n - 2]!, `ch6_ending_guest_${last}`);
  expect(await runOf(host)).toMatchObject({ outcome: 'win', runId });
  for (const g of guests) await g.page.waitForFunction(() => (window as unknown as { __lastgift: { run(): { outcome: string | null } } }).__lastgift.run().outcome === 'win', null, { timeout: 10_000 });
  for (const d of all) expect(d.errors).toEqual([]);
});

test('방장 종료 → 참가자는 멈추고 기다림 → 방장이 다시 열면 같은 방·같은 시도로 이어짐 · 다른 방은 섞이지 않음', async ({ browser }) => {
  test.setTimeout(300_000);
  // 방 A(4장)와 방 B(1장)를 동시에
  const hostA = await openHost(browser, '?chapter=4&host');
  const hostB = await openHost(browser, '?chapter=1&host');
  expect(hostA.code).not.toBe(hostB.code);
  const guestA = await openGuest(browser, hostA.code);
  const guestB = await openGuest(browser, hostB.code);
  await waitOpen(hostA.page, 2);
  await waitOpen(hostB.page, 2);
  await net(hostA.page, 'start');
  await net(hostB.page, 'start');
  await onPage(hostA.page, 4);
  await onPage(guestA.page, 4);
  await onPage(hostB.page, 1);
  await onPage(guestB.page, 1);
  const runA = await game<RunLite>(hostA.page, 'run');
  const runB = await game<RunLite>(hostB.page, 'run');
  expect(runA.runId).not.toBe(runB.runId);
  expect(runA.roomId).toBe(`net-${hostA.code}`);
  expect(runB.roomId).toBe(`net-${hostB.code}`);
  expect(await game<RunLite>(guestA.page, 'run')).toMatchObject({ runId: runA.runId, chapterId: 4 });
  expect(await game<RunLite>(guestB.page, 'run')).toMatchObject({ runId: runB.runId, chapterId: 1 });
  expect((await net<{ team: unknown[] }>(guestA.page, 'snap')).team).toHaveLength(2);

  // 방 B만 장을 마친다 → B 참가자만 끝 장면, A는 그대로
  await game(hostB.page, 'debugWin');
  try {
    await guestB.page.waitForFunction(() => (window as unknown as { __lastgift: { ending(): number } }).__lastgift.ending() >= 0, null, { timeout: 10_000 });
  } catch (e) {
    console.log('DBG hostB', JSON.stringify(await net(hostB.page, 'netLog')), 'guestB connected', await net(guestB.page, 'connected'), 'page', await net(guestB.page, 'page'));
    console.log('DBG guestB snap', JSON.stringify(await net<{ run: { runId: string }; page: number; n: number }>(guestB.page, 'snap')).slice(0, 200), 'hostB run', (await game<RunLite>(hostB.page, 'run')).runId);
    throw e;
  }
  expect(await game<number>(guestA.page, 'ending')).toBe(-1);
  expect(await game<RunLite>(guestA.page, 'run')).toMatchObject({ chapterId: 4, runId: runA.runId });

  // 방장 A 창을 닫음 → 참가자 A: 끊김 안내, 움직일 수 없다
  await hostA.page.close();
  await guestA.page.waitForFunction(() => !(window as unknown as { __lastgiftNet: { connected(): boolean } }).__lastgiftNet.connected(), null, { timeout: 15_000 });
  await expect(guestA.page.locator('#lobby')).toContainText('방장과 연결이 끊겼어요');
  // 같은 기기에서 방장이 다시 연다 → 같은 방 코드·같은 시도, 참가자 A가 저절로 다시 이어진다
  const again = await hostA.ctx.newPage();
  const errors: string[] = [];
  again.on('pageerror', (e) => errors.push(String(e)));
  await again.goto(`/?chapter=4&host${FLAGS}`);
  await hasNet(again, 'roomCode');
  expect(await net<string>(again, 'roomCode')).toBe(hostA.code);
  await onPage(again, 4);
  await waitOpen(again, 2);
  expect((await game<RunLite>(again, 'run')).runId).toBe(runA.runId);
  await guestA.page.waitForFunction(() => (window as unknown as { __lastgiftNet: { connected(): boolean } }).__lastgiftNet.connected(), null, { timeout: 20_000 });
  await expect(guestA.page.locator('#lobby')).toBeHidden();
  expect(await net<string>(guestA.page, 'slot')).toBe('p1');
  expect(errors).toEqual([]);
  for (const d of [guestA, hostB, guestB]) expect(d.errors).toEqual([]);
});
