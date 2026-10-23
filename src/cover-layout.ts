import { DESIGN } from './config.js';
import { CoverInputError } from './errors.js';

export type TextLayout = { lines: string[]; fontSize: number };
type Measure = (text: string, size: number) => number | Promise<number>;

export async function fitCoverText(text: string, sizes: number[], measure: Measure, label: string): Promise<TextLayout> {
  const chars = Intl.Segmenter
    ? Array.from(new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(text), part => part.segment)
    : Array.from(text);
  const midpoint = Math.floor(chars.length / 2);
  const boundary = (i: number) => /\s/u.test(chars[i - 1]!) || /\s/u.test(chars[i]!);
  const splits = Array.from({length: chars.length - 1}, (_, i) => i + 1)
    .sort((a,b) => Number(boundary(b)) - Number(boundary(a)) || Math.abs(a-midpoint) - Math.abs(b-midpoint));
  // Keep the largest readable size, wrapping before shrinking further.
  for (const fontSize of sizes) {
    if (await measure(text,fontSize) <= DESIGN.textMaxWidth) return {lines:[text],fontSize};
    for (const split of splits) {
      const lines = [chars.slice(0,split).join('').trim(), chars.slice(split).join('').trim()];
      if (lines.every(Boolean) && await measure(lines[0]!,fontSize) <= DESIGN.textMaxWidth && await measure(lines[1]!,fontSize) <= DESIGN.textMaxWidth) return {lines,fontSize};
    }
  }
  throw new CoverInputError(label + '放不进模板，请缩短后重试');
}

export function coverTextPositions(title: TextLayout, description?: TextLayout) {
  const descriptionStep = description ? Math.ceil(description.fontSize * 1.35) : 0;
  const descriptionTop = description ? DESIGN.textBottom - (description.lines.length - 1) * descriptionStep : 0;
  const titleBottom = description ? descriptionTop - description.fontSize - 48 : DESIGN.textBottom;
  const titleStep = Math.ceil(title.fontSize * 1.18);
  return {
    titleY: title.lines.map((_,i) => titleBottom - (title.lines.length - 1 - i) * titleStep),
    descriptionY: description?.lines.map((_,i) => descriptionTop + i * descriptionStep) || []
  };
}

export const TITLE_SIZES = [112,104,96,88,80,72,64,56,48];
export const DESCRIPTION_SIZES = [60,56,52,48,44,40];
