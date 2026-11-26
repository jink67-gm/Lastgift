// 실제 브라우저에서 물리 키 입력으로 요정을 움직여 본다.
import { expect, test, type Page } from '@playwright/test';

import './hook';

const player = (page: Page) => page.evaluate(() => window.__lastgift.player());

async function open(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?test');
  await page.waitForFunction(() => !!window.__lastgift);
  return errors;
}

/** 키를 누르고 있는 동안 요정이 화면에서 어느 쪽으로 움직였는지(px) */
async function screenDelta(page: Page, code: string, ms = 600) {
  await page.evaluate(() => window.__lastgift.setPlayer(3, 4));
  const a = await player(page);
  await page.keyboard.down(code);
  await page.waitForTimeout(ms);
  await page.keyboard.up(code);
  const b = await player(page);
  return page.evaluate(
    ([a, b]) => {
      const s0 = window.__lastgift.toScreen(a.x, a.z);
      const s1 = window.__lastgift.toScreen(b.x, b.z);
      return { dx: s1.x - s0.x, dy: s1.y - s0.y };
    },
    [a, b] as const,
  );
}

test('콘솔 오류 없이 광장이 열린다', async ({ page }) => {
  const errors = await open(page);
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

const cases: [string, 'up' | 'down' | 'left' | 'right'][] = [
  ['KeyW', 'up'], ['ArrowUp', 'up'],
  ['KeyS', 'down'], ['ArrowDown', 'down'],
  ['KeyA', 'left'], ['ArrowLeft', 'left'],
  ['KeyD', 'right'], ['ArrowRight', 'right'],
];
for (const [code, dir] of cases) {
  test(`${code} → 화면 ${dir} 방향으로 이동`, async ({ page }) => {
    await open(page);
    const { dx, dy } = await screenDelta(page, code);
    const main = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx;
    const side = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
    expect(main).toBeGreaterThan(40); // 충분히 움직였고
    expect(side).toBeLessThan(main * 0.05); // 화면 기준으로 곧게 갔다
  });
}

test('한글 입력 상태처럼 key가 "ㅈ"로 와도 code가 KeyW면 위로 간다', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.__lastgift.setPlayer(3, 4));
  const a = await player(page);
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'ㅈ', keyCode: 229 })));
  await page.waitForTimeout(500);
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'ㅈ', keyCode: 229 })));
  const b = await player(page);
  const d = await page.evaluate(
    ([a, b]) => window.__lastgift.toScreen(b.x, b.z).y - window.__lastgift.toScreen(a.x, a.z).y,
    [a, b] as const,
  );
  expect(d).toBeLessThan(-30);
});

test('썰매 눈더미로 걸어 들어가도 뚫지 않고 옆으로 미끄러진다', async ({ page }) => {
  await open(page);
  // 눈더미(중심 0,-2 / 반지름 2.6)의 비스듬한 앞에서 화면 위쪽(눈더미 쪽)으로 민다
  await page.evaluate(() => window.__lastgift.setPlayer(2, 1));
  await page.keyboard.down('KeyW');
  let inside = false;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(100);
    inside ||= await page.evaluate(() => window.__lastgift.insideCollider());
  }
  await page.keyboard.up('KeyW');
  expect(inside).toBe(false);
  const p = await player(page);
  expect(Math.hypot(p.x - 0, p.z + 2)).toBeGreaterThanOrEqual(2.6 + 0.35 - 0.01);
});

test('오래 걸어도 광장 밖으로 나가지 않는다', async ({ page }) => {
  await open(page);
  await page.keyboard.down('KeyS');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(6000);
  await page.keyboard.up('KeyS');
  await page.keyboard.up('KeyD');
  const p = await player(page);
  expect(p.x).toBeLessThanOrEqual(20 - 0.35 + 1e-6);
  expect(p.z).toBeLessThanOrEqual(14 - 0.35 + 1e-6);
});

test('키를 누른 채 창이 포커스를 잃으면 요정이 멈춘다', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.__lastgift.setPlayer(3, 4));
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(200);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForTimeout(100);
  const a = await player(page);
  await page.waitForTimeout(400);
  const b = await player(page);
  await page.keyboard.up('KeyW');
  expect(b.moving).toBe(false);
  expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(0.01);
});

test('E로 선물을 들고, 다시 E로 앞에 내려놓는다', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.__lastgift.setPlayer(4.7, 1.5, Math.PI / 2));
  await page.waitForTimeout(100);
  await expect(page.locator('#key-hint')).toBeVisible(); // [E] + 들기 그림
  await page.keyboard.down('KeyE');
  await page.waitForTimeout(500); // 길게 눌러도 한 번
  await page.keyboard.up('KeyE');
  let sketch = (await page.evaluate(() => window.__lastgift.items())).find((i) => i.id === 'sketchbook')!;
  expect(sketch.carriedBy).toBe('p0');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(100);
  sketch = (await page.evaluate(() => window.__lastgift.items())).find((i) => i.id === 'sketchbook')!;
  expect(sketch.carriedBy).toBeNull();
  expect(await page.evaluate(() => window.__lastgift.actions())).toEqual(['pick', 'drop']);
});

test('무거운 재봉틀은 E를 눌러도 혼자 들리지 않는다', async ({ page }) => {
  await open(page);
  // 재봉틀 상자(-7, 0, 길이 1.6) 오른쪽 끝 앞에서 왼쪽(-x)을 본다
  await page.evaluate(() => window.__lastgift.setPlayer(-5.75, 0, -Math.PI / 2));
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__lastgift.actions())).toEqual(['tooHeavy']);
  const sewing = (await page.evaluate(() => window.__lastgift.items())).find((i) => i.id === 'sewing')!;
  expect(sewing.carriedBy).toBeNull();
});
