// 실제 브라우저에서 물리 키 입력으로 요정을 움직여 본다.
import { expect, test, type Page } from '@playwright/test';

interface Hook {
  player(): { x: number; z: number; facing: number; moving: boolean };
  setPlayer(x: number, z: number): void;
  toScreen(x: number, z: number): { x: number; y: number };
  insideCollider(): boolean;
}
declare global {
  interface Window {
    __lastgift: Hook;
  }
}

const player = (page: Page) => page.evaluate(() => window.__lastgift.player());

async function open(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?test');
  await page.waitForFunction(() => !!window.__lastgift);
  await page.locator('canvas').click(); // 포커스
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
  // 눈더미(중심 0,-2 / 반지름 2.2)의 비스듬한 앞에서 화면 위쪽(눈더미 쪽)으로 민다
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
  expect(Math.hypot(p.x - 0, p.z + 2)).toBeGreaterThanOrEqual(2.2 + 0.35 - 0.01);
});

test('오래 걸어도 광장 밖으로 나가지 않는다', async ({ page }) => {
  await open(page);
  await page.keyboard.down('KeyS');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(6000);
  await page.keyboard.up('KeyS');
  await page.keyboard.up('KeyD');
  const p = await player(page);
  expect(p.x).toBeLessThanOrEqual(15 - 0.35 + 1e-6);
  expect(p.z).toBeLessThanOrEqual(10 - 0.35 + 1e-6);
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
