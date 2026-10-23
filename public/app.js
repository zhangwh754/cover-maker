import { apiFetch, history, exportImage, isNative } from './local-api.js';
const form = document.getElementById('cover-form');
const imageInput = document.getElementById('image');
const uploadBox = document.getElementById('upload-box');
const imageUrlInput = document.getElementById('image-url');
const importButton = document.getElementById('import-url');
const titleInput = document.getElementById('title');
const typeInput = document.getElementById('type');
const categoryPresets = document.querySelectorAll('[data-category]');
const formatInput = document.getElementById('format');
const indexInput = document.getElementById('index');
const cropInputs = document.querySelectorAll('input[name="crop"]');
const focusControls = document.getElementById('focus-controls');
const previewImage = document.getElementById('preview-image');
const previewEmpty = document.getElementById('preview-empty');
const previewEmptyText = document.getElementById('preview-empty-text');
const previewMessage = document.getElementById('preview-message');
const exportResults = document.getElementById('export-results');
const exportList = document.getElementById('export-list');
const fileName = document.getElementById('file-name');
const message = document.getElementById('message');
const generateButton = document.getElementById('generate');
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
let selectedImageFile = null;
let selectedImageLabel = '';
let importedUrl = '';
let importing = false;
let importController;
let importSerial = 0;
let previewTimer;
let previewController;
let previewUrl;
let previewSerial = 0;
let formRevision = 0;
let generating = false;
let saveNoticeTimer;
let savingImage = false;

function showSaveNotice(text, isError = false, duration = 4500) {
  clearTimeout(saveNoticeTimer);
  const notice = document.getElementById('save-notice');
  notice.textContent = text;
  notice.classList.toggle('error', isError);
  notice.hidden = false;
  if (duration) saveNoticeTimer = setTimeout(() => { notice.hidden = true; }, duration);
}

async function saveImageWithNotice(data) {
  if (savingImage) return;
  savingImage = true;
  showSaveNotice(isNative ? '正在保存图片…' : '正在准备下载…', false, 0);
  try {
    const result = await exportImage(data);
    const text = isNative ? '图片已保存到' + (result?.location || '所选位置') : '已发起下载，请在浏览器下载记录中查看';
    setMessage(text, false);
    showSaveNotice(text);
  } catch (error) {
    const detail = errorText(error);
    const cancelled = error.code === 'SAVE_CANCELLED' || detail === '已取消保存';
    const text = cancelled ? '已取消保存' : detail.startsWith('保存失败') ? detail : '保存失败：' + detail;
    setMessage(text, !cancelled);
    showSaveNotice(text, !cancelled, cancelled ? 3000 : 7000);
  } finally { savingImage = false; }
}

function selectedCrop() {
  return document.querySelector('input[name="crop"]:checked').value;
}

function updateControls() {
  focusControls.hidden = selectedCrop() !== 'cover';
  document.getElementById('zoom-value').textContent = Number(document.getElementById('zoom').value || 1).toFixed(2) + '×';
  for (const id of ['x', 'y']) {
    document.getElementById(id + '-value').textContent =
      Math.round(Number(document.getElementById(id).value) * 100) + '%';
  }
  fileName.textContent = selectedImageLabel;
  uploadBox.classList.toggle('has-image', Boolean(selectedImageFile));
  document.getElementById('format-label').textContent =
    formatInput.value.toUpperCase() + ' · 3:4';
  for (const button of categoryPresets) {
    button.setAttribute('aria-pressed', String(button.dataset.category === typeInput.value.trim()));
  }
}

function setMessage(text, isError) {
  message.textContent = text;
  message.classList.toggle('error', Boolean(isError));
}

function setPreviewMessage(text, isError) {
  previewMessage.textContent = text;
  previewMessage.classList.toggle('error', Boolean(isError));
}

function cancelPreview() {
  clearTimeout(previewTimer);
  if (previewController) previewController.abort();
  previewController = undefined;
  previewSerial++;
}

function clearPreview(text = '选择、粘贴或导入图片并填写标题，即可查看封面') {
  previewImage.hidden = true;
  previewImage.removeAttribute('src');
  previewEmpty.hidden = false;
  previewEmptyText.textContent = text;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = undefined;
}

function showPreview(blob) {
  const nextUrl = URL.createObjectURL(blob);
  previewImage.src = nextUrl;
  previewImage.hidden = false;
  previewEmpty.hidden = true;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = nextUrl;
  setPreviewMessage('', false);
}

