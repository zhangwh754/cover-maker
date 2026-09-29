import path from 'node:path';
import { Command } from 'commander';
import { ZodError } from 'zod';
import { saveCover } from './sequence.js';

const program = new Command();
program
  .name('cover')
  .description('生成留白文艺系每日推荐封面')
  .requiredOption('-i, --image <path>', '原始封面图')
  .requiredOption('-t, --title <text>', '封面标题')
  .requiredOption('--type <type>', 'anime / game / tv / life / coding')
  .option('--subtitle <text>', '副标题')
  .option('--index <number>', '手动指定编号；不更新自动编号')
  .option('--crop <mode>', 'contain（完整显示）或 cover（铺满裁切）', 'contain')
  .option('--x <number>', '铺满时的水平焦点，0 到 1', '0.5')
  .option('--y <number>', '铺满时的垂直焦点，0 到 1', '0.5')
  .option('--output <dir>', '输出目录', 'output')
  .option('--sequence <file>', '自动编号文件', 'data/sequence.json')
  .parse();

const args = program.opts();

try {
  const result = await saveCover({
    source: path.resolve(args.image),
    sourceName: args.image,
    options: {
      title: args.title,
      subtitle: args.subtitle,
      type: args.type,
      crop: {
        mode: args.crop,
        x: Number(args.x),
        y: Number(args.y)
      }
    },
    index: args.index === undefined ? undefined : Number(args.index),
    outputDir: path.resolve(args.output),
    sequencePath: path.resolve(args.sequence)
  });
  console.log('✓ 分类：' + args.type);
  console.log('✓ 裁切：' + args.crop);
  console.log('✓ 编号：' + String(result.index).padStart(3, '0'));
  console.log('✓ 已生成：' + result.path);
} catch (error) {
  if (error instanceof ZodError) {
    console.error(error.issues.map((issue) => issue.path.join('.') + ': ' + issue.message).join('\n'));
  } else {
    console.error(error instanceof Error ? error.message : String(error));
  }
  process.exitCode = 1;
}
