\set ON_ERROR_STOP on
-- LOCAL disposable users only. Never run against a hosted project.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('77000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','step7b-a@local.invalid','NOT_A_LOGIN',now(),'{"provider":"email"}','{"name":"Local A"}',now(),now()),
('77000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','step7b-b@local.invalid','NOT_A_LOGIN',now(),'{"provider":"email"}','{"name":"Local B"}',now(),now());
do $test$
begin
if (select count(*) from public.profiles where id in ('77000000-0000-0000-0000-000000000001','77000000-0000-0000-0000-000000000002'))<>2
or (select count(*) from public.subscriptions where plan_id='free' and user_id in ('77000000-0000-0000-0000-000000000001','77000000-0000-0000-0000-000000000002'))<>2
or not exists(select 1 from public.profiles where id='77000000-0000-0000-0000-000000000001' and display_name='Local A')
then raise exception 'Original handle_new_user did not provision both local users';end if;
end $test$;
insert into public.saved_builds(id,user_id,name) values
('77000000-0000-0000-0000-000000000011','77000000-0000-0000-0000-000000000001','Test A'),
('77000000-0000-0000-0000-000000000012','77000000-0000-0000-0000-000000000002','Test B');
insert into public.payment_methods(id,user_id,brand,last4,exp_month,exp_year)
values('77000000-0000-0000-0000-000000000021','77000000-0000-0000-0000-000000000002','TEST','1234',1,2099);
insert into public.invoices(id,user_id,number,description,amount_cents)
values('77000000-0000-0000-0000-000000000031','77000000-0000-0000-0000-000000000002','LOCAL-TEST','SYNTHETIC',0);
insert into public.usage_counters(user_id,period_start)
values('77000000-0000-0000-0000-000000000002','2026-10-01');
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','77000000-0000-0000-0000-000000000001',true);
do $alice$
declare n integer;
begin
if (select count(*) from public.profiles)<>1 or (select count(*) from public.subscriptions)<>1
or (select count(*) from public.saved_builds)<>1 or (select count(*) from public.plans)<>3
or (select count(*) from public.payment_methods)<>0 or (select count(*) from public.invoices)<>0
or (select count(*) from public.usage_counters)<>0 then
raise exception 'User A can see another users private records';end if;
update public.profiles set display_name='A updated' where id='77000000-0000-0000-0000-000000000001';
get diagnostics n=row_count;if n<>1 then raise exception 'Owner profile update denied';end if;
update public.profiles set display_name='ILLEGAL' where id='77000000-0000-0000-0000-000000000002';
get diagnostics n=row_count;if n<>0 then raise exception 'Other user profile update permitted';end if;
insert into public.saved_builds(id,user_id,name)
values('77000000-0000-0000-0000-000000000013','77000000-0000-0000-0000-000000000001','New A');
if (select count(*) from public.saved_builds)<>2 then raise exception 'Owner saved-build write denied';end if;
end $alice$;
rollback;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','77000000-0000-0000-0000-000000000002',true);
do $bob$
begin
if (select count(*) from public.profiles)<>1 or (select count(*) from public.subscriptions)<>1
or (select count(*) from public.saved_builds)<>1 or (select count(*) from public.payment_methods)<>1
or (select count(*) from public.invoices)<>1 or (select count(*) from public.usage_counters)<>1
then raise exception 'User B cannot read own permitted rows';end if;end $bob$;
rollback;
begin;
set local role anon;
do $public$
begin
if (select count(*) from public.plans)<>3 or (select count(*) from public.profiles)<>0
then raise exception 'Plans must be public while profiles remain private';end if;
end $public$;
rollback;
select jsonb_build_object('result','STEP7B_AUTH_RLS_PASS',
'users',(select count(*) from auth.users where email like 'step7b-%@local.invalid'),
'profiles',(select count(*) from public.profiles),
'freeSubscriptions',(select count(*) from public.subscriptions where plan_id='free'),
'plans',(select count(*) from public.plans));
