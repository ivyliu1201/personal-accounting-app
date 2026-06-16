import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfiguredApiBaseUrl } from '../.tmp-test/apiConfig.js';

test('resolveConfiguredApiBaseUrl ignores production API URL in dev mode', () => {
  const apiBaseUrl = resolveConfiguredApiBaseUrl('https://deployed-api.example.test', false);

  assert.equal(apiBaseUrl, '');
});

test('resolveConfiguredApiBaseUrl keeps normalized production API URL in production mode', () => {
  const apiBaseUrl = resolveConfiguredApiBaseUrl('https://deployed-api.example.test/', true);

  assert.equal(apiBaseUrl, 'https://deployed-api.example.test');
});
