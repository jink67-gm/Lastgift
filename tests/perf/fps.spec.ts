// STEP 08 저사양 측정: 장마다 보통·낮음 품질에서 실제 화면 갱신 수(FPS)를 잰다. 실행: npm run test:perf
// 품질은 설정으로 고정(자동이면 느린 기기에서 저절로 낮음이 되어 비교가 안 된다). 결과: test-results/fps.json
// 이 컨테이너는 그래픽 카드 없이 소프트웨어(SwiftShader)로 그리므로 수치는 "장끼리·품질끼리 비교"용이다.
// 실제 기기 수치는 설정 「기록」(장별 평균·느린 5% FPS)으로 모은다.
import { test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const PAGES = [
  { ch: '0장', url: '/?chapter=0&test', hook: 'sorting' },
  { ch: '1장', url: '/?chapter=1&test', hook: 'ch1' },
  { ch: '2장', url: '/?chapter=2&local&test', hook: 'sewing' },
  { ch: '3장', url: '/?chapter=3&test', hook: 'ch3' },
  { ch: '4장', url: '/?chapter=4&test', hook: 'ch4' },
  { ch: '5장', url: '/?chapter=5&test', hook: 'finale' },
];

async function measure(page: Page, sec: number): Promise<{ fps: number; low: number }> {
  return page.evaluate(
    (s) =>
      new Promise<{ fps: number; low: number }>((resolve) => {
        const times: number[] = [];
        let last = performance.now();
        const end = last + s * 1000;
        const tick = (now: number) => {
          times.push(now - last);
          last = now;
          if (now < end) requestAnimationFrame(tick);
          else {
            const sorted = [...times].sort((a, b) => b - a);
            const worst = sorted[Math.max(0, Math.ceil(times.length * 0.05) - 1)]!;
            resolve({ fps: (times.length / s), low: 1000 / worst });
          }
        };
        requestAnimationFrame(tick);
      }),
    sec,
  );
}

const rows: Record<string, unknown>[] = [];
test.afterAll(() => {
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/fps.json', JSON.stringify(rows, null, 1));
  console.log('\n장\t품질\t평균FPS\t느린5%');
  for (const r of rows) console.log(`${r.ch}\t${r.q}\t${r.fps}\t${r.low}`);
});

for (const [w, h] of [[1366, 768]] as const) {
  test(`장별 FPS ${w}×${h}`, async ({ browser }) => {
    test.setTimeout(600_000);
    for (const q of ['normal', 'low'] as const) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      await ctx.addInitScript((qq) => localStorage.setItem('lastgift.settings.v1', JSON.stringify({ quality: qq })), q);
      const page = await ctx.newPage();
      for (const p of PAGES) {
        await page.goto(p.url);
        await page.waitForFunction((n) => !!(window as unknown as { __lastgift?: Record<string, unknown> }).__lastgift?.[n], p.hook, { timeout: 30_000 });
        await page.waitForTimeout(3000);
        const m = await measure(page, 5);
        rows.push({ ch: p.ch, q: q === 'low' ? '낮음' : '보통', fps: +m.fps.toFixed(1), low: +m.low.toFixed(1) });
      }
      // 스노글로브 회상(6장 끝 기억 장면): 놀이 화면 위에 둥근 회상 화면을 더 그린다
      await page.goto('/?chapter=6&test');
      await page.waitForFunction(() => !!(window as unknown as { __lastgift?: { debugWin?: unknown } }).__lastgift?.debugWin, null, { timeout: 30_000 });
      await page.waitForTimeout(2500);
      const play = await measure(page, 4);
      await page.evaluate(() => (window as unknown as { __lastgift: { debugWin(t: string, id: string): void; seekCut(t: number): void } }).__lastgift.debugWin('deliver', 'p0'));
      await page.waitForTimeout(500);
      await page.evaluate(() => (window as unknown as { __lastgift: { seekCut(t: number): void } }).__lastgift.seekCut(10));
      await page.waitForTimeout(1500);
      const memory = await measure(page, 4);
      rows.push({ ch: '6장 놀이', q: q === 'low' ? '낮음' : '보통', fps: +play.fps.toFixed(1), low: +play.low.toFixed(1) });
      rows.push({ ch: '6장 회상', q: q === 'low' ? '낮음' : '보통', fps: +memory.fps.toFixed(1), low: +memory.low.toFixed(1) });
      await ctx.close();
    }
  });
}
