import { parentPort } from 'node:worker_threads';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadAll } from 'js-yaml';

if (!parentPort) {
  throw new Error('Worker must be spawned with a parent port');
}

const JSON_INDENT = 2;

parentPort.on('message', async (message) => {
  if (!message) {
    return;
  }

  if (message.type === 'shutdown') {
    parentPort.close();
    return;
  }

  if (message.type !== 'convert') {
    return;
  }

  const { sourcePath, destinationPath, relativePath } = message;

  try {
    const raw = await readFile(sourcePath, 'utf8');
    const documents = [];
    loadAll(raw, (doc) => {
      documents.push(doc);
    }, { json: true });

    const payload = documents.length === 1 ? documents[0] : documents;

    await mkdir(path.dirname(destinationPath), { recursive: true });
    await writeFile(destinationPath, JSON.stringify(payload, null, JSON_INDENT), 'utf8');

    parentPort.postMessage({ type: 'done', relativePath });
  } catch (error) {
    parentPort.postMessage({
      type: 'error',
      relativePath,
      errorMessage: error?.message ?? 'Unknown worker error',
      errorStack: error?.stack,
    });
  }
});
