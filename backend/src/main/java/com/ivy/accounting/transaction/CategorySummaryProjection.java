package com.ivy.accounting.transaction;

import java.math.BigDecimal;

/**
 * 類別摘要查詢投影，承載資料庫彙總後的類別名稱與金額。
 */
public interface CategorySummaryProjection {

    /**
     * 取得彙總類別名稱。
     *
     * 輸入：無。
     * 輸出：類別名稱。
     * 可能錯誤：無。
     */
    String getCategoryName();

    /**
     * 取得彙總金額。
     *
     * 輸入：無。
     * 輸出：該類別在查詢範圍內的總金額。
     * 可能錯誤：無。
     */
    BigDecimal getAmount();
}
