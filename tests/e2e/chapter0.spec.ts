// 0장 선물 분류: 한 키보드를 둘이 나눠 잡고(1P WASD+E, 2P 방향키+Enter) 실제 키로 끝까지 진행한다.
import { CARRY_SPEED } from '../../src/core/sewing';
import { expect, test, type Page } from '@playwright/test';

interface P { id: string; x: number; z: number; facing: number; holding: 0 | 1 | null }
interface It { id: string; x: number; z: number; carriedBy: string | null; sorted: boolean; homeX: number; homeZ: number }
interface S {
  sewing: { players: P[]; crate: { x: number; z: number; yaw: number; lifted: boolean }; handles: [string | null, string | null] };
  items: It[];
  crateSorted: boolean;
  complete: boolean;
}
type Ev = { type: string; [k: string]: unknown };

// 실제 키로 끝까지 걷는 긴 시험: 작은 창으로 그려 소프트웨어 WebGL 부담을 줄인다
test.use({ viewport: { width: 640, height: 360 } });

const call = <T>(page: Page, name: string) =>
  page.evaluate((n) => (window as unknown as { __lastgift: Record<string, () => unknown> }).__lastgift[n]!(), name) as Promise<T>;
const st = (page: Page) => call<S>(page, 'sorting');
const evs = (page: Page) => call<Ev[]>(page, 'sortEvents');

const KEYS = {
  p0: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', act: 'KeyE' },
  p1: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', act: 'Enter' },
} as const;
type Pid = keyof typeof KEYS;
const GRIP = 1.15;
// 둥근 광장(docs/PLAZA_PLAN.md): 표식 = 골목 입구(반지름 13)
const MARK = { yuna: { x: 6.1, z: -11.48 }, tailor: { x: 12.87, z: 1.81 }, minjae: { x: -8.0, z: 10.24 }, grandma: { x: -12.5, z: -3.58 } };

