import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedUser } from './auth';
import type { TransactionType } from './categories';
import {
  buildAiQuickAddFeedbackRow,
  type AiSuggestionMetadata
} from './aiFeedback';

interface BatchCreateTransactionsRequest {
  transactions?: CreateTransactionRequest[];
  quickAddSessionId?: unknown;
  quickAddInputText?: unknown;
}

interface CreateTransactionRequest {
  type?: string;
  transactionDate?: string;
  amount?: unknown;
  categoryName?: string;
  note?: string | null;
  aiSuggestion?: unknown;
}

type UpdateTransactionRequest = CreateTransactionRequest;

interface ValidatedCreateTransaction {
  type: TransactionType;
  transactionDate: string;
  amount: number;
  categoryName: string;
  note: string | null;
  aiSuggestion?: AiSuggestionMetadata;
}

interface QuickAddBatchMetadata {
  quickAddSessionId?: string;
  quickAddInputText?: string;
}

export interface TransactionResponse {
  id: string;
  type: TransactionType;
  transactionDate: string;
  amount: number;
  categoryName: string;
  note: string | null;
  createdAt: string;
}

export interface BatchCreateTransactionsResponse {
  transactions: TransactionResponse[];
}

export interface HistoryTransactionsResponse {
  transactions: TransactionResponse[];
  page: number;
  size: number;
  hasNext: boolean;
}

export interface CategorySummaryResponse {
  categoryName: string;
  amount: number;
  percentage: number;
}

export interface HistoryTrendPointResponse {
  label: string;
  amount: number;
  cumulativeAmount: number;
}

interface TransactionJoinRow {
  id: string;
  type: TransactionType;
  transaction_date: string;
  amount: string | number;
  note: string | null;
  created_at: string;
  categories: {
    name: string;
  } | null;
}

export class TransactionNotFoundError extends Error {
  constructor() {
    super('Transaction not found');
    this.name = 'TransactionNotFoundError';
  }
}

const DEFAULT_RECENT_LIMIT = 5;
const MAX_RECENT_LIMIT = 15;
const DEFAULT_HISTORY_SIZE = 10;
const MAX_HISTORY_SIZE = 20;
const PERCENTAGE_MULTIPLIER = 100;
const APP_TIME_ZONE = 'Asia/Taipei';

export async function listCategorySummaries(
  supabase: SupabaseClient,
  user: AuthenticatedUser,
  type: TransactionType,
  startDate: string,
  endDate: string
): Promise<CategorySummaryResponse[]> {
  const transactions = await selectTransactions(supabase, user, {
    type,
    startDate,
    endDate
  });
  const totals = new Map<string, number>();
  for (const row of transactions) {
    const categoryName = row.categories?.name ?? '';
    totals.set(categoryName, (totals.get(categoryName) ?? 0) + Number(row.amount));
  }
  const totalAmount = [...totals.values()].reduce((sum, value) => sum + value, 0);
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([categoryName, amount]) => ({
      categoryName,
      amount,
      percentage: calculatePercentage(amount, totalAmount)
    }));
}

export async function listHistoryTrend(
  supabase: SupabaseClient,
  user: AuthenticatedUser,
  type: TransactionType,
  startDate: string,
  endDate: string
): Promise<HistoryTrendPointResponse[]> {
  const sameMonth = startDate.slice(0, 7) === endDate.slice(0, 7);
  const transactions = await selectTransactions(supabase, user, {
    type,
    startDate,
    endDate
  });
  const amountByLabel = new Map<string, number>();
  for (const row of transactions) {
    const label = sameMonth ? row.transaction_date : row.transaction_date.slice(0, 7);
    amountByLabel.set(label, (amountByLabel.get(label) ?? 0) + Number(row.amount));
  }
  return buildCumulativeTrend([...amountByLabel.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, amount]) => ({ label, amount })));
}

