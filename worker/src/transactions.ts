import type { AuthenticatedUser } from './auth';
import type { TransactionType } from './categories';

interface BatchCreateTransactionsRequest {
  transactions?: CreateTransactionRequest[];
}

interface CreateTransactionRequest {
  type?: string;
  transactionDate?: string;
  amount?: unknown;
  categoryName?: string;
  note?: string | null;
}

type UpdateTransactionRequest = CreateTransactionRequest;

interface ValidatedCreateTransaction {
  type: TransactionType;
  transactionDate: string;
  amount: number;
  categoryName: string;
  note: string | null;
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

interface CategoryIdRow {
  id: string;
}

interface TransactionRow {
  id: string;
  type: TransactionType;
  transaction_date: string;
  amount: number;
  category_name: string;
  note: string | null;
  created_at: string;
}

interface CategorySummaryRow {
  category_name: string;
  amount: number;
}

interface TrendRow {
  label: string;
  amount: number;
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

/**
 * 查詢指定區間的類別摘要。
 *
 * 輸入：D1 database、已驗證使用者、類型與日期區間。
 * 輸出：類別、金額與占比清單。
 * 可能錯誤：D1 查詢失敗時由 Cloudflare D1 拋出錯誤。
 */
export async function listCategorySummaries(
  database: D1Database,
  user: AuthenticatedUser,
  type: TransactionType,
  startDate: string,
  endDate: string
): Promise<CategorySummaryResponse[]> {
  const result = await database.prepare(`
    select c.name as category_name,
           sum(t.amount) as amount
    from accounting_transactions t
    join categories c on c.id = t.category_id
    where t.user_id = ?
      and t.type = ?
      and t.transaction_date between ? and ?
    group by c.name
    order by sum(t.amount) desc, c.name asc
  `)
    .bind(user.userId, type, startDate, endDate)
    .all<CategorySummaryRow>();

  const totalAmount = result.results.reduce((total, row) => total + Number(row.amount), 0);
  return result.results.map((row) => ({
    categoryName: row.category_name,
    amount: Number(row.amount),
    percentage: calculatePercentage(Number(row.amount), totalAmount)
  }));
}

/**
 * 查詢歷史區間收入或支出趨勢。
 *
 * 輸入：D1 database、已驗證使用者、類型與日期區間。
 * 輸出：同月時日彙總，跨月時月彙總，並包含累積金額。
 * 可能錯誤：D1 查詢失敗時由 Cloudflare D1 拋出錯誤。
 */
export async function listHistoryTrend(
  database: D1Database,
  user: AuthenticatedUser,
  type: TransactionType,
  startDate: string,
  endDate: string
): Promise<HistoryTrendPointResponse[]> {
  const sameMonth = startDate.slice(0, 7) === endDate.slice(0, 7);
  const result = await database.prepare(sameMonth ? `
    select t.transaction_date as label,
           sum(t.amount) as amount
    from accounting_transactions t
    where t.user_id = ?
      and t.type = ?
      and t.transaction_date between ? and ?
    group by t.transaction_date
    order by t.transaction_date asc
  ` : `
    select substr(t.transaction_date, 1, 7) as label,
           sum(t.amount) as amount
    from accounting_transactions t
    where t.user_id = ?
      and t.type = ?
      and t.transaction_date between ? and ?
    group by substr(t.transaction_date, 1, 7)
    order by substr(t.transaction_date, 1, 7) asc
  `)
    .bind(user.userId, type, startDate, endDate)
    .all<TrendRow>();

  return buildCumulativeTrend(result.results);
}

/**
 * 查詢年度每月總現金流與累積總現金流。
 *
 * 輸入：D1 database、已驗證使用者、年份與今天日期。
 * 輸出：指定年度每月淨現金流與累積金額。
 * 可能錯誤：D1 查詢失敗時由 Cloudflare D1 拋出錯誤。
 */
export async function listAnnualCashFlowTrend(
  database: D1Database,
  user: AuthenticatedUser,
  year: number,
  today = new Date()
): Promise<HistoryTrendPointResponse[]> {
  const todayText = today.toISOString().slice(0, 10);
  const todayYear = Number(todayText.slice(0, 4));
  const endMonth = getAnnualTrendEndMonth(year, todayYear, Number(todayText.slice(5, 7)));
  if (endMonth === 0) {
    return [];
  }

  const startDate = `${year}-01-01`;
  const endDate = `${year}-${String(endMonth).padStart(2, '0')}-${getMonthLastDay(year, endMonth)}`;
  const result = await database.prepare(`
    select substr(t.transaction_date, 1, 7) as label,
           sum(case when t.type = 'INCOME' then t.amount else -t.amount end) as amount
    from accounting_transactions t
    where t.user_id = ?
      and t.transaction_date between ? and ?
    group by substr(t.transaction_date, 1, 7)
    order by substr(t.transaction_date, 1, 7) asc
  `)
    .bind(user.userId, startDate, endDate)
    .all<TrendRow>();

  const amountByLabel = new Map(result.results.map((row) => [row.label, Number(row.amount)]));
  let cumulativeAmount = 0;
  const responses: HistoryTrendPointResponse[] = [];
  for (let month = 1; month <= endMonth; month += 1) {
    const label = `${year}-${String(month).padStart(2, '0')}`;
    const amount = amountByLabel.get(label) ?? 0;
    cumulativeAmount += amount;
    responses.push({
      label,
      amount,
      cumulativeAmount
    });
  }
  return responses;
}

/**
 * 查詢歷史查看頁明細。
 *
 * 輸入：D1 database、已驗證使用者、類型、日期區間、頁碼與每頁筆數。
 * 輸出：依帳目日期由新到舊排序的明細與下一頁狀態。
 * 可能錯誤：D1 查詢失敗時由 Cloudflare D1 拋出錯誤。
 */
export async function listHistoryTransactions(
  database: D1Database,
  user: AuthenticatedUser,
  type: TransactionType,
  startDate: string,
  endDate: string,
  page: number,
  size: number
): Promise<HistoryTransactionsResponse> {
  const queryLimit = size + 1;
  const offset = page * size;
  const result = await database.prepare(`
    select t.id,
           t.type,
           t.transaction_date,
           t.amount,
           c.name as category_name,
           t.note,
           t.created_at
    from accounting_transactions t
    join categories c on c.id = t.category_id
    where t.user_id = ?
      and t.type = ?
      and t.transaction_date between ? and ?
    order by t.transaction_date desc, t.created_at desc
    limit ?
    offset ?
  `)
    .bind(user.userId, type, startDate, endDate, queryLimit, offset)
    .all<TransactionRow>();

  const rows = result.results.slice(0, size);
  return {
    transactions: rows.map(transactionRowToResponse),
    page,
    size,
    hasNext: result.results.length > size
  };
}

/**
 * 查詢首頁最近明細。
 *
 * 輸入：D1 database、已驗證使用者與每頁筆數。
 * 輸出：依建立日期由新到舊排序的最近明細。
 * 可能錯誤：D1 查詢失敗時由 Cloudflare D1 拋出錯誤。
 */
export async function listRecentTransactions(
  database: D1Database,
  user: AuthenticatedUser,
  limit: number
): Promise<TransactionResponse[]> {
  const result = await database.prepare(`
    select t.id,
           t.type,
           t.transaction_date,
           t.amount,
           c.name as category_name,
           t.note,
           t.created_at
    from accounting_transactions t
    join categories c on c.id = t.category_id
    where t.user_id = ?
    order by t.created_at desc
    limit ?
  `)
    .bind(user.userId, limit)
    .all<TransactionRow>();

  return result.results.map(transactionRowToResponse);
}

/**
 * 更新單筆帳目。
 *
 * 輸入：D1 database、已驗證使用者、帳目 ID、request body 與目前時間。
 * 輸出：更新後帳目 response。
 * 可能錯誤：資料不存在時拋出 TransactionNotFoundError，欄位不合法時拋出 RangeError。
 */
export async function updateTransaction(
  database: D1Database,
  user: AuthenticatedUser,
  id: string,
  body: unknown,
  now = new Date()
): Promise<TransactionResponse> {
  const currentTransaction = await getRequiredTransaction(database, user, id);
  const transaction = validateUpdateTransactionRequest(body, now);
  const categoryId = await getOrCreateCategoryId(
    database,
    user,
    transaction.type,
    transaction.categoryName,
    now.toISOString()
  );

  await database.prepare(`
    update accounting_transactions
    set type = ?,
        transaction_date = ?,
        amount = ?,
        category_id = ?,
        note = ?
    where id = ?
      and user_id = ?
  `)
    .bind(
      transaction.type,
      transaction.transactionDate,
      transaction.amount,
      categoryId,
      transaction.note,
      id,
      user.userId
    )
    .run();

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

/**
 * 刪除單筆帳目。
 *
 * 輸入：D1 database、已驗證使用者與帳目 ID。
 * 輸出：無。
 * 可能錯誤：資料不存在時拋出 TransactionNotFoundError。
 */
export async function deleteTransaction(
  database: D1Database,
  user: AuthenticatedUser,
  id: string
): Promise<void> {
  await getRequiredTransaction(database, user, id);
  await database.prepare(`
    delete from accounting_transactions
    where id = ?
      and user_id = ?
  `)
    .bind(id, user.userId)
    .run();
}

/**
 * 查詢目前使用者的必要帳目。
 *
 * 輸入：D1 database、已驗證使用者與帳目 ID。
 * 輸出：帳目 response。
 * 可能錯誤：資料不存在時拋出 TransactionNotFoundError。
 */
async function getRequiredTransaction(
  database: D1Database,
  user: AuthenticatedUser,
  id: string
): Promise<TransactionResponse> {
  const row = await database.prepare(`
    select t.id,
           t.type,
           t.transaction_date,
           t.amount,
           c.name as category_name,
           t.note,
           t.created_at
    from accounting_transactions t
    join categories c on c.id = t.category_id
    where t.id = ?
      and t.user_id = ?
    limit 1
  `)
    .bind(id, user.userId)
    .first<TransactionRow>();

  if (!row) {
    throw new TransactionNotFoundError();
  }
  return transactionRowToResponse(row);
}

/**
 * 解析歷史查詢日期。
 *
 * 輸入：URLSearchParams 與參數名稱。
 * 輸出：YYYY-MM-DD 日期字串。
 * 可能錯誤：日期缺失或格式錯誤時拋出 RangeError。
 */
export function parseRequiredDate(params: URLSearchParams, name: string): string {
  const value = params.get(name);
  if (value === null || value.trim() === '') {
    throw new RangeError(`${name} is required`);
  }
  return validateDateValue(value, name);
}

/**
 * 解析可選日期。
 *
 * 輸入：URLSearchParams 與參數名稱。
 * 輸出：日期未指定時回傳 undefined，已指定時回傳合法 YYYY-MM-DD。
 * 可能錯誤：日期格式錯誤時拋出 RangeError。
 */
export function parseOptionalDate(params: URLSearchParams, name: string): string | undefined {
  const value = params.get(name);
  if (value === null || value.trim() === '') {
    return undefined;
  }
  return validateDateValue(value, name);
}

/**
 * 解析統計查詢日期區間。
 *
 * 輸入：可選起訖日期與目前日期。
 * 輸出：完整起訖日期，未指定時預設本月第一天至今天。
 * 可能錯誤：只指定單邊日期時拋出 RangeError。
 */
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

  const today = now.toISOString().slice(0, 10);
  return {
    startDate: `${today.slice(0, 7)}-01`,
    endDate: today
  };
}

/**
 * 解析年度現金流趨勢年份。
 *
 * 輸入：URLSearchParams 中的 year 參數與目前日期。
 * 輸出：指定年份或今年。
 * 可能錯誤：year 不是整數時拋出 RangeError。
 */
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

/**
 * 解析歷史查詢頁碼。
 *
 * 輸入：URLSearchParams 中的 page 參數。
 * 輸出：合法頁碼，未指定或小於 0 時回傳 0。
 * 可能錯誤：page 不是整數時拋出 RangeError。
 */
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

/**
 * 解析歷史查詢每頁筆數。
 *
 * 輸入：URLSearchParams 中的 size 參數。
 * 輸出：合法每頁筆數，未指定或小於等於 0 時回傳 10，最大不超過 20。
 * 可能錯誤：size 不是整數時拋出 RangeError。
 */
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

/**
 * 將資料庫明細 row 轉成 API response。
 *
 * 輸入：D1 查詢 row。
 * 輸出：前端使用的交易明細 response。
 * 可能錯誤：無。
 */
function transactionRowToResponse(row: TransactionRow): TransactionResponse {
  return {
    id: row.id,
    type: row.type,
    transactionDate: row.transaction_date,
    amount: row.amount,
    categoryName: row.category_name,
    note: row.note,
    createdAt: row.created_at
  };
}

/**
 * 建立累積趨勢回應。
 *
 * 輸入：已依時間排序的趨勢 row。
 * 輸出：含累積金額的趨勢點。
 * 可能錯誤：無。
 */
function buildCumulativeTrend(rows: TrendRow[]): HistoryTrendPointResponse[] {
  let cumulativeAmount = 0;
  return rows.map((row) => {
    const amount = Number(row.amount);
    cumulativeAmount += amount;
    return {
      label: row.label,
      amount,
      cumulativeAmount
    };
  });
}

/**
 * 計算占比。
 *
 * 輸入：單項金額與總金額。
 * 輸出：四捨五入到小數兩位的百分比。
 * 可能錯誤：無。
 */
function calculatePercentage(amount: number, totalAmount: number): number {
  if (totalAmount === 0) {
    return 0;
  }
  return Math.round((amount * PERCENTAGE_MULTIPLIER / totalAmount) * 100) / 100;
}

/**
 * 決定年度趨勢結束月份。
 *
 * 輸入：查詢年份、今天年份與今天月份。
 * 輸出：過去年份為 12，今年為當月，未來年份為 0。
 * 可能錯誤：無。
 */
function getAnnualTrendEndMonth(year: number, todayYear: number, todayMonth: number): number {
  if (year < todayYear) {
    return 12;
  }
  if (year === todayYear) {
    return todayMonth;
  }
  return 0;
}

/**
 * 取得月份最後一天。
 *
 * 輸入：年份與月份。
 * 輸出：兩位數日期字串。
 * 可能錯誤：無。
 */
function getMonthLastDay(year: number, month: number): string {
  return String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, '0');
}

/**
 * 解析首頁最近明細筆數。
 *
 * 輸入：URLSearchParams 中的 limit 參數。
 * 輸出：合法筆數，未指定或小於等於 0 時回傳預設值，最大不超過 15。
 * 可能錯誤：limit 不是整數時拋出 RangeError。
 */
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

/**
 * 驗證更新帳目 request。
 *
 * 輸入：未信任的 request body 與目前日期。
 * 輸出：已正規化的更新帳目。
 * 可能錯誤：欄位缺失、格式錯誤、日期晚於今天或金額不大於 0 時拋出 RangeError。
 */
export function validateUpdateTransactionRequest(body: unknown, now = new Date()): ValidatedCreateTransaction {
  return validateTransactionPayload(body, 0, now);
}

/**
 * 建立批次帳目。
 *
 * 輸入：D1 database、已驗證使用者、request body 與目前時間。
 * 輸出：本次建立的帳目 response。
 * 可能錯誤：request 不合法、D1 寫入失敗或批次資料無法完整寫入時拋出錯誤。
 */
export async function createBatchTransactions(
  database: D1Database,
  user: AuthenticatedUser,
  body: unknown,
  now = new Date()
): Promise<BatchCreateTransactionsResponse> {
  const transactions = validateBatchCreateRequest(body, now);
  const createdAt = now.toISOString();
  const statements: D1PreparedStatement[] = [];
  const responses: TransactionResponse[] = [];
  const categoryIdByTypeAndName = new Map<string, string>();

  for (const transaction of transactions) {
    const categoryId = await getOrCreateCategory(
      database,
      user,
      transaction,
      createdAt,
      statements,
      categoryIdByTypeAndName
    );
    const transactionId = crypto.randomUUID();
    statements.push(database.prepare(`
      insert into accounting_transactions (
        id,
        user_id,
        type,
        transaction_date,
        amount,
        category_id,
        note,
        created_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        transactionId,
        user.userId,
        transaction.type,
        transaction.transactionDate,
        transaction.amount,
        categoryId,
        transaction.note,
        createdAt
      ));
    responses.push({
      id: transactionId,
      type: transaction.type,
      transactionDate: transaction.transactionDate,
      amount: transaction.amount,
      categoryName: transaction.categoryName,
      note: transaction.note,
      createdAt
    });
  }

  // TODO(高): 正式上線前需用真實 D1 驗證 batch 失敗時是否符合整批 rollback 規格。
  await database.batch(statements);

  return {
    transactions: responses
  };
}

/**
 * 驗證批次新增 request。
 *
 * 輸入：未信任的 request body 與目前日期。
 * 輸出：已正規化的新增帳目清單。
 * 可能錯誤：任一列缺必填、格式錯誤、日期晚於今天或金額不大於 0 時拋出 RangeError。
 */
export function validateBatchCreateRequest(body: unknown, now = new Date()): ValidatedCreateTransaction[] {
  if (!isRecord(body) || !Array.isArray(body.transactions) || body.transactions.length === 0) {
    throw new RangeError('Transactions are required');
  }

  return body.transactions.map((transaction, index) => validateTransactionPayload(transaction, index, now));
}

/**
 * 查詢或建立類別。
 *
 * 輸入：D1 database、使用者、帳目資料、建立時間與待執行 statements。
 * 輸出：可見類別 ID。
 * 可能錯誤：D1 查詢失敗時由 Cloudflare D1 拋出錯誤。
 */
async function getOrCreateCategory(
  database: D1Database,
  user: AuthenticatedUser,
  transaction: ValidatedCreateTransaction,
  createdAt: string,
  statements: D1PreparedStatement[],
  categoryIdByTypeAndName: Map<string, string>
): Promise<string> {
  const cacheKey = `${transaction.type}:${transaction.categoryName}`;
  const cachedCategoryId = categoryIdByTypeAndName.get(cacheKey);
  if (cachedCategoryId) {
    return cachedCategoryId;
  }

  const categoryId = await getOrCreateCategoryId(
    database,
    user,
    transaction.type,
    transaction.categoryName,
    createdAt,
    statements
  );
  categoryIdByTypeAndName.set(cacheKey, categoryId);
  return categoryId;
}

/**
 * 查詢或建立類別 ID。
 *
 * 輸入：D1 database、使用者、類型、類別名稱、建立時間與可選批次 statements。
 * 輸出：可見類別 ID。
 * 可能錯誤：D1 查詢或寫入失敗時由 Cloudflare D1 拋出錯誤。
 */
async function getOrCreateCategoryId(
  database: D1Database,
  user: AuthenticatedUser,
  type: TransactionType,
  categoryName: string,
  createdAt: string,
  statements?: D1PreparedStatement[]
): Promise<string> {
  const existingCategory = await database.prepare(`
    select id
    from categories
    where type = ?
      and name = ?
      and (user_id = ? or user_id is null)
    order by default_category desc
    limit 1
  `)
    .bind(type, categoryName, user.userId)
    .first<CategoryIdRow>();

  if (existingCategory?.id) {
    return existingCategory.id;
  }

  const categoryId = crypto.randomUUID();
  const statement = database.prepare(`
    insert into categories (
      id,
      user_id,
      type,
      name,
      default_category,
      created_at
    )
    values (?, ?, ?, ?, 0, ?)
  `)
    .bind(categoryId, user.userId, type, categoryName, createdAt);
  if (statements) {
    statements.push(statement);
  } else {
    await statement.run();
  }
  return categoryId;
}

/**
 * 驗證單筆帳目 payload。
 *
 * 輸入：未信任的單筆資料、列 index 與目前日期。
 * 輸出：已正規化的帳目。
 * 可能錯誤：欄位不合法時拋出 RangeError。
 */
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

  return {
    type,
    transactionDate,
    amount,
    categoryName,
    note
  };
}

/**
 * 驗證收支類型。
 *
 * 輸入：未知 type 值與列 index。
 * 輸出：合法收支類型。
 * 可能錯誤：type 缺失或不合法時拋出 RangeError。
 */
function validateType(type: unknown, index: number): TransactionType {
  if (type === 'INCOME' || type === 'EXPENSE') {
    return type;
  }
  throw new RangeError(`Transaction ${index + 1} type is invalid`);
}

/**
 * 驗證帳目日期。
 *
 * 輸入：未知日期值、列 index 與目前日期。
 * 輸出：YYYY-MM-DD 日期字串。
 * 可能錯誤：日期缺失、格式錯誤或晚於今天時拋出 RangeError。
 */
function validateTransactionDate(transactionDate: unknown, index: number, now: Date): string {
  if (typeof transactionDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
    throw new RangeError(`Transaction ${index + 1} date is invalid`);
  }

  validateDateValue(transactionDate, `Transaction ${index + 1} date`);

  const today = now.toISOString().slice(0, 10);
  if (transactionDate > today) {
    throw new RangeError(`Transaction ${index + 1} date cannot be in the future`);
  }

  return transactionDate;
}

/**
 * 驗證日期字串是否為實際存在的 YYYY-MM-DD。
 *
 * 輸入：日期字串與錯誤訊息欄位名稱。
 * 輸出：原日期字串。
 * 可能錯誤：格式錯誤或非實際日期時拋出 RangeError。
 */
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

/**
 * 驗證金額。
 *
 * 輸入：未知金額值與列 index。
 * 輸出：正數金額。
 * 可能錯誤：金額缺失、不是有限數字或不大於 0 時拋出 RangeError。
 */
function validateAmount(amount: unknown, index: number): number {
  const normalizedAmount = typeof amount === 'string' ? Number(amount) : amount;
  if (typeof normalizedAmount !== 'number' || !Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new RangeError(`Transaction ${index + 1} amount must be greater than 0`);
  }
  return normalizedAmount;
}

/**
 * 驗證類別名稱。
 *
 * 輸入：未知類別名稱與列 index。
 * 輸出：trim 後的類別名稱。
 * 可能錯誤：類別缺失或超過 64 字元時拋出 RangeError。
 */
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

/**
 * 驗證備註。
 *
 * 輸入：未知備註與列 index。
 * 輸出：trim 後備註或 null。
 * 可能錯誤：備註不是字串或超過 255 字元時拋出 RangeError。
 */
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

/**
 * 判斷未知值是否為一般物件。
 *
 * 輸入：未知值。
 * 輸出：是否為可透過 key 存取的 record。
 * 可能錯誤：無。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
