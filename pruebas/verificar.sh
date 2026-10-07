#!/bin/bash
# =====================================================================
#  verificar.sh · Batería de pruebas de 100_panel_base.sql
#
#  Cada fallo que ha aparecido en este proyecto tiene aquí una prueba
#  que lo habría cazado. Se ejecuta entera cada vez que se toca el
#  archivo: revisar a ojo es como se escaparon los anteriores.
# =====================================================================
set -u
SQL="su postgres -c"
P="PGPORT=5433 /usr/lib/postgresql/16/bin/psql -q -t -A"
OK=0; MAL=0
comprobar(){ # nombre, obtenido, esperado
  if [ "$2" = "$3" ]; then printf "  ok    %-52s\n" "$1"; OK=$((OK+1))
  else printf "  FALLO %-52s  esperaba [%s] obtuvo [%s]\n" "$1" "$3" "$2"; MAL=$((MAL+1)); fi
}
q(){ $SQL "$P -c \"$1\" postgres" 2>/dev/null | tr -d ' '; }
limpiar(){ $SQL "$P -c 'drop schema public cascade; create schema public;' postgres" >/dev/null 2>&1
           $SQL "$P -f /tmp/base_mt.sql postgres" >/dev/null 2>&1; }
aplicar(){ $SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -v ON_ERROR_STOP=1 -q -f /tmp/m100.sql postgres" 2>&1 | grep -c ERROR; }

echo
echo "── A · El archivo como texto"
EJ=$(python3 - <<'PY'
s=open('/tmp/m100.sql').read()
print(len([l for l in s.split('\ncommit;')[1].split('\n') if l.strip() and not l.strip().startswith('--')]))
PY
)
comprobar "nada ejecutable después del commit" "$EJ" "0"
python3 - <<'PY' > /tmp/est.txt
import re
s=open('/tmp/m100.sql').read(); ej=s.split('\ncommit;')[0]
t=re.findall(r'create table if not exists (mt_[a-z_]+)', ej)
r=set(re.findall(r'alter table (mt_[a-z_]+) enable row level security', ej))
f=list(dict.fromkeys(re.findall(r'create (?:or replace )?function (mt_[a-z_]+)', ej)))
rv=set(re.findall(r'revoke all on function (mt_[a-z_]+)', ej))
suyas=('mt_tenants','mt_leads','mt_contactos','mt_chat_histories','mt_reservas','mt_canales','mt_ejecuciones','mt_fragmentos','mt_auditoria','mt_uso_diario','mt_uso_mensual')
print(len([x for x in t if x not in r]))
print(len([x for x in f if x not in rv]))
print(len([x for x in re.findall(r'alter table (mt_[a-z_]+)', ej) if x in suyas]))
print(len([l for l in ej.split(chr(10)) if 'set local' in l and not l.strip().startswith('--')]))
print(len(re.findall(r'\bdrop table\b|\btruncate\b', ej, re.I)))
print(s.count('begin;') - s.count('-- begin;'))
print(s.count('\ncommit;'))
PY
mapfile -t E < /tmp/est.txt
comprobar "todas las tablas con RLS"                 "${E[0]}" "0"
comprobar "ninguna función abierta a PUBLIC"         "${E[1]}" "0"
comprobar "ninguna tabla del técnico alterada"       "${E[2]}" "0"
comprobar "ningún 'set local' (se filtra al llamante)" "${E[3]}" "0"
comprobar "ningún drop table ni truncate ejecutable" "${E[4]}" "0"
comprobar "un solo begin y un solo commit"           "${E[5]}/${E[6]}" "1/1"

echo
echo "── B · Aplicar la migración"
limpiar
comprobar "1ª aplicación sin errores" "$(aplicar)" "0"
comprobar "2ª aplicación sin errores" "$(aplicar)" "0"
comprobar "3ª aplicación sin errores" "$(aplicar)" "0"
comprobar "el trigger existe tras reaplicar" \
  "$(q "select count(*) from pg_trigger where tgrelid='mt_chat_histories'::regclass and not tgisinternal")" "1"
comprobar "el trigger está habilitado" \
  "$(q "select tgenabled from pg_trigger where tgrelid='mt_chat_histories'::regclass and not tgisinternal")" "O"
comprobar "las 13 tablas del panel creadas" \
  "$(q "select count(*) from pg_tables where schemaname='public' and tablename in ('mt_panel_migraciones','mt_miembros','mt_operadores','mt_vista_operador','mt_accesos_operador','mt_panel_ajustes','mt_conversaciones','mt_mensajes','mt_latencias_pendientes','mt_excluidos','mt_senales','mt_lugares','mt_menciones')")" "13"

echo
echo "── C · Permisos reales en la base"
for f in mt_capturar_una mt_capturar_mensaje mt_reprocesar; do
  comprobar "anon NO puede ejecutar $f" \
    "$(q "select bool_or(has_function_privilege('anon',p.oid,'execute')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname='$f'")" "f"
done
comprobar "authenticated NO puede escribir con mt_capturar_una" \
  "$(q "select bool_or(has_function_privilege('authenticated',p.oid,'execute')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname='mt_capturar_una'")" "f"
comprobar "service_role sí puede reprocesar" \
  "$(q "select bool_or(has_function_privilege('service_role',p.oid,'execute')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname='mt_reprocesar'")" "t"

echo
echo "── D · El trigger no puede estorbar al agente"
cat > /tmp/d.sql <<'DD'
-- Compara antes y después DENTRO de SQL: así no hay escapado de bash
-- que valga, que es donde se rompían las pruebas anteriores.
create temp table _antes as select name, setting from pg_settings
 where name in ('statement_timeout','lock_timeout','search_path');
insert into mt_chat_histories (session_id,message) values
 ('oficinasya:whatsapp_evolution:34600001@s.whatsapp.net','{"type":"human","content":"a"}'),
 ('oficinasya:whatsapp_evolution:34600001@s.whatsapp.net','{"type":"ai","content":"b"}');
select count(*) from _antes a join pg_settings p on p.name=a.name
 where p.setting is distinct from a.setting;
DD
chmod 644 /tmp/d.sql
comprobar "el trigger no cambia NINGÚN ajuste de la sesión" \
  "$($SQL "$P -f /tmp/d.sql postgres" 2>/dev/null | tail -1 | tr -d ' ')" "0"

echo
echo "── E · El insert del agente NUNCA puede fallar"
cat > /tmp/fuzz.sql <<'FUZZ'
\set ON_ERROR_STOP off
insert into mt_chat_histories (session_id,message) values ('', '{"type":"human","content":"x"}');
insert into mt_chat_histories (session_id,message) values ('sinpuntos', '{"type":"human","content":"x"}');
insert into mt_chat_histories (session_id,message) values ('a:b', '{"type":"human","content":"x"}');
insert into mt_chat_histories (session_id,message) values ('noexiste:wa:34600000000', '{"type":"human","content":"x"}');
insert into mt_chat_histories (session_id,message) values ('oficinasya:wa:34600777', '{}');
insert into mt_chat_histories (session_id,message) values ('oficinasya:wa:34600777', '{"type":123,"content":null}');
insert into mt_chat_histories (session_id,message) values ('oficinasya:wa:34600777', '[]');
insert into mt_chat_histories (session_id,message) values (repeat('x',2000), '{"type":"human","content":"x"}');
insert into mt_chat_histories (session_id,message) values ('oficinasya:wa:34600777', jsonb_build_object('type','human','content',repeat('á',50000)));
insert into mt_chat_histories (session_id,message) values ('oficinasya:wa:34600777', jsonb_build_object('type','human','content','Robert''); drop table mt_mensajes; --'));
insert into mt_chat_histories (session_id,message) values ('oficinasya:wa:'' or 1=1 --', '{"type":"human","content":"x"}');
insert into mt_chat_histories (session_id,message) values ('oficinasya:whatsapp_evolution:34600888@s.whatsapp.net', jsonb_build_object('type','human','content','أبو مكه 🦋 N Davalillo. El Potro'));
insert into mt_chat_histories (session_id,message, creado_en) values ('oficinasya:whatsapp_evolution:34600999@s.whatsapp.net', '{"type":"human","content":"del futuro"}', now()+interval '2 days');
FUZZ
chmod 644 /tmp/fuzz.sql
ERR=$($SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -f /tmp/fuzz.sql postgres" 2>&1 | grep -c ERROR)
comprobar "13 inserts adversarios, ninguno falla" "$ERR" "0"
comprobar "las tablas siguen existiendo tras el intento de inyección" \
  "$(q "select count(*) from pg_tables where schemaname='public' and tablename='mt_mensajes'")" "1"

echo
echo "── F · Los números cuadran siempre"
limpiar; aplicar >/dev/null
q "insert into mt_chat_histories (session_id, message, creado_en)
   select 'oficinasya:whatsapp_evolution:3460'||(g%7)||'@s.whatsapp.net',
          jsonb_build_object('type', case when g%2=0 then 'human' else 'ai' end, 'content','mensaje '||g),
          now() - ((300-g)||' minutes')::interval
   from generate_series(1,300) g" >/dev/null
comprobar "contadores = mensajes reales (en vivo)" \
  "$(q "select (select coalesce(sum(mensajes),0) from mt_conversaciones) = (select count(*) from mt_mensajes)")" "t"
comprobar "del_cliente + del_asistente = mensajes" \
  "$(q "select bool_and(mensajes = del_cliente + del_asistente) from mt_conversaciones")" "t"
U1=$(q "select coalesce(sum(mensajes),0)||'/'||(select count(*) from mt_conversaciones) from mt_conversaciones")
q "select * from mt_reprocesar(0,500)" >/dev/null
comprobar "reprocesar no cambia ni un número" \
  "$(q "select coalesce(sum(mensajes),0)||'/'||(select count(*) from mt_conversaciones) from mt_conversaciones")" "$U1"
q "delete from mt_mensajes; delete from mt_conversaciones; select * from mt_reprocesar(0,500)" >/dev/null
comprobar "reconstruir desde cero da lo mismo" \
  "$(q "select coalesce(sum(mensajes),0)||'/'||(select count(*) from mt_conversaciones) from mt_conversaciones")" "$U1"
comprobar "reprocesar por tandas termina" \
  "$(q "select quedan from mt_reprocesar(0,100)")" "200"

echo
echo "── G · Conversaciones, clientes y concurrencia"
limpiar; aplicar >/dev/null
cat > /tmp/g.sql <<'GG'
-- dos mensajes separados 10 min que llegan con 3 h de retraso: 1 conversación
insert into mt_chat_histories (session_id, message, creado_en) values
 ('oficinasya:whatsapp_evolution:34611@s.whatsapp.net','{"type":"human","content":"a"}', now()-interval '3 hours'),
 ('oficinasya:whatsapp_evolution:34611@s.whatsapp.net','{"type":"human","content":"b"}', now()-interval '2 hours 50 minutes');
-- separados 2 h: 2 conversaciones
insert into mt_chat_histories (session_id, message, creado_en) values
 ('oficinasya:whatsapp_evolution:34622@s.whatsapp.net','{"type":"human","content":"a"}', now()-interval '5 hours'),
 ('oficinasya:whatsapp_evolution:34622@s.whatsapp.net','{"type":"human","content":"b"}', now()-interval '3 hours');
-- mismo número, dos clientes distintos
insert into mt_tenants (slug,nombre) values ('otro','Otro') on conflict do nothing;
insert into mt_chat_histories (session_id, message) values
 ('oficinasya:whatsapp_evolution:34633@s.whatsapp.net','{"type":"human","content":"a"}'),
 ('otro:whatsapp_evolution:34633@s.whatsapp.net','{"type":"human","content":"a"}');
GG
chmod 644 /tmp/g.sql
$SQL "$P -f /tmp/g.sql postgres" >/dev/null 2>&1
comprobar "10 min con retraso = 1 conversación" "$(q "select count(*) from mt_conversaciones where user_ref like '34611%'")" "1"
comprobar "2 horas aparte = 2 conversaciones"   "$(q "select count(*) from mt_conversaciones where user_ref like '34622%'")" "2"
comprobar "mismo número, 2 clientes = separados" "$(q "select count(distinct tenant_id) from mt_conversaciones where user_ref like '34633%'")" "2"
comprobar "cada mensaje en el cliente correcto" \
  "$(q "select bool_and(t.slug = split_part(h.session_id,':',1)) from mt_mensajes m join mt_conversaciones c on c.id=m.conversacion_id join mt_tenants t on t.id=c.tenant_id join mt_chat_histories h on h.id=m.origen_id")" "t"
comprobar "ningún mensaje duplicado" \
  "$(q "select count(*) from (select origen_id from mt_mensajes where origen_id is not null group by origen_id having count(*)>1) x")" "0"

echo
echo "── H · Contra el esquema real del técnico"
comprobar "mt_chat_histories intacta (4 columnas)" \
  "$(q "select count(*) from information_schema.columns where table_name='mt_chat_histories'")" "4"
comprobar "nuestro trigger SOLO está en mt_chat_histories" \
  "$(q "select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_proc p on p.oid=t.tgfoid where not t.tgisinternal and p.proname like 'mt_capturar%' and c.relname <> 'mt_chat_histories'")" "0"
comprobar "la traza [Used tools:] se limpia al entrar" \
  "$(q "select count(*) from mt_mensajes where contenido like '[Used tools:%'")" "0"



echo
echo "── I · Señales, lugares y embudo (101)"
comprobar "la réplica es FIEL: mt_reservas sin columna estado" \
  "$(q "select count(*) from information_schema.columns where table_name='mt_reservas' and column_name='estado'")" "0"
comprobar "la réplica trae las 11 tablas del técnico" \
  "$(q "select count(*) from pg_tables where schemaname='public' and tablename in ('mt_tenants','mt_contactos','mt_leads','mt_reservas','mt_chat_histories','mt_canales','mt_ejecuciones','mt_fragmentos','mt_auditoria','mt_uso_diario','mt_uso_mensual')")" "11"
limpiar; aplicar >/dev/null
$SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -v ON_ERROR_STOP=1 -q -f /tmp/m101.sql postgres" >/dev/null 2>&1
comprobar "101 aplica dos veces sin errores" \
  "$($SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -v ON_ERROR_STOP=1 -q -f /tmp/m101.sql postgres" 2>&1 | grep -c ERROR)" "0"
comprobar "ningún patrón lleva eñe (nunca coincidiría)" \
  "$(q "select count(*) from mt_senales where patron ~ 'ñ' or patron ~ 'á|é|í|ó|ú'")" "0"
comprobar "todos los patrones son regex válidas" \
  "$(q "select count(*) from mt_senales s where not ('prueba' ~ s.patron or true)")" "0"
comprobar "ningún patrón de lugares lleva acento" \
  "$(q "select count(*) from mt_lugares where patron ~ 'ñ|á|é|í|ó|ú'")" "0"
$SQL "$P -f /tmp/t101.sql postgres" >/dev/null 2>&1
comprobar "Almudena: interés sí"        "$(q "select senal_interes from mt_conversaciones where user_ref like '34618986467%'")" "t"
comprobar "Almudena: contacto sí"       "$(q "select senal_contacto from mt_conversaciones where user_ref like '34618986467%'")" "t"
comprobar "Almudena: 'no supo' NO (era el falso positivo)" \
  "$(q "select senal_sin_respuesta from mt_conversaciones where user_ref like '34618986467%'")" "f"
$SQL "$P -c \"insert into mt_contactos (tenant_id,canal,user_ref,nombre,email) select id,'whatsapp_evolution','34618986467@s.whatsapp.net','Almudena','a@b.com' from mt_tenants where slug='oficinasya'\" postgres" >/dev/null 2>&1
$SQL "$P -c \"select mt_recalcular_lugares(id), mt_sincronizar_embudo(id) from mt_tenants where slug='oficinasya'\" postgres" >/dev/null 2>&1
comprobar "el servicio detectado es el correcto" \
  "$(q "select servicio from mt_embudo limit 1")" "Saladereuniones"
comprobar "sincronizar el embudo no duplica" \
  "$(q "select creados from mt_sincronizar_embudo((select id from mt_tenants where slug='oficinasya'))")" "0"
comprobar "el alta figura una sola vez en el historial" \
  "$(q "select count(*) from mt_embudo_eventos where tipo='alta'")" "1"
comprobar "mt_leads del técnico sigue vacía e intacta" \
  "$(q "select count(*) from mt_leads")" "0"
$SQL "$P -c \"insert into mt_reservas (tenant_id, uid, evento, user_ref, inicio) select id,'u1','booking.created','34618986467@s.whatsapp.net', now()+interval '3 days' from mt_tenants where slug='oficinasya'\" postgres" >/dev/null 2>&1
$SQL "$P -c \"select mt_sincronizar_embudo((select id from mt_tenants where slug='oficinasya'))\" postgres" >/dev/null 2>&1
comprobar "una reserva futura sube la etapa a visita" \
  "$(q "select etapa from mt_embudo limit 1")" "visita_agendada"
comprobar "y una etapa manual NO retrocede" \
  "$(q "update mt_embudo set etapa='propuesta'; select mt_sincronizar_embudo((select id from mt_tenants where slug='oficinasya')); select etapa from mt_embudo limit 1" | tail -1)" "propuesta"



echo
echo "── J · Patrones contra mensajes reales (102)"
$SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -v ON_ERROR_STOP=1 -q -f /tmp/m102.sql postgres" >/dev/null 2>&1
comprobar "102 aplica dos veces sin errores" \
  "$($SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -v ON_ERROR_STOP=1 -q -f /tmp/m102.sql postgres" 2>&1 | grep -c ERROR)" "0"
$SQL "$P -f /tmp/real.sql postgres" >/dev/null 2>&1
comprobar "'dónde tenéis oficinas' = interés (fallaba antes)" \
  "$(q "select senal_interes from mt_conversaciones where user_ref like '34601755607%'")" "t"
for frase in "busco una oficina en madrid" "necesitamos un despacho para 4" "queria saber precios" "me interesaria ver el espacio" "lo necesito cuanto antes"; do
  comprobar "detecta: $frase" \
    "$(q "select count(*)>0 from mt_senales s where s.activo and s.tipo='interes' and s.sobre='cliente' and mt_normaliza('$frase') ~ s.patron")" "t"
done
for frase in "hola" "gracias" "vale perfecto" "buenos dias"; do
  comprobar "NO marca interés: $frase" \
    "$(q "select count(*)>0 from mt_senales s where s.activo and s.tipo='interes' and s.sobre='cliente' and mt_normaliza('$frase') ~ s.patron")" "f"
done
comprobar "los centros inventados están desactivados" \
  "$(q "select count(*) from mt_lugares where categoria='ubicacion' and activo and nombre in ('Velázquez','Gasset','Serrano','Capitán Haya','Las Tablas','Sanse','La Florida','Manoteras')")" "0"
comprobar "mt_sin_detectar funciona" \
  "$(q "select count(*)>=0 from mt_sin_detectar((select id from mt_tenants where slug='oficinasya'),5)")" "t"



echo
echo "── K · Los lugares salen de la hoja del cliente (103)"
$SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -v ON_ERROR_STOP=1 -q -f /tmp/m103.sql postgres" >/dev/null 2>&1
comprobar "103 aplica dos veces sin errores" \
  "$($SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -v ON_ERROR_STOP=1 -q -f /tmp/m103.sql postgres" 2>&1 | grep -c ERROR)" "0"
comprobar "no repite frases iguales" \
  "$(q "select array_to_string(mt_frases_de('Openhouse, Openhouse'),'|')")" "openhouse"
comprobar "descarta genéricos y 'centro de X'" \
  "$(q "select coalesce(nullif(array_to_string(mt_frases_de('centro, edificio, oficinas, centro de Albacete'),'|'),''),'(vacio)')")" "(vacio)"
comprobar "quita acentos de la frase" \
  "$(q "select array_to_string(mt_frases_de('Velázquez'),'|')")" "velazquez"
comprobar "conserva la frase entera, no palabras sueltas" \
  "$(q "select array_to_string(mt_frases_de('Barrio de Salamanca'),'|')")" "barriodesalamanca"
$SQL "$P -c \"delete from mt_lugares where origen='conocimiento'; select mt_lugares_desde_conocimiento('oficinasya','[{\\\"centro\\\":\\\"Edificio Openhouse\\\",\\\"alias\\\":\\\"Openhouse\\\",\\\"ciudad\\\":\\\"Salamanca\\\"},{\\\"centro\\\":\\\"Torre Vigo\\\",\\\"alias\\\":\\\"\\\",\\\"ciudad\\\":\\\"Vigo\\\"}]'::jsonb)\" postgres" >/dev/null 2>&1
comprobar "4 lugares de 2 centros (centro + ciudad)" \
  "$(q "select count(*) from mt_lugares where origen='conocimiento' and activo")" "4"
cat > /tmp/k.sql <<'KK'
select altas from mt_lugares_desde_conocimiento('oficinasya','[
 {"centro":"Edificio Openhouse","alias":"Openhouse","ciudad":"Salamanca"},
 {"centro":"Torre Vigo","alias":"","ciudad":"Vigo"}]'::jsonb);
KK
chmod 644 /tmp/k.sql
comprobar "recargar lo mismo no da de alta nada" \
  "$($SQL "$P -f /tmp/k.sql postgres" 2>/dev/null | tr -d ' ')" "0"
$SQL "$P -c \"select mt_lugares_desde_conocimiento('oficinasya','[{\\\"centro\\\":\\\"Edificio Openhouse\\\",\\\"alias\\\":\\\"Openhouse\\\",\\\"ciudad\\\":\\\"Salamanca\\\"}]'::jsonb)\" postgres" >/dev/null 2>&1
comprobar "un centro retirado de la hoja se apaga, no se borra" \
  "$(q "select count(*) from mt_lugares where origen='conocimiento' and not activo")" "2"
comprobar "los lugares manuales NO los toca la hoja" \
  "$(q "select count(*)>0 from mt_lugares where origen='manual'")" "t"
$SQL "$P -f /tmp/real.sql postgres" >/dev/null 2>&1
$SQL "$P -c \"select mt_recalcular_lugares(id) from mt_tenants where slug='oficinasya'\" postgres" >/dev/null 2>&1
comprobar "detecta Salamanca en el mensaje real" \
  "$(q "select count(*)>0 from mt_menciones m join mt_lugares l on l.id=m.lugar_id where l.nombre='Salamanca'")" "t"



echo
echo "── L · Los 35 centros reales"
$SQL "$P -f /tmp/carga.sql postgres" >/dev/null 2>&1
comprobar "52 lugares: 35 centros + 17 ciudades" \
  "$(q "select count(*) from mt_lugares where origen='conocimiento' and activo")" "52"
comprobar "ninguna ciudad dentro del patrón de un centro" \
  "$(q "select count(*) from mt_lugares c where c.origen='conocimiento' and c.clave like 'centro:%' and exists (select 1 from mt_lugares d where d.clave like 'ciudad:%' and ('|'||c.patron||'|') like '%|'||d.patron||'|%')")" "0"
comprobar "ningún patrón vacío" \
  "$(q "select count(*) from mt_lugares where origen='conocimiento' and coalesce(patron,'')=''")" "0"
comprobar "ningún patrón con acentos o eñes" \
  "$(q "select count(*) from mt_lugares where patron ~ 'ñ|á|é|í|ó|ú'")" "0"
comprobar "'Serrano' → el centro de Madrid" \
  "$(q "select l.nombre from mt_lugares l where l.activo and mt_normaliza('Necesito una sala en Serrano') ~ ('(^|[^a-z])('||l.patron||')([^a-z]|\$)') and l.categoria='ubicacion'")" "Serrano(Madrid)"
comprobar "'Pozuelo' → La Florida" \
  "$(q "select l.nombre from mt_lugares l where l.activo and mt_normaliza('Tengo interes en Pozuelo') ~ ('(^|[^a-z])('||l.patron||')([^a-z]|\$)') and l.categoria='ubicacion'")" "LaFlorida(Pozuelo)(Madrid)"
comprobar "'Salamanca' → la ciudad, no un centro de Madrid" \
  "$(q "select l.nombre from mt_lugares l where l.activo and mt_normaliza('oficinas en Salamanca') ~ ('(^|[^a-z])('||l.patron||')([^a-z]|\$)') and l.categoria='ubicacion'")" "Salamanca"
comprobar "recargar la misma hoja no da altas" \
  "$($SQL "$P -f /tmp/carga.sql postgres" 2>/dev/null | head -1 | cut -d'|' -f1 | tr -d ' ')" "0"



echo
echo "── M · Quién ve qué (104)"
$SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -v ON_ERROR_STOP=1 -q -f /tmp/m104.sql postgres" >/dev/null 2>&1
comprobar "104 aplica dos veces sin errores" \
  "$($SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -v ON_ERROR_STOP=1 -q -f /tmp/m104.sql postgres" 2>&1 | grep -c ERROR)" "0"
$SQL "$P -f /tmp/perm.sql postgres" >/dev/null 2>&1
$SQL "$P -f /tmp/como.sql postgres" > /tmp/roles.txt 2>&1
comprobar "operador: ve los 2 clientes"        "$(grep -A2 'OPERADOR' /tmp/roles.txt | tail -1 | awk -F'|' '{print $3}' | tr -d ' ')" "2"
comprobar "operador: NO escribe sin fijar modo" "$(grep -A2 'OPERADOR' /tmp/roles.txt | tail -1 | awk -F'|' '{print $2}' | tr -d ' ')" "f"
comprobar "admin del cliente: sí escribe"      "$(grep -A2 'ADMIN DEL CLIENTE' /tmp/roles.txt | tail -1 | awk -F'|' '{print $2}' | tr -d ' ')" "t"
comprobar "admin: ve solo su cliente"          "$(grep -A2 'ADMIN DEL CLIENTE' /tmp/roles.txt | tail -1 | awk -F'|' '{print $3}' | tr -d ' ')" "1"
AC=$(grep -A2 'ADMIN DEL CLIENTE' /tmp/roles.txt | tail -1 | awk -F'|' '{print $4}' | tr -d ' ')
comprobar "admin: lee los contactos de su cliente" "$([ "${AC:-0}" -gt 0 ] && echo si || echo no)" "si"
comprobar "viewer: NO escribe"                 "$(grep -A2 'VIEWER' /tmp/roles.txt | tail -1 | awk -F'|' '{print $2}' | tr -d ' ')" "f"
VC=$(grep -A2 'VIEWER' /tmp/roles.txt | tail -1 | awk -F'|' '{print $3}' | tr -d ' ')
comprobar "viewer: sí lee (ve contactos)" "$([ "${VC:-0}" -gt 0 ] && echo si || echo no)" "si"
comprobar "extraño: rol ninguno"               "$(grep -A2 'EXTRAÑO' /tmp/roles.txt | tail -1 | awk -F'|' '{print $1}' | tr -d ' ')" "ninguno"
comprobar "extraño: 0 contactos"               "$(grep -A2 'EXTRAÑO' /tmp/roles.txt | tail -1 | awk -F'|' '{print $4}' | tr -d ' ')" "0"
comprobar "extraño: 0 mensajes"                "$(grep -A2 'EXTRAÑO' /tmp/roles.txt | tail -1 | awk -F'|' '{print $5}' | tr -d ' ')" "0"
comprobar "un cliente NO puede pedir otro por slug" \
  "$(grep -A2 'pidiendo OTRO' /tmp/roles.txt | tail -1 | tr -d ' ')" "(nulo,bien)"
comprobar "anon no ejecuta ninguna función del panel" \
  "$(q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'mt_%' and has_function_privilege('anon',p.oid,'execute')")" "0"