function keysFor(pid: Pid, gx: number, gz: number): string[] {
  const sx = (gx - gz) / Math.SQRT2, sy = -(gx + gz) / Math.SQRT2;
  const len = Math.hypot(sx, sy) || 1;
  const k = KEYS[pid], out: string[] = [];
  if (sx / len > 0.38) out.push(k.right);
  if (sx / len < -0.38) out.push(k.left);
  if (sy / len > 0.38) out.push(k.up);
  if (sy / len < -0.38) out.push(k.down);
  return out;
}
/** 누른 키 조합이 땅에서 가리키는 단위 방향(keysFor의 반대) */
function groundOf(pid: Pid, keys: string[]): { x: number; z: number } {
  const k = KEYS[pid];
  const sx = (keys.includes(k.right) ? 1 : 0) - (keys.includes(k.left) ? 1 : 0);
  const sy = (keys.includes(k.up) ? 1 : 0) - (keys.includes(k.down) ? 1 : 0);
  const gx = (sx - sy) / Math.SQRT2, gz = (-sx - sy) / Math.SQRT2;
  const l = Math.hypot(gx, gz) || 1;
  return { x: gx / l, z: gz / l };
}
async function hold(page: Page, plan: Partial<Record<Pid, string[]>>, ms: number) {
  const all = Object.values(plan).flat() as string[];
  for (const k of all) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  for (const k of all) await page.keyboard.up(k);
}
let lag = 120;
async function walk(page: Page, pid: Pid, path: { x: number; z: number }[], tol = 0.25) {
  for (const to of path) {
    let ok = false;
    let p = (await st(page)).sewing.players.find((q) => q.id === pid)!;
    for (let i = 0; i < 120 && !ok; i++) {
      p = (await st(page)).sewing.players.find((q) => q.id === pid)!;
      const d = Math.hypot(to.x - p.x, to.z - p.z);
      if (d < tol) ok = true;
      else {
        // 8방향 키라서: 고른 방향으로 남은 거리의 투영만큼만 누른다(남는 옆 성분은 다음 번에 다른 방향으로)
        const keys = keysFor(pid, to.x - p.x, to.z - p.z);
        const g = groundOf(pid, keys);
        const proj = g.x * (to.x - p.x) + g.z * (to.z - p.z);
        // 키를 누르고 떼는 사이의 지연(브라우저·프레임)을 재서 빼 준다
        const ms = Math.max(8, Math.min(1500, (proj / 3.6) * 1000 * 0.85 - lag));
        await hold(page, { [pid]: keys }, ms);
        const q = (await st(page)).sewing.players.find((r) => r.id === pid)!;
        const moved = g.x * (q.x - p.x) + g.z * (q.z - p.z);
        if (moved > 0.05) lag = Math.max(0, Math.min(400, 0.6 * lag + 0.4 * ((moved / 3.6) * 1000 - ms)));
      }
    }
    if (!ok) throw new Error(`${pid} could not reach ${JSON.stringify(to)} (stuck at ${p.x.toFixed(2)}, ${p.z.toFixed(2)}) ${JSON.stringify((await st(page)).sewing.players)}`);
  }
}
async function press(page: Page, pid: Pid) {
  await page.keyboard.press(KEYS[pid].act);
  await page.waitForTimeout(120);
}
/** 선물 옆까지 걸어가 집고, 경로를 따라가 마지막 지점에서 표식 쪽을 보고 놓는다 */
async function bring(page: Page, pid: Pid, itemId: string, path: { x: number; z: number }[], mark: { x: number; z: number }, tol = 0.25) {
  const it = (await st(page)).items.find((i) => i.id === itemId)!;
  await walk(page, pid, [{ x: it.x - 0.5, z: it.z }]);
  await press(page, pid);
  expect((await st(page)).items.find((i) => i.id === itemId)!.carriedBy).toBe(pid);
  await walk(page, pid, path, tol);
  // 표식 가운데 쪽으로 짧게 한 번 걸어 그쪽을 보게 한 뒤 놓는다
  const p = (await st(page)).sewing.players.find((q) => q.id === pid)!;
  await hold(page, { [pid]: keysFor(pid, mark.x - p.x, mark.z - p.z) }, 60);
  await press(page, pid);
}
const grip = (c: { x: number; z: number; yaw: number }, h: 0 | 1) => {
  const s = h === 0 ? -1 : 1;
  return { x: c.x + Math.sin(c.yaw) * GRIP * s, z: c.z + Math.cos(c.yaw) * GRIP * s };
};
async function carry(page: Page, to: { x: number; z: number; yaw: number }) {
  for (let i = 0; i < 500; i++) {
    const s = await st(page);
    const plan: Partial<Record<Pid, string[]>> = {};
    let need = 0;
    for (const h of [0, 1] as const) {
      const pid = s.sewing.handles[h] as Pid | null;
      if (!pid) throw new Error(`손잡이를 놓쳤다 i=${i} crate=${JSON.stringify(s.sewing.crate)} to=${JSON.stringify(to)} players=${JSON.stringify(s.sewing.players.map((q) => [q.id, q.x, q.z, (q as { stamina?: number }).stamina]))} ${JSON.stringify((await evs(page)).filter((e) => e.type === 'sewing').slice(-4))}`);
      const cur = grip(s.sewing.crate, h), tgt = grip(to, h);
      const d = Math.hypot(tgt.x - cur.x, tgt.z - cur.z);
      if (d < 0.25) continue;
      need = Math.max(need, d);
      plan[pid] = keysFor(pid, tgt.x - cur.x, tgt.z - cur.z);
    }
    if (need === 0) return;
    await hold(page, plan, Math.max(25, Math.min(800, (need / CARRY_SPEED) * 600)));
  }
  throw new Error(`crate could not reach ${JSON.stringify(to)}`);
}
const count = (e: Ev[], t: string) => e.filter((x) => x.type === t).length;

