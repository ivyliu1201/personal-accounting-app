package com.ivy.accounting.transaction;

import com.ivy.accounting.auth.CurrentUserProvider;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Slice;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class TransactionService {

    private static final int DEFAULT_RECENT_LIMIT = 5;
    private static final int MAX_RECENT_LIMIT = 15;
    private static final int SUMMARY_RANGE_DAYS = 30;
    private static final int DEFAULT_HISTORY_SIZE = 10;
    private static final int MAX_HISTORY_SIZE = 20;
    private static final BigDecimal PERCENTAGE_MULTIPLIER = BigDecimal.valueOf(100);

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
            createdTransactions.add(transactionRepository.save(transaction));
        }

        return createdTransactions;
    }

    @Transactional(readOnly = true)
    public List<AccountingTransaction> listRecent(Integer requestedLimit) {
        String userId = currentUserProvider.getCurrentUserId();
        int limit = normalizeRecentLimit(requestedLimit);
        return transactionRepository.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, limit));
    }

    /**
     * 查詢歷史查看頁的日期區間明細。
     *
     * 輸入：收支類型、起訖日期、頁碼與每頁筆數。
     * 輸出：依交易日期與建立時間倒序排列的明細分頁。
     * 可能錯誤：日期區間無法由資料庫處理時拋出資料存取例外。
     */
    @Transactional(readOnly = true)
    public HistoryTransactionsResponse listHistory(
            TransactionType type,
            LocalDate startDate,
            LocalDate endDate,
            Integer requestedPage,
            Integer requestedSize
    ) {
        String userId = currentUserProvider.getCurrentUserId();
        int page = normalizePage(requestedPage);
        int size = normalizeHistorySize(requestedSize);
        Slice<AccountingTransaction> transactions = transactionRepository
                .findByUserIdAndTypeAndTransactionDateBetweenOrderByTransactionDateDescCreatedAtDesc(
                        userId,
                        type,
                        startDate,
                        endDate,
                        PageRequest.of(page, size)
                );
        List<TransactionResponse> responseTransactions = transactions.getContent()
                .stream()
                .map(TransactionResponse::from)
                .toList();

        return new HistoryTransactionsResponse(responseTransactions, page, size, transactions.hasNext());
    }

    /**
     * 查詢首頁近 30 天類別摘要。
     *
     * 輸入：收入或支出類型。
     * 輸出：依金額由大到小排序的類別摘要清單。
     * 可能錯誤：資料庫查詢失敗時拋出資料存取例外。
     */
    @Transactional(readOnly = true)
    public List<CategorySummaryResponse> listCategorySummaries(
            TransactionType type,
            LocalDate requestedStartDate,
            LocalDate requestedEndDate
    ) {
        String userId = currentUserProvider.getCurrentUserId();
        LocalDate endDate = requestedEndDate == null ? LocalDate.now(clock) : requestedEndDate;
        LocalDate startDate = requestedStartDate == null ? endDate.minusDays(SUMMARY_RANGE_DAYS - 1L) : requestedStartDate;
        List<CategorySummaryProjection> summaries = transactionRepository.listCategorySummaries(
                userId,
                type,
                startDate,
                endDate
        );
        BigDecimal totalAmount = summaries.stream()
                .map(CategorySummaryProjection::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return summaries.stream()
                .map(summary -> new CategorySummaryResponse(
                        summary.getCategoryName(),
                        summary.getAmount(),
                        calculatePercentage(summary.getAmount(), totalAmount)
                ))
                .toList();
    }

    private Category getOrCreateCategory(String userId, CreateTransactionRequest request, OffsetDateTime now) {
        String categoryName = request.categoryName().trim();
        return categoryRepository.getVisibleCategory(userId, request.type(), categoryName)
                .orElseGet(() -> categoryRepository.save(buildCustomCategory(userId, request.type(), categoryName, now)));
    }

    private Category buildCustomCategory(String userId, TransactionType type, String name, OffsetDateTime now) {
        Category category = new Category();
        category.setId(UUID.randomUUID());
        category.setUserId(userId);
        category.setType(type);
        category.setName(name);
        category.setDefaultCategory(false);
        category.setCreatedAt(now);
        return category;
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
        transaction.setCategory(category);
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

    private int normalizePage(Integer requestedPage) {
        if (requestedPage == null || requestedPage < 0) {
            return 0;
        }
        return requestedPage;
    }

    private int normalizeHistorySize(Integer requestedSize) {
        if (requestedSize == null || requestedSize <= 0) {
            return DEFAULT_HISTORY_SIZE;
        }
        return Math.min(requestedSize, MAX_HISTORY_SIZE);
    }

    /**
     * 計算類別金額占總金額的百分比。
     *
     * 輸入：類別金額與總金額。
     * 輸出：四捨五入到小數二位的百分比。
     * 可能錯誤：無，總金額為零時回傳零。
     */
    private BigDecimal calculatePercentage(BigDecimal amount, BigDecimal totalAmount) {
        if (BigDecimal.ZERO.compareTo(totalAmount) == 0) {
            return BigDecimal.ZERO;
        }
        return amount.multiply(PERCENTAGE_MULTIPLIER)
                .divide(totalAmount, 2, RoundingMode.HALF_UP);
    }
}
