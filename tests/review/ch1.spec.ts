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
    ['d_alley8', 8, 0],
    ['d2_deadendA', 8.6, -14],
    ['e_postbox', 19, 0],
    ['e2_leftUp', 27, -25],
    ['e3_corner', 37.5, -22],
    ['e4_neighborC', 39.5, -17],
    ['e5_rightB', 33, 22],
    ['f_yunaGate', 40.4, 7.4],
    ['g_inyard', 46, 8],
    ['h_lookout_logs', 44.0, -3.3],
    ['i_porch', 50.2, 2.4],
  ];
  for (const [name, s, t] of spots) {
    await hook(page, 'debugPlace', 'p0', s, t, Math.PI);
    await hook(page, 'debugPlace', 'p1', s - 1.2, t + 1.0, Math.PI);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    if (name === 'f_yunaGate') {
      await hook(page, 'debugPlace', 'p0', 41.2, 8.6, Math.PI);
      await page.waitForTimeout(300);
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${OUT}/f2_gateOpen.png` });
    }
  }
  // 지우 지도: 빈손 2P가 집을 것 없는 데서 Enter(1P는 자루를 멨다)
  await hook(page, 'debugPlace', 'p0', 13.8, 0.8, Math.PI);
  await hook(page, 'debugPlace', 'p1', 15, 0, Math.PI);
  await page.waitForTimeout(800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/j_map.png` });
  await page.keyboard.press('Enter');
  // 현관 발판에서 자루를 풀어 두 선물을 꺼낸다
  await hook(page, 'setTime', 0.1);
  await hook(page, 'debugPlace', 'p0', 49.4, 0.2, Math.PI * 1.25);
  await hook(page, 'debugPlace', 'p1', 47.6, 2.2, Math.PI * 1.25);
  await page.waitForTimeout(1200);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/j_unpacked.png` });
  // 끝 장면
  await hook(page, 'debugWin');
  for (const t of [0.5, 2.5, 4.5, 6.5, 8.5, 10.5]) {
    await hook(page, 'seekEnding', t);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/k_ending_${t.toFixed(1).padStart(4, '0')}.png` });
  }
});
