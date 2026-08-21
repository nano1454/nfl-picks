-- Atomically renames a participant everywhere their full_name is duplicated
-- as a join key (picks/bonus_picks/tiebreakers/leaderboard/participants/
-- week_payments all store it as plain text with no FK). Looks the old name
-- up server-side from app_users by id rather than trusting a client-supplied
-- old name, so it can't rename the wrong rows on stale/racy input.
create or replace function rename_participant_full_name(p_user_id uuid, p_new_name text)
returns void
language plpgsql
as $$
declare
  v_old_name text;
begin
  select full_name into v_old_name from app_users where id = p_user_id;
  if v_old_name is null then
    raise exception 'user not found';
  end if;
  if v_old_name = p_new_name then
    return;
  end if;

  update app_users set full_name = p_new_name where id = p_user_id;
  update participants set user_name = p_new_name where user_name = v_old_name;
  update picks set user_name = p_new_name where user_name = v_old_name;
  update bonus_picks set user_name = p_new_name where user_name = v_old_name;
  update tiebreakers set user_name = p_new_name where user_name = v_old_name;
  update leaderboard set user_name = p_new_name where user_name = v_old_name;
  update week_payments set user_name = p_new_name where user_name = v_old_name;
end;
$$;
