/* ============================================================
   EL REFRESCO NO CIERRA LO QUE SE ESTÁ LEYENDO

   El fallo: cada 30 segundos el panel se refrescaba reescribiendo
   la pantalla entera. En Conversaciones, la columna de la derecha
   volvía a «Elige a alguien de la lista» aunque la fila siguiera
   resaltada; en el Embudo, la ficha abierta desaparecía, y con ella
   lo que se estuviera escribiendo.

   Para cazarlo hace falta algo que el navegador simulado de
   pintar.mjs no tiene: que reescribir un trozo de HTML DESTRUYA los
   elementos de dentro. Aquí cada vez que se asigna innerHTML se
   crean nodos nuevos para todos los id que aparecen, como hace el
   navegador. Si el refresco reescribe la columna, el nodo que había
   deja de existir y la prueba lo ve.
   ============================================================ */

let OK = 0, MAL = 0;
function comprobar(nombre, obtenido, esperado){
  if (obtenido === esperado){ OK++; console.log('  ok    ' + nombre); }
  else { MAL++; console.log(`  FALLO ${nombre}\n        esperaba [${esperado}] obtuvo [${obtenido}]`); }
}
const espera = ms => new Promise(r => setTimeout(r, ms));

/* ---------- un DOM mínimo con nodos que nacen y mueren ---------- */
const NODOS = new Map();

function crearNodo(id){
  let html = '';
  let clases = new Set();
  const n = {
    id, dataset:{}, style:{}, value:'', textContent:'',
    scrollTop:0, scrollHeight:1000, clientHeight:400, childElementCount:0,
    get className(){ return [...clases].join(' '); },
    set className(v){ clases = new Set(String(v).split(/\s+/).filter(Boolean)); },
    classList:{
      add:c => clases.add(c), remove:c => clases.delete(c),
      contains:c => clases.has(c),
      toggle:(c, f) => { const on = f === undefined ? !clases.has(c) : !!f;
                         on ? clases.add(c) : clases.delete(c); return on; }
    },
    get innerHTML(){ return html; },
    set innerHTML(v){
      html = String(v);
      n.childElementCount = (html.match(/<[a-z]/gi) || []).length;
      // Como el navegador: lo de dentro es nuevo. Cada id que aparece
      // es un elemento recién creado, sin nada de lo que tuviera antes.
      // El texto suelto que lleve dentro se conserva, para que un
      // «Elige a alguien de la lista» recién pintado se vea como tal.
      for (const m of html.matchAll(/id="([^"]+)"[^>]*>([^<]*)/g))
        crearNodo(m[1]).textoInicial(m[2]);
    },
    textoInicial(t){ html = t; },
    // Poner un elemento en el sitio de otro: el sitio (el id) pasa a
    // ser suyo, como en el navegador.
    replaceWith(otro){ NODOS.set(id, otro); },
    addEventListener(){}, focus(){}, click(){}, scrollTo(){}, blur(){},
    setAttribute(){}, getAttribute:() => null,
    querySelector:() => null, querySelectorAll:() => [],
    getBoundingClientRect:() => ({ top:0, height:0, width:0 })
  };
  NODOS.set(id, n);
  return n;
}

// Lo que está en el HTML fijo de la página, fuera de #vista
for (const id of ['vista','modal','mbox','anuncio','rcuando','refrescar','cliente',
                  'ping','err','em','pw','entrar'])
  crearNodo(id);
NODOS.get('modal').style.display = 'none';

// Filas de las listas, leídas del HTML pintado. Solo hace falta lo
// que el panel usa de ellas: el dato y poder marcarlas.
function filas(attr){
  const r = [];
  for (const n of NODOS.values())
    for (const m of n.innerHTML.matchAll(new RegExp(attr + '="([^"]*)"', 'g')))
      r.push({ dataset: attr === 'data-c' ? { c: m[1] } : { lead: m[1] },
               classList:{ toggle(){}, add(){}, remove(){} }, addEventListener(){} });
  return r;
}

globalThis.document.querySelector = sel => {
  const m = /^#([\w-]+)$/.exec(sel);
  return m ? (NODOS.get(m[1]) || null) : null;
};
globalThis.document.querySelectorAll = sel =>
    sel.startsWith('.pers[data-c]')     ? filas('data-c')
  : sel.startsWith('.lfila[data-lead]') ? filas('data-lead')
  : [];
