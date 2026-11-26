// Genera /demo/index.html a partir del panel de producción (../index.html).
// Uso, desde la carpeta del repositorio:  node demo/construir.mjs
// El panel es el mismo; solo cambia de dónde salen los datos (demo-datos.js).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const origen = path.join(aqui, '..', 'index.html');
let h = fs.readFileSync(origen, 'utf8');
const cambios = [
  // Supabase → los datos inventados.
  [/import \{ createClient \} from 'https:\/\/esm\.sh\/@supabase\/supabase-js@[^']+';/,
   "const { createClient } = window.__DEMO;   // demo: sin servidor (demo-datos.js)"],
  // demo-datos.js antes que el panel: los módulos se ejecutan después.
  [/<script type="module">/, '<script src="demo-datos.js"></script>\n<script type="module">'],
  [/<title>[^<]*<\/title>/, '<title>SimpliaSpain · Panel (demo)</title>'],
  [/const VERSION = '[^']*';/, "const VERSION = 'demo · " + new Date().toISOString().slice(0, 10) + "';"],
  // Correo e Idealista: como en el panel real, con el buzón inventado de demo-datos.js.
  [/const CO_EMPRESAS_CON_ACCESO = \[[^\]]*\];/, "const CO_EMPRESAS_CON_ACCESO = ['demo'];"],
  [/const CO_EMPRESAS_EN_PRUEBAS = \[[^\]]*\];/, "const CO_EMPRESAS_EN_PRUEBAS = ['demo'];"],
  // Quien escribe: nunca el logo de su dominio (un dominio inventado podría
  // existir y sacar el de otra empresa); a algunas personas, un retrato de
  // prueba (demo-datos.js, cara).
  [/function crCaraUrl\(p\)\{/, "function crCaraUrl(p){\n  { const u = window.__DEMO.cara(p); return u ? { url:u, g:true } : { url:'' }; }   // demo"],
  // Correo: por defecto, el correo a la izquierda y la respuesta a la derecha.
  [/CO\.vista = 'arriba';/, "CO.vista = 'lado';   // demo"],
  // Embudo: pocas tarjetas por columna, para que se vean huecos (demo-datos.js, embudo).
  [/function embPersonas\(\)\{/, "function embPersonas(){ return window.__DEMO.embudo(embPersonasTodas()); }   // demo\nfunction embPersonasTodas(){"]
];
for (const [re, por] of cambios) {
  if (!re.test(h)) { console.error('No encuentro en index.html:', re); process.exit(1); }
  h = h.replace(re, por);
}
// Sin datos de clientes reales: el panel lleva dentro una maqueta antigua
// (no se ve en la demo) con los centros, correos y carpetas de un cliente.
// Se cambian por los de «Coworking Demo»; en el código, el nombre corto
// del cliente pasa a 'ejemplo' en todas partes, así que se comporta igual.
const limpiar = [
  ['oficinasya-es.correoseguro.dinaserver.com', 'mail.coworkingdemo.es'],
  ['oficinasya.es', 'coworkingdemo.es'],
  ['reservas.simpliaspain.com/oficinasya/velazquez', 'reservas.simpliaspain.com/demo/visita-castellana'],
  ['reservas.simpliaspain.com/oficinasya/capitan-haya', 'reservas.simpliaspain.com/demo/visita-chamberi'],
  ['reservas.simpliaspain.com/oficinasya/serrano', 'reservas.simpliaspain.com/demo/visita-tablas'],
  ['reservas.simpliaspain.com/oficinasya/la-florida', 'reservas.simpliaspain.com/demo/visita-mendez'],
  ['reservas.simpliaspain.com/oficinasya', 'reservas.simpliaspain.com/demo'],
  ["'oficinasya'", "'ejemplo'"], [/\boficinasya:/g, 'ejemplo:'],
  ['Oficinas YA!', 'Coworking Demo'], ['Oficinas YA', 'Coworking Demo'], ['OficinasYA', 'Coworking Demo'],
  [/https:\/\/drive\.google\.com\/drive\/folders\/[A-Za-z0-9_-]+/g, 'https://coworkingdemo.es/fotos'],
  ['IBC Ortega y Gasset', 'Retiro'], ['La Florida (Pozuelo)', 'Arganzuela'],
  ['IBC Velázquez', 'Castellana 120'], ['IBC Capitán Haya', 'Chamberí'], ['IBC Serrano', 'Las Tablas'], ['IBC Colbrand', 'Méndez Álvaro'],
  ['La Florida', 'Arganzuela'], ['Pozuelo', 'Madrid'], ['Capitán Haya', 'Chamberí'], ['Velázquez', 'Castellana'], ['Serrano', 'Las Tablas'],
  ["'Manoteras'", "'Hortaleza'"], ["'Sanse'", "'Alcobendas'"], ['roberto@coworkingdemo.es', 'andrea@coworkingdemo.es'], ["nombre:'Roberto'", "nombre:'Andrea'"], ['Roberto le respondió', 'Andrea le respondió'],
  ['[[VISITA:gasset]]', '[[VISITA:castellana]]'],
  ['dinaserv1ce', 'mailnub3'], ['dinahosting', 'mailnube'], ['Dinahosting', 'MailNube'],
  ['que manda Laura', 'que manda el asistente'], ['que usa Laura', 'que usa el asistente'], ['marcas de Laura', 'marcas del asistente']
];
for (const [de, a] of limpiar) h = typeof de === 'string' ? h.split(de).join(a) : h.replace(de, a);
{
  const queda = h.match(/oficinas ?ya|IBC [A-ZÁÉÍÓÚ]|dinahosting|drive\.google\.com\/drive\/folders/i);
  if (queda) { console.error('Quedan datos de un cliente real:', queda[0]); process.exit(1); }
}
if (!/<meta name="robots" content="noindex/.test(h)) h = h.replace('<head>', '<head>\n<meta name="robots" content="noindex, nofollow">');
// Ninguna dirección del servidor de verdad puede quedar en uso.
if (/esm\.sh\/@supabase/.test(h)) { console.error('Sigue cargando Supabase'); process.exit(1); }
fs.writeFileSync(path.join(aqui, 'index.html'), h);
console.log('demo/index.html generado desde', path.relative(process.cwd(), origen), '·', Math.round(h.length / 1024), 'KB');
