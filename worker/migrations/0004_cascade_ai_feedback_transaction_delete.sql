alter table ai_quick_add_feedback
    drop constraint if exists ai_quick_add_feedback_transaction_id_fkey;

alter table ai_quick_add_feedback
    add constraint ai_quick_add_feedback_transaction_id_fkey
    foreign key (transaction_id)
    references accounting_transactions (id)
    on delete cascade;