globalThis.document.getElementById = id => NODOS.get(id) || null;
const $$ = id => NODOS.get(id) || null;

/* ---------- la base, simulada ---------- */
const CONT = [
  { user_ref:'34600000001@s.whatsapp.net', nombre:'Ana',  telefono:'34600000001',
    mensajes:2, ultima:new Date().toISOString() },
  { user_ref:'34600000002@s.whatsapp.net', nombre:'Luis', telefono:'34600000002',
    mensajes:1, ultima:new Date().toISOString() }
];
const ANA = CONT[0].user_ref, LUIS = CONT[1].user_ref;
const ahora = () => new Date().toISOString();
const MSGS = {
  [ANA]:  [{ papel:'human', contenido:'Hola, soy Ana y busco despacho', cuando:ahora() },
           { papel:'ai',    contenido:'Claro, ¿para cuántas personas?', cuando:ahora() }],
  [LUIS]: [{ papel:'human', contenido:'Buenas, soy Luis', cuando:ahora() }]
};
const LEADS0 = [{ id:7, user_ref:ANA, nombre:'Ana', telefono:'34600000001', etapa:'entrada',
  toques:1, cualificado_de:2, ultima:ahora(), servicio:'Despacho', ubicacion:'Serrano' }];
let RETRASO = {}, RETRASO_FN = {}, FALLA = new Set(), LLAMADAS = [];
// Las zonas que nombran los clientes, para el mapa del Latido.
let DEMANDA = [
  { categoria:'ubicacion', nombre:'Serrano (Madrid)', conversaciones:5, generico:false,
    lat:40.43, lng:-3.687, ambito:'madrid' },
  { categoria:'ubicacion', nombre:'Las Tablas (Madrid)', conversaciones:3, generico:false,
    lat:40.505, lng:-3.665, ambito:'madrid' },
  { categoria:'ubicacion', nombre:'Vigo', conversaciones:2, generico:false,
    lat:42.24, lng:-8.72, ambito:'espana' }
];

globalThis.supabase.rpc = async (fn, args = {}) => {
  LLAMADAS.push(fn);
  if (RETRASO_FN[fn]) await espera(RETRASO_FN[fn]);
  if (FALLA.has(fn)) return { data:null, error:{ message:'sin red' } };
  if (fn === 'mt_demanda') return { data: DEMANDA.map(d => ({ ...d })), error:null };
  if (fn === 'mt_mensajes_contacto'){
    const ref = args.p_user_ref;
    if (RETRASO[ref]) await espera(RETRASO[ref]);
    return { data: (MSGS[ref] || []).map(m => ({ ...m })), error:null };
  }
  if (fn === 'mt_mis_contactos') return { data: CONT.map(c => ({ ...c })), error:null };
  if (fn === 'mt_mis_leads')     return { data: LEADS0.map(l => ({ ...l })), error:null };
  if (fn === 'mt_embudo_resumen') return { data:[{ etapa:'entrada', leads:1 }], error:null };
  return { data:[], error:null };
};

// El tic del temporizador. Antes del arreglo no existía como función
// suelta: era el cuerpo anónimo del setInterval, que en Conversaciones
// llamaba a pintarConvs(true) y en el Embudo a pintarEmbudo(true).
const tic = () => typeof tic30 === 'function' ? tic30()
  : VISTA === 'convs' ? pintarConvs(true) : pintarEmbudo(true);

const detalle = () => $$('pdetalle')?.innerHTML || '';

console.log('\n=== Conversaciones: el refresco automático ===');
VISTA = 'convs';
await pintarConvs();
await abrir(ANA);
const nodoAntes = $$('pdetalle');
comprobar('se abre la conversación de Ana', detalle().includes('soy Ana y busco despacho'), true);

await tic();
comprobar('tras el refresco, la conversación SIGUE abierta',
  detalle().includes('soy Ana y busco despacho'), true);
comprobar('y no ha vuelto a «Elige a alguien»',
  /Elige a alguien/.test(detalle()), false);
comprobar('la columna es el mismo elemento (no se ha recreado)',
  $$('pdetalle') === nodoAntes, true);
comprobar('la fila de Ana sigue marcada en la lista',
  ($$('pconvs')?.innerHTML || '').includes(`class="pers on" data-c="${ANA}"`), true);

