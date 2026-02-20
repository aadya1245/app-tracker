const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

type RequestOptions = {
  method?: string;
  token?: string | null;
  body?: unknown;
};

export async function api<T>(
  path: string,
  { method = 'GET', token, body }: RequestOptions = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || 'Request failed');
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
