package com.ivy.accounting.transaction;

import java.math.BigDecimal;
import java.time.LocalDate;

public interface HistoryTrendPointProjection {

    LocalDate getTransactionDate();

    Integer getYear();

    Integer getMonth();

    BigDecimal getAmount();
}
