import type { TransactionType } from './categories';

export type AiQuickAddFeedbackType = 'accepted' | 'corrected' | 'missed_by_ai';

export interface AiSuggestionMetadata {
  suggestionId: string;
  sourceText: string;
  itemText: string;
  modelLabel: string;
  modelType: TransactionType;
  modelCategory: string;
  mappedType: TransactionType;
  mappedCategoryName: string;
  suggestedTransactionDate: string;
  suggestedAmount: number;
  suggestedNote: string | null;
  confidence: number;
  needsReview: boolean;
  dateSource: string;
  mappingSource: string;
}

export interface AiFeedbackTransaction {
  type: TransactionType;
  transactionDate: string;
  amount: number;
  categoryName: string;
  note: string | null;
  aiSuggestion?: AiSuggestionMetadata;
}

export interface BuildAiQuickAddFeedbackRowRequest {
  id: string;
  userId: string;
  transactionId: string;
  quickAddSessionId?: string;
  quickAddInputText?: string;
  transaction: AiFeedbackTransaction;
  createdAt: string;
}

export interface AiQuickAddFeedbackRow {
  id: string;
  user_id: string;
  transaction_id: string;
  quick_add_session_id: string | null;
  quick_add_input_text: string | null;
  feedback_type: AiQuickAddFeedbackType;
  suggestion_id: string | null;
  source_text: string | null;
  item_text: string | null;
  model_label: string | null;
  model_type: TransactionType | null;
  model_category: string | null;
  mapped_type: TransactionType | null;
  mapped_category_name: string | null;
  final_type: TransactionType;
  final_category: string;
  final_amount: number;
  final_transaction_date: string;
  final_note: string | null;
  confidence: number | null;
  needs_review: boolean | null;
  date_source: string | null;
  mapping_source: string | null;
  created_at: string;
}

/**
 * 建立 AI 快速新增回饋列；一般手動新增不會產生回饋。
 */
export function buildAiQuickAddFeedbackRow(
  request: BuildAiQuickAddFeedbackRowRequest
): AiQuickAddFeedbackRow | null {
  const suggestion = request.transaction.aiSuggestion;
  if (!suggestion && !request.quickAddSessionId) {
    return null;
  }

  const feedbackType = suggestion
    ? resolveSuggestionFeedbackType(request.transaction, suggestion)
    : 'missed_by_ai';

  return {
    id: request.id,
    user_id: request.userId,
    transaction_id: request.transactionId,
    quick_add_session_id: request.quickAddSessionId ?? null,
    quick_add_input_text: request.quickAddInputText ?? null,
    feedback_type: feedbackType,
    suggestion_id: suggestion?.suggestionId ?? null,
    source_text: suggestion?.sourceText ?? null,
    item_text: suggestion?.itemText ?? null,
    model_label: suggestion?.modelLabel ?? null,
    model_type: suggestion?.modelType ?? null,
    model_category: suggestion?.modelCategory ?? null,
    mapped_type: suggestion?.mappedType ?? null,
    mapped_category_name: suggestion?.mappedCategoryName ?? null,
    final_type: request.transaction.type,
    final_category: request.transaction.categoryName,
    final_amount: request.transaction.amount,
    final_transaction_date: request.transaction.transactionDate,
    final_note: request.transaction.note,
    confidence: suggestion?.confidence ?? null,
    needs_review: suggestion?.needsReview ?? null,
    date_source: suggestion?.dateSource ?? null,
    mapping_source: suggestion?.mappingSource ?? null,
    created_at: request.createdAt
  };
}

function resolveSuggestionFeedbackType(
  transaction: AiFeedbackTransaction,
  suggestion: AiSuggestionMetadata
): AiQuickAddFeedbackType {
  if (
    transaction.type === suggestion.mappedType
    && transaction.categoryName === suggestion.mappedCategoryName
    && transaction.transactionDate === suggestion.suggestedTransactionDate
    && transaction.amount === suggestion.suggestedAmount
    && (transaction.note ?? null) === (suggestion.suggestedNote ?? null)
  ) {
    return 'accepted';
  }

  return 'corrected';
}
