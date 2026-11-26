// 두~세 기기 시험: 브라우저 창(각자 다른 기기 역할)마다 자기 키보드로 자기 요정을 움직인다.
// 처음 소개는 Firebase(에뮬레이터), 게임 데이터는 WebRTC로 창끼리 직접. 판정은 방장 창만 한다.
// 실행: npm run test:net (에뮬레이터를 켜고 규칙을 올린 뒤 실행된다)
import { expect, test, type Browser, type Page } from '@playwright/test';

type Slot = 'p0' | 'p1' | 'p2';
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

const call = <T>(page: Page, name: string, ...args: unknown[]) =>
  page.evaluate(
    ([n, a]) => (window as unknown as { __lastgift: Record<string, (...x: unknown[]) => unknown> }).__lastgift[n as string]!(...(a as unknown[])),
    [name, args] as const,
  ) as Promise<T>;

const GRIP = 1.15;
const STAND = { x: 0, z: 4.4 };
const LATCH = { x: 1.65, z: 2.45 };
const BENCH = { x: 0, z: -9, yaw: Math.PI / 2 };
const KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', act: 'KeyE' };

const grip = (c: { x: number; z: number; yaw: number }, h: 0 | 1) => {
  const s = h === 0 ? -1 : 1;
  return { x: c.x + Math.sin(c.yaw) * GRIP * s, z: c.z + Math.cos(c.yaw) * GRIP * s };
};

function keysFor(gx: number, gz: number): string[] {
  const sx = (gx - gz) / Math.SQRT2;
  const sy = -(gx + gz) / Math.SQRT2;
  const len = Math.hypot(sx, sy) || 1;
  const out: string[] = [];
  if (sx / len > 0.38) out.push(KEYS.right);
  if (sx / len < -0.38) out.push(KEYS.left);
  if (sy / len > 0.38) out.push(KEYS.up);
  if (sy / len < -0.38) out.push(KEYS.down);
  return out;
}

/** 누른 키 조합이 땅에서 가리키는 단위 방향(keysFor의 반대) */
function groundOf(keys: string[]): { x: number; z: number } {
  const sx = (keys.includes(KEYS.right) ? 1 : 0) - (keys.includes(KEYS.left) ? 1 : 0);
  const sy = (keys.includes(KEYS.up) ? 1 : 0) - (keys.includes(KEYS.down) ? 1 : 0);
  const gx = (sx - sy) / Math.SQRT2, gz = (-sx - sy) / Math.SQRT2;
  const l = Math.hypot(gx, gz) || 1;
  return { x: gx / l, z: gz / l };
}

