-- ============================================================
-- ScheduForge — Migration 004: Invite fixes
-- Apply in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Allow managers/owners to delete (revoke) invites in their org
CREATE POLICY "invites_delete" ON public.invites FOR DELETE
  USING (public.is_manager() AND org_id = public.my_org_id());
