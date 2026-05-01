package com.ivy.accounting.auth;

/**
 * Firebase token 驗證介面，負責將前端傳入的 ID token 轉成已驗證使用者。
 */
public interface FirebaseTokenVerifier {

    /**
     * 驗證 Firebase ID token。
     *
     * 輸入：前端送出的 Firebase ID token。
     * 輸出：通過驗證的使用者 ID 與 email。
     * 可能錯誤：token 無效、過期或 Firebase 驗證失敗時拋出例外。
     */
    AuthenticatedUser verify(String idToken);
}
