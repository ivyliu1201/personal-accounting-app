interface HealthResponse {
  status: 'ok';
  service: 'personal-accounting-worker';
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
  fetch(request: Request): Response {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return jsonResponse<HealthResponse>({
        status: 'ok',
        service: 'personal-accounting-worker'
      });
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