console.log('\n=== Un mensaje nuevo entra sin cerrar nada ===');
MSGS[ANA].push({ papel:'human', contenido:'Somos cuatro, para enero', cuando:ahora() });
await tic();
comprobar('el mensaje nuevo aparece', detalle().includes('Somos cuatro, para enero'), true);
comprobar('y lo anterior sigue ahí', detalle().includes('soy Ana y busco despacho'), true);

console.log('\n=== Sin cambios no se repinta ===');
const htmlAntes = detalle();
const gcajaAntes = $$('gcaja');
await tic();
comprobar('si nada ha cambiado, la columna no se toca',
  $$('gcaja') === gcajaAntes && detalle() === htmlAntes, true);

console.log('\n=== Lo que está a medio hacer no se borra ===');
$$('gcaja').innerHTML = '<div class="gopc">¿Cuánto tiempo quieres que el asistente no le responda?</div>';
const gcaja = $$('gcaja');
MSGS[ANA].push({ papel:'ai', contenido:'Perfecto, te paso precios', cuando:ahora() });
await tic();
comprobar('con «Parar al asistente» abierto, el refresco espera',
  $$('gcaja') === gcaja && gcaja.innerHTML.includes('gopc'), true);
gcaja.innerHTML = '';
await tic();
comprobar('al cerrarlo, el refresco vuelve a traer lo nuevo',
  detalle().includes('te paso precios'), true);

console.log('\n=== Un fallo de red no vacía la conversación ===');
FALLA.add('mt_mensajes_contacto');
await tic();
comprobar('sin red, la conversación se queda como estaba',
  detalle().includes('te paso precios'), true);
FALLA.delete('mt_mensajes_contacto');

console.log('\n=== El botón ⟳ tampoco la cierra ===');
await refrescar();
comprobar('tras pulsar ⟳ sigue abierta', detalle().includes('soy Ana y busco despacho'), true);

console.log('\n=== Cambiar rápido de persona ===');
RETRASO[ANA] = 60;
const pA = abrir(ANA);
const pL = abrir(LUIS);
await Promise.all([pA, pL]);
comprobar('gana la ÚLTIMA elegida aunque la otra tarde más',
  detalle().includes('soy Luis') && !detalle().includes('soy Ana'), true);
comprobar('ABIERTO apunta a Luis', ABIERTO, LUIS);
RETRASO = {};

console.log('\n=== Un refresco a mitad de abrir no pisa a nadie ===');
RETRASO[ANA] = 60;
const pA2 = abrir(ANA);
await tic();               // llega mientras Ana se está cargando
await pA2;
comprobar('se queda Ana, la que se pidió', detalle().includes('soy Ana'), true);
RETRASO = {};

console.log('\n=== Volver a la pestaña ===');
VISTA = 'latido';
VISTA = 'convs';
await pintarConvs();
await espera(5);
await Promise.resolve();
comprobar('al volver, sigue la conversación que se estaba leyendo',
  detalle().includes('soy Ana'), true);

console.log('\n=== Embudo: la ficha abierta ===');
VISTA = 'embudo';
await pintarEmbudo();
abrirLead(7);
await espera(5);
const fichaAntes = $$('pficha');
$$('f_notas').value = 'Llamar el lunes por la mañana';
await tic();
comprobar('tras el refresco, la ficha SIGUE abierta',
  ($$('pficha')?.innerHTML || '').includes('f_notas'), true);
comprobar('es el mismo elemento: lo escrito no se pierde',
  $$('pficha') === fichaAntes && $$('f_notas').value === 'Llamar el lunes por la mañana', true);
comprobar('la fila del lead sigue marcada',
  ($$('lista-leads')?.innerHTML || '').includes('class="lfila on"'), true);
comprobar('el refresco trae leads nuevos (sincroniza)',
  LLAMADAS.filter(f => f === 'mt_sincronizar').length >= 2, true);

console.log('\n=== Escribiendo en un textarea, no se refresca ===');
VISTA = 'convs';
await pintarConvs();
const listaAntes = $$('plista');
globalThis.document.activeElement = { tagName:'TEXTAREA' };
if (typeof tic30 === 'function') await tic30();
comprobar('con un textarea enfocado no se toca nada',
  $$('plista') === listaAntes, true);
globalThis.document.activeElement = null;

