// 3장 05a: 공방 옆문 → 울타리 샛길 → 민재네 마당. 실제 키로 공 들기·손 들기·울타리 너머 던져 받기, 쪽문 막힘, 콩이가 리본을 물기, 대문 안쪽에 내려놓으면 기억 3.
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 640, height: 360 } });

type Hook = {
  ch3(): {
    players: { id: string; x: number; z: number; handUp: boolean }[];
    ball: { x: number; z: number; carriedBy: string | null; flight: unknown };
    kongi: { mode: string; biting: string | null };
    complete: boolean;
    passes: number;
  };
  ch3Events(): { type: string; playerId?: string }[];
  run(): { phase: string; chapterId: number; memories: number[]; cutscene: string | null };
  ending(): number;
  adoption(): { t: number; beat: string | null };
  seekEnding(t: number): void;
  gateSigns(): boolean[];
  lane(x: number, z: number): { s: number; t: number };
  debugPlace(id: string, s: number, t: number, f: number): void;
  debugKongi(s: number, t: number, mode: string): void;
};
const H = <T>(page: Page, fn: (h: Hook) => T) => page.evaluate((f) => new Function('h', `return (${f})(h)`)((window as unknown as { __lastgift: Hook }).__lastgift), fn.toString()) as Promise<T>;
const place = (page: Page, id: string, s: number, t: number, f = Math.PI * 1.25) =>
  page.evaluate(([id, s, t, f]) => (window as unknown as { __lastgift: Hook }).__lastgift.debugPlace(id, s, t, f), [id, s, t, f] as const);
const dog = (page: Page, s: number, t: number, mode: string) =>
  page.evaluate(([s, t, mode]) => (window as unknown as { __lastgift: Hook }).__lastgift.debugKongi(s, t, mode), [s, t, mode] as const);
async function hold(page: Page, keys: string[], ms: number) {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  for (const k of keys) await page.keyboard.up(k);
}
async function open(page: Page) {
  await page.goto('/?chapter=3&test&noshadow&noestablish');
  await page.waitForFunction(() => !!(window as unknown as { __lastgift?: { ch3?: unknown } }).__lastgift?.ch3, null, { timeout: 30_000 });
  await page.waitForTimeout(400);
}

test('3장: 공을 들고, 울타리 너머 동료가 손을 들면(Enter) E로 던져 받는다. 공을 든 채로는 쪽문을 못 지나고 표시가 뜬다', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await dog(page, 60, 0, 'sleep'); // 콩이는 멀리
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(200);
  expect((await H(page, (h) => h.ch3())).ball.carriedBy).toBe('p0');
  // 공을 든 채 쪽문① 앞에서 위로: 막힌다 + 쪽문 표시
  await place(page, 'p0', 7.6, 3.6);
  await page.waitForTimeout(300);
  await hold(page, ['KeyW'], 900);
  const p0 = (await H(page, (h) => h.ch3())).players[0]!;
  expect((await page.evaluate(([x, z]) => (window as unknown as { __lastgift: Hook }).__lastgift.lane(x, z), [p0.x, p0.z] as const)).s).toBeLessThan(9);
  expect((await H(page, (h) => h.gateSigns()))[0]).toBe(true);
  // 2P가 울타리 너머에서 손을 든다 → 1P가 던진다 → 2P가 받는다
  await place(page, 'p0', 6.5, 0.5);
  await place(page, 'p1', 12, -0.5, Math.PI * 0.25);
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  expect((await H(page, (h) => h.ch3())).players[1]!.handUp).toBe(true);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => (window as unknown as { __lastgift: Hook }).__lastgift.ch3().ball.carriedBy === 'p1', null, { timeout: 5_000 });
  const s = await H(page, (h) => h.ch3());
  expect(s.passes).toBe(1);
  expect(s.players[1]!.handUp).toBe(false);
  const ev = (await H(page, (h) => h.ch3Events())).map((e) => e.type);
  expect(ev).toEqual(expect.arrayContaining(['pick', 'signal', 'throw', 'catch']));
  expect(errors).toEqual([]);
});

test('3장 콩이: 공이 가까이 오면 깨어 쫓아와 공을 든 요정의 리본을 문다(그동안 못 움직인다) → 놓아준다', async ({ page }) => {
  test.setTimeout(60_000);
  await open(page);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(200);
  await place(page, 'p0', 15, -1);
  await dog(page, 17.4, -3.6, 'sleep');
  await page.waitForFunction(() => (window as unknown as { __lastgift: Hook }).__lastgift.ch3().kongi.biting === 'p0', null, { timeout: 8_000 });
  const a = (await H(page, (h) => h.ch3())).players[0]!;
  await hold(page, ['KeyS'], 500);
  const b = (await H(page, (h) => h.ch3())).players[0]!;
  expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(0.01);
  await page.waitForFunction(() => (window as unknown as { __lastgift: Hook }).__lastgift.ch3Events().some((e) => e.type === 'release'), null, { timeout: 5_000 });
  const ev = (await H(page, (h) => h.ch3Events())).map((e) => e.type);
  expect(ev).toEqual(expect.arrayContaining(['wake', 'bite', 'release']));
});

test('3장 완료: 민재네 대문 안쪽 자리에 공을 내려놓으면 기억 3, 콩이는 공 둘레를 돈다', async ({ page }) => {
  test.setTimeout(60_000);
  await open(page);
  await dog(page, 30, 3, 'rest');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(200);
  await place(page, 'p0', 35.85, 2.6);
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => (window as unknown as { __lastgift: Hook }).__lastgift.ending() > 1, null, { timeout: 10_000 });
  expect(await H(page, (h) => h.run())).toMatchObject({ phase: 'cutscene', chapterId: 4, memories: [1, 2, 3], cutscene: 'chapter3End' });
  await page.waitForFunction(() => (window as unknown as { __lastgift: Hook }).__lastgift.ch3().kongi.mode === 'circle', null, { timeout: 10_000 });
  expect((await H(page, (h) => h.ch3Events())).filter((e) => e.type === 'complete').length).toBe(1);
});

test('3장 끝 장면: 민재가 나와 콩이를 맞고, 장갑에 볼을 비빈 뒤 안긴다(끝까지 오류 없이)', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await dog(page, 30, 3, 'rest');
  await page.keyboard.press('KeyE');
  await place(page, 'p0', 35.85, 2.6);
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => (window as unknown as { __lastgift: Hook }).__lastgift.ending() > 0.5, null, { timeout: 10_000 });
  const beats: string[] = [];
  for (const t of [1, 4.5, 7, 10, 14, 20, 24, 28, 33]) {
    await page.evaluate((t) => (window as unknown as { __lastgift: Hook }).__lastgift.seekEnding(t), t);
    await page.waitForTimeout(150);
    beats.push((await H(page, (h) => h.adoption())).beat!);
  }
  expect(beats).toEqual(['settle', 'minjae', 'greet', 'ball', 'family', 'blanket', 'ballIn', 'glove', 'hug']);
  await expect(page.locator('body')).toHaveClass(/cutscene/);
  expect(errors).toEqual([]);
});
