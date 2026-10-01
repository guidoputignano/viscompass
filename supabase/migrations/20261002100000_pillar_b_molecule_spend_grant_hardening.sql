-- PostgreSQL grants EXECUTE to PUBLIC on newly created functions by default.
-- Revoking only anon leaves that inherited privilege in place.
revoke execute on function public.pillar_b_molecule_spend(int, int, int)
  from public, anon;
grant execute on function public.pillar_b_molecule_spend(int, int, int)
  to authenticated;
