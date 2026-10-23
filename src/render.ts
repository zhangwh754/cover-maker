import './font-environment.js';
import sharp from 'sharp';
import { imageMode, cropRectangle, containRectangle } from './image-layout.js';
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

  const mode = imageMode(width,height,options.crop.mode);
  if (mode === 'cover') {
    const crop = cropRectangle(width,height,options.crop.mode === 'smart' ? {...options.crop,x:.5,y:.5,zoom:1} : options.crop);
    return sharp(oriented).extract(crop).resize(DESIGN.width,DESIGN.height).png().toBuffer();
  }
  const foreground = containRectangle(width,height);
  const image = await sharp(oriented).resize(foreground.width,foreground.height).png().toBuffer();
  const background = mode === 'blur'
    ? sharp(oriented).resize(DESIGN.width,DESIGN.height,{fit:'cover'}).flatten({background:DESIGN.imageBackground}).blur(32)
    : sharp({create:{width:DESIGN.width,height:DESIGN.height,channels:4,background:DESIGN.imageBackground}});
  return background.composite([{input:image,left:foreground.left,top:foreground.top}]).png().toBuffer();

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
