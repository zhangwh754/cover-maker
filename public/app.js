const form = document.getElementById('cover-form');
const imageInput = document.getElementById('image');
const uploadBox = document.getElementById('upload-box');
const imageUrlInput = document.getElementById('image-url');
const importButton = document.getElementById('import-url');
const titleInput = document.getElementById('title');
const indexInput = document.getElementById('index');
const cropInputs = document.querySelectorAll('input[name="crop"]');
const focusControls = document.getElementById('focus-controls');
const previewImage = document.getElementById('preview-image');
const previewEmpty = document.getElementById('preview-empty');
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

function selectedCrop() {
  return document.querySelector('input[name="crop"]:checked').value;
}

function updateControls() {
  focusControls.hidden = selectedCrop() !== 'cover';
  for (const id of ['x', 'y']) {
    document.getElementById(id + '-value').textContent =
      Math.round(Number(document.getElementById(id).value) * 100) + '%';
  }
  fileName.textContent = selectedImageLabel;
  uploadBox.classList.toggle('has-image', Boolean(selectedImageFile));
  document.getElementById('format-label').textContent =
    document.getElementById('format').value.toUpperCase() + ' · 3:4';
}

function setMessage(text, isError) {
  message.textContent = text;
  message.classList.toggle('error', Boolean(isError));
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
    const response = await fetch('/api/sequence');
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
  if (!selectedImageFile || !titleInput.value.trim()) {
    previewImage.hidden = true;
    previewEmpty.hidden = false;
    return;
  }
  if (previewController) previewController.abort();
  previewController = new AbortController();
  const current = ++previewSerial;
  try {
    const response = await fetch('/api/preview', {
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
    const nextUrl = URL.createObjectURL(blob);
    previewImage.src = nextUrl;
    previewImage.hidden = false;
    previewEmpty.hidden = true;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = nextUrl;
    setMessage('', false);
  } catch (error) {
    if (error.name === 'AbortError') return;
    if (current === previewSerial) setMessage(errorText(error), true);
  }
}

function schedulePreview() {
  updateControls();
  clearTimeout(previewTimer);
  previewTimer = setTimeout(preview, 350);
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
    const response = await fetch('/api/import-image', {
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

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  if (importing) {
    setMessage('请等待网络图片导入完成', true);
    return;
  }
  if (imageUrlInput.value.trim() && imageUrlInput.value.trim() !== importedUrl) {
    if (!(await importImageUrl())) return;
  }
  if (!selectedImageFile) {
    setMessage('请选择、粘贴或导入一张原始图片', true);
    uploadBox.focus();
    return;
  }
  generateButton.disabled = true;
  clearTimeout(previewTimer);
  if (previewController) previewController.abort();
  previewSerial++;
  setMessage('正在生成封面…', false);
  try {
    const response = await fetch('/api/covers', { method: 'POST', body: formData() });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '生成失败');
    message.classList.remove('error');
    message.textContent = '已生成 ' + data.filename + ' · ';
    const link = document.createElement('a');
    link.href = data.url;
    link.textContent = '下载 ' + document.getElementById('format').value.toUpperCase();
    message.append(link);
    await refreshIndex();
    const imageResponse = await fetch(data.url);
    if (imageResponse.ok) {
      const imageBlob = await imageResponse.blob();
      const nextUrl = URL.createObjectURL(imageBlob);
      previewImage.src = nextUrl;
      previewImage.hidden = false;
      previewEmpty.hidden = true;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = nextUrl;
    }
  } catch (error) {
    setMessage(errorText(error), true);
  } finally {
    generateButton.disabled = false;
  }
});

updateControls();
refreshIndex();
