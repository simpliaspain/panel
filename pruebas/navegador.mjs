/* ============================================================
   LOS DOS PANELES, EN UN DOM DE VERDAD

   Las otras baterías usan un navegador simulado a mano. Sirven para
   pintar bloques, pero no para lo que se rompe al USAR el panel: un
   oyente enganchado al elemento equivocado, un refresco que recrea un
   iframe, un campo que pierde lo escrito. Eso solo se ve con un DOM
   real. Esta batería carga index.html y maestro.html enteros en jsdom,
   con Supabase simulado y los temporizadores del panel cien veces más
   rápidos (30 s → 0,3 s), y hace lo que haría una persona:

     abre algo, escribe, espera varios refrescos, y mira si sigue ahí.

   Necesita jsdom, instalado UNA vez en la carpeta de encima del repo
   (así no entra en el repositorio, que es público):

       cd D:\SIMPLIASPAIN
       npm install jsdom@24

   Uso:  node pruebas/navegador.mjs [index.html] [maestro.html]
   ============================================================ */
import fs from 'fs';

let JSDOM;
try { ({ JSDOM } = await import('jsdom')); }
catch {
  console.log(`
  Falta jsdom. Instálalo una vez en la carpeta de ENCIMA del repo:

      cd D:\\SIMPLIASPAIN
      npm install jsdom@24

  y vuelve a ejecutar esta prueba.`);
  process.exit(1);
}

const INDEX   = process.argv[2] || 'index.html';
const MAESTRO = process.argv[3] || 'maestro.html';

let OK = 0, MAL = 0;
function comprobar(nombre, obtenido, esperado){
  if (obtenido === esperado){ OK++; console.log('  ok    ' + nombre); }
  else { MAL++; console.log(`  FALLO ${nombre}\n        esperaba [${esperado}] obtuvo [${obtenido}]`); }
}
const espera = ms => new Promise(r => setTimeout(r, ms));

// Cada pantalla se prueba aparte: si una se rompe del todo (la ficha
// desaparece y lo siguiente ya no existe), cuenta como fallo y se
// sigue con las demás en vez de cortar la batería a medias.
async function seccion(nombre, fn){
  console.log(`\n=== ${nombre} ===`);
  try { await fn(); }
  catch (e){ MAL++; console.log(`  FALLO la pantalla se ha roto: ${e.message}`); }
}
const ahora = () => new Date().toISOString();
const TIC = 300;                           // un refresco, acelerado

/* ---------- montar un panel en jsdom ---------- */
function montar(archivo, ancho, rpc){
  const html = fs.readFileSync(archivo, 'utf8');
  const js = html.split('<script type="module">')[1].split('</script>')[0]
    .replace(/^\s*import[^\n]*\n/gm, '')
    .replace(/const supabase\s*=\s*createClient[^;]*;/, '');
  const dom = new JSDOM(html.replace(/<script type="module">[\s\S]*?<\/script>/, ''),
    { runScripts:'outside-only', pretendToBeVisual:true,
      url:'https://panel.simpliaspain.com/staging/' });
  const w = dom.window;
  Object.defineProperty(w, 'innerWidth', { value: ancho, configurable:true });
  w.scrollTo = () => {};
  w.Element.prototype.scrollTo = function(){};
  const si = w.setInterval.bind(w);
  w.setInterval = (f, ms, ...a) => si(f, Math.max(1, ms / 100), ...a);
  w.supabase = {
    auth:{ signInWithPassword: async () => ({ error:null }), signOut: async () => ({}) },
    rpc: async (fn, args = {}) => {
      const r = await rpc(fn, args);
      return r === undefined ? { data:[], error:null } : { data:r, error:null };
    }
  };
  w.eval(js);
  return { w, $: s => w.document.querySelector(s), ev: s => w.eval(s) };
}
const escribir = (w, el, txt) => {
  el.value = txt;
  el.dispatchEvent(new w.Event('input', { bubbles:true }));
  el.dispatchEvent(new w.Event('change', { bubbles:true }));
  el.blur();                               // como quien escribe y hace clic fuera
};

/* ============================================================
   PANEL DEL CLIENTE
   ============================================================ */
