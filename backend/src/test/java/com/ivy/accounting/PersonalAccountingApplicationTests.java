package com.ivy.accounting;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * 應用程式啟動測試，確認 Spring Boot 基礎設定可以載入。
 */
@SpringBootTest
class PersonalAccountingApplicationTests {

    /**
     * 驗證 Spring 應用程式內容可正常建立。
     *
     * 輸入：無。
     * 輸出：無回傳值。
     * 可能錯誤：Spring 設定或依賴無法載入時測試失敗。
     */
    @Test
    void contextLoads() {
    }
}
