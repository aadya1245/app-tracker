import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { createTaskSchema, paginationSchema, updateTaskSchema } from '../schemas/task.schema.js';
import { ApiError } from '../middleware/error-handler.js';

export const taskRouter = Router();

taskRouter.use(requireAuth);

taskRouter.get('/', validateQuery(paginationSchema), async (req, res) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const offset = (page - 1) * limit;
  const userId = req.user!.userId;

  const [countResult, tasksResult] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM tasks WHERE user_id = $1', [userId]),
    pool.query(
      `SELECT id, title, description, due_date, completed, created_at, updated_at
       FROM tasks
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    )
  ]);

  const total = countResult.rows[0].count as number;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  res.json({
    data: tasksResult.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  });
});

taskRouter.post('/', validateBody(createTaskSchema), async (req, res) => {
  const { title, description, dueDate } = req.body;
  const userId = req.user!.userId;

  const result = await pool.query(
    `INSERT INTO tasks (user_id, title, description, due_date)
     VALUES ($1, $2, $3, $4)
     RETURNING id, title, description, due_date, completed, created_at, updated_at`,
    [userId, title, description ?? null, dueDate ?? null]
  );

  res.status(201).json(result.rows[0]);
});

taskRouter.patch('/:id', validateBody(updateTaskSchema), async (req, res) => {
  const taskId = Number(req.params.id);
  const userId = req.user!.userId;

  if (!Number.isInteger(taskId) || taskId <= 0) {
    throw new ApiError(400, 'Task ID must be a positive integer');
  }

  const existing = await pool.query('SELECT id FROM tasks WHERE id = $1 AND user_id = $2', [taskId, userId]);
  if (!existing.rowCount) {
    throw new ApiError(404, 'Task not found');
  }

  const payload = req.body as {
    title?: string;
    description?: string;
    dueDate?: string | null;
    completed?: boolean;
  };

  const title = payload.title;
  const description = Object.prototype.hasOwnProperty.call(payload, 'description')
    ? payload.description ?? null
    : undefined;
  const dueDate = Object.prototype.hasOwnProperty.call(payload, 'dueDate')
    ? payload.dueDate ?? null
    : undefined;
  const completed = payload.completed;

  const hasDescription = Object.prototype.hasOwnProperty.call(payload, 'description');
  const hasDueDate = Object.prototype.hasOwnProperty.call(payload, 'dueDate');
  const hasCompleted = Object.prototype.hasOwnProperty.call(payload, 'completed');
  const hasTitle = Object.prototype.hasOwnProperty.call(payload, 'title');

  const result = await pool.query(
    `UPDATE tasks
     SET title = CASE WHEN $7::boolean THEN $1 ELSE title END,
         description = CASE WHEN $8::boolean THEN $2 ELSE description END,
         due_date = CASE WHEN $9::boolean THEN $3 ELSE due_date END,
         completed = CASE WHEN $10::boolean THEN $4 ELSE completed END,
         updated_at = NOW()
     WHERE id = $5 AND user_id = $6
     RETURNING id, title, description, due_date, completed, created_at, updated_at`,
    [title, description, dueDate, completed, taskId, userId, hasTitle, hasDescription, hasDueDate, hasCompleted]
  );

  res.json(result.rows[0]);
});

taskRouter.delete('/:id', async (req, res) => {
  const taskId = Number(req.params.id);
  const userId = req.user!.userId;

  if (!Number.isInteger(taskId) || taskId <= 0) {
    throw new ApiError(400, 'Task ID must be a positive integer');
  }

  const result = await pool.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id', [taskId, userId]);

  if (!result.rowCount) {
    throw new ApiError(404, 'Task not found');
  }

  res.status(204).send();
});
