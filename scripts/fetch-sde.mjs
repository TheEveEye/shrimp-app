#!/usr/bin/env node

import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import unzipper from 'unzipper';
import { Worker } from 'node:worker_threads';
import { SingleBar, Presets } from 'cli-progress';

const DOWNLOAD_URL = 'https://eve-static-data-export.s3-eu-west-1.amazonaws.com/tranquility/sde.zip';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'src', 'assets', 'sde');
const workerModuleUrl = new URL('./fetch-sde-worker.mjs', import.meta.url);

const yamlExtension = /\.ya?ml$/i;

function log(message) {
  console.log(`[sde:fetch] ${message}`);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = value < 10 && unitIndex > 0 ? 1 : 0;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

function createDownloadBar(totalBytes) {
  const bar = new SingleBar(
    {
      format: `[sde:fetch] Downloading |{bar}| {valueReadable}/{totalReadable} ({percentage}%)`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      autopadding: true,
    },
    Presets.shades_classic,
  );

  bar.start(totalBytes, 0, {
    valueReadable: formatBytes(0),
    totalReadable: formatBytes(totalBytes),
  });

  return bar;
}

function createProcessingBar(totalFiles) {
  const bar = new SingleBar(
    {
      format: `[sde:fetch] Processing |{bar}| ({converted}/{total}) files {percentage}%`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      autopadding: true,
    },
    Presets.shades_classic,
  );

  bar.start(totalFiles, 0, { converted: 0 });
  return bar;
}

async function downloadZip(url, destination) {
  log(`Downloading archive from ${url}`);
  await mkdir(path.dirname(destination), { recursive: true });

  if (typeof fetch === 'function') {
    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`Failed to download SDE archive. HTTP ${response.status} ${response.statusText}`);
    }
    const totalBytes = Number(response.headers.get('content-length'));
    const hasKnownSize = Number.isFinite(totalBytes) && totalBytes > 0;
    const progressBar = hasKnownSize ? createDownloadBar(totalBytes) : null;
    const progressStream = progressBar
      ? new Transform({
          transform(chunk, encoding, callback) {
            progressBar.update(progressBar.value + chunk.length, {
              valueReadable: formatBytes(progressBar.value + chunk.length),
            });
            callback(null, chunk);
          },
        })
      : null;

    try {
      const readable = Readable.fromWeb(response.body);
      if (progressStream) {
        await pipeline(readable, progressStream, createWriteStream(destination));
      } else {
        await pipeline(readable, createWriteStream(destination));
      }
    } finally {
      if (progressBar && Number.isFinite(totalBytes)) {
        progressBar.update(totalBytes, {
          valueReadable: formatBytes(totalBytes),
        });
      }
      progressBar?.stop();
    }
    return;
  }

  await new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (!response.statusCode || response.statusCode >= 400) {
        reject(new Error(`Failed to download SDE archive. HTTP ${response.statusCode}`));
        response.resume();
        return;
      }

      const totalBytes = Number(response.headers['content-length']);
      const hasKnownSize = Number.isFinite(totalBytes) && totalBytes > 0;
      const progressBar = hasKnownSize ? createDownloadBar(totalBytes) : null;
      const progressStream = progressBar
        ? new Transform({
            transform(chunk, encoding, callback) {
              progressBar.update(progressBar.value + chunk.length, {
                valueReadable: formatBytes(progressBar.value + chunk.length),
              });
              callback(null, chunk);
            },
          })
        : null;

      const destinationStream = createWriteStream(destination);
      const pipelinePromise = progressStream
        ? pipeline(response, progressStream, destinationStream)
        : pipeline(response, destinationStream);

      pipelinePromise
        .then(() => {
          if (progressBar && Number.isFinite(totalBytes)) {
            progressBar.update(totalBytes, {
              valueReadable: formatBytes(totalBytes),
            });
          }
          progressBar?.stop();
          resolve();
        })
        .catch((error) => {
          progressBar?.stop();
          reject(error);
        });
    });

    request.on('error', reject);
  });
}

async function extractZip(zipPath, destination) {
  log('Extracting archive');
  await mkdir(destination, { recursive: true });
  await pipeline(createReadStream(zipPath), unzipper.Extract({ path: destination }));
}

async function locateSdeRoot(extractedRoot) {
  let current = extractedRoot;
  let entries = await readdir(current, { withFileTypes: true });

  while (entries.length === 1 && entries[0].isDirectory()) {
    current = path.join(current, entries[0].name);
    entries = await readdir(current, { withFileTypes: true });
  }

  return current;
}

async function listFiles(directory, root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolutePath, root)));
      continue;
    }

    files.push({
      sourcePath: absolutePath,
      relativePath: path.relative(root, absolutePath),
      isYaml: yamlExtension.test(entry.name),
    });
  }

  return files;
}

function determineWorkerCount(taskCount) {
  if (taskCount <= 0) {
    return 0;
  }

  const fromEnvRaw = process.env.SDE_FETCH_WORKERS;
  const fromEnv = fromEnvRaw ? Number.parseInt(fromEnvRaw, 10) : NaN;
  if (!Number.isNaN(fromEnv) && fromEnv > 0) {
    return Math.min(fromEnv, taskCount);
  }

  const hardwareConcurrency = typeof os.availableParallelism === 'function'
    ? os.availableParallelism()
    : os.cpus().length;
  const defaultWorkers = hardwareConcurrency > 1 ? hardwareConcurrency - 1 : 1;

  return Math.max(1, Math.min(defaultWorkers, taskCount));
}

