// 점검: 0장 광장에서 무엇이 무거운지(낮음 품질) 하나씩 숨기고 FPS를 잰다. 실행: npx playwright test --project=perf plaza-cost
import { test } from '@playwright/test';

test('0장 광장 부분별 비용(낮음)', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto(process.env.PLAZA_Q === 'normal' ? '/?chapter=0&test&noshadow' : '/?chapter=0&test&quality=low');
  await page.waitForFunction(() => !!(window as unknown as { __lastgift?: { sorting?: unknown } }).__lastgift?.sorting, null, { timeout: 60_000 });
  await page.waitForTimeout(5000);
  const fps = () =>
    page.evaluate(
      () =>
        new Promise<number>((res) => {
          let n = 0;
          const t0 = performance.now();
          const f = (t: number) => (t - t0 < 4000 ? (n++, requestAnimationFrame(f)) : res(n / ((t - t0) / 1000)));
          requestAnimationFrame(f);
        }),
    );
  const hide = (pred: string, on: boolean) =>
    page.evaluate(
      ([pred, on]) => {
        const sc = (window as unknown as { __lastgift: { scene(): { traverse(f: (o: { name: string; visible: boolean; userData: Record<string, unknown> }) => void): void } } }).__lastgift.scene();
        const test = new Function('o', `return ${pred}`) as (o: unknown) => boolean;
        sc.traverse((o) => {
          if (test(o)) o.visible = !on;
        });
      },
      [pred, on] as const,
    );
  const out: string[] = [`전부 ${(await fps()).toFixed(1)}`];
  for (const [label, pred] of [
    ['사람 집', "o.name.startsWith('house-')"],
    ['꾸밈(길·눈둑·돌담·노점·먼 마을)', "o.name === 'plazaDressing'"],
    ['트리', "o.name === 'tree'"],
    ['화단', "o.name === 'treeBed'"],
    ['썰매', "o.name === 'sleigh'"],
    ['공방', "o.name === 'workshop'"],
    ['소나무', "o.name.startsWith('pine')"],
    ['시계탑', "o.name === 'clockTower'"],
    ['가로등', "o.name.startsWith('lamp')"],
  ] as const) {
    await hide(pred, true);
    out.push(`${label} 숨김 ${(await fps()).toFixed(1)}`);
    await hide(pred, false);
  }
  out.push(`전부(다시) ${(await fps()).toFixed(1)}`);
  console.log(out.join('\n'));
});
