package com.ivy.accounting.transaction;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public class CategoryRepository {

    private final JdbcClient jdbcClient;

    public CategoryRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public Optional<Category> getVisibleCategory(String userId, TransactionType type, String name) {
        return jdbcClient.sql("""
                        select id, user_id, type, name, default_category, created_at
                        from categories
                        where type = :type
                          and name = :name
                          and (user_id = :userId or user_id is null)
                        order by default_category desc
                        limit 1
                        """)
                .param("type", type.name())
                .param("name", name)
                .param("userId", userId)
                .query(this::mapCategory)
                .optional();
    }

    public Category createCustomCategory(String userId, TransactionType type, String name, OffsetDateTime createdAt) {
        Category category = new Category();
        category.setId(UUID.randomUUID());
        category.setUserId(userId);
        category.setType(type);
        category.setName(name);
        category.setDefaultCategory(false);
        category.setCreatedAt(createdAt);

        jdbcClient.sql("""
                        insert into categories (id, user_id, type, name, default_category, created_at)
                        values (:id, :userId, :type, :name, :defaultCategory, :createdAt)
                        """)
                .param("id", category.getId())
                .param("userId", category.getUserId())
                .param("type", category.getType().name())
                .param("name", category.getName())
                .param("defaultCategory", category.isDefaultCategory())
                .param("createdAt", category.getCreatedAt())
                .update();

        return category;
    }

    private Category mapCategory(ResultSet resultSet, int rowNumber) throws SQLException {
        Category category = new Category();
        category.setId(resultSet.getObject("id", UUID.class));
        category.setUserId(resultSet.getString("user_id"));
        category.setType(TransactionType.valueOf(resultSet.getString("type")));
        category.setName(resultSet.getString("name"));
        category.setDefaultCategory(resultSet.getBoolean("default_category"));
        category.setCreatedAt(resultSet.getObject("created_at", OffsetDateTime.class));
        return category;
    }
}
