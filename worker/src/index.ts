import { AuthError, authenticateFirebaseRequest, type WorkerEnv } from './auth';

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

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return jsonResponse<HealthResponse>({
        status: 'ok',
        service: 'personal-accounting-worker'
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/auth/me') {
      try {
        const user = await authenticateFirebaseRequest(request, env);
        return jsonResponse(user);
      } catch (error) {
        if (error instanceof AuthError) {
          return jsonResponse<ErrorResponse>({ message: error.message }, error.status);
        }
        return jsonResponse<ErrorResponse>({ message: 'Authentication failed' }, 401);
      }
    }

    return jsonResponse(
      {
        message: 'Not found'
      },
      404
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
function jsonResponse<TBody>(body: TBody, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS
  });
}
