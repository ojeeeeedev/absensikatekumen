import { describe, expect, it } from 'vitest';
import { getScriptMap, readJsonResponse } from '../api/_gas-utils.js';

describe('GAS utilities', () => {
  it('accepts an object map and rejects missing or non-object configuration', () => {
    expect(getScriptMap('{"SAB":"https://example.test/exec"}')).toEqual({
      SAB: 'https://example.test/exec',
    });
    expect(() => getScriptMap('')).toThrow(/not defined/);
    expect(() => getScriptMap('[]')).toThrow(/JSON object/);
  });

  it('returns the original text when a response is not JSON', async () => {
    const valid = await readJsonResponse(new Response('{"status":"ok"}'));
    const invalid = await readJsonResponse(new Response('<html>error</html>'));

    expect(valid).toEqual({ data: { status: 'ok' }, text: '{"status":"ok"}', valid: true });
    expect(invalid).toEqual({ data: null, text: '<html>error</html>', valid: false });
  });
});
