'use client';

import { useMemo, useState } from 'react';
import { AuthForm } from '@/components/AuthForm';
import { TaskManager } from '@/components/TaskManager';
import type { User } from '@/lib/api';

export default function HomePage() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const isAuthenticated = useMemo(() => Boolean(token && user), [token, user]);

  return (
    <main>
      <section className="card">
        <h1>Task Manager</h1>
        <small>Production-quality full-stack app using Next.js, Express, PostgreSQL, and JWT auth.</small>
      </section>

      {!isAuthenticated ? (
        <AuthForm
          onAuthenticated={(nextToken, nextUser) => {
            setToken(nextToken);
            setUser(nextUser);
          }}
        />
      ) : (
        <>
          <section className="card">
            <h2>Welcome, {user?.name}</h2>
            <div className="actions">
              <button
                className="secondary"
                onClick={() => {
                  setToken(null);
                  setUser(null);
                }}
              >
                Logout
              </button>
            </div>
          </section>
          <TaskManager token={token!} />
        </>
      )}
    </main>
  );
}