export async function listAnnualCashFlowTrend(
  supabase: SupabaseClient,
  user: AuthenticatedUser,
  year: number,
  today = new Date()
): Promise<HistoryTrendPointResponse[]> {
  const todayText = formatAppDate(today);
  const todayYear = Number(todayText.slice(0, 4));
  const endMonth = getAnnualTrendEndMonth(year, todayYear, Number(todayText.slice(5, 7)));
  if (endMonth === 0) {
    return [];
  }

  const startDate = `${year}-01-01`;
  const endDate = year === todayYear
    ? todayText
    : `${year}-${String(endMonth).padStart(2, '0')}-${getMonthLastDay(year, endMonth)}`;
  const transactions = await selectTransactions(supabase, user, { startDate, endDate });
  const amountByLabel = new Map<string, number>();
  for (const row of transactions) {
    const label = row.transaction_date.slice(0, 7);
    const signedAmount = row.type === 'INCOME' ? Number(row.amount) : -Number(row.amount);
    amountByLabel.set(label, (amountByLabel.get(label) ?? 0) + signedAmount);
  }

  let cumulativeAmount = 0;
  const responses: HistoryTrendPointResponse[] = [];
  for (let month = 1; month <= endMonth; month += 1) {
    const label = `${year}-${String(month).padStart(2, '0')}`;
    const amount = amountByLabel.get(label) ?? 0;
    cumulativeAmount += amount;
    responses.push({ label, amount, cumulativeAmount });
  }
  return responses;
}

export async function listHistoryTransactions(
  supabase: SupabaseClient,
  user: AuthenticatedUser,
  type: TransactionType,
  startDate: string,
  endDate: string,
  page: number,
  size: number
): Promise<HistoryTransactionsResponse> {
  const queryLimit = size + 1;
  const from = page * size;
  const to = from + queryLimit - 1;
  const rows = await selectTransactions(supabase, user, {
    type,
    startDate,
    endDate,
    from,
    to,
    orderByTransactionDateDesc: true
  });
  return {
    transactions: rows.slice(0, size).map(transactionRowToResponse),
    page,
    size,
    hasNext: rows.length > size
  };
}

