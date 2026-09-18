/* ============================================================
   KURSI Backend — optional Supabase sync adapter.
   When configured (Admin → Settings → Backend Sync), the whole
   app state is mirrored to a `kursi_state` table and polled for
   changes, giving real multi-device sync across customer phones,
   cashier terminals and the kitchen display.

   Setup (run once in Supabase SQL editor):
     create table kursi_state (
       id int primary key,
       state jsonb,
       updated_at timestamptz default now()
     );
     insert into kursi_state (id, state) values (1, '{}');
     alter table kursi_state enable row level security;
     create policy "kursi_demo_all" on kursi_state
       for all to anon using (true) with check (true);
   ============================================================ */
(function () {
  'use strict';
  const CFG_KEY = 'kursi_backend_cfg';
  let cfg = null;
  try { cfg = JSON.parse(localStorage.getItem(CFG_KEY)); } catch (e) { cfg = null; }
  // pre-configured demo backend (anon key is public by design; RLS policy required)
  if (!cfg) cfg = {
    url: 'https://ngazttpahttzabxghjdq.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nYXp0dHBhaHR0emFieGdoamRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MzUyNDYsImV4cCI6MjEwNTIxMTI0Nn0.d8uByGJ7aw_PYpno47R2gkim1shicTbKBDuaGjIaDLU',
    enabled: true
  };

  function configured() { return !!(cfg && cfg.url && cfg
