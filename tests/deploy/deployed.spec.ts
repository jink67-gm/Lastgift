// STEP 09: 배포 주소에서 모델·소리 로드와 두 기기 초대(실제 Firebase)까지 다시 확인한다.
import { expect, test, type Page } from '@playwright/test';

const hook = (page: Page, name: string, timeout = 60_000) =>
  page.waitForFunction((n) => !!(window as unknown as { __lastgift?: Record<string, unknown> }).__lastgift?.[n], name, { timeout });
const failed = (page: Page) => page.evaluate(() => (window as unknown as { __lastgiftModels?: { failed: string[] } }).__lastgiftModels?.failed ?? null);

test('배포 주소: 이야기 모드 첫 화면과 0~6장이 모델 실패 없이 열린다', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const bad: string[] = [];
  page.on('response', (r) => r.status() >= 400 && !r.url().includes('/video/') && bad.push(`${r.status()} ${r.url()}`));
  for (const [q, h] of [['?play&test&noshadow', 'sorting'], ['?chapter=1&test&noshadow', 'ch1'], ['?chapter=2&local&test&noshadow', 'sewing'], ['?chapter=3&test&noshadow', 'ch3'], ['?chapter=4&test&noshadow', 'ch4'], ['?chapter=5&test&noshadow', 'finale'], ['?chapter=6&test&noshadow', 'finale']] as const) {
    await page.goto(q);
    await hook(page, h);
    expect(await failed(page), q).toEqual([]);
  }
  expect(bad).toEqual([]);
  expect(errors).toEqual([]);
});

test('배포 주소: 첫 키 뒤 소리가 켜지고 사건에 소리가 난다', async ({ page }) => {
  await page.goto('?chapter=3&test&noshadow&quality=low');
  await hook(page, 'ch3');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(500);
  const s = await page.evaluate(() => {
    const x = (window as unknown as { __lastgiftSfx: { state(): { running: boolean }; log(): { name: string; played: boolean }[] } }).__lastgiftSfx;
    return { running: x.state().running, pick: x.log().some((e) => e.name === 'pick' && e.played) };
  });
  expect(s).toEqual({ running: true, pick: true });
});

test('배포 주소 + 실제 Firebase: 방 만들기 → 초대 링크로 참가 → 시작 → 같은 0장, 참가자 입력이 방장에', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const guestCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();
  const t0 = Date.now();
  await host.goto('?host&test&noshadow&quality=low');
  await host.waitForFunction(() => !!(window as unknown as { __lastgiftNet?: { roomCode?: () => string } }).__lastgiftNet?.roomCode, null, { timeout: 30_000 });
  const code = await host.evaluate(() => (window as unknown as { __lastgiftNet: { roomCode(): string } }).__lastgiftNet.roomCode());
  const roomMs = Date.now() - t0;
  // 대기실의 초대 링크를 그대로 연다
  const link = (await host.locator('#lobby').innerText()).match(/https?:\/\/\S+join=\w+\S*/)?.[0];
  expect(link).toContain(`join=${code}`);
  const t1 = Date.now();
  await guest.goto(link!);
  await guest.waitForFunction(() => !!(window as unknown as { __lastgiftNet?: { slot?: () => string | null } }).__lastgiftNet?.slot?.(), null, { timeout: 30_000 });
  await host.waitForFunction(() => (window as unknown as { __lastgiftNet: { openSlots(): string[] } }).__lastgiftNet.openSlots().length === 2, null, { timeout: 30_000 });
  const joinMs = Date.now() - t1;
  await host.evaluate(() => (window as unknown as { __lastgiftNet: { start(): boolean } }).__lastgiftNet.start());
  await hook(host, 'sorting');
  await hook(guest, 'sorting');
  type S = { sewing: { players: { id: string; x: number; z: number }[] } };
  const p1 = async () => (await host.evaluate(() => (window as unknown as { __lastgift: { sorting(): S } }).__lastgift.sorting())).sewing.players.find((p) => p.id === 'p1')!;
  // 시작 직후 연결 정리·재개 카운트다운(3초)이 끝나 팀이 움직일 수 있을 때까지
  await host.waitForFunction(() => {
    const r = (window as unknown as { __lastgift: { run(): { phase: string; pauseReasons: string[]; resumeAt: number | null } } }).__lastgift.run();
    return r.phase === 'play' && r.pauseReasons.length === 0 && r.resumeAt === null;
  }, null, { timeout: 30_000 });
  await guest.waitForFunction(() => (window as unknown as { __lastgiftNet: { connected(): boolean } }).__lastgiftNet.connected(), null, { timeout: 30_000 });
  await host.waitForTimeout(500);
  const a = await p1();
  await guest.keyboard.down('KeyD');
  await guest.waitForTimeout(800);
  await guest.keyboard.up('KeyD');
  await host.waitForTimeout(500);
  const b = await p1();
  expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(0.5);
  console.log(`방 만들기 ${roomMs}ms · 참가~연결 ${joinMs}ms · 방 ${code}`);
  await hostCtx.close();
  await guestCtx.close();
});
