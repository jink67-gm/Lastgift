// 모델(glTF)을 불러오지 못해도 게임은 기본 도형으로 계속된다(명세서 §6).
import { expect, test, type Page } from '@playwright/test';
import './hook';

const failed = (page: Page) => page.evaluate(() => (window as unknown as { __lastgiftModels: { failed: string[] } }).__lastgiftModels.failed);

test('모델을 모두 불러오면 실패 목록이 비어 있다', async ({ page }) => {
  await page.goto('/?test');
  await page.waitForFunction(() => !!window.__lastgift);
  expect(await failed(page)).toEqual([]);
});

test('모델 요청이 모두 막혀도 광장이 열리고 요정이 움직이며 선물을 들 수 있다', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/models/**', (r) => r.abort());
  await page.goto('/?test');
  await page.waitForFunction(() => !!window.__lastgift);
  expect((await failed(page)).length).toBeGreaterThan(10);
  const a = await page.evaluate(() => window.__lastgift.player());
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyD');
  const b = await page.evaluate(() => window.__lastgift.player());
  expect(b.x).toBeGreaterThan(a.x + 0.5);
  await page.evaluate(() => window.__lastgift.setPlayer(4.7, 1.5, Math.PI / 2));
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__lastgift.actions())).toEqual(['pick']);
  expect(errors).toEqual([]);
});

test('2장도 모델 없이 열린다', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/models/**', (r) => r.abort());
  await page.goto('/?chapter=2&local&test');
  await page.waitForFunction(() => !!(window as unknown as { __lastgift?: { sewing?: unknown } }).__lastgift?.sewing);
  expect(errors).toEqual([]);
});

test('0장 프롤로그도 모델 없이(기본 도형 산타·도토·콩이) 끝까지 간다', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/models/**', (r) => r.abort());
  await page.goto('/?chapter=0&test&prologue&noshadow&slow=0.25');
  await page.waitForFunction(() => !!(window as unknown as { __lastgift?: { sorting?: unknown } }).__lastgift?.sorting);
  // 4배 빠르게 끝까지
  await page.waitForFunction(() => (window as unknown as { __lastgift: { run(): { phase: string } } }).__lastgift.run().phase === 'play', null, { timeout: 60_000 });
  expect(errors).toEqual([]);
});