export async function listRecentTransactions(
  supabase: SupabaseClient,
  user: AuthenticatedUser,
  limit: number,
  today = new Date()
): Promise<TransactionResponse[]> {
  const todayText = formatAppDate(today);
  const rows = await selectTransactions(supabase, user, {
    startDate: todayText,
    endDate: todayText
  });
  return rows
    .map(transactionRowToResponse)
    .sort((left, right) => left.categoryName.localeCompare(right.categoryName, 'zh-Hant')
      || right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

export async function updateTransaction(
  supabase: SupabaseClient,
  user: AuthenticatedUser,
  id: string,
  body: unknown,
  now = new Date()
): Promise<TransactionResponse> {
  const currentTransaction = await getRequiredTransaction(supabase, user, id);
  const transaction = validateUpdateTransactionRequest(body, now);
  const categoryId = await getOrCreateCategoryId(
    supabase,
    user,
    transaction.type,
    transaction.categoryName,
    now.toISOString()
  );

  const { error } = await supabase
    .from('accounting_transactions')
    .update({
      type: transaction.type,
      transaction_date: transaction.transactionDate,
      amount: transaction.amount,
      category_id: categoryId,
      note: transaction.note
    })
    .eq('id', id)
    .eq('user_id', user.userId);
  if (error) {
    throw error;
  }

  return {
    id,
    type: transaction.type,
    transactionDate: transaction.transactionDate,
    amount: transaction.amount,
    categoryName: transaction.categoryName,
    note: transaction.note,
    createdAt: currentTransaction.createdAt
  };
}

export async function deleteTransaction(
  supabase: SupabaseClient,
  user: AuthenticatedUser,
  id: string
): Promise<void> {
  await getRequiredTransaction(supabase, user, id);
  const { error } = await supabase
    .from('accounting_transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.userId);
  if (error) {
    throw error;
  }
}

async function getRequiredTransaction(
  supabase: SupabaseClient,
  user: AuthenticatedUser,
  id: string
): Promise<TransactionResponse> {
  const { data, error } = await supabase
    .from('accounting_transactions')
    .select('id,type,transaction_date,amount,note,created_at,categories(name)')
    .eq('id', id)
    .eq('user_id', user.userId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new TransactionNotFoundError();
  }
  return transactionRowToResponse(data as unknown as TransactionJoinRow);
}

async function selectTransactions(
  supabase: SupabaseClient,
  user: AuthenticatedUser,
  options: {
    type?: TransactionType;
    startDate?: string;
    endDate?: string;
    from?: number;
    to?: number;
    orderByTransactionDateDesc?: boolean;
    orderByCreatedAtDesc?: boolean;
  }
): Promise<TransactionJoinRow[]> {
  let query = supabase
    .from('accounting_transactions')
    .select('id,type,transaction_date,amount,note,created_at,categories(name)')
    .eq('user_id', user.userId);
  if (options.type) {
    query = query.eq('type', options.type);
  }
  if (options.startDate) {
    query = query.gte('transaction_date', options.startDate);
  }
  if (options.endDate) {
    query = query.lte('transaction_date', options.endDate);
  }
  if (options.orderByCreatedAtDesc) {
    query = query.order('created_at', { ascending: false });
  } else if (options.orderByTransactionDateDesc) {
    query = query.order('transaction_date', { ascending: false }).order('created_at', { ascending: false });
  }
  if (options.from !== undefined && options.to !== undefined) {
    query = query.range(options.from, options.to);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data ?? []) as unknown as TransactionJoinRow[];
}

export function parseRequiredDate(params: URLSearchParams, name: string): string {
  const value = params.get(name);
  if (value === null || value.trim() === '') {
    throw new RangeError(`${name} is required`);
  }
  return validateDateValue(value, name);
}

export function parseOptionalDate(params: URLSearchParams, name: string): string | undefined {
  const value = params.get(name);
  if (value === null || value.trim() === '') {
    return undefined;
  }
  return validateDateValue(value, name);
}

export function resolveSummaryDateRange(
  startDate: string | undefined,
  endDate: string | undefined,
  now = new Date()
): { startDate: string; endDate: string } {
  if ((startDate === undefined && endDate !== undefined) || (startDate !== undefined && endDate === undefined)) {
    throw new RangeError('Both startDate and endDate are required');
  }
  if (startDate !== undefined && endDate !== undefined) {
    return { startDate, endDate };
  }
  const today = formatAppDate(now);
  return { startDate: `${today.slice(0, 7)}-01`, endDate: today };
}

export function parseTrendYear(params: URLSearchParams, now = new Date()): number {
  const rawYear = params.get('year');
  if (rawYear === null || rawYear.trim() === '') {
    return Number(now.toISOString().slice(0, 4));
  }
  const year = Number(rawYear);
  if (!Number.isInteger(year)) {
    throw new RangeError('Trend year is invalid');
  }
  return year;
}

export function parseHistoryPage(params: URLSearchParams): number {
  const rawPage = params.get('page');
  if (rawPage === null || rawPage.trim() === '') {
    return 0;
  }
  const requestedPage = Number(rawPage);
  if (!Number.isInteger(requestedPage)) {
    throw new RangeError('History page is invalid');
  }
  return requestedPage < 0 ? 0 : requestedPage;
}

export function parseHistorySize(params: URLSearchParams): number {
  const rawSize = params.get('size');
  if (rawSize === null || rawSize.trim() === '') {
    return DEFAULT_HISTORY_SIZE;
  }
  const requestedSize = Number(rawSize);
  if (!Number.isInteger(requestedSize)) {
    throw new RangeError('History size is invalid');
  }
  if (requestedSize <= 0) {
    return DEFAULT_HISTORY_SIZE;
  }
  return Math.min(requestedSize, MAX_HISTORY_SIZE);
}

function transactionRowToResponse(row: TransactionJoinRow): TransactionResponse {
  return {
    id: row.id,
    type: row.type,
    transactionDate: row.transaction_date,
    amount: Number(row.amount),
    categoryName: row.categories?.name ?? '',
    note: row.note,
    createdAt: row.created_at
  };
}

function buildCumulativeTrend(rows: Array<{ label: string; amount: number }>): HistoryTrendPointResponse[] {
  let cumulativeAmount = 0;
  return rows.map((row) => {
    cumulativeAmount += row.amount;
    return { label: row.label, amount: row.amount, cumulativeAmount };
  });
}

function calculatePercentage(amount: number, totalAmount: number): number {
  if (totalAmount === 0) {
    return 0;
  }
  return Math.round((amount * PERCENTAGE_MULTIPLIER / totalAmount) * 100) / 100;
}

function getAnnualTrendEndMonth(year: number, todayYear: number, todayMonth: number): number {
  if (year < todayYear) {
    return 12;
  }
  if (year === todayYear) {
    return todayMonth;
  }
  return 0;
}

function getMonthLastDay(year: number, month: number): string {
  return String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, '0');
}

export function parseRecentLimit(params: URLSearchParams): number {
  const rawLimit = params.get('limit');
  if (rawLimit === null || rawLimit.trim() === '') {
    return DEFAULT_RECENT_LIMIT;
  }
  const requestedLimit = Number(rawLimit);
  if (!Number.isInteger(requestedLimit)) {
    throw new RangeError('Recent limit is invalid');
  }
  if (requestedLimit <= 0) {
    return DEFAULT_RECENT_LIMIT;
  }
  return Math.min(requestedLimit, MAX_RECENT_LIMIT);
}

export function validateUpdateTransactionRequest(body: unknown, now = new Date()): ValidatedCreateTransaction {
  return validateTransactionPayload(body, 0, now);
}

export async function createBatchTransactions(
  supabase: SupabaseClient,
  user: AuthenticatedUser,
  body: unknown,
  now = new Date()
): Promise<BatchCreateTransactionsResponse> {
  const transactions = validateBatchCreateRequest(body, now);
  const quickAddMetadata = validateQuickAddBatchMetadata(body);
  const createdAt = now.toISOString();
  const responses: TransactionResponse[] = [];
  const createdFeedbackRequests: Array<{
    transactionId: string;
    transaction: ValidatedCreateTransaction;
  }> = [];
  for (const transaction of transactions) {
    const categoryId = await getOrCreateCategoryId(supabase, user, transaction.type, transaction.categoryName, createdAt);
    const transactionId = crypto.randomUUID();
    const { error } = await supabase
      .from('accounting_transactions')
      .insert({
        id: transactionId,
        user_id: user.userId,
        type: transaction.type,
        transaction_date: transaction.transactionDate,
        amount: transaction.amount,
        category_id: categoryId,
        note: transaction.note,
        created_at: createdAt
      });
    if (error) {
      throw error;
    }
    createdFeedbackRequests.push({ transactionId, transaction });
    responses.push({
      id: transactionId,
      type: transaction.type,
      transactionDate: transaction.transactionDate,
      amount: transaction.amount,
      categoryName: transaction.categoryName,
      note: transaction.note,
      createdAt: createdAt
    });
  }
  for (const feedbackRequest of createdFeedbackRequests) {
    await insertAiQuickAddFeedback(
      supabase,
      user,
      feedbackRequest.transactionId,
      feedbackRequest.transaction,
      quickAddMetadata,
      createdAt
    );
  }
  return { transactions: responses };
}

export function validateBatchCreateRequest(body: unknown, now = new Date()): ValidatedCreateTransaction[] {
  if (!isRecord(body) || !Array.isArray(body.transactions) || body.transactions.length === 0) {
    throw new RangeError('Transactions are required');
  }
  return body.transactions.map((transaction, index) => validateTransactionPayload(transaction, index, now));
}

async function getOrCreateCategoryId(
  supabase: SupabaseClient,
  user: AuthenticatedUser,
  type: TransactionType,
  categoryName: string,
  createdAt: string
): Promise<string> {
  const { data: userCategory, error: userCategoryError } = await supabase
    .from('categories')
    .select('id')
    .eq('type', type)
    .eq('name', categoryName)
    .eq('user_id', user.userId)
    .maybeSingle();
  if (userCategoryError) {
    throw userCategoryError;
  }
  if (userCategory?.id) {
    return userCategory.id as string;
  }

  const { data: defaultCategory, error: defaultCategoryError } = await supabase
    .from('categories')
    .select('id')
    .eq('type', type)
    .eq('name', categoryName)
    .is('user_id', null)
    .maybeSingle();
  if (defaultCategoryError) {
    throw defaultCategoryError;
  }
  if (defaultCategory?.id) {
    return defaultCategory.id as string;
  }

  const categoryId = crypto.randomUUID();
  const { error: insertError } = await supabase
    .from('categories')
    .insert({
      id: categoryId,
      user_id: user.userId,
      type,
      name: categoryName,
      default_category: false,
      created_at: createdAt
    });
  if (insertError) {
    throw insertError;
  }
  return categoryId;
}

function validateTransactionPayload(
  transaction: unknown,
  index: number,
  now: Date
): ValidatedCreateTransaction {
  if (!isRecord(transaction)) {
    throw new RangeError(`Transaction ${index + 1} is invalid`);
  }
  const type = validateType(transaction.type, index);
  const transactionDate = validateTransactionDate(transaction.transactionDate, index, now);
  const amount = validateAmount(transaction.amount, index);
  const categoryName = validateCategoryName(transaction.categoryName, index);
  const note = validateNote(transaction.note, index);
  const validatedTransaction: ValidatedCreateTransaction = { type, transactionDate, amount, categoryName, note };
  const aiSuggestion = validateAiSuggestionMetadata(transaction.aiSuggestion, index);
  if (aiSuggestion) {
    validatedTransaction.aiSuggestion = aiSuggestion;
  }
  return validatedTransaction;
}

function validateQuickAddBatchMetadata(body: unknown): QuickAddBatchMetadata {
  if (!isRecord(body)) {
    return {};
  }
  const metadata: QuickAddBatchMetadata = {};
  if (typeof body.quickAddSessionId === 'string' && body.quickAddSessionId.trim() !== '') {
    metadata.quickAddSessionId = body.quickAddSessionId.trim();
  }
  if (typeof body.quickAddInputText === 'string' && body.quickAddInputText.trim() !== '') {
    metadata.quickAddInputText = body.quickAddInputText.trim();
  }
  return metadata;
}

function validateAiSuggestionMetadata(aiSuggestion: unknown, index: number): AiSuggestionMetadata | undefined {
  if (aiSuggestion === undefined || aiSuggestion === null) {
    return undefined;
  }
  if (!isRecord(aiSuggestion)) {
    throw new RangeError(`Transaction ${index + 1} AI suggestion is invalid`);
  }
  const modelType = validateAiSuggestionType(aiSuggestion.modelType, index);
  const mappedType = validateAiSuggestionType(aiSuggestion.mappedType, index);
  return {
    suggestionId: validateAiSuggestionString(aiSuggestion.suggestionId, index, 'suggestionId'),
    sourceText: validateAiSuggestionString(aiSuggestion.sourceText, index, 'sourceText'),
    itemText: validateAiSuggestionString(aiSuggestion.itemText, index, 'itemText'),
    modelLabel: validateAiSuggestionString(aiSuggestion.modelLabel, index, 'modelLabel'),
    modelType,
    modelCategory: validateAiSuggestionString(aiSuggestion.modelCategory, index, 'modelCategory'),
    mappedType,
    mappedCategoryName: validateAiSuggestionString(aiSuggestion.mappedCategoryName, index, 'mappedCategoryName'),
    suggestedTransactionDate: validateAiSuggestionDate(aiSuggestion.suggestedTransactionDate, index),
    suggestedAmount: validateAiSuggestionAmount(aiSuggestion.suggestedAmount, index),
    suggestedNote: validateAiSuggestionNote(aiSuggestion.suggestedNote, index),
    confidence: validateAiSuggestionConfidence(aiSuggestion.confidence, index),
    needsReview: validateAiSuggestionBoolean(aiSuggestion.needsReview, index, 'needsReview'),
    dateSource: validateAiSuggestionString(aiSuggestion.dateSource, index, 'dateSource'),
    mappingSource: validateAiSuggestionString(aiSuggestion.mappingSource, index, 'mappingSource')
  };
}

function validateAiSuggestionType(value: unknown, index: number): TransactionType {
  if (value === 'INCOME' || value === 'EXPENSE') {
    return value;
  }
  throw new RangeError(`Transaction ${index + 1} AI suggestion type is invalid`);
}

function validateAiSuggestionString(value: unknown, index: number, fieldName: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new RangeError(`Transaction ${index + 1} AI suggestion ${fieldName} is invalid`);
  }
  return value.trim();
}

function validateAiSuggestionDate(value: unknown, index: number): string {
  if (typeof value !== 'string') {
    throw new RangeError(`Transaction ${index + 1} AI suggestion date is invalid`);
  }
  return validateDateValue(value, `Transaction ${index + 1} AI suggestion date`);
}

function validateAiSuggestionAmount(value: unknown, index: number): number {
  const amount = typeof value === 'string' ? Number(value) : value;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    throw new RangeError(`Transaction ${index + 1} AI suggestion amount is invalid`);
  }
  return amount;
}

