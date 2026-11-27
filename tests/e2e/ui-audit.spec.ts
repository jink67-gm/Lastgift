// STEP 08 화면 점검: 실제 수업 기기 화면 크기마다 장을 열고
//   - 보이는 글씨 14px 이상(설명 글), 누르는 단추 44×44px 이상(손가락)
//   - 화면 위 고정 요소(시계·팀 칩·행동 안내·설정·FPS·행동 단추·스틱)가 서로 겹치지 않음
//   - 화면 글이 한국어(키 이름 E·Enter·Esc·WASD, FPS 말고 영어 없음)
// 결과 표는 test-results/ui-audit.json 에도 남긴다.
import { expect, test, type Page } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';

const SCREENS = [
  { name: '노트북 1280×720', w: 1280, h: 720, touch: false },
  { name: '학교 PC 1366×768', w: 1366, h: 768, touch: false },
  { name: '웨일북 1920×1080', w: 1920, h: 1080, touch: false },
  { name: 'iPad 가로 1024×768', w: 1024, h: 768, touch: true },
  { name: '안드로이드 태블릿 가로 1280×800', w: 1280, h: 800, touch: true },
  { name: '태블릿 세로 768×1024', w: 768, h: 1024, touch: true },
  { name: '학교 PC 1366×768 글씨 크게', w: 1366, h: 768, touch: false, large: true },
  { name: 'iPad 가로 1024×768 글씨 크게', w: 1024, h: 768, touch: true, large: true },
] as { name: string; w: number; h: number; touch: boolean; large?: boolean }[];
const PAGES = [
  { ch: 0, url: '/?chapter=0&test&noshadow', hook: 'sorting' },
  { ch: 1, url: '/?chapter=1&test&noshadow', hook: 'ch1' },
  { ch: 2, url: '/?chapter=2&local&test&noshadow', hook: 'sewing' },
  { ch: 3, url: '/?chapter=3&test&noshadow', hook: 'ch3' },
  { ch: 4, url: '/?chapter=4&test&noshadow', hook: 'ch4' },
  { ch: 5, url: '/?chapter=5&test&noshadow', hook: 'finale' },
];
const HUD_IDS = ['hud', 'key-hint', 'settings-btn', 'fps-chip', 'action-btn', 'stick-base'];
const ALLOWED_LATIN = new Set(['E', 'Enter', 'Esc', 'WASD', 'FPS']);

interface Finding {
  screen: string;
  ch: number;
  kind: 'smallText' | 'smallButton' | 'overlap' | 'latin';
  what: string;
}

async function audit(page: Page) {
  return page.evaluate(
    ({ hudIds, allowed }) => {
      const out: { kind: string; what: string }[] = [];
      const vis = (el: Element) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
      };
      const desc = (el: Element) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : ''}`;
      // 글씨
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const t = (n.textContent ?? '').trim();
        const el = n.parentElement;
        if (!t || !el || !vis(el) || el.closest('textarea, script, style')) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 14) out.push({ kind: 'smallText', what: `${desc(el)} ${fs}px "${t.slice(0, 20)}"` });
        for (const w of t.match(/[A-Za-z]+/g) ?? []) if (!allowed.includes(w)) out.push({ kind: 'latin', what: `${desc(el)} "${t.slice(0, 30)}"` });
      }
      // 단추
      for (const el of document.querySelectorAll('button, [role="button"]')) {
        if (!vis(el) || el.closest('#settings-panel:not(.on)')) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 44 || r.height < 44) out.push({ kind: 'smallButton', what: `${desc(el)} ${Math.round(r.width)}×${Math.round(r.height)} "${(el.textContent ?? '').trim().slice(0, 12)}"` });
      }
      // 겹침(화면 위 고정 요소끼리)
      const rects = hudIds
        .map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => !!el && vis(el))
        .map((el) => ({ id: el.id, r: el.getBoundingClientRect() }));
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i]!.r, b = rects[j]!.r;
          const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ix > 2 && iy > 2) out.push({ kind: 'overlap', what: `#${rects[i]!.id} × #${rects[j]!.id}` });
        }
      return out;
    },
    { hudIds: HUD_IDS, allowed: [...ALLOWED_LATIN] },
  );
}

const all: Finding[] = [];
test.afterAll(() => {
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/ui-audit.json', JSON.stringify(all, null, 1));
});

