// 이야기 모드: 0장(프롤로그)부터 6장 끝까지 한 번에. 저장 칸 하나("story")에 팀 시계·기억·사진 구도·지금 장이 이어진다.
//   주소에 ?chapter가 없으면 이야기 모드다(시험은 ?play&test, 그냥 ?test는 광장 시험 장면). ?chapter=N은 개발용으로 장마다 따로 연다.
// 장이 끝나고 끝 장면이 다 지나면 화면을 어둡게 한 뒤 페이지를 다시 읽는다 → 저장된 다음 장이 열린다
// (장마다 장면·모델 메모리를 비우고 새로 시작해 교실 기기에 부담이 적다).
// 장 첫 연출(1장 그림책·4장 봉투·5장 단체사진)은 이 시도에서 처음 들어갈 때만 본다(시간 초과 재시도 때 반복하지 않는다).

import type { TeamNet } from '../net/team';

export const STORY_ROOM = 'story';

export interface StoryOptions {
  /** 이야기 모드 저장 칸. 없으면 장마다의 개발용 칸 */
  roomId?: string;
  story?: boolean;
  /** 여러 기기(방장·참가자). 없으면 한 기기 */
  net?: TeamNet;
}

export interface Story {
  story: boolean;
  roomId: string;
  /** 이 시도(runId)에서 이 장의 첫 연출을 봤는가 */
  introSeen(runId: string, chapterId: number): boolean;
  markIntro(runId: string, chapterId: number): void;
  /** 다음 장으로(어둡게 → 다시 읽기). 여러 번 불러도 한 번만 */
  next(): void;
}

const key = (room: string, runId: string, ch: number) => `lastgift.intro.${room}.${runId}.${ch}`;

export function storyFor(opts: StoryOptions | undefined, devRoom: string): Story {
  const story = !!opts?.story;
  const roomId = opts?.roomId ?? devRoom;
  let going = false;
  return {
    story,
    roomId,
    introSeen(runId, ch) {
      try {
        return localStorage.getItem(key(roomId, runId, ch)) === '1';
      } catch {
        return false;
      }
    },
    markIntro(runId, ch) {
      try {
        localStorage.setItem(key(roomId, runId, ch), '1');
      } catch {
        // 저장이 막힌 기기: 다음에 한 번 더 보여 줄 뿐
      }
    },
    next() {
      // 참가자는 스스로 넘기지 않는다(방장이 다음 장을 열면 따라 다시 연다)
      if (!story || going || opts?.net?.role === 'guest') return;
      going = true;
      const veil = document.createElement('div');
      veil.id = 'chapter-veil';
      veil.style.cssText = 'position:fixed;inset:0;z-index:60;background:#070b16;opacity:0;transition:opacity 0.9s ease;pointer-events:none';
      document.body.appendChild(veil);
      requestAnimationFrame(() => (veil.style.opacity = '1'));
      window.setTimeout(() => location.reload(), 1100);
    },
  };
}
