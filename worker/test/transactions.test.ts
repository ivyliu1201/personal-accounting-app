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

class FakePreparedStatement {
  private readonly database: FakeD1Database;
  private readonly sql: string;
  private values: unknown[] = [];

  constructor(database: FakeD1Database, sql: string) {
    this.database = database;
    this.sql = sql;
  }

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async first<T>() {
    if (this.sql.includes('from accounting_transactions t')) {
      const [id, userId] = this.values;
      const transaction = this.database.transactions
        .find((row) => row.id === id && row.user_id === userId);
      return (transaction ? this.buildTransactionRow(transaction) : null) as T | null;
    }

    if (this.sql.includes('from categories')) {
      const [type, name, userId] = this.values;
      const row = this.database.categories
        .filter((category) => category.type === type
          && category.name === name
          && (category.user_id === userId || category.user_id === null))
        .sort((left, right) => right.default_category - left.default_category)[0];
      return (row ? { id: row.id } : null) as T | null;
    }
    throw new Error('Unsupported first query');
  }

  async all<T>() {
    if (this.sql.includes('group by c.name')) {
      const [userId, type, startDate, endDate] = this.values;
      const amountByCategoryName = new Map<string, number>();
      for (const transaction of this.database.transactions) {
        if (transaction.user_id !== userId
          || transaction.type !== type
          || transaction.transaction_date < String(startDate)
          || transaction.transaction_date > String(endDate)) {
          continue;
        }
        const category = this.database.getCategory(transaction.category_id);
        amountByCategoryName.set(
          category.name,
          (amountByCategoryName.get(category.name) ?? 0) + transaction.amount
        );
      }
      const rows = Array.from(amountByCategoryName.entries())
        .map(([categoryName, amount]) => ({ category_name: categoryName, amount }))
        .sort((left, right) => right.amount - left.amount || left.category_name.localeCompare(right.category_name, 'zh-Hant'));
      return { results: rows } as { results: T[] };
    }

    if (this.sql.includes("case when t.type = 'INCOME'")) {
      const [userId, startDate, endDate] = this.values;
      const amountByLabel = new Map<string, number>();
      for (const transaction of this.database.transactions) {
        if (transaction.user_id !== userId
          || transaction.transaction_date < String(startDate)
          || transaction.transaction_date > String(endDate)) {
          continue;
        }
        const label = transaction.transaction_date.slice(0, 7);
        const amount = transaction.type === 'INCOME' ? transaction.amount : -transaction.amount;
        amountByLabel.set(label, (amountByLabel.get(label) ?? 0) + amount);
      }
      const rows = Array.from(amountByLabel.entries())
        .map(([label, amount]) => ({ label, amount }))
        .sort((left, right) => left.label.localeCompare(right.label));
      return { results: rows } as { results: T[] };
    }

    if (this.sql.includes('group by t.transaction_date')) {
      const [userId, type, startDate, endDate] = this.values;
      const amountByLabel = this.sumByLabel(userId, type, startDate, endDate, (transaction) => transaction.transaction_date);
      const rows = Array.from(amountByLabel.entries())
        .map(([label, amount]) => ({ label, amount }))
        .sort((left, right) => left.label.localeCompare(right.label));
      return { results: rows } as { results: T[] };
    }

    if (this.sql.includes('group by substr(t.transaction_date, 1, 7)')) {
      const [userId, type, startDate, endDate] = this.values;
      const amountByLabel = this.sumByLabel(userId, type, startDate, endDate, (transaction) => transaction.transaction_date.slice(0, 7));
      const rows = Array.from(amountByLabel.entries())
        .map(([label, amount]) => ({ label, amount }))
        .sort((left, right) => left.label.localeCompare(right.label));
      return { results: rows } as { results: T[] };
    }

    if (this.sql.includes('from accounting_transactions t') && this.sql.includes('limit ?') && this.sql.includes('offset ?')) {
      const [userId, type, startDate, endDate, limit, offset] = this.values;
      const rows = this.database.transactions
        .filter((transaction) => transaction.user_id === userId
          && transaction.type === type
          && transaction.transaction_date >= String(startDate)
          && transaction.transaction_date <= String(endDate))
        .sort((left, right) => {
          const dateOrder = right.transaction_date.localeCompare(left.transaction_date);
          return dateOrder === 0 ? right.created_at.localeCompare(left.created_at) : dateOrder;
        })
        .slice(Number(offset), Number(offset) + Number(limit))
        .map((transaction) => this.buildTransactionRow(transaction));
      return { results: rows } as { results: T[] };
    }

    if (this.sql.includes('from accounting_transactions t')) {
      const [userId, limit] = this.values;
      const rows = this.database.transactions
        .filter((transaction) => transaction.user_id === userId)
        .sort((left, right) => right.created_at.localeCompare(left.created_at))
        .slice(0, Number(limit))
        .map((transaction) => this.buildTransactionRow(transaction));
      return { results: rows } as { results: T[] };
    }

    throw new Error('Unsupported all query');
  }

