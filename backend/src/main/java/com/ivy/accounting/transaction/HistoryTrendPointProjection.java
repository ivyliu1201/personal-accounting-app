package com.ivy.accounting.transaction;

import java.math.BigDecimal;

public interface HistoryTrendPointProjection {

    Integer getYear();

    Integer getMonth();

    BigDecimal getAmount();
}