function addExportResult(data, format) {
  const item = document.createElement('li');
  const name = document.createElement('span'); name.textContent = data.filename;
  item.append(name);
  const action = (label, run, busyLabel = label) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = busyLabel;
      try { await run(); } catch(error) { setMessage(errorText(error), true); }
      finally { button.disabled = false; button.textContent = label; }
    }); item.append(button);
  };
  action('查看', async () => { cancelPreview(); const response = await apiFetch(data.url); if (!response.ok) throw new Error('封面读取失败'); showPreview(await response.blob()); document.getElementById('preview-panel').scrollIntoView({behavior:'smooth'}); });
  action(isNative ? '保存图片' : '下载 ' + format.toUpperCase(), () => saveImageWithNotice(data), isNative ? '保存中…' : '准备下载…');
  if (isNative) action('分享', () => exportImage(data, true));
  exportList.prepend(item); exportResults.hidden = false;
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

function extensionFor(type) {
  return {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/tiff': 'tiff'
  }[type] || 'png';
}

function cancelImport() {
  importSerial++;
  if (importController) importController.abort();
  importController = undefined;
  importing = false;
  importButton.disabled = false;
}

function setSelectedImage(file, label, sourceUrl = '') {
  if (file.size > MAX_IMAGE_BYTES) {
    setMessage('图片超过 20 MB，请选择较小的图片', true);
    return false;
  }
  selectedImageFile = file;
  selectedImageLabel = label;
  importedUrl = sourceUrl;
  imageInput.value = '';
  if (!sourceUrl) imageUrlInput.value = '';
  updateControls();
  schedulePreview();
  return true;
}

function selectLocalImage(file, label) {
  cancelImport();
  if (setSelectedImage(file, label)) setMessage('图片已就绪', false);
}

async function refreshIndex() {
  try {
    const response = await apiFetch('/api/sequence');
    if (!response.ok) return;
    const data = await response.json();
    indexInput.placeholder = '自动 ' + String(data.nextIndex).padStart(3, '0');
  } catch {
    indexInput.placeholder = '自动编号';
  }
}

function formData() {
  const data = new FormData(form);
  data.delete('image');
  if (selectedImageFile) data.append('image', selectedImageFile, selectedImageFile.name);
  return data;
}

async function preview() {
  cancelPreview();
  if (!selectedImageFile || !titleInput.value.trim()) {
    clearPreview();
    setPreviewMessage('', false);
    return;
  }
  clearPreview('正在更新预览…');
  previewController = new AbortController();
  const current = previewSerial;
  try {
    const response = await apiFetch('/api/preview', {
      method: 'POST',
      body: formData(),
      signal: previewController.signal
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '预览失败');
    }
    const blob = await response.blob();
    if (current !== previewSerial) return;
    showPreview(blob);
  } catch (error) {
    if (error.name === 'AbortError') return;
    if (current === previewSerial) {
      clearPreview('预览未生成，请调整内容后重试');
      setPreviewMessage(errorText(error), true);
    }
  }
}

function schedulePreview() {
  formRevision++;
  updateControls();
  cancelPreview();
  setPreviewMessage('', false);
  const ready = selectedImageFile && titleInput.value.trim();
  clearPreview(ready ? '正在更新预览…' : undefined);
  if (ready) previewTimer = setTimeout(preview, 350);
}

function filenameFromUrl(value, type) {
  let stem = 'network-image';
  try {
    const name = decodeURIComponent(new URL(value).pathname.split('/').pop() || '');
    stem = name.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}-]+/gu, '-').slice(0, 50) || stem;
  } catch {
    // The server has already validated the URL; keep the fallback name.
  }
  return stem + '.' + extensionFor(type);
}

async function importImageUrl() {
  const value = imageUrlInput.value.trim();
  if (!value) {
    setMessage('请先粘贴图片链接', true);
    imageUrlInput.focus();
    return false;
  }
  if (value === importedUrl && selectedImageFile) return true;
  cancelImport();
  const current = ++importSerial;
  importController = new AbortController();
  importing = true;
  importButton.disabled = true;
  setMessage('正在读取网络图片…', false);
  try {
    const response = await apiFetch('/api/import-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: value }),
      signal: importController.signal
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '网络图片导入失败');
    }
    const blob = await response.blob();
    if (current !== importSerial) return false;
    const file = new File([blob], filenameFromUrl(value, blob.type), { type: blob.type });
    if (!setSelectedImage(file, '网络图片 · ' + file.name, value)) return false;
    setMessage('网络图片已导入', false);
    return true;
  } catch (error) {
    if (error.name !== 'AbortError' && current === importSerial) {
      setMessage(errorText(error), true);
    }
    return false;
  } finally {
    if (current === importSerial) {
      importing = false;
      importButton.disabled = false;
      importController = undefined;
    }
  }
}

