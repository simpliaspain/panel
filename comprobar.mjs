#!/usr/bin/env node
/* ============================================================
   comprobar.mjs · Revisión antes de desplegar
   ============================================================

   Los últimos seis fallos del panel fueron todos de la misma
   familia: dos sitios que tenían que coincidir y no coincidían.
   Una columna que no existía, una función con otro nombre, un id
   que no estaba, una clase ya usada, una columna borrada que
   seguía referenciada.

   Ninguno fallaba al desplegar. Fallaban cuando un cliente pulsaba
   un botón, y algunos se tragaban solos el error.

   Esto los busca antes. No sustituye a mirar el panel en staging;
   evita subir a staging cosas que ya se sabe que están rotas.

   Uso:
     node comprobar.mjs index.html maestro.html
   ============================================================ */

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

// En Windows no existe /tmp. Este fallo hacía que la comprobación
// de sintaxis reventara y se reportara como "el JavaScript no
// compila", cuando compilaba perfectamente.
const TMP = join(tmpdir(), 'comprobar-panel.mjs');

const archivos = process.argv.slice(2);
if (!archivos.length){
  console.error('Uso: node comprobar.mjs index.html [maestro.html]');
  process.exit(2);
}

// Clases que existen solo para que el JavaScript las encuentre.
const GANCHOS = new Set(['ics']);

let fallos = 0, avisos = 0;
const mal  = (f, m) => { fallos++; console.log(`  ✕ ${f}: ${m}`); };
const ojo  = (f, m) => { avisos++; console.log(`  ! ${f}: ${m}`); };

/* ---------- lo que existe en la base ----------
   Se lee de los .sql del directorio. No hace falta conexión: las
   migraciones son la fuente de la verdad de qué funciones hay. */
// Se buscan en varios sitios porque no siempre viven junto al panel.
// Se puede forzar con:  node comprobar.mjs --sql=RUTA index.html
const rutaSql = (process.argv.find(a => a.startsWith('--sql=')) || '').slice(6);
const candidatas = rutaSql ? [rutaSql] : [
  'migraciones', 'sql', '.',
  join('..', 'infraestructura', 'migraciones'),
  join('..', 'migraciones')
];
let carpetaSql = null, ficherosSql = [];
for (const c of candidatas){
  if (!existsSync(c)) continue;
  const f = readdirSync(c).filter(n => n.endsWith('.sql'));
  if (f.length){ carpetaSql = c; ficherosSql = f; break; }
}
const sql = ficherosSql.map(n => readFileSync(join(carpetaSql, n), 'utf8')).join('\n');

const funciones = new Set();
for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_0-9]+)\s*\(/gi))
  funciones.add(m[1].toLowerCase());

// Columnas por tabla, a partir de los create table y los alter add column
const columnas = {};
for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_0-9]+)\s*\(([\s\S]*?)\n\);/gi)){
  const t = m[1].toLowerCase();
  columnas[t] = columnas[t] || new Set();
  for (const l of m[2].split('\n')){
    const c = l.trim().match(/^([a-z_0-9]+)\s+[a-z]/i);
    if (c && !['primary','unique','check','foreign','constraint'].includes(c[1].toLowerCase()))
      columnas[t].add(c[1].toLowerCase());
  }
}
for (const m of sql.matchAll(/alter\s+table\s+(?:public\.)?([a-z_0-9]+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_0-9]+)/gi)){
  const t = m[1].toLowerCase();
  columnas[t] = columnas[t] || new Set();
  columnas[t].add(m[2].toLowerCase());
}
// Solo se comprueban las tablas cuyo CREATE TABLE está en estas
// migraciones. De las que solo conocemos por un ALTER ADD COLUMN
// tenemos una lista incompleta de columnas, y comprobar contra una
// lista incompleta produce falsos positivos: peor que no comprobar.
const completas = new Set();
for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_0-9]+)/gi))
  completas.add(m[1].toLowerCase());

// Sin migraciones a la vista NO se comprueban funciones ni columnas.
// Dar por inexistente todo lo que no se ve sería convertir la falta
// de información en una lista de fallos falsos.
const haySql = funciones.size > 0;
if (haySql)
  console.log(`\nMigraciones leídas de "${carpetaSql}": ${funciones.size} funciones.\n` +
              `Columnas comprobables en ${completas.size} tabla(s): las que tienen su\n` +
              `CREATE TABLE aquí. De las demás solo conozco los ALTER, y comprobar\n` +
              `contra una lista incompleta daría fallos falsos.\n`);
else
  console.log('\n! No he encontrado ningún .sql, así que NO compruebo si las\n' +
              '  funciones y las columnas existen. Para comprobarlo, pon las\n' +
              '  migraciones en una carpeta "migraciones" o usa --sql=RUTA\n');

