import { DESIGN } from './config.js';
import type { CropOptions } from './schema.js';

// At most 15% of the original area is lost when smart mode chooses a crop.
export const SMART_MIN_RETAINED_AREA = 0.85;
export function imageMode(width: number, height: number, mode: CropOptions['mode']) {
  if (mode !== 'smart') return mode;
  const relativeRatio = (width / height) / (DESIGN.width / DESIGN.height);
  return Math.min(relativeRatio, 1 / relativeRatio) >= SMART_MIN_RETAINED_AREA ? 'cover' : 'blur';
}

export function cropRectangle(width: number, height: number, crop: CropOptions) {
  const ratio = DESIGN.width / DESIGN.height;
  const zoom = crop.zoom ?? 1;
  const cropWidth = Math.max(1, Math.floor(Math.min(width, height * ratio) / zoom));
  const cropHeight = Math.max(1, Math.floor(Math.min(height, width / ratio) / zoom));
  return { left: Math.round((width - cropWidth) * crop.x), top: Math.round((height - cropHeight) * crop.y), width: cropWidth, height: cropHeight };
}

export function containRectangle(width: number, height: number) {
  const scale = Math.min(DESIGN.width / width, DESIGN.height / height);
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  return {left: Math.round((DESIGN.width - w) / 2), top: Math.round((DESIGN.height - h) / 2), width: w, height: h};
}