async function processYamlFiles(yamlFiles, destinationRoot, workerCount, onConverted) {
  if (yamlFiles.length === 0 || workerCount <= 0) {
    return;
  }

  const workersToUse = Math.max(1, Math.min(workerCount, yamlFiles.length));

  await new Promise((resolve, reject) => {
    let nextIndex = 0;
    let settled = false;
    const workers = new Set();

    const settle = (error) => {
      if (settled) {
        return;
      }
      settled = true;

      if (error) {
        for (const worker of workers) {
          worker.terminate().catch(() => {
            // Ignore termination errors during shutdown.
          });
        }
        reject(error);
        return;
      }

      resolve();
    };

    const assign = (worker) => {
      if (settled) {
        return;
      }

      if (nextIndex >= yamlFiles.length) {
        worker.postMessage({ type: 'shutdown' });
        return;
      }

      const file = yamlFiles[nextIndex++];
      worker.postMessage({
        type: 'convert',
        sourcePath: file.sourcePath,
        destinationPath: path.join(
          destinationRoot,
          file.relativePath.replace(yamlExtension, '.json'),
        ),
        relativePath: file.relativePath,
      });
    };

    for (let index = 0; index < workersToUse; index += 1) {
      const worker = new Worker(workerModuleUrl, { type: 'module' });
      workers.add(worker);

      worker.once('online', () => {
        assign(worker);
      });

      worker.on('message', (message) => {
        if (settled) {
          return;
        }

        if (message?.type === 'done') {
          onConverted(message.relativePath);
          assign(worker);
          return;
        }

        if (message?.type === 'error') {
          const error = new Error(message.errorMessage || 'Worker failed to convert YAML');
          if (message.errorStack) {
            error.stack = message.errorStack;
          }
          settle(error);
        }
      });

      worker.on('error', (error) => {
        settle(error);
      });

      worker.on('exit', (code) => {
        workers.delete(worker);
        if (settled) {
          return;
        }

        if (code !== 0) {
          settle(new Error(`A conversion worker exited with code ${code}`));
          return;
        }

        if (workers.size === 0 && nextIndex >= yamlFiles.length) {
          settle();
        }
      });
    }
  });
}

async function convertSde(sourceRoot, destinationRoot) {
  const files = await listFiles(sourceRoot, sourceRoot);
  const totalFiles = files.length;
  let processedCount = 0;
  let convertedYamlCount = 0;
  let copiedCount = 0;

  const progressBar = totalFiles > 0 ? createProcessingBar(totalFiles) : null;
  const updateProgress = () => {
    progressBar?.update(processedCount, { converted: convertedYamlCount });
  };

  const yamlFiles = [];
  const otherFiles = [];

  for (const file of files) {
    if (file.isYaml) {
      yamlFiles.push(file);
    } else {
      otherFiles.push(file);
    }
  }

  try {
    for (const file of otherFiles) {
      const destinationPath = path.join(destinationRoot, file.relativePath);
      await mkdir(path.dirname(destinationPath), { recursive: true });
      await pipeline(createReadStream(file.sourcePath), createWriteStream(destinationPath));
      copiedCount += 1;
      processedCount += 1;
      updateProgress();
    }

    if (yamlFiles.length > 0) {
      const workerCount = determineWorkerCount(yamlFiles.length);
      log(
        `Converting ${yamlFiles.length} YAML file${yamlFiles.length === 1 ? '' : 's'} with ${workerCount} worker${workerCount === 1 ? '' : 's'}`,
      );

      await processYamlFiles(yamlFiles, destinationRoot, workerCount, () => {
        convertedYamlCount += 1;
        processedCount += 1;
        updateProgress();
      });
    }

    if (progressBar) {
      progressBar.update(totalFiles, { converted: convertedYamlCount });
    }

    return { yamlCount: convertedYamlCount, copiedCount };
  } finally {
    progressBar?.stop();
  }
}

async function main() {
  log('Preparing workspace');
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'shrimp-sde-'));
  const zipPath = path.join(tempRoot, 'sde.zip');
  const extractPath = path.join(tempRoot, 'extracted');

  try {
    await downloadZip(DOWNLOAD_URL, zipPath);
    log('Download complete');

    await extractZip(zipPath, extractPath);
    log('Extraction complete');

    const sdeRoot = await locateSdeRoot(extractPath);
    log(`Source root located at ${path.relative(extractPath, sdeRoot) || '.'}`);

    await rm(outputDir, { recursive: true, force: true });
    await mkdir(outputDir, { recursive: true });

    const { yamlCount, copiedCount } = await convertSde(sdeRoot, outputDir);
    log(`Converted ${yamlCount} YAML files to JSON`);
    if (copiedCount > 0) {
      log(`Copied ${copiedCount} additional files`);
    }

    log(`SDE ready at ${outputDir}`);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('[sde:fetch] Failed to fetch SDE');
  console.error(error);
  process.exitCode = 1;
});
