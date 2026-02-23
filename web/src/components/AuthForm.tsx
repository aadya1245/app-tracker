'use client';

import { FormEvent, useState } from 'react';
import { login, register, User } from '@/lib/api';

interface AuthFormProps {
  onAuthenticated: (token: string, user: User) => void;
}

export function AuthForm({ onAuthenticated }: AuthFormProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result =
        mode === 'login'
          ? await login({ email, password })
          : await register({ name, email, password });
      onAuthenticated(result.token, result.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <h2>{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
      <form onSubmit={onSubmit} className="grid">
        {mode === 'register' && (
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </label>
        {error && <small style={{ color: '#d93025' }}>{error}</small>}
        <div className="actions">
          <button disabled={loading}>{loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Register'}</button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setMode((current) => (current === 'login' ? 'register' : 'login'));
              setError('');
            }}
          >
            Switch to {mode === 'login' ? 'Register' : 'Login'}
          </button>
        </div>
      </form>
    </section>
  );
}
