const DEFAULT_LOCAL_API_BASE = 'http://localhost:3000';

function normalizeApiBase(raw: string): string {
  try {
    const u = new URL(raw);
    const isLocal = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    let path = u.pathname || '';
    if (!path || path === '/') {
      if (!isLocal) path = '/shrimp';
    }
    if (path.endsWith('/') && path !== '/') path = path.slice(0, -1);
    u.pathname = path;
    const out = u.toString();
    return out.endsWith('/') ? out.slice(0, -1) : out;
  } catch {
    return raw.replace(/\/$/, '');
  }
}

export const API_BASE_URL = normalizeApiBase(
  import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? DEFAULT_LOCAL_API_BASE,
);
