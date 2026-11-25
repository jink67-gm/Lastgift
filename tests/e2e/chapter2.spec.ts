// 2장 수선집: 한 키보드를 둘이 나눠 잡고(1P WASD+E, 2P 방향키+Enter) 재봉틀을 작업대까지 옮긴다.
// 테스트는 상태를 읽어 "어느 키를 얼마나 누를지"만 정하고, 실제 움직임은 진짜 키 입력으로 일어난다.
import { expect, test, type Page } from '@playwright/test';
import './hook';

interface P { id: string; x: number; z: number; holding: 0 | 1 | null; stamina: number; connected: boolean }
interface S {
  players: P[];
  crate: { x: number; z: number; yaw: number; lifted: boolean; place: string };
  handles: [string | null, string | null];
  door: { latched: boolean; open: boolean };
  space: 'yard' | 'workshop';
  transition: number;
  delivered: boolean;
}
type Ev = { type: string; [k: string]: unknown };

const KEYS = {
  p0: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', act: 'KeyE' },
  p1: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', act: 'Enter' },
} as const;
type Pid = keyof typeof KEYS;

const GRIP = 1.15;
const STAND = { x: 0, z: 4.4 };
const LATCH = { x: 1.65, z: 2.45 };
const BENCH = { x: 0, z: -9, yaw: Math.PI / 2 };

const st = (page: Page) => page.evaluate(() => window.__lastgift.sewing()) as Promise<S>;
const evs = (page: Page) => page.evaluate(() => window.__lastgift.sewingEvents());
const grip = (c: { x: number; z: number; yaw: number }, h: 0 | 1) => {
  const s = h === 0 ? -1 : 1;
  return { x: c.x + Math.sin(c.yaw) * GRIP * s, z: c.z + Math.cos(c.yaw) * GRIP * s };
};

/** 바닥 방향 → 누를 방향키(화면 기준 8방향) */
function keysFor(pid: Pid, gx: number, gz: number): string[] {
  const sx = (gx - gz) / Math.SQRT2;
  const sy = -(gx + gz) / Math.SQRT2;
  const len = Math.hypot(sx, sy) || 1;
  const k = KEYS[pid];
  const out: string[] = [];
  if (sx / len > 0.38) out.push(k.right);
  if (sx / len < -0.38) out.push(k.left);
  if (sy / len > 0.38) out.push(k.up);
  if (sy / len < -0.38) out.push(k.down);
  return out;
}

/** 각 요정에게 정해진 방향키를 ms만큼 함께 눌렀다 뗀다 */
async function hold(page: Page, plan: Partial<Record<Pid, string[]>>, ms: number) {
  const all = Object.values(plan).flat() as string[];
  for (const key of all) await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  for (const key of all) await page.keyboard.up(key);
}

async function walk(page: Page, pid: Pid, to: { x: number; z: number }, tol = 0.25) {
  for (let i = 0; i < 200; i++) {
    const p = (await st(page)).players.find((q) => q.id === pid)!;
    const d = Math.hypot(to.x - p.x, to.z - p.z);
    if (d < tol) return;
    await hold(page, { [pid]: keysFor(pid, to.x - p.x, to.z - p.z) }, Math.max(25, Math.min(120, (d / 3.6) * 800)));
  }
  throw new Error(`${pid} could not reach ${JSON.stringify(to)}`);
}

/** 두 운반자가 각자 자기 손잡이의 목표 위치로 걸어 상자를 목표 자세로 옮긴다 */
async function carry(page: Page, to: { x: number; z: number; yaw: number }, opts: { tol?: number; until?: (s: S) => boolean } = {}) {
  const tol = opts.tol ?? 0.2;
  for (let i = 0; i < 400; i++) {
    const s = await st(page);
    if (opts.until?.(s)) return s;
    const plan: Partial<Record<Pid, string[]>> = {};
    let need = 0;
    for (const h of [0, 1] as const) {
      const pid = s.handles[h] as Pid | null;
      if (!pid) throw new Error(`손잡이 ${h}를 놓쳤다: ${JSON.stringify(await evs(page))}`);
      const cur = grip(s.crate, h);
      const tgt = grip(to, h);
      const d = Math.hypot(tgt.x - cur.x, tgt.z - cur.z);
      if (d < tol) continue;
      need = Math.max(need, d);
      plan[pid] = keysFor(pid, tgt.x - cur.x, tgt.z - cur.z);
    }
    if (need === 0) return s;
    await hold(page, plan, Math.max(25, Math.min(120, (need / 2.2) * 700)));
  }
  throw new Error(`crate could not reach ${JSON.stringify(to)}: ${JSON.stringify((await st(page)).crate)}`);
}

const count = (e: Ev[], type: string) => e.filter((x) => x.type === type).length;
/** SHOTS=폴더 를 주면 중요한 순간을 찍어 둔다(검수 증빙용) */
const SHOTS = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.SHOTS;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

