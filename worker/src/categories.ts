import type { AuthenticatedUser } from './auth';

export type TransactionType = 'INCOME' | 'EXPENSE';

export interface CategoryOptionResponse {
  name: string;
}

interface CategoryNameRow {
  name: string;
}

/**
 * 解析類別查詢的收支類型。
 *
 * 輸入：URLSearchParams 中的 type 參數。
 * 輸出：合法的收支類型，未指定時回傳 EXPENSE。
 * 可能錯誤：type 不屬於 INCOME / EXPENSE 時拋出 RangeError。
 */
export function parseTransactionType(params: URLSearchParams): TransactionType {
  const type = params.get('type') ?? 'EXPENSE';
  if (type === 'INCOME' || type === 'EXPENSE') {
    return type;
  }
  throw new RangeError('Transaction type is invalid');
}

/**
 * 查詢目前使用者可見的類別選項。
 *
 * 輸入：D1 database、已驗證使用者與收支類型。
 * 輸出：預設類別與該使用者自訂類別名稱清單。
 * 可能錯誤：D1 查詢失敗時由 Cloudflare D1 拋出錯誤。
 */
export async function listCategoryOptions(
  database: D1Database,
  user: AuthenticatedUser,
  type: TransactionType
): Promise<CategoryOptionResponse[]> {
  const result = await database.prepare(`
    select distinct name
    from categories
    where type = ?
      and (user_id = ? or user_id is null)
    order by name asc
  `)
    .bind(type, user.userId)
    .all<CategoryNameRow>();

  return result.results.map((row) => ({
    name: row.name
  }));
}
