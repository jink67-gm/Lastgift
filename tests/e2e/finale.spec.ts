// 5·6장 06a: 광장 단체사진(시계 정지·건너뛰기) → 빈 양말 둘 다 들여다보기 → 가방 열기 → 네 빛·스노글로브 → 6장: 든 요정만 산타 앞에서 E로 건넨다.
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 640, height: 360 } });

type Hook = {
  finale(): { chapter: number; peeked: string[]; opened: boolean; globe: { holder: string | null } | null; delivered: boolean };
  finaleEvents(): { type: string; playerId?: string }[];
  run(): { phase: string; chapterId: number; completedChapters: number[]; snowglobe: { holder: string | null } | null; outcome: string | null };
  cut(): { cut: string | null; t: number; beat: string | null };
  seekCut(t: number): void;
  debugPlace(id: string, x: number, z: number, f?: number): void;
  spots(): { stocking: { x: number; z: number }; bag: { x: number; z: number }; santa: { x: number; z: number } };
};
const H = <T>(page: Page, fn: (h: Hook) => T) => page.evaluate((f) => new Function('h', `return (${f})(h)`)((window as unknown as { __lastgift: Hook }).__lastgift), fn.toString()) as Promise<T>;
const place = (page: Page, id: string, x: number, z: number) =>
  page.evaluate(([id, x, z]) => (window as unknown as { __lastgift: Hook }).__lastgift.debugPlace(id, x, z, Math.PI), [id, x, z] as const);
const wait = (page: Page, fn: string, timeout = 30_000) => page.waitForFunction(new Function(`return (${fn})(window.__lastgift)`) as () => boolean, null, { timeout });

test('5장 시작: 산타와 단체사진(그동안 시계 정지) → 건너뛰기로 바로 놀이', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?chapter=5&test&noshadow&intro');
  await page.waitForFunction(() => !!(window as unknown as { __lastgift?: { finale?: unknown } }).__lastgift?.finale, null, { timeout: 30_000 });
  expect((await H(page, (h) => h.cut())).cut).toBe('photo');
  expect((await H(page, (h) => h.run())).phase).toBe('lobby');
  await page.locator('#pro-skip').click();
  await wait(page, '(h) => h.cut().cut === null && h.run().phase === "play"');
  expect(errors).toEqual([]);
});

test('5장: 두 요정이 빈 양말을 들여다본 뒤에야 가방을 열 수 있고, 열면 네 빛 → 스노글로브(5장 완료, 연 요정이 든다)', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?chapter=5&test&noshadow');
  await page.waitForFunction(() => !!(window as unknown as { __lastgift?: { finale?: unknown } }).__lastgift?.finale, null, { timeout: 30_000 });
  await page.waitForTimeout(300);
  const sp = await H(page, (h) => h.spots());
  // 가방 앞: 아직(빈 양말 먼저)
  await place(page, 'p1', sp.bag.x, sp.bag.z + 0.8);
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  expect((await H(page, (h) => h.finale())).opened).toBe(false);
  // 둘 다 양말을 들여다본다
  await place(page, 'p0', sp.stocking.x, sp.stocking.z + 0.9);
  await place(page, 'p1', sp.stocking.x + 0.5, sp.stocking.z + 1.0);
  await page.waitForTimeout(200);
  await page.keyboard.press('KeyE');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  expect((await H(page, (h) => h.finale())).peeked.sort()).toEqual(['p0', 'p1']);
  // 2P가 가방을 연다
  await place(page, 'p1', sp.bag.x, sp.bag.z + 0.8);
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter');
  await wait(page, '(h) => h.cut().cut === "lights"', 5_000);
  expect(await H(page, (h) => h.run())).toMatchObject({ chapterId: 6, completedChapters: [0, 1, 2, 3, 4, 5], snowglobe: { holder: 'p1' } });
  const beats: string[] = [];
  for (const t of [0.5, 1.8, 3, 11]) {
    await page.evaluate((t) => (window as unknown as { __lastgift: Hook }).__lastgift.seekCut(t), t);
    await page.waitForTimeout(80);
    beats.push((await H(page, (h) => h.cut())).beat ?? 'none');
  }
  expect(beats).toEqual(['pull', 'open', 'gifts', 'merge']);
  await wait(page, '(h) => h.cut().cut === null');
  const f = await H(page, (h) => h.finale());
  expect(f.chapter).toBe(6);
  expect(f.globe?.holder).toBe('p1');
  expect((await H(page, (h) => h.run())).phase).toBe('play');
  expect(errors).toEqual([]);
});

test('6장: 스노글로브를 안 든 요정은 건넬 수 없고, 든 요정이 산타 앞에서 E로 건네면 그 순간 승리(시계 정지)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/?chapter=6&test&noshadow');
  await page.waitForFunction(() => !!(window as unknown as { __lastgift?: { finale?: unknown } }).__lastgift?.finale, null, { timeout: 30_000 });
  await page.waitForTimeout(300);
  const sp = await H(page, (h) => h.spots());
  expect((await H(page, (h) => h.finale())).globe).toMatchObject({ holder: null });
  // 안 든 채 산타 앞에서 E → 아무 일 없음
  await place(page, 'p0', sp.santa.x - 1.2, sp.santa.z + 0.4);
  await page.waitForTimeout(200);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(200);
  expect((await H(page, (h) => h.finale())).delivered).toBe(false);
  // 안전 지점의 스노글로브를 들고 산타 앞으로
  const g = await page.evaluate(() => (window as unknown as { __lastgift: { finale(): { globe: { x: number; z: number } } } }).__lastgift.finale().globe);
  await place(page, 'p0', g.x, g.z + 0.6);
  await page.waitForTimeout(200);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(200);
  expect((await H(page, (h) => h.finale())).globe?.holder).toBe('p0');
  await place(page, 'p0', sp.santa.x - 1.2, sp.santa.z + 0.4);
  await page.waitForTimeout(200);
  await page.keyboard.press('KeyE');
  await wait(page, '(h) => h.run().outcome === "win"', 5_000);
  expect((await H(page, (h) => h.run())).phase).toBe('ending');
});
