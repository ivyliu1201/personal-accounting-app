package com.ivy.accounting.transaction;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public class AccountingTransactionRepository {

    private final JdbcClient jdbcClient;

    public AccountingTransactionRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public void create(AccountingTransaction transaction) {
        jdbcClient.sql("""
                        insert into accounting_transactions (
                            id, user_id, type, transaction_date, amount, category_id, note, created_at
                        )
                        values (
                            :id, :userId, :type, :transactionDate, :amount, :categoryId, :note, :createdAt
                        )
                        """)
                .param("id", transaction.getId())
                .param("userId", transaction.getUserId())
                .param("type", transaction.getType().name())
                .param("transactionDate", transaction.getTransactionDate())
                .param("amount", transaction.getAmount())
                .param("categoryId", transaction.getCategoryId())
                .param("note", transaction.getNote())
                .param("createdAt", transaction.getCreatedAt())
                .update();
    }

    public List<AccountingTransaction> listRecent(String userId, int limit) {
        return jdbcClient.sql("""
                        select t.id,
                               t.user_id,
                               t.type,
                               t.transaction_date,
                               t.amount,
                               t.category_id,
                               c.name as category_name,
                               t.note,
                               t.created_at
                        from accounting_transactions t
                        join categories c on c.id = t.category_id
                        where t.user_id = :userId
                        order by t.created_at desc
                        limit :limit
                        """)
                .param("userId", userId)
                .param("limit", limit)
                .query(this::mapTransaction)
                .list();
    }

    private AccountingTransaction mapTransaction(ResultSet resultSet, int rowNumber) throws SQLException {
        AccountingTransaction transaction = new AccountingTransaction();
        transaction.setId(resultSet.getObject("id", UUID.class));
        transaction.setUserId(resultSet.getString("user_id"));
        transaction.setType(TransactionType.valueOf(resultSet.getString("type")));
        transaction.setTransactionDate(resultSet.getDate("transaction_date").toLocalDate());
        transaction.setAmount(resultSet.getBigDecimal("amount"));
        transaction.setCategoryId(resultSet.getObject("category_id", UUID.class));
        transaction.setCategoryName(resultSet.getString("category_name"));
        transaction.setNote(resultSet.getString("note"));
        transaction.setCreatedAt(resultSet.getObject("created_at", OffsetDateTime.class));
        return transaction;
    }
}
