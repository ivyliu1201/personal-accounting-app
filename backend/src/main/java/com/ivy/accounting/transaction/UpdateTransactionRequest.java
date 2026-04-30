package com.ivy.accounting.transaction;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 單筆帳目更新請求，承載編輯彈窗可修改的欄位。
 */
public record UpdateTransactionRequest(
        @NotNull TransactionType type,
        @NotNull @PastOrPresent LocalDate transactionDate,
        @NotNull @DecimalMin(value = "0.00", inclusive = false) BigDecimal amount,
        @NotBlank @Size(max = 64) String categoryName,
        @Size(max = 255) String note
) {
}
