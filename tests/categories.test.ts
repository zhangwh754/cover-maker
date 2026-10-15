import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { createApp } from '../src/app.js';

test('custom and preset categories preview, export and download with UTF-8 filenames', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cover-categories-'));
  const outputDir = path.join(root, 'output');
  const server = createApp({
    publicDir: path.resolve('public'), outputDir, sequencePath: path.join(root, 'sequence.json')
  }).listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
    const image = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#345678' } })
      .png().toBuffer();
    function form(type: string, index: number) {
      const data = new FormData();
      data.set('image', new Blob([new Uint8Array(image)], { type: 'image/png' }), '原始封面.png');
      data.set('title', '分类与文件名检查');
      data.set('type', type);
      data.set('index', String(index));
      return data;
    }
    let index = 42;
    for (const [category, filenamePart] of [
      ['图书 & 阅读', '图书-阅读'], ['游戏', 'game'], ['game', 'game'], ['../摄影/旅行', '摄影-旅行']
    ]) {
      const preview = await fetch(base + '/api/preview', { method: 'POST', body: form(category!, index) });
      assert.equal(preview.status, 200, category);
      const previewBytes = Buffer.from(await preview.arrayBuffer());
      const result = await fetch(base + '/api/covers', { method: 'POST', body: form(category!, index) });
      assert.equal(result.status, 201, category);
      const data = await result.json();
      assert.equal(data.filename, String(index).padStart(3, '0') + '-' + filenamePart + '-原始封面.png');
      const download = await fetch(base + data.url);
      assert.equal(download.status, 200);
      assert.deepEqual(Buffer.from(await download.arrayBuffer()), previewBytes);
      index++;
    }
    assert.equal((await readdir(outputDir)).length, 4);
    for (const invalid of ['', '   ', '字'.repeat(21), '图书\n阅读']) {
      const result = await fetch(base + '/api/covers', { method: 'POST', body: form(invalid, index) });
      assert.equal(result.status, 400);
      assert.match((await result.json()).error, /type/);
    }
    assert.equal((await readdir(outputDir)).length, 4);
    const traversal = await fetch(base + '/api/covers/' + encodeURIComponent('../outside.png'));
    assert.equal(traversal.status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(root, { recursive: true, force: true });
  }
});
