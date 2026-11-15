// Thin fetch wrapper: adds the session token + UI language and normalises errors.
import { getLang, t } from './i18n.js';

const TOKEN_KEY = 'cc-token';
let token = null;
let onExpired = () => {};

/** Run `fn` against localStorage; returns null when storage is blocked (private mode). */
function storage(fn) {
  try {
    return fn(window.localStorage);
  } catch {
    return null;
  }
}

export const session = {
  load() {
    token = storage((s) => s.getItem(TOKEN_KEY));
    return token;
  },
  set(value) {
    token = value;
    storage((s) => (value ? s.setItem(TOKEN_KEY, value) : s.removeItem(TOKEN_KEY)));
  },
  get: () => token,
  onExpired(fn) {
    onExpired = fn;
  },
};

/**
 * Call the CareCircle API. Sends the session token and UI language, and throws an Error whose
 * message is already localized (with `status` and `code`) for any non-2xx response.
 * @param {string} path
 * @param {{ method?: string, body?: object, raw?: Blob, contentType?: string }} [options]
 *   `raw` + `contentType` send a binary body (used for voice audio).
 */
export async function api(path, { method = 'GET', body, raw, contentType } = {}) {
  const headers = { 'x-lang': getLang() };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (raw) {
    headers['Content-Type'] = contentType;
  }
  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: raw || (body !== undefined ? JSON.stringify(body) : undefined),
      credentials: 'same-origin',
    });
  } catch {
    throw new Error(t('offline'));
  }
  if (res.status === 204) {
    return null;
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    onExpired();
  }
  if (!res.ok) {
    const err = new Error(data.error || t('genericError'));
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}
