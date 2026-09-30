import './font-environment.js';
import sharp from 'sharp';
import { DESIGN } from './config.js';
import { CoverInputError } from './errors.js';
import { supportedImageFormat } from './image-format.js';
import { createOverlay } from './overlay.js';
import { coverOptionsSchema, type CoverOptions } from './schema.js';

const INPUT_PIXEL_LIMIT = 25_000_000;

export type ImageSource = string | Buffer;

async function prepareImage(source: ImageSource, options: CoverOptions): Promise<Buffer> {
  const metadata = await sharp(source, { limitInputPixels: INPUT_PIXEL_LIMIT })
    .metadata()
    .catch(() => { throw new CoverInputError('无法读取图片，或图片像素过大'); });
  if (!supportedImageFormat(metadata)) {
    throw new CoverInputError('只支持 JPEG、PNG、WebP、AVIF 和 TIFF 图片');
  }

  const oriented = await sharp(source, { limitInputPixels: INPUT_PIXEL_LIMIT })
    .autoOrient()
    .png()
    .toBuffer()
    .catch(() => { throw new CoverInputError('图片解码失败，请检查文件'); });
  const { width, height } = await sharp(oriented).metadata();
  if (!width || !height) throw new CoverInputError('无法读取图片尺寸');

  if (options.crop.mode === 'contain') {
    return sharp(oriented)
      .resize(DESIGN.image.width, DESIGN.image.height, {
        fit: 'contain',
        background: DESIGN.imageBackground
      })
      .png()
      .toBuffer();
  }

  const targetRatio = DESIGN.image.width / DESIGN.image.height;
  const sourceRatio = width / height;
  let left = 0;
  let top = 0;
  let cropWidth = width;
  let cropHeight = height;
  if (sourceRatio > targetRatio) {
    cropWidth = Math.min(width, Math.round(height * targetRatio));
    left = Math.round((width - cropWidth) * options.crop.x);
  } else {
    cropHeight = Math.min(height, Math.round(width / targetRatio));
    top = Math.round((height - cropHeight) * options.crop.y);
  }

  return sharp(oriented)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize(DESIGN.image.width, DESIGN.image.height)
    .png()
    .toBuffer();
}

export async function renderCover(source: ImageSource, rawOptions: unknown): Promise<Buffer> {
  const options = coverOptionsSchema.parse(rawOptions);
  const [image, overlay] = await Promise.all([
    prepareImage(source, options),
    createOverlay(options)
  ]);
  return sharp({
    create: {
      width: DESIGN.width,
      height: DESIGN.height,
      channels: 4,
      background: DESIGN.background
    }
  })
    .composite([
      { input: image, left: DESIGN.image.x, top: DESIGN.image.y },
      { input: overlay, left: 0, top: 0 }
    ])
    .png()
    .toBuffer();
}
