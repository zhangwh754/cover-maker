import { CATEGORIES } from './config.js';
import { safeFilenamePart } from './filename.js';

export function categoryDetails(value: string): { label: string; accent: string; filename: string } {
  for (const [key, preset] of Object.entries(CATEGORIES)) {
    if (value === key || value === preset.label) return { ...preset, filename: key };
  }
  return { label: value, accent: '#48525C', filename: safeFilenamePart(value, 'custom', 20) };
}
