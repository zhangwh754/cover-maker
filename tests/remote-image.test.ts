import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  importRemoteImage,
  isPublicAddress,
  parseRemoteImageUrl,
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