  private sumByLabel(
    userId: unknown,
    type: unknown,
    startDate: unknown,
    endDate: unknown,
    labelSelector: (transaction: FakeTransactionRow) => string
  ) {
    const amountByLabel = new Map<string, number>();
    for (const transaction of this.database.transactions) {
      if (transaction.user_id !== userId
        || transaction.type !== type
        || transaction.transaction_date < String(startDate)
        || transaction.transaction_date > String(endDate)) {
        continue;
      }
      const label = labelSelector(transaction);
      amountByLabel.set(label, (amountByLabel.get(label) ?? 0) + transaction.amount);
    }
    return amountByLabel;
  }

  private buildTransactionRow(transaction: FakeTransactionRow) {
    const category = this.database.categories.find((candidate) => candidate.id === transaction.category_id);
    if (!category) {
      throw new Error('Category not found');
    }
    return {
      id: transaction.id,
      type: transaction.type,
      transaction_date: transaction.transaction_date,
      amount: transaction.amount,
      category_name: category.name,
      note: transaction.note,
      created_at: transaction.created_at
    };
  }

  execute() {
    if (this.sql.includes('insert into categories')) {
      const [id, userId, type, name, createdAt] = this.values;
      this.database.categories.push({
        id: String(id),
        user_id: String(userId),
        type: String(type),
        name: String(name),
        default_category: 0,
        created_at: String(createdAt)
      });
      return;
    }

    if (this.sql.includes('insert into accounting_transactions')) {
      const [id, userId, type, transactionDate, amount, categoryId, note, createdAt] = this.values;
      this.database.transactions.push({
        id: String(id),
        user_id: String(userId),
        type: String(type),
        transaction_date: String(transactionDate),
        amount: Number(amount),
        category_id: String(categoryId),
        note: note === null ? null : String(note),
        created_at: String(createdAt)
      });
      return;
    }

    if (this.sql.includes('update accounting_transactions')) {
      const [type, transactionDate, amount, categoryId, note, id, userId] = this.values;
      const transaction = this.database.transactions.find((row) => row.id === id && row.user_id === userId);
      if (transaction) {
        transaction.type = String(type);
        transaction.transaction_date = String(transactionDate);
        transaction.amount = Number(amount);
        transaction.category_id = String(categoryId);
        transaction.note = note === null ? null : String(note);
      }
      return;
    }

    if (this.sql.includes('delete from accounting_transactions')) {
      const [id, userId] = this.values;
      const index = this.database.transactions.findIndex((row) => row.id === id && row.user_id === userId);
      if (index >= 0) {
        this.database.transactions.splice(index, 1);
      }
      return;
    }

    throw new Error('Unsupported statement');
  }

  async run() {
    this.execute();
    return { success: true };
  }
}

class FakeD1Database {
  readonly categories: FakeCategoryRow[];
  readonly transactions: FakeTransactionRow[] = [];
  batchSize = 0;

