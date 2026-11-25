// 여러 입력 장치의 Intent를 하나로 합친다. 플레이 중에 키보드와 터치를 섞어 써도 된다.
import type { Intent } from './intent';

export function mergeIntents(...list: Intent[]): Intent {
  let mx = 0;
  let my = 0;
  for (const i of list) {
    mx += i.move.x;
    my += i.move.y;
  }
  const len = Math.hypot(mx, my);
  const k = len > 1 ? 1 / len : 1;
  return {
    move: { x: mx * k, y: my * k },
    action: {
      down: list.some((i) => i.action.down),
      held: list.some((i) => i.action.held),
      up: list.some((i) => i.action.up) && !list.some((i) => i.action.held),
    },
  };
}
