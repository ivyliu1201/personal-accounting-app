package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.DatabaseMetaData;
import java.sql.Statement;

/**
 * Supabase PostgreSQL 的 RLS 遷移，H2 測試環境會自動跳過。
 */
public class V3__EnableSupabaseRowLevelSecurity extends BaseJavaMigration {

    /**
     * 執行 Supabase RLS 設定。
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
            statement.execute("""
                create or replace function current_app_user_id()
                    returns text
                    language sql
                    stable
                as
                $$
                    select nullif(current_setting('app.current_user_id', true), '')
                $$;
                """);
            statement.execute("alter table categories enable row level security");
            statement.execute("alter table accounting_transactions enable row level security");

            statement.execute("drop policy if exists categories_select_policy on categories");
            statement.execute("drop policy if exists categories_insert_policy on categories");
            statement.execute("drop policy if exists categories_update_policy on categories");
            statement.execute("drop policy if exists categories_delete_policy on categories");

            statement.execute("""
                create policy categories_select_policy
                    on categories
                    for select
                    using (
                        user_id is null
                        or user_id = current_app_user_id()
                    )
                """);
            statement.execute("""
                create policy categories_insert_policy
                    on categories
                    for insert
                    with check (
                        user_id = current_app_user_id()
                    )
                """);
            statement.execute("""
                create policy categories_update_policy
                    on categories
                    for update
                    using (
                        user_id = current_app_user_id()
                    )
                    with check (
                        user_id = current_app_user_id()
                    )
                """);
            statement.execute("""
                create policy categories_delete_policy
                    on categories
                    for delete
                    using (
                        user_id = current_app_user_id()
                    )
                """);

            statement.execute("drop policy if exists accounting_transactions_select_policy on accounting_transactions");
            statement.execute("drop policy if exists accounting_transactions_insert_policy on accounting_transactions");
            statement.execute("drop policy if exists accounting_transactions_update_policy on accounting_transactions");
            statement.execute("drop policy if exists accounting_transactions_delete_policy on accounting_transactions");

            statement.execute("""
                create policy accounting_transactions_select_policy
                    on accounting_transactions
                    for select
                    using (
                        user_id = current_app_user_id()
                    )
                """);
            statement.execute("""
                create policy accounting_transactions_insert_policy
                    on accounting_transactions
                    for insert
                    with check (
                        user_id = current_app_user_id()
                    )
                """);
            statement.execute("""
                create policy accounting_transactions_update_policy
                    on accounting_transactions
                    for update
                    using (
                        user_id = current_app_user_id()
                    )
                    with check (
                        user_id = current_app_user_id()
                    )
                """);
            statement.execute("""
                create policy accounting_transactions_delete_policy
                    on accounting_transactions
                    for delete
                    using (
                        user_id = current_app_user_id()
                    )
                """);

            statement.execute("alter table categories force row level security");
            statement.execute("alter table accounting_transactions force row level security");
        }
    }
}
