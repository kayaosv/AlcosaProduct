-- ============================================================
-- Vapers Alcosa — aviso por Telegram al entrar un pedido
-- ============================================================
-- Hoy nadie se entera de un pedido nuevo salvo que entre a /admin "porque
-- sí" a revisar. Este trigger manda un mensaje de Telegram al vendedor en
-- cuanto create_order() inserta la fila en `orders`.
--
-- Requiere DOS secretos en Supabase Vault, que este archivo NO crea (son
-- credenciales, no se versionan en el repo). Correr una sola vez en el
-- SQL Editor del proyecto:
--   select vault.create_secret('<bot_token_de_botfather>', 'telegram_bot_token');
--   select vault.create_secret('<chat_id_numerico>', 'telegram_chat_id');
--
-- Hasta que esos dos secretos existan, el trigger no hace nada (retorna
-- en silencio) — y si Telegram falla, tiene una excepción vieja de
-- credenciales inválidas, o cualquier otro problema, TAMPOCO rompe la
-- creación del pedido: el `exception when others then null` de abajo es
-- a propósito, para que un fallo de notificación nunca bloquee un
-- checkout real.

create extension if not exists pg_net;

create or replace function public.notify_new_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token   text;
  v_chat_id text;
  v_text    text;
begin
  begin
    select decrypted_secret into v_token
      from vault.decrypted_secrets where name = 'telegram_bot_token';
    select decrypted_secret into v_chat_id
      from vault.decrypted_secrets where name = 'telegram_chat_id';

    if v_token is null or v_chat_id is null then
      return new;
    end if;

    v_text := format(
      E'\U0001F6D2 Nuevo pedido #%s\nCliente: %s\nTel: %s\nTotal: %s\U20AC%s',
      left(new.id::text, 8),
      coalesce(new.customer_name, '—'),
      coalesce(new.customer_phone, '—'),
      new.total,
      case when new.notes is not null and new.notes <> ''
           then E'\nNota: ' || new.notes
           else '' end
    );

    perform net.http_post(
      url     := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body    := jsonb_build_object('chat_id', v_chat_id, 'text', v_text)
    );
  exception when others then
    null;
  end;

  return new;
end;
$$;

drop trigger if exists orders_notify_new on orders;
create trigger orders_notify_new
  after insert on orders
  for each row
  execute function public.notify_new_order();
