// STEP 08 플레이 기록: 장마다 움직인 시간·FPS·기기가 이 기기에 쌓이고, 설정 「기록」에서 보고 복사한다. FPS 표시는 모든 장에서.
import { expect, test } from '@playwright/test';

type Log = { chapterId: number; playSec: number; cutSec: number; fpsAvg: number; fpsLow: number; role: string; players: number; device: { w: number; h: number } };
const hook = (page: import('@playwright/test').Page, name: string) =>
  page.waitForFunction((n) => !!(window as unknown as { __lastgift?: Record<string, unknown> }).__lastgift?.[n], name, { timeout: 30_000 });

for (const [ch, name] of [[1, 'ch1'], [2, 'sewing'], [3, 'ch3'], [4, 'ch4'], [5, 'finale']] as const) {
  test(`${ch}장: 플레이 기록이 쌓이고 FPS 표시가 켜진다`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(`/?chapter=${ch}${ch === 2 ? '&local' : ''}&test&noshadow`);
    await hook(page, name);
    // 설정 → FPS 표시 켬
    await page.locator('#settings-btn').click();
    await page.locator('[data-k="showFps"] [data-v="true"]').click();
    await page.locator('#settings-panel .close').click();
    await page.waitForTimeout(2500);
    await expect(page.locator('#fps-chip')).toHaveText(/FPS \d+ · (보통|낮음)/);
    const log = await page.evaluate(() => (window as unknown as { __lastgift: { playLog(): Log } }).__lastgift.playLog());
    expect(log).toMatchObject({ chapterId: ch, role: 'local', players: 2, device: { w: 1280, h: 720 } });
    expect(log.playSec + log.cutSec).toBeGreaterThan(2);
    expect(log.fpsAvg).toBeGreaterThan(0);
    // 기록 보기: 표 글에 이 장 줄
    await page.locator('#settings-btn').click();
    await page.locator('[data-log="show"]').click();
    await expect(page.locator('#settings-panel textarea')).toHaveValue(new RegExp(`\\t${ch}장\\t한 기기\\t2\\t`));
  });
}
