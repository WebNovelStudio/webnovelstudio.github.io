import {loadPyodide} from './runtime/0.29.5/pyodide.mjs';

const maxFileBytes = 32 * 1024 * 1024;
const inputPath = '/tmp/source.txt';
const outputPath = '/tmp/result.txt';
const enginePath = '/tmp/wns-cleanup.zip';

async function prepare() {
  const engineUrl = new URL('./engine-v2.zip', import.meta.url);
  const [python, response] = await Promise.all([
    loadPyodide({indexURL: new URL('./runtime/0.29.5/', import.meta.url).href}),
    fetch(engineUrl, {credentials: 'omit'}),
  ]);
  if (!response.ok) throw new Error('Cleanup engine is unavailable');
  python.FS.writeFile(enginePath, new Uint8Array(await response.arrayBuffer()), {canOwn: true});
  python.runPython(`
import json, sys
sys.path.insert(0, '${enginePath}')
from browser_export import save_cleanup
from browser_preview import PreviewIndex
`);
  return python;
}

try {
  const python = await prepare();
  let started = false;
  let pageCount = 0;
  self.addEventListener('message', async ({data}) => {
    if (data.type === 'preview-page') {
      const {index} = data;
      if (!Number.isSafeInteger(index) || index < 0 || index >= pageCount) return;
      try {
        const preview = JSON.parse(python.runPython('json.dumps(preview_index.page(' + index + '))'));
        self.postMessage({type: 'preview-page', preview});
      } catch {
        self.postMessage({type: 'preview-error'});
      }
      return;
    }
    if (started) return;
    started = true;
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
      const [reason, encoding] = JSON.parse(python.runPython(
        "json.dumps(save_cleanup('" + inputPath + "', '" + outputPath + "', cleanup_options_json))",
      ));
      if (reason) {
        message = {type: 'error', reason};
      } else {
        const bytes = python.FS.readFile(outputPath);
        let preview = null;
        self.postMessage({type: 'preview-indexing'});
        python.globals.set('cleanup_source_encoding', encoding);
        try {
          preview = JSON.parse(python.runPython(
            "preview_index = PreviewIndex('" + inputPath + "', '" + outputPath + "', cleanup_source_encoding)\n" +
            "json.dumps(preview_index.page())",
          ));
          pageCount = preview.count;
        } catch {
          // Keep the completed export available if the optional preview fails.
        } finally {
          python.globals.delete('cleanup_source_encoding');
        }
        message = {type: 'result', bytes, preview};
      }
    } catch {
      message = {type: 'error', reason: 'process'};
    } finally {
      python.globals.delete('cleanup_options_json');
      if (pageCount < 2) {
        for (const path of [inputPath, outputPath]) {
          if (python.FS.analyzePath(path).exists) python.FS.unlink(path);
        }
      }
    }
    self.postMessage(message, message.bytes ? [message.bytes.buffer] : []);
  });
  self.postMessage({type: 'ready'});
} catch {
  self.postMessage({type: 'error', reason: 'setup'});
}
