import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from './app.js';
import { db } from './db.js';

describe('API', () => {
  beforeEach(() => {
    db.exec('DELETE FROM applications; DELETE FROM users;');
  });

  it('registers and logs in a user', async () => {
    const register = await request(app).post('/auth/register').send({
      email: 'test@example.com',
      password: 'password123'
    });

    expect(register.status).toBe(201);
    expect(register.body.token).toBeTypeOf('string');

    const login = await request(app).post('/auth/login').send({
      email: 'test@example.com',
      password: 'password123'
    });

    expect(login.status).toBe(200);
    expect(login.body.token).toBeTypeOf('string');
  });

  it('creates an application and returns stats', async () => {
    const register = await request(app).post('/auth/register').send({
      email: 'pipeline@example.com',
      password: 'password123'
    });

    const token = register.body.token as string;

    const create = await request(app)
      .post('/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({ company: 'Stripe', role: 'SWE Intern', status: 'applied' });

    expect(create.status).toBe(201);
    expect(create.body.application.company).toBe('Stripe');

    const stats = await request(app)
      .get('/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(stats.status).toBe(200);
    expect(stats.body.total).toBe(1);
    expect(stats.body.byStatus.applied).toBe(1);
  });

  it('rejects protected route access without token', async () => {
    const response = await request(app).get('/applications');
    expect(response.status).toBe(401);
  });
});
