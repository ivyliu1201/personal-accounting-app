import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBatchTransactions,
  deleteTransaction,
  listAnnualCashFlowTrend,
  listCategorySummaries,
  listHistoryTrend,
  listHistoryTransactions,
  listRecentTransactions,
  parseHistoryPage,
  parseHistorySize,
  parseOptionalDate,
  parseRecentLimit,
  parseRequiredDate,
  parseTrendYear,
  resolveSummaryDateRange,
  TransactionNotFoundError,
  updateTransaction,
  validateBatchCreateRequest
} from '../src/transactions';
import type { AuthenticatedUser } from '../src/auth';
import type { SupabaseClient } from '@supabase/supabase-js';

interface FakeCategoryRow {
  id: string;
  user_id: string | null;
  type: string;
  name: string;
  default_category: number;
  created_at: string;
}

interface FakeTransactionRow {
  id: string;
  user_id: string;
  type: string;
  transaction_date: string;
  amount: number;
  category_id: string;
  note: string | null;
  created_at: string;
}

interface FakeSupabaseTransactionRow extends FakeTransactionRow {
  categories: {
    name: string;
  };
}

class FakeSupabaseDatabase {
  readonly categories: FakeCategoryRow[];
  transactions: FakeTransactionRow[] = [];
  readonly aiFeedbackRows: unknown[] = [];

  constructor(categories: FakeCategoryRow[]) {
    this.categories = categories;
  }

  from(tableName: string) {
    return new FakeSupabaseQuery(this, tableName);
  }

  getCategory(id: string) {
    const category = this.categories.find((candidate) => candidate.id === id);
    if (!category) {
      throw new Error('Category not found');
    }
    return category;
  }
}

class FakeSupabaseQuery {
  private readonly database: FakeSupabaseDatabase;
  private readonly tableName: string;
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private readonly filters: Array<{ fieldName: string; operator: 'eq' | 'gte' | 'lte' | 'is'; value: unknown }> = [];
  private readonly orders: Array<{ fieldName: string; ascending: boolean }> = [];
  private from = 0;
  private to: number | null = null;
  private insertPayload: unknown;
  private updatePayload: Record<string, unknown> = {};
  private single = false;

  constructor(database: FakeSupabaseDatabase, tableName: string) {
    this.database = database;
    this.tableName = tableName;
  }

  select() {
    this.operation = 'select';
    return this;
  }

  insert(payload: unknown) {
    this.operation = 'insert';
    this.insertPayload = payload;
    return this;
  }

