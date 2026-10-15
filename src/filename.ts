export function safeFilenamePart(value: string, fallback: string, maxLength = 50): string {
  const cleaned = value.normalize('NFKC').replace(/[^\p{L}\p{N}-]+/gu, '-');
  return Array.from(cleaned.replace(/^-+|-+$/g, '')).slice(0, maxLength).join('')
    .replace(/-+$/g, '') || fallback;
}

export function decodeUploadFilename(value: string): string {
  // Multer's default multipart filename charset is Latin-1; browsers send UTF-8.
  if (Array.from(value).some((char) => char.codePointAt(0)! > 255)) return value;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(value, 'latin1'));
  } catch {
    return value;
  }
}