comprobar "ninguna tabla del panel tiene políticas (acceso solo por función)" \
  "$(q "select count(*) from pg_policies where schemaname='public' and tablename like 'mt_%' and tablename not in ('mt_tenants','mt_contactos','mt_leads','mt_reservas','mt_chat_histories','mt_canales','mt_ejecuciones','mt_fragmentos','mt_auditoria','mt_uso_diario','mt_uso_mensual')")" "0"
comprobar "una hoja VACÍA no retira ningún lugar" \
  "$(q "select retirados from mt_lugares_desde_conocimiento('oficinasya','[]'::jsonb)")" "0"
comprobar "y los 52 lugares siguen ahí" \
  "$(q "select count(*) from mt_lugares where origen='conocimiento' and activo")" "52"



echo
echo "── N · Lecturas del Latido (105)"
$SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -v ON_ERROR_STOP=1 -q -f /tmp/m105.sql postgres" >/dev/null 2>&1
comprobar "105 aplica dos veces sin errores" \
  "$($SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -v ON_ERROR_STOP=1 -q -f /tmp/m105.sql postgres" 2>&1 | grep -c ERROR)" "0"
for f in mt_conversaciones_lista mt_actividad mt_latencias mt_patron_horario mt_buscar mt_ping; do
  comprobar "anon NO ejecuta $f" \
    "$(q "select bool_or(has_function_privilege('anon',p.oid,'execute')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname='$f'")" "f"
done
comprobar "el patrón horario usa isodow (1=lunes, 7=domingo)" \
  "$(q "select count(*) from mt_patron_horario('oficinasya') where dia < 1 or dia > 7")" "0"
comprobar "buscar con 1 letra no devuelve nada" \
  "$(q "select count(*) from mt_buscar('a','oficinasya')")" "0"
comprobar "buscar ignora acentos" \
  "$(q "select count(*)>0 from mt_buscar('oficinas','oficinasya')")" "t"
comprobar "latencias vacías mientras no exista el nodo de n8n" \
  "$(q "select count(*) from mt_latencias('oficinasya')")" "0"



echo
echo "── O · Las pruebas del sistema no cuentan (106)"
limpiar
for f in m100 m101 m102 m103 m104 m105; do
  $SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -q -f /tmp/$f.sql postgres" >/dev/null 2>&1
done
$SQL "$P -f /tmp/mezcla.sql postgres" >/dev/null 2>&1
ANTES=$(q "select personas from mt_resumen('oficinasya',720)")
$SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -v ON_ERROR_STOP=1 -q -f /tmp/m106.sql postgres" >/dev/null 2>&1
comprobar "106 aplica dos veces sin errores" \
  "$($SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -v ON_ERROR_STOP=1 -q -f /tmp/m106.sql postgres" 2>&1 | grep -c ERROR)" "0"
