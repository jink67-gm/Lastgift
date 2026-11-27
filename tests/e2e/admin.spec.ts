// 관리자 점검 모드(?admin): 「관리」 단추 → 장 고르기·바로 끝내기·연출 건너뛰기. 학생 화면(주소에 admin 없음)에는 없다
import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });

test('관리자 모드: 주소에 admin이 없으면 단추가 없고, 있으면 장을 바로 끝내 끝 장면을 볼 수 있다', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?chapter=3');
  await page.waitForFunction(() => !!document.querySelector('#hud'), null, { timeout: 60_000 });
  await expect(page.locator('#admin-btn')).toHaveCount(0);

  await page.goto('/?chapter=3&admin');
  await expect(page.locator('#admin-btn')).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(() => typeof (window as unknown as { __lastgift?: { debugWin?: unknown } }).__lastgift?.debugWin === 'function', null, { timeout: 60_000 });
  await page.locator('#admin-btn').click();
  await expect(page.locator('#admin-panel')).toBeVisible();
  await page.locator('#admin-panel [data-act=skip]').click();
  await page.locator('#admin-btn').click();
  await page.locator('#admin-panel [data-act=win]').click();
  await page.waitForFunction(() => (window as unknown as { __lastgift: { ending(): number } }).__lastgift.ending() >= 0, null, { timeout: 30_000 });
  // 이 탭에서는 장을 옮겨도 관리자 모드가 이어진다
  await page.goto('/?chapter=1');
  await expect(page.locator('#admin-btn')).toBeVisible({ timeout: 60_000 });
  expect(errors).toEqual([]);
});
