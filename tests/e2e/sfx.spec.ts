// STEP 09 효과음: 첫 키를 누르면 소리가 켜지고, 장 사건(집기)에 소리가 나며, 설정 「소리 끔」이면 나지 않는다.
import { expect, test, type Page } from '@playwright/test';

type Sfx = { log(): { name: string; muted: boolean; played: boolean }[]; state(): { ready: boolean; running: boolean; muted: boolean } };
const sfx = <T>(page: Page, f: (s: Sfx) => T) => page.evaluate((src) => new Function('s', `return (${src})(s)`)((window as unknown as { __lastgiftSfx: Sfx }).__lastgiftSfx), f.toString()) as Promise<T>;

async function open(page: Page) {
  await page.goto('/?chapter=3&test&noshadow&quality=low');
  await page.waitForFunction(() => !!(window as unknown as { __lastgift?: { ch3?: unknown } }).__lastgift?.ch3, null, { timeout: 30_000 });
  await page.waitForFunction(() => !!(window as unknown as { __lastgiftSfx?: unknown }).__lastgiftSfx);
}

test('첫 키로 소리가 켜지고, 공을 집으면 집기 소리 · 소리 끔이면 나지 않는다', async ({ page }) => {
  await open(page);
  expect(await sfx(page, (s) => s.state().running)).toBe(false); // 누르기 전에는 꺼져 있다(브라우저 규칙)
  await page.keyboard.press('KeyE'); // 1P는 공 옆에서 시작: E = 집기
  await page.waitForFunction(() => (window as unknown as { __lastgift: { ch3(): { ball: { carriedBy: string | null } } } }).__lastgift.ch3().ball.carriedBy === 'p0', null, { timeout: 5_000 });
  expect(await sfx(page, (s) => s.state().running)).toBe(true);
  expect(await sfx(page, (s) => s.log().filter((e) => e.name === 'pick' && e.played).length)).toBe(1);

  // 설정 → 소리 끔 → 내려놓기 소리는 기록만 되고 나지 않는다
  await page.locator('#settings-btn').click();
  await page.locator('[data-k="muted"] [data-v="true"]').click();
  await page.locator('#settings-panel .close').click();
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => (window as unknown as { __lastgift: { ch3(): { ball: { carriedBy: string | null } } } }).__lastgift.ch3().ball.carriedBy === null, null, { timeout: 5_000 });
  const drop = await sfx(page, (s) => s.log().filter((e) => e.name === 'drop'));
  expect(drop.length).toBeGreaterThan(0);
  expect(drop.every((e) => e.muted && !e.played)).toBe(true);
  // 다시 열어도 끔이 유지된다(이 기기 설정)
  await open(page);
  expect(await sfx(page, (s) => s.state().muted)).toBe(true);
});
