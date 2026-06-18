
-- 1. Restrict profile updates: remove user UPDATE access entirely.
-- All profile writes (plan, usage, stripe ids) now happen server-side via service role.
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
REVOKE UPDATE ON public.profiles FROM authenticated;

-- 2. Harden match_user_source_chunks: drop the user_id parameter so callers
-- cannot search another user's chunks. Always scope to auth.uid().
DROP FUNCTION IF EXISTS public.match_user_source_chunks(uuid, vector, integer);

CREATE OR REPLACE FUNCTION public.match_user_source_chunks(
  query_embedding vector,
  match_count integer DEFAULT 6
)
RETURNS TABLE(id uuid, source_id uuid, content text, similarity double precision)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  select c.id, c.source_id, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.source_chunks c
  where c.user_id = auth.uid() and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

REVOKE ALL ON FUNCTION public.match_user_source_chunks(vector, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_user_source_chunks(vector, integer) TO authenticated;
