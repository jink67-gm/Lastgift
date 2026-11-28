// 장면 점검 촬영: 1장(그림책 → 골목 → 지도 → 앞마당·창가·현관 → 끝 장면). 실행: npx playwright test --project=review ch1
import { test, type Page } from '@playwright/test';

const OUT = 'docs/screens/review/ch1';
type H = Record<string, (...a: unknown[]) => unknown>;
const hook = <T>(page: Page, name: string, ...args: unknown[]) =>
  page.evaluate(([n, a]) => (window as unknown as { __lastgift: H }).__lastgift[n as string]!(...(a as unknown[])), [name, args] as const) as Promise<T>;

test('1장 장면', async ({ page }) => {
  test.setTimeout(600_000);
  await page.goto('/?chapter=1&test&story');
  await page.waitForFunction(() => (window as unknown as { __lastgift?: { story?: () => number | null } }).__lastgift?.story?.() !== undefined, null, { timeout: 60_000 });
  // 그림책(지우 카드)
  for (const t of [1, 3, 5, 7, 9, 11]) {
    const ok = await page
      .waitForFunction((tt) => ((window as unknown as { __lastgift: { story(): number | null } }).__lastgift.story() ?? 99) >= tt, t, { timeout: 30_000 })
      .then(() => true)
      .catch(() => false);
    if (!ok) break;
    await page.screenshot({ path: `${OUT}/a_story_${String(t).padStart(2, '0')}.png` });
  }
  await hook(page, 'skipStory');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/b_start.png` });
  // 골목을 따라
  const spots: [string, number, number][] = [
    ['c_arch', -4, 0],
    ['d_alley10', 10, 0],
    ['e_alley25', 25, 0],
    ['f_yardfront', 39.5, 2],
    ['g_inyard', 46, 8],
    ['h_lookout_logs', 44.0, -3.3],
    ['i_porch', 50.2, 2.4],
  ];
  for (const [name, s, t] of spots) {
    await hook(page, 'debugPlace', 'p0', s, t, Math.PI);
    await hook(page, 'debugPlace', 'p1', s - 1.2, t + 1.0, Math.PI);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${OUT}/${name}.png` });
  }
  // 지우 지도: 빈손 1P가 집을 것 없는 데서 E
  await hook(page, 'debugPlace', 'p0', 15, 0, Math.PI);
  await page.waitForTimeout(800);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/j_map.png` });
  await page.keyboard.press('KeyE');
  // 끝 장면
  await hook(page, 'debugWin');
  for (const t of [0.5, 2.5, 4.5, 6.5, 8.5, 10.5]) {
    await hook(page, 'seekEnding', t);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/k_ending_${t.toFixed(1).padStart(4, '0')}.png` });
  }
});
