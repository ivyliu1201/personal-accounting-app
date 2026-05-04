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
  const { data, error } = await supabase
    .from('categories')
    .select('name,user_id')
    .eq('type', type)
    .or(`user_id.eq.${user.userId},user_id.is.null`)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }
  const uniqueNames = [...new Set((data ?? []).map((row) => row.name as string))];
  return uniqueNames.map((name) => ({ name }));
}
