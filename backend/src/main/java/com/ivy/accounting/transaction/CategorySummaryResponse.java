package com.ivy.accounting.transaction;

import java.math.BigDecimal;

/**
 * 類別摘要 API 回應，提供首頁近 30 天類別金額與占比。
 */
public record CategorySummaryResponse(
        String categoryName,
        BigDecimal amount,
        BigDecimal percentage
) {
}
