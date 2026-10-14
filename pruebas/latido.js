const d={
 convs:Array.from({length:11},(_,i)=>({user_ref:'u'+i,mensajes:6,del_asistente:3,
   primera_en:new Date().toISOString(),ultima_en:new Date().toISOString(),
   interes:i<7,contacto:i<4,friccion:false,sin_respuesta:false,historico:false})),
 temas:[{categoria:'servicio',nombre:'Despachos, salas y oficina virtual',conversaciones:15,generico:false},
        {categoria:'servicio',nombre:'Domiciliación fiscal',conversaciones:10,generico:false},
        {categoria:'ubicacion',nombre:'Madrid',conversaciones:10,generico:true,
         lat:40.4168,lng:-3.7038,ambito:'espana'},
        {categoria:'ubicacion',nombre:'Las Tablas (Madrid)',conversaciones:9,generico:false,
         lat:40.505,lng:-3.665,ambito:'madrid'},
        {categoria:'ubicacion',nombre:'Vigo',conversaciones:4,generico:false,
         lat:42.2406,lng:-8.7207,ambito:'espana'}],
 reciente:[{user_ref:'u1',papel:'ai',contenido:'En Sanse, la oficina virtual está a 35€/mes + IVA.',cuando:new Date().toISOString()},
           {user_ref:'u1',papel:'human',contenido:'Tenéis algun plan más económico?',cuando:new Date().toISOString()}],
 patron:[{dia:1,hora:10,mensajes:3}],
 num:{conversaciones:66,tiempo_eur:290,ganados:0,ventas_eur:0,fuera_horario:8,
   fuera_horario_eur:3840,coste_hora:22,minutos_por_conv:12,ticket_medio:480,faltan:[]}
};
d.vivas=d.convs; d.hist=[];
const bloques={
 'Señales':interiorSenales(d), 'Servicios':bloqueTemas(d,'servicio'),
 'Ubicaciones':bloqueTemas(d,'ubicacion'), 'Tus números':bloqueNumeros(d.num),
 'Actividad':bloqueActividad(d), 'Mapa':bloqueMapa(d)};
for (const [n,h] of Object.entries(bloques)){
  const plegado = h.includes('panel plegado');
  console.log(`  ${n.padEnd(13)} ${plegado?'PLEGADO':'abierto '} · ${
    /undefined|NaN/.test(h)?'CON undefined/NaN':'limpio'}`);
}
let MALAS = 0; const ok = v => { if (v !== true) MALAS++; return v; };
console.log('\n  Tus números total:', (bloques['Tus números'].match(/tn-total">([^<]+)/)||[])[1]);
console.log('  Actividad sin punto:', ok(!bloques['Actividad'].includes('fdot')));
console.log('  Señales sin párrafo largo:', ok(!bloques['Señales'].includes('pueden quedarse cortas')));
console.log('  El mapa SE PINTA         :', ok(bloques['Mapa'].includes('id="lmapa"')));
console.log('  con sus ámbitos          :', ok(bloques['Mapa'].includes('data-m=')));

// ---- Configuración ----
globalThis.supabase.rpc = async (fn) => {
  if (fn === 'mt_resumen_servicio') return { data:[{
    cliente:'Oficinas YA!', slug:'oficinasya', canal:'prueba, whatsapp_evolution',
    sector:'Oficinas flexibles', alta:'2026-06-02T00:00:00Z',
    primer_registro:'2026-08-14T00:00:00Z', conversaciones:67, mensajes:450,
    contactos:39, usuarios:3, ubicaciones:8, servicios:6, zona_horaria:'Europe/Madrid',
    rol:'operador', puede_escribir:true,
    ajustes:{coste_hora_eur:22, minutos_por_conversacion:12, ticket_medio_eur:480,
             email_avisos:'comercial@oficinasya.es'} }], error:null };
  return { data:[], error:null };
};
let CFGHTML = '';
const antes = globalThis.document.querySelector;
globalThis.document.querySelector = (sel) => sel === '#vista'
  ? { set innerHTML(v){ CFGHTML = v; }, addEventListener(){}, querySelectorAll:()=>[],
      classList:{add(){},remove(){},toggle(){}}, style:{} }
  : antes(sel);
// En su pestaña: el panel no pinta Configuración encima de otra.
VISTA = 'ajustes';
await pintarAjustes(true);
if (!CFGHTML) { console.log('\n  Configuración NO se ha pintado. NO despliegues.'); process.exit(1); }
console.log('\n=== Configuración ===');
console.log('  Canal                :', (CFGHTML.match(/<dt>Canal<\/dt><dd>([^<]+)/)||[])[1]);
console.log('  sin fila "Mensajes"  :', ok(!CFGHTML.includes('<dt>Mensajes</dt>')));
console.log('  orden de paneles     :',
  ['Servicio','Tus preferencias','Parámetros de cálculo','Información del servicio','Tratamiento de datos']
    .map(t=>CFGHTML.indexOf(t)).filter(v=>v>=0)
    .every((v,i,a)=>i===0||v>a[i-1]) && ok(true) ? 'correcto' : (MALAS++, 'MAL'));
console.log('  ancho limitado       :', ok(CFGHTML.includes('class="ajustes"')));
console.log('  sin undefined/NaN    :', ok(!/undefined|NaN/.test(CFGHTML)));

if (MALAS){ console.log(`\n  ${MALAS} comprobaciones del pintado han fallado. NO despliegues.`); process.exit(1); }
