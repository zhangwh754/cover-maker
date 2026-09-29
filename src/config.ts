export const DESIGN = {
  width: 1080,
  height: 1440,
  background: '#F5F2EA',
  imageBackground: '#E9E5DC',
  image: { x: 205, y: 75, width: 805, height: 925 },
  textCenterX: 607.5,
  textMaxWidth: 755
} as const;

export const CATEGORIES = {
  anime: { label: '动漫', accent: '#B65C50' },
  game: { label: '游戏', accent: '#244D6F' },
  tv: { label: '影视', accent: '#6C4F61' },
  life: { label: '生活', accent: '#6B7454' },
  coding: { label: '编程', accent: '#48525C' }
} as const;

export const FONT = {
  serif: 'Noto Serif CJK SC',
  sans: 'Noto Sans CJK SC'
} as const;
