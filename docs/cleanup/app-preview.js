const maxFileBytes = 32 * 1024 * 1024;
const form = document.querySelector('#cleanup-form');
const source = document.querySelector('#source-file');
const fileName = document.querySelector('#file-name');
const options = [...form.querySelectorAll('input[type="checkbox"]')];
const apply = document.querySelector('#apply');
const download = document.querySelector('#download');
const status = document.querySelector('#cleanup-status');
const preview = document.querySelector('#cleanup-preview');
const previewLocation = document.querySelector('#preview-location');
const beforePane = document.querySelector('#preview-before');
const afterPane = document.querySelector('#preview-after');
const previewNavigation = document.querySelector('#preview-navigation');
const previous = document.querySelector('#preview-prev');
const next = document.querySelector('#preview-next');

const errors = {
  setup: '정리 도구를 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 적용해 주세요.',
  read: 'TXT 파일을 읽지 못했습니다. 파일을 다시 선택해 주세요.',
  encoding: '이 TXT의 글자 인코딩을 읽을 수 없습니다. UTF-8로 저장한 사본을 선택해 주세요.',
  limit: '한 줄 또는 문단이 너무 길어 정리하지 못했습니다.',
  output: '정리 결과가 64 MiB를 넘어 메모리에 담을 수 없습니다.',
  process: '글 정리를 완료하지 못했습니다. 파일을 다시 선택해 주세요.',
  preview: '미리보기를 표시하지 못했습니다. 정리된 TXT는 다운로드할 수 있습니다.',
};

let activeWorker = null;
let processing = false;
let resultUrl = null;
let currentPage = null;
let pendingPage = null;

function showStatus(message, error = false) {
  status.textContent = message;
  status.dataset.error = String(error);
}

function stopWorker() {
  activeWorker?.terminate();
  activeWorker = null;
}

function clearPreview() {
  currentPage = null;
  pendingPage = null;
  preview.hidden = true;
  previewNavigation.hidden = true;
  previewLocation.textContent = '';
  beforePane.replaceChildren();
  afterPane.replaceChildren();
}

function clearWork() {
  stopWorker();
  processing = false;
  clearPreview();
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = null;
  download.hidden = true;
  download.removeAttribute('href');
  download.removeAttribute('download');
}

function drawExcerpt(pane, segments) {
  const content = document.createDocumentFragment();
  if (!segments.length) {
    const empty = document.createElement('span');
    empty.className = 'preview-empty';
    empty.textContent = '이 구간에 표시할 글이 없습니다.';
    content.append(empty);
  }
  for (const [text, changed] of segments) {
    if (changed) {
      const highlight = document.createElement('mark');
      highlight.textContent = text;
      content.append(highlight);
    } else {
      content.append(document.createTextNode(text));
    }
  }
  pane.replaceChildren(content);
  pane.scrollTop = 0;
  const firstChange = pane.querySelector('mark');
  if (firstChange) {
    pane.scrollTop = Math.max(0, firstChange.getBoundingClientRect().top - pane.getBoundingClientRect().top - 32);
  }
}

function showPreview(page) {
  currentPage = page;
  pendingPage = null;
  preview.hidden = false;
  const [first, last] = page.lines;
  const lines = first === last ? '원문 ' + first + '줄' : '원문 ' + first + '–' + last + '줄';
  const location = page.count
    ? '변경 ' + (page.index + 1) + ' / ' + page.count + ' · ' + lines
    : '정리 전후 본문에 바뀐 부분이 없습니다.';
  previewLocation.textContent = location + (page.partial ? ' · 일부 발췌' : '');
  drawExcerpt(beforePane, page.before);
  drawExcerpt(afterPane, page.after);
  previewNavigation.hidden = page.count < 2;
  previous.disabled = page.index === 0;
  next.disabled = page.index >= page.count - 1;
}

function failPreview() {
  stopWorker();
  clearPreview();
  showStatus(errors.preview, true);
}

function requestPreviewPage(increment) {
  if (!activeWorker || !currentPage || pendingPage !== null) return;
  const index = currentPage.index + increment;
  if (index < 0 || index >= currentPage.count) return;
  pendingPage = index;
  previous.disabled = next.disabled = true;
  try {
    activeWorker.postMessage({type: 'preview-page', index});
  } catch {
    failPreview();
  }
}

function validateSelection() {
  const file = source.files[0];
  fileName.textContent = file?.name ?? '선택한 파일이 없습니다.';
  let problem = '';
  if (file && !/\.txt$/i.test(file.name)) problem = '확장자가 .txt인 파일을 선택해 주세요.';
  else if (file && file.size > maxFileBytes) problem = '32 MiB 이하의 TXT 파일을 선택해 주세요.';
  apply.disabled = !file || Boolean(problem);
  showStatus(problem, Boolean(problem));
  return apply.disabled ? null : file;
}

function resetWorkspace() {
  clearWork();
  form.reset();
  source.value = '';
  validateSelection();
}

function sourceChanged() {
  clearWork();
  validateSelection();
}

form.addEventListener('change', sourceChanged);
previous.addEventListener('click', () => requestPreviewPage(-1));
next.addEventListener('click', () => requestPreviewPage(1));
window.addEventListener('pagehide', resetWorkspace);
window.addEventListener('pageshow', resetWorkspace);
resetWorkspace();

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (processing) return;
  const file = validateSelection();
  if (!file) return;
  clearWork();
  apply.disabled = true;
  showStatus('글 정리 도구를 준비하고 있습니다…');

  const flags = Object.fromEntries(options.map(({name, checked}) => [name, checked]));
  let worker;
  try {
    worker = new Worker(new URL('./worker-preview.js', import.meta.url), {type: 'module'});
  } catch {
    apply.disabled = false;
    showStatus(errors.setup, true);
    return;
  }
  activeWorker = worker;
  processing = true;
  let started = false;

  function fail(reason) {
    if (activeWorker !== worker) return;
    if (resultUrl) {
      failPreview();
      return;
    }
    clearWork();
    apply.disabled = false;
    showStatus(errors[reason] ?? errors.process, true);
  }

  worker.addEventListener('error', () => fail(started ? 'process' : 'setup'));
  worker.addEventListener('messageerror', () => fail('process'));
  worker.addEventListener('message', ({data}) => {
    if (activeWorker !== worker) return;
    if (data.type === 'ready' && !started) {
      started = true;
      showStatus('글을 정리하고 있습니다…');
      try {
        worker.postMessage({file, flags});
      } catch {
        fail('read');
      }
      return;
    }
    if (data.type === 'preview-indexing') {
      showStatus('정리 전후를 비교하고 있습니다…');
      return;
    }
    if (data.type === 'preview-page') {
      if (data.preview.index === pendingPage) showPreview(data.preview);
      return;
    }
    if (data.type === 'preview-error') {
      failPreview();
      return;
    }
    if (data.type !== 'result' || !(data.bytes instanceof Uint8Array)) {
      fail(data.reason);
      return;
    }
    processing = false;
    apply.disabled = false;
    try {
      resultUrl = URL.createObjectURL(new Blob([data.bytes], {type: 'text/plain;charset=utf-8'}));
      const stem = file.name.slice(0, -4).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_');
      download.href = resultUrl;
      download.download = `${stem || 'text'}-정리.txt`;
      download.hidden = false;
      if (data.preview) {
        if (data.preview.count < 2) stopWorker();
        showPreview(data.preview);
        showStatus('미리보기에서 바뀐 부분을 확인한 뒤 결과를 저장하세요.');
      } else {
        failPreview();
      }
    } catch {
      clearWork();
      showStatus(errors.output, true);
    }
  });
});
