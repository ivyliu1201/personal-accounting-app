package com.ivy.accounting.transaction;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AccountingTransactionRepository extends JpaRepository<AccountingTransaction, UUID> {

    @EntityGraph(attributePaths = "category")
    List<AccountingTransaction> findByUserIdOrderByCreatedAtDesc(String userId, Pageable pageable);

    @EntityGraph(attributePaths = "category")
    Optional<AccountingTransaction> findByIdAndUserId(UUID id, String userId);

    @EntityGraph(attributePaths = "category")
    Slice<AccountingTransaction> findByUserIdAndTypeAndTransactionDateBetweenOrderByTransactionDateDescCreatedAtDesc(
            String userId,
            TransactionType type,
            LocalDate startDate,
            LocalDate endDate,
            Pageable pageable
    );

    @Query("""
            select t.category.name as categoryName, sum(t.amount) as amount
            from AccountingTransaction t
            where t.userId = :userId
              and t.type = :type
              and t.transactionDate between :startDate and :endDate
            group by t.category.name
            order by sum(t.amount) desc, t.category.name asc
            """)
    List<CategorySummaryProjection> listCategorySummaries(
            @Param("userId") String userId,
            @Param("type") TransactionType type,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate
    );

    @Query("""
            select year(t.transactionDate) as year,
                   month(t.transactionDate) as month,
                   sum(t.amount) as amount
            from AccountingTransaction t
            where t.userId = :userId
              and t.type = :type
              and t.transactionDate between :startDate and :endDate
            group by year(t.transactionDate), month(t.transactionDate)
            order by year(t.transactionDate) asc, month(t.transactionDate) asc
            """)
    List<HistoryTrendPointProjection> listMonthlyHistoryTrend(
            @Param("userId") String userId,
            @Param("type") TransactionType type,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate
    );

    @Query("""
            select t.transactionDate as transactionDate,
                   sum(t.amount) as amount
            from AccountingTransaction t
            where t.userId = :userId
              and t.type = :type
              and t.transactionDate between :startDate and :endDate
            group by t.transactionDate
            order by t.transactionDate asc
            """)
    List<HistoryTrendPointProjection> listDailyHistoryTrend(
            @Param("userId") String userId,
            @Param("type") TransactionType type,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate
    );

    @Query("""
            select year(t.transactionDate) as year,
                   month(t.transactionDate) as month,
                   sum(case when t.type = :incomeType
                       then t.amount else -t.amount end) as amount
            from AccountingTransaction t
            where t.userId = :userId
              and t.transactionDate between :startDate and :endDate
            group by year(t.transactionDate), month(t.transactionDate)
            order by year(t.transactionDate) asc, month(t.transactionDate) asc
            """)
    List<HistoryTrendPointProjection> listMonthlyCashFlowTrend(
            @Param("userId") String userId,
            @Param("incomeType") TransactionType incomeType,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate
    );
}
