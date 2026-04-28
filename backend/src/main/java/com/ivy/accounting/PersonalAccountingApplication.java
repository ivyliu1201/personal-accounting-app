package com.ivy.accounting;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 個人記帳系統後端應用程式入口，負責啟動 Spring Boot 應用與載入基礎設定。
 */
@SpringBootApplication
public class PersonalAccountingApplication {

    /**
     * 啟動個人記帳系統後端服務。
     *
     * 輸入：命令列啟動參數。
     * 輸出：無回傳值。
     * 可能錯誤：設定或依賴載入失敗時，Spring Boot 會中止啟動並輸出錯誤。
     */
    public static void main(String[] args) {
        SpringApplication.run(PersonalAccountingApplication.class, args);
    }
}
