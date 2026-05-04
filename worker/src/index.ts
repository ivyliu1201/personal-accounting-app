import { AuthError, authenticateFirebaseRequest, type WorkerEnv } from './auth';
import { listCategoryOptions, parseTransactionType } from './categories';
import { getSupabaseClient } from './db';
import {
  createBatchTransactions,
  deleteTransaction,
  listAnnualCashFlowTrend,
  listCategorySummaries,
  listHistoryTrend,
  listHistoryTransactions,
  listRecentTransactions,
  parseHistoryPage,
  parseHistorySize,
  parseOptionalDate,
  parseRecentLimit,
  parseRequiredDate,
  parseTrendYear,
  resolveSummaryDateRange,
  TransactionNotFoundError,
  updateTransaction
} from './transactions';

interface HealthResponse {
  status: 'ok';
  service: 'personal-accounting-worker';
}

interface ErrorResponse {
  message: string;
}

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

export default {
  /**
   * 處理 Worker HTTP request。
   *
   * 輸入：Cloudflare Workers 傳入的 request。
   * 輸出：健康檢查 JSON 或 404 JSON。
   * 可能錯誤：本 POC 不存取外部資源，預期不會拋出業務錯誤。
   */
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const corsOrigin = resolveCorsOrigin(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: buildCorsHeaders(corsOrigin)
      });
    }
    let supabase;
    try {
      supabase = getSupabaseClient(env);
    } catch {
      return jsonResponse<ErrorResponse>({ message: 'Supabase is not configured' }, 500);
    }

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return jsonResponse<HealthResponse>({
        status: 'ok',
        service: 'personal-accounting-worker'
      }, 200, corsOrigin);
    }

    if (request.method === 'GET' && url.pathname === '/api/auth/me') {
      try {
        const user = await authenticateFirebaseRequest(request, env);
        return jsonResponse(user, 200, corsOrigin);
      } catch (error) {
        if (error instanceof AuthError) {
          return jsonResponse<ErrorResponse>({ message: error.message }, error.status, corsOrigin);
        }
        return jsonResponse<ErrorResponse>({ message: 'Authentication failed' }, 401, corsOrigin);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/transactions/categories') {
      try {
        const type = parseTransactionType(url.searchParams);
        const user = await authenticateFirebaseRequest(request, env);
        const categories = await listCategoryOptions(supabase, user, type);
        return jsonResponse(categories, 200, corsOrigin);
      } catch (error) {
        if (error instanceof RangeError) {
          return jsonResponse<ErrorResponse>({ message: error.message }, 400, corsOrigin);
        }
        if (error instanceof AuthError) {
          return jsonResponse<ErrorResponse>({ message: error.message }, error.status, corsOrigin);
        }
        return jsonResponse<ErrorResponse>({ message: 'Categories loading failed' }, 500, corsOrigin);
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/transactions/batch') {
      try {
        const user = await authenticateFirebaseRequest(request, env);
        const body = await request.json();
        const response = await createBatchTransactions(supabase, user, body);
        return jsonResponse(response, 200, corsOrigin);
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonResponse<ErrorResponse>({ message: 'Request body is invalid' }, 400, corsOrigin);
        }
        if (error instanceof RangeError) {
          return jsonResponse<ErrorResponse>({ message: error.message }, 400, corsOrigin);
        }
        if (error instanceof AuthError) {
          return jsonResponse<ErrorResponse>({ message: error.message }, error.status, corsOrigin);
        }
        return jsonResponse<ErrorResponse>({ message: 'Batch create failed' }, 500, corsOrigin);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/transactions/recent') {
      try {
        const limit = parseRecentLimit(url.searchParams);
        const user = await authenticateFirebaseRequest(request, env);
        const transactions = await listRecentTransactions(supabase, user, limit);
        return jsonResponse(transactions, 200, corsOrigin);
      } catch (error) {
        if (error instanceof RangeError) {
          return jsonResponse<ErrorResponse>({ message: error.message }, 400, corsOrigin);
        }
        if (error instanceof AuthError) {
          return jsonResponse<ErrorResponse>({ message: error.message }, error.status, corsOrigin);
        }
        return jsonResponse<ErrorResponse>({ message: 'Recent transactions loading failed' }, 500, corsOrigin);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/transactions/history') {
      try {
        const type = parseTransactionType(url.searchParams);
        const startDate = parseRequiredDate(url.searchParams, 'startDate');
        const endDate = parseRequiredDate(url.searchParams, 'endDate');
        const page = parseHistoryPage(url.searchParams);
        const size = parseHistorySize(url.searchParams);
        const user = await authenticateFirebaseRequest(request, env);
        const transactions = await listHistoryTransactions(
          supabase,
          user,
          type,
          startDate,
          endDate,
          page,
          size
        );
        return jsonResponse(transactions, 200, corsOrigin);
      } catch (error) {
        if (error instanceof RangeError) {
          return jsonResponse<ErrorResponse>({ message: error.message }, 400, corsOrigin);
        }
        if (error instanceof AuthError) {
          return jsonResponse<ErrorResponse>({ message: error.message }, error.status, corsOrigin);
        }
        return jsonResponse<ErrorResponse>({ message: 'History transactions loading failed' }, 500, corsOrigin);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/transactions/category-summary') {
      try {
        const type = parseTransactionType(url.searchParams);
        const dateRange = resolveSummaryDateRange(
          parseOptionalDate(url.searchParams, 'startDate'),
          parseOptionalDate(url.searchParams, 'endDate')
        );
        const user = await authenticateFirebaseRequest(request, env);
        const summaries = await listCategorySummaries(
          supabase,
          user,
          type,
          dateRange.startDate,
          dateRange.endDate
        );
        return jsonResponse(summaries, 200, corsOrigin);
      } catch (error) {
        if (error instanceof RangeError) {
          return jsonResponse<ErrorResponse>({ message: error.message }, 400, corsOrigin);
        }
        if (error instanceof AuthError) {
          return jsonResponse<ErrorResponse>({ message: error.message }, error.status, corsOrigin);
        }
        return jsonResponse<ErrorResponse>({ message: 'Category summary loading failed' }, 500, corsOrigin);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/transactions/history-trend') {
      try {
        const type = parseTransactionType(url.searchParams);
        const startDate = parseRequiredDate(url.searchParams, 'startDate');
        const endDate = parseRequiredDate(url.searchParams, 'endDate');
        const user = await authenticateFirebaseRequest(request, env);
        const trend = await listHistoryTrend(supabase, user, type, startDate, endDate);
        return jsonResponse(trend, 200, corsOrigin);
      } catch (error) {
        if (error instanceof RangeError) {
          return jsonResponse<ErrorResponse>({ message: error.message }, 400, corsOrigin);
        }
        if (error instanceof AuthError) {
          return jsonResponse<ErrorResponse>({ message: error.message }, error.status, corsOrigin);
        }
        return jsonResponse<ErrorResponse>({ message: 'History trend loading failed' }, 500, corsOrigin);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/transactions/cash-flow-trend') {
      try {
        const year = parseTrendYear(url.searchParams);
        const user = await authenticateFirebaseRequest(request, env);
        const trend = await listAnnualCashFlowTrend(supabase, user, year);
        return jsonResponse(trend, 200, corsOrigin);
      } catch (error) {
        if (error instanceof RangeError) {
          return jsonResponse<ErrorResponse>({ message: error.message }, 400, corsOrigin);
        }
        if (error instanceof AuthError) {
          return jsonResponse<ErrorResponse>({ message: error.message }, error.status, corsOrigin);
        }
        return jsonResponse<ErrorResponse>({ message: 'Cash flow trend loading failed' }, 500, corsOrigin);
      }
    }

    const transactionPathMatch = url.pathname.match(/^\/api\/transactions\/([^/]+)$/);
    if (transactionPathMatch && request.method === 'PUT') {
      try {
        const user = await authenticateFirebaseRequest(request, env);
        const body = await request.json();
        const transaction = await updateTransaction(supabase, user, transactionPathMatch[1], body);
        return jsonResponse(transaction, 200, corsOrigin);
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonResponse<ErrorResponse>({ message: 'Request body is invalid' }, 400, corsOrigin);
        }
        if (error instanceof RangeError) {
          return jsonResponse<ErrorResponse>({ message: error.message }, 400, corsOrigin);
        }
        if (error instanceof TransactionNotFoundError) {
          return jsonResponse<ErrorResponse>({ message: error.message }, 404, corsOrigin);
        }
        if (error instanceof AuthError) {
          return jsonResponse<ErrorResponse>({ message: error.message }, error.status, corsOrigin);
        }
        return jsonResponse<ErrorResponse>({ message: 'Transaction update failed' }, 500, corsOrigin);
      }
    }

    if (transactionPathMatch && request.method === 'DELETE') {
      try {
        const user = await authenticateFirebaseRequest(request, env);
        await deleteTransaction(supabase, user, transactionPathMatch[1]);
        return jsonResponse<Record<string, never>>({}, 200, corsOrigin);
      } catch (error) {
        if (error instanceof TransactionNotFoundError) {
          return jsonResponse<ErrorResponse>({ message: error.message }, 404, corsOrigin);
        }
        if (error instanceof AuthError) {
          return jsonResponse<ErrorResponse>({ message: error.message }, error.status, corsOrigin);
        }
        return jsonResponse<ErrorResponse>({ message: 'Transaction delete failed' }, 500, corsOrigin);
      }
    }

    return jsonResponse(
      {
        message: 'Not found'
      },
      404,
      corsOrigin
    );
  }
};

/**
 * 建立 JSON response。
 *
 * 輸入：可序列化的 response body 與 HTTP status。
 * 輸出：帶有 JSON header 的 Response。
 * 可能錯誤：body 無法序列化時會拋出 JSON.stringify 錯誤。
 */
function jsonResponse<TBody>(body: TBody, status = 200, corsOrigin?: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...buildCorsHeaders(corsOrigin)
    }
  });
}

function resolveCorsOrigin(request: Request, env: WorkerEnv): string | undefined {
  const requestOrigin = request.headers.get('Origin');
  if (!requestOrigin) {
    return undefined;
  }
  const allowedOriginsRaw = env.APP_CORS_ALLOWED_ORIGINS?.trim();
  if (!allowedOriginsRaw) {
    return undefined;
  }
  const allowedOrigins = allowedOriginsRaw.split(',').map((item) => item.trim()).filter(Boolean);
  return allowedOrigins.includes(requestOrigin) ? requestOrigin : undefined;
}

function buildCorsHeaders(origin?: string): Record<string, string> {
  if (!origin) {
    return {};
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin'
  };
}