test('두 요정이 선물 다섯 개를 그림 표식 네 곳에 나눠 놓으면 0장 완료(틀린 표식은 원래 자리로)', async ({ page }) => {
  test.setTimeout(480_000); // 실제 키로 끝까지 걷는다(소프트웨어 WebGL에서 약 4분)
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?chapter=0&test&noshadow'); // 규칙 시험: 그림자는 꺼서 소프트웨어 WebGL 부담을 줄인다(화면은 비교 촬영으로 확인)
  await page.waitForFunction(() => !!(window as unknown as { __lastgift?: { sorting?: unknown } }).__lastgift?.sorting, null, { timeout: 30_000 });

  // 1P: 스케치북 → 유나네(물고기)
  // (트리 화단 동쪽 → 산타 동쪽으로 돌아 북쪽 골목 입구)
  await bring(page, 'p0', 'sketchbook', [{ x: 8.5, z: 4 }, { x: 8.5, z: -8.5 }, { x: 6.5, z: -10.5 }], MARK.yuna);
  let s = await st(page);
  expect(s.items.find((i) => i.id === 'sketchbook')!.sorted).toBe(true);

  // 1P: 축구공을 일부러 유나네에 → 원래 자리로 돌아간다
  await walk(page, 'p0', [{ x: 8.5, z: -8.5 }, { x: 8.5, z: -1.5 }]);
  await bring(page, 'p0', 'ball', [{ x: 8.5, z: -1.5 }, { x: 8.5, z: -8.5 }, { x: 6.5, z: -10.5 }], MARK.yuna);
  s = await st(page);
  const ball = s.items.find((i) => i.id === 'ball')!;
  expect(ball.sorted).toBe(false);
  expect([ball.x, ball.z]).toEqual([ball.homeX, ball.homeZ]);
  expect(count(await evs(page), 'wrong')).toBe(1);

  // 2P: 색연필 통 → 유나네, 수리 상자 → 할머니 댁(트리 있는 집)
  // (재봉틀 상자 남쪽으로 돌아 동쪽 → 북쪽 골목 입구)
  await bring(page, 'p1', 'pencils', [{ x: -4, z: 7.6 }, { x: 4.5, z: 7.6 }, { x: 8.5, z: 4 }, { x: 8.5, z: -8.5 }, { x: 6.5, z: -10.2 }], MARK.yuna);
  // 썰매 북쪽(공방 앞)을 지나 수리 상자 쪽으로 → 할머니 댁(트리 있는 집) 골목
  await walk(page, 'p1', [{ x: 3, z: -9.6 }, { x: -1.5, z: -9.4 }, { x: -2.5, z: -6.2 }]);
  await bring(page, 'p1', 'repair', [{ x: -8, z: -4 }, { x: -11, z: -3.6 }], MARK.grandma, 0.5);
  // 1P: 축구공 → 민재네(눈사람): 산타 동쪽으로 내려와 재봉틀 상자 남쪽을 지나
  await walk(page, 'p0', [{ x: 8.5, z: -8.5 }, { x: 8.5, z: -1.5 }]);
  await bring(page, 'p0', 'ball', [{ x: 8.5, z: 7.6 }, { x: -5, z: 9.4 }, { x: -7, z: 9.8 }], MARK.minjae);
  s = await st(page);
  expect(s.items.every((i) => i.sorted)).toBe(true);
  expect(s.complete).toBe(false); // 재봉틀이 아직

  // 재봉틀: 혼자서는 안 들린다 → 둘이 양끝을 잡아 수선집(단추)으로
  const c = s.sewing.crate;
  await walk(page, 'p0', [{ x: -3, z: 8.2 }, { x: 0.2, z: 6.4 }, grip(c, 0)], 0.25);
  await press(page, 'p0');
  expect((await st(page)).sewing.crate.lifted).toBe(false);
  await walk(page, 'p1', [{ x: -8, z: 4.8 }, { x: -3, z: 7.6 }, { x: 3.6, z: 7.6 }, grip(c, 1)], 0.25);
  await press(page, 'p1');
  expect((await st(page)).sewing.crate.lifted).toBe(true);
  for (const wp of [{ x: 7, z: 4.4 }, { x: 12.4, z: 2.0 }]) await carry(page, { ...wp, yaw: Math.PI / 2 });
  await press(page, 'p0');
  s = await st(page);
  expect(s.crateSorted).toBe(true);
  expect(s.complete).toBe(true);
  expect(count(await evs(page), 'complete')).toBe(1);

  // 0장 완료 → 1장 최초 체크포인트 저장
  const run = await call<{ completedChapters: number[]; chapterId: number }>(page, 'run');
  expect(run.completedChapters).toContain(0);
  expect(JSON.parse((await call<string>(page, 'savedCheckpoint'))!)).toMatchObject({ chapterId: 1 });
  expect(errors).toEqual([]);
});

