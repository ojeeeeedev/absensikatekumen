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

export async function readJsonResponse(response) {
  const text = await response.text();
  try {
    return { data: JSON.parse(text), text, valid: true };
  } catch {
    return { data: null, text, valid: false };
  }
}
