package com.ivy.accounting.transaction;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record BatchCreateTransactionsRequest(
        @NotEmpty List<@Valid CreateTransactionRequest> transactions
) {
}
