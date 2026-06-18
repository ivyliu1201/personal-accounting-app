import test from 'node:test';
import assert from 'node:assert/strict';
import { listAnnualCashFlowTrend } from '../src/transactions';
import type { AuthenticatedUser } from '../src/auth';

interface FakeTransactionRow {
  id: string;
  user_id: string;
  type: 'INCOME' | 'EXPENSE';
  transaction_date: string;
  amount: number;
  note: string | null;
  created_at: string;
  categories: { name: string };
}

class FakeTransactionQuery implements PromiseLike<{ data: FakeTransactionRow[]; error: null }> {
  private userId: string | null = null;
  private startDate: string | null = null;
  private endDate: string | null = null;

  constructor(private readonly rows: FakeTransactionRow[]) {}

  select() {
    return this;
  }

  eq(fieldName: string, value: string) {
    if (fieldName === 'user_id') {
      this.userId = value;
    }
    return this;
  }

  gte(fieldName: string, value: string) {
    if (fieldName === 'transaction_date') {
      this.startDate = value;
    }
    return this;
  }

  lte(fieldName: string, value: string) {
    if (fieldName === 'transaction_date') {
      this.endDate = value;
    }
    return this;
  }

  then<TResult1 = { data: FakeTransactionRow[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: FakeTransactionRow[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({
      data: this.rows.filter((row) => {
        if (this.userId && row.user_id !== this.userId) {
          return false;
        }
        if (this.startDate && row.transaction_date < this.startDate) {
          return false;
        }
        if (this.endDate && row.transaction_date > this.endDate) {
          return false;
        }
        return true;
      }),
      error: null
    }).then(onfulfilled, onrejected);
  }
}

class FakeSupabase {
  constructor(private readonly rows: FakeTransactionRow[]) {}

  from(tableName: string) {
    if (tableName !== 'accounting_transactions') {
      throw new Error(`Unsupported table: ${tableName}`);
    }
    return new FakeTransactionQuery(this.rows);
  }
}

const user: AuthenticatedUser = {
  userId: 'firebase-user-1',
  email: 'user@example.test'
};

test('listAnnualCashFlowTrend excludes future dates from the current year trend', async () => {
  const supabase = new FakeSupabase([
    createTransaction('income-today', 'INCOME', '2026-06-18', 100),
    createTransaction('expense-today', 'EXPENSE', '2026-06-18', 100),
    createTransaction('expense-tomorrow', 'EXPENSE', '2026-06-19', 100)
  ]);

  const trend = await listAnnualCashFlowTrend(
    supabase as never,
    user,
    2026,
    new Date('2026-06-18T08:00:00.000Z')
  );

  assert.equal(trend.at(-1)?.label, '2026-06');
  assert.equal(trend.at(-1)?.amount, 0);
  assert.equal(trend.at(-1)?.cumulativeAmount, 0);
});

function createTransaction(
  id: string,
  type: 'INCOME' | 'EXPENSE',
  transactionDate: string,
  amount: number
): FakeTransactionRow {
  return {
    id,
    user_id: user.userId,
    type,
    transaction_date: transactionDate,
    amount,
    note: null,
    created_at: '2026-06-18T00:00:00.000Z',
    categories: { name: type === 'INCOME' ? '中獎' : '飲食' }
  };
}
