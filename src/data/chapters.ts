// 장마다 선언하는 값(명세서 §5, §7).
// 최초 상태·안전 위치·성공 조건·소품 ID는 각 장을 구현하는 STEP에서 채운다.

export type ChapterId = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type MemoryId = 1 | 2 | 3 | 4;

export interface ChapterDef {
  id: ChapterId;
  /** 장 최초 진입 시 보장하는 최소 남은 시간 */
  floorMs: number;
  /** 이 장을 마치면 얻는 기억(유나·재봉틀·콩이·트리) */
  memory: MemoryId | null;
  /** 가벼운 실수 때 초기화하는 임시 진행 키. 나머지 진행(예: 전선·충전)은 유지한다 */
  lightResetKeys: readonly string[];
}

const MIN = 60_000;

/** 새 시도의 팀 시간 30:00 */
export const RUN_MS = 30 * MIN;

export const CHAPTERS: readonly ChapterDef[] = [
  { id: 0, floorMs: 3 * MIN, memory: null, lightResetKeys: [] },
  { id: 1, floorMs: 5 * MIN, memory: 1, lightResetKeys: [] },
  { id: 2, floorMs: 5 * MIN, memory: 2, lightResetKeys: [] },
  { id: 3, floorMs: 5 * MIN, memory: 3, lightResetKeys: [] },
  // 4장: 시간 초과 시 스위치 쌍만 풀리고 전선·충전은 유지된다
  { id: 4, floorMs: 5 * MIN, memory: 4, lightResetKeys: ['switchA', 'switchB', 'switchTimerAt'] },
  { id: 5, floorMs: 2 * MIN, memory: null, lightResetKeys: [] },
  { id: 6, floorMs: 3 * MIN, memory: null, lightResetKeys: [] },
];

export function chapter(id: ChapterId): ChapterDef {
  return CHAPTERS[id]!;
}
