package com.ivy.accounting.transaction;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record TransactionResponse(
        UUID id,
        TransactionType type,
        LocalDate transactionDate,
        BigDecimal amount,
        String categoryName,
        String note,
        OffsetDateTime createdAt
) {
    static TransactionResponse from(AccountingTransaction transaction) {
        return new TransactionResponse(
                transaction.getId(),
                transaction.getType(),
                transaction.getTransactionDate(),
                transaction.getAmount(),
                transaction.getCategory().getName(),
                transaction.getNote(),
                transaction.getCreatedAt()
        );
    }
}
