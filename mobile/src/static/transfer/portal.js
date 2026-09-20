const $ = (id) => document.getElementById(id);
const messages = $('messages').dataset;
let token = sessionStorage.getItem('ikun-transfer') || '';
let refreshTimer;
let noticeTimer;
const uploads = new Set();
function notice(message) {
  $('notice').textContent = message;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => ($('notice').textContent = ''), 5000);
}
async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'x-ikun-token': token,
      'content-type': 'application/json',
      ...(options.headers || {})
    }
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401) disconnect();
    throw new Error(result.message || messages.network);
  }
  return result;
}
function connected() {
  $('connect').hidden = true;
  $('workspace').hidden = false;
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => refresh().catch(() => {}), 3000);
}
function disconnect() {
  if (token)
    fetch('/api/leave', { method: 'POST', headers: { 'x-ikun-token': token } }).catch(() => {});
  token = '';
  sessionStorage.removeItem('ikun-transfer');
  clearInterval(refreshTimer);
  for (const xhr of uploads) xhr.abort();
  $('connect').hidden = false;
  $('workspace').hidden = true;
}
$('join-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    const value = await request('/api/join', {
      method: 'POST',
      body: JSON.stringify({ code: $('code').value.trim() })
    });
    token = value.token;
    sessionStorage.setItem('ikun-transfer', token);
    connected();
    await refresh();
    notice(messages.connected);
  } catch (error) {
    notice(error.message);
  } finally {
    button.disabled = false;
  }
});
$('disconnect').addEventListener('click', disconnect);
$('text').addEventListener(
  'input',
  () => ($('text-count').textContent = `${$('text').value.length} ${messages.count}`)
);
$('send-text').addEventListener('click', async () => {
  if (!$('text').value.trim()) return notice(messages.select);
  $('send-text').disabled = true;
  try {
    await request('/api/text', { method: 'POST', body: JSON.stringify({ text: $('text').value }) });
    notice(messages.sent);
  } catch (error) {
    notice(error.message);
  } finally {
    $('send-text').disabled = false;
  }
});
$('files').addEventListener('change', async () => {
  const files = Array.from($('files').files);
  $('files').value = '';
  for (const file of files) {
    if (!token) break;
    await upload(file);
  }
});
function upload(file) {
  return new Promise((resolve) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'upload';
    const row = document.createElement('div');
    row.className = 'upload-row';
    const name = document.createElement('span');
    name.textContent = file.name;
    const cancel = document.createElement('button');
    cancel.className = 'secondary';
    cancel.textContent = messages.cancel;
    const progress = document.createElement('progress');
    progress.max = 100;
    progress.value = 0;
    const status = document.createElement('small');
    status.textContent = messages.sending;
    row.append(name, cancel);
    wrapper.append(row, progress, status);
    $('uploads').prepend(wrapper);
    const xhr = new XMLHttpRequest();
    uploads.add(xhr);
    xhr.open('POST', '/api/files?name=' + encodeURIComponent(file.name));
    xhr.setRequestHeader('x-ikun-token', token);
    xhr.setRequestHeader('content-type', 'application/octet-stream');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        progress.value = (event.loaded / event.total) * 100;
        status.textContent = `${Math.round(progress.value)}%`;
      }
    };
    cancel.onclick = () => xhr.abort();
    xhr.onload = () => {
      if (xhr.status === 200) {
        progress.value = 100;
        status.textContent = messages.received;
      } else {
        try {
          status.textContent = JSON.parse(xhr.responseText).message;
        } catch {
          status.textContent = messages.network;
        }
      }
    };
    xhr.onerror = () => (status.textContent = messages.network);
    xhr.onabort = () => (status.textContent = messages.retry);
    xhr.onloadend = () => {
      uploads.delete(xhr);
      cancel.remove();
      resolve();
    };
    xhr.send(file);
  });
}
let previousItems = '';
async function refresh() {
  const state = await request('/api/state');
  const serialized = JSON.stringify(state.items);
  if (serialized === previousItems) return;
  previousItems = serialized;
  $('shared').replaceChildren();
  if (!state.items.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = messages.empty;
    $('shared').append(empty);
  }
  for (const item of state.items) {
    const card = document.createElement('article');
    card.className = 'shared-item';
    const name = document.createElement('div');
    name.className = 'item-name';
    name.textContent = item.name;
    const meta = document.createElement('div');
    meta.className = 'item-meta';
    meta.textContent = `${(item.size / 1024).toFixed(1)} KB`;
    card.append(name, meta);
    if (item.kind === 'text') {
      const content = document.createElement('div');
      content.className = 'shared-text';
      content.textContent = item.preview;
      const copy = document.createElement('button');
      copy.className = 'secondary';
      copy.textContent = messages.copy;
      copy.onclick = async () => {
        try {
          const value = await request(`/api/items/${item.id}`);
          content.textContent = value.text;
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(value.text);
            notice(messages.copied);
          } else {
            const field = document.createElement('textarea');
            field.value = value.text;
            field.className = 'sr-only';
            document.body.append(field);
            field.select();
            const copied = document.execCommand('copy');
            field.remove();
            notice(copied ? messages.copied : messages.manual);
          }
        } catch (error) {
          notice(error.message);
        }
      };
      card.append(content, copy);
    } else {
      const link = document.createElement('a');
      link.className = 'file-pick';
      link.textContent = messages.download;
      link.href = `/api/items/${item.id}`;
      link.download = item.name;
      card.append(link);
    }
    $('shared').append(card);
  }
}
$('refresh').addEventListener('click', () => refresh().catch((error) => notice(error.message)));
const code = new URLSearchParams(location.hash.slice(1)).get('code');
if (code && /^\d{6}$/.test(code)) {
  $('code').value = code;
  history.replaceState(null, '', location.pathname);
}
if (token) {
  request('/api/state')
    .then(() => {
      connected();
      return refresh();
    })
    .catch(() => disconnect());
}
