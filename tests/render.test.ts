import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { createOverlay, layoutTitle } from '../src/overlay.js';
import { renderCover } from '../src/render.js';
import { DESIGN, FONT } from '../src/config.js';

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
    index: 1,
    crop: {mode: "contain", x: .5, y: .5}
  });
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.width, 1080);
  assert.equal(metadata.height, 1440);
  assert.equal(metadata.format, 'png');
  assert.deepEqual((await pixel(output, 40, 400)).slice(0, 3), [20, 42, 51]);
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
  const topPixel = await pixel(top, 500, 200);
  const bottomPixel = await pixel(bottom, 500, 200);
  assert.deepEqual(topPixel.slice(0, 3), [255, 0, 0]);
  assert.deepEqual(bottomPixel.slice(0, 3), [238, 238, 238]);
});

test('big-image cover contains only category, title and one description', async () => {
  const svg = (await createOverlay({title:'空之轨迹',subtitle:'慢热，但后劲很大',type:'游戏',index:123456,crop:{mode:'cover',x:.5,y:.5}})).toString();
  assert.equal((svg.match(/<text /g) || []).length,3);
  assert.match(svg,/空之轨迹/);
  assert.match(svg,/慢热，但后劲很大/);
  assert.doesNotMatch(svg,/每日推荐|DAILY RECOMMEND|123456/);
  assert.match(svg,/linearGradient/);
});

test('long titles use two lines', async () => {
  const layout = await layoutTitle('塞尔达传说：王国之泪完全版游戏体验与推荐');
  assert.equal(layout.lines.length, 2);
  assert.ok(layout.fontSize >= 40);
});

test('mixed-width titles can break outside the character midpoint candidates', async () => {
  const title = 'Ill '.repeat(9) + '这是一段用于封面排版验证的中文长标题';
  const layout = await layoutTitle(title);
  assert.equal(layout.lines.length, 2);
  assert.ok(layout.lines.every(line => line.trim().length > 0));
  assert.equal(layout.lines.join('').replace(/\s/gu, ''), title.replace(/\s/gu, ''));
  for (const line of layout.lines) {
    const { info } = await sharp({ text: { text: line, font: FONT.sans + ' ' + layout.fontSize, rgba: true } })
      .png().toBuffer({ resolveWithObject: true });
    assert.ok(info.width <= DESIGN.textMaxWidth);
  }
});

test('titles that cannot fit any two lines still return a useful input error', async () => {
  await assert.rejects(() => layoutTitle('汉'.repeat(80)), /标题放不进模板/);
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

