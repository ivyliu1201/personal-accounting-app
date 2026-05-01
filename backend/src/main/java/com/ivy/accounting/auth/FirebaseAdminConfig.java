package com.ivy.accounting.auth;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Firebase Admin SDK 設定，僅在啟用 Firebase 驗證時初始化後端驗證用元件。
 */
@Configuration
@ConditionalOnProperty(prefix = "app.auth", name = "firebase-enabled", havingValue = "true")
public class FirebaseAdminConfig {

    /**
     * 建立 FirebaseApp。
     *
     * 輸入：service account JSON 檔案路徑。
     * 輸出：可供 FirebaseAuth 使用的 FirebaseApp。
     * 可能錯誤：路徑未設定、檔案不存在或 credentials 無法讀取時啟動失敗。
     */
    @Bean
    FirebaseApp firebaseApp(
            @Value("${app.auth.firebase-service-account-path}") String serviceAccountPath
    ) throws IOException {
        if (serviceAccountPath == null || serviceAccountPath.isBlank()) {
            throw new IllegalStateException("Firebase service account path is required when Firebase auth is enabled");
        }

        Path credentialsPath = Path.of(serviceAccountPath);
        try (InputStream inputStream = Files.newInputStream(credentialsPath)) {
            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(inputStream))
                    .build();
            if (FirebaseApp.getApps().isEmpty()) {
                return FirebaseApp.initializeApp(options);
            }
            return FirebaseApp.getInstance();
        }
    }

    /**
     * 建立 FirebaseAuth。
     *
     * 輸入：已初始化的 FirebaseApp。
     * 輸出：Firebase token 驗證服務。
     * 可能錯誤：FirebaseApp 初始化不完整時啟動失敗。
     */
    @Bean
    FirebaseAuth firebaseAuth(FirebaseApp firebaseApp) {
        return FirebaseAuth.getInstance(firebaseApp);
    }
}