comprobar "antes contaba 16 personas"        "$ANTES" "16"
comprobar "después cuenta solo las 4 reales" "$(q "select personas from mt_resumen('oficinasya',720)")" "4"
comprobar "reconoce auto-XXXXXXXX-N"         "$(q "select mt_es_prueba('auto-514f96b3-11')")" "t"
comprobar "reconoce el teléfono del probador" "$(q "select mt_es_prueba('34000000000@s.whatsapp.net')")" "t"
comprobar "NO marca un número real"          "$(q "select mt_es_prueba('34601755607@s.whatsapp.net')")" "f"
comprobar "NO marca un nombre que empieza por auto" \
  "$(q "select mt_es_prueba('automocion@s.whatsapp.net')")" "f"
$SQL "$P -c \"insert into mt_chat_histories (session_id, message) values ('oficinasya:whatsapp_evolution:auto-99aabbcc-1','{\\\"type\\\":\\\"human\\\",\\\"content\\\":\\\"precios\\\"}'),('oficinasya:whatsapp_evolution:34611223344@s.whatsapp.net','{\\\"type\\\":\\\"human\\\",\\\"content\\\":\\\"busco oficina\\\"}')\" postgres" >/dev/null 2>&1
comprobar "una prueba NUEVA no se cuela (4 → 5, no 6)" \
  "$(q "select personas from mt_resumen('oficinasya',720)")" "5"
