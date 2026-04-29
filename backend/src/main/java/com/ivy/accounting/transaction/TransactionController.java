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
}
