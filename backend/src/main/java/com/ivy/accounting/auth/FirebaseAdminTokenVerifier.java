package com.ivy.accounting.auth;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Firebase Admin SDK token 驗證器，負責驗證 ID token 並取出使用者識別資料。
 */
@Component
@ConditionalOnProperty(prefix = "app.auth", name = "firebase-enabled", havingValue = "true")
public class FirebaseAdminTokenVerifier implements FirebaseTokenVerifier {

    private final FirebaseAuth firebaseAuth;

    public FirebaseAdminTokenVerifier(FirebaseAuth firebaseAuth) {
        this.firebaseAuth = firebaseAuth;
    }

    /**
     * 驗證 Firebase ID token 並回傳使用者資料。
     *
     * 輸入：Firebase ID token。
     * 輸出：Firebase uid 與 email。
     * 可能錯誤：token 無效、過期或缺少 email 時回傳 401。
     */
    @Override
    public AuthenticatedUser verify(String idToken) {
        try {
            FirebaseToken token = firebaseAuth.verifyIdToken(idToken);
            String email = token.getEmail();
            if (email == null || email.isBlank()) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Firebase token email is required");
            }
            return new AuthenticatedUser(token.getUid(), email);
        } catch (FirebaseAuthException exception) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Firebase token is invalid", exception);
        }
    }
}
