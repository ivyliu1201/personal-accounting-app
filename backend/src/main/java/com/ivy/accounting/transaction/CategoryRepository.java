package com.ivy.accounting.transaction;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CategoryRepository extends JpaRepository<Category, UUID> {

    @Query("""
            select c
            from Category c
            where c.type = :type
              and c.name = :name
              and (c.userId = :userId or c.userId is null)
            order by c.defaultCategory desc
            """)
    List<Category> listVisibleCategories(
            @Param("userId") String userId,
            @Param("type") TransactionType type,
            @Param("name") String name
    );

    @Query("""
            select distinct c.name
            from Category c
            where c.type = :type
              and (c.userId = :userId or c.userId is null)
            order by c.name asc
            """)
    List<String> listVisibleCategoryNames(
            @Param("userId") String userId,
            @Param("type") TransactionType type
    );

    default Optional<Category> getVisibleCategory(String userId, TransactionType type, String name) {
        return listVisibleCategories(userId, type, name).stream().findFirst();
    }
}
