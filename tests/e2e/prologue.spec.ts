// 프롤로그(STEP 04-3): 새 시도면 단체사진 → 사진 뒤집기 → 썰매 불시착 연출 뒤 0장 플레이. 연출 중에는 팀 시계가 멈춘다.
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 640, height: 360 } });

type Pro = { t: number; beat: string; done: boolean } | null;
type Actor = { visible: boolean; x: number; z: number; top: number; bottom: number };
const hook = <T>(page: Page, name: string) =>
  page.evaluate((n) => (window as unknown as { __lastgift: Record<string, () => unknown> }).__lastgift[n]!(), name) as Promise<T>;
const ready = (page: Page) =>
  page.waitForFunction(() => !!(window as unknown as { __lastgift?: { sorting?: unknown } }).__lastgift?.sorting, null, { timeout: 30_000 });

test('새 시도: 썰매 비행(산타·요정·도토가 하늘에서 썰매에 타고 있다) → 불시착 → 플레이. 연출 동안 시계는 30:00', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?chapter=0&test&prologue&noshadow');
  await ready(page);
  // 연출 중: 조작 버튼을 숨기고, 건너뛰기 버튼이 있다. 사진 뷰파인더·사진 카드는 이제 없다
  await expect(page.locator('#pro-skip')).toBeVisible();
  expect(await page.evaluate(() => document.body.classList.contains('cutscene'))).toBe(true);
  await expect(page.locator('#pro-finder')).toBeHidden();
  // 썰매 옆 구간: 산타·도토가 하늘 높이(썰매 안)에 있고, 콩이는 없다
  await page.waitForFunction(() => {
    const p = (window as unknown as { __lastgift: { prologue(): Pro } }).__lastgift.prologue();
    return !!p && p.t > 4.2 && p.beat === 'flight';
  }, null, { timeout: 60_000, polling: 16 });
  const sky = await hook<Record<string, Actor>>(page, 'actors');
  expect(sky.santa!.visible && sky.doto!.visible).toBe(true);
  expect(sky.santa!.bottom).toBeGreaterThan(15);
  expect(sky.doto!.bottom).toBeGreaterThan(15);
  expect(sky.kongi!.visible).toBe(false);
  // 5장 단체사진 구도는 처음에 정해 저장한다
  const photo = await hook<{ elves: { slot: number }[] } | null>(page, 'photo');
  expect(photo?.elves.map((e) => e.slot)).toEqual([0, 1]);
  // 연출 중 팀 시계는 멈춰 있다
  expect(await hook<{ phase: string }>(page, 'run')).toMatchObject({ phase: 'cutscene' });
  await expect(page.locator('#hud .timer .t')).toHaveText('30:00');
  // 불시착 뒤: 산타·도토가 보이고 끝나면 플레이
  await page.waitForFunction(() => {
    const p = (window as unknown as { __lastgift: { prologue(): Pro } }).__lastgift.prologue();
    return !p || p.done;
  }, null, { timeout: 120_000 });
  await expect(page.locator('#pro-skip')).toHaveCount(0, { timeout: 5_000 });
  expect(await hook<{ phase: string }>(page, 'run')).toMatchObject({ phase: 'play' });
  const actors = await hook<Record<string, Actor>>(page, 'actors');
  expect(actors.santa!.visible).toBe(true);
  expect(actors.doto!.visible).toBe(true);
  expect(actors.kongi!.visible).toBe(false); // 콩이는 3장에서 만난다
  expect(actors.santa!.top).toBeGreaterThan(4); // 사람 어른 크기
  // 선물·재봉틀 상자는 0장 시작 자리
  const s = await hook<{ items: { id: string; x: number; z: number }[]; sewing: { crate: { x: number; z: number } } }>(page, 'sorting');
  expect(s.items.map((i) => i.id)).toEqual(['sketchbook', 'pencils', 'ball', 'repair']);
  // 플레이가 시작되면 시계가 흐른다
  await page.waitForTimeout(2200);
  await expect(page.locator('#hud .timer .t')).not.toHaveText('30:00');
  expect(errors).toEqual([]);
});

test('건너뛰기: 버튼 한 번에 같은 끝 모습(산타·도토 제자리)으로 플레이, 사진 구도도 저장', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/?chapter=0&test&prologue&noshadow');
  await ready(page);
  await page.locator('#pro-skip').click();
  await page.waitForFunction(() => {
    const p = (window as unknown as { __lastgift: { prologue(): Pro } }).__lastgift.prologue();
    return !p || p.done;
  });
  expect(await hook<{ phase: string }>(page, 'run')).toMatchObject({ phase: 'play' });
  expect(await hook<unknown>(page, 'photo')).not.toBeNull();
  const a = await hook<Record<string, Actor>>(page, 'actors');
  expect(a.santa!.visible && a.doto!.visible).toBe(true);
  // 썰매(3.6, -6.6) 기준: 산타는 앞코 남쪽에서 받치고, 도토는 썰매 날 남쪽 뒤(건너뛰어도 비행 자세가 남지 않는다)
  expect(Math.hypot(a.santa!.x - 6.2, a.santa!.z + 4.3)).toBeLessThan(0.05);
  expect(Math.hypot(a.doto!.x - 2.2, a.doto!.z + 4.75)).toBeLessThan(0.05);
  expect(a.santa!.bottom).toBeLessThan(0.1);
  expect(a.doto!.bottom).toBeLessThan(0.2);
  // 건너뛴 뒤 바로 움직일 수 있다
  const before = (await hook<{ sewing: { players: { x: number; z: number }[] } }>(page, 'sorting')).sewing.players[0]!;
  await page.waitForTimeout(600);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyD');
  const after = (await hook<{ sewing: { players: { x: number; z: number }[] } }>(page, 'sorting')).sewing.players[0]!;
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(0.3);
});

test('이어 하기(저장된 체크포인트)면 프롤로그를 다시 틀지 않는다', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/?chapter=0&test&prologue&noshadow');
  await ready(page);
  await page.keyboard.press('Escape'); // Esc도 건너뛰기
  await page.waitForFunction(() => (window as unknown as { __lastgift: { run(): { phase: string } } }).__lastgift.run().phase === 'play');
  await page.reload();
  await ready(page);
  expect(await hook<Pro>(page, 'prologue')).toBeNull();
  await expect(page.locator('#pro-skip')).toHaveCount(0);
  expect(await hook<{ phase: string }>(page, 'run')).toMatchObject({ phase: 'play' });
  // 저장된 사진 구도는 그대로
  expect(await hook<unknown>(page, 'photo')).not.toBeNull();
});
