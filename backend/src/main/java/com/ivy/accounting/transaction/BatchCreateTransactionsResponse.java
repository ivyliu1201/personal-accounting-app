package com.ivy.accounting.transaction;

import java.util.List;

public record BatchCreateTransactionsResponse(
        List<TransactionResponse> transactions
) {
}