class Team {
  /** 키를 누르고 떼는 사이의 지연(브라우저·전송) 추정값(ms) */
  private lag = 120;
  constructor(
    readonly host: Page,
    public pages: Record<Slot, Page | undefined>,
  ) {}
  st() {
    return call<S>(this.host, 'sewing');
  }
  evs() {
    return call<Ev[]>(this.host, 'sewingEvents');
  }
  page(slot: string) {
    return this.pages[slot as Slot]!;
  }
  /** 각 기기에서 정해진 키를 함께 눌렀다 뗀다 */
  async hold(plan: Partial<Record<Slot, string[]>>, ms: number) {
    const entries = Object.entries(plan) as [Slot, string[]][];
    await Promise.all(entries.flatMap(([slot, keys]) => keys.map((k) => this.page(slot).keyboard.down(k))));
    await this.host.waitForTimeout(ms);
    await Promise.all(entries.flatMap(([slot, keys]) => keys.map((k) => this.page(slot).keyboard.up(k))));
  }
  async press(slot: Slot) {
    await this.page(slot).keyboard.press(KEYS.act);
    await this.host.waitForTimeout(250); // 방장까지 왕복
  }
  async walk(slot: Slot, to: { x: number; z: number }, tol = 0.25, until?: (p: P, s: S) => boolean) {
    for (let i = 0; i < 250; i++) {
      const s = await this.st();
      const p = s.players.find((q) => q.id === slot)!;
      if (until?.(p, s)) return;
      const d = Math.hypot(to.x - p.x, to.z - p.z);
      if (d < tol) return;
      // 8방향 키라서: 고른 방향으로 남은 거리의 투영만큼만, 잰 지연을 빼고 누른다(짧은 거리에서 오가며 진동하지 않게)
      const keys = keysFor(to.x - p.x, to.z - p.z);
      const g = groundOf(keys);
      const proj = g.x * (to.x - p.x) + g.z * (to.z - p.z);
      const ms = Math.max(8, Math.min(800, (proj / 3.6) * 1000 * 0.85 - this.lag));
      await this.hold({ [slot]: keys }, ms);
      await this.host.waitForTimeout(60); // 마지막 입력이 방장에 반영되도록
      const q = (await this.st()).players.find((r) => r.id === slot)!;
      const moved = g.x * (q.x - p.x) + g.z * (q.z - p.z);
      if (moved > 0.05) this.lag = Math.max(0, Math.min(400, 0.6 * this.lag + 0.4 * ((moved / 3.6) * 1000 - ms)));
    }
    const last = await this.st();
    throw new Error(`${slot} could not reach ${JSON.stringify(to)} players=${JSON.stringify(last.players.map((q) => [q.id, +q.x.toFixed(2), +q.z.toFixed(2), q.holding]))} crate=${JSON.stringify(last.crate)}`);
  }
  async carry(to: { x: number; z: number; yaw: number }, opts: { tol?: number; until?: (s: S) => boolean } = {}) {
    const tol = opts.tol ?? 0.22;
    for (let i = 0; i < 500; i++) {
      const s = await this.st();
      if (opts.until?.(s)) return s;
      const plan: Partial<Record<Slot, string[]>> = {};
      let need = 0;
      for (const h of [0, 1] as const) {
        const slot = s.handles[h] as Slot | null;
        if (!slot) throw new Error(`손잡이 ${h}를 놓쳤다: ${JSON.stringify(await this.evs())}`);
        const cur = grip(s.crate, h);
        const tgt = grip(to, h);
        const d = Math.hypot(tgt.x - cur.x, tgt.z - cur.z);
        if (d < tol) continue;
        need = Math.max(need, d);
        plan[slot] = keysFor(tgt.x - cur.x, tgt.z - cur.z);
      }
      if (need === 0) return s;
      await this.hold(plan, Math.max(30, Math.min(120, (need / 2.2) * 700)));
      await this.host.waitForTimeout(60);
    }
    throw new Error(`crate could not reach ${JSON.stringify(to)}`);
  }
}

const count = (e: Ev[], type: string) => e.filter((x) => x.type === type).length;

async function openHost(browser: Browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?chapter=2&host&emu&test');
  await page.waitForFunction(() => !!(window as unknown as { __lastgift?: { roomCode?: () => string } }).__lastgift?.roomCode, null, { timeout: 30_000 });
  return { page, code: await call<string>(page, 'roomCode'), errors };
}

async function openGuest(browser: Browser, code: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`/?chapter=2&join=${code}&emu&test`);
  await page.waitForFunction(
    () => {
      const h = (window as unknown as { __lastgift?: { connected?: () => boolean; slot?: () => string | null } }).__lastgift;
      return !!h?.connected?.() && !!h.slot?.();
    },
    null,
    { timeout: 30_000 },
  );
  return { page, ctx, slot: await call<Slot>(page, 'slot'), errors };
}

/** 같은 기기(같은 브라우저 저장소 = 같은 익명 uid)에서 다시 연다 */
async function reopenGuest(ctx: import('@playwright/test').BrowserContext, code: string) {
  const page = await ctx.newPage();
  await page.goto(`/?chapter=2&join=${code}&emu&test`);
  await page.waitForFunction(
    () => {
      const h = (window as unknown as { __lastgift?: { connected?: () => boolean; slot?: () => string | null } }).__lastgift;
      return !!h?.connected?.() && !!h.slot?.();
    },
    null,
    { timeout: 30_000 },
  );
  return page;
}

