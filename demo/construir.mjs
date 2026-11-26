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
  // Correo e Idealista: como los tiene Oficinas YA, con el buzón inventado de demo-datos.js.
  [/const CO_EMPRESAS_CON_ACCESO = \['oficinasya'\];/, "const CO_EMPRESAS_CON_ACCESO = ['oficinasya', 'demo'];"],
  [/const CO_EMPRESAS_EN_PRUEBAS = \['oficinasya'\];/, "const CO_EMPRESAS_EN_PRUEBAS = ['oficinasya', 'demo'];"],
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
if (!/<meta name="robots" content="noindex/.test(h)) h = h.replace('<head>', '<head>\n<meta name="robots" content="noindex, nofollow">');
// Ninguna dirección del servidor de verdad puede quedar en uso.
if (/esm\.sh\/@supabase/.test(h)) { console.error('Sigue cargando Supabase'); process.exit(1); }
fs.writeFileSync(path.join(aqui, 'index.html'), h);
console.log('demo/index.html generado desde', path.relative(process.cwd(), origen), '·', Math.round(h.length / 1024), 'KB');
