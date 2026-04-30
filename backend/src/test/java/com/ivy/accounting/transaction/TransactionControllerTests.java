package com.ivy.accounting.transaction;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 交易 API 整合測試，驗證首頁批次新增與最近明細 API 的 HTTP 行為。
 */
@SpringBootTest
class TransactionControllerTests {

    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private AccountingTransactionRepository transactionRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        transactionRepository.deleteAll();
        categoryRepository.deleteAll(categoryRepository.findAll().stream()
                .filter(category -> !category.isDefaultCategory())
                .toList());
    }

    @Test
    void createBatchReturnsCreatedTransactionsAndPersistsCustomCategory() throws Exception {
        String requestBody = """
                {
                  "transactions": [
                    {
                      "type": "EXPENSE",
                      "transactionDate": "2026-04-29",
                      "amount": 120,
                      "categoryName": "飲食",
                      "note": "午餐"
                    },
                    {
                      "type": "INCOME",
                      "transactionDate": "2026-04-29",
                      "amount": 3000,
                      "categoryName": "副業",
                      "note": "兼職"
                    }
                  ]
                }
                """;

        mockMvc.perform(post("/api/transactions/batch")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transactions.length()").value(2))
                .andExpect(jsonPath("$.transactions[0].type").value("EXPENSE"))
                .andExpect(jsonPath("$.transactions[0].categoryName").value("飲食"))
                .andExpect(jsonPath("$.transactions[0].note").value("午餐"))
                .andExpect(jsonPath("$.transactions[1].type").value("INCOME"))
                .andExpect(jsonPath("$.transactions[1].categoryName").value("副業"));

        assertThat(transactionRepository.findAll()).hasSize(2);
        assertThat(categoryRepository.findAll()).anySatisfy(category -> {
            assertThat(category.getName()).isEqualTo("副業");
            assertThat(category.getUserId()).isEqualTo("dev-user");
            assertThat(category.isDefaultCategory()).isFalse();
        });
    }

    @Test
    void listRecentReturnsRequestedLimit() throws Exception {
        createTransaction("EXPENSE", "2026-04-27", 80, "飲食", "第一筆");
        createTransaction("EXPENSE", "2026-04-28", 90, "交通", "第二筆");
        createTransaction("EXPENSE", "2026-04-29", 100, "運動", "第三筆");

        mockMvc.perform(get("/api/transactions/recent")
                        .param("limit", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void listHistoryReturnsDateRangeDetailsWithPaginationState() throws Exception {
        createTransaction("EXPENSE", "2026-04-26", 70, "飲食", "區間外");
        createTransaction("EXPENSE", "2026-04-27", 80, "飲食", "第一筆");
        createTransaction("EXPENSE", "2026-04-28", 90, "交通", "第二筆");
        createTransaction("EXPENSE", "2026-04-29", 100, "運動", "第三筆");
        createTransaction("INCOME", "2026-04-29", 3000, "薪資", "薪水");

        mockMvc.perform(get("/api/transactions/history")
                        .param("type", "EXPENSE")
                        .param("startDate", "2026-04-27")
                        .param("endDate", "2026-04-29")
                        .param("page", "0")
                        .param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transactions.length()").value(2))
                .andExpect(jsonPath("$.transactions[0].transactionDate").value("2026-04-29"))
                .andExpect(jsonPath("$.transactions[0].categoryName").value("運動"))
                .andExpect(jsonPath("$.transactions[1].transactionDate").value("2026-04-28"))
                .andExpect(jsonPath("$.hasNext").value(true));

        mockMvc.perform(get("/api/transactions/history")
                        .param("type", "EXPENSE")
                        .param("startDate", "2026-04-27")
                        .param("endDate", "2026-04-29")
                        .param("page", "1")
                        .param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transactions.length()").value(1))
                .andExpect(jsonPath("$.transactions[0].transactionDate").value("2026-04-27"))
                .andExpect(jsonPath("$.hasNext").value(false));
    }

    @Test
    void listCategorySummariesReturnsRecentThirtyDayTotalsAndPercentages() throws Exception {
        createTransaction("EXPENSE", "2026-04-29", 100, "飲食", "午餐");
        createTransaction("EXPENSE", "2026-04-28", 50, "飲食", "早餐");
        createTransaction("EXPENSE", "2026-04-27", 50, "交通", "捷運");
        createTransaction("EXPENSE", "2026-03-30", 999, "運動", "區間外");
        createTransaction("INCOME", "2026-04-29", 1000, "薪資", "薪水");

        mockMvc.perform(get("/api/transactions/category-summary")
                        .param("type", "EXPENSE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].categoryName").value("飲食"))
                .andExpect(jsonPath("$[0].amount").value(150))
                .andExpect(jsonPath("$[0].percentage").value(75.0))
                .andExpect(jsonPath("$[1].categoryName").value("交通"))
                .andExpect(jsonPath("$[1].amount").value(50))
                .andExpect(jsonPath("$[1].percentage").value(25.0));

        mockMvc.perform(get("/api/transactions/category-summary")
                        .param("type", "INCOME"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].categoryName").value("薪資"))
                .andExpect(jsonPath("$[0].amount").value(1000))
                .andExpect(jsonPath("$[0].percentage").value(100.0));
    }

    @Test
    void listCategorySummariesSupportsDateRange() throws Exception {
        createTransaction("EXPENSE", "2026-04-20", 500, "Food", "old");
        createTransaction("EXPENSE", "2026-04-27", 100, "Food", "in range");
        createTransaction("EXPENSE", "2026-04-28", 100, "Transit", "in range");
        createTransaction("EXPENSE", "2026-04-29", 300, "Shopping", "in range");

        mockMvc.perform(get("/api/transactions/category-summary")
                        .param("type", "EXPENSE")
                        .param("startDate", "2026-04-27")
                        .param("endDate", "2026-04-29"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].categoryName").value("Shopping"))
                .andExpect(jsonPath("$[0].amount").value(300))
                .andExpect(jsonPath("$[0].percentage").value(60.0));
    }

    @Test
    void listHistoryTrendReturnsMonthlyCumulativeAmountsForCrossMonthRange() throws Exception {
        createTransaction("EXPENSE", "2026-02-28", 999, "Food", "out of range");
        createTransaction("EXPENSE", "2026-03-01", 100, "Food", "march");
        createTransaction("EXPENSE", "2026-03-15", 50, "Food", "march");
        createTransaction("EXPENSE", "2026-04-01", 70, "Transit", "april");
        createTransaction("INCOME", "2026-04-01", 1000, "Salary", "income");

        mockMvc.perform(get("/api/transactions/history-trend")
                        .param("type", "EXPENSE")
                        .param("startDate", "2026-03-01")
                        .param("endDate", "2026-04-30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].label").value("2026-03"))
                .andExpect(jsonPath("$[0].amount").value(150))
                .andExpect(jsonPath("$[0].cumulativeAmount").value(150))
                .andExpect(jsonPath("$[1].label").value("2026-04"))
                .andExpect(jsonPath("$[1].amount").value(70))
                .andExpect(jsonPath("$[1].cumulativeAmount").value(220));
    }

    @Test
    void listHistoryTrendReturnsDailyCumulativeAmountsForSameMonthRange() throws Exception {
        createTransaction("EXPENSE", "2026-04-01", 100, "Food", "first day");
        createTransaction("EXPENSE", "2026-04-01", 50, "Transit", "same day");
        createTransaction("EXPENSE", "2026-04-03", 70, "Food", "third day");
        createTransaction("EXPENSE", "2026-04-29", 999, "Food", "out of range");
        createTransaction("INCOME", "2026-04-03", 1000, "Salary", "income");

        mockMvc.perform(get("/api/transactions/history-trend")
                        .param("type", "EXPENSE")
                        .param("startDate", "2026-04-01")
                        .param("endDate", "2026-04-28"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].label").value("2026-04-01"))
                .andExpect(jsonPath("$[0].amount").value(150))
                .andExpect(jsonPath("$[0].cumulativeAmount").value(150))
                .andExpect(jsonPath("$[1].label").value("2026-04-03"))
                .andExpect(jsonPath("$[1].amount").value(70))
                .andExpect(jsonPath("$[1].cumulativeAmount").value(220));
    }

    @Test
    void listHistoryTrendReturnsEmptyWhenNoData() throws Exception {
        createTransaction("INCOME", "2026-04-01", 1000, "Salary", "income");

        mockMvc.perform(get("/api/transactions/history-trend")
                        .param("type", "EXPENSE")
                        .param("startDate", "2026-04-01")
                        .param("endDate", "2026-04-30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void createBatchRejectsInvalidRequiredFields() throws Exception {
        String requestBody = """
                {
                  "transactions": [
                    {
                      "type": "EXPENSE",
                      "transactionDate": "2999-01-01",
                      "amount": 0,
                      "categoryName": "",
                      "note": "invalid"
                    }
                  ]
                }
                """;

        mockMvc.perform(post("/api/transactions/batch")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isBadRequest());

        assertThat(transactionRepository.findAll()).isEmpty();
    }

    /**
     * 透過 API 建立支出資料，讓最近明細測試不直接依賴 Service 實作細節。
     *
     * 輸入：日期、金額、類別與備註。
     * 輸出：無，成功後資料會寫入測試資料庫。
     * 可能錯誤：API 驗證或持久化失敗時拋出測試例外。
     */
    private void createTransaction(
            String type,
            String transactionDate,
            int amount,
            String categoryName,
            String note
    ) throws Exception {
        String requestBody = """
                {
                  "transactions": [
                    {
                      "type": "%s",
                      "transactionDate": "%s",
                      "amount": %d,
                      "categoryName": "%s",
                      "note": "%s"
                    }
                  ]
                }
                """.formatted(type, transactionDate, amount, categoryName, note);

        mockMvc.perform(post("/api/transactions/batch")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk());
    }

    @TestConfiguration
    static class FixedClockConfig {

        @Bean
        @Primary
        Clock fixedClock() {
            return Clock.fixed(Instant.parse("2026-04-29T00:00:00Z"), ZoneId.of("Asia/Taipei"));
        }
    }
}