function clipboardImage(event) {
  for (const item of Array.from(event.clipboardData?.items || [])) {
    if (item.type.startsWith('image/')) {
      const blob = item.getAsFile();
      if (blob) return new File([blob], 'pasted-image.' + extensionFor(blob.type), { type: blob.type });
    }
  }
  return null;
}

function clipboardImageUrl(event) {
  const text = event.clipboardData?.getData('text/plain')?.trim() || '';
  if (/^https?:\/\/\S+$/i.test(text)) return text;
  const html = event.clipboardData?.getData('text/html') || '';
  if (html) {
    const document = new DOMParser().parseFromString(html, 'text/html');
    const src = document.querySelector('img')?.getAttribute('src') || '';
    if (/^https?:\/\/\S+$/i.test(src)) return src;
  }
  return '';
}

imageInput.addEventListener('change', () => {
  const file = imageInput.files?.[0];
  if (file) selectLocalImage(file, file.name);
});

uploadBox.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    imageInput.click();
  }
});

imageUrlInput.addEventListener('paste', (event) => {
  if (clipboardImage(event)) return;
  const url = clipboardImageUrl(event);
  if (!url) return;
  event.preventDefault();
  imageUrlInput.value = url;
  void importImageUrl();
});

imageUrlInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    void importImageUrl();
  }
});

importButton.addEventListener('click', () => { void importImageUrl(); });

document.addEventListener('paste', (event) => {
  const file = clipboardImage(event);
  if (file) {
    event.preventDefault();
    selectLocalImage(file, '已粘贴图片 · ' + file.name);
    return;
  }
  if (event.target === imageUrlInput) return;
  if (event.target === uploadBox || uploadBox.contains(event.target)) {
    const url = clipboardImageUrl(event);
    if (url) {
      event.preventDefault();
      imageUrlInput.value = url;
      void importImageUrl();
    }
  }
});

form.addEventListener('input', (event) => {
  if (event.target !== imageUrlInput) schedulePreview();
});
form.addEventListener('change', (event) => {
  if (event.target !== imageInput && event.target !== imageUrlInput) schedulePreview();
});
for (const input of cropInputs) input.addEventListener('change', updateControls);
document.getElementById('reset-crop').addEventListener('click', () => {
  document.getElementById('x').value = '0.5';
  document.getElementById('y').value = '0.5';
  document.getElementById('zoom').value = '1';
  schedulePreview();
});
for (const button of categoryPresets) {
  button.addEventListener('click', () => {
    typeInput.value = button.dataset.category;
    schedulePreview();
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (generating) return;
  if (!form.reportValidity()) return;
  if (importing) {
    setMessage('请等待网络图片导入完成', true);
    return;
  }
  generating = true;
  generateButton.disabled = true;
  let submittedRevision;
  let submittedPreview;
  try {
    if (imageUrlInput.value.trim() && imageUrlInput.value.trim() !== importedUrl) {
      if (!(await importImageUrl())) return;
    }
    if (!selectedImageFile) {
      setMessage('请选择、粘贴或导入一张原始图片', true);
      uploadBox.focus();
      return;
    }
    const requestData = formData();
    const requestedFormat = requestData.get('format');
    const revision = formRevision;
    cancelPreview();
    const current = previewSerial;
    submittedRevision = revision;
    submittedPreview = current;
    setMessage('正在生成封面…', false);
    const response = await apiFetch('/api/covers', { method: 'POST', body: requestData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '生成失败');
    addExportResult(data, requestedFormat);
    setMessage('已生成 ' + data.filename, false);
    await refreshIndex();
    if (revision !== formRevision || current !== previewSerial) return;
    try {
      const imageResponse = await apiFetch(data.url);
      if (!imageResponse.ok) throw new Error('封面已生成，预览读取失败，请使用下载链接');
      const imageBlob = await imageResponse.blob();
      if (revision === formRevision && current === previewSerial) showPreview(imageBlob);
    } catch (error) {
      if (revision === formRevision && current === previewSerial) {
        clearPreview('封面已生成，可从生成记录下载');
        setPreviewMessage(errorText(error), true);
      }
    }
  } catch (error) {
    setMessage(errorText(error), true);
    if (submittedRevision === formRevision && submittedPreview === previewSerial) {
      void preview();
    }
  } finally {
    generating = false;
    generateButton.disabled = false;
  }
});

updateControls();
refreshIndex();

history().then(records => records.reverse().forEach(record => addExportResult(record, record.format))).catch(error => setMessage("历史记录读取失败：" + errorText(error), true));
