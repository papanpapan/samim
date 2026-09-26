import axios from 'axios';

const TOKEN_KEY = 'sn_erms_token';

export const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// JWT interceptor: attach bearer token from local storage.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const nurseryId = localStorage.getItem('sn-nursery');
  if (nurseryId) {
    config.headers['X-Nursery-Id'] = nurseryId;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  },
);

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('sn-nursery');
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function detailText(details: unknown): string {
  if (!details || typeof details !== 'object') return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
    if (Array.isArray(value) && value.length > 0) parts.push(`${key}: ${value.join(', ')}`);
    else if (value && typeof value === 'object') {
      const nested = detailText(value);
      if (nested) parts.push(nested);
    }
  }
  return parts.join(' ');
}

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; details?: unknown } | undefined;
    const message = data?.message ?? err.message;
    const extra = detailText(data?.details);
    return extra ? `${message}. ${extra}` : message;
  }
  return err instanceof Error ? err.message : 'Unexpected error';
}
