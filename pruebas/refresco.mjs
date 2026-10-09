/* Comprueba que el refresco automático no cierra lo que se está
   leyendo: la conversación abierta en Conversaciones y la ficha
   abierta en el Embudo. Ver la explicación en refresco.js.

   Uso:  node pruebas/refresco.mjs [ruta/al/index.html]            */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const archivo = process.argv[2] || 'index.html';
const js = fs.readFileSync(archivo, 'utf8')
  .split('<script type="module">')[1].split('</script>')[0]
  .replace(/^\s*import[^\n]*\n/gm, '')
  .replace(/const supabase\s*=\s*createClient[^;]*;/, '');

// En la carpeta temporal del sistema: /tmp no existe en Windows.
const tmp = path.join(os.tmpdir(), '_refresco.mjs');
fs.writeFileSync(tmp,
  fs.readFileSync(new URL('./navegador-simulado.js', import.meta.url), 'utf8') +
  js + '\n' +
  fs.readFileSync(new URL('./refresco.js', import.meta.url), 'utf8'));

try {
  console.log(execFileSync('node', [tmp], { encoding:'utf8', timeout:60000 }));
} catch (e) {
  console.log((e.stdout || '') + (e.stderr || ''));
  console.log('\n  El refresco cierra lo que se está leyendo. NO despliegues.');
  process.exit(1);
}
