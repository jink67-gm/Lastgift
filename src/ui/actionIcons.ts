// 행동 그림(직접 제작 SVG). 글 대신 그림으로 "지금 누르면 무슨 일이 일어나는지" 보여 준다.
import type { Action } from '../core/carry';

export type ActionIcon = 'pick' | 'drop' | 'tooHeavy' | 'blocked' | 'swap' | 'latch' | 'door' | 'map' | 'mapClose' | 'signal' | 'throw' | 'none';

const HAND =
  '<path d="M20 44c-5-5-9-11-9-15 0-2 2-3 4-2l5 5V13a3 3 0 0 1 6 0v12V9a3 3 0 0 1 6 0v16V11a3 3 0 0 1 6 0v14-9a3 3 0 0 1 6 0v18c0 7-4 12-10 13h-6c-4 0-6-1-8-3z" fill="#fff" stroke="#1b2433" stroke-width="2.5" stroke-linejoin="round"/>';

const SVG: Record<ActionIcon, string> = {
  // 손 + 위쪽 화살표: 들기
  pick: `<svg viewBox="0 0 64 64" aria-hidden="true">${HAND}<path d="M52 30V8m-7 7 7-7 7 7" fill="none" stroke="#ffd84a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  // 상자 + 아래쪽 화살표 + 바닥선: 내려놓기
  drop: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="16" y="26" width="24" height="20" rx="2" fill="#e05252" stroke="#1b2433" stroke-width="2.5"/><path d="M28 26v20M16 34h24" stroke="#ffd84a" stroke-width="3"/><path d="M50 8v30m-7-7 7 7 7-7" fill="none" stroke="#ffd84a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 54h48" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>`,
  // 두 손 + 상자: 혼자 못 든다(친구와 함께)
  tooHeavy: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="14" y="30" width="36" height="18" rx="2" fill="#8a6a4a" stroke="#1b2433" stroke-width="2.5"/><circle cx="10" cy="30" r="7" fill="#fff" stroke="#1b2433" stroke-width="2.5"/><circle cx="54" cy="30" r="7" fill="#fff" stroke="#1b2433" stroke-width="2.5"/><path d="M24 20h16" stroke="#ffd84a" stroke-width="4" stroke-linecap="round"/><path d="M20 14l-4 6 4 6M44 14l4 6-4 6" fill="none" stroke="#ffd84a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  // 상자 + 막힘 표시: 여기에는 놓을 수 없다
  blocked: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="16" y="22" width="24" height="20" rx="2" fill="#e05252" stroke="#1b2433" stroke-width="2.5"/><circle cx="44" cy="40" r="13" fill="#1b2433" stroke="#fff" stroke-width="3"/><path d="M38 34l12 12M50 34 38 46" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>`,
  // 두 손이 자리를 바꾸는 표시: 교대
  swap: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="18" cy="32" r="10" fill="#fff" stroke="#1b2433" stroke-width="2.5"/><circle cx="46" cy="32" r="10" fill="#ffd84a" stroke="#1b2433" stroke-width="2.5"/><path d="M14 16c6-8 30-8 36 0m0 0-1-8m1 8-8 1M50 48c-6 8-30 8-36 0m0 0 1 8m-1-8 8-1" fill="none" stroke="#ffd84a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  // 걸쇠 걸기: 문 + 고리
  latch: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="10" width="26" height="44" rx="2" fill="#8a6a4a" stroke="#1b2433" stroke-width="2.5"/><path d="M36 30h16" stroke="#ffd84a" stroke-width="6" stroke-linecap="round"/><circle cx="52" cy="30" r="6" fill="none" stroke="#ffd84a" stroke-width="4"/></svg>`,
  // 문 밀기: 열리는 문 + 화살표
  door: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 8h22v48H12z" fill="#3b3f4a"/><path d="M12 8l20 6v46l-20-4z" fill="#8a6a4a" stroke="#1b2433" stroke-width="2.5" stroke-linejoin="round"/><path d="M40 32h16m-6-6 6 6-6 6" fill="none" stroke="#ffd84a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  // 접힌 종이 지도 + 빨간 길: 지도 펴기
  map: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 14l16-5 16 5 16-5v41l-16 5-16-5-16 5z" fill="#fffdf3" stroke="#1b2433" stroke-width="2.5" stroke-linejoin="round"/><path d="M24 9v41M40 14v41" stroke="#1b2433" stroke-width="2" opacity="0.5"/><path d="M14 44c6-4 6-12 14-14s10-8 18-12" fill="none" stroke="#e0342f" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="1 6"/><circle cx="46" cy="18" r="4" fill="#4a9be8" stroke="#1b2433" stroke-width="2"/></svg>`,
  // 지도 접기: 지도 + 아래 화살표
  mapClose: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 10l14-4 14 4 14-4v30l-14 4-14-4-14 4z" fill="#fffdf3" stroke="#1b2433" stroke-width="2.5" stroke-linejoin="round" opacity="0.8"/><path d="M32 40v16m-7-7 7 7 7-7" fill="none" stroke="#ffd84a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  // 손 들기(망보기 신호 "지금 가"): 초록 동그라미 안 손
  signal: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" fill="#2f9a4a" stroke="#fff" stroke-width="3"/><g transform="translate(8 6) scale(0.75)">${HAND}</g></svg>`,
  // 던지기: 공 + 포물선 화살표(손 든 친구에게)
  throw: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 46C20 14 44 10 54 30" fill="none" stroke="#ffd84a" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 7"/><path d="M47 28l7 3 2-8" fill="none" stroke="#ffd84a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="14" cy="46" r="10" fill="#fff" stroke="#1b2433" stroke-width="2.5"/><path d="M14 36v20M5 43h18" stroke="#d23a3a" stroke-width="3"/></svg>`,
  // 빈 손: 할 일이 없다
  none: `<svg viewBox="0 0 64 64" aria-hidden="true" opacity="0.55">${HAND}</svg>`,
};

export function iconFor(a: Action): ActionIcon {
  return a.kind;
}

/** 2장 운반 행동 → 그림 */
export function sewingIcon(kind: 'grab' | 'handover' | 'release' | 'latch' | 'door' | 'none'): ActionIcon {
  return ({ grab: 'pick', handover: 'swap', release: 'drop', latch: 'latch', door: 'door', none: 'none' } as const)[kind];
}

export function iconSvg(icon: ActionIcon): string {
  return SVG[icon];
}
