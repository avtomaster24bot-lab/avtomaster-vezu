// Supabase Edge Function «am-notify»: уведомляет владельца визитки в Telegram о новой заявке и о новых сообщениях клиента в чате.
// НЕ РАЗВЁРНУТА. Как включить (после миграции 05):
//   1) supabase functions deploy am-notify --no-verify-jwt
//   2) секреты: supabase secrets set TELEGRAM_BOT_TOKEN=<токен бота входа> SITE_URL=https://avtomaster24bot-lab.github.io/avtomaster-vezu/ WEBHOOK_SECRET=<случайная строка>
//   3) Database → Webhooks: INSERT на am_leads и на am_order_messages → POST https://<project>.supabase.co/functions/v1/am-notify,
//      заголовок x-webhook-secret: <WEBHOOK_SECRET>
// Бот может написать только тем, кто разрешил это при входе (кнопка входа запрашивает request-access=write) или сам начал диалог с ботом.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TG = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const SITE = (Deno.env.get('SITE_URL') ?? '').replace(/\/?$/, '/');
const SECRET = Deno.env.get('WEBHOOK_SECRET') ?? '';
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

async function send(chatId: number, text: string) {
  const r = await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  return r.ok;
}

Deno.serve(async (req) => {
  if (!TG || !SECRET || req.headers.get('x-webhook-secret') !== SECRET) return new Response('forbidden', { status: 403 });
  const { table, record } = await req.json();
  let leadId: number, text: string;
  if (table === 'am_leads') { leadId = record.id; text = `🆕 Новая заявка №${record.id}${record.customer_name ? ' от ' + record.customer_name : ''}\n\n${String(record.message).slice(0, 600)}`; }
  else if (table === 'am_order_messages' && record.author === 'client') { leadId = record.lead_id; text = `💬 Новое сообщение по заявке №${record.lead_id}:\n\n${record.offer_price ? '' : String(record.body || '📷 фото').slice(0, 600)}`; }
  else return new Response('skip');
  const { data: lead } = await db.from('am_leads').select('id, provider_id, owner_seen_at').eq('id', leadId).single();
  if (!lead?.provider_id) return new Response('no provider');
  // владелец прямо сейчас в чате — не дёргаем
  if (table === 'am_order_messages' && lead.owner_seen_at && Date.now() - Date.parse(lead.owner_seen_at) < 90_000) return new Response('seen');
  const { data: p } = await db.from('am_providers').select('name, owner_id').eq('id', lead.provider_id).single();
  if (!p?.owner_id) return new Response('no owner');
  const { data: prof } = await db.from('am_profiles').select('tg_id').eq('id', p.owner_id).single();
  if (!prof?.tg_id) return new Response('no tg');
  const ok = await send(prof.tg_id, `${text}\n\nОтветить в чате на сайте: ${SITE}order.html?id=${leadId}&as=owner\n(${p.name})`);
  return new Response(ok ? 'sent' : 'tg error', { status: ok ? 200 : 502 });
});
