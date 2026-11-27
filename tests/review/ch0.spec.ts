// 장면 점검 촬영: 프롤로그(시간대별)와 0장 플레이. 실행: npx playwright test --project=review ch0
import { test, type Page } from '@playwright/test';

const OUT = 'docs/screens/review/ch0';
const hook = <T>(page: Page, name: string, ...args: unknown[]) =>
  page.evaluate(([n, a]) => (window as unknown as { __lastgift: Record<string, (...x: unknown[]) => unknown> }).__lastgift[n as string]!(...(a as unknown[])), [name, args] as const) as Promise<T>;

test('프롤로그 시간대별', async ({ page }) => {
  test.setTimeout(600_000);
  // 3배 느리게: 화면을 찍는 동안 장면이 덜 지나가게
  await page.goto('/?chapter=0&test&prologue&slow=3');
  await page.waitForFunction(() => !!(window as unknown as { __lastgift?: { prologue?: () => unknown } }).__lastgift?.prologue?.(), null, { timeout: 60_000 });
  const times = [1.0, 3.0, 4.6, 5.3, 7.0, 9.8, 13.0, 16.0, 18.8, 20.6, 22.5, 25.5, 27.6, 29.8, 31.8, 33.2, 34.4, 35.8];
  for (const t of times) {
    await page.waitForFunction((tt) => ((window as unknown as { __lastgift: { prologue(): { t: number } | null } }).__lastgift.prologue()?.t ?? 99) >= tt, t, { timeout: 200_000 });
    await page.screenshot({ path: `${OUT}/prologue_${t.toFixed(1).padStart(4, '0')}.png` });
  }
});

test('0장 플레이', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/?chapter=0&test');
  await page.waitForFunction(() => !!(window as unknown as { __lastgift?: { sorting?: unknown } }).__lastgift?.sorting, null, { timeout: 60_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/play_00_start.png` });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${OUT}/play_01_after_establish.png` });
  // 1P를 몇 걸음 움직여 걷는 모습
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/play_02_walk.png` });
  await page.keyboard.up('KeyW');
  void hook;
});
