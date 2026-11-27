// 요정 모습 고르기: 사용자 꼬마 요정 에셋 → 미니 요정(Quaternius 꾸민 것) → 기본 도형 요정 순서로, 있는 것을 쓴다.
import type { ElfLook } from '../data/elves';
import { createElf, type ElfView } from './elf';
import { createLittleElf } from './littleElf';
import { createMiniElf } from './miniElf';
import type { Models } from './models';

export function createElfAvatar(models: Models, look: ElfLook): ElfView {
  return createLittleElf(models, look) ?? createMiniElf(models, look) ?? createElf(look);
}
