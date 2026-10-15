import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
// The mobile store is intentionally plain JS shared by Vite and these tests.
// @ts-ignore
import { nextIndex, saveCover, readImage, history } from '../public/local-store.js';

test('mobile storage commits image, history and counter together and preserves manual numbering', async () => {
  const blob = new Blob(['test-image'], {type:'image/png'});
  const record = (index: number) => ({filename:`${index}-test.png`,index,createdAt:index});
  assert.equal(await nextIndex(), 1);
  assert.equal(await saveCover(record(9),blob,false), true);
  assert.equal(await nextIndex(), 1);
  assert.equal(await saveCover(record(1),blob,true), true);
  assert.equal(await nextIndex(), 2);
  assert.equal(await (await readImage('1-test.png')).text(),'test-image');
  assert.equal(await saveCover(record(1),blob,false),'occupied');
  assert.equal(await nextIndex(),2);
  const competing = await Promise.all([saveCover(record(2),blob,true),saveCover({...record(2),filename:'2-other.png'},blob,true)]);
  assert.deepEqual(competing.sort(),[false,true]);
  assert.equal(await nextIndex(),3);
  assert.equal((await history()).length,3);
  // Skip an occupied manual filename without advancing the counter until a cover is saved.
  assert.equal(await saveCover(record(3),blob,false),true);
  assert.equal(await saveCover(record(3),blob,true),'occupied');
  assert.equal(await nextIndex(),3);
  assert.equal(await saveCover(record(4),blob,true,3),true);
  assert.equal(await nextIndex(),5);
});
