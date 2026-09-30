export const IMAGE_MIME = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  tiff: 'image/tiff'
} as const;

export type ImageFormat = keyof typeof IMAGE_MIME;

export function supportedImageFormat(metadata: { format?: string; compression?: string }): ImageFormat | undefined {
  // libvips reports AVIF as a HEIF container with AV1 compression.
  const format = metadata.format === 'heif' && metadata.compression === 'av1'
    ? 'avif' : metadata.format;
  return format && Object.hasOwn(IMAGE_MIME, format) ? format as ImageFormat : undefined;
}
