package com.ivy.accounting.transaction;

import java.math.BigDecimal;

public record HistoryTrendPointResponse(
        String label,
        BigDecimal amount,
        BigDecimal cumulativeAmount
) {
}
