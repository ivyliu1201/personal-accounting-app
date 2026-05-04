package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.DatabaseMetaData;
import java.sql.Statement;

/**
 * Supabase REST API 使用的 service_role 權限遷移，H2 測試環境會自動跳過。
 */
public class V4__GrantSupabaseApiRolePrivileges extends BaseJavaMigration {

    /**
     * 執行 Supabase service_role grant。
     *
     * 輸入：Flyway migration context。
     * 輸出：無。
     * 可能錯誤：資料庫連線或 SQL 執行失敗時往上拋出。
     */
    @Override
    public void migrate(Context context) throws Exception {
        DatabaseMetaData metaData = context.getConnection().getMetaData();
        String databaseProductName = metaData.getDatabaseProductName();
        if (databaseProductName == null || !databaseProductName.toLowerCase().contains("postgresql")) {
            return;
        }

        try (Statement statement = context.getConnection().createStatement()) {
            statement.execute("grant usage on schema public to service_role");
            statement.execute("""
                grant select, insert, update, delete
                    on table categories, accounting_transactions
                    to service_role
                """);
        }
    }
}
