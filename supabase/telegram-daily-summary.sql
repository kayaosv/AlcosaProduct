-- ============================================================
-- Vapers Alcosa — resumen diario por Telegram
-- ============================================================
-- Manda un mensaje de Telegram una vez al dia con: numero de pedidos y
-- total facturado del dia, y la lista de productos en stock bajo o
-- agotados (mismo umbral que el dashboard de admin, ver
-- src/config/stock.js LOW_STOCK_THRESHOLD — si se cambia ese numero,
-- cambiar tambien el "5" de la query de abajo, no estan conectados).
--
-- Reutiliza los MISMOS dos secretos de Vault que
-- telegram-order-notify.sql (telegram_bot_token, telegram_chat_id) — si
-- ese trigger ya esta activo, este resumen tambien lo estara en cuanto
-- se aplique este archivo. Si todavia no se cargaron esos secretos, correr
-- una vez en el SQL Editor:
--   select vault.create_secret('<bot_token_de_botfather>', 'telegram_bot_token');
--   select vault.create_secret('<chat_id_numerico>', 'telegram_chat_id');
--
-- Blindado igual que el trigger de pedidos: sin secretos, no hace nada;
-- si Telegram falla, no rompe nada mas (`exception when others then null`).
--
-- Hora del cron: 19:00 UTC = 21:00 hora Espana SOLO en horario de verano
-- (CEST, UTC+2, aplica ahora mismo julio 2026). En horario de invierno
-- (CET, UTC+1, desde el ultimo domingo de octubre) hay que cambiar el
-- cron a las 20:00 UTC para que siga siendo las 21:00 en Espana — pg_cron
-- no ajusta DST solo. Para cambiarlo mas adelante:
--   select cron.unschedule(jobid) from cron.job where jobname = 'daily-summary';
--   select cron.schedule('daily-summary', '0 20 * * *', $$ select public.send_daily_summary(); $$);
-- El calculo de "pedidos de hoy" en la funcion SI usa Europe/Madrid de
-- forma correcta (con DST), independientemente de a que hora UTC se
-- dispare el cron — solo la HORA DE ENVIO se desvia, no los datos.

-- El esquema "cron" ya existia pre-provisionado por Supabase en este
-- proyecto (sin la extension instalada todavia) - create schema if not
-- exists fallo con "already exists" a pesar del IF NOT EXISTS al
-- aplicar esto la primera vez, asi que no se incluye aqui.
create extension if not exists pg_cron with schema cron;

create or replace function public.send_daily_summary()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token       text;
  v_chat_id     text;
  v_start       timestamptz;
  v_end         timestamptz;
  v_order_count int;
  v_order_total numeric;
  v_low_stock   text;
  v_text        text;
begin
  begin
    select decrypted_secret into v_token
      from vault.decrypted_secrets where name = 'telegram_bot_token';
    select decrypted_secret into v_chat_id
      from vault.decrypted_secrets where name = 'telegram_chat_id';

    if v_token is null or v_chat_id is null then
      return;
    end if;

    v_start := date_trunc('day', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid';
    v_end   := v_start + interval '1 day';

    select count(*), coalesce(sum(total), 0)
      into v_order_count, v_order_total
      from orders
      where created_at >= v_start and created_at < v_end;

    -- Stock efectivo: suma de variantes si el producto tiene, si no
    -- products.stock — mismo criterio que useAdminProducts.js
    -- (withEffectiveStock) en el dashboard de admin.
    select string_agg(format('- %s: %s', name, effective_stock), chr(10) order by effective_stock asc)
      into v_low_stock
      from (
        select p.id, p.name,
          case when count(v.id) > 0 then coalesce(sum(v.stock), 0) else p.stock end as effective_stock
        from products p
        left join product_variants v on v.product_id = p.id
        where p.is_active
        group by p.id, p.name, p.stock
        having (case when count(v.id) > 0 then coalesce(sum(v.stock), 0) else p.stock end) <= 5
        order by 2 asc
        limit 15
      ) low;

    v_text := format(
      'Resumen del dia %s' || chr(10) ||
      'Pedidos: %s (%s EUR)' || chr(10) || chr(10) ||
      'Stock bajo (5 uds o menos):' || chr(10) || '%s',
      to_char(v_start, 'DD/MM/YYYY'),
      v_order_count,
      v_order_total,
      coalesce(v_low_stock, 'Todo con stock suficiente')
    );

    perform net.http_post(
      url     := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body    := jsonb_build_object('chat_id', v_chat_id, 'text', v_text)
    );
  exception when others then
    null;
  end;
end;
$$;

-- Sin este revoke, Postgres deja EXECUTE abierto a PUBLIC por defecto al
-- crear la funcion - eso incluye a anon/authenticated via PostgREST
-- (/rest/v1/rpc/send_daily_summary), y cualquier visitante podria
-- spamear el Telegram del vendedor llamandola directo. Solo pg_cron
-- (que corre como el rol que agendo el job, no via PostgREST) debe
-- poder dispararla. BUG REAL encontrado y corregido en produccion el
-- 2026-07-15 - esta funcion estuvo publicamente invocable un rato tras
-- el deploy original de este archivo.
revoke execute on function public.send_daily_summary() from public;

select cron.unschedule(jobid) from cron.job where jobname = 'daily-summary';
select cron.schedule(
  'daily-summary',
  '0 19 * * *',
  $$ select public.send_daily_summary(); $$
);
