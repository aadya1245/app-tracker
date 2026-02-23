'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { createTask, deleteTask, fetchTasks, Task, updateTask } from '@/lib/api';

interface TaskManagerProps {
  token: string;
}

export function TaskManager({ token }: TaskManagerProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchTasks(token, page, 5);
      setTasks(result.data);
      setTotalPages(result.pagination.totalPages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load tasks');
    } finally {
      setLoading(false);
    }
  }, [token, page]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  async function onCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    try {
      await createTask(token, {
        title,
        description: description || undefined,
        dueDate: dueDate || undefined
      });
      setTitle('');
      setDescription('');
      setDueDate('');
      await loadTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create task');
    }
  }

  async function toggleTask(task: Task) {
    try {
      await updateTask(token, task.id, { completed: !task.completed });
      await loadTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update task');
    }
  }

  async function removeTask(id: number) {
    try {
      await deleteTask(token, id);
      await loadTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to delete task');
    }
  }

  return (
    <>
      <section className="card">
        <h2>Create task</h2>
        <form onSubmit={onCreateTask} className="grid">
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label>
            Description
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label>
            Due date
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <button>Create Task</button>
        </form>
      </section>

      <section className="card">
        <h2>Your tasks</h2>
        {error && <small style={{ color: '#d93025' }}>{error}</small>}
        {loading ? (
          <p>Loading...</p>
        ) : (
          <ul className="tasks">
            {tasks.map((task) => (
              <li className="task" key={task.id}>
                <h3>{task.title}</h3>
                <p>{task.description || 'No description'}</p>
                <small>
                  Due: {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Not set'} | Status:{' '}
                  {task.completed ? 'Completed' : 'Open'}
                </small>
                <div className="actions" style={{ marginTop: '0.75rem' }}>
                  <button className="secondary" onClick={() => void toggleTask(task)}>
                    {task.completed ? 'Mark Open' : 'Mark Complete'}
                  </button>
                  <button className="danger" onClick={() => void removeTask(task.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
            {!tasks.length && <li className="task">No tasks found.</li>}
          </ul>
        )}
        <div className="actions" style={{ marginTop: '1rem' }}>
          <button className="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </button>
          <small>
            Page {page} of {totalPages}
          </small>
          <button className="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </section>
    </>
  );
}
