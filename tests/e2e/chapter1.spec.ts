// 1장 04-4a: 돌 아치 → 우편함 골목 → 유나네 앞마당 찾기(실제 키). 지우의 그림 지도 펴기·접기.
// 1P는 두 선물(스케치북·색연필)이 든 물고기 자루를 등에 메고 시작한다. 현관 발판에서 E → 두 선물을 꺼내 놓는다.
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 640, height: 360 } });

type P = { id: string; x: number; z: number; mapOpen: boolean };
type S = { players: P[]; items: { id: string; carriedBy: string | null }[]; found: boolean };
const g = (page: Page) => page.evaluate(() => (window as unknown as { __lastgift: { ch1(): S } }).__lastgift.ch1());
const lane = (page: Page, x: number, z: number) =>
  page.evaluate(([x, z]) => (window as unknown as { __lastgift: { lane(x: number, z: number): { s: number; t: number } } }).__lastgift.lane(x, z), [x, z] as const);
const place = (page: Page, id: string, s: number, t: number) =>
  page.evaluate(([id, s, t]) => (window as unknown as { __lastgift: { debugPlace(id: string, s: number, t: number, f: number): void } }).__lastgift.debugPlace(id, s, t, Math.PI * 1.25), [id, s, t] as const);
async function hold(page: Page, keys: string[], ms: number) {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  for (const k of keys) await page.keyboard.up(k);
}

test('1장: 자루를 메고 골목을 올라가고, 빈손 E로 지도를 펴며, 유나네 나무 대문을 E로 열고 들어서면 찾았다', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?chapter=1&test&noshadow&noestablish');
  await page.waitForFunction(() => !!(window as unknown as { __lastgift?: { ch1?: unknown } }).__lastgift?.ch1, null, { timeout: 30_000 });
  await page.waitForTimeout(500);
  // 1P는 처음부터 자루를 멨다(선물은 자루 안)
  expect((await g(page)).items.find((i) => i.carriedBy === 'p0')?.id).toBe('sack');
  expect((await g(page)).items.filter((i) => i.carriedBy).length).toBe(1);
  // 위(W) = 골목 앞쪽: 들고 걸어도 골목 안
  const s0 = await g(page);
  const a = await lane(page, s0.players[0]!.x, s0.players[0]!.z);
  await hold(page, ['KeyW'], 1500);
  const s1 = await g(page);
  const b = await lane(page, s1.players[0]!.x, s1.players[0]!.z);
  expect(b.s - a.s).toBeGreaterThan(2);
  expect(Math.abs(b.t)).toBeLessThan(3.4);
  // 2P(빈손): 선물에서 떨어진 곳에서 Enter → 지도를 편다. 편 동안 움직이지 않는다
  await place(page, 'p1', 8, 1);
  await page.waitForTimeout(600);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => (window as unknown as { __lastgift: { maps(): boolean[] } }).__lastgift.maps())).toEqual([false, true]);
  await expect(page.locator('.jiu-map.r')).toHaveClass(/on/);
  const m0 = (await g(page)).players[1]!;
  await hold(page, ['ArrowUp'], 600);
  const m1 = (await g(page)).players[1]!;
  expect(Math.hypot(m1.x - m0.x, m1.z - m0.z)).toBeLessThan(0.05);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  expect((await g(page)).players[1]!.mapOpen).toBe(false);
  // 유나네 나무 대문 앞: 닫힌 대문은 막는다 → E로 빗장을 풀면 열리고, 위(W)로 들어서면 찾았다
  await place(page, 'p0', 40.6, 8.6);
  await page.waitForTimeout(500);
  await hold(page, ['KeyW'], 1200);
  expect((await g(page)).found).toBe(false);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(400);
  expect(((await g(page)) as S & { gateOpen: boolean }).gateOpen).toBe(true);
  await hold(page, ['KeyW'], 1500);
  expect((await g(page)).found).toBe(true);
  expect(errors).toEqual([]);
});

type Hook = {
  ch1(): S & { placed: string[]; complete: boolean; time: number };
  ch1Events(): { type: string; playerId?: string }[];
  run(): { phase: string; chapterId: number; memories: number[]; cutscene: string | null };
  gaze(): { phase: string };
  setTime(t: number): void;
  story(): number | null;
  ending(): number;
  debugPlace(id: string, s: number, t: number, f: number): void;
  lane(x: number, z: number): { s: number; t: number };
};
const H = <T>(page: Page, fn: (h: Hook) => T) => page.evaluate((f) => new Function('h', `return (${f})(h)`)((window as unknown as { __lastgift: Hook }).__lastgift), fn.toString()) as Promise<T>;

test('1장 시작 그림책: 그동안 시계가 멈춰 있고, 건너뛰면 바로 플레이', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/?chapter=1&test&story&noshadow');
  await page.waitForFunction(() => !!(window as unknown as { __lastgift?: { ch1?: unknown } }).__lastgift?.ch1, null, { timeout: 30_000 });
  await expect(page.locator('#storybook')).toBeVisible();
  await page.waitForTimeout(2500);
  expect(await H(page, (h) => h.story())).toBeGreaterThan(1);
  expect((await H(page, (h) => h.run())).phase).toBe('lobby');
  await expect(page.locator('#hud .timer .t')).toHaveText('05:00');
  await page.locator('#storybook button').click();
  await page.waitForFunction(() => (window as unknown as { __lastgift: Hook }).__lastgift.story() === null);
  await expect(page.locator('#storybook')).toHaveCount(0);
  expect((await H(page, (h) => h.run())).phase).toBe('play');
});

