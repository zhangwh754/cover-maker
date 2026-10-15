import { promises as fs } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { renderCover, type ImageSource } from './render.js';
import { encodeCover, extensionFor, outputFormatSchema, type OutputFormat } from './output.js';
import { coverOptionsSchema, type CoverOptions } from './schema.js';
import { categoryDetails } from './category.js';
import { safeFilenamePart } from './filename.js';

export interface SaveCoverRequest {
  source: ImageSource;
  sourceName: string;
  options: Omit<CoverOptions, 'index'>;
  index?: number;
  format?: OutputFormat;
  outputDir: string;
  sequencePath: string;
}

export interface SaveCoverResult {
  index: number;
  filename: string;
  path: string;
}

async function readLastIndex(sequencePath: string): Promise<number> {
  try {
    const data: unknown = JSON.parse(await fs.readFile(sequencePath, 'utf8'));
    if (
      !data || typeof data !== 'object' || !('global' in data) ||
      typeof data.global !== 'number' || !Number.isSafeInteger(data.global) || data.global < 0
    ) {
      throw new Error('编号文件无效：' + sequencePath);
    }
    return data.global;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw error;
  }
}

export async function peekNextIndex(sequencePath: string): Promise<number> {
  return (await readLastIndex(sequencePath)) + 1;
}

async function writeLastIndex(sequencePath: string, index: number): Promise<void> {
  await fs.mkdir(path.dirname(sequencePath), { recursive: true });
  const temporary = sequencePath + '.tmp-' + process.pid + '-' + Date.now();
  try {
    await fs.writeFile(temporary, JSON.stringify({ global: index }, null, 2) + '\n', 'utf8');
    await fs.rename(temporary, sequencePath);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

async function withLock<T>(sequencePath: string, operation: () => Promise<T>): Promise<T> {
  const lockPath = sequencePath + '.lock';
  await fs.mkdir(path.dirname(lockPath), { recursive: true });
  for (let attempt = 0; attempt < 100; attempt++) {
    let handle: fs.FileHandle;
    try {
      handle = await fs.open(lockPath, 'wx');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      try {
        const stat = await fs.stat(lockPath);
        if (Date.now() - stat.mtimeMs > 5 * 60 * 1000) {
          await fs.rm(lockPath, { force: true });
          continue;
        }
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code !== 'ENOENT') throw statError;
      }
      await delay(100);
      continue;
    }
    try {
      return await operation();
    } finally {
      await handle.close();
      await fs.rm(lockPath, { force: true });
    }
  }
  throw new Error('编号文件被其他进程占用，请稍后重试');
}
function safeStem(name: string): string {
  return safeFilenamePart(path.basename(name, path.extname(name)), 'cover');
}

async function saveWithIndex(request: SaveCoverRequest, index: number): Promise<SaveCoverResult> {
  const options = coverOptionsSchema.parse({ ...request.options, index });
  const format = outputFormatSchema.parse(request.format ?? 'png');
  const filename = String(index).padStart(3, '0') + '-' + categoryDetails(options.type).filename + '-' +
    safeStem(request.sourceName) + extensionFor(format);
  const outputPath = path.join(request.outputDir, filename);
  const buffer = await encodeCover(await renderCover(request.source, options), format);
  await fs.mkdir(request.outputDir, { recursive: true });
  await fs.writeFile(outputPath, buffer, { flag: 'wx' });
  return { index, filename, path: outputPath };
}

export async function saveCover(request: SaveCoverRequest): Promise<SaveCoverResult> {
  if (request.index !== undefined) return saveWithIndex(request, request.index);
  return withLock(request.sequencePath, async () => {
    let index = await peekNextIndex(request.sequencePath);
    let result: SaveCoverResult;
    for (;;) {
      try {
        result = await saveWithIndex(request, index);
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        // Manual exports do not advance the counter, but must not block it.
        index++;
      }
    }
    try {
      await writeLastIndex(request.sequencePath, index);
      return result;
    } catch (error) {
      await fs.rm(result.path, { force: true });
      throw error;
    }
  });
}


