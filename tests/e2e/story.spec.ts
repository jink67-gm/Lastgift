// 이야기 모드(주소에 ?chapter 없음): 저장 칸 하나("story")로 0~6장이 이어진다. 장이 끝나고 끝 장면이 지나면 다음 장이 열리고,
// 팀 시계(남은 시간)·기억이 이어진다. 시험은 ?play&test(그냥 ?test는 광장 시험 장면).
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 640, height: 360 } });

const KEY = 'lastgift.cp.v1.story';
const cp = (chapterId: number, extra: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  runId: 'story-run',
  roomId: 'story',
  chapterId,
  savedRemainingMs: 300_000,
  completedChapters: Array.from({ length: chapterId }, (_, i) => i),
  memories: [1, 2, 3, 4].filter((m) => m < chapterId),
  timeAssistMs: 0,
  retryCount: 0,
  seed: 7,
  ...extra,
});
async function seed(page: Page, c: unknown) {
  await page.goto('/?play&test&noshadow');
  await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, c] as const);
}
const hook = (page: Page, name: string) => page.waitForFunction((n) => !!(window as unknown as { __lastgift?: Record<string, unknown> }).__lastgift?.[n], name, { timeout: 30_000 });

test('이야기 모드: 저장이 없으면 0장, 저장된 장이 있으면 그 장을 연다(?chapter 없이)', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/?play&test&noshadow');
  await page.evaluate((k) => localStorage.removeItem(k), KEY);
  await page.reload();
  await hook(page, 'sorting'); // 0장(선물 분류)
  for (const [ch, name] of [[1, 'ch1'], [3, 'ch3'], [4, 'ch4'], [5, 'finale']] as const) {
    await seed(page, cp(ch));
    await page.reload();
    await hook(page, name);
    expect(await page.evaluate(() => (window as unknown as { __lastgift: { run(): { roomId: string; chapterId: number } } }).__lastgift.run())).toMatchObject({ roomId: 'story', chapterId: ch });
  }
});

test('이야기 모드: 3장을 마치고 입양 장면이 지나면 4장이 열리고, 기억·저장이 이어진다', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await seed(page, cp(3, { photo: undefined }));
  await page.reload();
  await hook(page, 'ch3');
  type H3 = { debugKongi(s: number, t: number, m: string): void; debugPlace(id: string, s: number, t: number, f: number): void; ending(): number; seekEnding(t: number): void };
  await page.evaluate(() => (window as unknown as { __lastgift: H3 }).__lastgift.debugKongi(30, 3, 'rest'));
  await page.keyboard.press('KeyE');
  await page.evaluate(() => (window as unknown as { __lastgift: H3 }).__lastgift.debugPlace('p0', 35.85, 2.6, Math.PI * 1.25));
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => (window as unknown as { __lastgift: H3 }).__lastgift.ending() > 0.3, null, { timeout: 10_000 });
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), KEY);
  expect(saved).toMatchObject({ chapterId: 4, memories: [1, 2, 3], completedChapters: [0, 1, 2, 3] });
  // 입양 장면 끝으로 → 어두워지고 4장이 열린다
  await page.evaluate(() => (window as unknown as { __lastgift: H3 }).__lastgift.seekEnding(40));
  await page.waitForEvent('load', { timeout: 15_000 });
  await hook(page, 'ch4');
  expect(await page.evaluate(() => (window as unknown as { __lastgift: { run(): { chapterId: number; memories: number[] } } }).__lastgift.run())).toMatchObject({ chapterId: 4, memories: [1, 2, 3] });
  expect(errors).toEqual([]);
});

test('이야기 모드: 4장 첫 봉투는 이 시도에서 한 번만(다시 열어도 다시 안 나온다)', async ({ page }) => {
  test.setTimeout(90_000);
  await seed(page, cp(4));
  await page.goto('/?play&test&noshadow&intro');
  await hook(page, 'ch4');
  await expect(page.locator('#envelope')).toBeVisible();
  await page.reload();
  await hook(page, 'ch4');
  await page.waitForTimeout(500);
  await expect(page.locator('#envelope')).toHaveCount(0);
});

test('이야기 모드: 4장 트리에 불을 켜고 사진 장면이 지나면 5장(광장)이 열린다', async ({ page }) => {
  test.setTimeout(120_000);
  await seed(page, cp(4));
  await page.reload();
  await hook(page, 'ch4');
  type H4 = { debugStage(s: string): void; debugPlace(id: string, s: number, t: number, f?: number): void; ending(): number; seekEnding(t: number): void };
  await page.evaluate(() => {
    const h = (window as unknown as { __lastgift: H4 }).__lastgift;
    h.debugStage('charged');
    h.debugPlace('p0', 24, -8.2);
    h.debugPlace('p1', 24, 8.2);
  });
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as unknown as { __lastgift: H4 }).__lastgift.ending() > 0.3, null, { timeout: 10_000 });
  await page.evaluate(() => (window as unknown as { __lastgift: H4 }).__lastgift.seekEnding(22));
  await page.waitForEvent('load', { timeout: 20_000 });
  await hook(page, 'finale');
  expect(await page.evaluate(() => (window as unknown as { __lastgift: { run(): { chapterId: number; memories: number[] } } }).__lastgift.run())).toMatchObject({ chapterId: 5, memories: [1, 2, 3, 4] });
});
