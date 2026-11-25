// 테스트가 쓰는 자동 검사용 창구(주소에 ?test가 있을 때 src/main.ts가 연다)의 타입.
export interface LastGiftHook {
  player(): { x: number; z: number; facing: number; moving: boolean };
  setPlayer(x: number, z: number, facing?: number): void;
  items(): { id: string; x: number; z: number; light: boolean; carriedBy: string | null }[];
  actions(): string[];
  touchMode(): boolean;
  toScreen(x: number, z: number): { x: number; y: number };
  insideCollider(): boolean;
}

declare global {
  interface Window {
    __lastgift: LastGiftHook;
  }
}
