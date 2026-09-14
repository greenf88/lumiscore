create table if not exists public.taste_test_responses (
  user_id uuid not null references auth.users (id) on delete cascade,
  quiz_version text not null,
  question_key text not null,
  choice text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, quiz_version, question_key),
  constraint taste_test_responses_choice_check
    check (choice in ('left', 'right', 'neither')),
  constraint taste_test_responses_version_check
    check (length(trim(quiz_version)) > 0),
  constraint taste_test_responses_question_check
    check (length(trim(question_key)) > 0)
);

comment on table public.taste_test_responses is
  'Versioned pairwise Taste Test answers owned by an authenticated reader.';

alter table public.taste_test_responses enable row level security;
alter table public.taste_test_responses force row level security;

revoke all on table public.taste_test_responses from anon, authenticated;
grant select, insert, update, delete on table public.taste_test_responses
  to authenticated;

create policy "taste_test_responses_select_own"
on public.taste_test_responses for select to authenticated
using ((select auth.uid()) = user_id);

create policy "taste_test_responses_insert_own"
on public.taste_test_responses for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "taste_test_responses_update_own"
on public.taste_test_responses for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "taste_test_responses_delete_own"
on public.taste_test_responses for delete to authenticated
using ((select auth.uid()) = user_id);
