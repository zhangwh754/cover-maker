import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { peekNextIndex, saveCover } from '../src/sequence.js';

test('automatic numbering advances only after an export and manual indexes stay independent', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cover-maker-'));
  try {
    const source = await sharp({
      create: { width: 600, height: 900, channels: 3, background: '#345678' }
    }).png().toBuffer();
    const request = {
      source,
      sourceName: 'sora.jpg',
      options: { title: '空之轨迹', type: 'game' as const, crop: { mode: 'contain' as const, x: 0.5, y: 0.5 } },
      outputDir: path.join(root, 'output'),
      sequencePath: path.join(root, 'data', 'sequence.json')
    };
    assert.equal(await peekNextIndex(request.sequencePath), 1);
    const first = await saveCover(request);
    assert.equal(first.filename, '001-game-sora.png');
    assert.equal(await peekNextIndex(request.sequencePath), 2);

    const manual = await saveCover({ ...request, index: 42 });
    assert.equal(manual.filename, '042-game-sora.png');
    assert.equal(await peekNextIndex(request.sequencePath), 2);
    await assert.rejects(() => saveCover({ ...request, index: 42 }), { code: 'EEXIST' });

    const second = await saveCover(request);
    assert.equal(second.index, 2);
    assert.deepEqual(JSON.parse(await readFile(request.sequencePath, 'utf8')), { global: 2 });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('concurrent automatic exports receive distinct numbers', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cover-maker-'));
  try {
    const source = await sharp({
      create: { width: 300, height: 450, channels: 3, background: '#345678' }
    }).png().toBuffer();
    const request = {
      source,
      sourceName: 'sample.png',
      options: { title: '测试', type: 'anime' as const, crop: { mode: 'contain' as const, x: 0.5, y: 0.5 } },
      outputDir: path.join(root, 'output'),
      sequencePath: path.join(root, 'data', 'sequence.json')
    };
    const results = await Promise.all([saveCover(request), saveCover(request)]);
    assert.deepEqual(results.map((item) => item.index).sort(), [1, 2]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