comprobar "las pruebas no generan señales" \
  "$(q "select count(*) from mt_conversaciones where excluido and (senal_interes or senal_contacto)")" "0"
comprobar "las pruebas no entran al embudo" \
  "$(q "select count(*) from mt_embudo where mt_es_prueba(user_ref)")" "0"



echo
echo "── P · Señales únicas y patrones con límites (107)"
limpiar
for f in m100 m101 m102 m103 m104 m105 m106 m101 m102; do
  $SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -q -f /tmp/$f.sql postgres" >/dev/null 2>&1
done
DUP=$(q "select count(*) from mt_senales")
$SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -v ON_ERROR_STOP=1 -q -f /tmp/m107.sql postgres" >/dev/null 2>&1
comprobar "reaplicar el 101 duplicaba las señales" "$DUP" "52"
comprobar "107 las deja en 26"                      "$(q "select count(*) from mt_senales")" "26"
comprobar "ninguna nota repetida"                   "$(q "select count(*) from (select nota from mt_senales group by nota having count(*)>1) x")" "0"
$SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -q -f /tmp/m101.sql postgres" >/dev/null 2>&1
$SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -q -f /tmp/m102.sql postgres" >/dev/null 2>&1
comprobar "y reaplicarlos ya NO duplica"            "$(q "select count(*) from mt_senales")" "26"
comprobar "el patrón corregido sobrevive al reaplicar" \
  "$(q "select mt_normaliza('me interesa alquilar un despacho privado') ~ patron from mt_senales where nota='Habla de pagar'")" "f"
