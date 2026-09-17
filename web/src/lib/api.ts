const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  token?: string;
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(data.message ?? 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function register(payload: { name: string; email: string; password: string }) {
  return request<{ token: string; user: User }>('/auth/register', {
    method: 'POST',
    body: payload
  });
}

export function login(payload: { email: string; password: string }) {
  return request<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: payload
  });
}

export function fetchTasks(token: string, page: number, limit = 5) {
  return request<{
    data: Task[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }>(`/tasks?page=${page}&limit=${limit}`, { token });
}

export function createTask(token: string, payload: { title: string; description?: string; dueDate?: string }) {
  return request<Task>('/tasks', {
    method: 'POST',
    token,
    body: payload
  });
}

export function updateTask(token: string, id: number, payload: Partial<{ title: string; description: string; dueDate: string | null; completed: boolean }>) {
  return request<Task>(`/tasks/${id}`, {
    method: 'PATCH',
    token,
    body: payload
  });
}

export function deleteTask(token: string, id: number) {
  return request<void>(`/tasks/${id}`, {
    method: 'DELETE',
    token
  });
}

export interface AgentRun {
  id: string;
  goal: string;
  mode: 'demo' | 'live';
  status: 'running' | 'pending_review' | 'approved' | 'rejected' | 'failed';
  proposal: { summary: string; assumptions: string[]; tasks: { title: string; description: string; acceptanceCriteria: string[]; dependsOn: number[]; relatedTaskIds: number[] }[] } | null;
  trace: { step: number; tool: string; detail: string; durationMs: number }[];
  evidence: { id: number; title: string; description: string | null; completed: boolean }[];
  input_tokens: number;
  output_tokens: number;
  error: string | null;
  task_ids: number[];
  selected_indices: number[];
  created_at: string;
}
export function agentConfig(token: string) { return request<{ liveAvailable: boolean }>('/agent/config', { token }); }
export function fetchAgentRuns(token: string) { return request<{ data: AgentRun[] }>('/agent/runs', { token }); }
export function startAgentRun(token: string, body: { goal: string; mode: 'demo' | 'live'; requestId: string }) {
  return request<AgentRun>('/agent/runs', { token, method: 'POST', body });
}
export function decideAgentRun(token: string, id: string, action: 'approve' | 'reject', selectedIndices: number[]) {
  return request<AgentRun>(`/agent/runs/${id}/decision`, { token, method: 'POST', body: { action, selectedIndices } });
}
