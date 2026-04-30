package com.ivy.accounting.transaction;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

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

    @PutMapping("/{id}")
    public TransactionResponse updateTransaction(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateTransactionRequest request
    ) {
        return TransactionResponse.from(transactionService.updateTransaction(id, request));
    }

    @DeleteMapping("/{id}")
    public void deleteTransaction(@PathVariable UUID id) {
        transactionService.deleteTransaction(id);
    }

    /**
     * 查詢歷史查看頁的日期區間明細。
     *
     * 輸入：收支類型、起訖日期、頁碼與每頁筆數。
     * 輸出：符合條件的明細清單與下一頁狀態。
     * 可能錯誤：日期格式或 type 不合法時回傳請求錯誤。
     */
    @GetMapping("/history")
    public HistoryTransactionsResponse listHistory(
            @RequestParam(defaultValue = "EXPENSE") TransactionType type,
            @RequestParam LocalDate startDate,
            @RequestParam LocalDate endDate,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size
    ) {
        return transactionService.listHistory(type, startDate, endDate, page, size);
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
            @RequestParam(defaultValue = "EXPENSE") TransactionType type,
            @RequestParam(required = false) LocalDate startDate,
            @RequestParam(required = false) LocalDate endDate
    ) {
        return transactionService.listCategorySummaries(type, startDate, endDate);
    }

    @GetMapping("/categories")
    public List<CategoryOptionResponse> listCategories(
            @RequestParam(defaultValue = "EXPENSE") TransactionType type
    ) {
        return transactionService.listCategoryOptions(type);
    }

    @GetMapping("/history-trend")
    public List<HistoryTrendPointResponse> listHistoryTrend(
            @RequestParam(defaultValue = "EXPENSE") TransactionType type,
            @RequestParam LocalDate startDate,
            @RequestParam LocalDate endDate
    ) {
        return transactionService.listHistoryTrend(type, startDate, endDate);
    }

    @GetMapping("/cash-flow-trend")
    public List<HistoryTrendPointResponse> listCashFlowTrend(
            @RequestParam(required = false) Integer year
    ) {
        return transactionService.listAnnualCashFlowTrend(year);
    }
}
