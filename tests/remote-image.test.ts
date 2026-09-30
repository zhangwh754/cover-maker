import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { IMAGE_MIME, supportedImageFormat } from '../src/image-format.js';
import {
  importRemoteImage,
  isPublicAddress,
  parseRemoteImageUrl,
  validateImportedImage,
  RemoteImageError
} from '../src/remote-image.js';

test('network image URLs accept only public HTTP(S) targets', async () => {
  assert.equal(parseRemoteImageUrl(' https://example.com/a.png ').hostname, 'example.com');
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('127.0.0.1'), false);
  assert.equal(isPublicAddress('169.254.169.254'), false);
  assert.equal(isPublicAddress('::ffff:127.0.0.1'), false);
  for (const value of [
    'file:///etc/passwd',
    'data:image/png;base64,AA==',
    'http://example.com:3000/a.png',
    'https://name:secret@example.com/a.png'
  ]) {
    assert.throws(() => parseRemoteImageUrl(value), RemoteImageError);
  }
  for (const value of [
    'http://127.0.0.1/a.png',
    'http://2130706433/a.png',
    'http://[::ffff:127.0.0.1]/a.png',
    'http://169.254.169.254/latest/meta-data',
    'http://localhost/a.png'
  ]) {
    await assert.rejects(() => importRemoteImage(value), RemoteImageError);
  }
});

test('remote AVIF bytes normalize to AVIF and its MIME without accepting HEIC', async () => {
  const bytes = await sharp({
    create: { width: 64, height: 64, channels: 3, background: '#345678' }
  }).avif().toBuffer();
  const imported = await validateImportedImage(bytes);
  assert.equal(imported.format, 'avif');
  assert.equal(IMAGE_MIME[imported.format], 'image/avif');
  assert.deepEqual(imported.bytes, bytes);
  assert.equal(supportedImageFormat({ format: 'heif', compression: 'hevc' }), undefined);
  assert.equal(supportedImageFormat({ format: 'heif' }), undefined);
  await assert.rejects(() => validateImportedImage(Buffer.from('not an image')), RemoteImageError);
});
