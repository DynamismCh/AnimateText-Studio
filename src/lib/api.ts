const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

type ApiResponse<T> = { data: T };

async function request<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : typeof payload === 'string' && payload
          ? payload
          : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return { data: payload as T };
}

export const api = {
  post<T = unknown>(path: string, body: unknown) {
    return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
  },
  delete<T = unknown>(path: string) {
    return request<T>(path, { method: 'DELETE' });
  },
};