test('두 기기: 초대 링크로 연결 → 2인 걸쇠 → 앞 요정 먼저·뒤 요정 기다림 → 참가자 이탈 후 재개 → 작업대, 두 화면 상태 일치', async ({ browser }) => {
  test.setTimeout(300_000);
  const H = await openHost(browser);
  expect(H.code).toMatch(/^[2-9A-HJ-NP-Z]{5}$/);
  // 초대 링크가 화면에 보인다
  await expect(H.page.locator('#lobby .code')).toHaveText(H.code);
  await expect(H.page.locator('#lobby .link')).toContainText(`join=${H.code}`);
  await expect(H.page.locator('#lobby [data-act=start]')).toBeDisabled();

  const G = await openGuest(browser, H.code);
  expect(G.slot).toBe('p1');
  await expect(H.page.locator('#lobby [data-act=start]')).toBeEnabled();
  await H.page.locator('#lobby [data-act=start]').click(); // 방장이 「시작」
  await H.page.waitForTimeout(500);
  expect(await call<boolean>(H.page, 'started')).toBe(true);
  await expect(G.page.locator('#lobby')).toBeHidden();

  const team = new Team(H.page, { p0: H.page, p1: G.page, p2: undefined });
  let s = await team.st();
  expect(s.players.map((p) => p.id)).toEqual(['p0', 'p1']);

  // 1) 각자 자기 기기에서 손잡이를 잡는다
  await team.walk('p0', grip(s.crate, 0));
  await team.press('p0');
  await team.walk('p1', grip(s.crate, 1));
  await team.press('p1');
  s = await team.st();
  expect(s.crate.lifted).toBe(true);
  expect(s.handles).toEqual(['p0', 'p1']);

  // 2) 받침대로 옮겨 문 쪽으로 틀기 → 2P가 내려놓고 걸쇠 → 다시 들기
  await team.carry({ ...STAND, yaw: Math.PI / 2 });
  await team.carry({ ...STAND, yaw: Math.PI }, { tol: 0.15 });
  await team.press('p1');
  expect((await team.st()).crate.place).toBe('stand');
  await team.walk('p1', LATCH, 0.3);
  await team.press('p1');
  s = await team.st();
  expect(s.door.latched).toBe(true);
  await team.walk('p1', grip(s.crate, 1));
  await team.press('p1');
  expect((await team.st()).crate.lifted).toBe(true);

  // 3) 앞 요정(참가자)이 먼저 통로 끝을 넘고, 뒤 요정(방장)은 기다린다
  s = await team.carry({ x: 0, z: -2.6, yaw: Math.PI }, { until: (q) => q.players.find((p) => p.id === 'p1')!.z < -2 });
  const rear = s.players.find((p) => p.id === 'p0')!;
  await team.hold({ p1: ['KeyW', 'KeyD'] }, 1000);
  s = await team.st();
  const rear2 = s.players.find((p) => p.id === 'p0')!;
  expect(Math.hypot(rear2.x - rear.x, rear2.z - rear.z)).toBeLessThan(0.02);
  expect(s.space).toBe('yard');
  // 참가자 화면도 같은 공간·같은 운반 상태
  const gs = await call<S>(G.page, 'sewing');
  expect(gs.space).toBe('yard');
  expect(gs.handles).toEqual(['p0', 'p1']);

  s = await team.carry({ x: 0, z: -3.5, yaw: Math.PI }, { until: (q) => q.space === 'workshop' });
  expect(s.transition).toBe(1);
  expect(await call<string[]>(H.page, 'runEffects')).not.toContain('save');

  // 4) 참가자 이탈: 창을 닫는다
  const leftBefore = (await call<{ t: string; slot: string }[]>(H.page, 'netLog')).filter((x) => x.t === 'left').length;
  await G.page.close();
  await H.page.waitForFunction(
    (n) => (window as unknown as { __lastgift: { netLog(): { t: string }[] } }).__lastgift.netLog().filter((x) => x.t === 'left').length > n,
    leftBefore,
    { timeout: 15_000 },
  );
  await H.page.waitForTimeout(300);
  s = await team.st();
  // 방장 판정: 나간 요정의 손잡이를 놓고 재봉틀은 그 자리, 한 명만 남아 팀 일시중지
  expect(s.players.find((p) => p.id === 'p1')!.connected).toBe(false);
  expect(s.crate.lifted).toBe(false);
  expect(s.handles).toEqual(['p0', null]);
  expect((await call<{ pauseReasons: string[] }>(H.page, 'run')).pauseReasons).toContain('alone');
  await expect(H.page.locator('#hud .team .m.off')).toHaveCount(1); // 팀원 연결 상태: 한 명 끊김
  await expect(H.page.locator('#overlay')).toHaveAttribute('data-kind', 'paused');
  // 혼자 남은 방장이 움직여도 시계·요정은 멈춰 있다
  const p0Before = s.players.find((p) => p.id === 'p0')!;
  await team.hold({ p0: ['KeyS'] }, 500);
  const p0After = (await team.st()).players.find((p) => p.id === 'p0')!;
  expect(Math.hypot(p0After.x - p0Before.x, p0After.z - p0Before.z)).toBeLessThan(0.01);

  // 5) 같은 기기에서 다시 열면 같은 자리(p1)로 돌아와 재개(3초 카운트다운)
  const back = await reopenGuest(G.ctx, H.code);
  expect(await call<string>(back, 'slot')).toBe('p1');
  team.pages.p1 = back;
  await H.page.waitForTimeout(3500);
  const r = await call<{ pauseReasons: string[]; resumeAt: number | null; phase: string }>(H.page, 'run');
  expect(r.pauseReasons).toEqual([]);
  expect(r.resumeAt).toBeNull();
  s = await team.st();
  expect(s.players.find((p) => p.id === 'p1')!.connected).toBe(true);
  expect(s.space).toBe('workshop'); // 공간은 그대로(다시 확정하지 않는다)
  expect(s.transition).toBe(1);
  await expect(H.page.locator('#hud .team .m.off')).toHaveCount(0);

  // 6) 다시 잡고 작업대까지
  await team.walk('p1', grip(s.crate, 1));
  await team.press('p1');
  expect((await team.st()).crate.lifted).toBe(true);
  await team.carry({ x: 0, z: -7.2, yaw: Math.PI });
  await team.carry(BENCH, { tol: 0.15 });
  await team.press('p0');
  s = await team.st();
  expect(s.delivered).toBe(true);
  const e = await team.evs();
  expect(count(e, 'delivered')).toBe(1);
  expect(count(e, 'spaceCommitted')).toBe(1);
  const run = await call<{ completedChapters: number[]; memories: number[] }>(H.page, 'run');
  expect(run.completedChapters).toContain(2);
  expect(run.memories).toEqual([1, 2]);

  // 두 화면의 공간·운반 상태 일치
  await back.waitForTimeout(300);
  const g = await call<S>(back, 'sewing');
  expect({ space: g.space, transition: g.transition, delivered: g.delivered, place: g.crate.place, handles: g.handles }).toEqual({
    space: s.space,
    transition: s.transition,
    delivered: s.delivered,
    place: s.crate.place,
    handles: s.handles,
  });
  expect(H.errors).toEqual([]);
  expect(G.errors).toEqual([]);
});

