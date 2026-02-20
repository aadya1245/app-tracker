import bcrypt from 'bcryptjs';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { requireAuth, signToken } from './auth.js';
import { db } from './db.js';
import type { ApplicationStatus, AuthRequest } from './types.js';

dotenv.config();

export const app = express();

app.use(cors());
app.use(express.json());

const statuses: ApplicationStatus[] = [
  'applied',
  'oa',
  'interview',
  'offer',
  'rejected'
];

function parseStatus(value: unknown): ApplicationStatus | null {
  if (typeof value !== 'string') return null;
  return statuses.includes(value as ApplicationStatus)
    ? (value as ApplicationStatus)
    : null;
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/auth/register', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const result = db
      .prepare(
        `INSERT INTO users (email, password_hash, created_at)
         VALUES (?, ?, ?)`
      )
      .run(normalizedEmail, passwordHash, new Date().toISOString());

    const token = signToken(Number(result.lastInsertRowid));
    res.status(201).json({ token });
  } catch {
    res.status(409).json({ error: 'Email already exists' });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const user = db
    .prepare('SELECT id, password_hash FROM users WHERE email = ?')
    .get(email.trim().toLowerCase()) as
    | { id: number; password_hash: string }
    | undefined;

  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = signToken(user.id);
  res.json({ token });
});

app.get('/applications', requireAuth, (req, res) => {
  const userId = (req as AuthRequest).user!.id;
  const rows = db
    .prepare(
      `SELECT id, company, role, status, location, referral, source, notes, created_at, updated_at
       FROM applications
       WHERE user_id = ?
       ORDER BY datetime(updated_at) DESC`
    )
    .all(userId);

  res.json({ applications: rows });
});

app.post('/applications', requireAuth, (req, res) => {
  const userId = (req as AuthRequest).user!.id;
  const {
    company,
    role,
    status = 'applied',
    location = '',
    referral = false,
    source = '',
    notes = ''
  } = req.body ?? {};

  if (typeof company !== 'string' || !company.trim()) {
    res.status(400).json({ error: 'Company is required' });
    return;
  }

  if (typeof role !== 'string' || !role.trim()) {
    res.status(400).json({ error: 'Role is required' });
    return;
  }

  const parsedStatus = parseStatus(status);
  if (!parsedStatus) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const now = new Date().toISOString();

  const result = db
    .prepare(
      `INSERT INTO applications (user_id, company, role, status, location, referral, source, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId,
      company.trim(),
      role.trim(),
      parsedStatus,
      typeof location === 'string' ? location.trim() : '',
      referral ? 1 : 0,
      typeof source === 'string' ? source.trim() : '',
      typeof notes === 'string' ? notes.trim() : '',
      now,
      now
    );

  const created = db
    .prepare(
      `SELECT id, company, role, status, location, referral, source, notes, created_at, updated_at
       FROM applications WHERE id = ?`
    )
    .get(Number(result.lastInsertRowid));

  res.status(201).json({ application: created });
});

app.patch('/applications/:id', requireAuth, (req, res) => {
  const userId = (req as AuthRequest).user!.id;
  const appId = Number(req.params.id);

  if (!Number.isInteger(appId)) {
    res.status(400).json({ error: 'Invalid application id' });
    return;
  }

  const existing = db
    .prepare('SELECT * FROM applications WHERE id = ? AND user_id = ?')
    .get(appId, userId) as Record<string, unknown> | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  const nextStatus =
    req.body?.status !== undefined
      ? parseStatus(req.body.status)
      : (existing.status as ApplicationStatus);

  if (!nextStatus) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const company =
    typeof req.body?.company === 'string'
      ? req.body.company.trim()
      : String(existing.company ?? '');
  const role =
    typeof req.body?.role === 'string'
      ? req.body.role.trim()
      : String(existing.role ?? '');

  if (!company || !role) {
    res.status(400).json({ error: 'Company and role are required' });
    return;
  }

  db.prepare(
    `UPDATE applications
     SET company = ?, role = ?, status = ?, location = ?, referral = ?, source = ?, notes = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`
  ).run(
    company,
    role,
    nextStatus,
    typeof req.body?.location === 'string'
      ? req.body.location.trim()
      : String(existing.location ?? ''),
    req.body?.referral !== undefined
      ? req.body.referral
        ? 1
        : 0
      : Number(existing.referral ?? 0),
    typeof req.body?.source === 'string'
      ? req.body.source.trim()
      : String(existing.source ?? ''),
    typeof req.body?.notes === 'string'
      ? req.body.notes.trim()
      : String(existing.notes ?? ''),
    new Date().toISOString(),
    appId,
    userId
  );

  const updated = db
    .prepare(
      `SELECT id, company, role, status, location, referral, source, notes, created_at, updated_at
       FROM applications WHERE id = ?`
    )
    .get(appId);

  res.json({ application: updated });
});

app.delete('/applications/:id', requireAuth, (req, res) => {
  const userId = (req as AuthRequest).user!.id;
  const appId = Number(req.params.id);

  if (!Number.isInteger(appId)) {
    res.status(400).json({ error: 'Invalid application id' });
    return;
  }

  const result = db
    .prepare('DELETE FROM applications WHERE id = ? AND user_id = ?')
    .run(appId, userId);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  res.status(204).send();
});

app.get('/stats', requireAuth, (req, res) => {
  const userId = (req as AuthRequest).user!.id;
  const rows = db
    .prepare(
      `SELECT status, COUNT(*) as count
       FROM applications
       WHERE user_id = ?
       GROUP BY status`
    )
    .all(userId) as Array<{ status: ApplicationStatus; count: number }>;

  const byStatus = statuses.reduce<Record<ApplicationStatus, number>>((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {} as Record<ApplicationStatus, number>);

  rows.forEach((row) => {
    byStatus[row.status] = row.count;
  });

  res.json({ byStatus, total: Object.values(byStatus).reduce((a, b) => a + b, 0) });
});