comprobar "'300 + IVA' sí se detecta" \
  "$(q "select mt_normaliza('son 300 mas IVA al mes') ~ patron from mt_senales where nota='Habla de pagar'")" "t"
comprobar "107 aplica dos veces sin errores" \
  "$($SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -v ON_ERROR_STOP=1 -q -f /tmp/m107.sql postgres" 2>&1 | grep -c ERROR)" "0"
comprobar "los lugares manuales tampoco se duplican" \
  "$(q "select count(*) from (select nombre from mt_lugares where origen='manual' group by nombre having count(*)>1) x")" "0"



echo
echo "── Q · El embudo, de punta a punta (108)"
$SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -v ON_ERROR_STOP=1 -q -f /tmp/m108.sql postgres" >/dev/null 2>&1
comprobar "108 aplica dos veces sin errores" \
  "$($SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -v ON_ERROR_STOP=1 -q -f /tmp/m108.sql postgres" 2>&1 | grep -c ERROR)" "0"
# La sección anterior deja el esquema limpio: aquí hacen falta datos.
$SQL "$P -f /tmp/carga.sql postgres" >/dev/null 2>&1
$SQL "$P -f /tmp/mezcla.sql postgres" >/dev/null 2>&1
$SQL "$P -c \"select mt_recalcular_senales(id), mt_recalcular_lugares(id) from mt_tenants where slug='oficinasya'\" postgres" >/dev/null 2>&1
$SQL "$P -c \"select mt_sincronizar('oficinasya')\" postgres" >/dev/null 2>&1
$SQL "$P -f /tmp/t108.sql postgres" >/dev/null 2>&1
comprobar "guardar: los campos se escriben"   "$(q "select personas||'/'||valor_mes||'/'||canal from mt_mis_leads('propuesta','oficinasya')")" "4/1638.00/portal"
comprobar "mover: la etapa cambia"            "$(q "select count(*) from mt_mis_leads('propuesta','oficinasya')")" "1"
comprobar "deshacer un toque baja el contador" "$(q "select toques from mt_mis_leads('propuesta','oficinasya')")" "0"
comprobar "el historial guarda alta, toque y etapa" \
  "$(q "select count(distinct tipo) from mt_historial_lead((select id from mt_mis_leads('propuesta','oficinasya')),'oficinasya')")" "2"
