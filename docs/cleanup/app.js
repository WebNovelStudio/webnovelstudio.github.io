const maxFileBytes = 32 * 1024 * 1024;
const form = document.querySelector('#cleanup-form');
const source = document.querySelector('#source-file');
const fileName = document.querySelector('#file-name');
const options = [...form.querySelectorAll('input[type="checkbox"]')];
const apply = document.querySelector('#apply');
const download = document.querySelector('#download');
const status = document.querySelector('#cleanup-status');

const errors = {
  setup: '정리 도구를 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 적용해 주세요.',
  read: 'TXT 파일을 읽지 못했습니다. 파일을 다시 선택해 주세요.',
  encoding: '이 TXT의 글자 인코딩을 읽을 수 없습니다. UTF-8로 저장한 사본을 선택해 주세요.',
  limit: '한 줄 또는 문단이 너무 길어 정리하지 못했습니다.',
  output: '정리 결과가 64 MiB를 넘어 메모리에 담을 수 없습니다.',
  process: '글 정리를 완료하지 못했습니다. 파일을 다시 선택해 주세요.',
};

let activeWorker = null;
let resultUrl = null;

function showStatus(message, error = false) {
  status.textContent = message;
  status.dataset.error = String(error);
}

function clearWork() {
  activeWorker?.terminate();
  activeWorker = null;
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = null;
  download.hidden = true;
  download.removeAttribute('href');
  download.removeAttribute('download');
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
window.addEventListener('pagehide', resetWorkspace);
window.addEventListener('pageshow', resetWorkspace);
resetWorkspace();

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (activeWorker) return;
  const file = validateSelection();
  if (!file) return;
  clearWork();
  apply.disabled = true;
  showStatus('글 정리 도구를 준비하고 있습니다…');

  const flags = Object.fromEntries(options.map(({name, checked}) => [name, checked]));
  let worker;
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), {type: 'module'});
  } catch {
    apply.disabled = false;
    showStatus(errors.setup, true);
    return;
  }
  activeWorker = worker;
  let started = false;

  function fail(reason) {
    if (activeWorker !== worker) return;
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
    if (data.type !== 'result' || !(data.bytes instanceof Uint8Array)) {
      fail(data.reason);
      return;
    }
    clearWork();
    apply.disabled = false;
    try {
      resultUrl = URL.createObjectURL(new Blob([data.bytes], {type: 'text/plain;charset=utf-8'}));
      const stem = file.name.slice(0, -4).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_');
      download.href = resultUrl;
      download.download = `${stem || 'text'}-정리.txt`;
      download.hidden = false;
      showStatus('글 정리를 마쳤습니다. 다운로드 링크에서 결과를 저장하세요.');
    } catch {
      clearWork();
      showStatus(errors.output, true);
    }
  });
});
