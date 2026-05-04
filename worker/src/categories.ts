import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedUser } from './auth';

export type TransactionType = 'INCOME' | 'EXPENSE';

export interface CategoryOptionResponse {
  name: string;
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
  const uniqueNames = [...new Set([...(defaultCategories ?? []), ...(userCategories ?? [])].map((row) => row.name as string))];
  return uniqueNames.map((name) => ({ name }));
}
