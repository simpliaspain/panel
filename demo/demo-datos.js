/* =====================================================================
   PANEL DE DEMOSTRACIÓN · datos inventados
   ---------------------------------------------------------------------
   Este archivo sustituye a Supabase en /demo: el panel es el mismo
   index.html de producción, pero cada llamada al servidor la contesta
   este archivo con datos de un cliente inventado («Coworking Demo»).

   · No se conecta a ningún servidor ni lee ni escribe datos reales.
   · Los datos se generan al abrir la página, con una semilla fija, y
     las fechas van referidas al momento en que se abre: siempre parece
     «de hoy», y siempre salen los mismos nombres y las mismas cifras.
   · Lo que se hace en la demo (pausar, mover un lead, apuntar un
     toque…) funciona y se ve, pero solo vive en esa pestaña.
   · Llamar, WhatsApp y correo no abren nada: son personas inventadas.
   · Las preferencias que el panel guarda en el navegador van con otro
     prefijo, para no mezclarse con las del panel real (mismo dominio).

   Para regenerar /demo/index.html tras cambiar el panel:
     node demo/construir.mjs
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- 0. Que nada de la demo toque lo del panel real ---------- */
  // Mismo dominio que el panel real: el almacenamiento del navegador se
  // comparte. Todo lo que la demo guarde va con el prefijo «simplia-demo:».
  const PREFIJO = 'simplia-demo:';
  function envolver(real) {
    const propias = () => {
      const ks = [];
      try { for (let i = 0; i < real.length; i++) { const k = real.key(i); if (k && k.startsWith(PREFIJO)) ks.push(k); } } catch (e) {}
      return ks;
    };
    return {
      getItem(k) { try { return real.getItem(PREFIJO + k); } catch (e) { return null; } },
      setItem(k, v) { try { real.setItem(PREFIJO + k, String(v)); } catch (e) {} },
      removeItem(k) { try { real.removeItem(PREFIJO + k); } catch (e) {} },
      clear() { propias().forEach(k => { try { real.removeItem(k); } catch (e) {} }); },
      key(i) { const k = propias()[i]; return k ? k.slice(PREFIJO.length) : null; },
      get length() { return propias().length; }
    };
  }
  for (const nombre of ['localStorage', 'sessionStorage']) {
    try {
      const real = window[nombre];
      Object.defineProperty(window, nombre, { value: envolver(real), configurable: true });
    } catch (e) { /* sin almacenamiento: el panel ya lo tolera */ }
  }

  /* ---------- 1. Azar con semilla: siempre los mismos datos ---------- */
  let semilla = 20261126;
  function azar() {
    semilla |= 0; semilla = (semilla + 0x6D2B79F5) | 0;
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const entre = (a, b) => a + Math.floor(azar() * (b - a + 1));
  const uno = l => l[Math.floor(azar() * l.length)];
  const prob = p => azar() < p;
  function pesado(pares) {
    const total = pares.reduce((s, p) => s + p[1], 0);
    let x = azar() * total;
    for (const [v, w] of pares) { if ((x -= w) < 0) return v; }
    return pares[pares.length - 1][0];
  }

  /* ---------- 2. Hora de Madrid ---------- */
  const MIN = 60e3, HORA = 3600e3, DIA = 86400e3;
  const AHORA = Date.now();
  const FMT = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  function partes(ts) {
    const o = {};
    for (const p of FMT.formatToParts(new Date(ts))) if (p.type !== 'literal') o[p.type] = Number(p.value);
    const dow = new Date(Date.UTC(o.year, o.month - 1, o.day)).getUTCDay();
    return { y: o.year, m: o.month, d: o.day, h: o.hour % 24, mi: o.minute, s: o.second, isodow: dow === 0 ? 7 : dow };
  }
  function desfase(ts) {
    const p = partes(ts);
    return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(ts / 1000) * 1000;
  }
  // Instante de una hora local de Madrid.
  function local(y, m, d, h = 0, mi = 0) {
    const guess = Date.UTC(y, m - 1, d, h, mi);
    let ts = guess - desfase(guess);
    ts = guess - desfase(ts);
    return ts;
  }
  const iso = ts => new Date(ts).toISOString();
  const hoy = partes(AHORA);
  const inicioHoy = local(hoy.y, hoy.m, hoy.d);
  // «Este mes» para «Tus números». A principios de mes casi no habría
  // nada que enseñar: hasta el día 10 se cuentan los últimos 30 días.
  const inicioMes = hoy.d >= 10 ? local(hoy.y, hoy.m, 1) : Date.now() - 30 * 86400e3;
  // Día local desplazado n días (para no tropezar con el cambio de hora).
  function diaLocal(n) {
    const base = new Date(Date.UTC(hoy.y, hoy.m - 1, hoy.d + n));
    return { y: base.getUTCFullYear(), m: base.getUTCMonth() + 1, d: base.getUTCDate(),
             isodow: ((base.getUTCDay() + 6) % 7) + 1 };
  }
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIAS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

  /* ---------- 3. El cliente inventado ---------- */
  const EMPRESA = 'Coworking Demo';
  const SLUG = 'demo';
  const CENTROS = [
    { clave: 'castellana', nombre: 'Castellana 120', dir: 'Paseo de la Castellana, 120', lugar: 'Castellana (Madrid)', lat: 40.4446, lng: -3.6906, peso: 34 },
    { clave: 'chamberi', nombre: 'Chamberí', dir: 'Calle de Santa Engracia, 54', lugar: 'Chamberí (Madrid)', lat: 40.4342, lng: -3.7005, peso: 26 },
    { clave: 'tablas', nombre: 'Las Tablas', dir: 'Calle de Isabel Colbrand, 10', lugar: 'Las Tablas (Madrid)', lat: 40.5050, lng: -3.6680, peso: 22 },
    { clave: 'mendez', nombre: 'Méndez Álvaro', dir: 'Calle de Méndez Álvaro, 56', lugar: 'Méndez Álvaro (Madrid)', lat: 40.3956, lng: -3.6780, peso: 18 }
  ];
  const OTRAS_CIUDADES = [
    ['Valencia', 39.4699, -0.3763, 9], ['Barcelona', 41.3874, 2.1686, 8], ['Málaga', 36.7213, -4.4214, 5],
    ['Sevilla', 37.3891, -5.9845, 4], ['Bilbao', 43.2630, -2.9350, 3], ['Zaragoza', 41.6488, -0.8891, 2]
  ];
  const SERVICIOS = {
    despacho: { nombre: 'Despacho privado', peso: 30 },
    fijo: { nombre: 'Puesto fijo', peso: 20 },
    flex: { nombre: 'Puesto flexible', peso: 15 },
    sala: { nombre: 'Sala de reuniones', peso: 14 },
    virtual: { nombre: 'Oficina virtual', peso: 13 },
    bono: { nombre: 'Bono de horas', peso: 8 }
  };
  const AJUSTES = {
    ticket_medio_eur: 480, minutos_por_conversacion: 9, coste_hora_eur: 24,
    horario: { inicio: 9, fin: 19, dias: [1, 2, 3, 4, 5] },
    email_avisos: ['comercial@coworkingdemo.es', 'direccion@coworkingdemo.es']
  };

  /* ---------- 4. Personas ---------- */
  const NOMBRES = ['Lucía', 'Marta', 'Javier', 'Pablo', 'Elena', 'Carlos', 'Sofía', 'Daniel', 'Laura', 'Alejandro', 'Paula', 'Sergio',
    'Andrea', 'Miguel', 'Carmen', 'David', 'Irene', 'Álvaro', 'Cristina', 'Jorge', 'Nuria', 'Raúl', 'Beatriz', 'Adrián', 'Sara', 'Diego',
    'Claudia', 'Rubén', 'Patricia', 'Íñigo', 'Ana', 'Mario', 'Silvia', 'Hugo', 'Rocío', 'Iván', 'Natalia', 'Víctor', 'Eva', 'Gonzalo',
    'Inés', 'Fernando', 'Blanca', 'Óscar', 'Alba', 'Marcos', 'Teresa', 'Luis', 'Clara', 'Tomás', 'Julia', 'Manuel', 'Noelia', 'Rafael'];
  const APELLIDOS = ['García', 'Martín', 'López', 'Sánchez', 'Romero', 'Navarro', 'Torres', 'Domínguez', 'Gil', 'Vázquez', 'Serrano',
    'Ramos', 'Blanco', 'Molina', 'Morales', 'Ortega', 'Delgado', 'Castro', 'Ortiz', 'Rubio', 'Marín', 'Sanz', 'Iglesias', 'Núñez',
    'Medina', 'Garrido', 'Cortés', 'Castillo', 'Santos', 'Lozano', 'Guerrero', 'Cano', 'Prieto', 'Méndez', 'Cruz', 'Calvo', 'Gallego',
    'Vidal', 'León', 'Herrera', 'Peña', 'Flores', 'Cabrera', 'Campos', 'Vega', 'Fuentes', 'Carrasco', 'Diez', 'Caballero', 'Reyes'];
  const EMPRESAS = ['Nexo Legal', 'Brava Studio', 'Kinto Labs', 'Arce Consultores', 'Lumen Digital', 'Trazo Arquitectura', 'Norte Fintech',
    'Ápice Marketing', 'Vela Software', 'Cima Asesores', 'Pulso Media', 'Ébano Diseño', 'Faro Data', 'Origen Ventures', 'Rumbo Logística'];
  const sinTilde = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const usados = new Set();
  function nuevaPersona() {
    let nombre, ape, clave;
    do { nombre = uno(NOMBRES); ape = uno(APELLIDOS); clave = nombre + ape; } while (usados.has(clave));
    usados.add(clave);
    const tel = '34' + uno(['6', '6', '6', '7']) + String(entre(10000000, 99999999));
    const empresa = prob(0.45) ? uno(EMPRESAS) : null;
    const email = empresa
      ? `${sinTilde(nombre)}@${sinTilde(empresa).replace(/[^a-z]/g, '')}.es`
      : `${sinTilde(nombre)}.${sinTilde(ape)}${prob(0.5) ? entre(70, 99) : ''}@${uno(['gmail.com', 'gmail.com', 'hotmail.com', 'outlook.es', 'yahoo.es'])}`;
    return {
      user_ref: tel + '@s.whatsapp.net', telefono: tel, nombre: nombre + ' ' + ape, pila: nombre,
      email, empresa, nombreConocido: false, emailDado: false, convs: []
    };
  }

  /* ---------- 5. Conversaciones ---------- */
  const PRECIOS = { despacho: [690, 2400], fijo: [220, 290], flex: [149, 189], sala: [25, 45], virtual: [39, 59], bono: [79, 129] };
  const eur = n => new Intl.NumberFormat('es-ES').format(n) + ' €';
  function precioDespacho(n) { return Math.round((390 + n * 215) / 10) * 10; }

  function horaDeVisita(desde) {
    // Siguiente día laborable (a veces el mismo día por la tarde), en franja de mañana o tarde.
    let n = 1 + (prob(0.25) ? 0 : entre(0, 2));
    const pd = partes(desde);
    let y = pd.y, m = pd.m, d = pd.d, ts;
    for (let i = 0; i < 10; i++) {
      const base = new Date(Date.UTC(y, m - 1, d + n));
      const dow = ((base.getUTCDay() + 6) % 7) + 1;
      if (dow <= 5) {
        ts = local(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), uno([10, 10, 11, 11, 12, 13, 16, 17, 18]), uno([0, 0, 30]));
        if (ts > desde + 3 * HORA) return ts;
      }
      n++;
    }
    return desde + 2 * DIA;
  }
  function cuandoTexto(ts) {
    const p = partes(ts);
    return `el ${DIAS[p.isodow]} ${p.d} a las ${p.h}:${String(p.mi).padStart(2, '0')}`;
  }
  function saludo(ts) {
    const h = partes(ts).h;
    return h < 6 || h >= 21 ? '¡Buenas noches' : h < 14 ? '¡Buenos días' : '¡Buenas tardes';
  }

  // Guion de una conversación: devuelve los mensajes (sin horas) y lo
  // que se sabe de la persona al final.
  function guion(p, ctx) {
    const c = ctx.centro, n = ctx.personas, srv = ctx.servicio, sal = saludo(ctx.inicio);
    const M = [], H = t => M.push({ papel: 'human', contenido: t }), A = t => M.push({ papel: 'ai', contenido: t });
    const quien = p.nombreConocido ? `, ${p.pila}` : '';
    const zonaPide = prob(0.7) ? c.nombre : uno(['el norte de Madrid', 'el centro', 'zona Castellana', 'Madrid']);
    let precio = 0;

    if (ctx.vuelve) {
      H(uno([`Hola de nuevo. Al final ${n > 1 ? 'somos ' + n : 'sigo buscando'}, ¿seguís teniendo hueco en ${c.nombre}?`,
        `Buenas, os escribí hace unos días. ¿Sigue libre lo de ${c.nombre}?`,
        `Hola, retomo lo que hablamos: ¿podemos cerrar una visita a ${c.nombre}?`]));
      A(`${sal}${quien}! Sí, sigue disponible. ¿Te va bien venir a verlo ${cuandoTexto(ctx.visita || horaDeVisita(ctx.inicio))}?`);
    } else if (srv === 'despacho') {
      precio = precioDespacho(n);
      H(uno([`Hola, buenas. Buscamos un despacho para ${n} personas en ${zonaPide}. ¿Tenéis algo disponible?`,
        `Hola! Necesitaríamos una oficina privada para un equipo de ${n}. ¿Qué precios manejáis en ${zonaPide}?`,
        `Buenas, ¿tenéis despachos cerrados para ${n} personas? Nos interesa ${zonaPide}.`]));
      A(`${sal}${quien}! Sí: en ${c.nombre} tenemos un despacho para ${n} personas, exterior y con luz natural, por ${eur(precio)} al mes. Incluye limpieza, fibra de 1 Gb, recepción, café y 6 horas de sala de reuniones al mes. ¿Para cuándo lo necesitaríais?`);
      H(uno([`Para el 1 de ${MESES[(partes(ctx.inicio).m) % 12]}. ¿Cuál es la permanencia mínima?`,
        `Lo antes posible. ¿Hay que firmar mucho tiempo?`, `Para dentro de unas semanas. ¿Qué permanencia pedís?`]));
      A(`La permanencia mínima es de 3 meses, y con contrato anual tenéis un 10 % de descuento. Podéis entrar en 48 horas. ¿Queréis venir a verlo? Os reservo la visita aquí: [[VISITA:${c.clave}]]`);
    } else if (srv === 'fijo') {
      precio = entre(PRECIOS.fijo[0], PRECIOS.fijo[1]);
      H(uno([`Hola, ¿cuánto cuesta un puesto fijo en ${zonaPide}?`, `Buenas! Busco mesa fija para ${n > 1 ? n + ' personas' : 'mí'}, ¿qué opciones tenéis?`,
        `Hola, me interesa un puesto fijo de lunes a viernes en ${zonaPide}.`]));
      A(`${sal}${quien}! El puesto fijo en ${c.nombre} son ${eur(precio)} al mes${n > 1 ? ' por persona' : ''}, con taquilla, acceso 24/7, fibra, café y 4 horas de sala al mes. Si queréis varios puestos juntos, os los reservamos en la misma isla. ¿Desde cuándo lo necesitarías?`);
      H(uno(['Desde el lunes que viene si puede ser.', 'Para el mes que viene.', 'Lo antes posible, ¿se puede ir a verlo?']));
      A(`Perfecto, hay disponibilidad. Lo mejor es que lo veas en persona, son 15 minutos: [[VISITA:${c.clave}]]`);
    } else if (srv === 'flex') {
      precio = entre(PRECIOS.flex[0], PRECIOS.flex[1]);
      H(uno([`Hola! Trabajo en remoto y busco algo flexible, ¿tenéis puestos sin mesa fija?`, `¿Cuánto es el coworking flexible en ${zonaPide}?`,
        `Buenas, ¿puedo ir solo unos días a la semana?`]));
      A(`${sal}${quien}! Sí: el puesto flexible son ${eur(precio)} al mes y puedes venir cuando quieras en horario de 8:00 a 21:00, a cualquiera de nuestros 4 centros. También tenemos bonos de 10 días. ¿Quieres probar un día gratis?`);
      H(uno(['¡Sí, me encantaría probar!', 'Vale, ¿cómo lo reservo?', 'Genial, ¿qué tengo que hacer?']));
      A(`Te lo dejo preparado: elige el día aquí [[VISITA:${c.clave}]] y el primer día te enseñamos el espacio.`);
    } else if (srv === 'sala') {
      precio = entre(PRECIOS.sala[0], PRECIOS.sala[1]);
      const hrs = entre(2, 4);
      H(uno([`Hola, necesito una sala de reuniones para ${entre(4, 10)} personas el ${DIAS[entre(1, 5)]} por la mañana.`,
        `¿Alquiláis salas por horas? Sería para una formación de ${hrs} horas.`, `Buenas, ¿tenéis sala con pantalla para una reunión con clientes?`]));
      A(`${sal}${quien}! Claro: en ${c.nombre} la sala sale a ${eur(precio)} la hora, con pantalla de 65", videoconferencia, pizarra y agua y café incluidos. Para ${hrs} horas serían ${eur(precio * hrs)}. ¿Te la reservo?`);
      H(uno(['Sí, resérvala por favor.', 'Perfecto, adelante.', 'Vale, ¿cómo pago?']));
      A('¡Hecho! Te la dejo bloqueada. Para mandarte la confirmación y la factura, ¿me pasas un email?');
    } else if (srv === 'virtual') {
      precio = entre(PRECIOS.virtual[0], PRECIOS.virtual[1]);
      H(uno([`Hola, ¿ofrecéis domiciliación de empresa?`, `Buenas, necesito una dirección fiscal en Madrid para mi sociedad.`,
        `¿Cuánto cuesta la oficina virtual?`]));
      A(`${sal}${quien}! Sí: la oficina virtual son ${eur(precio)} al mes e incluye domiciliación fiscal y comercial en ${c.dir}, recepción de correo con aviso al momento y 2 horas de sala al mes. Se activa en 24 horas. ¿Es para una sociedad o para autónomo?`);
      H(uno(['Para una SL que estamos constituyendo.', 'Soy autónomo.', 'Para una sociedad, sí.']));
      A('Perfecto, lo tramitamos todo nosotros. Te paso el contrato para firmar online: ¿a qué email te lo envío?');
    } else {
      precio = entre(PRECIOS.bono[0], PRECIOS.bono[1]);
      H(uno([`Hola, ¿tenéis bonos de horas?`, `Buenas! Solo necesito ir algunas tardes, ¿qué me recomendáis?`, `¿Cómo funcionan los bonos?`]));
      A(`${sal}${quien}! El bono de 10 horas son ${eur(precio)} y no caduca en 3 meses; lo puedes usar en cualquier centro, también en salas. ¿Te lo activo?`);
      H(uno(['Sí, por favor.', 'Vale, me interesa.', 'Perfecto.']));
      A('Genial. ¿Me dejas un email para mandarte el acceso?');
    }

    // Final según lo que pase.
    if (ctx.friccion) {
      H(uno(['Prefiero hablar con una persona, ¿me podéis llamar?', '¿Me puede llamar alguien del equipo para ver lo del contrato?']));
      A('Claro. Le paso tu mensaje ahora mismo al equipo y te llaman hoy mismo. ¿A qué hora te viene mejor?');
      H(uno(['A partir de las 17:00.', 'Por la mañana, antes de las 13:00.', 'Cuando podáis.']));
      A('Apuntado. ¡Gracias por tu paciencia!');
      return { M, precio };
    }
    if (ctx.vuelve && ctx.visita) H(uno(['Sí, me va bien.', 'Perfecto, ese día me encaja.', 'Genial, allí estaré.']));
    if (ctx.daEmail && !ctx.visita && !ctx.vuelve && ['despacho', 'fijo', 'flex'].includes(srv))
      A('Si lo prefieres, te mando por email el dossier con fotos, planos y precios. ¿A qué dirección te lo envío?');
    if (ctx.visita) {
      if (!ctx.vuelve && srv !== 'sala' && srv !== 'virtual' && srv !== 'bono')
        H(uno(['Listo, reservado.', 'Ya está, he cogido hora.', '¡Hecho! Nos vemos allí.', 'Reservado, gracias.']));
      A(`¡Perfecto${p.nombreConocido ? ', ' + p.pila : ''}! Te esperamos ${cuandoTexto(ctx.visita)} en ${c.nombre} (${c.dir}). Pregunta en recepción por el equipo comercial. ¿Me dejas un email para enviarte la confirmación?`);
    }
    if (ctx.daEmail) {
      if (!p.nombreConocido) {
        H(`Sí, claro: ${p.email}. Soy ${p.pila}${p.empresa ? ', de ' + p.empresa : ''}.`);
        p.nombreConocido = true;
      } else H(p.email);
      p.emailDado = true;
      A(`¡Gracias, ${p.pila}! ${ctx.visita ? 'Te acabo de enviar la confirmación con la dirección y cómo llegar.' : 'Te lo acabo de enviar.'} Si necesitas cualquier cosa, escríbeme por aquí.`);
      if (prob(0.5)) H(uno(['¡Genial, gracias!', 'Perfecto, muchas gracias.', 'Gracias 🙌', 'Recibido 👍']));
    } else if (!ctx.visita) {
      H(uno(['Vale, lo hablo con mi socio y os digo.', 'Gracias, lo pienso y te escribo.', 'Ok, gracias por la info.', 'Perfecto, me lo apunto.']));
      A(`¡Claro! Aquí estoy para lo que necesites${p.nombreConocido ? ', ' + p.pila : ''}. Si quieres, te puedo guardar el ${SERVICIOS[srv].nombre.toLowerCase()} 48 horas sin compromiso.`);
    }
    return { M, precio };
  }

  /* ---------- 6. Generación: 60 días de actividad ---------- */
  const PERSONAS = [];
  const CONVS = [];
  const RESERVAS = [];
  let idConv = 0;

  const FRANJA = [[7, 2], [8, 5], [9, 8], [10, 11], [11, 12], [12, 11], [13, 8], [14, 6], [15, 7], [16, 10], [17, 10],
    [18, 9], [19, 7], [20, 6], [21, 5], [22, 4], [23, 2], [0, 1]];
  // Qué parte del volumen de un día ha llegado ya a la hora h.
  const PESO_HASTA = h => FRANJA.filter(([x]) => x <= h).reduce((s, x) => s + x[1], 0) / FRANJA.reduce((s, x) => s + x[1], 0);
  function franjaHoraria() {
    // Pico de 10 a 13 y de 16 a 19; un 30 % fuera de horario (noches y fines de semana).
    return pesado(FRANJA);
  }

  function crearConversacion(p, inicio, vuelve) {
    const servicio = vuelve ? p.servicio : pesado(Object.entries(SERVICIOS).map(([k, v]) => [k, v.peso]));
    const centro = vuelve ? p.centro : pesado(CENTROS.map(c => [c, c.peso]));
    p.servicio = servicio; p.centro = centro;
    const personas = servicio === 'despacho' ? pesado([[2, 4], [3, 6], [4, 6], [5, 4], [6, 3], [8, 2], [10, 1]])
      : servicio === 'fijo' ? pesado([[1, 6], [2, 3], [3, 2]]) : servicio === 'sala' ? entre(4, 10) : 1;
    p.personas = p.personas || personas;
    const friccion = prob(0.025);
    const quiereVisita = !friccion && ['despacho', 'fijo', 'flex'].includes(servicio) && (vuelve || prob(0.36));
    const visita = quiereVisita ? horaDeVisita(inicio) : null;
    const daEmail = !friccion && (visita ? prob(0.92) : ['sala', 'virtual', 'bono'].includes(servicio) ? prob(0.85) : prob(0.22));
    const ctx = { inicio, servicio, centro, personas: p.personas, visita, daEmail, friccion, vuelve };
    const { M, precio } = guion(p, ctx);

    // Horas: el asistente contesta en 2–6 s; la persona tarda de 20 s a 6 min.
    let t = inicio;
    const msgs = M.map((m, i) => {
      if (i > 0) t += m.papel === 'ai' ? 0 : entre(20, 360) * 1000;
      if (m.papel === 'ai') {
        const lat = Math.round(pesado([[1900, 2], [2400, 5], [2900, 8], [3300, 9], [3800, 7], [4400, 4], [5200, 2], [6100, 1]]) + entre(-250, 250));
        t += lat;
        return { ...m, cuando: t, latencia_ms: lat };
      }
      return { ...m, cuando: t, latencia_ms: null };
    }).filter(m => m.cuando <= AHORA - 20e3);
    if (!msgs.length) return null;
    // Si la conversación de hoy aún va por la mitad, se corta ahí.
    const conv = {
      id: 'c' + (++idConv), p, msgs, primera: msgs[0].cuando, ultima: msgs[msgs.length - 1].cuando,
      servicio, centro, precio, personas: p.personas, visita: msgs.length === M.length ? visita : null,
      interes: servicio !== 'virtual' || prob(0.7), contacto: false, friccion, sin_respuesta: false
    };
    conv.contacto = msgs.some(m => m.papel === 'human' && m.contenido.includes('@'));
    if (friccion) { conv.atencion = conv.ultima; conv.atencion_motivo = 'Pide que le llame una persona del equipo'; }
    p.convs.push(conv);
    CONVS.push(conv);
    if (conv.visita) {
      RESERVAS.push({ p, conv, inicio: conv.visita, centro, creado_en: conv.ultima - 60e3, evento: 'BOOKING_CREATED' });
      p.visita = conv.visita;
    }
    return conv;
  }

  for (let n = -59; n <= 0; n++) {
    const d = diaLocal(n);
    const finde = d.isodow >= 6;
    const crecimiento = 0.72 + 0.48 * ((n + 59) / 59);          // el volumen sube a lo largo de los 60 días
    let cuantas = Math.round((finde ? 5.5 : 12) * crecimiento + entre(-1, 2));
    // Hoy solo lo que ya ha pasado, en proporción a lo que va de día.
    if (n === 0) cuantas = Math.max(2, Math.round(cuantas * Math.max(0.3, PESO_HASTA(hoy.h))));
    for (let i = 0; i < cuantas; i++) {
      let h = franjaHoraria();
      if (finde && prob(0.3)) h = entre(10, 20);
      // Hoy, a horas que ya han pasado.
      for (let k = 0; n === 0 && h > hoy.h && k < 30; k++) h = franjaHoraria();
      if (n === 0 && h > hoy.h) continue;
      const ini = local(d.y, d.m, d.d, h, entre(0, 59)) + entre(0, 59) * 1000;
      if (ini > AHORA - 4 * MIN) continue;
      const vuelve = PERSONAS.length > 30 && prob(0.1);
      let p;
      if (vuelve) {
        p = uno(PERSONAS.filter(x => x.convs.length && !x.convs.some(c => c.friccion) && x.convs[x.convs.length - 1].ultima < ini - DIA));
      }
      if (!p) { p = nuevaPersona(); PERSONAS.push(p); }
      crearConversacion(p, ini, !!vuelve && p.convs.length > 0);
    }
  }
  // Para que se vea «en vivo»: algo de hace unos minutos.
  for (const hace of [2.5, 7, 16, 31, 52]) {
    const p = nuevaPersona(); PERSONAS.push(p);
    crearConversacion(p, AHORA - hace * MIN - 4 * MIN, false);
  }
  // Una persona sin respuesta (para que el filtro exista, no para que abunde).
  { const c = CONVS.filter(x => x.ultima < AHORA - 3 * DIA)[5]; if (c) c.sin_respuesta = true; }

  PERSONAS.forEach(p => { p.convs.sort((a, b) => a.primera - b.primera); });
  CONVS.sort((a, b) => a.primera - b.primera);
  const vivas = () => PERSONAS.filter(p => p.convs.length);

  /* ---------- 7. Embudo ---------- */
  const LEADS = [];
  const HIST = new Map();   // id → eventos
  let idLead = 1000, idEv = 50000;
  const QUIEN = ['Andrea (comercial)', 'Javier (gerente)', 'Andrea (comercial)', 'Recepción'];
  function evento(lead, tipo, cuando, extra = {}) {
    if (!HIST.has(lead.id)) HIST.set(lead.id, []);
    HIST.get(lead.id).push({ id: ++idEv, cuando: iso(cuando), tipo, desde: null, hasta: null, detalle: null, quien: null, ...extra });
  }
  function valorMes(p, conv) {
    if (conv.servicio === 'despacho') return precioDespacho(p.personas);
    if (conv.servicio === 'fijo') return conv.precio * (p.personas || 1);
    if (conv.servicio === 'sala') return conv.precio * 4;
    return conv.precio || 0;
  }
  const CUANDO = ['Lo antes posible', 'En 2 semanas', 'El mes que viene', 'A partir de enero', 'En 1 mes'];
  const PERMA = ['3 meses', '6 meses', '1 año', 'Indefinido', '1 año'];
  const SITU = ['Teletrabajo', 'Oficina propia, se les queda pequeña', 'Otro coworking', 'Cafeterías', 'Oficina que cierra en diciembre'];
  const DECIDE = ['Él/ella', 'Socios', 'Dirección general', 'Él/ella con su socio'];
  const PROX = { entrada: 'Primer contacto por WhatsApp', cualificado: 'Proponer visita', visita_agendada: 'Confirmar la visita el día antes',
    visita_hecha: 'Enviar propuesta', propuesta: 'Llamar para cerrar' };

  let ganadosMes = 0;
  for (const p of vivas()) {
    const cs = p.convs, ult = cs[cs.length - 1];
    const interes = cs.some(c => c.interes), contacto = cs.some(c => c.contacto);
    if (!interes && !contacto) continue;
    if (!['despacho', 'fijo', 'flex', 'virtual', 'sala'].includes(ult.servicio) && !contacto) continue;
    const conVisita = cs.find(c => c.visita) ? cs.filter(c => c.visita).pop().visita : null;
    let etapa;
    if (conVisita && conVisita > AHORA) etapa = 'visita_agendada';
    else if (conVisita) {
      const dias = (AHORA - conVisita) / DIA;
      etapa = dias < 1.5 ? 'visita_hecha' : pesado([['visita_hecha', dias < 6 ? 30 : 10], ['propuesta', dias < 12 ? 26 : 14], ['ganado', 46], ['perdido', 13]]);
    } else if (contacto) etapa = pesado([['cualificado', 72], ['entrada', 20], ['perdido', 8]]);
    else etapa = (AHORA - ult.ultima) / DIA > 25 ? pesado([['perdido', 30], ['entrada', 70]]) : 'entrada';

    const primera = cs[0].primera;
    let cerrado = null;
    if (etapa === 'ganado') cerrado = Math.min(AHORA - 2 * HORA, (conVisita || ult.ultima) + entre(1, 5) * DIA);
    if (etapa === 'ganado' && cerrado >= inicioMes) ganadosMes++;
    const datos = [p.personas, prob(0.85) && CUANDO[entre(0, 4)], prob(0.7) && PERMA[entre(0, 4)], prob(0.6) && SITU[entre(0, 4)], prob(0.55) && DECIDE[entre(0, 3)]];
    const vivo = !['ganado', 'perdido'].includes(etapa);
    let toques = etapa === 'entrada' ? (prob(0.4) ? 1 : 0) : entre(1, 4);
    const lead = {
      id: ++idLead, user_ref: p.user_ref, nombre: p.nombreConocido ? p.nombre : null, email: p.emailDado ? p.email : null,
      telefono: p.telefono, canal: pesado([['google', 30], ['web', 22], ['whatsapp_directo', 16], ['portal', 12], ['referido', 11], ['walkin', 4], ['evento', 3], ['desconocido', 2]]), etapa, personas: p.personas || null,
      cuando_necesita: datos[1] || null, permanencia: datos[2] || null, situacion_actual: datos[3] || null, quien_decide: datos[4] || null,
      servicio: SERVICIOS[ult.servicio].nombre, ubicacion: ult.centro.nombre, valor_mes: valorMes(p, ult),
      proxima_accion: vivo ? PROX[etapa] : null,
      proxima_fecha: null, toques, notas: prob(0.35) ? uno(['Muy interesados, comparan con otro centro.', 'Quieren factura a nombre de la empresa.',
        'Necesitan aparcamiento para 2 coches.', 'Vienen de una oficina propia, buscan flexibilidad.', 'Les encaja la terraza.']) : null,
      primera: iso(primera), ultima: iso(ult.ultima), conversaciones: cs.length, mensajes: cs.reduce((s, c) => s + c.msgs.length, 0),
      respuesta_s: Number((cs.flatMap(c => c.msgs).filter(m => m.latencia_ms).reduce((s, m, i, a) => s + m.latencia_ms / a.length, 0) / 1000).toFixed(1)),
      cita: conVisita && conVisita > AHORA ? iso(conVisita) : null,
      cualificado_de: datos.filter(Boolean).length, auto: null,
      ultimo_texto: ult.msgs[ult.msgs.length - 1].contenido.replace(/\[\[VISITA:[a-z]+\]\]/g, 'enlace de visita').slice(0, 160),
      ultimo_cuando: iso(ult.ultima), cerrado_en: cerrado
    };
    // Próximo paso solo donde lo apuntaría un comercial: casi todo a
    // futuro, unos pocos para hoy y alguno que se pasó ayer.
    const dias = etapa === 'visita_agendada' ? null
      : etapa === 'visita_hecha' || etapa === 'propuesta' ? pesado([[0, 3], [1, 4], [2, 4], [3, 3], [5, 2], [-1, 0.6]])
      : etapa === 'cualificado' && prob(0.3) ? pesado([[1, 4], [2, 4], [3, 3], [5, 3], [7, 2], [0, 0.6]]) : null;
    if (vivo && dias !== null) lead.proxima_fecha = new Date(Date.UTC(hoy.y, hoy.m - 1, hoy.d + dias)).toISOString().slice(0, 10);
    if (vivo && dias === null && etapa !== 'visita_agendada') lead.proxima_accion = null;
    LEADS.push(lead);
    p.lead = lead;
    // Historial
    evento(lead, 'alta', primera + 30e3, { detalle: 'Entra desde WhatsApp' });
    const camino = ['entrada', 'cualificado', 'visita_agendada', 'visita_hecha', 'propuesta', 'ganado'];
    const hasta = etapa === 'perdido' ? 'cualificado' : etapa;
    let t = primera + 2 * MIN, previa = 'entrada';
    for (const e of camino.slice(1, camino.indexOf(hasta) + 1)) {
      t = e === 'visita_agendada' && conVisita ? Math.min(AHORA - MIN, cs.find(c => c.visita).ultima)
        : e === 'visita_hecha' && conVisita ? conVisita + 2 * HORA
        : e === 'ganado' && cerrado ? cerrado : Math.min(AHORA - MIN, t + entre(2, 30) * HORA);
      evento(lead, 'etapa', t, { desde: previa, hasta: e, quien: e === 'cualificado' || e === 'visita_agendada' ? 'Asistente' : uno(QUIEN) });
      previa = e;
    }
    if (etapa === 'perdido') evento(lead, 'etapa', Math.min(AHORA - MIN, t + 3 * DIA), { desde: previa, hasta: 'perdido', detalle: uno(['Precio', 'Se quedan en su oficina', 'Otro centro más cerca de casa']), quien: 'Andrea (comercial)' });
    for (let i = 0; i < toques; i++) evento(lead, 'toque', Math.min(AHORA - MIN, primera + (i + 1) * entre(6, 40) * HORA),
      { detalle: uno(['Llamada: muy receptivo, quiere ver el despacho exterior.', 'WhatsApp: le mando fotos de la terraza.', 'Email con la propuesta y el contrato.',
        'Llamada: confirma presupuesto.', 'Le envío condiciones del contrato anual.']), quien: uno(QUIEN) });
    HIST.get(lead.id).sort((a, b) => new Date(b.cuando) - new Date(a.cuando));
  }
  // Ventas del mes: muy buenas pero creíbles (entre 14 y 19 este mes).
  for (const l of LEADS.filter(l => l.etapa === 'ganado' && l.cerrado_en >= inicioMes).slice(19)) {
    l.etapa = 'propuesta'; l.cerrado_en = null; l.proxima_accion = PROX.propuesta;
    l.proxima_fecha = new Date(Date.UTC(hoy.y, hoy.m - 1, hoy.d + entre(0, 3))).toISOString().slice(0, 10);
    const h = HIST.get(l.id); const i = h.findIndex(e => e.tipo === 'etapa' && e.hasta === 'ganado'); if (i >= 0) h.splice(i, 1);
    ganadosMes--;
  }
  for (const l of LEADS.filter(l => l.etapa === 'propuesta' || l.etapa === 'visita_hecha')) {
    if (ganadosMes >= 14) break;
    const desde = l.etapa;
    l.etapa = 'ganado'; l.proxima_accion = null; l.proxima_fecha = null;
    l.cerrado_en = Math.max(inicioMes + DIA, AHORA - entre(1, 9) * DIA);
    evento(l, 'etapa', l.cerrado_en, { desde, hasta: 'ganado', quien: 'Andrea (comercial)' });
    HIST.get(l.id).sort((a, b) => new Date(b.cuando) - new Date(a.cuando));
    ganadosMes++;
  }

  // Unas pocas visitas canceladas (de quien al final no siguió): un 0 % no se lo cree nadie.
  RESERVAS.filter(r => r.inicio < AHORA && r.p.lead && r.p.lead.etapa === 'perdido').slice(0, 4)
    .forEach(r => { r.evento = 'BOOKING_CANCELLED'; });

  /* ---------- 8. Lo que el panel guarda y cambia (en memoria) ---------- */
  const PAUSAS = new Map();         // user_ref → { hasta }
  const EXCLUIDOS = new Set();
  const CONTACTADOS = new Map();    // user_ref → { en, por, nota }
  const MARCAS = [];
  const CONVS_PERSONA = p => p.convs;
  const cuenta = c => !EXCLUIDOS.has(c.p.user_ref);

  // Dos personas que el equipo ya llamó por teléfono.
  for (const p of vivas().filter(p => p.lead && p.lead.etapa === 'propuesta').slice(0, 2))
    CONTACTADOS.set(p.user_ref, { en: iso(AHORA - entre(3, 30) * HORA), por: 'andrea@coworkingdemo.es', nota: 'Le llamé y le mandé la propuesta por email' });

  // Visitas: reservas, enlaces abiertos sin reservar y reenganches previstos.
  const VISITAS = [];
  for (const r of RESERVAS) VISITAS.push({ user_ref: r.p.user_ref, apertura: null,
    reserva: { evento: r.evento, centro_txt: r.centro.nombre, inicio: iso(r.inicio), creado_en: iso(r.creado_en) }, reenganche: null });
  {
    const abrieron = vivas().filter(p => !p.visita && p.convs.some(c => c.msgs.some(m => m.contenido.includes('[[VISITA:'))) && p.convs[p.convs.length - 1].ultima > AHORA - 6 * DIA).slice(0, 6);
    abrieron.forEach((p, i) => {
      const c = p.convs[p.convs.length - 1];
      const ap = Math.min(AHORA - 5 * MIN, c.ultima + entre(2, 50) * MIN);
      const re = i < 4 ? { estado: 'programado', cuando: iso(Math.max(AHORA + entre(40, 300) * MIN, ap + 22 * HORA)),
        texto: `Hola ${p.pila}, ¿pudiste ver los huecos para visitar ${p.centro.nombre}? Si te va mejor, te propongo yo un día.`, gancho: uno(['pendiente', 'siguiente_paso']) } : null;
      VISITAS.push({ user_ref: p.user_ref, apertura: { centro: p.centro.clave, centro_txt: p.centro.nombre, primera_en: iso(ap), ultima_en: iso(ap + entre(0, 90) * MIN), veces: entre(1, 3) },
        reserva: null, reenganche: re });
    });
  }
  // Reenganches que ya salieron (y la persona volvió a contestar).
  {
    const conRe = vivas().filter(p => p.convs.length >= 2).slice(-6);
    for (const p of conRe) {
      const c = p.convs[p.convs.length - 1];
      const antes = p.convs[p.convs.length - 2];
      const cuando = Math.min(c.primera - 30 * MIN, antes.ultima + 23 * HORA);
      if (cuando <= antes.ultima) continue;
      antes.msgs.push({ papel: 'ai', contenido: `Hola ${p.pila}, soy Lucía de ${EMPRESA}. ¿Pudiste darle una vuelta a lo de ${c.centro.nombre}? Esta semana aún tenemos hueco para enseñártelo.`,
        cuando, latencia_ms: null, reenganche: { gancho: 'siguiente_paso', creado_en: iso(cuando) } });
      antes.ultima = cuando;
    }
  }

  // Lista de espera.
  const ESPERA = [];
  {
    const cand = vivas().filter(p => p.servicio === 'despacho' && p.personas >= 5).slice(-3);
    cand.forEach((p, i) => ESPERA.push({
      id: 'e' + (i + 1), user_ref: p.user_ref, nombre: p.nombre, email: p.email, telefono: p.telefono,
      centros: [p.centro.nombre], personas: p.personas, tipo: 'despacho', presupuesto: precioDespacho(p.personas) + 200,
      resumen: `Despacho para ${p.personas} personas en ${p.centro.nombre}, exterior y con ventana`, estado: i === 2 ? 'avisada' : 'activa',
      creado_en: iso(AHORA - (12 - i * 4) * DIA), avisado_en: i === 2 ? iso(AHORA - 20 * HORA) : null,
      caduca_en: iso(AHORA + (78 + i * 4) * DIA), avisos: i === 2 ? 1 : 0, lead_id: p.lead ? p.lead.id : null }));
  }

  /* ---------- 9. Respuestas de cada función ---------- */
  const conversacionesQueCuentan = () => CONVS.filter(cuenta);
  function filaContacto(p) {
    const cs = p.convs, pa = PAUSAS.get(p.user_ref);
    const pasa = pa && pa.hasta > AHORA;
    return {
      user_ref: p.user_ref, nombre: p.nombreConocido ? p.nombre : null, telefono: p.telefono, email: p.emailDado ? p.email : null,
      conversaciones: cs.length, mensajes: cs.reduce((s, c) => s + c.msgs.length, 0),
      del_cliente: cs.reduce((s, c) => s + c.msgs.filter(m => m.papel === 'human').length, 0),
      del_asistente: cs.reduce((s, c) => s + c.msgs.filter(m => m.papel !== 'human').length, 0),
      primera: iso(cs[0].primera), ultima: iso(cs[cs.length - 1].ultima),
      interes: cs.some(c => c.interes), friccion: cs.some(c => c.friccion), contacto: cs.some(c => c.contacto), sin_respuesta: cs.some(c => c.sin_respuesta),
      historico: false, cita: p.visita && p.visita > AHORA ? iso(p.visita) : null, fuera_del_recuento: EXCLUIDOS.has(p.user_ref),
      pausado_hasta: pasa ? iso(pa.hasta) : null, pausado_por: pasa ? 'panel' : null,
      pausa_pedida_hasta: pasa ? iso(pa.hasta) : null, pausa_aplicada: pasa ? true : null
    };
  }
  function enRango(horas) { const desde = AHORA - Math.max(1, horas) * HORA; return conversacionesQueCuentan().filter(c => c.ultima > desde); }
  function mediana(l) { if (!l.length) return null; const s = [...l].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  function p95(l) { if (!l.length) return null; const s = [...l].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(0.95 * (s.length - 1)))]; }
  function tiempoRespuesta(horas) {
    const desde = AHORA - Math.max(1, horas || 720) * HORA;
    const l = conversacionesQueCuentan().flatMap(c => c.msgs).filter(m => m.latencia_ms && m.cuando > desde).map(m => m.latencia_ms);
    if (!l.length) return [{ fuente: 'ninguna', muestras: 0, mediana_s: null, p95_s: null }];
    return [{ fuente: 'agente', muestras: l.length, mediana_s: Math.round(mediana(l) / 100) / 10, p95_s: Math.round(p95(l) / 100) / 10 }];
  }
  function truncar(ts, porDia) {
    const p = partes(ts);
    return porDia ? local(p.y, p.m, p.d) : local(p.y, p.m, p.d, p.h);
  }
  const fueraHorario = ts => { const p = partes(ts); return p.h < AJUSTES.horario.inicio || p.h >= AJUSTES.horario.fin || !AJUSTES.horario.dias.includes(p.isodow); };

  const R = {
    mt_ping: () => true,
    mt_mi_config: () => [{ slug: SLUG, nombre: EMPRESA, zona_horaria: 'Europe/Madrid', rol: 'admin', puede_escribir: true, es_operador: false, ajustes: { ...AJUSTES } }],
    mt_ver_como: () => true,
    mt_mis_clientes: () => [],
    mt_sincronizar: () => [{ creados: 0, actualizados: 0 }],
    mt_registrar_incidencia: () => 1,

    mt_mis_contactos: () => vivas().map(filaContacto).sort((a, b) => new Date(b.ultima) - new Date(a.ultima)),
    mt_conversaciones_lista: a => conversacionesQueCuentan().slice(-(a?.p_limite || 1000)).map((c, i) => ({
      id: c.id, user_ref: c.p.user_ref, primera_en: iso(c.primera), ultima_en: iso(c.ultima), mensajes: c.msgs.length,
      del_cliente: c.msgs.filter(m => m.papel === 'human').length, del_asistente: c.msgs.filter(m => m.papel !== 'human').length,
      historico: false, seq: i + 1, interes: c.interes, friccion: c.friccion, contacto: c.contacto, sin_respuesta: c.sin_respuesta })),
    mt_resumen: a => {
      const h = a?.p_horas || 24, v = enRango(h);
      return [{ personas: new Set(v.map(c => c.p.user_ref)).size, conversaciones: v.length,
        mensajes: v.reduce((s, c) => s + c.msgs.length, 0), del_cliente: v.reduce((s, c) => s + c.msgs.filter(m => m.papel === 'human').length, 0),
        del_asistente: v.reduce((s, c) => s + c.msgs.filter(m => m.papel !== 'human').length, 0),
        con_interes: v.filter(c => c.interes).length, con_contacto: v.filter(c => c.contacto).length, con_friccion: v.filter(c => c.friccion).length,
        sin_respuesta: v.filter(c => c.sin_respuesta).length, latencia_mediana: tiempoRespuesta(h)[0].mediana_s,
        ultimo: v.length ? iso(Math.max(...v.map(c => c.ultima))) : null }];
    },
    mt_por_hora: a => {
      const h = a?.p_horas || 24, porDia = h > 48, desde = AHORA - Math.max(1, h) * HORA, cuenta = new Map();
      for (const c of conversacionesQueCuentan()) for (const m of c.msgs) if (m.cuando > desde) {
        const k = truncar(m.cuando, porDia); cuenta.set(k, (cuenta.get(k) || 0) + 1);
      }
      return [...cuenta].sort((x, y) => x[0] - y[0]).map(([k, n]) => ({ tramo: iso(k), mensajes: n }));
    },
    mt_tiempo_respuesta: a => tiempoRespuesta(a?.p_horas),
    mt_actividad: a => conversacionesQueCuentan().flatMap(c => c.msgs.map(m => ({ c, m }))).filter(x => x.m.cuando > AHORA - 60 * DIA)
      .sort((x, y) => y.m.cuando - x.m.cuando).slice(0, a?.p_limite || 12)
      .map(({ c, m }) => ({ user_ref: c.p.user_ref, nombre: c.p.nombreConocido ? c.p.nombre : null, telefono: c.p.telefono, papel: m.papel, contenido: m.contenido, cuando: iso(m.cuando) })),
    mt_actividad_personas: a => vivas().filter(p => !EXCLUIDOS.has(p.user_ref))
      .map(p => ({ p, ult: p.convs[p.convs.length - 1] })).sort((x, y) => y.ult.ultima - x.ult.ultima).slice(0, a?.p_limite || 40)
      .map(({ p, ult }) => {
        const msgs = p.convs.flatMap(c => c.msgs);
        const ultH = [...msgs].reverse().find(m => m.papel === 'human');
        const ultM = msgs[msgs.length - 1];
        const at = p.convs.find(c => c.atencion && c.atencion > AHORA - 7 * DIA);
        return { user_ref: p.user_ref, nombre: p.nombreConocido ? p.nombre : null, telefono: p.telefono, ultima: iso(ultM.cuando),
          texto: (ultH || ultM).contenido.slice(0, 220), papel: ultH ? 'human' : ultM.papel,
          atencion_en: at ? iso(at.atencion) : null, atencion_motivo: at ? at.atencion_motivo : null,
          cita: p.visita && p.visita > AHORA ? iso(p.visita) : null,
          interes: p.convs.some(c => c.interes), friccion: p.convs.some(c => c.friccion), sin_respuesta: p.convs.some(c => c.sin_respuesta), contacto: p.convs.some(c => c.contacto) };
      }),
    mt_demanda: a => {
      const filas = [];
      const porServ = new Map(), porCentro = new Map();
      for (const c of conversacionesQueCuentan()) {
        porServ.set(c.servicio, (porServ.get(c.servicio) || 0) + 1);
        porCentro.set(c.centro.clave, (porCentro.get(c.centro.clave) || 0) + 1);
      }
      for (const [k, n] of porServ) filas.push({ categoria: 'servicio', nombre: SERVICIOS[k].nombre, conversaciones: n, veces: Math.round(n * 1.6), lat: null, lng: null, ambito: 'espana', generico: false, coord_origen: 'estimada' });
      for (const c of CENTROS) { const n = porCentro.get(c.clave) || 0; filas.push({ categoria: 'ubicacion', nombre: c.lugar, conversaciones: n, veces: Math.round(n * 1.3), lat: c.lat, lng: c.lng, ambito: 'madrid', generico: false, coord_origen: 'verificada' }); }
      filas.push({ categoria: 'ubicacion', nombre: 'Madrid', conversaciones: Math.round(CONVS.length * 0.12), veces: Math.round(CONVS.length * 0.14), lat: 40.4168, lng: -3.7038, ambito: 'espana', generico: true, coord_origen: 'verificada' });
      for (const [n, la, ln, k] of OTRAS_CIUDADES) filas.push({ categoria: 'ubicacion', nombre: n, conversaciones: k, veces: k + 1, lat: la, lng: ln, ambito: 'espana', generico: false, coord_origen: 'verificada' });
      return filas.filter(f => !a?.p_categoria || f.categoria === a.p_categoria).sort((x, y) => y.conversaciones - x.conversaciones || x.nombre.localeCompare(y.nombre));
    },
    mt_patron_horario: () => {
      const m = new Map();
      for (const c of conversacionesQueCuentan()) for (const x of c.msgs) if (x.papel === 'human') {
        const p = partes(x.cuando), k = p.isodow * 100 + p.h; m.set(k, (m.get(k) || 0) + 1);
      }
      return [...m].sort((a, b) => a[0] - b[0]).map(([k, n]) => ({ dia: Math.floor(k / 100), hora: k % 100, mensajes: n }));
    },
    mt_mis_numeros: () => {
      const mes = conversacionesQueCuentan().filter(c => c.primera >= inicioMes);
      const convs = mes.length, contactos = new Set(mes.map(c => c.p.user_ref)).size;
      const fuera = vivas().filter(p => !EXCLUIDOS.has(p.user_ref) && p.convs[0].primera >= inicioMes && fueraHorario(p.convs[0].msgs[0].cuando)).length;
      const ganados = LEADS.filter(l => l.etapa === 'ganado' && l.cerrado_en >= inicioMes).length;
      const min = AJUSTES.minutos_por_conversacion, coste = AJUSTES.coste_hora_eur, ticket = AJUSTES.ticket_medio_eur;
      const tiempo = Math.round(convs * min / 60 * coste * 100) / 100, ventas = ganados * ticket;
      const d0 = partes(inicioMes);
      return [{ desde: `${d0.y}-${String(d0.m).padStart(2, '0')}-${String(d0.d).padStart(2, '0')}`, contactos, conversaciones: convs, minutos_ahorrados: Math.round(convs * min),
        tiempo_eur: tiempo, ganados, ventas_eur: ventas, fuera_horario: fuera, fuera_horario_eur: fuera * ticket, total_eur: tiempo + ventas,
        coste_hora: coste, minutos_por_conv: min, ticket_medio: ticket, faltan: [] }];
    },
    mt_resumen_servicio: () => [{ cliente: EMPRESA, slug: SLUG, canal: 'WhatsApp', sector: 'Coworking y oficinas flexibles',
      alta: iso(CONVS[0].primera - 2 * DIA), primer_registro: iso(CONVS[0].primera), conversaciones: CONVS.length,
      mensajes: CONVS.reduce((s, c) => s + c.msgs.length, 0), contactos: vivas().length, usuarios: 3, ubicaciones: CENTROS.length,
      servicios: Object.keys(SERVICIOS).length, zona_horaria: 'Europe/Madrid', rol: 'admin', puede_escribir: true, ajustes: { ...AJUSTES } }],

    mt_mensajes_contacto2: a => {
      const p = PERSONAS.find(x => x.user_ref === a?.p_user_ref);
      if (!p) return [];
      return p.convs.flatMap(c => c.msgs).sort((x, y) => x.cuando - y.cuando)
        .map(m => ({ papel: m.papel, contenido: m.contenido, cuando: iso(m.cuando), latencia_ms: m.latencia_ms, reenganche: m.reenganche || null }));
    },
    mt_mensajes_contacto: a => R.mt_mensajes_contacto2(a).map(({ reenganche, ...m }) => m),
    mt_buscar: a => {
      const q = sinTilde(String(a?.p_texto || '')).trim();
      if (!q) return [];
      const out = [];
      for (const c of CONVS) for (const m of c.msgs) if (sinTilde(m.contenido).includes(q) || sinTilde(c.p.nombre).includes(q) || c.p.telefono.includes(q))
        out.push({ user_ref: c.p.user_ref, nombre: c.p.nombreConocido ? c.p.nombre : null, contenido: m.contenido, papel: m.papel, cuando: iso(m.cuando) });
      return out.sort((x, y) => new Date(y.cuando) - new Date(x.cuando)).slice(0, a?.p_limite || 200);
    },
    mt_fotos_panel: () => ({}),
    mt_contactados_fuera: () => [...CONTACTADOS].map(([user_ref, x]) => ({ user_ref, ...x })).sort((a, b) => new Date(b.en) - new Date(a.en)),
    mt_visitas_panel: () => ({ centros: Object.fromEntries(CENTROS.map(c => [c.clave, c.nombre])), personas: VISITAS.map(v => ({ ...v })) }),

    mt_mis_leads: a => LEADS.filter(l => !EXCLUIDOS.has(l.user_ref) && (!a?.p_etapa || l.etapa === a.p_etapa)).map(({ cerrado_en, ...l }) => ({ ...l })),
    mt_embudo_resumen: () => ['entrada', 'cualificado', 'visita_agendada', 'visita_hecha', 'propuesta', 'ganado', 'perdido'].map(e => {
      const v = LEADS.filter(l => l.etapa === e && !EXCLUIDOS.has(l.user_ref));
      const hoyIso = new Date(Date.UTC(hoy.y, hoy.m - 1, hoy.d)).toISOString().slice(0, 10);
      return { etapa: e, leads: v.length, valor_mes: v.reduce((s, l) => s + (Number(l.valor_mes) || 0), 0), sin_tocar: v.filter(l => !l.toques).length,
        vencidos: v.filter(l => l.proxima_fecha && l.proxima_fecha < hoyIso).length };
    }),
    mt_historial_lead: a => (HIST.get(Number(a?.p_id)) || []).map(e => ({ ...e })),
    mt_embudo_marcas_leer: () => MARCAS.map(m => ({ ...m })),
    mt_mis_citas: () => RESERVAS.filter(r => !EXCLUIDOS.has(r.p.user_ref)).map(r => ({ user_ref: r.p.user_ref, nombre: r.p.nombre, telefono: r.p.telefono,
      email: r.p.email, inicio: iso(r.inicio), centro: r.centro.nombre, direccion: r.centro.dir, evento: r.evento }))
      .sort((a, b) => new Date(b.inicio) - new Date(a.inicio)),
    mt_mi_lista_espera: () => ESPERA.map(e => ({ ...e })),

    // Escrituras: cambian lo que se ve, solo en esta pestaña.
    mt_pausar: a => { const hasta = AHORA + (a?.p_horas ? a.p_horas * HORA : 3650 * DIA); PAUSAS.set(a.p_user_ref, { hasta }); return iso(hasta); },
    mt_reanudar: a => { PAUSAS.delete(a?.p_user_ref); return true; },
    mt_excluir: a => { EXCLUIDOS.add(a?.p_user_ref); return true; },
    mt_incluir: a => { EXCLUIDOS.delete(a?.p_user_ref); return true; },
    mt_contactado_fuera_marcar: a => { const x = { en: iso(Date.now()), por: 'direccion@coworkingdemo.es', nota: a?.p_nota || null }; CONTACTADOS.set(a.p_user_ref, x); return { ok: true, ...x }; },
    mt_contactado_fuera_quitar: a => { CONTACTADOS.delete(a?.p_user_ref); return { ok: true }; },
    mt_guardar_lead: a => { const l = LEADS.find(x => x.id === Number(a?.p_id)); if (l) Object.assign(l, a.p_campos || {}); return true; },
    mt_mover_lead: a => {
      const l = LEADS.find(x => x.id === Number(a?.p_id)); if (!l) return false;
      const desde = l.etapa; l.etapa = a.p_etapa;
      if (a.p_etapa === 'ganado') l.cerrado_en = Date.now();
      evento(l, 'etapa', Date.now(), { desde, hasta: a.p_etapa, detalle: a.p_nota || null, quien: 'Tú' });
      HIST.get(l.id).sort((x, y) => new Date(y.cuando) - new Date(x.cuando));
      return true;
    },
    mt_apuntar_toque: a => {
      const l = LEADS.find(x => x.id === Number(a?.p_id)); if (!l) return false;
      l.toques = (l.toques || 0) + 1; if (a.p_proxima) l.proxima_fecha = a.p_proxima;
      evento(l, 'toque', Date.now(), { detalle: a.p_detalle || null, quien: 'Tú' });
      HIST.get(l.id).sort((x, y) => new Date(y.cuando) - new Date(x.cuando));
      return true;
    },
    mt_editar_evento: a => { for (const l of HIST.values()) { const e = l.find(x => x.id === Number(a?.p_evento)); if (e) { e.detalle = a.p_detalle; return true; } } return false; },
    mt_deshacer_evento: a => {
      for (const [id, l] of HIST) { const i = l.findIndex(x => x.id === Number(a?.p_evento)); if (i >= 0) {
        const [e] = l.splice(i, 1); const lead = LEADS.find(x => x.id === id);
        if (lead && e.tipo === 'toque') lead.toques = Math.max(0, (lead.toques || 1) - 1);
        if (lead && e.tipo === 'etapa' && e.desde) lead.etapa = e.desde;
        return true; } }
      return false;
    },
    mt_embudo_marcar: a => { const i = MARCAS.findIndex(m => m.clave === a?.p_clave); const m = { clave: a.p_clave, etapa: a.p_etapa, cuando: iso(Date.now()) };
      if (i >= 0) MARCAS[i] = m; else MARCAS.push(m); return true; },
    mt_guardar_ajustes: a => { Object.assign(AJUSTES, a?.p_ajustes || {}); return { ...AJUSTES }; },
    mt_guardar_parametros: a => { Object.assign(AJUSTES, a?.p_valores || {}); return { ...AJUSTES }; },

    // Correo y cuentas: esta demo no los enseña (son de pago aparte / del equipo de Simplia).
    mt_correo_panel: () => ({ hilos: [], resumen: [], faltan: [] }),
    mt_correo_panel_buzones: () => ({ buzones: [], puede_editar: false, puede_cambiar_tope: false, tope: 50, usado_hoy: 0, visitas: {}, firma: null }),
    mt_correo_marcas: () => ({ desde: iso(AHORA), leidos: {}, carpetas: {}, confirmar: {}, solo_mirar: false }),
    mt_correo_faltan: () => ({ puede_marcar: false, hoja: null, datos: [] }),
    mt_cuentas_panel: () => ({ cuentas: [], empresas: [] })
  };

  /* ---------- 10. El cliente de Supabase de mentira ---------- */
  function respuesta(fn, args) {
    const f = R[fn];
    if (!f) {
      // Lo que esta demo no contesta, se trata como «aún no está en el servidor».
      return { data: null, status: 404, error: { code: 'PGRST202', message: `Could not find the function public.${fn} in the schema cache` } };
    }
    try {
      const data = f(args || {});
      // Copia: el panel nunca toca el estado interno.
      return { data: data == null ? null : JSON.parse(JSON.stringify(data)), error: null, status: 200 };
    } catch (e) {
      console.warn('[demo]', fn, e);
      return { data: null, status: 500, error: { code: 'demo', message: 'La demo no ha podido preparar este dato.' } };
    }
  }
  // Un poco de espera, como un servidor rápido de verdad.
  const espera = fn => new Promise(r => setTimeout(r, /^mt_(mis_contactos|conversaciones_lista|resumen|actividad)/.test(fn) ? 140 + azar() * 160 : 60 + azar() * 90));

  const SESION = { access_token: 'demo', token_type: 'bearer', expires_in: 3600 * 24, expires_at: Math.floor(AHORA / 1000) + 3600 * 24,
    user: { id: '00000000-0000-4000-8000-000000000001', email: 'direccion@coworkingdemo.es', aud: 'authenticated', role: 'authenticated' } };
  const oyentes = [];
  function createClient() {
    return {
      auth: {
        getSession: async () => ({ data: { session: SESION }, error: null }),
        getUser: async () => ({ data: { user: SESION.user }, error: null }),
        signInWithPassword: async () => ({ data: { session: SESION, user: SESION.user }, error: null }),
        signOut: async () => { setTimeout(() => oyentes.forEach(f => { try { f('SIGNED_OUT', null); } catch (e) {} }), 0); return { error: null }; },
        onAuthStateChange: f => { oyentes.push(f); return { data: { subscription: { unsubscribe() { const i = oyentes.indexOf(f); if (i >= 0) oyentes.splice(i, 1); } } } }; },
        verifyOtp: async () => ({ data: null, error: { message: 'No disponible en la demo' } }),
        updateUser: async () => ({ data: null, error: { message: 'No disponible en la demo' } })
      },
      rpc: async (fn, args) => { await espera(fn); return respuesta(fn, args); },
      from: () => { throw new Error('La demo no lee tablas'); },
      channel: () => ({ on() { return this; }, subscribe() { return this; } }),
      removeChannel: () => {}
    };
  }

  /* ---------- 11. Nada sale de la demo ---------- */
  // Las llamadas a n8n (correo, cuentas) no salen.
  const fetchReal = window.fetch.bind(window);
  window.fetch = (u, o) => /easypanel\.host|supabase\.co/.test(String(u && u.url || u))
    ? Promise.resolve(new Response(JSON.stringify({ ok: false, demo: true }), { status: 503, headers: { 'Content-Type': 'application/json' } }))
    : fetchReal(u, o);

  function aviso(texto) {
    let t = document.getElementById('demo-aviso');
    if (!t) { t = document.createElement('div'); t.id = 'demo-aviso'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = texto; t.classList.add('ver');
    clearTimeout(aviso.reloj); aviso.reloj = setTimeout(() => t.classList.remove('ver'), 2600);
  }
  // Son personas inventadas: llamar, WhatsApp y correo no abren nada.
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    const h = a.getAttribute('href') || '';
    if (/^(tel:|mailto:|sms:)|wa\.me|whatsapp\.com|calendar|\.ics/i.test(h) || (/^https?:/i.test(h) && !h.includes(location.host))) {
      e.preventDefault(); e.stopPropagation();
      aviso(/^tel:/i.test(h) ? 'Demo: aquí se llamaría a esta persona.' : /^mailto:/i.test(h) ? 'Demo: aquí se abriría el correo.'
        : /wa\.me|whatsapp/i.test(h) ? 'Demo: aquí se abriría su WhatsApp.' : 'Demo: este enlace no se abre.');
    }
  }, true);

  // La marca de demo, junto al nombre del cliente.
  const estilo = document.createElement('style');
  estilo.textContent = `
    .demo-pill{display:inline-flex;align-items:center;margin-left:8px;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;
      letter-spacing:.02em;background:#EEF4FF;color:#1D4ED8;border:1px solid #C7D7FE;vertical-align:2px}
    #demo-aviso{position:fixed;left:50%;bottom:24px;transform:translate(-50%,16px);opacity:0;pointer-events:none;z-index:9999;
      background:#0F172A;color:#fff;font:600 13px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;padding:10px 16px;border-radius:10px;
      box-shadow:0 10px 30px rgba(15,23,42,.25);transition:opacity .2s ease,transform .2s ease;max-width:calc(100vw - 32px)}
    #demo-aviso.ver{opacity:1;transform:translate(-50%,0)}`;
  document.head.appendChild(estilo);
  function marcar() {
    const c = document.getElementById('cliente');
    if (c && !document.querySelector('.demo-pill')) {
      const p = document.createElement('span'); p.className = 'demo-pill'; p.textContent = 'Demo';
      p.title = 'Panel de demostración: datos inventados';
      c.insertAdjacentElement('afterend', p);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', marcar); else marcar();

  window.__DEMO = { createClient, aviso, datos: { PERSONAS, CONVS, LEADS, RESERVAS } };
})();
