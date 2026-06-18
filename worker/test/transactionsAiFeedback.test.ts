import test from 'node:test';
import assert from 'node:assert/strict';
import { createBatchTransactions } from '../src/transactions';
import type { AuthenticatedUser } from '../src/auth';

class FakeSupabaseQuery {
  constructor(private readonly result: { data?: unknown; error: unknown }) {}

  select() {
    return this;
  }

  eq() {
    return this;
  }

  is() {
    return this;
  }

  maybeSingle() {
    return Promise.resolve(this.result);
  }
}

class FakeSupabaseTable {
  readonly insertedRows: unknown[] = [];
  private insertCallCount = 0;

  constructor(
    private readonly queryResult: { data?: unknown; error: unknown },
    private readonly insertResults: Array<{ error: unknown }> = [{ error: null }]
  ) {}

  select() {
    return new FakeSupabaseQuery(this.queryResult).select();
  }

  insert(row: unknown) {
    this.insertedRows.push(row);
    const result = this.insertResults[Math.min(this.insertCallCount, this.insertResults.length - 1)];
    this.insertCallCount += 1;
    return Promise.resolve(result);
  }
}

class FakeSupabase {
  readonly categories = new FakeSupabaseTable({ data: { id: 'default-food' }, error: null });
  readonly transactions: FakeSupabaseTable;
  readonly feedback: FakeSupabaseTable;

  constructor(options: {
    feedbackInsertResults?: Array<{ error: unknown }>;
    transactionInsertResults?: Array<{ error: unknown }>;
  } = {}) {
    this.transactions = new FakeSupabaseTable({ error: null }, options.transactionInsertResults);
    this.feedback = new FakeSupabaseTable({ error: null }, options.feedbackInsertResults);
  }

  from(tableName: string) {
    if (tableName === 'categories') {
      return this.categories;
    }
    if (tableName === 'accounting_transactions') {
      return this.transactions;
    }
    if (tableName === 'ai_quick_add_feedback') {
      return this.feedback;
    }
    throw new Error(`Unsupported table: ${tableName}`);
  }
}

const user: AuthenticatedUser = {
  userId: 'firebase-user-1',
  email: 'user@example.test'
};

const fixedNow = new Date('2026-06-17T00:00:00.000Z');

test('createBatchTransactions writes AI feedback for accepted suggestion and missed manual row', async () => {
  const supabase = new FakeSupabase();

  await createBatchTransactions(supabase as never, user, {
    quickAddSessionId: 'session-1',
    quickAddInputText: '昨天早餐100 買文具80',
    transactions: [
      {
        type: 'EXPENSE',
        transactionDate: '2026-06-16',
        amount: 100,
        categoryName: '飲食',
        note: '早餐',
        aiSuggestion: {
          suggestionId: 'suggestion-1',
          sourceText: '昨天早餐100',
          itemText: '早餐',
          modelLabel: 'expense::飲食',
          modelType: 'EXPENSE',
          modelCategory: '飲食',
          mappedType: 'EXPENSE',
          mappedCategoryName: '飲食',
          suggestedTransactionDate: '2026-06-16',
          suggestedAmount: 100,
          suggestedNote: '早餐',
          confidence: 0.91,
          needsReview: false,
          dateSource: 'relative_date',
          mappingSource: 'exact_match'
        }
      },
      {
        type: 'EXPENSE',
        transactionDate: '2026-06-16',
        amount: 80,
        categoryName: '自我成長',
        note: '買文具'
      }
    ]
  }, fixedNow);

  assert.equal(supabase.feedback.insertedRows.length, 2);
  assert.equal((supabase.feedback.insertedRows[0] as { feedback_type: string }).feedback_type, 'accepted');
  assert.equal((supabase.feedback.insertedRows[1] as { feedback_type: string }).feedback_type, 'missed_by_ai');
});

test('createBatchTransactions stores corrected final type and category in AI feedback', async () => {
  const supabase = new FakeSupabase();

  await createBatchTransactions(supabase as never, user, {
    quickAddSessionId: 'session-1',
    quickAddInputText: '中獎100',
    transactions: [
      {
        type: 'INCOME',
        transactionDate: '2026-06-17',
        amount: 100,
        categoryName: '投資',
        note: '中獎',
        aiSuggestion: {
          suggestionId: 'suggestion-1',
          sourceText: '中獎100',
          itemText: '中獎',
          modelLabel: 'expense::娛樂',
          modelType: 'EXPENSE',
          modelCategory: '娛樂',
          mappedType: 'EXPENSE',
          mappedCategoryName: '娛樂',
          suggestedTransactionDate: '2026-06-17',
          suggestedAmount: 100,
          suggestedNote: '中獎',
          confidence: 0.62,
          needsReview: true,
          dateSource: 'default_today',
          mappingSource: 'exact_match'
        }
      }
    ]
  }, fixedNow);

  const feedbackRow = supabase.feedback.insertedRows[0] as {
    feedback_type: string;
    model_type: string;
    mapped_type: string;
    final_type: string;
    final_category: string;
    final_amount: number;
    final_note: string;
  };
  assert.equal(feedbackRow.feedback_type, 'corrected');
  assert.equal(feedbackRow.model_type, 'EXPENSE');
  assert.equal(feedbackRow.mapped_type, 'EXPENSE');
  assert.equal(feedbackRow.final_type, 'INCOME');
  assert.equal(feedbackRow.final_category, '投資');
  assert.equal(feedbackRow.final_amount, 100);
  assert.equal(feedbackRow.final_note, '中獎');
});