test('앞 요정이 먼저 문을 넘고, 뒤 요정이 문턱에서 멈췄다가 따라가도, 같은 재봉틀 하나를 두 사람이 계속 든 채 작업대에 내려놓는다', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?chapter=2&test');
  await page.waitForFunction(() => !!window.__lastgift?.sewing);
  expect((await page.evaluate(() => window.__lastgift.run())).chapterId).toBe(2);

  // 1) 뒤뜰: 1P가 손잡이 0, 2P가 손잡이 1을 잡는다
  let s = await st(page);
  await walk(page, 'p0', grip(s.crate, 0));
  await page.keyboard.press('KeyE');
  await walk(page, 'p1', grip(s.crate, 1));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  s = await st(page);
  expect(s.crate.lifted).toBe(true);
  expect(s.handles).toEqual(['p0', 'p1']);
  expect(s.door.open).toBe(false);

  // 2) 문 앞 받침대로 옮기고 긴 쪽을 문 방향으로 튼다(앞 = 2P)
  await carry(page, { ...STAND, yaw: Math.PI / 2 });
  await carry(page, { ...STAND, yaw: Math.PI }, { tol: 0.15 });

  // 3) 받침대에 내려놓고, 2P가 걸쇠를 건 뒤 다시 함께 든다
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  s = await st(page);
  expect(s.crate.place).toBe('stand');
  await walk(page, 'p1', LATCH, 0.3);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  s = await st(page);
  expect(s.door.latched).toBe(true);
  expect(s.door.open).toBe(true);
  await page.waitForTimeout(400);
  await shot(page, 'ch2_1_latched');
  await walk(page, 'p1', grip(s.crate, 1));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  s = await st(page);
  expect(s.crate.lifted).toBe(true);
  const grabsAfterLift = count(await evs(page), 'grab');
  const releasesAfterLift = count(await evs(page), 'release');

  // 4) 앞 요정(2P)이 먼저 통로 끝(작업실 입구)을 넘는다
  s = await carry(page, { x: 0, z: -2.6, yaw: Math.PI }, { until: (q) => q.players.find((p) => p.id === 'p1')!.z < -2 });
  const front = s.players.find((p) => p.id === 'p1')!;
  const rear = s.players.find((p) => p.id === 'p0')!;
  expect(front.z).toBeLessThan(-2);
  expect(rear.z).toBeGreaterThan(-2);
  expect(s.space).toBe('yard');

  // 5) 뒤 요정(1P)은 문턱 근처에서 멈추고, 앞 요정만 계속 밀어 본다.
  //    통로 안쪽(−z = 화면 오른쪽 위)으로 1초, 옆(통로 벽 쪽 = 화면 왼쪽 위)으로 0.5초.
  await hold(page, { p1: ['ArrowUp', 'ArrowRight'] }, 1000);
  await hold(page, { p1: ['ArrowUp', 'ArrowLeft'] }, 500);
  const s2 = await st(page);
  const rear2 = s2.players.find((p) => p.id === 'p0')!;
  expect(Math.hypot(rear2.x - rear.x, rear2.z - rear.z)).toBeLessThan(0.02); // 순간이동·끌려감 없음
  expect(s2.crate.lifted).toBe(true);
  expect(s2.space).toBe('yard');
  expect(count(await evs(page), 'spaceCommitted')).toBe(0);
  await shot(page, 'ch2_2_rear_waits');
  // 두 요정 모두 화면 안에 보인다
  for (const p of s2.players) {
    const sc = await page.evaluate(([x, z]) => window.__lastgift.toScreen(x, z), [p.x, p.z] as const);
    expect(sc.x).toBeGreaterThan(0);
    expect(sc.x).toBeLessThan(1280);
    expect(sc.y).toBeGreaterThan(0);
    expect(sc.y).toBeLessThan(720);
  }
  // 체력은 이어서 줄고 있다(초기화 없음)
  expect(s2.players.every((p) => p.stamina < 100)).toBe(true);

  // 6) 뒤 요정이 다시 출발 → 둘 다 넘으면 작업실을 한 번 확정
  s = await carry(page, { x: 0, z: -3.5, yaw: Math.PI }, { until: (q) => q.space === 'workshop' });
  expect(s.space).toBe('workshop');
  expect(s.transition).toBe(1);
  await page.waitForTimeout(600);
  await shot(page, 'ch2_3_workshop');
  expect(s.handles).toEqual(['p0', 'p1']);
  let e = await evs(page);
  expect(count(e, 'spaceCommitted')).toBe(1);
  expect(count(e, 'grab')).toBe(grabsAfterLift); // 문을 지나며 다시 집지 않았다
  expect(count(e, 'release')).toBe(releasesAfterLift); // 내려놓지도 않았다
  // 같은 장 안의 문이므로 체크포인트는 저장하지 않는다
  expect(await page.evaluate(() => window.__lastgift.runEffects())).not.toContain('save');
  expect(await page.evaluate(() => window.__lastgift.savedCheckpoint())).toBeNull();

  // 7) 작업대로 옮겨 긴 쪽을 작업대와 맞춘다
  await carry(page, { x: 0, z: -7.2, yaw: Math.PI });
  await carry(page, BENCH, { tol: 0.15 });
  s = await st(page);
  expect(s.crate.lifted).toBe(true);
  expect(s.handles).toEqual(['p0', 'p1']);

  // 8) 1P가 E로 내려놓는다 → 작업대 위, 2장 완료(기억 2), 이때 처음으로 체크포인트 저장
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(200);
  s = await st(page);
  expect(s.delivered).toBe(true);
  expect(s.crate.place).toBe('bench');
  e = await evs(page);
  expect(count(e, 'delivered')).toBe(1);
  expect(count(e, 'spaceCommitted')).toBe(1);
  expect(count(e, 'lift')).toBe(2); // 처음 한 번 + 받침대에서 다시 한 번
  expect(count(e, 'exhausted')).toBe(0); // 2인 팀이 쉼터(받침대)에서 작업대까지 지치지 않고 간다
  const run = await page.evaluate(() => window.__lastgift.run());
  expect(run.completedChapters).toContain(2);
  expect(run.memories).toEqual([1, 2]);
  const saved = JSON.parse((await page.evaluate(() => window.__lastgift.savedCheckpoint()))!);
  expect(saved).toMatchObject({ chapterId: 3, memories: [1, 2] });
  await page.waitForTimeout(300);
  await shot(page, 'ch2_4_bench');
  expect(errors).toEqual([]);
});
