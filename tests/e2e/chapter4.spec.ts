// 4장 05c: 담장길 → 정원문 → 할머니네 정원. 실제 키로 발전기·연결판 놓기, 전선 끼우기, 발전기 길게 돌리기, 스위치 둘(협동 4초·시간 초과),
// 1인 연습(제한 시간 12초 이상, 저장은 본편과 따로).
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 640, height: 360 } });

type Hook = {
  ch4(): {
    mode: string;
    items: { id: string; carriedBy: string | null }[];
    placed: { generator: boolean; board: boolean };
    plugged: Record<string, boolean>;
    charge: number;
    charged: boolean;
    switches: { A: boolean; B: boolean };
    window: number;
    complete: boolean;
  };
  ch4Events(): { type: string }[];
  run(): { phase: string; chapterId: number; memories: number[]; progress: Record<string, unknown>; roomId: string };
  ending(): number;
  timer(): number | null;
  debugPlace(id: string, s: number, t: number, f?: number): void;
  debugStage(stage: 'placed' | 'wired' | 'charged'): void;
};
const H = <T>(page: Page, fn: (h: Hook) => T) => page.evaluate((f) => new Function('h', `return (${f})(h)`)((window as unknown as { __lastgift: Hook }).__lastgift), fn.toString()) as Promise<T>;
const FWD = Math.PI * 1.25; // 길 앞쪽(화면 위)
const place = (page: Page, id: string, s: number, t: number, f = FWD) =>
  page.evaluate(([id, s, t, f]) => (window as unknown as { __lastgift: Hook }).__lastgift.debugPlace(id, s, t, f), [id, s, t, f] as const);
async function open(page: Page, q = '') {
  await page.goto(`/?chapter=4&test&noshadow&noestablish${q}`);
  await page.waitForFunction(() => !!(window as unknown as { __lastgift?: { ch4?: unknown } }).__lastgift?.ch4, null, { timeout: 30_000 });
  await page.waitForTimeout(400);
}

test('4장: 발전기·연결판을 트리 앞 자리에 놓고, 빨간 전선을 빨강·동그라미 단자에 끼우고(다른 단자는 안 맞음), 발전기를 길게 돌려 충전한다', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await page.keyboard.press('KeyE');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  expect((await H(page, (h) => h.ch4())).items.filter((i) => i.carriedBy).length).toBe(2);
  await place(page, 'p0', 20.2, -2.6);
  await place(page, 'p1', 20.2, 2.6);
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  let s = await H(page, (h) => h.ch4());
  expect(s.placed).toEqual({ generator: true, board: true });
  expect(s.items.map((i) => i.id).sort()).toEqual(['plug-blue', 'plug-red', 'plug-yellow']);
  // 빨간 전선 끝 집기
  await place(page, 'p0', 19.5, 2.6);
  await page.waitForTimeout(200);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(200);
  expect((await H(page, (h) => h.ch4())).items.find((i) => i.carriedBy === 'p0')?.id).toBe('plug-red');
  // 파랑·세모 단자 앞: 안 맞는다
  await place(page, 'p0', 21.2, 0);
  await page.waitForTimeout(200);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(200);
  expect((await H(page, (h) => h.ch4Events())).some((e) => e.type === 'wrong')).toBe(true);
  // 빨강·동그라미 단자 앞: 끼워진다
  await place(page, 'p0', 25, -4.0);
  await page.waitForTimeout(200);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(300);
  s = await H(page, (h) => h.ch4());
  expect(s.plugged.red).toBe(true);
  expect((await H(page, (h) => h.run())).progress).toMatchObject({ wires: 1 });
  // 나머지 전선은 건너뛰고, 발전기 손잡이 앞에서 E를 길게
  await H(page, (h) => h.debugStage('wired'));
  await place(page, 'p0', 20.0, -2.6);
  await page.waitForTimeout(200);
  await page.keyboard.down('KeyE');
  await page.waitForFunction(() => (window as unknown as { __lastgift: Hook }).__lastgift.ch4().charged, null, { timeout: 12_000 });
  await page.keyboard.up('KeyE');
  expect((await H(page, (h) => h.run())).progress).toMatchObject({ wires: 3, charged: true });
  expect(errors).toEqual([]);
});

test('4장 스위치(협동): 첫 스위치에 시간 막대, 4초가 지나면 스위치만 풀린다 → 다시 둘을 시간 안에 누르면 트리 점등·기억 4', async ({ page }) => {
  test.setTimeout(60_000);
  await open(page);
  await H(page, (h) => h.debugStage('charged'));
  await place(page, 'p0', 24.0, -8.2);
  await place(page, 'p1', 24.0, 8.2);
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(300);
  expect(await H(page, (h) => h.timer())).toBeGreaterThan(0.5);
  await expect(page.locator('#switch-timer')).toBeVisible();
  // 시간 초과: 스위치 쌍만 풀린다
  await page.waitForFunction(() => (window as unknown as { __lastgift: Hook }).__lastgift.ch4Events().some((e) => e.type === 'timeout'), null, { timeout: 8_000 });
  let s = await H(page, (h) => h.ch4());
  expect(s.switches).toEqual({ A: false, B: false });
  expect(s.charged).toBe(true);
  expect((await H(page, (h) => h.run())).progress).toEqual({ wires: 3, charged: true });
  // 다시: 둘이 하나씩
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as unknown as { __lastgift: Hook }).__lastgift.ending() > 1, null, { timeout: 10_000 });
  s = await H(page, (h) => h.ch4());
  expect(s.complete).toBe(true);
  expect(await H(page, (h) => h.run())).toMatchObject({ phase: 'cutscene', chapterId: 5, memories: [1, 2, 3, 4] });
});

test('4장 1인 연습: 정원에서 바로, 제한 시간 12초 이상, 혼자 두 스위치를 눌러 점등. 저장은 본편과 따로', async ({ page }) => {
  test.setTimeout(60_000);
  await open(page, '&solo');
  let s = await H(page, (h) => h.ch4());
  expect(s.mode).toBe('solo');
  expect(s.window).toBeGreaterThanOrEqual(12);
  expect(s.placed).toEqual({ generator: true, board: true });
  expect((await H(page, (h) => h.run())).roomId).toBe('practice-ch4');
  await H(page, (h) => h.debugStage('charged'));
  await place(page, 'p0', 24.0, -8.2);
  await page.waitForTimeout(250);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(250);
  // 혼자 B로 가서 누른다(시험은 자리만 옮긴다: 실제 걸어가는 왕복은 단위 시험)
  await page.waitForTimeout(5000);
  await place(page, 'p0', 24.0, 8.2);
  await page.waitForTimeout(250);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => (window as unknown as { __lastgift: Hook }).__lastgift.ch4().complete, null, { timeout: 5_000 });
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes('cp')));
  expect(keys.some((k) => k.includes('practice-ch4'))).toBe(true);
  expect(keys.some((k) => k.includes('dev-ch4'))).toBe(false);
  s = await H(page, (h) => h.ch4());
  expect(s.complete).toBe(true);
});