const PERSONAS = [7, 8, 9].map(id => ({
  id, user_ref:`3460000000${id}@s.whatsapp.net`, nombre:'Persona ' + id,
  telefono:`3460000000${id}`, etapa:'entrada', toques: id === 7 ? 1 : 0,
  cualificado_de:1, email: id === 8 ? 'p8@empresa.es' : null }));
let MENSAJES = { [PERSONAS[0].user_ref]: [
  { papel:'human', contenido:'Busco despacho para cuatro', cuando:ahora() } ] };
let DEMANDA = [
  { categoria:'ubicacion', nombre:'Serrano (Madrid)', conversaciones:5, lat:40.43, lng:-3.687, ambito:'madrid' },
  { categoria:'ubicacion', nombre:'Las Tablas (Madrid)', conversaciones:3, lat:40.505, lng:-3.665, ambito:'madrid' }
];
const LLAMADAS = [];

function rpcCliente(fn, a){
  LLAMADAS.push(fn);
  switch (fn){
    case 'mt_mi_config': return [{ slug:'oficinasya', nombre:'Oficinas YA!', rol:'admin',
                                   puede_escribir:true, ajustes:{} }];
    case 'mt_mis_contactos': return PERSONAS.map(p => ({ user_ref:p.user_ref, nombre:p.nombre,
                                   telefono:p.telefono, mensajes:2, ultima:ahora() }));
    case 'mt_mensajes_contacto': return (MENSAJES[a.p_user_ref] || []).map(m => ({ ...m }));
    case 'mt_mis_leads': return PERSONAS.map(p => ({ ...p, ultima:ahora() }));
    case 'mt_embudo_resumen': return [{ etapa:'entrada', leads:3 }];
    case 'mt_demanda': return DEMANDA.map(d => ({ ...d, generico:false }));
    case 'mt_mis_numeros': return null;
    case 'mt_apuntar_toque': case 'mt_mover_lead': return true;
  }
}

// Leaflet, simulado: cuántos mapas se crean y cuántas veces se reencuadran.
function leaflet(w){
  const MAPAS = [];
  w.L = {
    map(cont){ const m = { cont, encuadres:0, eliminado:false,
      on(){}, scrollWheelZoom:{ enable(){}, disable(){} },
      remove(){ m.eliminado = true; }, fitBounds(){ m.encuadres++; },
      invalidateSize(){}, getContainer:() => cont }; MAPAS.push(m); return m; },
    tileLayer:() => ({ addTo(){ return this; }, on(){}, remove(){} }),
    layerGroup(){ const g = { capas:[], addTo(){ return g; }, remove(){}, getLayers:() => g.capas }; return g; },
    circleMarker(){ const c = { addTo(g){ g.capas.push(c); return c; }, bindTooltip(){}, on(){},
                                setStyle(){}, getElement:() => null }; return c; },
    featureGroup:() => ({ getBounds:() => ({}) })
  };
  return MAPAS;
}

async function entrarCliente(ancho){
  const p = montar(INDEX, ancho, rpcCliente);
  const MAPAS = leaflet(p.w);
  p.$('#login').style.display = 'none';
  p.$('#app').style.display = 'block';
  await p.ev('arrancar()');
  await espera(50);
  return { ...p, MAPAS };
}
const ir = async (p, v) => { p.$(`nav button[data-v="${v}"]`).click(); await espera(60); };

await seccion('Cliente · Conversaciones (pantalla ancha)', async () => {
  const p = await entrarCliente(1400);
  await ir(p, 'convs');
  p.$(`.pers[data-c="${PERSONAS[0].user_ref}"]`).click();
  await espera(40);
  const col = p.$('#pdetalle');
  comprobar('la conversación se abre al lado', col.textContent.includes('Busco despacho'), true);
  await espera(TIC * 4);
  comprobar('tras varios refrescos sigue abierta',
    p.$('#pdetalle') === col && col.textContent.includes('Busco despacho'), true);
  MENSAJES[PERSONAS[0].user_ref].push({ papel:'ai', contenido:'Tenemos sitio en Serrano', cuando:ahora() });
  await espera(TIC * 2);
  comprobar('un mensaje nuevo entra sin cerrarla', col.textContent.includes('Tenemos sitio en Serrano'), true);
  p.w.close();
});