for (const archivo of archivos){
  console.log(`── ${archivo}`);
  const html = readFileSync(archivo, 'utf8');
  const partes = html.split('<script type="module">');
  if (partes.length < 2){ mal(archivo, 'no tiene bloque <script type="module">'); continue; }
  const js  = partes[1].split('</script>')[0];
  const css = html.includes('<style>') ? html.split('<style>')[1].split('</style>')[0] : '';

  /* 1 · sintaxis */
  try {
    writeFileSync(TMP, js);
    execSync(`node --check "${TMP}"`, { stdio: 'pipe' });
  } catch (e){
    const salida = String(e.stderr || e.stdout || e.message || e);
    const linea = salida.split('\n').find(l => /Error|error/.test(l)) || salida.trim();
    mal(archivo, 'el JavaScript no compila: ' + linea.trim());
  }

  /* 2 · una sola etiqueta de cierre dentro del módulo
         Una cadena que contenga "</script>" cierra el bloque y mata
         todo lo que venga detrás. Ya pasó una vez. */
  const cierres = partes[1].split('</script>').length - 1;
  if (cierres !== 1) mal(archivo, `${cierres} cierres de script en el módulo (debe haber 1)`);

  /* 3 · funciones RPC que el panel llama y no existen */
  const llamadas = new Set([...js.matchAll(/\.rpc\(\s*'([a-z_0-9]+)'/gi)].map(m => m[1]));
  if (haySql) for (const f of llamadas)
    if (!funciones.has(f))
      mal(archivo, `llama a ${f}() y no aparece en ninguna migración`);

  /* 4 · columnas filtradas que no existen en esa tabla */
  if (haySql) for (const m of js.matchAll(/\.from\('([a-z_0-9]+)'\)([\s\S]{0,400}?)(?=\n\s*(?:const|let|\)|\];))/gi)){
    const tabla = m[1].toLowerCase();
    if (!completas.has(tabla) || !columnas[tabla]) continue;
    for (const f of m[2].matchAll(/\.(?:eq|neq|gt|gte|lt|lte|is|ilike|like|order)\('([a-z_0-9]+)'/gi))
      if (!columnas[tabla].has(f[1].toLowerCase()))
        mal(archivo, `filtra ${tabla}.${f[1]} y esa columna no existe`);
    const sel = m[2].match(/\.select\('([^']+)'/);
    if (sel && !sel[1].includes('*'))
      for (const c of sel[1].split(',').map(x => x.trim().split(':')[0]))
        if (/^[a-z_0-9]+$/.test(c) && !columnas[tabla].has(c) && !c.includes('('))
          mal(archivo, `selecciona ${tabla}.${c} y esa columna no existe`);
  }

  /* 5 · identificadores que el JS busca y el HTML no tiene
         Se miran también los que se generan dentro de plantillas. */
  const ids = new Set();
  for (const m of html.matchAll(/\bid="([a-zA-Z][\w-]*)"/g)) ids.add(m[1]);
  for (const m of js.matchAll(/\$\('#([a-zA-Z][\w-]*)'\)/g))
    if (!ids.has(m[1])) mal(archivo, `busca #${m[1]} y no existe en ningún sitio`);

  /* 6 · clases usadas sin estilo, y clases definidas dos veces en
         bloques distintos (la colisión de `.ficha`) */
  // Una clase cuenta como definida si aparece como selector en
  // cualquier posición: `.x{`, `.a .x{`, `input.x{`, `.x:hover{`…
  const definidas = new Set();
  for (const m of css.matchAll(/\.([a-zA-Z][\w-]*)(?=[\s,.:>{\[])/g))
    definidas.add(m[1]);

  // Una clase definida en dos sitios y usada en dos vistas distintas
  // es exactamente el fallo de `.ficha`. Se avisa de las que se
  // definen como selector raíz más de una vez fuera de media query.
  const fuera = css.split(/@media[^{]*\{/)[0];
  const raiz = {};
  for (const m of fuera.matchAll(/^\s*\.([a-zA-Z][\w-]*)\s*\{/gm))
    raiz[m[1]] = (raiz[m[1]] || 0) + 1;
  for (const [c, n] of Object.entries(raiz))
    if (n > 1) ojo(archivo, `.${c} se define ${n} veces fuera de media query`);

  for (const m of html.matchAll(/class="([^"${]+)"/g))
    for (const c of m[1].split(/\s+/))
      // Algunas clases existen solo como gancho del JavaScript y no
      // llevan estilo. Se marcan con el prefijo js-; las heredadas
      // están en GANCHOS, arriba.
      if (c && !definidas.has(c) && !GANCHOS.has(c) && !c.startsWith('js-'))
        ojo(archivo, `clase "${c}" usada sin estilo definido`);

  /* 7 · equilibrio del marcado estático */
  const cuerpo = partes[0];
  for (const t of ['div','section','header','nav','style','button','select','textarea','dl']){
    const a = (cuerpo.match(new RegExp(`<${t}[\\s>]`, 'g')) || []).length;
    const c = (cuerpo.match(new RegExp(`</${t}>`, 'g')) || []).length;
    if (a !== c) mal(archivo, `<${t}> desequilibrado: ${a} abiertos, ${c} cerrados`);
  }

  /* 8 · almacenamiento del navegador, prohibido en artefactos */
  if (/\blocalStorage\b|\bsessionStorage\b/.test(js))
    mal(archivo, 'usa localStorage o sessionStorage');

  console.log('');
}

console.log(fallos
  ? `\n${fallos} fallo(s) y ${avisos} aviso(s). NO despliegues.\n`
  : `\nSin fallos. ${avisos} aviso(s) para revisar.\n`);
process.exit(fallos ? 1 : 0);
