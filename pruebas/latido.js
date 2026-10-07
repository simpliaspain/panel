const d={
 convs:Array.from({length:11},(_,i)=>({user_ref:'u'+i,mensajes:6,del_asistente:3,
   primera_en:new Date().toISOString(),ultima_en:new Date().toISOString(),
   interes:i<7,contacto:i<4,friccion:false,sin_respuesta:false,historico:false})),
 temas:[{categoria:'servicio',nombre:'Despachos, salas y oficina virtual',conversaciones:15,generico:false},
        {categoria:'servicio',nombre:'Domiciliación fiscal',conversaciones:10,generico:false},
        {categoria:'ubicacion',nombre:'Barcelona Diagonal',conversaciones:10,generico:false},
        {categoria:'ubicacion',nombre:'Azca',conversaciones:9,generico:false}],
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
console.log('\n  Tus números total:', (bloques['Tus números'].match(/tn-total">([^<]+)/)||[])[1]);
console.log('  Actividad sin punto:', !bloques['Actividad'].includes('fdot'));
console.log('  Señales sin párrafo largo:', !bloques['Señales'].includes('pueden quedarse cortas'));
