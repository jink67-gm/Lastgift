// 실제 Chromium에 터치 지점을 직접 보낸다(CDP Input.dispatchTouchEvent).
// 손가락 여러 개를 동시에 누르고, 하나만 떼고, 취소하는 상황을 재현한다.
import { expect, test, type CDPSession, type Page } from '@playwright/test';
import './hook';

test.use({ hasTouch: true, viewport: { width: 1280, height: 800 } });

/** 현재 화면에 닿아 있는 손가락들. 보낼 때마다 전체 목록을 보내면 브라우저가 바뀐 손가락만 처리한다. */
class Fingers {
  private readonly pts = new Map<number, { x: number; y: number }>();
  constructor(private readonly cdp: CDPSession) {}
  private send(type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel') {
    const touchPoints = [...this.pts].map(([id, p]) => ({ id, x: p.x, y: p.y, radiusX: 8, radiusY: 8, force: 1 }));
    return this.cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  }
  down(id: number, x: number, y: number) {
    this.pts.set(id, { x, y });
    return this.send('touchStart');
  }
  move(id: number, x: number, y: number) {
    this.pts.set(id, { x, y });
    return this.send('touchMove');
  }
  /** 이 손가락만 뗀다(다른 손가락은 그대로) */
  up(id: number) {
    this.pts.delete(id);
    return this.pts.size === 0 ? this.send('touchEnd') : this.send('touchMove');
  }
  cancel() {
    this.pts.clear();
    return this.send('touchCancel');
  }
}

async function open(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?test&quality=low'); // 입력 시험: 그래픽 부담을 줄여 손가락 사이 시간이 벌어지지 않게
  await page.waitForFunction(() => !!window.__lastgift);
  const fingers = new Fingers(await page.context().newCDPSession(page));
  return { errors, fingers };
}

