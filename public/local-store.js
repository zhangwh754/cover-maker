const database = () => new Promise((resolve, reject) => {
  const request = indexedDB.open('cover-maker', 1);
  request.onupgradeneeded = () => {
    request.result.createObjectStore('covers', { keyPath: 'filename' });
    request.result.createObjectStore('images');
    request.result.createObjectStore('meta');
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
export async function transaction(stores, mode, run) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result;
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || new Error('本地存储失败，可能空间不足')); };
    run(tx, value => { result = value; });
  });
}
export const nextIndex = () => transaction(['meta'], 'readonly', (tx, done) => {
  tx.objectStore('meta').get('next').onsuccess = event => done(event.target.result || 1);
});
export const history = () => transaction(['covers'], 'readonly', (tx, done) => {
  tx.objectStore('covers').getAll().onsuccess = event => done(event.target.result.sort((a, b) => b.createdAt - a.createdAt));
});
export const readImage = filename => transaction(['images'], 'readonly', (tx, done) => {
  tx.objectStore('images').get(filename).onsuccess = event => done(event.target.result);
});
export const saveCover = (record, blob, automatic, expectedIndex = record.index) => transaction(['covers', 'images', 'meta'], 'readwrite', (tx, done) => {
  const meta = tx.objectStore('meta');
  meta.get('next').onsuccess = event => {
    if (automatic && (event.target.result || 1) !== expectedIndex) { done(false); return; }
    const covers = tx.objectStore('covers');
    covers.get(record.filename).onsuccess = existing => {
      if (existing.target.result) { done('occupied'); return; }
      covers.add(record);
      tx.objectStore('images').add(blob, record.filename);
      if (automatic) meta.put(record.index + 1, 'next');
      done(true);
    };
  };
});
