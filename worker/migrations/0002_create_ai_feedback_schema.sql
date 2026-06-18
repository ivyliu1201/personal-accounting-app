create table ai_quick_add_feedback (
    id uuid primary key,
    user_id text not null,
    transaction_id uuid not null references accounting_transactions (id),
    quick_add_session_id text,
    quick_add_input_text text,
    feedback_type text not null,
    suggestion_id text,
    source_text text,
    item_text text,
    model_label text,
    model_type text,
    model_category text,
    mapped_type text,
    mapped_category_name text,
    final_type text not null,
    final_category text not null,
    final_amount numeric not null,
    final_transaction_date date not null,
    final_note text,
    confidence numeric,
    needs_review boolean,
    date_source text,
    mapping_source text,
    created_at timestamp with time zone not null,
    constraint ck_ai_feedback_type check (feedback_type in ('accepted', 'corrected', 'missed_by_ai')),
    constraint ck_ai_feedback_model_type check (model_type is null or model_type in ('INCOME', 'EXPENSE')),
    constraint ck_ai_feedback_mapped_type check (mapped_type is null or mapped_type in ('INCOME', 'EXPENSE')),
    constraint ck_ai_feedback_final_type check (final_type in ('INCOME', 'EXPENSE')),
    constraint ck_ai_feedback_final_amount check (final_amount > 0),
    constraint ck_ai_feedback_confidence check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create index idx_ai_feedback_user_created_at
    on ai_quick_add_feedback (user_id, created_at desc);

create index idx_ai_feedback_transaction
    on ai_quick_add_feedback (transaction_id);

create index idx_ai_feedback_session
    on ai_quick_add_feedback (quick_add_session_id);
