import { z } from 'zod';

export const categorySchema = z.string().trim().min(1, '分类不能为空').max(20, '分类最多 20 个字符')
  .regex(/^[^\u0000-\u001f\u007f]+$/u, '分类不能包含换行或控制字符');
export const cropSchema = z.object({
  mode: z.enum(['contain', 'cover']).default('contain'),
  x: z.number().min(0).max(1).default(0.5),
  y: z.number().min(0).max(1).default(0.5)
}).default({ mode: 'contain', x: 0.5, y: 0.5 });

export const coverOptionsSchema = z.object({
  title: z.string().trim().min(1, '标题不能为空').max(80, '标题过长'),
  subtitle: z.string().trim().max(80, '副标题过长').optional()
    .transform((value) => value || undefined),
  type: categorySchema,
  index: z.number().int().min(1).max(999999),
  crop: cropSchema
});

export type Category = z.infer<typeof categorySchema>;
export type CoverOptions = z.infer<typeof coverOptionsSchema>;
export type CropOptions = z.infer<typeof cropSchema>;