  constructor(categories: FakeCategoryRow[]) {
    this.categories = categories;
  }

  prepare(sql: string) {
    return new FakePreparedStatement(this, sql);
  }

  getCategory(id: string) {
    const category = this.categories.find((candidate) => candidate.id === id);
    if (!category) {
      throw new Error('Category not found');
    }
    return category;
  }

  async batch(statements: FakePreparedStatement[]) {
    this.batchSize = statements.length;
    for (const statement of statements) {
      statement.execute();
    }
    return [];
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

test('validateBatchCreateRequest rejects future date', () => {
  assert.throws(
    () => validateBatchCreateRequest({
      transactions: [{
        type: 'EXPENSE',
        transactionDate: '2026-05-03',
        amount: 100,
        categoryName: '飲食'
      }]
    }, fixedNow),
    (error: unknown) => error instanceof RangeError && error.message === 'Transaction 1 date cannot be in the future'
  );
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

test('createBatchTransactions uses existing default category and authenticated user id', async () => {
  const database = new FakeD1Database([{
    id: 'default-food',
    user_id: null,
    type: 'EXPENSE',
    name: '飲食',
    default_category: 1,
    created_at: fixedNow.toISOString()
  }]);

  const response = await createBatchTransactions(database as unknown as D1Database, user, {
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
  assert.equal(database.batchSize, 1);
  assert.equal(response.transactions[0].categoryName, '飲食');
});

test('createBatchTransactions creates custom category for current user', async () => {
  const database = new FakeD1Database([]);

  await createBatchTransactions(database as unknown as D1Database, user, {
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
  assert.equal(database.batchSize, 2);
});

test('createBatchTransactions reuses new custom category within same batch', async () => {
  const database = new FakeD1Database([]);

  await createBatchTransactions(database as unknown as D1Database, user, {
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
  assert.equal(database.batchSize, 3);
});

test('createBatchTransactions validates entire batch before writes', async () => {
  const database = new FakeD1Database([]);

  await assert.rejects(
    () => createBatchTransactions(database as unknown as D1Database, user, {
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
  assert.equal(database.batchSize, 0);
});

test('listRecentTransactions returns current user rows ordered by created time', async () => {
  const database = new FakeD1Database([
    {
      id: 'default-food',
      user_id: null,
      type: 'EXPENSE',
      name: '飲食',
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
      id: 'older-transaction',
      user_id: 'firebase-user-1',
      type: 'EXPENSE',
      transaction_date: '2026-05-01',
      amount: 120,
      category_id: 'default-food',
      note: 'older',
      created_at: '2026-05-02T07:00:00.000Z'
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

  const transactions = await listRecentTransactions(database as unknown as D1Database, user, 2);

  assert.deepEqual(transactions, [
    {
      id: 'newer-transaction',
      type: 'INCOME',
      transactionDate: '2026-05-02',
      amount: 3000,
      categoryName: '薪資',
      note: null,
      createdAt: '2026-05-02T08:00:00.000Z'
    },
    {
      id: 'older-transaction',
      type: 'EXPENSE',
      transactionDate: '2026-05-01',
      amount: 120,
      categoryName: '飲食',
      note: 'older',
      createdAt: '2026-05-02T07:00:00.000Z'
    }
  ]);
});

test('listHistoryTransactions returns date range rows with pagination state', async () => {
  const database = new FakeD1Database([
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
    database as unknown as D1Database,
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
    database as unknown as D1Database,
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
  const database = new FakeD1Database(createDefaultCategories());
  database.transactions.push(
    createFakeTransaction('food-1', 'firebase-user-1', 'EXPENSE', '2026-04-29', 100, 'default-food'),
    createFakeTransaction('food-2', 'firebase-user-1', 'EXPENSE', '2026-04-28', 50, 'default-food'),
    createFakeTransaction('transit-1', 'firebase-user-1', 'EXPENSE', '2026-04-27', 50, 'default-transit'),
    createFakeTransaction('hidden-user', 'another-user', 'EXPENSE', '2026-04-29', 999, 'default-food'),
    createFakeTransaction('income-1', 'firebase-user-1', 'INCOME', '2026-04-29', 1000, 'default-salary')
  );

  const summaries = await listCategorySummaries(
    database as unknown as D1Database,
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
  const database = new FakeD1Database(createDefaultCategories());
  database.transactions.push(
    createFakeTransaction('day-1', 'firebase-user-1', 'EXPENSE', '2026-04-01', 100, 'default-food'),
    createFakeTransaction('day-2', 'firebase-user-1', 'EXPENSE', '2026-04-01', 50, 'default-transit'),
    createFakeTransaction('day-3', 'firebase-user-1', 'EXPENSE', '2026-04-03', 70, 'default-food'),
    createFakeTransaction('month-1', 'firebase-user-1', 'EXPENSE', '2026-03-01', 30, 'default-food'),
    createFakeTransaction('income-hidden', 'firebase-user-1', 'INCOME', '2026-04-03', 1000, 'default-salary')
  );

  const dailyTrend = await listHistoryTrend(
    database as unknown as D1Database,
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
    database as unknown as D1Database,
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
  const database = new FakeD1Database(createDefaultCategories());
  database.transactions.push(
    createFakeTransaction('income-jan', 'firebase-user-1', 'INCOME', '2026-01-10', 1000, 'default-salary'),
    createFakeTransaction('expense-jan', 'firebase-user-1', 'EXPENSE', '2026-01-11', 300, 'default-food'),
    createFakeTransaction('expense-feb', 'firebase-user-1', 'EXPENSE', '2026-02-11', 200, 'default-transit'),
    createFakeTransaction('hidden', 'another-user', 'INCOME', '2026-01-10', 9999, 'default-salary')
  );

  const trend = await listAnnualCashFlowTrend(database as unknown as D1Database, user, 2026, fixedNow);

  assert.deepEqual(trend, [
    { label: '2026-01', amount: 700, cumulativeAmount: 700 },
    { label: '2026-02', amount: -200, cumulativeAmount: 500 },
    { label: '2026-03', amount: 0, cumulativeAmount: 500 },
    { label: '2026-04', amount: 0, cumulativeAmount: 500 },
    { label: '2026-05', amount: 0, cumulativeAmount: 500 }
  ]);
});

test('updateTransaction changes editable fields and creates custom category', async () => {
  const database = new FakeD1Database(createDefaultCategories());
  database.transactions.push(
    createFakeTransaction('editable', 'firebase-user-1', 'EXPENSE', '2026-04-27', 80, 'default-food', 'before')
  );

  const response = await updateTransaction(database as unknown as D1Database, user, 'editable', {
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
  const database = new FakeD1Database(createDefaultCategories());
  database.transactions.push(
    createFakeTransaction('hidden', 'another-user', 'EXPENSE', '2026-04-27', 80, 'default-food', 'hidden')
  );

  await assert.rejects(
    () => updateTransaction(database as unknown as D1Database, user, 'hidden', {
      type: 'EXPENSE',
      transactionDate: '2026-04-27',
      amount: 80,
      categoryName: '飲食',
      note: 'try update'
    }, fixedNow),
    (error: unknown) => error instanceof TransactionNotFoundError
  );
  await assert.rejects(
    () => deleteTransaction(database as unknown as D1Database, user, 'hidden'),
    (error: unknown) => error instanceof TransactionNotFoundError
  );
  assert.equal(database.transactions.length, 1);
});

test('deleteTransaction removes current user row', async () => {
  const database = new FakeD1Database(createDefaultCategories());
  database.transactions.push(
    createFakeTransaction('delete-me', 'firebase-user-1', 'EXPENSE', '2026-04-27', 80, 'default-food', 'delete'),
    createFakeTransaction('keep-me', 'firebase-user-1', 'EXPENSE', '2026-04-28', 90, 'default-food', 'keep')
  );

  await deleteTransaction(database as unknown as D1Database, user, 'delete-me');

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
