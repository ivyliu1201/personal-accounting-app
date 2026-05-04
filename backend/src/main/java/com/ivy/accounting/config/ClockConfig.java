package com.ivy.accounting.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.ZoneId;
import org.springframework.boot.validation.autoconfigure.ValidationConfigurationCustomizer;

/**
 * 應用程式時間設定，統一以台北時區判斷今天與現在時間。
 */
@Configuration
public class ClockConfig {

    private static final ZoneId APP_ZONE = ZoneId.of("Asia/Taipei");

    /**
     * 提供業務邏輯使用的應用程式 Clock。
     *
     * 輸入：無。
     * 輸出：固定為 Asia/Taipei 時區的 Clock。
     * 可能錯誤：時區 ID 無效時會在啟動階段拋出例外。
     */
    @Bean
    Clock clock() {
        return Clock.system(APP_ZONE);
    }

    /**
     * 讓 Bean Validation 的日期限制與應用程式 Clock 使用相同時區。
     *
     * 輸入：應用程式 Clock。
     * 輸出：Validation 設定客製化器。
     * 可能錯誤：無預期業務錯誤，設定失敗時會在啟動階段拋出例外。
     */
    @Bean
    ValidationConfigurationCustomizer validationClockCustomizer(Clock clock) {
        return configuration -> configuration.clockProvider(() -> clock);
    }
}