await seccion('Cliente · Embudo (pantalla ancha)', async () => {
  const p = await entrarCliente(1400);
  await ir(p, 'embudo');
  p.$('.lfila[data-lead="8"]').click();
  await espera(40);
  const ficha = p.$('#pficha');
  escribir(p.w, p.$('#f_notas'), 'Llamar el lunes por la mañana');
  comprobar('al escribir en Datos aparece «Guardar»',
    p.$('#fguardar').classList.contains('on'), true);
  await espera(TIC * 4);
  comprobar('tras varios refrescos la ficha sigue abierta',
    p.$('#pficha') === ficha && !!p.$('#f_notas'), true);
  comprobar('y lo escrito sigue ahí', p.$('#f_notas')?.value, 'Llamar el lunes por la mañana');
  comprobar('y «Guardar» sigue visible', p.$('#fguardar').classList.contains('on'), true);
  comprobar('la fila del lead sigue marcada',
    p.$('.lfila[data-lead="8"]')?.classList.contains('on'), true);

  escribir(p.w, p.$('#t_detalle'), 'Llamada, no contesta');
  p.$('#t_ok').click();
  await espera(60);
  comprobar('«Apuntar» no borra los Datos sin guardar',
    p.$('#f_notas')?.value, 'Llamar el lunes por la mañana');
  comprobar('y deja el aviso «Apuntado» a la vista',
    p.$('#faviso')?.textContent, 'Apuntado');

  const sel = p.$('#fetapa');
  sel.value = 'cualificado';
  sel.dispatchEvent(new p.w.Event('change', { bubbles:true }));
  await espera(60);
  comprobar('cambiar de etapa no borra los Datos sin guardar',
    p.$('#f_notas')?.value, 'Llamar el lunes por la mañana');
  comprobar('y «Guardar» sigue avisando de que hay cambios',
    p.$('#fguardar').classList.contains('on'), true);
  p.w.close();
});

await seccion('Cliente · Embudo (móvil, ficha en ventana)', async () => {
  const p = await entrarCliente(900);
  await ir(p, 'embudo');
  p.$('.lfila[data-lead="7"]').click();
  await espera(40);
  comprobar('la ficha se abre en la ventana', p.$('#modal').style.display, 'block');
  escribir(p.w, p.$('#f_notas'), 'Visita el jueves');
  comprobar('al escribir aparece «Guardar»', p.$('#fguardar').classList.contains('on'), true);
  await espera(TIC * 4);
  comprobar('tras varios refrescos sigue abierta y con lo escrito',
    p.$('#modal').style.display === 'block' && p.$('#f_notas')?.value === 'Visita el jueves', true);
  p.w.close();
});

await seccion('Cliente · Latido, el mapa', async () => {
  const p = await entrarCliente(1400);
  await espera(60);
  const n = p.MAPAS.length;
  comprobar('el mapa se monta', n >= 1, true);
  const m = p.MAPAS[n - 1];
  const encuadres = m.encuadres;
  await espera(TIC * 4);
  comprobar('tras varios refrescos es el MISMO mapa', p.MAPAS.length === n && !m.eliminado, true);
  comprobar('y no ha vuelto al encuadre inicial', m.encuadres, encuadres);
  comprobar('su contenedor sigue en la página', m.cont.isConnected, true);
  p.w.close();
});

/* ============================================================
   PANEL MAESTRO
   ============================================================ */
