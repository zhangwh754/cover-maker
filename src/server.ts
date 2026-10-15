import path from 'node:path';
import { createApp } from './app.js';

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT 必须是 1 到 65535 之间的整数');
}

const app = createApp({
  outputDir: path.resolve('output'),
  sequencePath: path.resolve('data/sequence.json'),
  publicDir: path.resolve('dist-mobile')
});

app.listen(port, '127.0.0.1', () => {
  console.log('封面生成器已启动：http://localhost:' + port);
});