test('createBatchTransactions keeps created transactions when AI feedback insert fails', async () => {
  const supabase = new FakeSupabase({
    feedbackInsertResults: [{ error: new Error('feedback table is unavailable') }]
  });
  const originalConsoleError = console.error;
  let loggedErrors = 0;
  console.error = () => {
    loggedErrors += 1;
  };

  try {
    const response = await createBatchTransactions(supabase as never, user, {
      quickAddSessionId: 'session-1',
      quickAddInputText: '麥當勞100 中獎100',
      transactions: [
        {
          type: 'EXPENSE',
          transactionDate: '2026-06-17',
          amount: 100,
          categoryName: '飲食',
          note: '麥當勞',
          aiSuggestion: {
            suggestionId: 'suggestion-1',
            sourceText: '麥當勞100',
            itemText: '麥當勞',
            modelLabel: 'expense::飲食',
            modelType: 'EXPENSE',
            modelCategory: '飲食',
            mappedType: 'EXPENSE',
            mappedCategoryName: '飲食',
            suggestedTransactionDate: '2026-06-17',
            suggestedAmount: 100,
            suggestedNote: '麥當勞',
            confidence: 0.91,
            needsReview: false,
            dateSource: 'default_today',
            mappingSource: 'exact_match'
          }
        },
        {
          type: 'INCOME',
          transactionDate: '2026-06-17',
          amount: 100,
          categoryName: '投資',
          note: '中獎',
          aiSuggestion: {
            suggestionId: 'suggestion-2',
            sourceText: '中獎100',
            itemText: '中獎',
            modelLabel: 'expense::娛樂',
            modelType: 'EXPENSE',
            modelCategory: '娛樂',
            mappedType: 'EXPENSE',
            mappedCategoryName: '娛樂',
            suggestedTransactionDate: '2026-06-17',
            suggestedAmount: 100,
            suggestedNote: '中獎',
            confidence: 0.62,
            needsReview: true,
            dateSource: 'default_today',
            mappingSource: 'exact_match'
          }
        }
      ]
    }, fixedNow);

    assert.equal(response.transactions.length, 2);
    assert.equal(supabase.transactions.insertedRows.length, 2);
    assert.equal((response.transactions[1] as { type: string }).type, 'INCOME');
    assert.equal(loggedErrors, 0);
  } finally {
    console.error = originalConsoleError;
  }
});

test('createBatchTransactions does not write AI feedback when batch creation fails', async () => {
  const supabase = new FakeSupabase({
    transactionInsertResults: [
      { error: null },
      { error: new Error('second transaction failed') }
    ]
  });

  await assert.rejects(
    () => createBatchTransactions(supabase as never, user, {
      quickAddSessionId: 'session-1',
      quickAddInputText: '麥當勞100 中獎100',
      transactions: [
        {
          type: 'EXPENSE',
          transactionDate: '2026-06-17',
          amount: 100,
          categoryName: '飲食',
          note: '麥當勞',
          aiSuggestion: {
            suggestionId: 'suggestion-1',
            sourceText: '麥當勞100',
            itemText: '麥當勞',
            modelLabel: 'expense::飲食',
            modelType: 'EXPENSE',
            modelCategory: '飲食',
            mappedType: 'EXPENSE',
            mappedCategoryName: '飲食',
            suggestedTransactionDate: '2026-06-17',
            suggestedAmount: 100,
            suggestedNote: '麥當勞',
            confidence: 0.91,
            needsReview: false,
            dateSource: 'default_today',
            mappingSource: 'exact_match'
          }
        },
        {
          type: 'INCOME',
          transactionDate: '2026-06-17',
          amount: 100,
          categoryName: '投資',
          note: '中獎',
          aiSuggestion: {
            suggestionId: 'suggestion-2',
            sourceText: '中獎100',
            itemText: '中獎',
            modelLabel: 'expense::娛樂',
            modelType: 'EXPENSE',
            modelCategory: '娛樂',
            mappedType: 'EXPENSE',
            mappedCategoryName: '娛樂',
            suggestedTransactionDate: '2026-06-17',
            suggestedAmount: 100,
            suggestedNote: '中獎',
            confidence: 0.62,
            needsReview: true,
            dateSource: 'default_today',
            mappingSource: 'exact_match'
          }
        }
      ]
    }, fixedNow),
    (error: unknown) => error instanceof Error && error.message === 'second transaction failed'
  );

  assert.equal(supabase.transactions.insertedRows.length, 2);
  assert.equal(supabase.feedback.insertedRows.length, 0);
});
