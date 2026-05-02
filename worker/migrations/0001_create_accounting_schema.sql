create table categories (
    id text primary key,
    user_id text,
    type text not null,
    name text not null,
    default_category integer not null,
    created_at text not null,
    constraint ck_categories_type check (type in ('INCOME', 'EXPENSE')),
    constraint ck_categories_default_category check (default_category in (0, 1)),
    constraint uk_categories_scope unique (user_id, type, name)
);

create table accounting_transactions (
    id text primary key,
    user_id text not null,
    type text not null,
    transaction_date text not null,
    amount numeric not null,
    category_id text not null references categories (id),
    note text,
    created_at text not null,
    constraint ck_transactions_type check (type in ('INCOME', 'EXPENSE')),
    constraint ck_transactions_amount check (amount > 0)
);

create index idx_transactions_user_created_at
    on accounting_transactions (user_id, created_at desc);

create index idx_transactions_user_date
    on accounting_transactions (user_id, transaction_date desc);

insert into categories (id, user_id, type, name, default_category, created_at)
values
    ('10000000-0000-0000-0000-000000000001', null, 'EXPENSE', '飲食', 1, current_timestamp),
    ('10000000-0000-0000-0000-000000000002', null, 'EXPENSE', '交通', 1, current_timestamp),
    ('10000000-0000-0000-0000-000000000003', null, 'EXPENSE', '投資', 1, current_timestamp),
    ('10000000-0000-0000-0000-000000000004', null, 'EXPENSE', '繳費', 1, current_timestamp),
    ('10000000-0000-0000-0000-000000000005', null, 'EXPENSE', '自我成長', 1, current_timestamp),
    ('10000000-0000-0000-0000-000000000006', null, 'EXPENSE', '社交', 1, current_timestamp),
    ('10000000-0000-0000-0000-000000000007', null, 'EXPENSE', '治裝費', 1, current_timestamp),
    ('10000000-0000-0000-0000-000000000008', null, 'EXPENSE', '運動', 1, current_timestamp),
    ('20000000-0000-0000-0000-000000000001', null, 'INCOME', '投資', 1, current_timestamp),
    ('20000000-0000-0000-0000-000000000002', null, 'INCOME', '薪資', 1, current_timestamp);
