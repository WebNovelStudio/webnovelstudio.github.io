import {loadPyodide} from './runtime/0.29.5/pyodide.mjs';

const maxFileBytes = 32 * 1024 * 1024;
const inputPath = '/tmp/source.txt';
const outputPath = '/tmp/result.txt';
const enginePath = '/tmp/wns-cleanup.zip';

async function prepare() {
  const engineUrl = new URL('./engine-v1.zip', import.meta.url);
  const [python, response] = await Promise.all([
    loadPyodide({indexURL: new URL('./runtime/0.29.5/', import.meta.url).href}),
    fetch(engineUrl, {credentials: 'omit'}),
  ]);
  if (!response.ok) throw new Error('Cleanup engine is unavailable');
  python.FS.writeFile(enginePath, new Uint8Array(await response.arrayBuffer()), {canOwn: true});
  python.runPython(`
import sys
sys.path.insert(0, '${enginePath}')
from browser_export import save_cleanup
`);
  return python;
}

try {
  const python = await prepare();
  self.addEventListener('message', async ({data}) => {
    const {file, flags} = data;
    if (!(file instanceof File) || file.size > maxFileBytes) {
      self.postMessage({type: 'error', reason: 'read'});
      return;
    }
    let input;
    try {
      input = new Uint8Array(await file.arrayBuffer());
    } catch {
      self.postMessage({type: 'error', reason: 'read'});
      return;
    }

    let message;
    try {
      python.FS.writeFile(inputPath, input, {canOwn: true});
      python.globals.set('cleanup_options_json', JSON.stringify(flags));
      const reason = python.runPython(`save_cleanup('${inputPath}', '${outputPath}', cleanup_options_json)`);
      message = reason
        ? {type: 'error', reason}
        : {type: 'result', bytes: python.FS.readFile(outputPath)};
    } catch {
      message = {type: 'error', reason: 'process'};
    } finally {
      python.globals.delete('cleanup_options_json');
      for (const path of [inputPath, outputPath]) {
        if (python.FS.analyzePath(path).exists) python.FS.unlink(path);
      }
    }
    self.postMessage(message, message.bytes ? [message.bytes.buffer] : []);
  }, {once: true});
  self.postMessage({type: 'ready'});
} catch {
  self.postMessage({type: 'error', reason: 'setup'});
}
