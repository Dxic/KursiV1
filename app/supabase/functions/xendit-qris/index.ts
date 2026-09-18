// KURSI — Xendit QRIS proxy (create QR + sandbox simulate)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const KEY = Deno.env.get('XENDIT_SECRET') ?? '';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Content-Type': 'application/json' };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: cors });
const auth = 'Basic ' + btoa(KEY + ':');

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json();
    if (body.action === 'simulate') {
      const r = await fetch(`https://api.xendit.co/qr_codes/${encodeURIComponent(body.qr_id)}/payments/simulate`, {
        method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: body.amount })
      });
      return json({ ok: r.ok, data: await r.json() });
    }
    const r = await fetch('https://api.xendit.co/qr_codes', {
      method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        external_id: body.external_id, type: 'DYNAMIC', currency: 'IDR', amount: body.amount,
        channel_code: 'ID_QRIS',
        callback_url: (Deno.env.get('SUPABASE_URL') ?? '') + '/functions/v1/xendit-webhook'
      })
    });
    const data = await r.json();
    if (!r.ok) return json({ ok: false, data }, 400);
    return json({ ok: true, qr_id: data.id, qr_string: data.qr_string, status: data.status });
  } catch (e) { return json({ ok: false, error: String(e) }, 500); }
});
