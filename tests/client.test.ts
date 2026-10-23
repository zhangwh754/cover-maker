import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8').then(value => value.replace(/^import .*local-api.*;\n/m, '').replace(/\nhistory\(\)\.then[\s\S]*$/, ''));

function page(options: {native?: boolean; exportImage?: () => Promise<unknown>} = {}) {
  const elements = new Map<string, any>();
  const element = (id: string) => {
    if (!elements.has(id)) elements.set(id, {
      value: '', textContent: '', hidden: false, disabled: false, src: '',
      listeners: {}, classList: { toggle() {} },
      addEventListener(name: string, callback: unknown) { this.listeners[name] = callback; },
      removeAttribute(name: string) { if (name === 'src') this.src = ''; },
      reportValidity() { return true; }, focus() {}, contains() { return false; }
    });
    return elements.get(id)!;
  };
  element('format').value = 'png';
  element('type').value = '游戏';
  element('title').value = '旧标题';
  const requests: Array<{ url: string; options: any; resolve: (response: any) => void }> = [];
  const timers = new Map<number, () => Promise<void>>();
  let timer = 0;
  const context = vm.createContext({
    isNative: options.native ?? false,
    exportImage: options.exportImage ?? (() => Promise.resolve()),
    document: {
      getElementById: element, querySelector: () => ({ value: 'contain' }),
      querySelectorAll: () => [], addEventListener() {}
    },
    FormData: class {
      values = new Map(['title', 'type', 'format', 'index'].map(id => [id, element(id).value]));
      delete(name: string) { this.values.delete(name); }
      append() {}
      get(name: string) { return this.values.get(name); }
    },
    AbortController,
    URL: { createObjectURL: (blob: { name: string }) => 'blob:' + blob.name, revokeObjectURL() {} },
    setTimeout(callback: () => Promise<void>) { timers.set(++timer, callback); return timer; },
    clearTimeout(id: number) { timers.delete(id); },
    apiFetch(url: string, options: unknown) {
      if (url === '/api/sequence') return Promise.resolve({ ok: true, json: async () => ({ nextIndex: 1 }) });
      return new Promise(resolve => requests.push({ url, options, resolve }));
    }
  });
  vm.runInContext(source, context);
  vm.runInContext('selectLocalImage({name:"sample.png",size:100},"sample.png")', context);
  return {
    element, requests,
    save: () => vm.runInContext('saveImageWithNotice({filename:"cover.png"})', context) as Promise<void>,
    submit: () => element('cover-form').listeners.submit({ preventDefault() {} }) as Promise<void>,
    edit: (value: string) => {
      element('title').value = value;
      element('cover-form').listeners.input({ target: element('title') });
    },
    flush: () => {
      const callbacks = [...timers.values()]; timers.clear();
      return Promise.all(callbacks.map(callback => callback()));
    }
  };
}

test('a failed export resumes the cancelled preview and retains the export error', async () => {
  const current = page();
  current.edit('新标题');
  const exporting = current.submit();
  assert.equal(current.requests[0]!.url, '/api/covers');
  current.requests[0]!.resolve({ ok: false, json: async () => ({ error: '该编号的文件已存在，请更换编号' }) });
  await exporting;
  assert.equal(current.requests[1]!.url, '/api/preview');
  assert.equal(current.requests[1]!.options.body.get('title'), '新标题');
  current.requests[1]!.resolve({ ok: true, blob: async () => ({ name: 'recovered' }) });
  await setImmediate();
  assert.equal(current.element('preview-image').hidden, false);
  assert.equal(current.element('preview-image').src, 'blob:recovered');
  assert.equal(current.element('generate').disabled, false);
  assert.match(current.element('message').textContent, /该编号的文件已存在/);
});

test('saving shows persistent progress, blocks duplicate writes, then confirms the saved location', async () => {
  let finish!: (value: unknown) => void;
  let writes = 0;
  const current = page({native: true, exportImage: () => {
    writes++;
    return new Promise(resolve => { finish = resolve; });
  }});
  const saving = current.save();
  assert.equal(current.element('save-notice').hidden,false);
  assert.equal(current.element('save-notice').textContent,'正在保存图片…');
  await current.save();
  assert.equal(writes,1);
  finish({location:'相册（Pictures/DailyRecommend）'});
  await saving;
  assert.match(current.element('save-notice').textContent,/图片已保存到相册/);
  assert.equal(current.element('message').textContent,current.element('save-notice').textContent);
});

test('save failures and cancellations show feedback and allow retry', async () => {
  let attempt = 0;
  const current = page({native: true, exportImage: async () => {
    if (++attempt === 1) throw new Error('空间不足');
    if (attempt === 2) throw Object.assign(new Error('已取消保存'),{code:'SAVE_CANCELLED'});
    return {location:'所选位置'};
  }});
  await current.save();
  assert.match(current.element('save-notice').textContent,/保存失败.*空间不足/);
  await current.save();
  assert.equal(current.element('save-notice').textContent,'已取消保存');
  await current.save();
  assert.equal(current.element('save-notice').textContent,'图片已保存到所选位置');
});

test('an old failed export leaves a newer preview request running', async () => {
  const current = page();
  const exporting = current.submit();
  current.edit('更新的标题');
  const previewing = current.flush();
  const preview = current.requests[1]!;
  current.requests[0]!.resolve({ ok: false, json: async () => ({ error: '生成失败' }) });
  await exporting;
  assert.equal(preview.options.signal.aborted, false);
  assert.equal(current.requests.length, 2);
  preview.resolve({ ok: true, blob: async () => ({ name: 'newer' }) });
  await previewing;
  assert.equal(current.element('preview-image').src, 'blob:newer');
});
