// 네 요정은 모자 색과 무늬를 함께 달리한다(색만으로 구분하지 않는다).
export type HatPattern = 'stripes' | 'dots' | 'stars' | 'checks';

export interface ElfLook {
  slot: 0 | 1 | 2 | 3;
  hat: string;
  pattern: HatPattern;
  accent: string;
}

export const ELF_LOOKS: readonly ElfLook[] = [
  { slot: 0, hat: '#d23a3a', pattern: 'stripes', accent: '#ffffff' },
  { slot: 1, hat: '#2f6fd0', pattern: 'dots', accent: '#ffffff' },
  { slot: 2, hat: '#2f9a4a', pattern: 'stars', accent: '#fff3a8' },
  { slot: 3, hat: '#e0b021', pattern: 'checks', accent: '#5a3b12' },
];
