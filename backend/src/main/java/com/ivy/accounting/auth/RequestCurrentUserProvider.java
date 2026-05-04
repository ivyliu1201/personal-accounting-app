package com.ivy.accounting.auth;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 目前使用者提供者，優先使用 Firebase token，並可在本機開發時回退 dev user。
 */
@Component
public class RequestCurrentUserProvider implements CurrentUserProvider {

    private static final String BEARER_PREFIX = "Bearer ";

    private final FirebaseTokenVerifier firebaseTokenVerifier;
    private final String devUserId;
    private final boolean devFallbackEnabled;
    private final Set<String> allowedEmails;

    public RequestCurrentUserProvider(
            ObjectProvider<FirebaseTokenVerifier> firebaseTokenVerifierProvider,
            @Value("${app.auth.dev-user-id}") String devUserId,
            @Value("${app.auth.dev-fallback-enabled}") boolean devFallbackEnabled,
            @Value("${app.auth.allowed-emails}") String allowedEmails
    ) {
        this.firebaseTokenVerifier = firebaseTokenVerifierProvider.getIfAvailable();
        this.devUserId = devUserId;
        this.devFallbackEnabled = devFallbackEnabled;
        this.allowedEmails = parseAllowedEmails(allowedEmails);
    }

    /**
     * 取得目前 request 對應的使用者 ID。
     *
     * 輸入：HTTP Authorization header 或 dev fallback 設定。
     * 輸出：Firebase uid 或本機開發用 dev user id。
     * 可能錯誤：未登入、token 無效或 email 不在白名單時回傳 401 / 403。
     */
    @Override
    public String getCurrentUserId() {
        String authorizationHeader = getAuthorizationHeader();
        if (authorizationHeader != null && authorizationHeader.startsWith(BEARER_PREFIX)) {
            AuthenticatedUser user = verifyFirebaseUser(authorizationHeader.substring(BEARER_PREFIX.length()).trim());
            validateAllowedEmail(user.email());
            return devUserId;
        }

        if (devFallbackEnabled) {
            return devUserId;
        }

        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login is required");
    }

    /**
     * 讀取目前 request 的 Authorization header。
     *
     * 輸入：目前執行緒綁定的 servlet request。
     * 輸出：Authorization header，沒有 request 或 header 時回傳 null。
     * 可能錯誤：無。
     */
    private String getAuthorizationHeader() {
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes)) {
            return null;
        }
        HttpServletRequest request = attributes.getRequest();
        return request.getHeader("Authorization");
    }

    /**
     * 驗證 Firebase 使用者。
     *
     * 輸入：Firebase ID token。
     * 輸出：已驗證使用者。
     * 可能錯誤：Firebase 尚未啟用或 token 驗證失敗時回傳 401。
     */
    private AuthenticatedUser verifyFirebaseUser(String idToken) {
        if (firebaseTokenVerifier == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Firebase authentication is not enabled");
        }
        if (idToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Firebase token is required");
        }
        return firebaseTokenVerifier.verify(idToken);
    }

    /**
     * 檢查 email 是否允許使用本系統。
     *
     * 輸入：Firebase token 中的 email。
     * 輸出：無。
     * 可能錯誤：email 不在白名單時回傳 403。
     */
    private void validateAllowedEmail(String email) {
        if (allowedEmails.isEmpty()) {
            return;
        }
        String normalizedEmail = email.toLowerCase(Locale.ROOT);
        if (!allowedEmails.contains(normalizedEmail)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Email is not allowed");
        }
    }

    /**
     * 解析允許登入的 email 白名單。
     *
     * 輸入：以逗號分隔的 email 字串。
     * 輸出：小寫化後的 email set。
     * 可能錯誤：無。
     */
    private Set<String> parseAllowedEmails(String allowedEmailsValue) {
        if (allowedEmailsValue == null || allowedEmailsValue.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(allowedEmailsValue.split(","))
                .map(String::trim)
                .filter(email -> !email.isBlank())
                .map(email -> email.toLowerCase(Locale.ROOT))
                .collect(Collectors.toUnmodifiableSet());
    }
}