let PANORAMA_NOMBRE = 'Oficinas YA!';
let INCIDENCIAS = [];
function rpcMaestro(fn){
  switch (fn){
    case 'mt_soy_operador': return true;
    case 'mt_operador_panorama': return [{ slug:'oficinasya', nombre:PANORAMA_NOMBRE, activo:true,
      personas:39, conversaciones:68, convs_24h:2, msgs_24h:9, resp_24h:9, convs_7d:12,
      convs_7d_previos:10, horas_sin_mensaje:1, lat_p95_s:6, lat_p50_s:3, lat_muestras:40,
      sin_respuesta_24h:0, friccion_7d:1, interes_7d:5, contacto_7d:3, incid_abiertas:0,
      incid_criticas:0, pausas:0, pausas_sin_aplicar:0, excluidos:0 }];
    case 'mt_mis_incidencias': return INCIDENCIAS;
    case 'mt_mi_config_operador': return [{ clave:'alta',
      valor:{ url:'https://n8n.example/webhook/mt/alta', nombre:'Alta de cliente' } }];
    case 'mt_mis_contactos': return PERSONAS.map(p => ({ user_ref:p.user_ref, nombre:p.nombre,
      telefono:p.telefono, mensajes:2 }));
    case 'mt_puede_escribir': return true;
    case 'mt_memoria_de': return [{ filas:4, primera:ahora(), ultima:ahora() }];
    case 'mt_operador_frenos': return [];
    case 'mt_memorias_borradas': return [];
  }
}
async function entrarMaestro(){
  const p = montar(MAESTRO, 1400, rpcMaestro);
  p.$('#em').value = 'simpliaspain@gmail.com'; p.$('#pw').value = 'x';
  await p.ev('entrar()');
  await espera(40);
  return p;
}
const irM = async (p, n) => { p.$(`nav button[data-n="${n}"]`).click(); await espera(60); };

await seccion('Maestro · Alta: el formulario empotrado', async () => {
  const p = await entrarMaestro();
  await irM(p, 'alta');
  const marco = p.$('#mfalta');
  comprobar('el formulario de alta está empotrado', !!marco, true);
  await espera(TIC * 4);
  comprobar('tras varios refrescos NO se recarga', p.$('#mfalta') === marco && marco.isConnected, true);
  INCIDENCIAS = [{ id:1, origen:'n8n', codigo:'x', severidad:'aviso', titulo:'Algo', detalle:{},
                   estado:'abierta', veces:1, primera_vez:ahora(), ultima_vez:ahora(), huella:'h1' }];
  await espera(TIC * 2);
  comprobar('ni siquiera cuando llegan datos nuevos', p.$('#mfalta') === marco, true);
  comprobar('y la insignia sí se pone al día', p.$('#bdg').textContent, '1');
  INCIDENCIAS = [];
  p.w.close();
});

await seccion('Maestro · Memoria: lo escrito en la confirmación', async () => {
  const p = await entrarMaestro();
  await irM(p, 'memoria');
  await espera(60);
  const q = p.$('#memq'); q.value = 'Persona 8';
  q.dispatchEvent(new p.w.Event('input', { bubbles:true }));
  await espera(300);
  p.$(`[data-mem="${PERSONAS[1].user_ref}"]`).click();
  await espera(60);
  escribir(p.w, p.$('#memconf'), PERSONAS[1].user_ref);
  await espera(TIC * 3);
  comprobar('sin cambios, la confirmación sigue escrita', p.$('#memconf')?.value, PERSONAS[1].user_ref);
  PANORAMA_NOMBRE = 'Oficinas YA! (renombrado)';          // cambia lo que se pinta
  await espera(TIC * 2);
  comprobar('el refresco ha repintado (dato nuevo)',
    p.$('#memsl')?.textContent.includes('renombrado'), true);
  comprobar('y la confirmación sigue escrita', p.$('#memconf')?.value, PERSONAS[1].user_ref);
  PANORAMA_NOMBRE = 'Oficinas YA!';
  p.w.close();
});

await seccion('Maestro · Pausas y exclusiones: el motivo', async () => {
  const p = await entrarMaestro();
  await irM(p, 'frenos');
  await espera(60);
  escribir(p.w, p.$('#exmot'), 'Pruebas internas del equipo');
  escribir(p.w, p.$('#exnum'), '34600000000@s.whatsapp.net');
  PANORAMA_NOMBRE = 'Oficinas YA! (otra vez)';
  await espera(TIC * 2);
  comprobar('tras un refresco con datos nuevos, el motivo sigue',
    p.$('#exmot')?.value, 'Pruebas internas del equipo');
  comprobar('y el contacto suelto también', p.$('#exnum')?.value, '34600000000@s.whatsapp.net');
  PANORAMA_NOMBRE = 'Oficinas YA!';
  p.w.close();
});

console.log(`\n  ${OK} comprobaciones pasadas, ${MAL} fallos\n`);
if (MAL) console.log('  Algo se pierde al refrescar. NO despliegues.\n');
process.exit(MAL ? 1 : 0);
