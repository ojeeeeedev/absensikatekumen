import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';

const source = await readFile(new URL('../public/session.js', import.meta.url), 'utf8');

function loadSession() {
  const storage = () => {
    const values = new Map();
    return {
      getItem: key => values.get(key) || null,
      removeItem: key => values.delete(key),
      setItem: (key, value) => values.set(key, String(value)),
    };
  };
  const context = {
    atob,
    Date,
    Number,
    JSON,
    Math,
    document: { readyState: 'complete', cookie: '', addEventListener() {} },
    localStorage: storage(),
    sessionStorage: storage(),
    window: { addEventListener() {} },
  };
  vm.runInNewContext(source, context);
  return context.window;
}

describe('session expiry', () => {
  it('rejects expired and malformed tokens', () => {
    const session = loadSession();
    expect(session.isSessionTokenExpired(jwt.sign({}, 'test', { expiresIn: -1 }))).toBe(true);
    expect(session.isSessionTokenExpired('not-a-jwt')).toBe(true);
  });

  it('accepts a current token', () => {
    const session = loadSession();
    expect(session.isSessionTokenExpired(jwt.sign({}, 'test', { expiresIn: '1h' }))).toBe(false);
  });
});
