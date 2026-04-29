create table categories (
    id uuid primary key,
    user_id varchar(128),
    type varchar(16) not null,
    name varchar(64) not null,
    default_category boolean not null,
    created_at timestamp with time zone not null,
    constraint ck_categories_type check (type in ('INCOME', 'EXPENSE')),
    constraint uk_categories_scope unique (user_id, type, name)
);

create table accounting_transactions (
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

create index idx_transactions_user_created_at
    on accounting_transactions (user_id, created_at desc);

create index idx_transactions_user_date
    on accounting_transactions (user_id, transaction_date desc);
