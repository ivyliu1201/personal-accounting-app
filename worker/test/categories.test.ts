import test from 'node:test';
import assert from 'node:assert/strict';
import { listCategoryOptions, parseTransactionType } from '../src/categories';
import type { AuthenticatedUser } from '../src/auth';

class FakeSupabaseQuery implements PromiseLike<{ data: unknown[]; error: null }> {
  private type: string | null = null;
  private userId: string | null | undefined;

  constructor(
    private readonly tableName: string,
    private readonly rows: Array<{ name: string; user_id: string | null; type: string }>,
    private readonly usageRows: Array<{ name: string; type: string; user_id: string; count: number }>
  ) {}

  select() {
    return this;
  }

  eq(fieldName: string, value: string) {
    if (fieldName === 'type') {
      this.type = value;
    }
    if (fieldName === 'user_id') {
      this.userId = value;
    }
    return this;
  }

  is(fieldName: string, value: null) {
    if (fieldName === 'user_id') {
      this.userId = value;
    }
    return this;
  }

  order() {
    return this;
  }

  then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    if (this.tableName === 'accounting_transactions') {
      return Promise.resolve({
        data: this.usageRows
          .filter((row) => row.type === this.type && row.user_id === this.userId)
          .flatMap((row) => Array.from({ length: row.count }, () => ({ categories: { name: row.name } }))),
        error: null
      }).then(onfulfilled, onrejected);
    }
    return Promise.resolve({
      data: this.rows
        .filter((row) => row.type === this.type && row.user_id === this.userId)
        .map((row) => ({ name: row.name, user_id: row.user_id }))
        .sort((left, right) => left.name.localeCompare(right.name, 'zh-Hant')),
      error: null
    }).then(onfulfilled, onrejected);
  }
}

class FakeSupabase {
  lastTableName = '';
  tableNames: string[] = [];

  constructor(
    private readonly rows: Array<{ name: string; user_id: string | null; type: string }>,
    private readonly usageRows: Array<{ name: string; type: string; user_id: string; count: number }> = []
  ) {}

  from(tableName: string) {
    this.lastTableName = tableName;
    this.tableNames.push(tableName);
    return new FakeSupabaseQuery(tableName, this.rows, this.usageRows);
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
  const supabase = new FakeSupabase([
    { name: '交通', user_id: null, type: 'EXPENSE' },
    { name: '飲食', user_id: null, type: 'EXPENSE' },
    { name: '家庭', user_id: 'firebase-user-1', type: 'EXPENSE' },
    { name: '隱藏分類', user_id: 'another-user', type: 'EXPENSE' },
    { name: '薪資', user_id: null, type: 'INCOME' }
  ]);

  const categories = await listCategoryOptions(supabase as never, user, 'EXPENSE');

  assert.deepEqual(categories, [
    { name: '交通' },
    { name: '家庭' },
    { name: '飲食' }
  ]);
  assert.deepEqual(supabase.tableNames, ['categories', 'categories', 'accounting_transactions']);
});

test('listCategoryOptions sorts categories by current user usage count first', async () => {
  const supabase = new FakeSupabase([
    { name: '交通', user_id: null, type: 'EXPENSE' },
    { name: '飲食', user_id: null, type: 'EXPENSE' },
    { name: '娛樂', user_id: null, type: 'EXPENSE' },
    { name: '家庭', user_id: 'firebase-user-1', type: 'EXPENSE' }
  ], [
    { name: '家庭', type: 'EXPENSE', user_id: 'firebase-user-1', count: 4 },
    { name: '飲食', type: 'EXPENSE', user_id: 'firebase-user-1', count: 2 },
    { name: '交通', type: 'EXPENSE', user_id: 'firebase-user-1', count: 1 },
    { name: '娛樂', type: 'EXPENSE', user_id: 'another-user', count: 10 }
  ]);

  const categories = await listCategoryOptions(supabase as never, user, 'EXPENSE');

  assert.deepEqual(categories, [
    { name: '家庭' },
    { name: '飲食' },
    { name: '交通' },
    { name: '娛樂' }
  ]);
});
