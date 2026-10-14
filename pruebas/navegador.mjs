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
//
// Y con tiempo máximo: una pantalla que se queda esperando para siempre
// (lo que hacía el Latido con una lectura colgada) es un fallo, no un
// motivo para que la batería no termine nunca.
async function seccion(nombre, fn){
  console.log(`\n=== ${nombre} ===`);
  let reloj;
  try {
    await Promise.race([fn(), new Promise((_, mal) => { reloj = setTimeout(() =>
      mal(new Error('no ha terminado de cargar en 45 s: se queda esperando')), 45000); })]);
  }
  catch (e){ MAL++; console.log(`  FALLO la pantalla se ha roto: ${e.message}`); }
  finally { clearTimeout(reloj); }
}
// Un error que el panel deja escapar en segundo plano (un refresco que
// revienta) es un fallo del panel. Sin esto, Node cerraba el proceso
// entero a mitad de batería y no se veía el resumen.
let ESCAPADOS = 0;
const escapado = e => {
  ESCAPADOS++; MAL++;
  console.log(`  FALLO error sin capturar en segundo plano: ${String(e?.message || e).split('\n')[0]}`);
};
process.on('unhandledRejection', escapado);
process.on('uncaughtException', escapado);

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
  // Cien veces más rápido, y con un interruptor para pararlo: lo que se
  // compruebe después de parar lo ha hecho el botón, no el reloj.
  w.setInterval = (f, ms, ...a) => si((...x) => { if (!w.__relojParado) f(...x); },
                                      Math.max(1, ms / 100), ...a);
  w.supabase = {
    auth:{ signInWithPassword: async () => ({ error:null }), signOut: async () => ({}) },
    rpc: async (fn, args = {}) => {
      const r = await rpc(fn, args);
      // Una lectura puede fallar de dos maneras: la base contesta con
      // un error, o la red ni siquiera deja llegar (la llamada lanza).
      if (r && r.__fallo === 'lanza') throw new TypeError('Failed to fetch');
      // Sin red, la librería real NO lanza: devuelve status 0 y el
      // mensaje del navegador. «Load failed» es el de Safari en iPhone.
      if (r && r.__fallo === 'red') return { data:null, status:0,
        error:{ message:'TypeError: Load failed', details:'', hint:'', code:'' } };
      if (r && r.__fallo) return { data:null, error:{ message:'permission denied for function ' + fn, code:'42501' } };
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

async function entrarCliente(ancho, rpc = rpcCliente){
  const p = montar(INDEX, ancho, rpc);
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
   EL LATIDO NO SE QUEDA NUNCA EN EL ESQUELETO

   El 11 de octubre el Latido dejó de cargar en todos los dispositivos:
   un mensaje recibido en domingo llega como día 7 (isodow) y la
   rejilla de «Cuándo escriben» va de 0 a 6. Aquel error, y cualquier
   otro de cualquier bloque o de la red, cortaba la pantalla entera y
   la dejaba en gris sin decir nada. Aquí se prueba el domingo, y que
   ningún fallo —de un bloque, de una lectura, de la red entera, o una
   lectura que no contesta— deje la pantalla así.
   ============================================================ */
const FALLO = { tipo:null, fns:new Set() };
const LATIDO_LECTURAS = ['mt_conversaciones_lista','mt_resumen','mt_por_hora',
  'mt_tiempo_respuesta','mt_actividad','mt_demanda','mt_patron_horario','mt_mis_numeros'];
let PATRON = [{ dia:1, hora:10, mensajes:3 }, { dia:7, hora:12, mensajes:2 }];
let BLOQUE_ROTO = false;
const INCID_PANEL = [];
const CONVS_LATIDO = PERSONAS.map((p, i) => ({ user_ref:p.user_ref, mensajes:4,
  del_cliente:2, del_asistente:2, primera_en:ahora(), ultima_en:ahora(),
  interes:i === 0, contacto:false, friccion:false, sin_respuesta:false, historico:false, seq:i }));

// Retraso por lectura, para provocar respuestas que llegan tarde.
let RETRASO = () => 0;
// El recuento de mensajes sale del rango pedido (24 h → 48 mensajes,
// 7 días → 336) y de EXTRA: así se ve qué rango se ha pintado y si un
// dato nuevo ha llegado a la pantalla.
let EXTRA = 0;
async function rpcLatido(fn, a){
  const ms = RETRASO(fn, a); if (ms) await espera(ms);
  if (FALLO.fns.has(fn)){
    if (FALLO.tipo === 'cuelga') return new Promise(() => {});
    return { __fallo: FALLO.tipo };
  }
  switch (fn){
    case 'mt_conversaciones_lista': return CONVS_LATIDO.map(c => ({ ...c }));
    case 'mt_resumen': return [{ mensajes: 2 * a.p_horas + EXTRA,
                                 del_cliente: a.p_horas + EXTRA, del_asistente: a.p_horas }];
    case 'mt_por_hora': return [{ tramo:ahora(), mensajes:3 }];
    case 'mt_tiempo_respuesta': return [{ fuente:'agente', muestras:30, mediana_s:3.2 }];
    case 'mt_actividad': return [{ user_ref:PERSONAS[0].user_ref, papel:'human',
                                   contenido:'Busco despacho', cuando:ahora() }];
    case 'mt_patron_horario': return PATRON.map(x => ({ ...x }));
    case 'mt_registrar_incidencia': INCID_PANEL.push(a); return 1;
    case 'mt_demanda': {
      const d = rpcCliente(fn, a);
      // Un valor que ninguna cuenta puede usar: el bloque de servicios
      // revienta al pintarlo. Así se prueba que no arrastra a los demás.
      return BLOQUE_ROTO
        ? [{ categoria:'servicio', nombre:'Roto', conversaciones:Symbol('x'), generico:false }, ...d]
        : d;
    }
  }
  return rpcCliente(fn, a);
}
const sinFallos = () => { FALLO.tipo = null; FALLO.fns.clear(); RETRASO = () => 0; EXTRA = 0; };
// Para el refresco automático: lo que se compruebe después lo ha hecho
// el botón o la acción que se prueba, no el reloj.
const pararReloj = p => { p.w.__relojParado = true; };
const pieConvs = p => textoDe(p, '.kpis .kpi:nth-child(2) .pie');
const latidoPintado = p => !!p.$('#vista .kpis');
const textoDe = (p, sel) => (p.$(sel)?.textContent || '').replace(/\s+/g, ' ').trim();

for (const ancho of [390, 1400]){
  await seccion(`Latido · un mensaje en domingo (${ancho === 390 ? 'móvil' : 'ordenador'})`, async () => {
    sinFallos();
    const p = await entrarCliente(ancho, rpcLatido);
    comprobar('el Latido se pinta, no se queda en el esqueleto', latidoPintado(p), true);
    const filas = [...p.w.document.querySelectorAll('.mfila')];
    const dom = filas.find(f => f.querySelector('.md')?.textContent === 'Dom');
    comprobar('«Cuándo escriben» tiene la fila del domingo, la última',
      filas[filas.length - 1] === dom && !!dom, true);
    comprobar('y en ella el mensaje de las 12:00',
      !!dom && [...dom.querySelectorAll('.mc')].some(c => c.title === 'Dom, 12:00, 2 mensajes'), true);
    comprobar('el lunes sigue en su sitio',
      [...p.w.document.querySelectorAll('.mc')].some(c => c.title === 'Lun, 10:00, 3 mensajes'), true);
    p.w.close();
  });
}

await seccion('Latido · una lectura falla y luego vuelve', async () => {
  sinFallos(); FALLO.tipo = 'error'; FALLO.fns.add('mt_por_hora');
  const p = await entrarCliente(390, rpcLatido);
  comprobar('el Latido se pinta igual', latidoPintado(p), true);
  comprobar('arriba dice qué falta', /Falta un dato: el cardiograma/.test(textoDe(p, '.lfalta')), true);
  comprobar('el cardiograma no dice «Sin mensajes» (sería falso)',
    /Sin mensajes en este periodo/.test(textoDe(p, '#vista')), false);
  comprobar('los indicadores que sí han llegado tienen su cifra',
    textoDe(p, '.kpi .num'), '3');
  sinFallos();
  await espera(TIC * 3);
  comprobar('cuando vuelve, el aviso desaparece solo', !!p.$('.lfalta'), false);
  comprobar('y el cardiograma aparece', !!p.$('#graf'), true);
  p.w.close();
});

await seccion('Latido · un dato que no llega no es un cero', async () => {
  sinFallos(); FALLO.tipo = 'error'; FALLO.fns.add('mt_conversaciones_lista');
  const p = await entrarCliente(390, rpcLatido);
  const pend = [...p.w.document.querySelectorAll('.kpi.pend .lab')].map(e => e.textContent);
  comprobar('«Personas atendidas» enseña «—», no 0', pend.includes('Personas atendidas'), true);
  comprobar('«Respuestas de la IA» también', pend.includes('Respuestas de la IA'), true);
  comprobar('el bloque de señales dice que no ha llegado',
    /No ha llegado este dato/.test(textoDe(p, '#vista')), true);
  p.w.close();
});

await seccion('Latido · un refresco sin red no estropea lo que hay', async () => {
  sinFallos(); INCID_PANEL.length = 0;
  const p = await entrarCliente(390, rpcLatido);
  const antes = textoDe(p, '.kpis');
  FALLO.tipo = 'red'; LATIDO_LECTURAS.forEach(f => FALLO.fns.add(f));
  await espera(TIC * 3);
  comprobar('el Latido sigue con los últimos datos', latidoPintado(p) && textoDe(p, '.kpis') === antes, true);
  comprobar('y avisa de que no están actualizados', /Sin actualizar/.test(textoDe(p, '.lfalta')), true);
  comprobar('un corte de red no se registra como incidencia',
    INCID_PANEL.some(i => /^rpc_/.test(i.p_codigo)), false);
  sinFallos();
  await espera(TIC * 3);
  comprobar('cuando vuelve la red, el aviso se va solo', !!p.$('.lfalta'), false);
  p.w.close();
});

await seccion('Latido · una lectura falla SIEMPRE y las demás cambian', async () => {
  sinFallos();
  const p = await entrarCliente(390, rpcLatido);
  comprobar('empieza con 48 mensajes', /^48 mensajes/.test(pieConvs(p)), true);
  FALLO.tipo = 'error'; FALLO.fns.add('mt_patron_horario');
  EXTRA = 10;
  await espera(TIC * 4);
  comprobar('lo que cambia llega a la pantalla (no se congela)', /^58 mensajes/.test(pieConvs(p)), true);
  comprobar('«Cuándo escriben» sigue con lo último que llegó', !!p.$('.mfila'), true);
  comprobar('y el aviso dice que no está actualizado',
    /Sin actualizar: cuándo escriben/.test(textoDe(p, '.lfalta')), true);
  sinFallos();
  p.w.close();
});

await seccion('Latido · cambiar el rango con una lectura caída', async () => {
  sinFallos();
  const p = await entrarCliente(390, rpcLatido);
  pararReloj(p);
  FALLO.tipo = 'error'; FALLO.fns.add('mt_resumen');
  p.$('.rg[data-h="168"]').click();
  await espera(80);
  comprobar('el botón de 7 días queda marcado', p.$('.rg[data-h="168"]')?.classList.contains('on'), true);
  comprobar('el recuento de 24 h NO se hace pasar por el de 7 días',
    pieConvs(p), 'Sin el recuento de mensajes');
  comprobar('y arriba dice qué falta', /Falta un dato: el recuento de mensajes/.test(textoDe(p, '.lfalta')), true);
  sinFallos();
  p.$('#lreint').click();
  await espera(80);
  comprobar('«Reintentar ahora» del aviso lo trae', /^336 mensajes/.test(pieConvs(p)) && !p.$('.lfalta'), true);
  p.w.close();
});

await seccion('Latido · una respuesta que llega tarde no pisa a la nueva', async () => {
  sinFallos();
  const p = await entrarCliente(390, rpcLatido);
  pararReloj(p);
  // El refresco de 24 h tarda; mientras, se pide 7 días.
  RETRASO = (fn, a) => fn === 'mt_resumen' && a.p_horas === 24 ? 250 : 0;
  p.ev('pintarLatido(true)');
  await espera(20);
  p.$('.rg[data-h="168"]').click();
  await espera(450);
  comprobar('se queda lo de 7 días, lo último que se pidió',
    /^336 mensajes/.test(pieConvs(p)) && p.$('.rg[data-h="168"]')?.classList.contains('on'), true);
  sinFallos();
  p.w.close();
});

await seccion('Latido · cambiar de pestaña a mitad de carga', async () => {
  sinFallos();
  const p = await entrarCliente(390, rpcLatido);
  pararReloj(p);
  RETRASO = fn => fn === 'mt_conversaciones_lista' ? 200 : 0;
  p.$('nav button[data-v="latido"]').click();
  await espera(20);
  RETRASO = () => 0;
  p.$('nav button[data-v="convs"]').click();
  await espera(400);
  comprobar('se ve Conversaciones, no el Latido encima',
    !!p.$('#pconvs') && !latidoPintado(p), true);
  p.w.close();
});

await seccion('Escrituras · no se cortan a los 20 s', async () => {
  // Sobre el texto: esperar 20 s por cada escritura alargaría la batería
  // sin probar nada más.
  const m = fs.readFileSync(INDEX, 'utf8').match(/const ESCRITURAS = new Set\(\[([^\]]*)\]\)/);
  const esc = new Set((m ? m[1] : '').match(/mt_[a-z_]+/g) || []);
  for (const f of ['mt_apuntar_toque','mt_guardar_lead','mt_mover_lead','mt_guardar_ajustes',
                   'mt_pausar','mt_reanudar','mt_excluir','mt_incluir','mt_deshacer_evento','mt_editar_evento'])
    comprobar(`${f} va sin tiempo máximo`, esc.has(f), true);
  comprobar('las lecturas sí lo tienen', esc.has('mt_resumen') || esc.has('mt_patron_horario'), false);
});

await seccion('Latido · sin red al entrar, y la red vuelve', async () => {
  sinFallos(); FALLO.tipo = 'lanza'; LATIDO_LECTURAS.forEach(f => FALLO.fns.add(f));
  const p = await entrarCliente(390, rpcLatido);
  comprobar('no se queda en el esqueleto: dice qué pasa',
    /No se ha podido cargar el Latido/.test(textoDe(p, '#vista')), true);
  comprobar('y ofrece reintentar', !!p.$('#lreint'), true);
  sinFallos();
  pararReloj(p);
  p.$('#lreint').click();
  await espera(80);
  comprobar('«Reintentar ahora» trae el Latido', latidoPintado(p), true);
  p.w.close();
});

await seccion('Latido · la red vuelve sola, sin tocar nada', async () => {
  sinFallos(); FALLO.tipo = 'error'; LATIDO_LECTURAS.forEach(f => FALLO.fns.add(f));
  const p = await entrarCliente(390, rpcLatido);
  comprobar('empieza con el aviso', /No se ha podido cargar el Latido/.test(textoDe(p, '#vista')), true);
  sinFallos();
  await espera(TIC * 3);
  comprobar('el refresco automático lo trae', latidoPintado(p), true);
  p.w.close();
});

await seccion('Latido · un bloque que falla no se lleva los demás', async () => {
  sinFallos(); BLOQUE_ROTO = true; INCID_PANEL.length = 0;
  const p = await entrarCliente(390, rpcLatido);
  BLOQUE_ROTO = false;
  comprobar('el Latido se pinta', latidoPintado(p), true);
  comprobar('el bloque roto lo dice en su sitio',
    /No se ha podido mostrar este bloque/.test(textoDe(p, '#vista')), true);
  comprobar('los demás bloques están', !!p.$('#graf') && !!p.$('.mfila') && !!p.$('.feed'), true);
  comprobar('y el fallo llega al maestro como incidencia crítica',
    INCID_PANEL.some(i => /^latido_/.test(i.p_codigo) && i.p_severidad === 'critico'), true);
  p.w.close();
});

await seccion('Latido · una lectura que no contesta nunca (tarda 20 s)', async () => {
  sinFallos(); FALLO.tipo = 'cuelga'; FALLO.fns.add('mt_resumen');
  const p = await entrarCliente(390, rpcLatido);
  comprobar('a los 20 s se pinta igual', latidoPintado(p), true);
  comprobar('y dice qué no ha llegado',
    /Falta un dato: el recuento de mensajes/.test(textoDe(p, '.lfalta')), true);
  sinFallos();
  p.w.close();
});

await seccion('Entrada · sin conexión no es «sin cliente»', async () => {
  sinFallos(); FALLO.tipo = 'lanza'; FALLO.fns.add('mt_mi_config');
  const p = await entrarCliente(390, rpcLatido);
  const t = textoDe(p, '#vista');
  comprobar('dice que no ha podido conectar', /No se ha podido conectar con el servicio/.test(t), true);
  comprobar('y no que la cuenta no tiene cliente', /no tiene ningún cliente/.test(t), false);
  sinFallos();
  p.$('#arreint').click();
  await espera(80);
  comprobar('«Reintentar» entra al Latido', latidoPintado(p), true);
  p.w.close();
});

/* ============================================================
   REVISIÓN DEL 14/10: LO QUE SE VERÍA EN UNA DEMOSTRACIÓN
   ============================================================ */
// Un rpc del cliente con piezas que se pueden cambiar por prueba.
let NUEVO = false, SOLO_LECTURA = false, CITAS = [], PAUSA_AUTO = false, MSG_LINEAS = false;
// Parámetros de cálculo: lo que se mandó a guardar, y si la base ya
// tiene la 119 (sin ella se salta los tres datos sin dar error).
let GUARDADO = null, SERVIDOR_119 = true, NUMEROS_SIN_PARAMS = false;
let AJUSTES = { email_avisos:['comercial@oficinasya.es'] };
const NUEVA = { user_ref:'34699999999@s.whatsapp.net', nombre:'Carmen Nueva', telefono:'34699999999' };
async function rpcDemo(fn, a){
  if (fn === 'mt_mi_config') return [{ slug:'oficinasya', nombre:'Oficinas YA!', rol: SOLO_LECTURA ? 'viewer' : 'admin',
                                       puede_escribir: !SOLO_LECTURA, ajustes:{} }];
  if (fn === 'mt_mis_citas') return CITAS.map(c => ({ ...c }));
  if (fn === 'mt_resumen_servicio') return [{ cliente:'Oficinas YA!', slug:'oficinasya', canal:'whatsapp_evolution',
    alta:'2026-06-02T00:00:00Z', conversaciones:3, mensajes:12, contactos:3, usuarios:2, ubicaciones:2, servicios:1,
    zona_horaria:'Europe/Madrid', rol: SOLO_LECTURA ? 'viewer' : 'admin', puede_escribir: !SOLO_LECTURA,
    ajustes:{ ...AJUSTES } }];
  if (fn === 'mt_guardar_ajustes'){
    GUARDADO = a.p_ajustes;
    const nuevos = { ...a.p_ajustes };
    if (!SERVIDOR_119 && !SOLO_LECTURA)
      for (const k of ['ticket_medio_eur','minutos_por_conversacion','coste_hora_eur']) delete nuevos[k];
    AJUSTES = { ...AJUSTES, ...nuevos };
    return { ...AJUSTES };
  }
  if (fn === 'mt_mis_numeros' && NUMEROS_SIN_PARAMS)
    return [{ conversaciones:12, tiempo_eur:0, ganados:0, ventas_eur:0, fuera_horario:3,
              fuera_horario_eur:0, coste_hora:null, minutos_por_conv:null, ticket_medio:null,
              faltan:['ticket','minutos','coste_hora'] }];
  const r = await rpcLatido(fn, a);
  if (r && r.__fallo) return r;
  if (fn === 'mt_mis_contactos'){
    const l = (r || []).map(c => ({ ...c }));
    if (PAUSA_AUTO) l[0] = { ...l[0], pausado_hasta: new Date(Date.now() + 2*36e5).toISOString(), pausado_por:'humano' };
    return NUEVO ? [...l, { ...NUEVA, mensajes:1, ultima:ahora() }] : l;
  }
  if (fn === 'mt_actividad' && NUEVO)
    return [{ user_ref:NUEVA.user_ref, nombre:NUEVA.nombre, papel:'human', contenido:'Hola, busco oficina', cuando:ahora() }];
  if (fn === 'mt_mensajes_contacto' && a.p_user_ref === NUEVA.user_ref)
    return [{ papel:'human', contenido:'Hola, busco oficina', cuando:ahora() }];
  if (fn === 'mt_mensajes_contacto' && MSG_LINEAS && a.p_user_ref === PERSONAS[0].user_ref)
    return [{ papel:'ai', contenido:'Tenemos:\nSala A\nSala B', cuando:ahora() }];
  return r;
}
// Cerrar una prueba sin dejar nada a medias: con la red lenta simulada,
// lo que aún esté esperando seguiría ejecutándose sobre una ventana ya
// cerrada (eso no pasa en un navegador, la página no desaparece a mitad).
const cerrarLimpio = async p => { pararReloj(p); limpiarDemo(); await espera(1100); p.w.close(); };
const limpiarDemo = () => { sinFallos(); NUEVO = false; SOLO_LECTURA = false; CITAS = []; PAUSA_AUTO = false; MSG_LINEAS = false;
  GUARDADO = null; SERVIDOR_119 = true; NUMEROS_SIN_PARAMS = false; AJUSTES = { email_avisos:['comercial@oficinasya.es'] }; };

await seccion('Demo · alguien escribe por primera vez con el panel abierto', async () => {
  limpiarDemo();
  const p = await entrarCliente(390, rpcDemo);
  NUEVO = true;
  await espera(TIC * 3);
  const fila = p.$(`.feed li[data-ir="${NUEVA.user_ref}"]`);
  comprobar('sale en la actividad reciente', !!fila, true);
  fila?.click();
  await espera(80);
  comprobar('su conversación se abre con su nombre, no con el número de WhatsApp',
    textoDe(p, '#mbox .dcab h2').includes('Carmen'), true);
  comprobar('y «Llamar» marca con el prefijo internacional',
    [...p.w.document.querySelectorAll('#mbox a[href^="tel:"]')].every(a => a.getAttribute('href') === 'tel:+34699999999'), true);
  await cerrarLimpio(p);
});

await seccion('Demo · «Ver conversación» desde el Embudo abre a ESA persona', async () => {
  limpiarDemo();
  const p = await entrarCliente(1400, rpcDemo);
  await ir(p, 'convs');
  p.$(`.pers[data-c="${PERSONAS[0].user_ref}"]`).click();      // se estaba leyendo a otra persona
  await espera(60);
  await ir(p, 'embudo');
  p.$('.lfila[data-lead="8"]').click();
  await espera(60);
  RETRASO = fn => fn === 'mt_mis_contactos' ? 900 : 0;          // y la red va lenta
  p.$('#fver').click();
  await espera(1300);
  comprobar('se ve Conversaciones', !!p.$('#pconvs'), true);
  comprobar('con la conversación de Persona 8, no la de antes',
    textoDe(p, '#pdetalle .dcab h2').includes('Persona 8'), true);
  await cerrarLimpio(p);
});

await seccion('Demo · «Abrir en Embudo» abre la ficha aunque la red vaya lenta', async () => {
  limpiarDemo();
  const p = await entrarCliente(1400, rpcDemo);
  await ir(p, 'convs');
  p.$(`.pers[data-c="${PERSONAS[1].user_ref}"]`).click();
  await espera(60);
  RETRASO = fn => fn === 'mt_sincronizar' ? 900 : 0;
  p.$('#verembudo').click();
  await espera(1300);
  comprobar('se abre la ficha de Persona 8 en la columna', textoDe(p, '#pficha .fcab h2').includes('Persona 8'), true);
  comprobar('y no en la ventana del móvil encima del ordenador', p.$('#modal').style.display === 'block', false);
  await cerrarLimpio(p);
});

await seccion('Demo · una búsqueda lenta no pisa a la siguiente', async () => {
  limpiarDemo();
  const p = await entrarCliente(1400, rpcDemo);
  await ir(p, 'convs');
  // Sin reloj: el refresco automático volvería a pintar la lista y
  // taparía el fallo, que en la vida real se ve 30 segundos.
  pararReloj(p);
  RETRASO = fn => fn === 'mt_buscar' ? 500 : 0;
  const b = p.$('#buscar');
  b.value = 'despacho'; b.dispatchEvent(new p.w.Event('input', { bubbles:true }));
  await espera(330);                        // la búsqueda en el servidor ya ha salido
  b.value = ''; b.dispatchEvent(new p.w.Event('input', { bubbles:true }));
  await espera(900);                        // y su respuesta llega tarde
  comprobar('con la caja vacía se ve la lista entera, no «Ninguna conversación contiene»',
    /Ninguna conversación contiene/.test(textoDe(p, '#plista')), false);
  await cerrarLimpio(p);
});

await seccion('Demo · Agenda con un apóstrofo en el nombre', async () => {
  limpiarDemo();
  const maniana = new Date(Date.now() + 864e5).toISOString();
  CITAS = [
    { nombre:"Luis D'Angelo", telefono:'34600000002', descripcion:'Visita, sala; 4 personas', cuando: maniana, estado:'confirmada' },
    { nombre:"x' autofocus tabindex=0 onfocus='window.__x=1", telefono:'34600000003', cuando: maniana, estado:'confirmada' }
  ];
  const p = await entrarCliente(1400, rpcDemo);
  let ics = null;
  p.w.Blob = class { constructor(partes){ ics = partes.join(''); } };
  p.w.URL.createObjectURL = () => 'blob:prueba';
  p.w.URL.revokeObjectURL = () => {};
  p.w.HTMLAnchorElement.prototype.click = function(){};
  await ir(p, 'agenda');
  const botones = [...p.w.document.querySelectorAll('button.ics')];
  comprobar('salen los dos botones «Calendario»', botones.length, 2);
  comprobar('ningún nombre mete atributos en el HTML',
    botones.some(b => b.hasAttribute('onfocus') || b.hasAttribute('autofocus')), false);
  botones[0]?.click();
  comprobar('«Calendario» descarga la cita de D\'Angelo', /D'Angelo/.test(ics || ''), true);
  comprobar('«Llamar» marca con +34',
    [...p.w.document.querySelectorAll('#vista a[href^="tel:"]')].map(a => a.getAttribute('href')).includes('tel:+34600000002'), true);
  await cerrarLimpio(p);
});

await seccion('Demo · cuenta de solo lectura: nada que falle al pulsarlo', async () => {
  limpiarDemo(); SOLO_LECTURA = true;
  const p = await entrarCliente(1400, rpcDemo);
  await ir(p, 'embudo');
  p.$('.lfila[data-lead="7"]').click();
  await espera(60);
  comprobar('la ficha se ve', !!p.$('#pficha .fcab'), true);
  comprobar('sin «Apuntar», sin barra de Guardar', !p.$('#t_ok') && !p.$('#fguardar'), true);
  comprobar('con los datos sin poder editarse', p.$('#f_notas')?.disabled, true);
  comprobar('y dice que es de solo lectura', /Solo lectura/.test(textoDe(p, '#faviso')), true);
  await ir(p, 'ajustes');
  comprobar('Configuración no ofrece «Guardar cambios» a quien no puede', !p.$('#guardar'), true);
  comprobar('pero enseña los correos', /comercial@oficinasya\.es/.test(textoDe(p, '#vista')), true);
  await cerrarLimpio(p);
});

await seccion('Configuración · el cliente pone sus parámetros de cálculo', async () => {
  limpiarDemo(); NUMEROS_SIN_PARAMS = true;
  const p = await entrarCliente(1400, rpcDemo);
  comprobar('sin parámetros, «Tus números» no enseña un 0 €: enseña «—»',
    textoDe(p, '#p-numeros .tn-total'), '—');
  comprobar('y le dice al cliente dónde ponerlos',
    /ponlo en Configuración, en «Parámetros de cálculo»/.test(textoDe(p, '#p-numeros')), true);
  await ir(p, 'ajustes');
  comprobar('el administrador del cliente ve los tres campos para rellenar',
    !!p.$('#tk') && !!p.$('#mn') && !!p.$('#ch') && !!p.$('#guardarpar'), true);
  const pon = (id, v) => { p.$(id).value = v; };
  pon('#tk', '1.450'); pon('#mn', '7'); pon('#ch', '22,5');
  p.$('#guardarpar').click();
  await espera(80);
  comprobar('se mandan como números, leídos a la española («1.450», «22,5»)',
    JSON.stringify(GUARDADO), JSON.stringify({ ticket_medio_eur:1450, minutos_por_conversacion:7, coste_hora_eur:22.5 }));
  comprobar('y dice que se ha guardado', /Guardado/.test(textoDe(p, '#msgpar')), true);
  GUARDADO = null;
  pon('#tk', 'mucho'); p.$('#guardarpar').click(); await espera(40);
  comprobar('lo que no es un número se dice y no se manda',
    JSON.stringify([GUARDADO, /tiene que ser un número/.test(textoDe(p, '#msgpar'))]), JSON.stringify([null, true]));
  pon('#tk', '350'); pon('#mn', '900'); p.$('#guardarpar').click(); await espera(40);
  comprobar('un valor imposible tampoco', JSON.stringify([GUARDADO, /entre 0 y 480/.test(textoDe(p, '#msgpar'))]), JSON.stringify([null, true]));
  await cerrarLimpio(p);
});

await seccion('Configuración · si la base aún no tiene la 119, no dice «Guardado»', async () => {
  limpiarDemo(); SERVIDOR_119 = false;
  const p = await entrarCliente(1400, rpcDemo);
  await ir(p, 'ajustes');
  p.$('#tk').value = '350'; p.$('#mn').value = '7'; p.$('#ch').value = '22';
  p.$('#guardarpar').click();
  await espera(80);
  comprobar('avisa de que no se ha guardado', /No se ha guardado/.test(textoDe(p, '#msgpar')), true);
  comprobar('y no dice «Guardado»', /^Guardado/.test(textoDe(p, '#msgpar')), false);
  await cerrarLimpio(p);
});

await seccion('Configuración · un lector ve los parámetros pero no los cambia', async () => {
  limpiarDemo(); SOLO_LECTURA = true; AJUSTES = { ticket_medio_eur:350, minutos_por_conversacion:7.5, coste_hora_eur:22 };
  const p = await entrarCliente(1400, rpcDemo);
  await ir(p, 'ajustes');
  comprobar('sin campos ni botón', !p.$('#tk') && !p.$('#guardarpar'), true);
  comprobar('con los valores escritos a la española', /7,5 min/.test(textoDe(p, '#parametros')), true);
  await cerrarLimpio(p);
});

await seccion('Demo · textos de la conversación', async () => {
  limpiarDemo(); PAUSA_AUTO = true; MSG_LINEAS = true;
  const p = await entrarCliente(1400, rpcDemo);
  await ir(p, 'convs');
  p.$(`.pers[data-c="${PERSONAS[0].user_ref}"]`).click();
  await espera(80);
  comprobar('la pausa automática dice cuándo vuelve, sin «vuelve hasta»',
    /vuelve a responderle a las/.test(textoDe(p, '#pdetalle')) && !/vuelve hasta/.test(textoDe(p, '#pdetalle')), true);
  comprobar('los saltos de línea del mensaje se conservan',
    p.$('#pdetalle .btxt')?.textContent, 'Tenemos:\nSala A\nSala B');
  comprobar('«Llamar» marca con +34',
    p.$('#pdetalle .dacc a[href^="tel:"]')?.getAttribute('href'), 'tel:+34600000007');
  await cerrarLimpio(p);
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

// El maestro con fallos que se pueden encender por prueba.
const FALLO_M = new Set();
const rpcMaestroF = fn => FALLO_M.has(fn) ? { __fallo:'red' } : rpcMaestro(fn);

await seccion('Maestro · un fallo de red en el refresco no borra la lista de clientes', async () => {
  FALLO_M.clear();
  const p = montar(MAESTRO, 1400, rpcMaestroF);
  p.$('#em').value = 'simpliaspain@gmail.com'; p.$('#pw').value = 'x';
  await p.ev('entrar()'); await espera(60);
  comprobar('empieza con el cliente en pantalla', /Oficinas YA!/.test(textoDe(p, '#vista')), true);
  FALLO_M.add('mt_operador_panorama'); FALLO_M.add('mt_mis_incidencias');
  await espera(TIC * 3);
  comprobar('tras refrescos sin red, el cliente sigue ahí', /Oficinas YA!/.test(textoDe(p, '#vista')), true);
  comprobar('sin el aviso de «No se ha podido leer el panorama»', /No se ha podido leer/.test(textoDe(p, '#vista')), false);
  FALLO_M.clear(); p.w.close();
});

await seccion('Maestro · ⟳ no recarga el formulario de Alta', async () => {
  FALLO_M.clear();
  const p = await entrarMaestro();
  await irM(p, 'alta');
  const marco = p.$('#mfalta');
  p.$('#refrescar').click();
  await espera(120);
  comprobar('el mismo formulario, sin recargar', p.$('#mfalta') === marco && !!marco, true);
  p.$('nav button[data-n="alta"]').click();
  await espera(80);
  comprobar('ni al volver a pulsar la pestaña', p.$('#mfalta') === marco, true);
  p.w.close();
});

await seccion('Maestro · sin red al entrar no es «no eres operador»', async () => {
  FALLO_M.clear(); FALLO_M.add('mt_soy_operador');
  const p = montar(MAESTRO, 1400, rpcMaestroF);
  p.$('#em').value = 'simpliaspain@gmail.com'; p.$('#pw').value = 'x';
  await p.ev('entrar()'); await espera(40);
  comprobar('dice que no hay conexión', /conexión/.test(textoDe(p, '#err')), true);
  comprobar('y no que la cuenta no tiene permiso', /permiso de operador/.test(textoDe(p, '#err')), false);
  comprobar('el botón vuelve a estar disponible', p.$('#entrar').disabled, false);
  FALLO_M.clear(); p.w.close();
});

console.log(`\n  ${OK} comprobaciones pasadas, ${MAL} fallos\n`);
if (MAL) console.log('  Algo se pierde al refrescar. NO despliegues.\n');
process.exit(MAL ? 1 : 0);