comprobar "las pruebas no salen en el embudo" \
  "$(q "select count(*) from mt_mis_leads(null,'oficinasya') where mt_es_prueba(user_ref)")" "0"
comprobar "el embudo cuadra con los leads"    "$(q "select (select coalesce(sum(leads),0) from mt_embudo_resumen('oficinasya')) = (select count(*) from mt_mis_leads(null,'oficinasya'))")" "t"
comprobar "una incidencia se registra"        "$(q "select mt_registrar_incidencia('prueba','Prueba','aviso') is not null")" "t"
comprobar "y repetida no duplica, suma veces" \
  "$(q "select mt_registrar_incidencia('prueba','Prueba','aviso'); select veces from mt_incidencias where codigo='prueba'" | tail -1)" "2"
for f in mt_guardar_lead mt_mover_lead mt_apuntar_toque mt_deshacer_evento mt_mis_leads mt_registrar_incidencia; do
  comprobar "anon NO ejecuta $f" \
    "$(q "select bool_or(has_function_privilege('anon',p.oid,'execute')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname='$f'")" "f"
done



echo
echo "── R · Las tres cuentas, aisladas"
$SQL "$P -c \"insert into auth.users (email) values ('roberto@oficinasya.es'),('simpliaspain@gmail.com'),('sergio@simpliaspain.com') on conflict (email) do nothing\" postgres" >/dev/null 2>&1
comprobar "la réplica tiene email único, como Supabase" \
  "$(q "select count(*) from pg_indexes where schemaname='auth' and tablename='users' and indexdef like '%UNIQUE%email%'")" "1"
$SQL "$P -f /tmp/alta.sql postgres" >/dev/null 2>&1
$SQL "$P -f /tmp/aislado.sql postgres" > /tmp/ais.txt 2>&1
comprobar "alta_usuarios se puede ejecutar dos veces" \
  "$($SQL "$P -f /tmp/alta.sql postgres" 2>&1 | grep -ci error)" "0"
comprobar "el cliente SimpliaSpain existe"   "$(q "select count(*) from mt_tenants where slug='simplia'")" "1"
comprobar "y nace inactivo (el bot lo ignora)" "$(q "select activo from mt_tenants where slug='simplia'")" "f"
$SQL "$P -f /tmp/ais3.sql postgres" > /tmp/ais3.txt 2>&1
R=$(grep '^roberto:' /tmp/ais3.txt); S=$(grep '^sergio:' /tmp/ais3.txt); O=$(grep '^operador:' /tmp/ais3.txt)
comprobar "Roberto: admin de 1 cliente"  "$(echo $R | cut -d: -f2-3)" "admin:1"
comprobar "Sergio: admin, 1 cliente, 0 contactos" "$(echo $S | cut -d: -f2-4)" "admin:1:0"
comprobar "Roberto puede escribir" "$(echo $R | cut -d: -f4)" "true"
comprobar "Sergio NO puede pedir OficinasYA"    "$(echo $S | cut -d: -f5)" "nulo"
comprobar "operador: 2 clientes, modo lectura"  "$(echo $O | cut -d: -f2-4)" "operador:2:false"
comprobar "no quedan filas huérfanas" \
  "$(q "select (select count(*) from mt_operadores o where not exists (select 1 from auth.users u where u.id=o.user_id)) + (select count(*) from mt_miembros m where not exists (select 1 from auth.users u where u.id=m.user_id))")" "0"



echo
echo "── S · Tus números (111)"
$SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -v ON_ERROR_STOP=1 -q -f /tmp/m111.sql postgres" >/dev/null 2>&1
comprobar "111 aplica dos veces sin errores" \
  "$($SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -v ON_ERROR_STOP=1 -q -f /tmp/m111.sql postgres" 2>&1 | grep -c ERROR)" "0"
