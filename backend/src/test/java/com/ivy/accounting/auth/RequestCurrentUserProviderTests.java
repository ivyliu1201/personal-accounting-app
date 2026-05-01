package com.ivy.accounting.auth;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 目前使用者提供者測試，驗證 Firebase token、email 白名單與 dev fallback 行為。
 */
class RequestCurrentUserProviderTests {

    @AfterEach
    void tearDown() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void getCurrentUserIdReturnsDevUserWhenNoTokenAndFallbackEnabled() {
        RequestCurrentUserProvider provider = new RequestCurrentUserProvider(
                emptyVerifierProvider(),
                "dev-user",
                true,
                "fannyliu1201@gmail.com"
        );

        assertThat(provider.getCurrentUserId()).isEqualTo("dev-user");
    }

    @Test
    void getCurrentUserIdReturnsFirebaseUidWhenEmailIsAllowed() {
        FirebaseTokenVerifier verifier = token -> new AuthenticatedUser("firebase-user-id", "FannyLiu1201@gmail.com");
        RequestCurrentUserProvider provider = new RequestCurrentUserProvider(
                verifierProvider(verifier),
                "dev-user",
                false,
                "fannyliu1201@gmail.com,ccindy0602@gmail.com"
        );
        bindAuthorizationHeader("Bearer valid-token");

        assertThat(provider.getCurrentUserId()).isEqualTo("firebase-user-id");
    }

    @Test
    void getCurrentUserIdRejectsFirebaseUserWhenEmailIsNotAllowed() {
        FirebaseTokenVerifier verifier = token -> new AuthenticatedUser("firebase-user-id", "other@example.com");
        RequestCurrentUserProvider provider = new RequestCurrentUserProvider(
                verifierProvider(verifier),
                "dev-user",
                false,
                "fannyliu1201@gmail.com,ccindy0602@gmail.com"
        );
        bindAuthorizationHeader("Bearer valid-token");

        assertThatThrownBy(provider::getCurrentUserId)
                .isInstanceOf(ResponseStatusException.class)
                .extracting(exception -> ((ResponseStatusException) exception).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    /**
     * 綁定測試 request 的 Authorization header。
     *
     * 輸入：Authorization header 值。
     * 輸出：無。
     * 可能錯誤：無。
     */
    private void bindAuthorizationHeader(String authorizationHeader) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", authorizationHeader);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }

    /**
     * 建立沒有 Firebase verifier 的 ObjectProvider。
     *
     * 輸入：無。
     * 輸出：回傳 null verifier 的 ObjectProvider。
     * 可能錯誤：無。
     */
    private ObjectProvider<FirebaseTokenVerifier> emptyVerifierProvider() {
        return verifierProvider(null);
    }

    /**
     * 建立測試用 Firebase verifier provider。
     *
     * 輸入：測試用 FirebaseTokenVerifier。
     * 輸出：回傳指定 verifier 的 ObjectProvider。
     * 可能錯誤：無。
     */
    private ObjectProvider<FirebaseTokenVerifier> verifierProvider(FirebaseTokenVerifier verifier) {
        @SuppressWarnings("unchecked")
        ObjectProvider<FirebaseTokenVerifier> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(verifier);
        return provider;
    }
}
