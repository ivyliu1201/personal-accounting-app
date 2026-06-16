package com.ivy.accounting.transaction;

import com.ivy.accounting.auth.CurrentUserProvider;
import com.ivy.accounting.auth.DatabaseUserScope;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Slice;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class TransactionService {

    private static final int DEFAULT_RECENT_LIMIT = 5;
    private static final int MAX_RECENT_LIMIT = 15;
    private static final int DEFAULT_HISTORY_SIZE = 10;
    private static final int MAX_HISTORY_SIZE = 20;
    private static final BigDecimal PERCENTAGE_MULTIPLIER = BigDecimal.valueOf(100);

    private final CurrentUserProvider currentUserProvider;
    private final DatabaseUserScope databaseUserScope;
    private final CategoryRepository categoryRepository;
    private final AccountingTransactionRepository transactionRepository;
    private final Clock clock;

    public TransactionService(
            CurrentUserProvider currentUserProvider,
            DatabaseUserScope databaseUserScope,
            CategoryRepository categoryRepository,
            AccountingTransactionRepository transactionRepository,
            Clock clock
    ) {
        this.currentUserProvider = currentUserProvider;
        this.databaseUserScope = databaseUserScope;
        this.categoryRepository = categoryRepository;
        this.transactionRepository = transactionRepository;
        this.clock = clock;
    }

    @Transactional
    public List<AccountingTransaction> createBatch(BatchCreateTransactionsRequest request) {
        String userId = getCurrentUserId();
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
        String userId = getCurrentUserId();
        int limit = normalizeRecentLimit(requestedLimit);
        LocalDate today = LocalDate.now(clock);
        return transactionRepository.listTodayTransactions(userId, today, PageRequest.of(0, limit));
    }

    @Transactional
    public AccountingTransaction updateTransaction(UUID id, UpdateTransactionRequest request) {
        String userId = getCurrentUserId();
        AccountingTransaction transaction = getRequiredTransaction(id, userId);
        Category category = getOrCreateCategory(
                userId,
                request.type(),
                request.categoryName(),
                OffsetDateTime.now(clock)
        );

        transaction.setType(request.type());
        transaction.setTransactionDate(request.transactionDate());
        transaction.setAmount(request.amount());
        transaction.setCategory(category);
        transaction.setNote(normalizeNote(request.note()));
        return transactionRepository.save(transaction);
    }

    @Transactional
    public void deleteTransaction(UUID id) {
        String userId = getCurrentUserId();
        AccountingTransaction transaction = getRequiredTransaction(id, userId);
        transactionRepository.delete(transaction);
    }

    @Transactional(readOnly = true)
    public HistoryTransactionsResponse listHistory(
            TransactionType type,
            LocalDate startDate,
            LocalDate endDate,
            Integer requestedPage,
            Integer requestedSize
    ) {
        String userId = getCurrentUserId();
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

    @Transactional(readOnly = true)
    public List<CategorySummaryResponse> listCategorySummaries(
            TransactionType type,
            LocalDate requestedStartDate,
            LocalDate requestedEndDate
    ) {
        String userId = getCurrentUserId();
        LocalDate endDate = requestedEndDate == null ? LocalDate.now(clock) : requestedEndDate;
        LocalDate startDate = requestedStartDate == null ? YearMonth.from(endDate).atDay(1) : requestedStartDate;
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

    @Transactional(readOnly = true)
    public List<CategoryOptionResponse> listCategoryOptions(TransactionType type) {
        String userId = getCurrentUserId();
        return categoryRepository.listVisibleCategoryNames(userId, type)
                .stream()
                .map(CategoryOptionResponse::new)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<HistoryTrendPointResponse> listHistoryTrend(
            TransactionType type,
            LocalDate startDate,
            LocalDate endDate
    ) {
        String userId = getCurrentUserId();
        List<HistoryTrendPointProjection> trendPoints = isSameMonth(startDate, endDate)
                ? transactionRepository.listDailyHistoryTrend(userId, type, startDate, endDate)
                : transactionRepository.listMonthlyHistoryTrend(userId, type, startDate, endDate);
        BigDecimal cumulativeAmount = BigDecimal.ZERO;
        List<HistoryTrendPointResponse> responses = new ArrayList<>();

        for (HistoryTrendPointProjection trendPoint : trendPoints) {
            cumulativeAmount = cumulativeAmount.add(trendPoint.getAmount());
            responses.add(new HistoryTrendPointResponse(
                    formatTrendLabel(startDate, endDate, trendPoint),
                    trendPoint.getAmount(),
                    cumulativeAmount
            ));
        }

        return responses;
    }

    @Transactional(readOnly = true)
    public List<HistoryTrendPointResponse> listAnnualCashFlowTrend(Integer requestedYear) {
        String userId = getCurrentUserId();
        LocalDate today = LocalDate.now(clock);
        int year = requestedYear == null ? today.getYear() : requestedYear;
        int endMonth = getAnnualTrendEndMonth(year, today);
        LocalDate startDate = LocalDate.of(year, 1, 1);
        LocalDate endDate = endMonth == 0
                ? startDate
                : YearMonth.of(year, endMonth).atEndOfMonth();
        Map<Integer, BigDecimal> amountByMonth = new HashMap<>();

        for (HistoryTrendPointProjection trendPoint : transactionRepository.listMonthlyCashFlowTrend(
                userId,
                TransactionType.INCOME,
                startDate,
                endDate
        )) {
            amountByMonth.put(trendPoint.getMonth(), trendPoint.getAmount());
        }

        List<HistoryTrendPointResponse> responses = new ArrayList<>();
        BigDecimal cumulativeAmount = BigDecimal.ZERO;
        for (int month = 1; month <= endMonth; month++) {
            BigDecimal amount = amountByMonth.getOrDefault(month, BigDecimal.ZERO);
            cumulativeAmount = cumulativeAmount.add(amount);
            responses.add(new HistoryTrendPointResponse(
                    YearMonth.of(year, month).toString(),
                    amount,
                    cumulativeAmount
            ));
        }
        return responses;
    }

    private int getAnnualTrendEndMonth(int year, LocalDate today) {
        if (year < today.getYear()) {
            return 12;
        }
        if (year == today.getYear()) {
            return today.getMonthValue();
        }
        return 0;
    }

    private boolean isSameMonth(LocalDate startDate, LocalDate endDate) {
        return YearMonth.from(startDate).equals(YearMonth.from(endDate));
    }

    private String formatTrendLabel(
            LocalDate startDate,
            LocalDate endDate,
            HistoryTrendPointProjection trendPoint
    ) {
        if (isSameMonth(startDate, endDate)) {
            return trendPoint.getTransactionDate().toString();
        }
        return YearMonth.of(trendPoint.getYear(), trendPoint.getMonth()).toString();
    }

    private Category getOrCreateCategory(String userId, CreateTransactionRequest request, OffsetDateTime now) {
        return getOrCreateCategory(userId, request.type(), request.categoryName(), now);
    }

    private Category getOrCreateCategory(
            String userId,
            TransactionType type,
            String requestedCategoryName,
            OffsetDateTime now
    ) {
        String categoryName = requestedCategoryName.trim();
        return categoryRepository.getVisibleCategory(userId, type, categoryName)
                .orElseGet(() -> categoryRepository.save(buildCustomCategory(userId, type, categoryName, now)));
    }

    private AccountingTransaction getRequiredTransaction(UUID id, String userId) {
        return transactionRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transaction not found"));
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

    private BigDecimal calculatePercentage(BigDecimal amount, BigDecimal totalAmount) {
        if (BigDecimal.ZERO.compareTo(totalAmount) == 0) {
            return BigDecimal.ZERO;
        }
        return amount.multiply(PERCENTAGE_MULTIPLIER)
                .divide(totalAmount, 2, RoundingMode.HALF_UP);
    }

    /**
     * 取得目前使用者 ID，並同步寫入資料庫 session 變數供 RLS 使用。
     *
     * 輸入：無。
     * 輸出：目前登入使用者 ID。
     * 可能錯誤：未登入或資料庫連線失敗時，往上拋出既有驗證或資料存取例外。
     */
    private String getCurrentUserId() {
        String userId = currentUserProvider.getCurrentUserId();
        databaseUserScope.activate(userId);
        return userId;
    }
}
