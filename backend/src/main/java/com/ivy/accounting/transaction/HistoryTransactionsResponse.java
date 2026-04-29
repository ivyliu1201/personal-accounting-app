package com.ivy.accounting.transaction;

import java.util.List;

/**
 * 歷史明細列表回應。
 *
 * 輸入：交易明細、目前頁碼、每頁筆數與下一頁狀態。
 * 輸出：供前端日期區間查詢頁顯示與翻頁。
 * 可能錯誤：無，僅作為資料傳輸物件。
 */
public record HistoryTransactionsResponse(
        List<TransactionResponse> transactions,
        int page,
        int size,
        boolean hasNext
) {
}
