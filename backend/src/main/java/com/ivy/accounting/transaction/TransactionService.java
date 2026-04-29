package com.ivy.accounting.transaction;

import com.ivy.accounting.auth.CurrentUserProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class TransactionService {

    private static final int DEFAULT_RECENT_LIMIT = 5;
    private static final int MAX_RECENT_LIMIT = 15;

    private final CurrentUserProvider currentUserProvider;
    private final CategoryRepository categoryRepository;
    private final AccountingTransactionRepository transactionRepository;
    private final Clock clock;

    public TransactionService(
            CurrentUserProvider currentUserProvider,
            CategoryRepository categoryRepository,
            AccountingTransactionRepository transactionRepository,
            Clock clock
    ) {
        this.currentUserProvider = currentUserProvider;
        this.categoryRepository = categoryRepository;
        this.transactionRepository = transactionRepository;
        this.clock = clock;
    }

    @Transactional
    public List<AccountingTransaction> createBatch(BatchCreateTransactionsRequest request) {
        String userId = currentUserProvider.getCurrentUserId();
        OffsetDateTime now = OffsetDateTime.now(clock);
        List<AccountingTransaction> createdTransactions = new ArrayList<>();

        for (CreateTransactionRequest transactionRequest : request.transactions()) {
            Category category = getOrCreateCategory(userId, transactionRequest, now);
            AccountingTransaction transaction = buildTransaction(userId, transactionRequest, category, now);
            transactionRepository.create(transaction);
            createdTransactions.add(transaction);
        }

        return createdTransactions;
    }

    public List<AccountingTransaction> listRecent(Integer requestedLimit) {
        String userId = currentUserProvider.getCurrentUserId();
        int limit = normalizeRecentLimit(requestedLimit);
        return transactionRepository.listRecent(userId, limit);
    }

    private Category getOrCreateCategory(String userId, CreateTransactionRequest request, OffsetDateTime now) {
        String categoryName = request.categoryName().trim();
        return categoryRepository.getVisibleCategory(userId, request.type(), categoryName)
                .orElseGet(() -> categoryRepository.createCustomCategory(userId, request.type(), categoryName, now));
    }

    private AccountingTransaction buildTransaction(
            String userId,
            CreateTransactionRequest request,
            Category category,
            OffsetDateTime now
    ) {
        AccountingTransaction transaction = new AccountingTransaction();
        transaction.setId(UUID.randomUUID());
        transaction.setUserId(userId);
        transaction.setType(request.type());
        transaction.setTransactionDate(request.transactionDate());
        transaction.setAmount(request.amount());
        transaction.setCategoryId(category.getId());
        transaction.setCategoryName(category.getName());
        transaction.setNote(normalizeNote(request.note()));
        transaction.setCreatedAt(now);
        return transaction;
    }

    private String normalizeNote(String note) {
        if (note == null || note.isBlank()) {
            return null;
        }
        return note.trim();
    }

    private int normalizeRecentLimit(Integer requestedLimit) {
        if (requestedLimit == null) {
            return DEFAULT_RECENT_LIMIT;
        }
        if (requestedLimit <= 0) {
            return DEFAULT_RECENT_LIMIT;
        }
        return Math.min(requestedLimit, MAX_RECENT_LIMIT);
    }
}