comprobar "sin parámetros, dice CUÁLES faltan" \
  "$(q "select array_length(faltan,1) from mt_mis_numeros('oficinasya')")" "3"
$SQL "$P -f /tmp/t111.sql postgres" >/dev/null 2>&1
comprobar "con parámetros, no falta ninguno" \
  "$(q "select coalesce(array_length(faltan,1),0) from mt_mis_numeros('oficinasya')")" "0"
comprobar "el total es la suma de lo medido" \
  "$(q "select total_eur = tiempo_eur + ventas_eur from mt_mis_numeros('oficinasya')")" "t"
comprobar "lo hipotético NO entra en el total" \
  "$(q "select total_eur < tiempo_eur + ventas_eur + fuera_horario_eur or fuera_horario_eur = 0 from mt_mis_numeros('oficinasya')")" "t"
comprobar "una venta de otro mes no cuenta" \
  "$(q "select ganados from mt_mis_numeros('oficinasya')")" "0"
$SQL "$P -f /tmp/t112.sql postgres" >/dev/null 2>&1
comprobar "detecta los captados de madrugada" \
  "$(q "select fuera_horario > 0 from mt_mis_numeros('oficinasya')")" "t"
comprobar "y sigue sin sumarlos al total" \
  "$(q "select total_eur = tiempo_eur + ventas_eur from mt_mis_numeros('oficinasya')")" "t"
