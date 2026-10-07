/* Pinta todos los bloques del Latido con datos de prueba y avisa si
   alguno lanza un error, sale plegado o deja un "undefined".

   Nació porque el panel se quedó en el esqueleto dos veces por
   errores que solo aparecen al EJECUTAR: comprobar.mjs lee el
   archivo, esto lo hace funcionar.

   Uso:  node pruebas/pintar.mjs [ruta/al/index.html]            */
import fs from 'fs';
import { execFileSync } from 'child_process';

const archivo = process.argv[2] || 'index.html';
let js = fs.readFileSync(archivo, 'utf8')
  .split('<script type="module">')[1].split('</script>')[0]
  .replace(/^\s*import[^\n]*\n/gm, '')
  .replace(/const supabase\s*=\s*createClient[^;]*;/, '');

const tmp = '/tmp/_pintar.mjs';
fs.writeFileSync(tmp,
  fs.readFileSync(new URL('./navegador-simulado.js', import.meta.url), 'utf8') +
  js + '\n' +
  fs.readFileSync(new URL('./latido.js', import.meta.url), 'utf8') +
  '\nprocess.exit(0);');

try {
  console.log(execFileSync('node', [tmp], { encoding:'utf8', timeout:60000 }));
} catch (e) {
  console.log((e.stdout || '') + (e.stderr || ''));
  console.log('\n  El Latido NO se pinta. NO despliegues.');
  process.exit(1);
}
