// 팀 시계·일시중지·시간 초과·저장을 실제 브라우저에서 확인한다.
import { expect, test, type Page } from '@playwright/test';
import './hook';

async function open(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?test');
  await page.waitForFunction(() => !!window.__lastgift);
  return errors;
}

const run = (page: Page) => page.evaluate(() => window.__lastgift.run());

/** 탭 숨김/보임을 흉내 낸다(헤드리스에서는 실제로 탭을 바꿀 수 없다) */
async function setHidden(page: Page, hidden: boolean) {
  await page.evaluate((h) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

test('화면 위에 30:00부터 줄어드는 팀 시계가 보이고, 시작 체크포인트가 저장된다', async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator('#hud .timer')).toBeVisible();
  // 첫 화면(장면·셰이더 준비)이 느린 기기에서도: 처음 읽은 값은 30:00 이하, 2.2초 뒤에는 약 2초 줄었다
  const sec = (t: string | null) => {
    const [m, s] = (t ?? '0:0').split(':').map(Number);
    return m! * 60 + s!;
  };
  const first = sec(await page.locator('#hud .timer .t').textContent());
  expect(first).toBeLessThanOrEqual(30 * 60);
  expect(first).toBeGreaterThanOrEqual(30 * 60 - 6);
  await page.waitForTimeout(2200);
  const later = sec(await page.locator('#hud .timer .t').textContent());
  expect(first - later).toBeGreaterThanOrEqual(1);
  expect(first - later).toBeLessThanOrEqual(3);
  const saved = await page.evaluate(() => localStorage.getItem('lastgift.cp.v1.local'));
  expect(JSON.parse(saved!)).toMatchObject({ chapterId: 0, savedRemainingMs: 1_800_000, retryCount: 0 });
  await expect(page.locator('#hud .save-error')).toBeHidden();
  expect(errors).toEqual([]);
});

test('방장 탭이 숨으면 시계와 요정이 멈추고, 돌아오면 3초 카운트다운 뒤 다시 흐른다', async ({ page }) => {
  await open(page);
  await page.waitForTimeout(300);
  await setHidden(page, true);
  const a = await run(page);
  expect(a.pauseReasons).toEqual(['hostHidden']);
  await page.keyboard.down('KeyD'); // 일시중지 중 입력은 버린다
  await page.waitForTimeout(1500);
  const b = await run(page);
  expect(b.remaining).toBe(a.remaining);
  expect((await page.evaluate(() => window.__lastgift.player())).moving).toBe(false);
  await page.keyboard.up('KeyD');

  await setHidden(page, false);
  await page.waitForTimeout(100);
  await expect(page.locator('#overlay')).toHaveAttribute('data-kind', 'countdown');
  await expect(page.locator('#overlay')).toHaveText('3');
  const c = await run(page);
  expect(c.remaining).toBe(a.remaining); // 카운트다운 동안도 멈춤
  await page.waitForTimeout(3300);
  await expect(page.locator('#overlay')).toHaveAttribute('data-kind', 'none');
  const d = await run(page);
  expect(d.remaining).toBeLessThan(a.remaining);
});

test('0초가 되면 시간 초과 화면 → 「다시 하기」로 같은 장 시작, 새로고침해도 이어진다', async ({ page }) => {
  await open(page);
  const runId = (await run(page)).runId;
  await page.evaluate(() => window.__lastgift.skipTime(1_800_000 + 50));
  await expect(page.locator('#overlay')).toHaveAttribute('data-kind', 'timeout');
  expect((await run(page)).phase).toBe('timeout');
  await expect(page.locator('#overlay button')).toBeFocused(); // 키보드로 바로 누를 수 있다
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const r = await run(page);
  expect(r.phase).toBe('play');
  expect(r.retryCount).toBe(1);
  expect(r.remaining).toBeGreaterThan(1_799_000);
  await expect(page.locator('#overlay')).toHaveAttribute('data-kind', 'none');
  expect((await page.evaluate(() => window.__lastgift.runEffects())).filter((e) => e === 'timeout')).toHaveLength(1);

  await page.reload();
  await page.waitForFunction(() => !!window.__lastgift);
  const after = await run(page);
  expect(after.runId).toBe(runId);
  expect(after.retryCount).toBe(1);
  expect(after.chapterId).toBe(0);
});

test('저장소를 쓸 수 없으면 저장 실패 그림이 뜨고 게임은 계속된다', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
  });
  const errors = await open(page);
  await expect(page.locator('#hud .save-error')).toBeVisible();
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyD');
  expect((await page.evaluate(() => window.__lastgift.player())).x).toBeGreaterThan(3.5);
  expect(errors).toEqual([]);
});
