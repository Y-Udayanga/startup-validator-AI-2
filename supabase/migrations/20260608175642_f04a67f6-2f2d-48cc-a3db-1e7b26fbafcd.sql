
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.match_user_source_chunks(uuid, vector, integer) from public, anon;
-- keep authenticated execute for match function (called via RPC by signed-in users for their own data)
