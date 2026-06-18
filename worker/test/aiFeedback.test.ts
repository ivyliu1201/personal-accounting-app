import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAiQuickAddFeedbackRow } from '../src/aiFeedback';

const baseSuggestion = {
  suggestionId: 'suggestion-1',
  sourceText: '昨天早餐100',
  itemText: '早餐',
  modelLabel: 'expense::飲食',
  modelType: 'EXPENSE' as const,
  modelCategory: '飲食',
  mappedType: 'EXPENSE' as const,
  mappedCategoryName: '飲食',
  suggestedTransactionDate: '2026-06-16',
  suggestedAmount: 100,
  suggestedNote: '早餐',
  confidence: 0.91,
  needsReview: false,
  dateSource: 'relative_date',
  mappingSource: 'exact_match'
};

const baseTransaction = {
  type: 'EXPENSE' as const,
  transactionDate: '2026-06-16',
  amount: 100,
  categoryName: '飲食',
  note: '早餐',
  aiSuggestion: baseSuggestion
};

test('buildAiQuickAddFeedbackRow marks unchanged AI suggestion as accepted', () => {
  const row = buildAiQuickAddFeedbackRow({
    id: 'feedback-1',
    userId: 'firebase-user-1',
    transactionId: 'transaction-1',
    quickAddSessionId: 'session-1',
    quickAddInputText: '昨天早餐100',
    transaction: baseTransaction,
    createdAt: '2026-06-17T00:00:00.000Z'
  });

  assert.equal(row?.feedback_type, 'accepted');
  assert.equal(row?.model_label, 'expense::飲食');
  assert.equal(row?.final_category, '飲食');
});

test('buildAiQuickAddFeedbackRow marks changed AI suggestion as corrected', () => {
  const row = buildAiQuickAddFeedbackRow({
    id: 'feedback-1',
    userId: 'firebase-user-1',
    transactionId: 'transaction-1',
    quickAddSessionId: 'session-1',
    quickAddInputText: '昨天早餐100',
    transaction: {
      ...baseTransaction,
      categoryName: '娛樂'
    },
    createdAt: '2026-06-17T00:00:00.000Z'
  });

  assert.equal(row?.feedback_type, 'corrected');
  assert.equal(row?.mapped_category_name, '飲食');
  assert.equal(row?.final_category, '娛樂');
});

test('buildAiQuickAddFeedbackRow marks manual row in quick add session as missed by AI', () => {
  const row = buildAiQuickAddFeedbackRow({
    id: 'feedback-1',
    userId: 'firebase-user-1',
    transactionId: 'transaction-1',
    quickAddSessionId: 'session-1',
    quickAddInputText: '昨天早餐100 買文具80',
    transaction: {
      type: 'EXPENSE',
      transactionDate: '2026-06-16',
      amount: 80,
      categoryName: '自我成長',
      note: '買文具'
    },
    createdAt: '2026-06-17T00:00:00.000Z'
  });

  assert.equal(row?.feedback_type, 'missed_by_ai');
  assert.equal(row?.model_label, null);
  assert.equal(row?.quick_add_input_text, '昨天早餐100 買文具80');
  assert.equal(row?.final_category, '自我成長');
});

test('buildAiQuickAddFeedbackRow ignores manual row outside quick add session', () => {
  const row = buildAiQuickAddFeedbackRow({
    id: 'feedback-1',
    userId: 'firebase-user-1',
    transactionId: 'transaction-1',
    transaction: {
      type: 'EXPENSE',
      transactionDate: '2026-06-16',
      amount: 80,
      categoryName: '自我成長',
      note: '買文具'
    },
    createdAt: '2026-06-17T00:00:00.000Z'
  });

  assert.equal(row, null);
});