function validateAiSuggestionConfidence(value: unknown, index: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`Transaction ${index + 1} AI suggestion confidence is invalid`);
  }
  return value;
}

function validateAiSuggestionBoolean(value: unknown, index: number, fieldName: string): boolean {
  if (typeof value !== 'boolean') {
    throw new RangeError(`Transaction ${index + 1} AI suggestion ${fieldName} is invalid`);
  }
  return value;
}

function validateAiSuggestionNote(value: unknown, index: number): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new RangeError(`Transaction ${index + 1} AI suggestion note is invalid`);
  }
  return value.trim() === '' ? null : value.trim();
}

async function insertAiQuickAddFeedback(
  supabase: SupabaseClient,
  user: AuthenticatedUser,
  transactionId: string,
  transaction: ValidatedCreateTransaction,
  quickAddMetadata: QuickAddBatchMetadata,
  createdAt: string
): Promise<void> {
  const row = buildAiQuickAddFeedbackRow({
    id: crypto.randomUUID(),
    userId: user.userId,
    transactionId,
    quickAddSessionId: quickAddMetadata.quickAddSessionId,
    quickAddInputText: quickAddMetadata.quickAddInputText,
    transaction,
    createdAt
  });
  if (!row) {
    return;
  }
  await supabase
    .from('ai_quick_add_feedback')
    .insert(row);
}