for (const sc of SCREENS) {
  test(`화면 점검 · ${sc.name}`, async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await browser.newContext({ viewport: { width: sc.w, height: sc.h }, hasTouch: sc.touch, isMobile: sc.touch });
    if (sc.large) await ctx.addInitScript(() => localStorage.setItem('lastgift.settings.v1', JSON.stringify({ largeText: true })));
    const page = await ctx.newPage();
    const found: Finding[] = [];
    for (const p of PAGES) {
      await page.goto(p.url);
      await page.waitForFunction((n) => !!(window as unknown as { __lastgift?: Record<string, unknown> }).__lastgift?.[n], p.hook, { timeout: 30_000 });
      await page.waitForTimeout(1500);
      // FPS 표시도 켜 둔 상태로(가장 붐비는 화면)
      await page.locator('#settings-btn').click();
      for (const f of await audit(page)) found.push({ screen: sc.name, ch: p.ch, ...(f as Omit<Finding, 'screen' | 'ch'>) });
      await page.locator('[data-k="showFps"] [data-v="true"]').click();
      await page.locator('#settings-panel .close').click();
      await page.waitForTimeout(800);
      for (const f of await audit(page)) found.push({ screen: sc.name, ch: p.ch, ...(f as Omit<Finding, 'screen' | 'ch'>) });
      if (p.ch === 3) {
        // 기록용: 화면 위 요소 크기(px)
        const sizes = await page.evaluate((ids) => ids.map((id) => {
          const el = document.getElementById(id);
          const r = el?.getBoundingClientRect();
          return r && r.width > 0 && getComputedStyle(el!).display !== 'none' ? `${id} ${Math.round(r.width)}×${Math.round(r.height)}` : `${id} -`;
        }), HUD_IDS);
        console.log(`SIZES ${sc.name}: ${sizes.join(' · ')}`);
      }
      await page.evaluate(() => localStorage.clear());
    }
    await ctx.close();
    const uniq = [...new Map(found.map((f) => [`${f.ch}|${f.kind}|${f.what}`, f])).values()];
    all.push(...uniq);
    console.log(`${sc.name}: ${uniq.length}건`, uniq.map((f) => `${f.ch}장 ${f.kind} ${f.what}`).join('\n  '));
    expect(uniq).toEqual([]);
  });
}

test('점검기 자체 확인: 작은 단추·작은 글씨·영어·겹침을 잡아낸다', async ({ page }) => {
  await page.goto('/?chapter=2&local&test&noshadow');
  await page.waitForFunction(() => !!(window as unknown as { __lastgift?: { sewing?: unknown } }).__lastgift?.sewing, null, { timeout: 30_000 });
  await page.evaluate(() => {
    const b = document.createElement('button');
    b.textContent = 'Hello';
    b.style.cssText = 'position:fixed;left:400px;top:300px;width:30px;height:20px;font-size:11px';
    document.body.appendChild(b);
    const s = document.getElementById('settings-btn')!;
    s.style.right = 'auto';
    s.style.left = '20px'; // 시계·팀 칩 위로
  });
  const kinds = new Set((await audit(page)).map((f) => f.kind));
  expect([...kinds].sort()).toEqual(['latin', 'overlap', 'smallButton', 'smallText']);
});

const OVERLAYS: { name: string; url: string; ready: string; then?: (p: Page) => Promise<void> }[] = [
  { name: '프롤로그(건너뛰기)', url: '/?chapter=0&test&noshadow&prologue', ready: '#pro-skip' },
  { name: '1장 그림책', url: '/?chapter=1&test&noshadow&story', ready: '#storybook' },
  { name: '4장 봉투', url: '/?chapter=4&test&noshadow&intro', ready: '#envelope' },
  { name: '2장 고르기(방 만들기·참가)', url: '/?chapter=2&test', ready: '#lobby' },
  {
    name: '6장 끝(다시 보기·건너뛰기)',
    url: '/?chapter=6&test&noshadow',
    ready: '#game',
    then: async (p) => {
      await p.waitForFunction(() => !!(window as unknown as { __lastgift?: { debugWin?: unknown } }).__lastgift?.debugWin, null, { timeout: 30_000 });
      await p.evaluate(() => (window as unknown as { __lastgift: { debugWin(t: string, id: string): void } }).__lastgift.debugWin('deliver', 'p0'));
      await p.waitForSelector('#ending-skip', { timeout: 10_000 });
    },
  },
];
for (const sc of SCREENS.filter((s) => ['학교 PC 1366×768', 'iPad 가로 1024×768', '태블릿 세로 768×1024'].includes(s.name))) {
  test(`연출·대기실 화면 점검 · ${sc.name}`, async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await browser.newContext({ viewport: { width: sc.w, height: sc.h }, hasTouch: sc.touch, isMobile: sc.touch });
    const page = await ctx.newPage();
    const found: Finding[] = [];
    for (const o of OVERLAYS) {
      await page.goto(o.url);
      await page.waitForSelector(o.ready, { timeout: 30_000 });
      await o.then?.(page);
      await page.waitForTimeout(1200);
      for (const f of await audit(page)) found.push({ screen: sc.name, ch: -1, kind: f.kind as Finding['kind'], what: `${o.name}: ${f.what}` });
      await page.evaluate(() => localStorage.clear());
    }
    await ctx.close();
    const uniq = [...new Map(found.map((f) => [`${f.kind}|${f.what}`, f])).values()];
    all.push(...uniq);
    console.log(`${sc.name} 연출: ${uniq.length}건`, uniq.map((f) => `${f.kind} ${f.what}`).join('\n  '));
    expect(uniq).toEqual([]);
  });
}
