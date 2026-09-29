import express, { type ErrorRequestHandler, type Express } from 'express';
import multer from 'multer';
import path from 'node:path';
import { ZodError } from 'zod';
import { renderCover } from './render.js';
import { CoverInputError } from './errors.js';
import { coverOptionsSchema } from './schema.js';
import { encodeCover, outputFormatSchema } from './output.js';
import { peekNextIndex, saveCover } from './sequence.js';

export interface AppConfig {
  outputDir: string;
  sequencePath: string;
  publicDir: string;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 }
});

function numberField(value: unknown, fallback?: number): number | undefined {
  if (value === undefined || value === '') return fallback;
  return Number(value);
}

function formOptions(body: Record<string, unknown>, index: number) {
  return {
    title: body.title,
    subtitle: body.subtitle,
    type: body.type,
    index,
    crop: {
      mode: body.crop || 'contain',
      x: numberField(body.x, 0.5),
      y: numberField(body.y, 0.5)
    }
  };
}

export function createApp(config: AppConfig): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.static(config.publicDir, { extensions: ['html'] }));

  app.get('/api/sequence', async (_request, response) => {
    response.json({ nextIndex: await peekNextIndex(config.sequencePath) });
  });

  app.post('/api/preview', upload.single('image'), async (request, response) => {
    if (!request.file) {
      response.status(400).json({ error: '请选择封面图片' });
      return;
    }
    const index = numberField(request.body.index, await peekNextIndex(config.sequencePath));
    const format = outputFormatSchema.parse(request.body.format || 'png');
    const result = await encodeCover(
      await renderCover(request.file.buffer, formOptions(request.body, index!)), format
    );
    response.type(format === 'jpeg' ? 'jpeg' : 'png').set('Cache-Control', 'no-store').send(result);
  });

  app.post('/api/covers', upload.single('image'), async (request, response) => {
    if (!request.file) {
      response.status(400).json({ error: '请选择封面图片' });
      return;
    }
    const requestedIndex = numberField(request.body.index);
    const options = coverOptionsSchema.parse(formOptions(request.body, requestedIndex ?? 1));
    const result = await saveCover({
      source: request.file.buffer,
      sourceName: request.file.originalname,
      options: {
        title: options.title,
        subtitle: options.subtitle,
        type: options.type,
        crop: options.crop
      },
      index: requestedIndex,
      format: outputFormatSchema.parse(request.body.format || 'png'),
      outputDir: config.outputDir,
      sequencePath: config.sequencePath
    });
    response.status(201).json({
      index: result.index,
      filename: result.filename,
      url: '/api/covers/' + encodeURIComponent(result.filename)
    });
  });

  app.get('/api/covers/:filename', (request, response) => {
    const filename = request.params.filename;
    if (typeof filename !== 'string' ||
        !/^\d{3,6}-(anime|game|tv|life|coding)-[\p{L}\p{N}-]+\.(png|jpg)$/u.test(filename)) {
      response.status(404).json({ error: '文件不存在' });
      return;
    }
    response.download(path.join(config.outputDir, filename));
  });

  const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    if (error instanceof ZodError) {
      response.status(400).json({
        error: error.issues.map((issue) => issue.path.join('.') + '：' + issue.message).join('；')
      });
    } else if (error instanceof CoverInputError) {
      response.status(400).json({ error: error.message });
    } else if (error instanceof multer.MulterError) {
      response.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.message });
    } else if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      response.status(409).json({ error: '该编号的文件已存在，请更换编号' });
    } else {
      console.error(error);
      response.status(500).json({ error: error instanceof Error ? error.message : '生成失败' });
    }
  };
  app.use(errorHandler);
  return app;
}