function validateType(type: unknown, index: number): TransactionType {
  if (type === 'INCOME' || type === 'EXPENSE') {
    return type;
  }
  throw new RangeError(`Transaction ${index + 1} type is invalid`);
}

function validateTransactionDate(transactionDate: unknown, index: number, now: Date): string {
  if (typeof transactionDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
    throw new RangeError(`Transaction ${index + 1} date is invalid`);
  }
  validateDateValue(transactionDate, `Transaction ${index + 1} date`);
  return transactionDate;
}

function formatAppDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}

function validateDateValue(dateValue: string, fieldName: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    throw new RangeError(`${fieldName} is invalid`);
  }
  const parsedDate = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime()) || dateValue !== parsedDate.toISOString().slice(0, 10)) {
    throw new RangeError(`${fieldName} is invalid`);
  }
  return dateValue;
}

function validateAmount(amount: unknown, index: number): number {
  const normalizedAmount = typeof amount === 'string' ? Number(amount) : amount;
  if (typeof normalizedAmount !== 'number' || !Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new RangeError(`Transaction ${index + 1} amount must be greater than 0`);
  }
  return normalizedAmount;
}

function validateCategoryName(categoryName: unknown, index: number): string {
  if (typeof categoryName !== 'string') {
    throw new RangeError(`Transaction ${index + 1} category is required`);
  }
  const normalizedCategoryName = categoryName.trim();
  if (normalizedCategoryName === '') {
    throw new RangeError(`Transaction ${index + 1} category is required`);
  }
  if (normalizedCategoryName.length > 64) {
    throw new RangeError(`Transaction ${index + 1} category is too long`);
  }
  return normalizedCategoryName;
}

function validateNote(note: unknown, index: number): string | null {
  if (note === null || note === undefined) {
    return null;
  }
  if (typeof note !== 'string') {
    throw new RangeError(`Transaction ${index + 1} note is invalid`);
  }
  const normalizedNote = note.trim();
  if (normalizedNote.length > 255) {
    throw new RangeError(`Transaction ${index + 1} note is too long`);
  }
  return normalizedNote === '' ? null : normalizedNote;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
