import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedUser } from './auth';

export type TransactionType = 'INCOME' | 'EXPENSE';

export interface CategoryOptionResponse {
  name: string;
}

interface CategoryRow {
  name: string;
  user_id: string | null;
}

interface TransactionCategoryUsageRow {
  categories: {
    name: string;
  } | null;
}

export function parseTransactionType(params: URLSearchParams): TransactionType {
  const type = params.get('type') ?? 'EXPENSE';
  if (type === 'INCOME' || type === 'EXPENSE') {
    return type;
  }
  throw new RangeError('Transaction type is invalid');
}

export async function listCategoryOptions(
  supabase: SupabaseClient,
  user: AuthenticatedUser,
  type: TransactionType
): Promise<CategoryOptionResponse[]> {
  const { data: defaultCategories, error: defaultCategoryError } = await supabase
    .from('categories')
    .select('name,user_id')
    .eq('type', type)
    .is('user_id', null)
    .order('name', { ascending: true });

  if (defaultCategoryError) {
    throw defaultCategoryError;
  }

  const { data: userCategories, error: userCategoryError } = await supabase
    .from('categories')
    .select('name,user_id')
    .eq('type', type)
    .eq('user_id', user.userId)
    .order('name', { ascending: true });

  if (userCategoryError) {
    throw userCategoryError;
  }

  const usageCounts = await loadCategoryUsageCounts(supabase, user, type);
  const uniqueNames = [...new Set([
    ...(defaultCategories ?? []),
    ...(userCategories ?? [])
  ].map((row) => (row as CategoryRow).name))];
  return uniqueNames
    .sort((left, right) => (usageCounts.get(right) ?? 0) - (usageCounts.get(left) ?? 0)
      || left.localeCompare(right, 'zh-Hant'))
    .map((name) => ({ name }));
}

async function loadCategoryUsageCounts(
  supabase: SupabaseClient,
  user: AuthenticatedUser,
  type: TransactionType
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('accounting_transactions')
    .select('categories(name)')
    .eq('user_id', user.userId)
    .eq('type', type);
  if (error) {
    throw error;
  }

  const usageCounts = new Map<string, number>();
  for (const row of (data ?? []) as unknown as TransactionCategoryUsageRow[]) {
    const categoryName = row.categories?.name;
    if (categoryName) {
      usageCounts.set(categoryName, (usageCounts.get(categoryName) ?? 0) + 1);
    }
  }
  return usageCounts;
}
