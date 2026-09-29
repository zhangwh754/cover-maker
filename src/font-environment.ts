import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fontDir = fileURLToPath(new URL('../assets/fonts/', import.meta.url));
const configFile = path.join(fontDir, 'fonts.conf');
for (const file of ['NotoSansSC-Regular.otf', 'NotoSerifSC-Regular.otf', 'fonts.conf']) {
  if (!existsSync(path.join(fontDir, file))) {
    throw new Error('缺少项目字体文件：' + path.join(fontDir, file));
  }
}

process.env.FONTCONFIG_FILE = configFile;
process.env.FONTCONFIG_PATH = fontDir;