console.log('\n=== Agenda: «Calendario» descarga la cita ===');
let fallo = null;
try {
  descargarICS({ t:'Ana', d:'Visita', w:new Date().toISOString(), e:'', p:'34600000001' });
} catch (e) { fallo = e.message; }
comprobar('descargar el .ics no lanza ningún error', fallo, null);

/* ============================================================
   EL MAPA DEL LATIDO

   El refresco del Latido reescribía también el mapa: el contenedor
   nuevo no tenía mapa, se creaba otro desde cero y volvía al
   encuadre inicial. Quien había hecho zoom en Madrid volvía a ver
   España entera cada 30 segundos.

   Leaflet, simulado: lo justo para saber cuántos mapas se crean,
   cuántas veces se reencuadra y cuántos puntos se dibujan.
   ============================================================ */
const MAPAS = [];
let PUNTOS_DIBUJADOS = 0;
globalThis.L = globalThis.window.L = {
  map(cont){
    const m = { cont, encuadres:0, eliminado:false, vista:'inicial',
      on(){}, scrollWheelZoom:{ enable(){}, disable(){} },
      remove(){ m.eliminado = true; },
      fitBounds(){ m.encuadres++; m.vista = 'encuadre automático'; },
      invalidateSize(){}, getContainer:() => cont };
    MAPAS.push(m); return m;
  },
  tileLayer:() => ({ addTo(){ return this; }, on(){}, remove(){} }),
  layerGroup(){
    const g = { capas:[], addTo(m){ m.grupo = g; return g; }, remove(){},
                getLayers:() => g.capas };
    return g;
  },
  circleMarker(){
    PUNTOS_DIBUJADOS++;
    const c = { addTo(g){ g.capas.push(c); return c; }, bindTooltip(){}, on(){},
                setStyle(){}, getElement:() => null };
    return c;
  },
  featureGroup:() => ({ getBounds:() => ({}) })
};

console.log('\n=== Latido: el mapa no vuelve al encuadre inicial ===');
VISTA = 'latido';
MAPA = 'madrid';
await pintarLatido();
await activarMapa();                       // entra en pantalla
const mapa = MAPAS[MAPAS.length - 1];
const creados = MAPAS.length;
comprobar('el mapa se crea y se encuadra una vez', mapa.encuadres, 1);
mapa.vista = 'zoom del usuario en Madrid';
const puntosAntes = PUNTOS_DIBUJADOS;

await tic();
await activarMapa();                       // el observador vuelve a verlo
comprobar('tras el refresco NO se crea otro mapa', MAPAS.length, creados);
comprobar('el mapa de antes sigue vivo', mapa.eliminado, false);
comprobar('se queda donde el usuario lo dejó',
  mapa.vista === 'zoom del usuario en Madrid' && mapa.encuadres === 1, true);
comprobar('el contenedor del mapa sigue en la página',
  $$('lmapa') === mapa.cont, true);
comprobar('sin cambios en los datos, no se redibujan los puntos',
  PUNTOS_DIBUJADOS, puntosAntes);

console.log('\n=== Llega una zona nueva ===');
DEMANDA.push({ categoria:'ubicacion', nombre:'Manoteras (Madrid)', conversaciones:1,
  generico:false, lat:40.48, lng:-3.66, ambito:'madrid' });
await tic();
await activarMapa();
comprobar('el punto nuevo aparece', mapa.grupo.capas.length, 3);
comprobar('sin mover el encuadre del usuario',
  mapa.vista === 'zoom del usuario en Madrid' && mapa.encuadres === 1, true);

console.log('\n=== Cambiar de ámbito SÍ reencuadra ===');
MAPA = 'espana';
repintarMapa();
comprobar('al pulsar otro ámbito se encuadra en él', mapa.encuadres, 2);

console.log('\n=== Si el refresco llega con otra pestaña abierta ===');
VISTA = 'latido';
RETRASO_FN['mt_conversaciones_lista'] = 40;
const pl = pintarLatido(true);
VISTA = 'convs';                           // se cambia mientras carga
$$('vista').innerHTML = '<div id="pconvs">Conversaciones</div>';
await pl;
RETRASO_FN = {};
comprobar('no pinta el Latido encima de otra pestaña',
  $$('vista').innerHTML.includes('Cardiograma'), false);

console.log(`\n  ${OK} comprobaciones pasadas, ${MAL} fallos\n`);
process.exit(MAL ? 1 : 0);