comprobar "anon NO ejecuta mt_mis_numeros" \
  "$(q "select bool_or(has_function_privilege('anon',p.oid,'execute')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname='mt_mis_numeros'")" "f"



echo
echo "── T · Coordenadas del mapa (112)"
$SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -v ON_ERROR_STOP=1 -q -f /tmp/m112.sql postgres" >/dev/null 2>&1
comprobar "112 aplica dos veces sin errores" \
  "$($SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -v ON_ERROR_STOP=1 -q -f /tmp/m112.sql postgres" 2>&1 | grep -c ERROR)" "0"
$SQL "$P -f /tmp/carga.sql postgres" >/dev/null 2>&1
$SQL "$P -f /tmp/m112.sql postgres" >/dev/null 2>&1
comprobar "ninguna ubicación se queda sin coordenadas" \
  "$(q "select count(*) from mt_lugares where categoria='ubicacion' and activo and lat is null")" "0"
comprobar "todas caen dentro de España" \
  "$(q "select count(*) from mt_lugares where categoria='ubicacion' and activo and (lat not between 27 and 44 or lng not between -19 and 5)")" "0"
comprobar "mt_demanda devuelve lat y lng" \
  "$(q "select count(*) from information_schema.routines r join information_schema.parameters p on p.specific_name=r.specific_name where r.routine_name='mt_demanda' and p.parameter_name in ('lat','lng')")" "2"
comprobar "resincronizar la hoja NO borra las coordenadas" \
  "$($SQL "$P -f /tmp/carga.sql postgres" >/dev/null 2>&1; q "select count(*) from mt_lugares where categoria='ubicacion' and activo and lat is null")" "0"



echo
echo "── U · Las coordenadas son correctas (113)"
$SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -v ON_ERROR_STOP=1 -q -f /tmp/m113.sql postgres" >/dev/null 2>&1
comprobar "113 aplica dos veces sin errores" \
  "$($SQL "PGPORT=5433 /usr/lib/postgresql/16/bin/psql -v ON_ERROR_STOP=1 -q -f /tmp/m113.sql postgres" 2>&1 | grep -c ERROR)" "0"
comprobar "ningún nombre de ubicación repetido" \
  "$(q "select count(*) from (select nombre from mt_lugares where categoria='ubicacion' and activo group by nombre having count(*)>1) x")" "0"
comprobar "ninguna zona de Madrid sobre el centro" \
  "$(q "select count(*) from mt_lugares where activo and nombre like '%(Madrid)' and lat=40.4169 and lng=-3.7034")" "0"
comprobar "cada punto dice si está verificado" \
  "$(q "select count(*) from mt_lugares where categoria='ubicacion' and activo and lat is not null and coord_origen is null")" "0"
comprobar "ninguna coordenada fuera de España" \
  "$(q "select count(*) from mt_lugares where lat is not null and (lat not between 27 and 44 or lng not between -19 and 5)")" "0"
comprobar "las ocho verificadas son las que digo" \
  "$(q "select count(*) from mt_lugares where categoria='ubicacion' and activo and coord_origen='verificada'")" "8"
comprobar "zonas distintas, coordenadas distintas" \
  "$(q "select count(*) from (select lat,lng from mt_lugares where activo and nombre like '%(Madrid)' group by lat,lng having count(*)>1) x")" "0"
comprobar "mt_situar_lugar rechaza lat y lng al revés" \
  "$($SQL "$P -c \"select mt_situar_lugar('Madrid', -3.70, 40.41)\" postgres" 2>&1 | grep -c 'fuera de España')" "1"
comprobar "resincronizar no pisa lo que puso una persona" \
  "$($SQL "$P -c \"update mt_lugares set lat=40.1, lng=-3.1, coord_origen='cliente' where nombre='Madrid'\" postgres" >/dev/null 2>&1
      $SQL "$P -f /tmp/m113.sql postgres" >/dev/null 2>&1
      q "select coord_origen from mt_lugares where nombre='Madrid' and activo")" "cliente"

echo
printf "\n  %d pruebas pasadas, %d fallos\n\n" "$OK" "$MAL"
exit $((MAL>0))
