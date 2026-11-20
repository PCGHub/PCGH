-- Staging-only: task report feedback and resolution.
alter table public.campaign_reports add column if not exists status text not null default 'pending' check (status in ('pending','in_review','resolved'));
alter table public.campaign_reports add column if not exists admin_feedback text;
alter table public.campaign_reports add column if not exists feedback_at timestamptz;
alter table public.campaign_reports add column if not exists resolved_at timestamptz;
alter table public.campaign_reports add column if not exists member_seen_at timestamptz;

create or replace function public.respond_to_campaign_report(p_report_id uuid,p_feedback text,p_status text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not public.campaign_admin() then raise exception 'Admin authorization required'; end if;
 if p_status not in ('in_review','resolved') then raise exception 'Invalid report status'; end if;
 if length(trim(coalesce(p_feedback,''))) < 2 or length(p_feedback)>2000 then raise exception 'Feedback must be 2-2000 characters'; end if;
 update public.campaign_reports set status=p_status,admin_feedback=trim(p_feedback),feedback_at=now(),member_seen_at=null,resolved_at=case when p_status='resolved' then now() else null end where id=p_report_id;
 if not found then raise exception 'Report not found'; end if;
end $$;

create or replace function public.mark_campaign_report_seen(p_report_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 update public.campaign_reports set member_seen_at=now() where id=p_report_id and user_id=auth.uid() and feedback_at is not null and member_seen_at is null;
end $$;
revoke all on function public.respond_to_campaign_report(uuid,text,text) from public,anon;
revoke all on function public.mark_campaign_report_seen(uuid) from public,anon;
grant execute on function public.respond_to_campaign_report(uuid,text,text) to authenticated;
grant execute on function public.mark_campaign_report_seen(uuid) to authenticated;
