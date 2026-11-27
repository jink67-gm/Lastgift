// 장면 점검 촬영: 프롤로그 도토 장면만(빠르게). 실행: npx playwright test --project=review prologue-doto
import { test } from '@playwright/test';
test('프롤로그 도토 장면', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/?chapter=0&test&prologue&slow=3');
  await page.waitForFunction(() => !!(window as unknown as { __lastgift?: { prologue?: () => unknown } }).__lastgift?.prologue?.(), null, { timeout: 60_000 });
  for (const t of [30.8, 31.8, 33.2]) {
    await page.waitForFunction((tt) => ((window as unknown as { __lastgift: { prologue(): { t: number } | null } }).__lastgift.prologue()?.t ?? 99) >= tt, t, { timeout: 200_000 });
    await page.screenshot({ path: `docs/screens/review/ch0/prologue_${t.toFixed(1)}.png` });
  }
});
