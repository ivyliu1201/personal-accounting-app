package com.ivy.accounting.auth;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.PreparedStatement;

import org.springframework.jdbc.core.ConnectionCallback;

/**
 * 資料庫使用者範圍服務，負責把目前登入使用者寫入 PostgreSQL session 變數，供 Supabase RLS 讀取。
 */
@Component
public class DatabaseUserScope {

    private static final String SET_CURRENT_USER_SQL = "select set_config('app.current_user_id', ?, true)";

    private final JdbcTemplate jdbcTemplate;

    /**
     * 建立資料庫使用者範圍服務。
     *
     * 輸入：Spring 注入的 JdbcTemplate。
     * 輸出：無。
     * 可能錯誤：無。
     */
    public DatabaseUserScope(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * 將目前使用者 ID 寫入資料庫 session 變數。
     *
     * 輸入：Firebase 驗證後的使用者 ID。
     * 輸出：無。
     * 可能錯誤：資料庫連線失敗時會往上拋出資料存取例外。
     */
    public void activate(String userId) {
        jdbcTemplate.execute((ConnectionCallback<Void>) connection -> {
            try (PreparedStatement preparedStatement = connection.prepareStatement(SET_CURRENT_USER_SQL)) {
                preparedStatement.setString(1, userId);
                preparedStatement.execute();
            }
            return null;
        });
    }
}
