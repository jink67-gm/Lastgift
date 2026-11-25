// 요정 모습 고르기: 미니 요정 모델이 있으면 그것을, 없으면 기본 도형 요정을 쓴다.
import type { ElfLook } from '../data/elves';
import { createElf, type ElfView } from './elf';
import { createMiniElf } from './miniElf';
import type { Models } from './models';

export function createElfAvatar(models: Models, look: ElfLook): ElfView {
  return createMiniElf(models, look) ?? createElf(look);
}
