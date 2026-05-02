import test from 'node:test';
import assert from 'node:assert/strict';
import { listCategoryOptions, parseTransactionType } from '../src/categories';
import type { AuthenticatedUser } from '../src/auth';

class FakeD1Database {
  readonly rows: Array<{ name: string; user_id: string | null; type: string }>;
  lastBoundValues: unknown[] = [];

  constructor(rows: Array<{ name: string; user_id: string | null; type: string }>) {
    this.rows = rows;
  }

  prepare() {
    return {
      bind: (...values: unknown[]) => {
        this.lastBoundValues = values;
        return {
          all: async () => {
            const [type, userId] = values;
            const names = this.rows
              .filter((row) => row.type === type && (row.user_id === userId || row.user_id === null))
              .map((row) => row.name)
              .sort((left, right) => left.localeCompare(right, 'zh-Hant'));
            return {
              results: Array.from(new Set(names)).map((name) => ({ name }))
            };
          }
        };
      }
    };
  }
}

const user: AuthenticatedUser = {
  userId: 'firebase-user-1',
  email: 'user@example.test'
};

test('parseTransactionType defaults to expense', () => {
  const type = parseTransactionType(new URLSearchParams());

  assert.equal(type, 'EXPENSE');
});

test('parseTransactionType accepts income', () => {
  const type = parseTransactionType(new URLSearchParams({ type: 'INCOME' }));

  assert.equal(type, 'INCOME');
});

test('parseTransactionType rejects invalid type', () => {
  assert.throws(
    () => parseTransactionType(new URLSearchParams({ type: 'INVALID' })),
    (error: unknown) => error instanceof RangeError && error.message === 'Transaction type is invalid'
  );
});

test('listCategoryOptions returns default and current user categories only', async () => {
  const database = new FakeD1Database([
    { name: '交通', user_id: null, type: 'EXPENSE' },
    { name: '飲食', user_id: null, type: 'EXPENSE' },
    { name: '家庭', user_id: 'firebase-user-1', type: 'EXPENSE' },
    { name: '隱藏分類', user_id: 'another-user', type: 'EXPENSE' },
    { name: '薪資', user_id: null, type: 'INCOME' }
  ]);

  const categories = await listCategoryOptions(database as unknown as D1Database, user, 'EXPENSE');

  assert.deepEqual(categories, [
    { name: '交通' },
    { name: '家庭' },
    { name: '飲食' }
  ]);
  assert.deepEqual(database.lastBoundValues, ['EXPENSE', 'firebase-user-1']);
});
