export function getScriptMap(rawValue = process.env.VERCEL_SCRIPT_MAP_JSON) {
  if (!rawValue) {
    throw new Error('VERCEL_SCRIPT_MAP_JSON is not defined');
  }

  const scriptMap = JSON.parse(rawValue);
  if (!scriptMap || Array.isArray(scriptMap) || typeof scriptMap !== 'object') {
    throw new Error('VERCEL_SCRIPT_MAP_JSON must contain a JSON object');
  }

  return scriptMap;
}

const GAS_TIMEOUT_MS = 10_000;

export function fetchGas(url, options = {}) {
  return fetch(url, {
    ...options,
    signal: options.signal || AbortSignal.timeout(GAS_TIMEOUT_MS),
  });
}

export function isTimeoutError(error) {
  return error?.name === 'AbortError' || error?.name === 'TimeoutError';
}

export async function readJsonResponse(response) {
  const text = await response.text();
  try {
    return { data: JSON.parse(text), text, valid: true };
  } catch {
    return { data: null, text, valid: false };
  }
}
