package com.ivy.accounting.transaction;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class TransactionServiceTests {

    @Autowired
    private TransactionService transactionService;

    @Autowired
    private AccountingTransactionRepository transactionRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @BeforeEach
    void setUp() {
        transactionRepository.deleteAll();
        categoryRepository.deleteAll(categoryRepository.findAll().stream()
                .filter(category -> !category.isDefaultCategory())
                .toList());
    }

    @Test
    void createBatchCreatesTransactionsAndCustomCategory() {
        BatchCreateTransactionsRequest request = new BatchCreateTransactionsRequest(List.of(
                new CreateTransactionRequest(
                        TransactionType.EXPENSE,
                        LocalDate.of(2026, 4, 1),
                        BigDecimal.valueOf(120),
                        "飲食",
                        "午餐"
                ),
                new CreateTransactionRequest(
                        TransactionType.INCOME,
                        LocalDate.of(2026, 4, 2),
                        BigDecimal.valueOf(3000),
                        "副業",
                        ""
                )
        ));

        List<AccountingTransaction> createdTransactions = transactionService.createBatch(request);
        List<AccountingTransaction> recentTransactions = transactionService.listRecent(null);

        assertThat(createdTransactions).hasSize(2);
        assertThat(createdTransactions).extracting(transaction -> transaction.getCategory().getName())
                .containsExactly("飲食", "副業");
        assertThat(recentTransactions).hasSize(2);
        assertThat(recentTransactions).extracting(AccountingTransaction::getUserId)
                .containsOnly("dev-user");
        assertThat(recentTransactions).extracting(transaction -> transaction.getCategory().getName())
                .containsExactly("飲食", "副業");
    }

    @Test
    void listRecentCapsLimitAtFifteen() {
        BatchCreateTransactionsRequest request = new BatchCreateTransactionsRequest(List.of(
                new CreateTransactionRequest(
                        TransactionType.EXPENSE,
                        LocalDate.of(2026, 4, 1),
                        BigDecimal.valueOf(120),
                        "飲食",
                        null
                )
        ));

        transactionService.createBatch(request);

        assertThat(transactionService.listRecent(100)).hasSize(1);
    }
}
