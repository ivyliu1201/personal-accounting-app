package com.ivy.accounting.transaction;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {

    private final TransactionService transactionService;

    public TransactionController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    @PostMapping("/batch")
    public BatchCreateTransactionsResponse createBatch(@Valid @RequestBody BatchCreateTransactionsRequest request) {
        List<TransactionResponse> transactions = transactionService.createBatch(request)
                .stream()
                .map(TransactionResponse::from)
                .toList();
        return new BatchCreateTransactionsResponse(transactions);
    }

    @GetMapping("/recent")
    public List<TransactionResponse> listRecent(@RequestParam(required = false) Integer limit) {
        return transactionService.listRecent(limit)
                .stream()
                .map(TransactionResponse::from)
                .toList();
    }

    /**
     * 查詢首頁近 30 天類別摘要。
     *
     * 輸入：收入或支出類型，未指定時預設支出。
     * 輸出：類別、金額與占比清單。
     * 可能錯誤：type 不是合法列舉值時回傳請求錯誤。
     */
    @GetMapping("/category-summary")
    public List<CategorySummaryResponse> listCategorySummaries(
            @RequestParam(defaultValue = "EXPENSE") TransactionType type
    ) {
        return transactionService.listCategorySummaries(type);
    }
}
