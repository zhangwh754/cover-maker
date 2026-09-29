import './font-environment.js';
import sharp from 'sharp';
import { CoverInputError } from './errors.js';
import { CATEGORIES, DESIGN, FONT } from './config.js';
import type { CoverOptions } from './schema.js';

export function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function textWidth(text: string, family: string, size: number): Promise<number> {
  const { info } = await sharp({
    text: {
      text: escapeXml(text),
      font: family + ' ' + size,
      rgba: true
    }
  }).png().toBuffer({ resolveWithObject: true });
  return info.width;
}

function graphemes(text: string): string[] {
  return Array.from(new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(text), (part) => part.segment);
}

export interface TitleLayout {
  lines: string[];
  fontSize: number;
}

export async function layoutTitle(title: string): Promise<TitleLayout> {
  for (const size of [70, 66, 62, 58, 54, 50]) {
    if (await textWidth(title, FONT.serif, size) <= DESIGN.textMaxWidth) {
      return { lines: [title], fontSize: size };
    }
  }

  const chars = graphemes(title);
  const midpoint = Math.floor(chars.length / 2);
  const splits = Array.from({ length: chars.length - 1 }, (_, i) => i + 1)
    .sort((a, b) => Math.abs(a - midpoint) - Math.abs(b - midpoint))
    .slice(0, 12);

  for (const size of [64, 60, 56, 52, 48, 44, 40]) {
    for (const split of splits) {
      const first = chars.slice(0, split).join('').trim();
      const second = chars.slice(split).join('').trim();
      if (!first || !second) continue;
      const [firstWidth, secondWidth] = await Promise.all([
        textWidth(first, FONT.serif, size),
        textWidth(second, FONT.serif, size)
      ]);
      if (Math.max(firstWidth, secondWidth) <= DESIGN.textMaxWidth) {
        return { lines: [first, second], fontSize: size };
      }
    }
  }
  throw new CoverInputError('标题放不进模板，请提供更短的封面标题');
}

async function subtitleSize(subtitle: string): Promise<number> {
  for (const size of [34, 31, 28, 25, 22]) {
    if (await textWidth(subtitle, FONT.sans, size) <= DESIGN.textMaxWidth) return size;
  }
  throw new CoverInputError('副标题放不进模板，请缩短副标题');
}

function svgText(text: string, x: number, y: number, size: number, family: string, fill: string, extra = ''): string {
  return '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-family="' + family +
    '" font-size="' + size + '" fill="' + fill + '" ' + extra + '>' + escapeXml(text) + '</text>';
}

export async function createOverlay(options: CoverOptions): Promise<Buffer> {
  const { title, subtitle, type, index } = options;
  const category = CATEGORIES[type];
  const titleLayout = await layoutTitle(title);
  const subtitleFontSize = subtitle ? await subtitleSize(subtitle) : undefined;
  const titleYs = titleLayout.lines.length === 1 ? [1190] : [1152, 1224];
  const parts = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440" viewBox="0 0 1080 1440">',
    '<rect x="205.5" y="75.5" width="804" height="924" fill="none" stroke="#D5D0C7" stroke-width="1"/>'
  ];

  for (const [i, char] of Array.from('每日推荐').entries()) {
    parts.push('<text x="75" y="' + (130 + i * 52) + '" font-family="' + FONT.serif +
      '" font-size="38" fill="#252525">' + char + '</text>');
  }
  parts.push('<text x="75" y="360" font-family="' + FONT.sans +
    '" font-size="27" fill="#555555">' + String(index).padStart(3, '0') + '</text>');
  parts.push('<line x1="75" y1="385" x2="112" y2="385" stroke="#333333" stroke-width="1"/>');
  parts.push('<path d="M219 1053 L231 1065 L219 1077 L207 1065 Z" fill="' + category.accent + '"/>');
  parts.push('<text x="245" y="1075" font-family="' + FONT.sans +
    '" font-size="27" fill="#313131">' + category.label + '</text>');

  titleLayout.lines.forEach((line, i) => {
    parts.push(svgText(line, DESIGN.textCenterX, titleYs[i] ?? 1190, titleLayout.fontSize,
      FONT.serif, '#191919', 'font-weight="500"'));
  });
  if (subtitle && subtitleFontSize) {
    parts.push(svgText(subtitle, DESIGN.textCenterX, 1290, subtitleFontSize, FONT.sans, '#333333'));
  }
  parts.push(svgText('DAILY RECOMMEND', DESIGN.textCenterX, 1370, 16, FONT.sans,
    '#89847B', 'letter-spacing="4"'));
  parts.push('</svg>');
  return Buffer.from(parts.join(''), 'utf8');
}