test('1장 들키지 않기: 유나가 창밖을 볼 때 움직이면 화면이 까매졌다가 대문 앞, 담 밖 종을 울리면 유나가 자리를 비운다', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?chapter=1&test&noshadow&noestablish');
  await page.waitForFunction(() => !!(window as unknown as { __lastgift?: { ch1?: unknown } }).__lastgift?.ch1, null, { timeout: 30_000 });
  await expect(page.locator('#peek')).toHaveCount(0); // 예전 엿보기 작은 화면은 없다
  // 유나가 창밖을 보기 시작한 직후로 시각을 맞추고, 앞마당 한가운데에서 1P가 오른쪽(D)으로 걷는다
  const look = await H(page, (h) => {
    for (let t = 0; t < 40; t += 0.02) {
      h.setTime(t);
      if (h.gaze().phase === 'look') return t;
    }
    return -1;
  });
  expect(look).toBeGreaterThan(0);
  await page.evaluate((t) => {
    const h = (window as unknown as { __lastgift: Hook }).__lastgift;
    h.setTime(t + 0.4);
    h.debugPlace('p0', 46.5, 0, Math.PI * 1.25);
  }, look);
  await page.keyboard.down('KeyD');
  await page.waitForFunction(() => (window as unknown as { __lastgift: Hook }).__lastgift.ch1Events().some((e) => e.type === 'caught'), null, { timeout: 10_000 });
  await page.keyboard.up('KeyD');
  await page.waitForFunction(() => (window as unknown as { __lastgift: Hook & { fade(): number } }).__lastgift.fade() > 0.6, null, { timeout: 5_000 });
  await page.waitForFunction(() => (window as unknown as { __lastgift: Hook & { fade(): number } }).__lastgift.fade() === 0, null, { timeout: 10_000 });
  const p0 = (await H(page, (h) => h.ch1())).players[0]!;
  const l = await page.evaluate(([x, z]) => (window as unknown as { __lastgift: Hook }).__lastgift.lane(x, z), [p0.x, p0.z] as const);
  expect(l.s).toBeLessThan(42.5); // 대문 앞(담 밖)
  expect((await H(page, (h) => h.gaze())).phase).toBe('away');
  // 앉기: 1P C(누르는 동안), 2P 오른쪽 Shift
  await page.keyboard.down('KeyC');
  await page.keyboard.down('ShiftRight');
  await page.waitForTimeout(300);
  expect((await H(page, (h) => h.ch1())).players.map((p) => (p as { crouching?: boolean }).crouching)).toEqual([true, true]);
  await page.keyboard.up('KeyC');
  await page.keyboard.up('ShiftRight');
  await page.waitForTimeout(300);
  expect((await H(page, (h) => h.ch1())).players[0]!).toMatchObject({ crouching: false });
  // 2P가 담 밖 종 앞에서 Enter → 유나가 창가를 떠난다
  await page.evaluate(() => (window as unknown as { __lastgift: Hook }).__lastgift.debugPlace('p1', 41.3, -7.2, Math.PI * 1.25));
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  expect((await H(page, (h) => h.ch1Events())).some((e) => e.type === 'bell' && e.playerId === 'p1')).toBe(true);
  expect((await H(page, (h) => h.gaze())).phase).toBe('gone');
  expect(errors).toEqual([]);
});

test('1장 배달: 현관에서 자루를 풀어 두 선물을 놓고 모두 물러나면 기억 1 → 끝 장면', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/?chapter=1&test&noshadow&noestablish');
  await page.waitForFunction(() => !!(window as unknown as { __lastgift?: { ch1?: unknown } }).__lastgift?.ch1, null, { timeout: 30_000 });
  await page.waitForTimeout(400);
  expect((await H(page, (h) => h.ch1())).items.find((i) => i.carriedBy === 'p0')?.id).toBe('sack');
  // 현관 앞으로(시각을 처음으로: 유나가 책상을 볼 때)
  await page.evaluate(() => {
    const h = (window as unknown as { __lastgift: Hook }).__lastgift;
    h.setTime(0.1);
    h.debugPlace('p0', 56.8, -2.8, Math.PI * 1.25);
    h.debugPlace('p1', 56.8, -1.4, Math.PI * 1.25);
  });
  await page.waitForTimeout(500);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(300);
  expect((await H(page, (h) => h.ch1Events())).some((e) => e.type === 'unpack' && e.playerId === 'p0')).toBe(true);
  expect((await H(page, (h) => h.ch1())).placed.sort()).toEqual(['pencils', 'sketchbook']);
  expect((await H(page, (h) => h.run())).phase).toBe('play');
  // 물러나면 완료
  await page.evaluate(() => {
    const h = (window as unknown as { __lastgift: Hook }).__lastgift;
    h.debugPlace('p0', 40, 8, 0);
    h.debugPlace('p1', 40, 9.5, 0);
  });
  await page.waitForFunction(() => (window as unknown as { __lastgift: Hook }).__lastgift.ending() > 1, null, { timeout: 30_000 });
  expect(await H(page, (h) => h.run())).toMatchObject({ phase: 'cutscene', chapterId: 2, memories: [1], cutscene: 'chapter1End' });
  expect((await H(page, (h) => h.ch1Events())).filter((e) => e.type === 'complete').length).toBe(1);
});