const player = (page: Page) => page.evaluate(() => window.__lastgift.player());
const actionCenter = async (page: Page) => {
  const b = (await page.locator('#action-btn').boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

test('처음 터치하면 스틱과 행동 버튼이 나타나고, 버튼은 48px 이상이며 화면 안에 있다', async ({ page }) => {
  const { errors, fingers } = await open(page);
  await fingers.down(1, 300, 600);
  await fingers.up(1);
  await expect(page.locator('#action-btn')).toBeVisible();
  for (const vp of [{ width: 1280, height: 800 }, { width: 800, height: 1280 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(200);
    const b = (await page.locator('#action-btn').boundingBox())!;
    expect(b.width).toBeGreaterThanOrEqual(48);
    expect(b.height).toBeGreaterThanOrEqual(48);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(vp.width);
    expect(b.y + b.height).toBeLessThanOrEqual(vp.height);
    const s = (await page.locator('#stick-base').boundingBox())!;
    expect(s.x).toBeGreaterThanOrEqual(0);
    expect(s.y + s.height).toBeLessThanOrEqual(vp.height);
    // 스틱과 행동 버튼 사이 여백 8px 이상
    expect(b.x - (s.x + s.width)).toBeGreaterThanOrEqual(8);
  }
  expect(errors).toEqual([]);
});

test('스틱을 위로 끌면 요정이 화면 위로 간다', async ({ page }) => {
  const { fingers } = await open(page);
  await page.evaluate(() => window.__lastgift.setPlayer(6, 7));
  const a = await player(page);
  await fingers.down(1, 250, 600);
  await fingers.move(1, 250, 480);
  await page.waitForTimeout(600);
  await fingers.up(1);
  const b = await player(page);
  const d = await page.evaluate(
    ([a, b]) => {
      const s0 = window.__lastgift.toScreen(a.x, a.z);
      const s1 = window.__lastgift.toScreen(b.x, b.z);
      return { dx: s1.x - s0.x, dy: s1.y - s0.y };
    },
    [a, b] as const,
  );
  expect(-d.dy).toBeGreaterThan(40);
  expect(Math.abs(d.dx)).toBeLessThan(-d.dy * 0.05);
});

test('두 손가락: 스틱으로 걷는 중에 행동 버튼을 탭하면 선물을 들고, 이동은 끊기지 않으며, 행동은 한 번만', async ({ page }) => {
  const { fingers } = await open(page);
  // 스케치북(5.5, 1.5) 왼쪽 0.8 m에 서서, 스틱을 그쪽(월드 +x = 화면 오른쪽 아래)으로 민다
  await fingers.down(9, 10, 10); // 터치 모드 켜기(버튼 위치를 미리 읽기 위해)
  await fingers.up(9);
  const btn = await actionCenter(page);
  await page.evaluate(() => window.__lastgift.setPlayer(4.7, 1.5, Math.PI / 2));
  await fingers.down(1, 250, 600); // 손가락 1: 스틱
  await fingers.move(1, 278, 628); // 반쯤 밀기(약 2.4 m/s)
  await fingers.down(2, btn.x, btn.y); // 손가락 2: 행동 버튼(스틱은 그대로)
  await page.waitForTimeout(150);
  const mid = await player(page);
  expect(mid.moving).toBe(true);
  await fingers.up(2); // 행동 손가락만 뗀다
  await page.waitForTimeout(300);
  const later = await player(page);
  expect(later.moving).toBe(true); // 스틱 손가락은 아직 닿아 있으므로 계속 걷는다
  expect(Math.hypot(later.x - mid.x, later.z - mid.z)).toBeGreaterThan(0.5);
  await fingers.up(1);
  await page.waitForTimeout(100);
  expect((await player(page)).moving).toBe(false);

  expect(await page.evaluate(() => window.__lastgift.actions())).toEqual(['pick']);
  const sketch = (await page.evaluate(() => window.__lastgift.items())).find((i) => i.id === 'sketchbook')!;
  expect(sketch.carriedBy).toBe('p0');
});

test('행동 버튼을 길게 눌러도 행동은 한 번, 다시 탭하면 내려놓는다', async ({ page }) => {
  const { fingers } = await open(page);
  await page.evaluate(() => window.__lastgift.setPlayer(4.7, 1.5, Math.PI / 2));
  await fingers.down(9, 10, 10); // 터치 모드 켜기
  await fingers.up(9);
  const btn = await actionCenter(page);
  await fingers.down(2, btn.x, btn.y);
  await page.waitForTimeout(700);
  await fingers.up(2);
  expect(await page.evaluate(() => window.__lastgift.actions())).toEqual(['pick']);
  await fingers.down(3, btn.x, btn.y);
  await fingers.up(3);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__lastgift.actions())).toEqual(['pick', 'drop']);
});

test('터치가 취소되면(알림·제스처 등) 요정이 멈춘다', async ({ page }) => {
  const { fingers } = await open(page);
  await page.evaluate(() => window.__lastgift.setPlayer(6, 7));
  await fingers.down(1, 250, 600);
  await fingers.move(1, 250, 480);
  await page.waitForTimeout(200);
  await fingers.cancel();
  await page.waitForTimeout(100);
  const a = await player(page);
  await page.waitForTimeout(300);
  const b = await player(page);
  expect(b.moving).toBe(false);
  expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(0.01);
});

test('손가락이 화면 밖으로 미끄러져 나가 떼어져도 요정이 멈춘다', async ({ page }) => {
  const { fingers } = await open(page);
  await page.evaluate(() => window.__lastgift.setPlayer(6, 7));
  await fingers.down(1, 120, 600);
  await fingers.move(1, 40, 600);
  await fingers.move(1, 0, 600); // 화면 왼쪽 끝
  await page.waitForTimeout(200);
  await fingers.up(1);
  await page.waitForTimeout(100);
  const a = await player(page);
  await page.waitForTimeout(300);
  const b = await player(page);
  expect(b.moving).toBe(false);
  expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(0.01);
});

test('걷는 중에 화면을 돌리면(가로→세로) 입력이 해제된다', async ({ page }) => {
  const { fingers } = await open(page);
  await page.evaluate(() => window.__lastgift.setPlayer(6, 7));
  await fingers.down(1, 250, 600);
  await fingers.move(1, 250, 480);
  await page.waitForTimeout(200);
  await page.setViewportSize({ width: 800, height: 1280 });
  await page.waitForTimeout(150);
  const a = await player(page);
  await page.waitForTimeout(300);
  const b = await player(page);
  expect(b.moving).toBe(false);
  expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(0.01);
  await fingers.cancel();
});
