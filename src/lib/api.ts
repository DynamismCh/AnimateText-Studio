const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

type ApiResponse<T = any> = { data: T };

export function resolveMediaUrl(value?: string): string {
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) return value;
  return API_BASE_URL ? `${API_BASE_URL}${value.startsWith('/') ? value : `/${value}`}` : value;
}

async function request<T = any>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
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
  post<T = any>(path: string, body: unknown) {
    return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
  },
  delete<T = any>(path: string) {
    return request<T>(path, { method: 'DELETE' });
  },
};
