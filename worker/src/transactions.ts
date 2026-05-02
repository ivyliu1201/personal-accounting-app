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

interface CategoryIdRow {
  id: string;
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

  return body.transactions.map((transaction, index) => validateCreateTransaction(transaction, index, now));
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

  const existingCategory = await database.prepare(`
    select id
    from categories
    where type = ?
      and name = ?
      and (user_id = ? or user_id is null)
    order by default_category desc
    limit 1
  `)
    .bind(transaction.type, transaction.categoryName, user.userId)
    .first<CategoryIdRow>();

  if (existingCategory?.id) {
    categoryIdByTypeAndName.set(cacheKey, existingCategory.id);
    return existingCategory.id;
  }

  const categoryId = crypto.randomUUID();
  categoryIdByTypeAndName.set(cacheKey, categoryId);
  statements.push(database.prepare(`
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
    .bind(categoryId, user.userId, transaction.type, transaction.categoryName, createdAt));
  return categoryId;
}

/**
 * 驗證單筆新增帳目。
 *
 * 輸入：未信任的單筆資料、列 index 與目前日期。
 * 輸出：已正規化的新增帳目。
 * 可能錯誤：欄位不合法時拋出 RangeError。
 */
function validateCreateTransaction(
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

  const parsedDate = new Date(`${transactionDate}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime()) || transactionDate !== parsedDate.toISOString().slice(0, 10)) {
    throw new RangeError(`Transaction ${index + 1} date is invalid`);
  }

  const today = now.toISOString().slice(0, 10);
  if (transactionDate > today) {
    throw new RangeError(`Transaction ${index + 1} date cannot be in the future`);
  }

  return transactionDate;
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
