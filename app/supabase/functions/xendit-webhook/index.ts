// KURSI — Xendit webhook receiver: verifies token, marks order PAID in kursi_state
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const TOKEN = Deno.env.get('XENDIT_WEBHOOK_TOKEN') ?? '';
const URL_ = Deno.env.get('SUPABASE_URL') ?? '';
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.headers.get('x-callback-token') !== TOKEN) return new Response('unauthorized', { status: 401 });
  const evt = await req.json().catch(() => ({}));
  const d = evt?.data ?? {};
  const paid = evt?.event === 'qr.payment' && (d.status === 'COMPLETED' || d.status === 'SUCCEEDED' || d.status === 'PAID');
  if (!paid) return json({ received: true, ignored: evt?.event });
  const res = await fetch(URL_ + '/rest/v1/kursi_state?select=state', { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } });
  const rows = await res.json();
  const state = rows?.[0]?.state;
  const order = state?.orders?.find((o: any) => o.id === d.external_id);
  if (!order) return json({ ok: false, error: 'order not found' }, 404);
  if (order.paymentStatus === 'PAID') return json({ ok: true, already: true });
  const at = new Date().toISOString();
  order.paymentStatus = 'PAID';
  order.paymentMethod = 'QRIS';
  order.orderStatus = 'NEW';
  order.payments.push({ id: 'pay_x_' + d.id, method: 'QRIS', amount: order.total, status: 'PAID', ref: String(d.id), at });
  order.timeline.push({ status: 'PAID', at }, { status: 'NEW', at });
  order.updatedAt = at;
  state.meta = state.meta ?? {}; state.meta.updatedAt = at;
  const up = await fetch(URL_ + '/rest/v1/kursi_state?id=eq.1', {
    method: 'PATCH', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ state, updated_at: at })
  });
  return json({ ok: up.ok });
});
