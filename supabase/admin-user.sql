-- ============================================================
-- Vapers Alcosa — Crear usuario admin
-- ============================================================
--
-- PASOS:
--
-- 1) En el dashboard de Supabase, ir a:
--      Authentication > Users > Add user > Create new user
--    - Email: el del admin (ej. admin@vapersalcosa.com)
--    - Password: una contraseña fuerte
--    - Auto Confirm User: ✅ (importante, si no pedirá verificación)
--
-- 2) Una vez creado, copiar el UUID del usuario (columna "User UID")
--
-- 3) Abrir el SQL Editor y ejecutar este script,
--    sustituyendo <USER_UUID> por el UUID copiado:

insert into profiles (id, role)
values ('<USER_UUID>', 'admin')
on conflict (id) do update set role = 'admin';

-- Verificar:
select p.id, u.email, p.role
from profiles p
join auth.users u on u.id = p.id
where p.role = 'admin';
