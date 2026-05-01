package com.ivy.accounting.auth;

/**
 * 已驗證使用者資料，承載 Firebase 驗證後可用於授權與資料隔離的欄位。
 */
public record AuthenticatedUser(
        String userId,
        String email
) {
}
