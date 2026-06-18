grant usage on schema public to service_role;

grant select, insert, update, delete
    on table ai_quick_add_feedback
    to service_role;
