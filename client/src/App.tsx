import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from './lib/api';

type Status = 'applied' | 'oa' | 'interview' | 'offer' | 'rejected';

type AppRecord = {
  id: number;
  company: string;
  role: string;
  status: Status;
  location: string;
  referral: number;
  source: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

type Stats = {
  byStatus: Record<Status, number>;
  total: number;
};

const statuses: Status[] = ['applied', 'oa', 'interview', 'offer', 'rejected'];

export function App() {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('token')
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');

  const [items, setItems] = useState<AppRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [location, setLocation] = useState('');
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');
  const [referral, setReferral] = useState(false);

  const grouped = useMemo(() => {
    return statuses.reduce<Record<Status, AppRecord[]>>((acc, status) => {
      acc[status] = items.filter((item) => item.status === status);
      return acc;
    }, {} as Record<Status, AppRecord[]>);
  }, [items]);

  async function refresh(currentToken = token) {
    if (!currentToken) return;
    const [appsRes, statsRes] = await Promise.all([
      api<{ applications: AppRecord[] }>('/applications', { token: currentToken }),
      api<Stats>('/stats', { token: currentToken })
    ]);

    setItems(appsRes.applications);
    setStats(statsRes);
  }

  useEffect(() => {
    if (!token) return;
    refresh().catch((err: Error) => {
      setError(err.message);
      setToken(null);
      localStorage.removeItem('token');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleAuth(e: FormEvent) {
    e.preventDefault();
    setError('');

    try {
      const endpoint = authMode === 'register' ? '/auth/register' : '/auth/login';
      const res = await api<{ token: string }>(endpoint, {
        method: 'POST',
        body: { email, password }
      });
      localStorage.setItem('token', res.token);
      setToken(res.token);
      setEmail('');
      setPassword('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;

    setLoading(true);
    setError('');

    try {
      await api('/applications', {
        method: 'POST',
        token,
        body: { company, role, location, source, notes, referral, status: 'applied' }
      });

      setCompany('');
      setRole('');
      setLocation('');
      setSource('');
      setNotes('');
      setReferral(false);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function move(item: AppRecord, status: Status) {
    if (!token || item.status === status) return;
    try {
      await api(`/applications/${item.id}`, {
        method: 'PATCH',
        token,
        body: { status }
      });
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(id: number) {
    if (!token) return;
    try {
      await api(`/applications/${id}`, { method: 'DELETE', token });
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!token) {
    return (
      <div className="auth-wrap">
        <h1>Intern Application Tracker</h1>
        <p>Portfolio-grade project: auth, API, database, analytics, and dashboard UX.</p>
        <form className="card" onSubmit={handleAuth}>
          <div className="row">
            <button
              type="button"
              className={authMode === 'register' ? 'active' : ''}
              onClick={() => setAuthMode('register')}
            >
              Register
            </button>
            <button
              type="button"
              className={authMode === 'login' ? 'active' : ''}
              onClick={() => setAuthMode('login')}
            >
              Login
            </button>
          </div>
          <input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            placeholder="Password (8+ chars)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit">{authMode === 'register' ? 'Create account' : 'Sign in'}</button>
          {error && <p className="error">{error}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="app-wrap">
      <header>
        <h1>Intern Application Tracker</h1>
        <button
          onClick={() => {
            setToken(null);
            localStorage.removeItem('token');
          }}
        >
          Logout
        </button>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="card">
        <h2>Add application</h2>
        <form className="grid" onSubmit={handleCreate}>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Company"
            required
          />
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Role"
            required
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location"
          />
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Source (LinkedIn, referral...)"
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
          />
          <label className="checkbox">
            <input
              type="checkbox"
              checked={referral}
              onChange={(e) => setReferral(e.target.checked)}
            />
            Referral
          </label>
          <button disabled={loading} type="submit">
            {loading ? 'Saving...' : 'Add'}
          </button>
        </form>
      </section>

      <section className="card stats">
        <h2>Pipeline snapshot</h2>
        <div className="stats-grid">
          {statuses.map((status) => (
            <div key={status}>
              <h3>{status.toUpperCase()}</h3>
              <p>{stats?.byStatus?.[status] ?? 0}</p>
            </div>
          ))}
          <div>
            <h3>TOTAL</h3>
            <p>{stats?.total ?? 0}</p>
          </div>
        </div>
      </section>

      <section className="board">
        {statuses.map((status) => (
          <div className="column" key={status}>
            <h3>{status.toUpperCase()}</h3>
            {grouped[status]?.map((item) => (
              <article className="ticket" key={item.id}>
                <strong>{item.company}</strong>
                <p>{item.role}</p>
                <small>{item.location || 'Location TBD'}</small>
                <div className="actions">
                  <select
                    value={item.status}
                    onChange={(e) => move(item, e.target.value as Status)}
                  >
                    {statuses.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => remove(item.id)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
