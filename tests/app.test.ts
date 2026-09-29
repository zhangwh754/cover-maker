import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { createApp } from '../src/app.js';

test('Web preview and export share rendering while preview leaves the sequence unchanged', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cover-maker-web-'));
  const app = createApp({
    outputDir: path.join(root, 'output'),
    sequencePath: path.join(root, 'data', 'sequence.json'),
    publicDir: path.resolve('public')
  });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address() as AddressInfo;
    const base = 'http://127.0.0.1:' + address.port;
    const image = await sharp({
      create: { width: 600, height: 900, channels: 3, background: '#345678' }
    }).png().toBuffer();

    function form(): FormData {
      const data = new FormData();
      data.append('image', new Blob([new Uint8Array(image)], { type: 'image/png' }), 'sample.png');
      data.append('title', '空之轨迹');
      data.append('subtitle', 'the 2nd');
      data.append('type', 'game');
      data.append('crop', 'contain');
      return data;
    }

    const firstSequence = await (await fetch(base + '/api/sequence')).json();
    assert.equal(firstSequence.nextIndex, 1);

    const previewResponse = await fetch(base + '/api/preview', { method: 'POST', body: form() });
    assert.equal(previewResponse.status, 200);
    assert.match(previewResponse.headers.get('content-type') || '', /image\/png/);
    const preview = Buffer.from(await previewResponse.arrayBuffer());
    assert.equal((await sharp(preview).metadata()).width, 1080);
    assert.equal((await (await fetch(base + '/api/sequence')).json()).nextIndex, 1);

    const badForm = new FormData();
    badForm.append('image', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }), 'broken.jpg');
    badForm.append('title', '坏图');
    badForm.append('type', 'game');
    const badResponse = await fetch(base + '/api/preview', { method: 'POST', body: badForm });
    assert.equal(badResponse.status, 400);

    const exportResponse = await fetch(base + '/api/covers', { method: 'POST', body: form() });
    assert.equal(exportResponse.status, 201);
    const exported = await exportResponse.json();
    assert.equal(exported.filename, '001-game-sample.png');
    assert.equal((await (await fetch(base + '/api/sequence')).json()).nextIndex, 2);

    const downloadResponse = await fetch(base + exported.url);
    assert.equal(downloadResponse.status, 200);
    const download = Buffer.from(await downloadResponse.arrayBuffer());
    assert.deepEqual(download, preview);

    const jpegPreviewForm = form();
    jpegPreviewForm.append('format', 'jpeg');
    jpegPreviewForm.append('index', '42');
    const jpegPreviewResponse = await fetch(base + '/api/preview', {
      method: 'POST', body: jpegPreviewForm
    });
    assert.equal(jpegPreviewResponse.status, 200);
    const jpegPreview = Buffer.from(await jpegPreviewResponse.arrayBuffer());
    assert.equal((await sharp(jpegPreview).metadata()).format, 'jpeg');

    const jpegExportForm = form();
    jpegExportForm.append('format', 'jpeg');
    jpegExportForm.append('index', '42');
    const jpegExportResponse = await fetch(base + '/api/covers', {
      method: 'POST', body: jpegExportForm
    });
    assert.equal(jpegExportResponse.status, 201);
    const jpegExport = await jpegExportResponse.json();
    assert.equal(jpegExport.filename, '042-game-sample.jpg');
    const jpegDownload = Buffer.from(await (await fetch(base + jpegExport.url)).arrayBuffer());
    assert.deepEqual(jpegDownload, jpegPreview);
    assert.equal((await (await fetch(base + '/api/sequence')).json()).nextIndex, 2);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(root, { recursive: true, force: true });
  }
});