test('공방 골목: 두 요정이 실제 키로 광장 → 작업대 앞 → 공방 문턱까지 걷고, 문 앞에서 집·문짝에 가려지지 않는다', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/?chapter=0&test&noshadow');
  await page.waitForFunction(() => !!(window as unknown as { __lastgift?: { sorting?: unknown } }).__lastgift?.sorting, null, { timeout: 30_000 });
  // 1P: 광장 → 트리 화단 서쪽 → 작업대 앞 → 공방 문턱(문 = 앞면 왼쪽 칸)
  await walk(page, 'p0', [{ x: -5, z: 6 }, { x: -6, z: -2 }, { x: -8.6, z: -7.6 }, { x: -9.3, z: -9.3 }]);
  // 2P: 같은 길로 뒤따라 문 옆에 선다(두 요정이 엇갈릴 여유)
  await walk(page, 'p1', [{ x: -4, z: 7 }, { x: -5.4, z: -3 }, { x: -7.9, z: -8.0 }]);
  const s = await st(page);
  const p0 = s.sewing.players.find((p) => p.id === 'p0')!;
  expect(Math.hypot(p0.x + 9.3, p0.z + 9.3)).toBeLessThan(0.3);
  await page.waitForTimeout(600);
  // 문 앞 두 요정을 가리는 큰 물체가 없다(공방·문짝은 흐려지지 않는다)
  const faded = await call<string[]>(page, 'faded');
  expect(faded.filter((n) => n === 'workshop' || n === 'sleigh')).toEqual([]);
});

test('가벼운 선물은 두 손 위에 얹고, 걸을 때 손·몸과 함께 움직인다', async ({ page }) => {
  test.setTimeout(120_000);
  type Hold = {
    id: string;
    hands: { y: number; fwd: number; apart: number } | null;
    chin: number;
    gift: { id: string; across: number; bottom: number; top: number; ahead: number; fromHands: number; origin: { y: number } } | null;
  };
  await page.goto('/?chapter=0&test&noshadow');
  await page.waitForFunction(() => !!(window as unknown as { __lastgift?: { sorting?: unknown } }).__lastgift?.sorting, null, { timeout: 30_000 });
  const place = (a: [number, number, number], b: [number, number, number]) =>
    page.evaluate(([a, b]) => {
      const g = (window as unknown as { __lastgift: { debugPlace(id: string, x: number, z: number, f: number): void } }).__lastgift;
      g.debugPlace('p0', a[0], a[1], a[2]);
      g.debugPlace('p1', b[0], b[1], b[2]);
    }, [a, b] as const);
  const info = () => call<Hold[]>(page, 'holdInfo');
  const check = async (ids: string[]) => {
    const all = await info();
    expect(all.map((h) => h.gift?.id)).toEqual(ids);
    for (const h of all) {
      const g = h.gift!;
      // 손 위에 얹혀 있다: 바닥이 손목보다 조금 위, 몸 앞
      expect(g.bottom - h.hands!.y, `${g.id} 손 위`).toBeGreaterThan(-0.01);
      expect(g.bottom - h.hands!.y, `${g.id} 손 위`).toBeLessThan(0.08);
      expect(g.ahead, `${g.id} 몸 앞`).toBeGreaterThan(0.15);
      // 두 손이 물건 바닥 아래에 있다(물건보다 넓게 벌리지 않는다)
      expect(h.hands!.apart, `${g.id} 손 사이`).toBeLessThan(g.across + 0.06);
    }
  };
  // 스케치북·공
  await place([5.4, 5.5, Math.PI / 2], [7, -0.9, Math.PI]);
  await page.waitForTimeout(800);
  await page.keyboard.press('KeyE');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  await check(['sketchbook', 'ball']);
  // 방향을 바꿔도
  await place([-2, 7, Math.PI / 4], [0.2, 7, -Math.PI / 4]);
  await page.waitForTimeout(900);
  await check(['sketchbook', 'ball']);
  // 걷는 동안: 선물이 손과 함께 오르내린다(손에서 떨어진 거리는 그대로, 높이는 손을 따라 바뀐다)
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(500);
  const samples: Hold[] = [];
  for (let i = 0; i < 6; i++) {
    samples.push((await info())[0]!);
    await page.waitForTimeout(70);
  }
  await page.keyboard.up('KeyA');
  const dist = samples.map((h) => h.gift!.fromHands);
  expect(Math.max(...dist) - Math.min(...dist)).toBeLessThan(0.005);
  const rel = samples.map((h) => h.gift!.origin.y - h.hands!.y);
  expect(Math.max(...rel) - Math.min(...rel)).toBeLessThan(0.01);
  // 내려놓고 색연필 통·수리 상자
  await page.keyboard.press('KeyE');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  await place([-4.5, 5.4, 0], [-4.5, -3.9, Math.PI]);
  await page.waitForTimeout(800);
  await page.keyboard.press('KeyE');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  await check(['pencils', 'repair']);
});
