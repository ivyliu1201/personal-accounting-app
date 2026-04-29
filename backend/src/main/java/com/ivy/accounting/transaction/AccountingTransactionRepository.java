package com.ivy.accounting.transaction;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AccountingTransactionRepository extends JpaRepository<AccountingTransaction, UUID> {

    @EntityGraph(attributePaths = "category")
    List<AccountingTransaction> findByUserIdOrderByCreatedAtDesc(String userId, Pageable pageable);
}
