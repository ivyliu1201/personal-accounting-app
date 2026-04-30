package com.ivy.accounting.transaction;

import java.math.BigDecimal;

public record HistoryTrendPointResponse(
        String month,
        BigDecimal amount,
        BigDecimal cumulativeAmount
) {
}
