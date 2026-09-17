'use client';

import { useMemo, useState } from 'react';
import { AuthForm } from '@/components/AuthForm';
import { AgentPanel } from '@/components/AgentPanel';
import { TaskManager } from '@/components/TaskManager';
import type { User } from '@/lib/api';

export default function HomePage() {
  const [backlogVersion, setBacklogVersion] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const isAuthenticated = useMemo(() => Boolean(token && user), [token, user]);

  return (
    <main>
      <section className="card">
        <span className="eyebrow">YOUR SOFTWARE WORKSPACE</span><h1>SprintPilot</h1>
        <p className="muted">Turn the next thing you want to build into a plan you can finish.</p>
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
          <AgentPanel token={token!} onApproved={() => setBacklogVersion(v => v + 1)} />
          <TaskManager key={backlogVersion} token={token!} />
        </>
      )}
    </main>
  );
}
