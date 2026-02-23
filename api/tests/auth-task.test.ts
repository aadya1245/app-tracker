import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('../src/db.js', () => ({
  pool: {
    query: queryMock
  }
}));

describe('API auth and task routes', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('registers a user and returns token', async () => {
    const { app } = await import('../src/app.js');

    queryMock
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Ada', email: 'ada@example.com', created_at: new Date().toISOString() }]
      });

    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'password123'
    });

    expect(response.status).toBe(201);
    expect(response.body.token).toBeTypeOf('string');
    expect(response.body.user.email).toBe('ada@example.com');
  });

  it('returns validation errors for bad registration payload', async () => {
    const { app } = await import('../src/app.js');

    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'A',
      email: 'bad-email',
      password: 'short'
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Validation failed');
  });

  it('returns paginated tasks for authenticated users', async () => {
    const { app } = await import('../src/app.js');
    const { signToken } = await import('../src/utils/jwt.js');

    queryMock
      .mockResolvedValueOnce({ rows: [{ count: 7 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            title: 'Task A',
            description: null,
            due_date: null,
            completed: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]
      });

    const token = signToken({ userId: 1, email: 'ada@example.com' });

    const response = await request(app)
      .get('/api/v1/tasks?page=1&limit=5')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.pagination.page).toBe(1);
    expect(response.body.pagination.limit).toBe(5);
    expect(response.body.pagination.total).toBe(7);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('returns 401 when auth header is missing', async () => {
    const { app } = await import('../src/app.js');

    const response = await request(app).get('/api/v1/tasks');

    expect(response.status).toBe(401);
  });
});
