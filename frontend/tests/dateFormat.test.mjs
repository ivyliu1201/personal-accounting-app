import assert from 'node:assert/strict';
import test from 'node:test';

import { formatDateTime } from '../.tmp-test/dateFormat.js';

test('formatDateTime uses the same created-time format across dates', () => {
  assert.equal(formatDateTime('2026-05-01T01:05:00+08:00'), '2026/5/1 01:05');
  assert.equal(formatDateTime('2026-04-30T23:10:00+08:00'), '2026/4/30 23:10');
});
