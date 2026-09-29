const form = document.getElementById('cover-form');
const imageInput = document.getElementById('image');
const titleInput = document.getElementById('title');
const indexInput = document.getElementById('index');
const cropInputs = document.querySelectorAll('input[name="crop"]');
const focusControls = document.getElementById('focus-controls');
const previewImage = document.getElementById('preview-image');
const previewEmpty = document.getElementById('preview-empty');
const fileName = document.getElementById('file-name');
const message = document.getElementById('message');
const generateButton = document.getElementById('generate');
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
  fileName.textContent = imageInput.files[0] ? imageInput.files[0].name : '';
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
  return new FormData(form);
}

function setMessage(text, isError) {
  message.textContent = text;
  message.classList.toggle('error', Boolean(isError));
}

async function preview() {
  if (!imageInput.files.length || !titleInput.value.trim()) {
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
    if (current === previewSerial) setMessage(error.message, true);
  }
}

function schedulePreview() {
  updateControls();
  clearTimeout(previewTimer);
  previewTimer = setTimeout(preview, 350);
}

form.addEventListener('input', schedulePreview);
form.addEventListener('change', schedulePreview);
for (const input of cropInputs) input.addEventListener('change', updateControls);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
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
    link.textContent = '下载 PNG';
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
    setMessage(error.message, true);
  } finally {
    generateButton.disabled = false;
  }
});

updateControls();
refreshIndex();
