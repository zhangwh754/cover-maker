import sharp from 'sharp';
import { z } from 'zod';

export const outputFormatSchema = z.enum(['png', 'jpeg']);
export type OutputFormat = z.infer<typeof outputFormatSchema>;

export async function encodeCover(png: Buffer, format: OutputFormat): Promise<Buffer> {
  if (format === 'png') return png;
  return sharp(png).jpeg({ quality: 94, chromaSubsampling: '4:4:4' }).toBuffer();
}

export function extensionFor(format: OutputFormat): string {
  return format === 'jpeg' ? '.jpg' : '.png';
}
