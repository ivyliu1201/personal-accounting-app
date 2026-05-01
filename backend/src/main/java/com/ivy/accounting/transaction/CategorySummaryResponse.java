package com.ivy.accounting.transaction;

import java.math.BigDecimal;

/**
 * 類別摘要 API 回應，提供指定區間或當月類別金額與占比。
 */
public record CategorySummaryResponse(
        String categoryName,
        BigDecimal amount,
        BigDecimal percentage
) {
}
