import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10)
});

export const createTaskSchema = z.object({
  title: z.string().min(1).max(180),
  description: z.string().max(2000).optional(),
  dueDate: z.string().date().optional()
});

export const updateTaskSchema = z
  .object({
    title: z.string().min(1).max(180).optional(),
    description: z.string().max(2000).optional(),
    dueDate: z.string().date().nullable().optional(),
    completed: z.boolean().optional()
  })
  .refine((body) => Object.keys(body).length > 0, 'At least one field is required');
