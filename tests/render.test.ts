import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { layoutTitle } from '../src/overlay.js';
import { renderCover } from '../src/render.js';

async function sourceImage(): Promise<Buffer> {
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900">' +
    '<rect width="600" height="900" fill="#eeeeee"/>' +
    '<rect width="600" height="200" fill="#ff0000"/>' +
    '<rect y="700" width="600" height="200" fill="#0000ff"/>' +
    '</svg>'
  );
  return sharp(svg).png().toBuffer();
}

async function pixel(buffer: Buffer, x: number, y: number): Promise<number[]> {
  const { data } = await sharp(buffer).extract({ left: x, top: y, width: 1, height: 1 })
    .raw().toBuffer({ resolveWithObject: true });
  return Array.from(data);
}

test('renders a cover with escaped text at the exact output size', async () => {
  const output = await renderCover(await sourceImage(), {
    title: '空之轨迹 & <SC>',
    subtitle: 'the 2nd',
    type: 'game',
    index: 1
  });
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.width, 1080);
  assert.equal(metadata.height, 1440);
  assert.equal(metadata.format, 'png');
  assert.deepEqual((await pixel(output, 220, 400)).slice(0, 3), [233, 229, 220]);
});

test('cover crop follows the requested vertical focal point', async () => {
  const source = await sourceImage();
  const base = { title: '测试', type: 'game', index: 2 };
  const top = await renderCover(source, {
    ...base, crop: { mode: 'cover', x: 0.5, y: 0 }
  });
  const bottom = await renderCover(source, {
    ...base, crop: { mode: 'cover', x: 0.5, y: 1 }
  });
  const topPixel = await pixel(top, 500, 100);
  const bottomPixel = await pixel(bottom, 500, 100);
  assert.deepEqual(topPixel.slice(0, 3), [255, 0, 0]);
  assert.deepEqual(bottomPixel.slice(0, 3), [238, 238, 238]);
});

test('long titles use two lines', async () => {
  const layout = await layoutTitle('塞尔达传说：王国之泪完全版游戏体验与推荐');
  assert.equal(layout.lines.length, 2);
  assert.ok(layout.fontSize >= 40);
});

test('renders AVIF sources reported as HEIF with AV1 compression', async () => {
  const source = await sharp(await sourceImage()).avif().toBuffer();
  const metadata = await sharp(source).metadata();
  assert.equal(metadata.format, 'heif');
  assert.equal(metadata.compression, 'av1');
  const output = await renderCover(source, { title: 'AVIF 测试', type: 'game', index: 3 });
  const result = await sharp(output).metadata();
  assert.equal(result.format, 'png');
  assert.equal(result.width, 1080);
  assert.equal(result.height, 1440);
});

