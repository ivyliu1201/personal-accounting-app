create table if not exists categories (
    id uuid primary key,
    user_id varchar(128),
    type varchar(16) not null,
    name varchar(64) not null,
    default_category boolean not null,
    created_at timestamp with time zone not null,
    constraint ck_categories_type check (type in ('INCOME', 'EXPENSE')),
    constraint uk_categories_scope unique (user_id, type, name)
);

create table if not exists accounting_transactions (
    id uuid primary key,
    user_id varchar(128) not null,
    type varchar(16) not null,
    transaction_date date not null,
    amount numeric(19, 2) not null,
    category_id uuid not null references categories (id),
    note varchar(255),
    created_at timestamp with time zone not null,
    constraint ck_transactions_type check (type in ('INCOME', 'EXPENSE')),
    constraint ck_transactions_amount check (amount > 0)
);

create index if not exists idx_transactions_user_created_at
    on accounting_transactions (user_id, created_at desc);

create index if not exists idx_transactions_user_date
    on accounting_transactions (user_id, transaction_date desc);

insert into categories (id, user_id, type, name, default_category, created_at)
values
    ('10000000-0000-0000-0000-000000000001', null, 'EXPENSE', '飲食', true, current_timestamp),
    ('10000000-0000-0000-0000-000000000002', null, 'EXPENSE', '交通', true, current_timestamp),
    ('10000000-0000-0000-0000-000000000003', null, 'EXPENSE', '投資', true, current_timestamp),
    ('10000000-0000-0000-0000-000000000004', null, 'EXPENSE', '繳費', true, current_timestamp),
    ('10000000-0000-0000-0000-000000000005', null, 'EXPENSE', '自我成長', true, current_timestamp),
    ('10000000-0000-0000-0000-000000000006', null, 'EXPENSE', '社交', true, current_timestamp),
    ('10000000-0000-0000-0000-000000000007', null, 'EXPENSE', '治裝費', true, current_timestamp),
    ('10000000-0000-0000-0000-000000000008', null, 'EXPENSE', '運動', true, current_timestamp),
    ('20000000-0000-0000-0000-000000000001', null, 'INCOME', '投資', true, current_timestamp),
    ('20000000-0000-0000-0000-000000000002', null, 'INCOME', '薪資', true, current_timestamp);