test('세 기기: 쉬던 요정이 넘겨받아도 재봉틀은 하나, 재전송·사칭 이벤트는 무시', async ({ browser }) => {
  test.setTimeout(240_000);
  const H = await openHost(browser);
  const G1 = await openGuest(browser, H.code);
  const G2 = await openGuest(browser, H.code);
  expect([G1.slot, G2.slot].sort()).toEqual(['p1', 'p2']);
  const pages: Record<Slot, Page> = { p0: H.page, p1: G1.slot === 'p1' ? G1.page : G2.page, p2: G1.slot === 'p2' ? G1.page : G2.page };
  await H.page.locator('#lobby [data-act=start]').click();
  await H.page.waitForTimeout(500);
  const team = new Team(H.page, pages);

  let s = await team.st();
  expect(s.players.map((p) => p.id)).toEqual(['p0', 'p1', 'p2']);
  await team.walk('p0', grip(s.crate, 0));
  await team.press('p0');
  await team.walk('p1', grip(s.crate, 1));
  await team.press('p1');
  s = await team.st();
  expect(s.crate.lifted).toBe(true);

  // 쉬던 p2가 p1의 손잡이로 가서 넘겨받는다
  // 운반 중인 친구에게 바짝 붙지 않도록 아래쪽으로 돌아, 손잡이가 손 닿는 범위(0.75 m) 안에 들면 멈춘다
  const g = grip(s.crate, 1);
  const near = (p: P) => Math.hypot(p.x - g.x, p.z - g.z) < 0.75;
  // 경유점은 빨랫줄 기둥(4.9, 10.6)에서 떨어뜨린다(기둥과 겹치는 점은 도달할 수 없다)
  await team.walk('p2', { x: g.x + 0.6, z: g.z + 1.0 }, 0.25);
  for (let k = 0; k < 5; k++) {
    await team.walk('p2', g, 0.05, near);
    await H.page.waitForTimeout(250); // 지연된 입력까지 반영된 뒤 다시 확인
    if (near((await team.st()).players.find((p) => p.id === 'p2')!)) break;
  }
  await team.press('p2');
  s = await team.st();
  expect(s.handles).toEqual(['p0', 'p2']);
  expect(s.crate.lifted).toBe(true);
  expect(s.players.filter((p) => p.holding !== null).map((p) => p.id).sort()).toEqual(['p0', 'p2']);
  expect(count(await team.evs(), 'handover')).toBe(1);

  // 같은 eventId 재전송: 한 번만 처리(두 번 처리되면 손을 놓게 된다)
  const meta = await call<{ runId: string; epoch: number; playerId: string; eventId: string }>(pages.p2, 'meta');
  await call(pages.p2, 'sendMission', { t: 'act', ...meta, eventId: 'dup-1' });
  await H.page.waitForTimeout(300);
  s = await team.st();
  expect(s.handles).toEqual(['p0', null]); // 첫 번째: p2가 손을 놓음(정상 처리)
  await call(pages.p2, 'sendMission', { t: 'act', ...meta, eventId: 'dup-1' }); // 같은 이벤트 다시
  await H.page.waitForTimeout(300);
  s = await team.st();
  expect(s.handles).toEqual(['p0', null]); // 다시 잡지 않았다

  // 다른 자리를 사칭한 이벤트(p2 연결에서 p0이라고 보냄)는 무시
  await call(pages.p2, 'sendMission', { t: 'act', ...meta, playerId: 'p0', eventId: 'fake-1' });
  await H.page.waitForTimeout(300);
  s = await team.st();
  expect(s.handles).toEqual(['p0', null]); // p0이 손을 놓지 않았다
  // 방장 탭이 숨으면: 참가자 화면도 일시중지로 바뀌고 연결은 유지된다. 돌아오면 3초 뒤 재개
  const leftBefore = (await call<{ t: string }[]>(H.page, 'netLog')).filter((x) => x.t === 'left').length;
  await H.page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(pages.p1.locator('#overlay')).toHaveAttribute('data-kind', 'paused');
  await expect(pages.p2.locator('#overlay')).toHaveAttribute('data-kind', 'paused');
  await H.page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(pages.p1.locator('#overlay')).toHaveAttribute('data-kind', 'countdown');
  await pages.p1.waitForTimeout(3500);
  await expect(pages.p1.locator('#overlay')).toHaveAttribute('data-kind', 'none');
  expect((await call<{ t: string }[]>(H.page, 'netLog')).filter((x) => x.t === 'left').length).toBe(leftBefore);
  expect(await call<boolean>(pages.p1, 'connected')).toBe(true);
  expect(H.errors).toEqual([]);
});