  update(payload: Record<string, unknown>) {
    this.operation = 'update';
    this.updatePayload = payload;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(fieldName: string, value: unknown) {
    this.filters.push({ fieldName, operator: 'eq', value });
    return this;
  }

  gte(fieldName: string, value: unknown) {
    this.filters.push({ fieldName, operator: 'gte', value });
    return this;
  }

  lte(fieldName: string, value: unknown) {
    this.filters.push({ fieldName, operator: 'lte', value });
    return this;
  }

  is(fieldName: string, value: unknown) {
    this.filters.push({ fieldName, operator: 'is', value });
    return this;
  }

  order(fieldName: string, options: { ascending: boolean }) {
    this.orders.push({ fieldName, ascending: options.ascending });
    return this;
  }

  range(from: number, to: number) {
    this.from = from;
    this.to = to;
    return this;
  }

  maybeSingle() {
    this.single = true;
    return this;
  }

  then<TResult>(
    resolve: (value: { data: unknown; error: null }) => TResult,
    reject?: (reason: unknown) => TResult
  ) {
    try {
      return Promise.resolve(resolve({ data: this.execute(), error: null }));
    } catch (error) {
      if (reject) {
        return Promise.resolve(reject(error));
      }
      return Promise.reject(error);
    }
  }

  private execute() {
    if (this.operation === 'insert') {
      return this.executeInsert();
    }
    if (this.operation === 'update') {
      this.executeUpdate();
      return null;
    }
    if (this.operation === 'delete') {
      this.executeDelete();
      return null;
    }
    return this.executeSelect();
  }

  private executeSelect() {
    if (this.tableName === 'categories') {
      const rows = this.filterRows(this.database.categories);
      const data = rows.map((row) => ({ id: row.id }));
      return this.single ? data[0] ?? null : data;
    }
    if (this.tableName === 'accounting_transactions') {
      let rows = this.filterRows(this.database.transactions)
        .map((row) => this.buildTransactionRow(row));
      rows = this.sortRows(rows);
      if (this.to !== null) {
        rows = rows.slice(this.from, this.to + 1);
      }
      return this.single ? rows[0] ?? null : rows;
    }
    if (this.tableName === 'ai_quick_add_feedback') {
      return this.single ? null : [];
    }
    throw new Error(`Unsupported table: ${this.tableName}`);
  }

  private executeInsert() {
    if (this.tableName === 'categories') {
      this.database.categories.push(this.insertPayload as FakeCategoryRow);
      return null;
    }
    if (this.tableName === 'accounting_transactions') {
      this.database.transactions.push(this.insertPayload as FakeTransactionRow);
      return null;
    }
    if (this.tableName === 'ai_quick_add_feedback') {
      this.database.aiFeedbackRows.push(this.insertPayload);
      return null;
    }
    throw new Error(`Unsupported table: ${this.tableName}`);
  }

  private executeUpdate() {
    if (this.tableName !== 'accounting_transactions') {
      throw new Error(`Unsupported update table: ${this.tableName}`);
    }
    for (const row of this.filterRows(this.database.transactions)) {
      Object.assign(row, this.updatePayload);
    }
  }

  private executeDelete() {
    if (this.tableName !== 'accounting_transactions') {
      throw new Error(`Unsupported delete table: ${this.tableName}`);
    }
    const rowsToDelete = new Set(this.filterRows(this.database.transactions));
    this.database.transactions = this.database.transactions.filter((row) => !rowsToDelete.has(row));
  }

  private filterRows<T extends Record<string, unknown>>(rows: T[]): T[] {
    return rows.filter((row) => this.filters.every((filter) => {
      const value = row[filter.fieldName];
      if (filter.operator === 'eq') {
        return value === filter.value;
      }
      if (filter.operator === 'gte') {
        return String(value) >= String(filter.value);
      }
      if (filter.operator === 'lte') {
        return String(value) <= String(filter.value);
      }
      return value === filter.value;
    }));
  }

  private sortRows<T extends Record<string, unknown>>(rows: T[]): T[] {
    if (this.orders.length === 0) {
      return rows;
    }
    return [...rows].sort((left, right) => {
      for (const order of this.orders) {
        const result = String(left[order.fieldName]).localeCompare(String(right[order.fieldName]));
        if (result !== 0) {
          return order.ascending ? result : -result;
        }
      }
      return 0;
    });
  }

  private buildTransactionRow(row: FakeTransactionRow): FakeSupabaseTransactionRow {
    return {
      ...row,
      categories: {
        name: this.database.getCategory(row.category_id).name
      }
    };
  }
}

const user: AuthenticatedUser = {
  userId: 'firebase-user-1',
  email: 'user@example.test'
};

const fixedNow = new Date('2026-05-02T08:00:00.000Z');

test('validateBatchCreateRequest rejects empty batch', () => {
  assert.throws(
    () => validateBatchCreateRequest({ transactions: [] }, fixedNow),
    (error: unknown) => error instanceof RangeError && error.message === 'Transactions are required'
  );
});

test('validateBatchCreateRequest accepts future date', () => {
  const transactions = validateBatchCreateRequest({
    transactions: [{
      type: 'EXPENSE',
      transactionDate: '2026-05-03',
      amount: 100,
      categoryName: '飲食'
    }]
  }, fixedNow);

  assert.equal(transactions[0].transactionDate, '2026-05-03');
});

test('validateBatchCreateRequest preserves valid date value', () => {
  const transactions = validateBatchCreateRequest({
    transactions: [{
      type: 'EXPENSE',
      transactionDate: '2026-05-05',
      amount: 100,
      categoryName: '飲食'
    }]
  }, fixedNow);

  assert.equal(transactions[0].transactionDate, '2026-05-05');
});

test('validateBatchCreateRequest normalizes fields', () => {
  const transactions = validateBatchCreateRequest({
    transactions: [{
      type: 'EXPENSE',
      transactionDate: '2026-05-02',
      amount: '120.5',
      categoryName: ' 飲食 ',
      note: ' 午餐 '
    }]
  }, fixedNow);

  assert.deepEqual(transactions, [{
    type: 'EXPENSE',
    transactionDate: '2026-05-02',
    amount: 120.5,
    categoryName: '飲食',
    note: '午餐'
  }]);
});

test('parseRecentLimit defaults and caps recent limit', () => {
  assert.equal(parseRecentLimit(new URLSearchParams()), 5);
  assert.equal(parseRecentLimit(new URLSearchParams({ limit: '0' })), 5);
  assert.equal(parseRecentLimit(new URLSearchParams({ limit: '10' })), 10);
  assert.equal(parseRecentLimit(new URLSearchParams({ limit: '100' })), 15);
});

test('parseRecentLimit rejects non integer limit', () => {
  assert.throws(
    () => parseRecentLimit(new URLSearchParams({ limit: 'abc' })),
    (error: unknown) => error instanceof RangeError && error.message === 'Recent limit is invalid'
  );
});

test('parseRequiredDate rejects missing or invalid date', () => {
  assert.throws(
    () => parseRequiredDate(new URLSearchParams(), 'startDate'),
    (error: unknown) => error instanceof RangeError && error.message === 'startDate is required'
  );
  assert.throws(
    () => parseRequiredDate(new URLSearchParams({ startDate: '2026-02-30' }), 'startDate'),
    (error: unknown) => error instanceof RangeError && error.message === 'startDate is invalid'
  );
});

test('parseHistoryPage defaults negative page and rejects non integer page', () => {
  assert.equal(parseHistoryPage(new URLSearchParams()), 0);
  assert.equal(parseHistoryPage(new URLSearchParams({ page: '-1' })), 0);
  assert.equal(parseHistoryPage(new URLSearchParams({ page: '2' })), 2);
  assert.throws(
    () => parseHistoryPage(new URLSearchParams({ page: '1.5' })),
    (error: unknown) => error instanceof RangeError && error.message === 'History page is invalid'
  );
});

test('parseHistorySize defaults and caps size', () => {
  assert.equal(parseHistorySize(new URLSearchParams()), 10);
  assert.equal(parseHistorySize(new URLSearchParams({ size: '0' })), 10);
  assert.equal(parseHistorySize(new URLSearchParams({ size: '15' })), 15);
  assert.equal(parseHistorySize(new URLSearchParams({ size: '100' })), 20);
});

test('summary date and trend year parsers normalize optional params', () => {
  assert.equal(parseOptionalDate(new URLSearchParams(), 'startDate'), undefined);
  assert.equal(parseOptionalDate(new URLSearchParams({ startDate: '2026-04-01' }), 'startDate'), '2026-04-01');
  assert.deepEqual(resolveSummaryDateRange(undefined, undefined, fixedNow), {
    startDate: '2026-05-01',
    endDate: '2026-05-02'
  });
  assert.deepEqual(resolveSummaryDateRange('2026-04-01', '2026-04-30', fixedNow), {
    startDate: '2026-04-01',
    endDate: '2026-04-30'
  });
  assert.equal(parseTrendYear(new URLSearchParams(), fixedNow), 2026);
  assert.equal(parseTrendYear(new URLSearchParams({ year: '2025' }), fixedNow), 2025);
});

test('resolveSummaryDateRange uses Asia Taipei date for default month range', () => {
  assert.deepEqual(resolveSummaryDateRange(
    undefined,
    undefined,
    new Date('2026-05-04T16:30:00.000Z')
  ), {
    startDate: '2026-05-01',
    endDate: '2026-05-05'
  });
});

test('createBatchTransactions uses existing default category and authenticated user id', async () => {
  const database = new FakeSupabaseDatabase([{
    id: 'default-food',
    user_id: null,
    type: 'EXPENSE',
    name: '飲食',
    default_category: 1,
    created_at: fixedNow.toISOString()
  }]);

  const response = await createBatchTransactions(database as unknown as SupabaseClient, user, {
    userId: 'attacker-user',
    transactions: [{
      type: 'EXPENSE',
      transactionDate: '2026-05-02',
      amount: 120,
      categoryName: '飲食',
      note: ''
    }]
  }, fixedNow);

  assert.equal(database.transactions.length, 1);
  assert.equal(database.transactions[0].user_id, 'firebase-user-1');
  assert.equal(database.transactions[0].category_id, 'default-food');
  assert.equal(database.transactions[0].note, null);
  assert.equal(response.transactions[0].categoryName, '飲食');
});

test('createBatchTransactions creates custom category for current user', async () => {
  const database = new FakeSupabaseDatabase([]);

  await createBatchTransactions(database as unknown as SupabaseClient, user, {
    transactions: [{
      type: 'INCOME',
      transactionDate: '2026-05-02',
      amount: 3000,
      categoryName: '副業',
      note: '案子'
    }]
  }, fixedNow);

  assert.equal(database.categories.length, 1);
  assert.equal(database.categories[0].user_id, 'firebase-user-1');
  assert.equal(database.categories[0].type, 'INCOME');
  assert.equal(database.categories[0].name, '副業');
  assert.equal(database.transactions.length, 1);
  assert.equal(database.transactions[0].category_id, database.categories[0].id);
});

test('createBatchTransactions reuses new custom category within same batch', async () => {
  const database = new FakeSupabaseDatabase([]);

  await createBatchTransactions(database as unknown as SupabaseClient, user, {
    transactions: [
      {
        type: 'EXPENSE',
        transactionDate: '2026-05-02',
        amount: 100,
        categoryName: '家庭',
        note: null
      },
      {
        type: 'EXPENSE',
        transactionDate: '2026-05-02',
        amount: 200,
        categoryName: '家庭',
        note: null
      }
    ]
  }, fixedNow);

  assert.equal(database.categories.length, 1);
  assert.equal(database.transactions.length, 2);
  assert.equal(database.transactions[0].category_id, database.categories[0].id);
  assert.equal(database.transactions[1].category_id, database.categories[0].id);
});

test('createBatchTransactions validates entire batch before writes', async () => {
  const database = new FakeSupabaseDatabase([]);

  await assert.rejects(
    () => createBatchTransactions(database as unknown as SupabaseClient, user, {
      transactions: [
        {
          type: 'EXPENSE',
          transactionDate: '2026-05-02',
          amount: 100,
          categoryName: '飲食'
        },
        {
          type: 'EXPENSE',
          transactionDate: '2026-05-02',
          amount: 0,
          categoryName: '交通'
        }
      ]
    }, fixedNow),
    (error: unknown) => error instanceof RangeError && error.message === 'Transaction 2 amount must be greater than 0'
  );

  assert.equal(database.categories.length, 0);
  assert.equal(database.transactions.length, 0);
});

test('listRecentTransactions returns today rows ordered by category', async () => {
  const database = new FakeSupabaseDatabase(createDefaultCategories());
  database.transactions.push(
    {
      id: 'older-transaction',
      user_id: 'firebase-user-1',
      type: 'EXPENSE',
      transaction_date: '2026-05-01',
      amount: 120,
      category_id: 'default-food',
      note: 'older',
      created_at: '2026-05-02T10:00:00.000Z'
    },
    {
      id: 'hidden-transaction',
      user_id: 'another-user',
      type: 'EXPENSE',
      transaction_date: '2026-05-02',
      amount: 999,
      category_id: 'default-food',
      note: 'hidden',
      created_at: '2026-05-02T09:00:00.000Z'
    },
    {
      id: 'today-food',
      user_id: 'firebase-user-1',
      type: 'EXPENSE',
      transaction_date: '2026-05-02',
      amount: 90,
      category_id: 'default-food',
      note: 'today food',
      created_at: '2026-05-02T07:00:00.000Z'
    },
    {
      id: 'newer-transaction',
      user_id: 'firebase-user-1',
      type: 'INCOME',
      transaction_date: '2026-05-02',
      amount: 3000,
      category_id: 'default-salary',
      note: null,
      created_at: '2026-05-02T08:00:00.000Z'
    }
  );

  const transactions = await listRecentTransactions(database as unknown as SupabaseClient, user, 2, fixedNow);

  assert.deepEqual(transactions, [
    {
      id: 'today-food',
      type: 'EXPENSE',
      transactionDate: '2026-05-02',
      amount: 90,
      categoryName: '飲食',
      note: 'today food',
      createdAt: '2026-05-02T07:00:00.000Z'
    },
    {
      id: 'newer-transaction',
      type: 'INCOME',
      transactionDate: '2026-05-02',
      amount: 3000,
      categoryName: '薪資',
      note: null,
      createdAt: '2026-05-02T08:00:00.000Z'
    }
  ]);
});

test('listHistoryTransactions returns date range rows with pagination state', async () => {
  const database = new FakeSupabaseDatabase([
    {
      id: 'default-food',
      user_id: null,
      type: 'EXPENSE',
      name: '飲食',
      default_category: 1,
      created_at: fixedNow.toISOString()
    },
    {
      id: 'default-transit',
      user_id: null,
      type: 'EXPENSE',
      name: '交通',
      default_category: 1,
      created_at: fixedNow.toISOString()
    },
    {
      id: 'default-salary',
      user_id: null,
      type: 'INCOME',
      name: '薪資',
      default_category: 1,
      created_at: fixedNow.toISOString()
    }
  ]);

  database.transactions.push(
    {
      id: 'out-of-range',
      user_id: 'firebase-user-1',
      type: 'EXPENSE',
      transaction_date: '2026-04-26',
      amount: 70,
      category_id: 'default-food',
      note: 'out',
      created_at: '2026-05-02T06:00:00.000Z'
    },
    {
      id: 'oldest-in-range',
      user_id: 'firebase-user-1',
      type: 'EXPENSE',
      transaction_date: '2026-04-27',
      amount: 80,
      category_id: 'default-food',
      note: 'oldest',
      created_at: '2026-05-02T07:00:00.000Z'
    },
    {
      id: 'same-date-newer',
      user_id: 'firebase-user-1',
      type: 'EXPENSE',
      transaction_date: '2026-04-29',
      amount: 100,
      category_id: 'default-transit',
      note: 'newer',
      created_at: '2026-05-02T09:00:00.000Z'
    },
    {
      id: 'same-date-older',
      user_id: 'firebase-user-1',
      type: 'EXPENSE',
      transaction_date: '2026-04-29',
      amount: 90,
      category_id: 'default-food',
      note: 'older',
      created_at: '2026-05-02T08:00:00.000Z'
    },
    {
      id: 'hidden-user',
      user_id: 'another-user',
      type: 'EXPENSE',
      transaction_date: '2026-04-30',
      amount: 999,
      category_id: 'default-food',
      note: 'hidden',
      created_at: '2026-05-02T10:00:00.000Z'
    },
    {
      id: 'income-row',
      user_id: 'firebase-user-1',
      type: 'INCOME',
      transaction_date: '2026-04-29',
      amount: 3000,
      category_id: 'default-salary',
      note: 'income',
      created_at: '2026-05-02T11:00:00.000Z'
    }
  );

  const firstPage = await listHistoryTransactions(
    database as unknown as SupabaseClient,
    user,
    'EXPENSE',
    '2026-04-27',
    '2026-04-29',
    0,
    2
  );

  assert.equal(firstPage.page, 0);
  assert.equal(firstPage.size, 2);
  assert.equal(firstPage.hasNext, true);
  assert.deepEqual(firstPage.transactions.map((transaction) => transaction.id), [
    'same-date-newer',
    'same-date-older'
  ]);

  const secondPage = await listHistoryTransactions(
    database as unknown as SupabaseClient,
    user,
    'EXPENSE',
    '2026-04-27',
    '2026-04-29',
    1,
    2
  );

  assert.equal(secondPage.hasNext, false);
  assert.deepEqual(secondPage.transactions.map((transaction) => transaction.id), [
    'oldest-in-range'
  ]);
});

test('listCategorySummaries returns category totals and percentages', async () => {
  const database = new FakeSupabaseDatabase(createDefaultCategories());
  database.transactions.push(
    createFakeTransaction('food-1', 'firebase-user-1', 'EXPENSE', '2026-04-29', 100, 'default-food'),
    createFakeTransaction('food-2', 'firebase-user-1', 'EXPENSE', '2026-04-28', 50, 'default-food'),
    createFakeTransaction('transit-1', 'firebase-user-1', 'EXPENSE', '2026-04-27', 50, 'default-transit'),
    createFakeTransaction('hidden-user', 'another-user', 'EXPENSE', '2026-04-29', 999, 'default-food'),
    createFakeTransaction('income-1', 'firebase-user-1', 'INCOME', '2026-04-29', 1000, 'default-salary')
  );

  const summaries = await listCategorySummaries(
    database as unknown as SupabaseClient,
    user,
    'EXPENSE',
    '2026-04-27',
    '2026-04-29'
  );

  assert.deepEqual(summaries, [
    { categoryName: '飲食', amount: 150, percentage: 75 },
    { categoryName: '交通', amount: 50, percentage: 25 }
  ]);
});

test('listHistoryTrend returns daily or monthly cumulative amounts', async () => {
  const database = new FakeSupabaseDatabase(createDefaultCategories());
  database.transactions.push(
    createFakeTransaction('day-1', 'firebase-user-1', 'EXPENSE', '2026-04-01', 100, 'default-food'),
    createFakeTransaction('day-2', 'firebase-user-1', 'EXPENSE', '2026-04-01', 50, 'default-transit'),
    createFakeTransaction('day-3', 'firebase-user-1', 'EXPENSE', '2026-04-03', 70, 'default-food'),
    createFakeTransaction('month-1', 'firebase-user-1', 'EXPENSE', '2026-03-01', 30, 'default-food'),
    createFakeTransaction('income-hidden', 'firebase-user-1', 'INCOME', '2026-04-03', 1000, 'default-salary')
  );

  const dailyTrend = await listHistoryTrend(
    database as unknown as SupabaseClient,
    user,
    'EXPENSE',
    '2026-04-01',
    '2026-04-30'
  );
  assert.deepEqual(dailyTrend, [
    { label: '2026-04-01', amount: 150, cumulativeAmount: 150 },
    { label: '2026-04-03', amount: 70, cumulativeAmount: 220 }
  ]);

  const monthlyTrend = await listHistoryTrend(
    database as unknown as SupabaseClient,
    user,
    'EXPENSE',
    '2026-03-01',
    '2026-04-30'
  );
  assert.deepEqual(monthlyTrend, [
    { label: '2026-03', amount: 30, cumulativeAmount: 30 },
    { label: '2026-04', amount: 220, cumulativeAmount: 250 }
  ]);
});

test('listAnnualCashFlowTrend returns monthly net and cumulative amounts', async () => {
  const database = new FakeSupabaseDatabase(createDefaultCategories());
  database.transactions.push(
    createFakeTransaction('income-jan', 'firebase-user-1', 'INCOME', '2026-01-10', 1000, 'default-salary'),
    createFakeTransaction('expense-jan', 'firebase-user-1', 'EXPENSE', '2026-01-11', 300, 'default-food'),
    createFakeTransaction('expense-feb', 'firebase-user-1', 'EXPENSE', '2026-02-11', 200, 'default-transit'),
    createFakeTransaction('hidden', 'another-user', 'INCOME', '2026-01-10', 9999, 'default-salary')
  );

  const trend = await listAnnualCashFlowTrend(database as unknown as SupabaseClient, user, 2026, fixedNow);

  assert.deepEqual(trend, [
    { label: '2026-01', amount: 700, cumulativeAmount: 700 },
    { label: '2026-02', amount: -200, cumulativeAmount: 500 },
    { label: '2026-03', amount: 0, cumulativeAmount: 500 },
    { label: '2026-04', amount: 0, cumulativeAmount: 500 },
    { label: '2026-05', amount: 0, cumulativeAmount: 500 }
  ]);
});

test('updateTransaction changes editable fields and creates custom category', async () => {
  const database = new FakeSupabaseDatabase(createDefaultCategories());
  database.transactions.push(
    createFakeTransaction('editable', 'firebase-user-1', 'EXPENSE', '2026-04-27', 80, 'default-food', 'before')
  );

  const response = await updateTransaction(database as unknown as SupabaseClient, user, 'editable', {
    type: 'INCOME',
    transactionDate: '2026-04-28',
    amount: 1200,
    categoryName: 'Bonus',
    note: 'after'
  }, fixedNow);

  assert.equal(response.type, 'INCOME');
  assert.equal(response.transactionDate, '2026-04-28');
  assert.equal(response.amount, 1200);
  assert.equal(response.categoryName, 'Bonus');
  assert.equal(response.note, 'after');
  assert.equal(response.createdAt, '2026-05-02T07:00:00.000Z');
  assert.equal(database.transactions[0].type, 'INCOME');
  assert.equal(database.getCategory(database.transactions[0].category_id).name, 'Bonus');
});

test('updateTransaction and deleteTransaction reject another user row', async () => {
  const database = new FakeSupabaseDatabase(createDefaultCategories());
  database.transactions.push(
    createFakeTransaction('hidden', 'another-user', 'EXPENSE', '2026-04-27', 80, 'default-food', 'hidden')
  );

  await assert.rejects(
    () => updateTransaction(database as unknown as SupabaseClient, user, 'hidden', {
      type: 'EXPENSE',
      transactionDate: '2026-04-27',
      amount: 80,
      categoryName: '飲食',
      note: 'try update'
    }, fixedNow),
    (error: unknown) => error instanceof TransactionNotFoundError
  );
  await assert.rejects(
    () => deleteTransaction(database as unknown as SupabaseClient, user, 'hidden'),
    (error: unknown) => error instanceof TransactionNotFoundError
  );
  assert.equal(database.transactions.length, 1);
});

test('deleteTransaction removes current user row', async () => {
  const database = new FakeSupabaseDatabase(createDefaultCategories());
  database.transactions.push(
    createFakeTransaction('delete-me', 'firebase-user-1', 'EXPENSE', '2026-04-27', 80, 'default-food', 'delete'),
    createFakeTransaction('keep-me', 'firebase-user-1', 'EXPENSE', '2026-04-28', 90, 'default-food', 'keep')
  );

  await deleteTransaction(database as unknown as SupabaseClient, user, 'delete-me');

  assert.deepEqual(database.transactions.map((transaction) => transaction.id), ['keep-me']);
});

function createDefaultCategories(): FakeCategoryRow[] {
  return [
    {
      id: 'default-food',
      user_id: null,
      type: 'EXPENSE',
      name: '飲食',
      default_category: 1,
      created_at: fixedNow.toISOString()
    },
    {
      id: 'default-transit',
      user_id: null,
      type: 'EXPENSE',
      name: '交通',
      default_category: 1,
      created_at: fixedNow.toISOString()
    },
    {
      id: 'default-salary',
      user_id: null,
      type: 'INCOME',
      name: '薪資',
      default_category: 1,
      created_at: fixedNow.toISOString()
    }
  ];
}

function createFakeTransaction(
  id: string,
  userId: string,
  type: string,
  transactionDate: string,
  amount: number,
  categoryId: string,
  note: string | null = null
): FakeTransactionRow {
  return {
    id,
    user_id: userId,
    type,
    transaction_date: transactionDate,
    amount,
    category_id: categoryId,
    note,
    created_at: '2026-05-02T07:00:00.000Z'
  };
}
