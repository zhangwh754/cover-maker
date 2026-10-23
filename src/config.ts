export const DESIGN = {
  width: 1080,
  height: 1440,
  background: '#142A33',
  imageBackground: '#142A33',
  image: { x: 0, y: 0, width: 1080, height: 1440 },
  textCenterX: 540,
  textMaxWidth: 952,
  textLeft: 64,
  textBottom: 1344,
  titleColor: '#FFFFFF',
  descriptionColor: '#F6DB96',
  badgeBackground: '#F5E7C9',
  badgeText: '#26363D'
} as const;

export const CATEGORIES = {
  anime: { label: '动漫', accent: '#B65C50' },
  game: { label: '游戏', accent: '#244D6F' },
  tv: { label: '影视', accent: '#6C4F61' },
  life: { label: '生活', accent: '#6B7454' },
  coding: { label: '编程', accent: '#48525C' }
} as const;

export const FONT = {
  serif: 'Noto Serif SC',
  sans: 'Noto Sans SC'
} as const;

