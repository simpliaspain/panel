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
   · Correo e Idealista: un buzón inventado con sus carpetas, respuestas
     propuestas y mensajes de idealista. Enviar, leer el correo del buzón
     y abrir idealista se simulan aquí (nada sale de la página).
   · Nada se guarda en el navegador (ni preferencias, ni leídos, ni la
     vista del correo): al recargar, todo vuelve a estar como al principio.

   Para regenerar /demo/index.html tras cambiar el panel:
     node demo/construir.mjs
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- 0. Nada se guarda: al recargar, la demo vuelve a empezar ---------- */
  // La demo la abren a la vez varias personas, cada una en su navegador.
  // Lo que el panel guardaría en el navegador (vista del correo, leídos,
  // preferencias, la pantalla en la que estabas) vive solo en memoria:
  // al recargar, todo vuelve a estar como al principio. Tampoco toca el
  // almacenamiento del panel real (mismo dominio).
  function memoria() {
    const m = new Map();
    return {
      getItem(k) { k = String(k); return m.has(k) ? m.get(k) : null; },
      setItem(k, v) { m.set(String(k), String(v)); },
      removeItem(k) { m.delete(String(k)); },
      clear() { m.clear(); },
      key(i) { return [...m.keys()][i] ?? null; },
      get length() { return m.size; }
    };
  }
  for (const nombre of ['localStorage', 'sessionStorage']) {
    try {
      // Lo que guardaron versiones anteriores de la demo (prefijo «simplia-demo:»), fuera.
      const real = window[nombre];
      const viejas = [];
      for (let i = 0; i < real.length; i++) { const k = real.key(i); if (k && k.startsWith('simplia-demo:')) viejas.push(k); }
      viejas.forEach(k => real.removeItem(k));
    } catch (e) {}
    try { Object.defineProperty(window, nombre, { value: memoria(), configurable: true }); } catch (e) {}
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
    ticket_medio_eur: 480, minutos_por_conversacion: 20, coste_hora_eur: 24,
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

  // Fotos de perfil: retratos de prueba gratuitos de randomuser.me (no son
  // personas reales del cliente). Se eligen por el nombre, así que cada
  // persona sale siempre con la misma foto; no todas tienen, como en WhatsApp.
  const MUJERES = new Set(['lucia', 'marta', 'elena', 'sofia', 'laura', 'paula', 'andrea', 'carmen', 'irene', 'cristina', 'nuria', 'beatriz',
    'sara', 'claudia', 'patricia', 'ana', 'silvia', 'rocio', 'natalia', 'eva', 'ines', 'blanca', 'alba', 'teresa', 'clara', 'julia', 'noelia',
    'emily', 'mariana', 'sonia', 'monica', 'paula']);
  const HOMBRES = new Set(['javier', 'pablo', 'carlos', 'daniel', 'alejandro', 'sergio', 'miguel', 'david', 'alvaro', 'jorge', 'raul', 'adrian',
    'diego', 'ruben', 'inigo', 'mario', 'hugo', 'ivan', 'victor', 'gonzalo', 'fernando', 'oscar', 'marcos', 'luis', 'tomas', 'manuel', 'rafael',
    'rodrigo', 'alberto', 'andres']);
  function huella(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function fotoDe(nombre, porcentaje) {
    const n = sinTilde(String(nombre || '').trim());
    const pila = n.split(/\s+/)[0];
    const mujer = MUJERES.has(pila);
    if (!mujer && !HOMBRES.has(pila)) return '';          // empresas y avisos: con su inicial
    const h = huella(n);
    if (h % 100 >= porcentaje) return '';
    return `https://randomuser.me/api/portraits/${mujer ? 'women' : 'men'}/${(h >>> 8) % 100}.jpg`;
  }

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

  // forzar (opcional): { servicio, visita, email, terminaHace } para las
  // conversaciones que salen arriba del todo en WhatsApp.
  function crearConversacion(p, inicio, vuelve, forzar) {
    const servicio = forzar ? forzar.servicio : vuelve ? p.servicio : pesado(Object.entries(SERVICIOS).map(([k, v]) => [k, v.peso]));
    const centro = vuelve ? p.centro : pesado(CENTROS.map(c => [c, c.peso]));
    p.servicio = servicio; p.centro = centro;
    const personas = servicio === 'despacho' ? pesado([[2, 4], [3, 6], [4, 6], [5, 4], [6, 3], [8, 2], [10, 1]])
      : servicio === 'fijo' ? pesado([[1, 6], [2, 3], [3, 2]]) : servicio === 'sala' ? entre(4, 10) : 1;
    p.personas = p.personas || personas;
    // En la demo nadie pide hablar con una persona: no se enseña fricción.
    const friccion = false;
    const quiereVisita = forzar ? !!forzar.visita : ['despacho', 'fijo', 'flex'].includes(servicio) && (vuelve || prob(0.36));
    const visita = quiereVisita ? horaDeVisita(inicio) : null;
    const daEmail = forzar ? !!forzar.email : (visita ? prob(0.92) : ['sala', 'virtual', 'bono'].includes(servicio) ? prob(0.85) : prob(0.22));
    const ctx = { inicio, servicio, centro, personas: p.personas, visita, daEmail, friccion, vuelve };
    const { M, precio } = guion(p, ctx);

    // Horas: el asistente contesta en 2–6 s; la persona tarda de 20 s a 6 min.
    let t = inicio;
    let msgs = M.map((m, i) => {
      if (i > 0) t += m.papel === 'ai' ? 0 : entre(20, 360) * 1000;
      if (m.papel === 'ai') {
        const lat = Math.round(pesado([[1900, 2], [2400, 5], [2900, 8], [3300, 9], [3800, 7], [4400, 4], [5200, 2], [6100, 1]]) + entre(-250, 250));
        t += lat;
        return { ...m, cuando: t, latencia_ms: lat };
      }
      return { ...m, cuando: t, latencia_ms: null };
    });
    // Las de arriba del todo: entera, y acabando hace «terminaHace» ms.
    if (forzar) { const d = AHORA - forzar.terminaHace - msgs[msgs.length - 1].cuando; msgs.forEach(m => { m.cuando += d; }); }
    msgs = msgs.filter(m => m.cuando <= AHORA - 20e3);
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
      // Las últimas 3 horas son para las conversaciones de arriba (más abajo).
      if (ini > AHORA - 3 * HORA) continue;
      const vuelve = PERSONAS.length > 30 && prob(0.1);
      let p;
      if (vuelve) {
        p = uno(PERSONAS.filter(x => x.convs.length && !x.convs.some(c => c.friccion) && x.convs[x.convs.length - 1].ultima < ini - DIA));
      }
      if (!p) { p = nuevaPersona(); PERSONAS.push(p); }
      crearConversacion(p, ini, !!vuelve && p.convs.length > 0);
    }
  }
  // Arriba del todo en WhatsApp (lo más reciente): primero los que han
  // reservado visita y luego los que han dejado su correo, con servicios
  // variados. [hace cuántos minutos acabó, servicio, ¿visita?, ¿correo?]
  for (const [hace, servicio, visita, email] of [[3, 'despacho', 1, 1], [9, 'flex', 1, 1], [17, 'fijo', 1, 1], [26, 'despacho', 1, 1],
    [38, 'sala', 0, 1], [53, 'virtual', 0, 1], [71, 'bono', 0, 1], [94, 'fijo', 1, 1]]) {
    const p = nuevaPersona(); PERSONAS.push(p);
    crearConversacion(p, AHORA - hace * MIN - 40 * MIN, false, { servicio, visita: !!visita, email: !!email, terminaHace: hace * MIN });
  }

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
      id: ++idLead, user_ref: p.user_ref, nombre: p.nombre, email: p.emailDado ? p.email : null,
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

  /* ---------- 8 bis. Correo e Idealista ----------
     El buzón comercial del cliente inventado, como en el panel real:
     el asistente clasifica cada correo en su carpeta y prepara la
     respuesta; una persona la revisa y la envía (10 s para deshacer). Los
     mensajes de idealista salen en su apartado: se copia la respuesta, se
     pega en el chat de idealista y se confirma si se respondió.
     Nada sale de aquí: enviar, leer el buzón y abrir idealista se simulan. */
  const hex = n => { let s = ''; for (let i = 0; i < n; i++) s += '0123456789abcdef'[Math.floor(azar() * 16)]; return s; };
  const uid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[Math.floor(azar() * 4)]}${hex(3)}-${hex(12)}`;
  const BUZON_EMAIL = 'comercial@coworkingdemo.es';
  const BUZON_ID = uid();
  const YO = 'direccion@coworkingdemo.es';           // quien entra en la demo
  const ANDREA = 'andrea@coworkingdemo.es';
  const TEL_EMPRESA = '910 123 456';
  const FIRMA_TXT = `\n\n--\nEquipo de ${EMPRESA}\n${TEL_EMPRESA} · ${BUZON_EMAIL} · coworkingdemo.es\nRespuesta preparada por el asistente de IA de ${EMPRESA}`;
  const VISITA_URL = Object.fromEntries(CENTROS.map(c => [c.clave, `https://reservas.simpliaspain.com/demo/visita-${c.clave}`]));
  const conEnlaces = t => String(t).replace(/\[\[\s*VISITA\s*:\s*([^\]]+?)\s*\]\]/gi, (_m, c) => VISITA_URL[c.trim().toLowerCase()] || '');
  const haceMin = m => AHORA - m * MIN;
  // Hace n días (1 o más), a una hora de Madrid.
  const diaH = (n, h, mi = 0) => { const d = diaLocal(-n); return local(d.y, d.m, d.d, h, mi); };

  // Anuncios de idealista (uno o dos por centro).
  const ANUNCIOS = {
    CA12: { centro: 'castellana', titulo: 'Oficina en Paseo de la Castellana, 120, Castellana, Madrid', codigo: '108734215', precio: '1.250 €' },
    CA07: { centro: 'castellana', titulo: 'Oficina con espacios compartidos en Paseo de la Castellana, 120, Castellana, Madrid', codigo: '108734977', precio: '260 €' },
    CH03: { centro: 'chamberi', titulo: 'Oficina privada en Calle de Santa Engracia, 54, Chamberí, Madrid', codigo: '107912384', precio: '820 €' },
    CH09: { centro: 'chamberi', titulo: 'Oficina en Calle de Santa Engracia, 54, Chamberí, Madrid', codigo: '107913102', precio: '1.680 €' },
    LT05: { centro: 'tablas', titulo: 'Oficina privada en Calle de Isabel Colbrand, 10, Las Tablas, Madrid', codigo: '109205561', precio: '1.040 €' },
    MA02: { centro: 'mendez', titulo: 'Oficina con espacios compartidos en Calle de Méndez Álvaro, 56, Arganzuela, Madrid', codigo: '109877430', precio: '159 €' }
  };
  const letra = () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(azar() * 26)];
  const contactoIdealista = () => letra() + hex(11) + letra() + hex(14) + letra() + hex(10) + '@contacts.idealista.com';
  // El aviso de idealista, con su plantilla de siempre.
  function avisoIdealista(nombre, tel, contacto, pregunta, ref) {
    const a = ANUNCIOS[ref];
    return 'Tienes un nuevo mensaje que espera tu respuesta \n\nTienes un nuevo mensaje que espera tu respuesta\n\n' + nombre + '\n\n'
      + (tel ? `notDefaulter > tenantGuarantee --> ${tel} \n\n${contacto} \n\n` : `notDefaulter > tenantGuarantee --> ${contacto} \n\n`)
      + pregunta + '\nResponder desde idealista/tools \nTambién puedes responderle contestando a este email \n\n'
      + `${a.titulo} \nRef. ${ref} \nCódigo del anuncio: ${a.codigo}\n${a.precio}\n\n`
      + 'Si respondes en el mismo día que recibes el contacto tienes un 40% más de posibilidades de cerrar la operación con el cliente. \n\n'
      + 'Para conocer el uso que hacemos de tus datos puedes consultar nuestra política de privacidad \n\nidealista en tu móvil o tablet \n\nidealista © ' + hoy.y;
  }

  // Correos «tal cual llegaron» (boletines y avisos): HTML sencillo, sin nada de fuera.
  function boletin({ marca, color, titulo, entradilla, bloques, pie }) {
    return `<!doctype html><html><head><meta charset="utf-8"><title>${titulo}</title></head>
<body style="margin:0;background:#f3f4f6;font-family:Helvetica,Arial,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden">
<tr><td style="background:${color};padding:22px 28px;color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:.3px">${marca}</td></tr>
<tr><td style="padding:28px 28px 8px"><h1 style="margin:0 0 10px;font-size:22px;line-height:1.3;color:#111827">${titulo}</h1>
<p style="margin:0;font-size:15px;line-height:1.6;color:#4b5563">${entradilla}</p></td></tr>
${bloques.map(([t, x]) => `<tr><td style="padding:16px 28px"><div style="border-left:4px solid ${color};padding:4px 0 4px 14px">
<p style="margin:0 0 4px;font-size:16px;font-weight:bold;color:#111827">${t}</p><p style="margin:0;font-size:14px;line-height:1.6;color:#4b5563">${x}</p></div></td></tr>`).join('')}
<tr><td style="padding:20px 28px 28px;font-size:12px;line-height:1.5;color:#9ca3af;border-top:1px solid #f0f0f0">${pie}</td></tr>
</table></td></tr></table></body></html>`;
  }
  const deHtml = html => html.replace(/<style[\s\S]*?<\/style>|<title[\s\S]*?<\/title>/gi, '').replace(/<\/(p|h1|tr|div)>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  /* Cada conversación: { carpeta (tipo/subtipo), asunto, motivo, mensajes,
     borrador, estado del panel }. m: [quién, cuándo, texto, extra].
     Una respuesta del agente ya enviada se escribe con s:'agente'. */
  const HILOS = [];
  const MSG_HTML = new Map();      // mensaje → HTML «tal cual llegó»
  const CITAS_CORREO = [];         // visitas reservadas desde el correo
  function hilo(o) {
    const id = uid();
    const ms = o.m.map(([s, cuando, texto, x = {}]) => {
      const m = { id: uid(), sentido: s === 'r' ? 'recibido' : 'enviado', de: s === 'r' ? o.de : s === 'agente' ? `${EMPRESA} <${BUZON_EMAIL}>` : x.de,
        para: s === 'r' ? (o.para || BUZON_EMAIL) : o.responder || (o.reply_to ? o.reply_to : o.de), cc: null,
        reply_to: s === 'r' ? (o.reply_to || null) : null, agente: s === 'agente', fecha: iso(cuando), asunto: (s === 'r' ? '' : 'Re: ') + o.asunto,
        texto: s === 'agente' ? conEnlaces(texto) + FIRMA_TXT : texto, adjuntos: x.adjuntos || [] };
      if (x.html) MSG_HTML.set(m.id, x.html);
      return m;
    });
    const recibidos = ms.filter(m => m.sentido === 'recibido');
    const ultR = recibidos[recibidos.length - 1];
    const ultAgente = [...o.m].reverse().find(x => x[0] === 'agente');
    let bo = null;
    if (o.bo) {
      bo = { texto: o.bo.texto, equipo: o.bo.equipo || [], faltan: o.bo.faltan || [], estado: o.bo.estado || 'propuesto',
        creado_en: iso(+new Date(ultR.fecha) + entre(25, 70) * 1000), en_buzon: o.bo.en_buzon !== false, revisado: !!o.bo.revisado };
    } else if (ultAgente) {
      const env = ms.filter(m => m.agente).pop();
      bo = { texto: ultAgente[2], equipo: [], faltan: [], estado: 'enviado', creado_en: iso(+new Date(env.fecha) - entre(3, 50) * MIN),
        en_buzon: false, revisado: true, enviado_en: env.fecha, enviado_como: 'panel', quien: ultAgente[3]?.quien || ANDREA };
    }
    if (bo) bo = { id: uid(), mensaje_id: ultR.id, fotos: [], version: 1, enviado_en: null, enviado_como: null, quien: null, error: null,
      envio: null, reintento: false, modelo: 'asistente', ...bo };
    const h = {
      id, buzon: BUZON_EMAIL, asunto: o.asunto, tipo: o.tipo, subtipo: o.subtipo || null, a_persona: !!o.a_persona,
      activo: o.activo !== undefined ? o.activo : ['comercial', 'cliente_actual'].includes(o.tipo),
      motivo: o.motivo || null, estado: 'abierto', mensajes: ms, borrador: bo, comparacion: null, respondido: o.respondido || null,
      primer_recibido_en: (recibidos[0] || ms[0]).fecha, ultimo_en: ms[ms.length - 1].fecha,
      actualizado_en: iso(Math.max(+new Date(ms[ms.length - 1].fecha), bo ? +new Date(bo.creado_en) : 0)),
      _nl: !!o.nl, _carpeta: o.carpeta || null, _confirmar: o.confirmar || null, _llega: o.llega || null
    };
    HILOS.push(h);
    if (o.cita) CITAS_CORREO.push({ user_ref: null, nombre: o.nombre, telefono: null, email: o.email, inicio: iso(o.cita.inicio),
      centro: CENTROS.find(c => c.clave === o.cita.centro).nombre, direccion: CENTROS.find(c => c.clave === o.cita.centro).dir, evento: 'BOOKING_CREATED' });
    return h;
  }
  const quien = (nombre, email) => `${nombre} <${email}>`;
  const siguienteLaborable = (n, h) => { for (let i = n; i < n + 7; i++) { const d = diaLocal(i); if (d.isodow <= 5) return local(d.y, d.m, d.d, h); } return AHORA + 2 * DIA; };

  // ---- Nuevos clientes ----
  hilo({ tipo: 'comercial', subtipo: 'despacho_meses', de: quien('Laura Benítez', 'laura.benitez@senda-abogados.es'), nl: true,
    asunto: 'Despacho para 4 personas en Castellana', motivo: 'Despacho para 4 personas en Castellana, desde enero',
    m: [['r', haceMin(26), 'Buenos días:\n\nSomos un despacho de abogados de 4 personas y buscamos oficina privada en la zona de Castellana a partir de enero. Necesitaríamos que tuviera luz natural y una sala para recibir a clientes.\n\n¿Qué disponibilidad y precios tenéis? ¿Cuál es la permanencia mínima?\n\nMuchas gracias,\nLaura Benítez\nSenda Abogados']],
    bo: { texto: 'Hola, Laura:\n\nGracias por escribirnos. En Castellana 120 tenemos libre un despacho privado para 4 personas, exterior y con luz natural, por 1.250 €/mes + IVA. Es de uso exclusivo para vuestro despacho.\n\nIncluye limpieza diaria, fibra de 1 Gb, recepción de visitas y paquetería, café y 6 horas al mes de sala de reuniones para recibir a vuestros clientes (la hora extra de sala sale a 35 €). Tenéis acceso 24/7 con tarjeta.\n\nLa permanencia mínima es de 3 meses, y con contrato anual hay un 10 % de descuento. Para entrar en enero os lo podemos dejar reservado.\n\nSi queréis verlo en persona, aquí elegís día y hora para la visita:\n[[VISITA:castellana]]\n\n¿Queréis que os prepare la propuesta con el contrato anual?\n\nUn saludo.' } });

  hilo({ tipo: 'comercial', subtipo: 'oficina_virtual', de: quien('Formulario web', 'website@coworkingdemo.es'), reply_to: quien('Daniel Ferrer', 'dferrer.consultoria@gmail.com'), nl: true,
    asunto: 'Nuevo mensaje desde el formulario de la web', motivo: 'Oficina virtual para una SL en constitución',
    m: [['r', haceMin(112), 'Nombre: Daniel Ferrer\nEmail: dferrer.consultoria@gmail.com\nTeléfono: 655 218 904\nCentro: Chamberí\n\nMensaje:\nHola, estoy constituyendo una SL y necesito domicilio social y fiscal en Madrid. ¿Me podéis decir el precio de la oficina virtual y qué documentación hace falta? Gracias.']],
    bo: { texto: 'Hola, Daniel:\n\nGracias por tu mensaje. La oficina virtual en Chamberí (Calle de Santa Engracia, 54) son 49 €/mes + IVA e incluye:\n\n· Domicilio social y fiscal para la SL.\n· Recepción de correo y paquetería, con aviso al momento.\n· 2 horas al mes de sala de reuniones.\n\nPara darla de alta necesitamos el certificado de denominación social, el DNI del administrador y, cuando la tengáis, la escritura de constitución. El contrato es de prestación de servicios y se firma online; el servicio se activa en 24 horas.\n\nSi quieres conocer el centro antes, puedes reservar una visita aquí:\n[[VISITA:chamberi]]\n\n¿Te envío el contrato para que lo revises?\n\nUn saludo.' } });

  hilo({ tipo: 'comercial', subtipo: 'despacho_meses', de: quien('Marcos Herrero', 'marcos@polaranalytics.es'), nombre: 'Marcos Herrero', email: 'marcos@polaranalytics.es',
    asunto: 'Información despacho 6 personas', motivo: 'Despacho para 6 personas en Chamberí',
    cita: { inicio: siguienteLaborable(1, 11), centro: 'chamberi' },
    m: [['r', diaH(3, 10, 14), 'Hola,\n\nSomos una startup de datos y vamos a pasar de 4 a 6 personas en las próximas semanas. Me interesa el centro de Chamberí. ¿Tenéis algún despacho para 6? ¿Se puede entrar a mitad de mes?\n\nGracias,\nMarcos'],
      ['agente', diaH(3, 10, 31), 'Hola, Marcos:\n\nSí: en Chamberí tenemos un despacho para 6 personas de 32 m², exterior, por 1.680 €/mes + IVA. Incluye limpieza, fibra de 1 Gb, recepción, café y 6 horas al mes de sala de reuniones. Se puede entrar cualquier día del mes: la primera cuota se prorratea.\n\nLa permanencia mínima es de 3 meses y no pedimos aval bancario, solo una fianza de una mensualidad.\n\nPuedes elegir día y hora para verlo aquí:\n[[VISITA:chamberi]]\n\nUn saludo.'],
      ['r', diaH(2, 16, 48), 'Perfecto, acabo de reservar la visita. Iremos dos personas.\n\nMarcos'],
      ['agente', diaH(2, 17, 2), '¡Perfecto, Marcos! Os esperamos en Chamberí (Calle de Santa Engracia, 54). Preguntad en recepción por el equipo comercial: os enseñaremos el despacho y las zonas comunes.\n\nSi necesitáis cambiar la hora, podéis hacerlo desde el mismo enlace de la reserva.\n\nUn saludo.', { quien: YO }]] });

  hilo({ tipo: 'comercial', subtipo: 'sala', de: quien('Irene Sastre', 'formacion@mosaicoeventos.es'),
    asunto: 'Sala para formación de 12 personas', motivo: 'Sala para una formación de 12 personas',
    m: [['r', diaH(2, 12, 7), 'Hola:\n\nOrganizamos una formación interna para 12 personas y buscamos una sala con pantalla para el viernes 12, de 9:00 a 14:00. ¿Tenéis disponibilidad en Castellana o Méndez Álvaro? ¿Podríais incluir café a media mañana?\n\nUn saludo,\nIrene Sastre\nMosaico Eventos']],
    bo: { texto: 'Hola, Irene:\n\nPara 12 personas tenemos la Sala Prado en Castellana 120: con pantalla de 75", videoconferencia, pizarra y luz natural. La hora sale a 45 € + IVA, así que de 9:00 a 14:00 serían 225 € + IVA.\n\nEl café de media mañana para 12 personas (café, infusiones, zumo y bollería) son 6 € por persona.\n\nEn cuanto lo confirméis, os dejamos la sala bloqueada y os enviamos la confirmación con la factura.\n\nUn saludo.',
      equipo: ['Confirmar que la Sala Prado está libre el viernes 12 de 9:00 a 14:00 y bloquearla', 'Pedir el café para 12 personas a Cafés del Barrio'], en_buzon: false } });

  hilo({ tipo: 'comercial', subtipo: 'despacho_meses', de: quien('Jorge Vidal', 'jorge.vidal@zenitseguros.es'), nl: true,
    asunto: 'Oficina para 8 en Las Tablas, ¿con parking?', motivo: 'Despacho para 8 personas en Las Tablas, con parking',
    m: [['r', haceMin(196), 'Buenas tardes,\n\nBuscamos un espacio para un equipo comercial de 8 personas en Las Tablas. Es importante que haya plazas de aparcamiento, al menos 3. ¿Qué opciones tenéis y cuánto costaría el parking?\n\nSaludos,\nJorge Vidal\nZenit Seguros']],
    bo: { texto: 'Hola, Jorge:\n\nEn Las Tablas (Calle de Isabel Colbrand, 10) tenemos un despacho para 8 personas de 40 m², exterior, por 2.110 €/mes + IVA. Incluye limpieza, fibra de 1 Gb, recepción, café y 8 horas al mes de sala de reuniones.\n\nEl edificio tiene aparcamiento propio. El precio de las plazas te lo confirma hoy mismo el equipo.\n\nSi queréis verlo, aquí podéis reservar la visita:\n[[VISITA:tablas]]\n\nUn saludo.',
      faltan: ['Precio del parking por mes en Las Tablas'], equipo: ['Confirmar el precio de 3 plazas de parking en Las Tablas: no está en la hoja'], en_buzon: false } });

  hilo({ tipo: 'comercial', subtipo: 'broker', de: quien('Rodrigo Alcalde', 'ralcalde@atlas-inmobiliaria.es'), a_persona: true,
    asunto: 'Cliente busca 300 m² en Madrid · colaboración', motivo: 'Intermediario: cliente de 300 m², pide comisión',
    m: [['r', diaH(1, 13, 22), 'Hola,\n\nSoy consultor en Atlas Inmobiliaria. Tengo un cliente (empresa tecnológica, 35 puestos) que busca unos 300 m² en Madrid a partir de marzo. ¿Trabajáis con intermediarios? En ese caso, ¿qué comisión aplicáis?\n\nQuedo a la espera.\nRodrigo Alcalde']] });

  hilo({ tipo: 'comercial', subtipo: 'puesto', de: quien('Sara Montero', 'sara.montero.design@gmail.com'),
    asunto: 'Puesto flexible', motivo: 'Puesto flexible unos días a la semana',
    m: [['r', diaH(4, 9, 41), 'Hola! Soy diseñadora freelance y me gustaría ir 2 o 3 días a la semana. ¿Qué precio tiene el puesto flexible? ¿Se puede probar un día?'],
      ['e', diaH(4, 11, 5), 'Hola Sara,\n\nEl puesto flexible son 159 €/mes + IVA y puedes venir cuando quieras de 8:00 a 21:00, en cualquiera de los 4 centros. ¡Y sí, el primer día es gratis! Dime qué día te viene bien y te lo dejo preparado.\n\nUn abrazo,\nAndrea\nCoworking Demo', { de: quien('Andrea Molina', ANDREA) }]],
    bo: { texto: 'Hola, Sara:\n\nEl puesto flexible son 159 €/mes + IVA. Puedes venir cuando quieras, de 8:00 a 21:00, a cualquiera de nuestros 4 centros, y tienes café, fibra de 1 Gb y taquilla por días.\n\nSí: el primer día es gratis. Elige el día aquí y te lo dejamos preparado:\n[[VISITA:castellana]]\n\nUn saludo.', estado: 'propuesto' } });

  hilo({ tipo: 'comercial', subtipo: 'despacho_meses', de: quien('Beatriz Lozano', 'blozano@cobaltogames.com'), nl: true,
      asunto: 'Despacho 5 personas – Castellana', motivo: 'Despacho para 5 personas en Castellana, contrato anual',
      m: [['r', diaH(2, 9, 55), 'Hola,\n\n¿Tenéis algún despacho para 5 personas en Castellana? Lo necesitaríamos en febrero.\n\nGracias,\nBeatriz'],
        ['agente', diaH(2, 10, 20), 'Hola, Beatriz:\n\nSí: en Castellana 120 tenemos un despacho para 5 personas, exterior, por 1.470 €/mes + IVA. Incluye limpieza, fibra de 1 Gb, recepción, café y 6 horas al mes de sala de reuniones. Para febrero os lo podemos dejar reservado.\n\nAquí podéis elegir día y hora para verlo:\n[[VISITA:castellana]]\n\nUn saludo.'],
        ['r', haceMin(48), 'Gracias por la info. Si firmamos 12 meses, ¿hay algún descuento? ¿Y se puede añadir una mesa más más adelante?\n\nBeatriz']],
      bo: { texto: 'Hola, Beatriz:\n\nSí: con contrato de 12 meses el despacho queda en 1.323 €/mes + IVA (un 10 % menos), y el precio se mantiene todo el año.\n\nY sí, se puede añadir un puesto más adelante: en ese despacho cabe una sexta mesa, por 210 €/mes + IVA. Si el equipo crece más, os cambiamos a un despacho mayor sin penalización.\n\nSi queréis verlo antes de decidir, aquí reserváis la visita:\n[[VISITA:castellana]]\n\nUn saludo.' } });

  hilo({ tipo: 'comercial', subtipo: 'oficina_virtual', de: quien('Víctor Calvo', 'victor.calvo.autonomo@outlook.es'), carpeta: 'archivados',
    asunto: 'Domiciliación autónomo', motivo: 'Domiciliación fiscal para autónomo',
    m: [['r', diaH(7, 18, 3), 'Hola, ¿cuánto cuesta domiciliar mi actividad de autónomo en vuestra dirección de Méndez Álvaro?'],
      ['agente', diaH(6, 9, 15), 'Hola, Víctor:\n\nLa domiciliación en Méndez Álvaro (Calle de Méndez Álvaro, 56) son 39 €/mes + IVA, con recepción de correo y aviso al momento. Para autónomos vale como domicilio fiscal y de la actividad en el modelo 036; solo necesitamos tu DNI y el contrato, que se firma online.\n\n¿Te envío el contrato?\n\nUn saludo.']] });

  hilo({ tipo: 'comercial', subtipo: 'bono', de: quien('Nuria Campos', 'nuria.campos@albaingenieria.es'), nombre: 'Nuria Campos', email: 'nuria.campos@albaingenieria.es',
    cita: { inicio: diaH(6, 17, 30), centro: 'mendez' },
    asunto: 'Bono de horas para reuniones', motivo: 'Bono de horas de sala para reuniones',
    m: [['r', diaH(9, 11, 12), 'Hola, necesitamos una sala unas 10 horas al mes para reunirnos con clientes. ¿Tenéis bonos?'],
      ['agente', diaH(9, 11, 30), 'Hola, Nuria:\n\nSí: el bono de 10 horas son 99 € + IVA, se puede usar en las salas de los 4 centros y no caduca en 3 meses. Las salas tienen pantalla, videoconferencia y café para los asistentes.\n\nSi queréis ver las salas antes, reservad la visita aquí:\n[[VISITA:mendez]]\n\nUn saludo.']] });

  hilo({ tipo: 'comercial', subtipo: 'despacho_meses', de: quien('Gonzalo Peña', 'gonzalo@trazoestudio.es'),
    respondido: { en: iso(diaH(5, 12, 40)), quien: ANDREA, como: 'mano' },
    asunto: 'Despacho 3 personas Chamberí', motivo: 'Despacho para 3 personas en Chamberí',
    m: [['r', diaH(5, 10, 2), 'Buenos días, ¿me puede llamar alguien para ver un despacho para 3 en Chamberí? Mi teléfono es el 622 410 873. Gracias.']],
    bo: { texto: 'Hola, Gonzalo:\n\nClaro. En Chamberí tenemos un despacho para 3 personas por 1.040 €/mes + IVA, con limpieza, fibra, recepción y 4 horas de sala al mes. Te llamamos hoy mismo al 622 410 873.\n\nUn saludo.', equipo: ['Llamar a Gonzalo al 622 410 873'] } });

  hilo({ tipo: 'comercial', subtipo: 'despacho_meses', de: quien('Emily Carter', 'emily.carter@northbridge.io'), nl: true,
    asunto: 'Office for a team of 5 in Madrid', motivo: 'Despacho para 5 personas (empresa extranjera)',
    m: [['r', haceMin(305), 'Hi there,\n\nWe are a UK software company opening a small office in Madrid. We need a private office for 5 people from February, ideally near Méndez Álvaro or the centre. Could you share availability and pricing? Do you offer a registered address too?\n\nBest regards,\nEmily Carter\nNorthbridge']],
    bo: { texto: 'Hi Emily,\n\nThank you for getting in touch. At our Méndez Álvaro centre (Calle de Méndez Álvaro, 56) we have a private office for 5 people available from February, at €1,470/month + VAT. It includes cleaning, 1 Gb fibre, reception, coffee and 6 hours of meeting room per month, with 24/7 access.\n\nYes, the office can be used as your registered and tax address in Spain at no extra cost.\n\nThe minimum term is 3 months, with a 10% discount on a 12-month contract. You can book a visit here:\n[[VISITA:mendez]]\n\nKind regards.' } });

  hilo({ tipo: 'comercial', subtipo: 'puesto', de: quien('Raúl Ortiz', 'raul.ortiz88@gmail.com'),
    asunto: 'Puesto fijo para 2 desde enero', motivo: 'Dos puestos fijos en Las Tablas desde enero',
    m: [['r', diaH(1, 19, 42), 'Hola, buenas noches. Mi socio y yo buscamos dos puestos fijos en Las Tablas desde el 1 de enero. ¿Precio? Gracias.'],
      ['agente', diaH(1, 20, 5), 'Hola, Raúl:\n\nEl puesto fijo en Las Tablas son 240 €/mes + IVA por persona, con taquilla, acceso 24/7, fibra, café y 4 horas de sala al mes. Os reservamos dos puestos juntos en la misma isla para el 1 de enero.\n\nSi queréis verlos antes, elegid día y hora aquí:\n[[VISITA:tablas]]\n\nUn saludo.', { quien: YO }]] });

  // ---- Clientes actuales ----
  hilo({ tipo: 'cliente_actual', de: quien('Ana Ortega', 'ana.ortega@lumendigital.es'), nl: true,
    asunto: 'Factura de noviembre', motivo: 'Cliente: reenviar la factura a administración',
    m: [['r', haceMin(78), 'Hola,\n\n¿Podéis enviar la factura de noviembre del despacho 2.04 también a administracion@lumendigital.es? A partir de ahora queremos recibirlas allí.\n\nGracias,\nAna']],
    bo: { texto: 'Hola, Ana:\n\nClaro. Reenviamos hoy la factura de noviembre a administracion@lumendigital.es, y desde diciembre os las enviaremos a esa dirección.\n\nUn saludo.', equipo: ['Reenviar la factura de noviembre del despacho 2.04 a administracion@lumendigital.es y cambiar el correo de facturación'] } });

  hilo({ tipo: 'cliente_actual', subtipo: 'sala', de: quien('Iván Medina', 'ivan@faro-data.es'),
    asunto: 'Reserva sala jueves', motivo: 'Cliente: reservar sala el jueves',
    m: [['r', diaH(1, 9, 20), 'Buenos días, ¿podéis reservarnos la sala grande el jueves de 10:00 a 12:00? Seremos 8. Gracias!']],
    bo: { texto: 'Hola, Iván:\n\nOs dejamos reservada la Sala Retiro el jueves de 10:00 a 12:00 para 8 personas, con pantalla y videoconferencia. Son 2 horas de las 6 que tenéis incluidas este mes.\n\nUn saludo.', equipo: ['Bloquear la Sala Retiro el jueves de 10:00 a 12:00 para Faro Data'] } });

  hilo({ tipo: 'cliente_actual', de: quien('Clara Domínguez', 'clara@brava-studio.es'),
    asunto: 'He perdido la tarjeta de acceso', motivo: 'Cliente: tarjeta de acceso perdida',
    m: [['r', diaH(3, 8, 47), 'Hola, creo que perdí ayer la tarjeta de acceso. ¿Me podéis dar otra? Estoy en el despacho 1.07 de Chamberí.'],
      ['e', diaH(3, 9, 12), 'Hola Clara,\n\nYa hemos dado de baja la tarjeta anterior. Tienes una nueva en recepción: pásate cuando quieras.\n\nUn saludo,\nRecepción Chamberí', { de: quien('Recepción', 'recepcion@coworkingdemo.es') }]],
    bo: { texto: 'Hola, Clara:\n\nDamos de baja ahora mismo la tarjeta anterior para que nadie pueda usarla. Tienes una nueva en la recepción de Chamberí: pásate cuando quieras.\n\nUn saludo.', equipo: ['Dar de baja la tarjeta de Clara Domínguez (1.07 Chamberí) y preparar una nueva'] } });

  hilo({ tipo: 'cliente_actual', de: quien('Tomás Reyes', 'tomas@origen-ventures.es'), nl: true,
    asunto: 'Nos quedamos pequeños', motivo: 'Cliente: quiere un despacho más grande',
    m: [['r', diaH(1, 16, 5), 'Hola equipo,\n\nEn marzo pasamos de 3 a 6 personas. ¿Habría un despacho más grande en Castellana al que cambiarnos? ¿Cómo funcionaría el cambio de contrato?\n\nTomás']],
    bo: { texto: 'Hola, Tomás:\n\n¡Enhorabuena por el crecimiento! En Castellana 120 se queda libre en marzo un despacho para 6 personas, exterior, por 1.680 €/mes + IVA. El cambio es sencillo: firmamos un anexo al contrato, la fianza que ya tenéis se descuenta de la nueva y no hay penalización por cambiar.\n\nSi queréis, os lo enseñamos la semana que viene. ¿Qué día os viene bien?\n\nUn saludo.' } });

  // ---- Proveedores y facturas ----
  hilo({ tipo: 'no_comercial', subtipo: 'proveedor', de: quien('Limpiezas Brillo', 'facturacion@limpiezasbrillo.es'),
    asunto: 'Factura FV-2026-1187 · Servicio de limpieza', nl: true,
    m: [['r', diaH(1, 8, 2), 'Buenos días:\n\nAdjuntamos la factura FV-2026-1187 correspondiente al servicio de limpieza de los 4 centros del mes en curso, por importe de 3.420,00 € (IVA incluido). Vencimiento a 30 días.\n\nUn saludo,\nDepartamento de facturación\nLimpiezas Brillo S.L.',
      { adjuntos: [{ nombre: 'FV-2026-1187.pdf', tipo: 'application/pdf', bytes: 84213 }] }]] });
  hilo({ tipo: 'no_comercial', subtipo: 'proveedor', de: quien('Clima Norte', 'servicio@climanorte.es'),
    asunto: 'Revisión trimestral de climatización · Castellana 120',
    m: [['r', diaH(4, 12, 30), 'Hola:\n\nOs confirmamos la revisión trimestral de la climatización de Castellana 120 para el martes de 8:00 a 10:00. El técnico necesitará acceso a la sala de máquinas de la planta 6.\n\nUn saludo,\nClima Norte']] });
  hilo({ tipo: 'no_comercial', subtipo: 'proveedor', de: quien('Cafés del Barrio', 'pedidos@cafesdelbarrio.es'),
    asunto: 'Confirmación de pedido 4471',
    m: [['r', diaH(6, 10, 18), 'Pedido 4471 confirmado:\n\n· 12 kg de café en grano\n· 400 cápsulas de infusión\n· 6 cajas de vasos compostables\n\nEntrega el jueves por la mañana en Castellana 120.\n\nCafés del Barrio']] });

  // ---- Avisos automáticos ----
  const avReserva = boletin({ marca: 'Reservas · Coworking Demo', color: '#1B7CFF', titulo: 'Nueva visita reservada',
    entradilla: 'Marcos Herrero ha reservado una visita desde el enlace que le envió el asistente.',
    bloques: [['Centro', 'Chamberí · Calle de Santa Engracia, 54'], ['Cuándo', cuandoTexto(siguienteLaborable(1, 11)).replace(/^el /, '')], ['Personas', '2']],
    pie: 'Aviso automático del sistema de reservas. La visita ya está en la Agenda del panel.' });
  hilo({ tipo: 'no_comercial', subtipo: 'avisos', de: quien('Reservas', 'no-reply@reservas.simpliaspain.com'),
    asunto: 'Nueva visita reservada · Chamberí', m: [['r', diaH(2, 16, 46), deHtml(avReserva), { html: avReserva }]] });
  const avBanco = boletin({ marca: 'Banca Norte', color: '#0F766E', titulo: 'Has recibido una transferencia',
    entradilla: 'Se ha abonado una transferencia en tu cuenta de empresa terminada en 4821.',
    bloques: [['Importe', '1.250,00 €'], ['Ordenante', 'ORIGEN VENTURES SL'], ['Concepto', 'Despacho 3.02 diciembre']],
    pie: 'Este es un aviso automático. Por tu seguridad, nunca te pediremos claves por correo.' });
  hilo({ tipo: 'no_comercial', subtipo: 'avisos', de: quien('Banca Norte', 'avisos@bancanorte.es'),
    asunto: 'Transferencia recibida: 1.250,00 €', m: [['r', haceMin(240), deHtml(avBanco), { html: avBanco }]] });
  hilo({ tipo: 'no_comercial', subtipo: 'avisos', de: quien('Copias Nube', 'alertas@copiasnube.es'),
    asunto: 'Copia de seguridad completada', m: [['r', diaH(1, 3, 0), 'La copia de seguridad nocturna de «Servidor recepción» se ha completado correctamente.\n\n12.418 archivos · 38,2 GB · 0 errores']] });

  // ---- Publicidad y newsletters ----
  const nlRevista = boletin({ marca: 'Espacio Flex', color: '#7C3AED', titulo: 'Tendencias del trabajo flexible',
    entradilla: 'Lo más leído del mes en la revista de los espacios de trabajo.',
    bloques: [['El híbrido se queda', 'El 64 % de las empresas medianas combinará oficina propia y coworking el año que viene.'],
      ['Salas, el nuevo reclamo', 'Las salas de reuniones con buena videoconferencia ya pesan más que el precio al elegir centro.'],
      ['Respuesta en minutos', 'Los centros que contestan en menos de una hora cierran el doble de visitas.']],
    pie: 'Recibes este boletín porque te suscribiste en espacioflex.es. Puedes darte de baja cuando quieras.' });
  hilo({ tipo: 'no_comercial', subtipo: 'newsletter', de: quien('Espacio Flex', 'boletin@espacioflex.es'),
    asunto: 'Tendencias del trabajo flexible · este mes', m: [['r', diaH(2, 7, 30), deHtml(nlRevista), { html: nlRevista }]] });
  const nlRed = boletin({ marca: 'Red de Espacios Madrid', color: '#B45309', titulo: 'Encuentro de coworkings de Madrid',
    entradilla: 'Te invitamos a la reunión anual de centros de trabajo flexible de la Comunidad de Madrid.',
    bloques: [['Cuándo', 'Jueves de la semana que viene, de 18:00 a 20:30'], ['Dónde', 'Auditorio del Ateneo (Madrid)'], ['Programa', 'Mesa redonda sobre ocupación, precios y nuevos servicios, y networking.']],
    pie: 'Plazas limitadas. Responde a este correo para confirmar tu asistencia.' });
  hilo({ tipo: 'no_comercial', subtipo: 'newsletter', de: quien('Red de Espacios Madrid', 'hola@redespaciosmadrid.es'),
    asunto: 'Invitación: Encuentro de coworkings de Madrid', m: [['r', diaH(5, 9, 0), deHtml(nlRed), { html: nlRed }]] });
  hilo({ tipo: 'no_comercial', subtipo: 'newsletter', de: quien('Mueble Oficina Pro', 'ofertas@muebleoficinapro.es'),
    asunto: 'Hasta un 30 % en sillas ergonómicas', m: [['r', diaH(3, 11, 45), 'Solo esta semana: hasta un 30 % de descuento en sillas ergonómicas y mesas regulables para tu oficina. Envío gratis a partir de 300 €.']] });

  // ---- Personal o interno ----
  hilo({ tipo: 'no_comercial', subtipo: 'personal', de: quien('Javier Ruiz', 'javier@coworkingdemo.es'),
    asunto: 'Turnos de recepción de diciembre', m: [['r', diaH(1, 18, 10), 'Hola equipo,\n\nOs paso los turnos de recepción de diciembre. Si alguien necesita cambiar algún día, decídmelo antes del viernes.\n\nGracias,\nJavier']] });
  hilo({ tipo: 'no_comercial', subtipo: 'personal', de: quien('Andrea Molina', ANDREA),
    asunto: 'Comida de Navidad', m: [['r', diaH(4, 14, 2), '¿Os va bien el viernes 19 para la comida de Navidad? He mirado un sitio cerca de Castellana. 🎄']] });

  // ---- Otros ----
  hilo({ tipo: 'no_comercial', subtipo: 'otros', de: quien('Paula Soto', 'paula@paulasotofoto.es'),
    asunto: 'Fotografía de espacios', m: [['r', diaH(8, 12, 12), 'Hola, soy fotógrafa de interiores. Me encantaría hacer un reportaje de vuestros centros para la web y los portales. ¿Os puedo enviar mi portfolio?']] });

  // ---- Enviados por el equipo (sin respuesta aún) ----
  hilo({ tipo: 'no_comercial', subtipo: 'saliente', de: quien('Andrea Molina', ANDREA), responder: 'compras@rumbologistica.es',
    asunto: 'Propuesta despacho 6 personas · Rumbo Logística',
    m: [['e', diaH(2, 13, 15), 'Hola Fernando,\n\nComo hablamos por teléfono, te adjunto la propuesta del despacho para 6 personas en Las Tablas, con 2 plazas de parking. Cualquier duda, me dices.\n\nUn saludo,\nAndrea Molina\nCoworking Demo', { de: quien('Andrea Molina', ANDREA), adjuntos: [{ nombre: 'Propuesta Rumbo Logística.pdf', tipo: 'application/pdf', bytes: 412880 }] }]] });

  // ---- Spam ----
  hilo({ tipo: 'no_comercial', subtipo: 'spam', de: quien('Premios Online', 'ganador@premios-semanales.top'),
    asunto: '¡¡Enhorabuena!! Has sido seleccionado', m: [['r', diaH(1, 4, 12), 'Has sido seleccionado para recibir un premio. Haz clic para reclamarlo antes de 24 horas.']] });
  hilo({ tipo: 'no_comercial', subtipo: 'spam', de: quien('SEO Rápido', 'info@seo-primera-pagina.click'),
    asunto: 'Primera página de Google en 7 días', m: [['r', diaH(3, 6, 40), 'Garantizamos posicionar tu web en primera página en 7 días. Precio especial solo hoy.']] });
  hilo({ tipo: 'no_comercial', subtipo: 'spam', de: quien('Soporte Cuenta', 'soporte@verificacion-cuentas.xyz'), carpeta: 'papelera',
    asunto: 'Su buzón está lleno: verifique su cuenta', m: [['r', diaH(5, 2, 15), 'Su buzón ha superado el límite. Verifique su contraseña en el siguiente enlace para no perder correos.']] });

  // ---- Idealista ----
  function idealista(o) {
    const contacto = contactoIdealista();
    const nombre = o.nombre;
    return hilo({ tipo: 'comercial', subtipo: 'portal', de: 'idealista <reply@idealista.com>', reply_to: `${nombre} <${contacto}>`,
      asunto: `Nuevo mensaje de ${nombre} sobre tu inmueble, con ref: ${o.ref}, ${ANUNCIOS[o.ref].titulo}`,
      motivo: o.motivo, nl: o.nl, carpeta: o.carpeta, confirmar: o.confirmar, respondido: o.respondido, llega: o.llega,
      m: [['r', o.cuando, avisoIdealista(nombre, o.tel, contacto, o.pregunta, o.ref)]],
      bo: { texto: o.respuesta, equipo: o.equipo || [] } });
  }
  const resp = (dias, h, mi, como = 'idealista', q = ANDREA) => ({ en: iso(diaH(dias, h, mi)), quien: q, como });
  idealista({ nombre: 'javier', ref: 'CA12', cuando: haceMin(34), nl: true, motivo: 'Despacho para 4 en Castellana (idealista)',
    pregunta: 'Hola, me interesa esta oficina y me gustaría hacer una visita.\nUn saludo ',
    respuesta: 'Hola, Javier:\n\nGracias por escribirnos. El despacho de la ref. CA12 está en Castellana 120: exterior, con luz natural y para 4 personas, por 1.250 €/mes + IVA. Incluye limpieza, fibra de 1 Gb, recepción, café y 6 horas de sala de reuniones al mes.\n\nPuedes reservar la visita aquí, eligiendo día y hora:\n[[VISITA:castellana]]\n\n¿Para cuántas personas sería y desde cuándo lo necesitas?\n\nUn saludo.' });
  idealista({ nombre: 'Mariana Ruiz', ref: 'CH03', tel: '634 772 019', cuando: haceMin(131), nl: true, motivo: 'Despacho para 2 en Chamberí (idealista)',
    pregunta: 'Hola, ¿está disponible a partir de enero? Somos 2 personas y trabajamos en diseño gráfico.\n\nUn saludo',
    respuesta: 'Hola, Mariana:\n\nSí, el despacho de la ref. CH03 está disponible desde el 1 de enero. Es un despacho privado para 2 personas en Chamberí (Santa Engracia, 54), por 820 €/mes + IVA, con limpieza, fibra de 1 Gb, recepción, café y 4 horas de sala al mes. Tiene muy buena luz, ideal para diseño.\n\nPuedes venir a verlo cuando te venga bien; reserva aquí la visita:\n[[VISITA:chamberi]]\n\nUn saludo.' });
  idealista({ nombre: 'Rubén Sanz', ref: 'LT05', tel: '611 908 245', cuando: haceMin(96), motivo: 'Despacho para 3 en Las Tablas (idealista)',
    confirmar: { quien: ANDREA, mio: false, abierto_en: iso(haceMin(38)) },
    pregunta: 'Buenas, ¿el precio incluye IVA y gastos de luz y agua? ¿Hay parking en el edificio?',
    respuesta: 'Hola, Rubén:\n\nEl precio de la ref. LT05 son 1.040 €/mes + IVA, con todos los gastos incluidos: luz, agua, climatización, limpieza, fibra de 1 Gb y recepción. El edificio tiene aparcamiento propio; el equipo te confirma el precio de la plaza.\n\nSi quieres verlo, reserva aquí la visita:\n[[VISITA:tablas]]\n\nUn saludo.',
    equipo: ['Confirmarle el precio de la plaza de parking en Las Tablas'] });
  idealista({ nombre: 'Carmen Soler', ref: 'CH09', tel: '699 341 552', cuando: haceMin(212), nl: true, motivo: 'Oficina para 6 en Chamberí (idealista)',
    pregunta: 'Hola, buscamos oficina para 6 personas. Me gustaría ver esta y también alguna en Castellana el mismo día si es posible. Gracias',
    respuesta: 'Hola, Carmen:\n\nLa oficina de la ref. CH09 es para 6 personas, de 32 m² y exterior, por 1.680 €/mes + IVA, con limpieza, fibra, recepción, café y 6 horas de sala al mes.\n\nEn Castellana 120 también tenemos un despacho para 6. Podemos enseñaros los dos el mismo día: reservad aquí la primera visita y os organizamos la segunda justo después:\n[[VISITA:chamberi]]\n\nUn saludo.',
    equipo: ['Coordinar dos visitas el mismo día: Chamberí y Castellana'] });
  idealista({ nombre: 'Alberto', ref: 'MA02', cuando: diaH(1, 20, 12), motivo: 'Puesto flexible en Méndez Álvaro (idealista)',
    pregunta: 'Hola, ¿se puede ir solo por las tardes? ¿Cuánto costaría?\nUn saludo ',
    respuesta: 'Hola, Alberto:\n\nSí. El puesto flexible de la ref. MA02 son 159 €/mes + IVA y puedes venir cuando quieras, de 8:00 a 21:00, también solo por las tardes. Si prefieres pagar por uso, el bono de 10 días sale a 99 € + IVA.\n\nPuedes probar un día gratis; elige el día aquí:\n[[VISITA:mendez]]\n\nUn saludo.' });
  idealista({ nombre: 'Lucía Fernández', ref: 'CA07', tel: '687 220 461', cuando: diaH(1, 11, 3), respondido: resp(1, 11, 26), motivo: 'Puesto fijo en Castellana (idealista)',
    pregunta: 'Hola, me interesa un puesto fijo. ¿Tiene taquilla? ¿Se puede ir los fines de semana?',
    respuesta: 'Hola, Lucía:\n\nSí: el puesto fijo de la ref. CA07 son 260 €/mes + IVA e incluye taquilla, acceso 24/7 (también fines de semana), fibra, café y 4 horas de sala al mes.\n\nReserva aquí la visita para verlo:\n[[VISITA:castellana]]\n\nUn saludo.' });
  idealista({ nombre: 'Hugo', ref: 'CA12', cuando: diaH(2, 18, 30), respondido: resp(2, 19, 2, 'no_hace_falta'), motivo: 'Ya ha encontrado oficina (idealista)',
    pregunta: 'Gracias por la información, al final hemos encontrado algo más cerca de casa.\nUn saludo',
    respuesta: 'Hola, Hugo:\n\n¡Gracias por avisarnos y mucha suerte con la nueva oficina! Si en algún momento necesitáis una sala de reuniones o más espacio, aquí estamos.\n\nUn saludo.' });
  idealista({ nombre: 'Elena Marín', ref: 'LT05', tel: '655 017 338', cuando: diaH(3, 10, 40), respondido: resp(3, 11, 5), motivo: 'Despacho para 3 en Las Tablas (idealista)',
    pregunta: 'Hola, me interesa esta oficina y me gustaría hacer una visita.\n\nUn saludo\nSomos una gestoría pequeña y buscamos algo tranquilo.',
    respuesta: 'Hola, Elena:\n\nEl despacho de la ref. LT05 es muy tranquilo: está en la planta alta, para 3 personas, por 1.040 €/mes + IVA con limpieza, fibra, recepción y 4 horas de sala al mes. Para una gestoría va muy bien, porque podéis recibir a vuestros clientes en las salas.\n\nReserva aquí la visita:\n[[VISITA:tablas]]\n\nUn saludo.' });
  idealista({ nombre: 'Andrés', ref: 'CH03', cuando: diaH(5, 9, 18), respondido: resp(5, 9, 40), carpeta: 'archivados', motivo: 'Despacho para 2 en Chamberí (idealista)',
    pregunta: 'Buenos días, ¿cuál es la permanencia mínima?',
    respuesta: 'Hola, Andrés:\n\nLa permanencia mínima del despacho de la ref. CH03 es de 3 meses, y con contrato anual tienes un 10 % de descuento. La fianza es de una mensualidad.\n\nSi quieres verlo, reserva aquí la visita:\n[[VISITA:chamberi]]\n\nUn saludo.' });
  idealista({ nombre: 'Sonia Prieto', ref: 'CA07', tel: '648 551 902', cuando: diaH(6, 16, 22), respondido: resp(6, 16, 50, 'idealista', YO), motivo: 'Puesto fijo en Castellana (idealista)',
    pregunta: 'Hola, ¿se puede domiciliar la empresa con el puesto fijo?',
    respuesta: 'Hola, Sonia:\n\nSí: con el puesto fijo de la ref. CA07 puedes domiciliar tu empresa en Castellana 120 sin coste añadido, con recepción de correo y paquetería.\n\nReserva aquí la visita para conocer el centro:\n[[VISITA:castellana]]\n\nUn saludo.' });
  idealista({ nombre: 'Patricia Gómez', ref: 'CH09', tel: '622 784 115', cuando: diaH(8, 12, 50), respondido: resp(8, 13, 20), motivo: 'Oficina para 6 en Chamberí (idealista)',
    pregunta: 'Hola, ¿tiene sala de reuniones propia o es compartida?',
    respuesta: 'Hola, Patricia:\n\nLa oficina de la ref. CH09 incluye 6 horas al mes de sala de reuniones, en las salas del centro (las reserváis desde la app). Si necesitáis más, la hora extra sale a 35 € + IVA.\n\nReserva aquí la visita:\n[[VISITA:chamberi]]\n\nUn saludo.' });

  // En vivo: durante la reunión entra un correo y, un rato después, un mensaje de idealista.
  const VIVO = [];
  {
    const h1 = hilo({ tipo: 'comercial', subtipo: 'despacho_meses', de: quien('Alejandro Gil', 'alejandro.gil@nexodigital.es'),
      asunto: '¿Despacho para 2 desde el lunes?', motivo: 'Despacho para 2 personas, entrada inmediata', llega: AHORA + 150e3,
      m: [['r', AHORA + 150e3, 'Hola,\n\nNecesitamos un despacho para 2 personas a partir del lunes, en Castellana o Chamberí. ¿Tenéis algo libre? Sería para al menos 6 meses.\n\nGracias,\nAlejandro Gil']],
      bo: { texto: 'Hola, Alejandro:\n\nSí: en Chamberí (Santa Engracia, 54) tenemos libre un despacho privado para 2 personas por 820 €/mes + IVA, y podéis entrar el lunes. Incluye limpieza, fibra de 1 Gb, recepción, café y 4 horas de sala al mes. Con 6 meses de contrato no hay que pagar nada más que la fianza de una mensualidad.\n\nSi queréis verlo antes del lunes, reservad aquí la visita:\n[[VISITA:chamberi]]\n\nUn saludo.' } });
    VIVO.push({ h: h1, clasifica: AHORA + 168e3, redacta: AHORA + 215e3 });
    h1.borrador.creado_en = iso(AHORA + 215e3);
    const h2 = idealista({ nombre: 'Mónica', ref: 'CA12', cuando: AHORA + 420e3, llega: AHORA + 420e3, motivo: 'Despacho para 4 en Castellana (idealista)',
      pregunta: 'Hola, ¿está disponible para entrar en diciembre? Somos 4.\nGracias',
      respuesta: 'Hola, Mónica:\n\nSí, el despacho de la ref. CA12 está disponible para entrar en diciembre. Es para 4 personas, exterior, por 1.250 €/mes + IVA, con limpieza, fibra de 1 Gb, recepción, café y 6 horas de sala al mes.\n\nReserva aquí la visita:\n[[VISITA:castellana]]\n\nUn saludo.' });
    VIVO.push({ h: h2, clasifica: AHORA + 435e3, redacta: AHORA + 470e3 });
    h2.borrador.creado_en = iso(AHORA + 470e3);
  }

  // En el Embudo, como lo habría dejado el equipo: quién visitó, quién se hizo
  // cliente y quién no siguió, de los que llegaron por correo o idealista.
  {
    const de = t => HILOS.find(h => !h._llega && (h.mensajes[0].de.includes(t) || h.asunto.includes('mensaje de ' + t + ' ')));
    for (const [t, etapa, dias] of [['Nuria Campos', 'ganado', 5], ['Gonzalo Peña', 'visito', 3], ['Sonia Prieto', 'ganado', 2],
      ['Elena Marín', 'visito', 1], ['Lucía Fernández', 'reservada', 1], ['Mariana Ruiz', 'datos', 0], ['Patricia Gómez', 'datos', 6], ['Hugo', 'perdido', 2]]) {
      const h = de(t);
      if (h) MARCAS.push({ clave: 'c:' + h.id, etapa, cuando: iso(Math.min(AHORA - 30 * MIN, diaH(Math.max(1, dias), 13, 10))) });
    }
  }

  // Lo que cada persona ha leído, las carpetas a mano y los «¿se respondió?» de idealista.
  const CR_MARCAS = { desde: iso(AHORA - 3 * DIA), leidos: {}, carpetas: {}, confirmar: {} };
  for (const h of HILOS) {
    const ultR = Math.max(...h.mensajes.filter(m => m.sentido === 'recibido').map(m => +new Date(m.fecha)), 0);
    if (!h._nl && !h._llega && ultR > AHORA - 3 * DIA) CR_MARCAS.leidos[h.id] = { leido: true, en: iso(Math.min(AHORA - MIN, ultR + entre(4, 40) * MIN)) };
    if (h._carpeta) CR_MARCAS.carpetas[h.id] = { carpeta: h._carpeta, quien: ANDREA, en: iso(+new Date(h.ultimo_en) + DIA) };
    if (h._confirmar) CR_MARCAS.confirmar[h.id] = h._confirmar;
  }
  // Lo que el asistente no encontró en la hoja al contestar.
  const FALTAN = [
    { dato: 'Precio del parking por mes en Las Tablas', veces: 3, ultimo_en: iso(haceMin(196)), estado: null },
    { dato: 'Si se admiten mascotas en los centros', veces: 2, ultimo_en: iso(diaH(2, 12, 30)), estado: null },
    { dato: 'Horario de recepción los sábados', veces: 2, ultimo_en: iso(diaH(4, 10, 5)), estado: null },
    { dato: 'Fianza del puesto fijo', veces: 1, ultimo_en: iso(diaH(6, 17, 40)), estado: null }
  ].map(d => ({ ...d, hilos: [], marcado_en: null }));
  let CR_TOPE = 50;
  const ENVIOS = new Map();          // envío → { h, texto, sale, previo }

  // Cómo se ve cada conversación ahora (las «en vivo» van apareciendo).
  function crVer(h) {
    const v = VIVO.find(x => x.h === h), t = Date.now();
    if (h._llega && t < h._llega) return null;
    const c = { ...h };
    if (v && t < v.clasifica) { c.tipo = null; c.subtipo = null; c.borrador = null; c.motivo = null; }
    else if (v && t < v.redacta) { c.borrador = null; c.actualizado_en = iso(v.clasifica); }
    else if (v) c.actualizado_en = iso(Math.max(+new Date(h.actualizado_en), v.redacta));
    for (const k of Object.keys(c)) if (k[0] === '_') delete c[k];
    return c;
  }
  // Los envíos cuyo plazo de 10 s ya pasó salen (de mentira).
  function crAlDia() {
    for (const [id, e] of ENVIOS) {
      if (e.estado !== 'enviando' || Date.now() < e.sale) continue;
      e.estado = 'enviado';
      const h = e.h, bo = h.borrador, en = iso(e.sale + 1200);
      Object.assign(bo, { estado: 'enviado', enviado_en: en, enviado_como: 'panel', quien: YO, envio: null, texto: e.texto, version: bo.version + 1 });
      const p = h.reply_to || h.mensajes[0].de;
      h.mensajes.push({ id: uid(), sentido: 'enviado', de: `${EMPRESA} <${BUZON_EMAIL}>`, para: p, cc: null, reply_to: null, agente: true,
        fecha: en, asunto: 'Re: ' + h.asunto, texto: conEnlaces(e.texto) + FIRMA_TXT, adjuntos: [] });
      h.ultimo_en = en; h.actualizado_en = en;
      e.enviado_en = en;
    }
  }
  const crHilo = id => HILOS.find(h => h.id === id);
  const crHiloBo = id => HILOS.find(h => h.borrador && h.borrador.id === id);
  const usadoHoy = () => 9 + HILOS.filter(h => { const v = crVer(h); return v && v.borrador && +new Date(v.borrador.creado_en) >= inicioHoy; }).length;

  /* ---------- 9. Respuestas de cada función ---------- */
  const conversacionesQueCuentan = () => CONVS.filter(cuenta);
  function filaContacto(p) {
    const cs = p.convs, pa = PAUSAS.get(p.user_ref);
    const pasa = pa && pa.hasta > AHORA;
    return {
      user_ref: p.user_ref, nombre: p.nombre, telefono: p.telefono, email: p.emailDado ? p.email : null,
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
  // El panel manda el inicio del periodo (p_desde, SQL 175) o, el de antes, unas horas.
  const desdeDe = (a, horasDef) => a?.p_desde ? +new Date(a.p_desde) : AHORA - Math.max(1, a?.p_horas || horasDef) * HORA;
  function enRango(horas, desde) { desde = desde ?? AHORA - Math.max(1, horas) * HORA; return conversacionesQueCuentan().filter(c => c.ultima > desde); }
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
      const h = a?.p_horas || 24, v = enRango(h, desdeDe(a, 24));
      return [{ personas: new Set(v.map(c => c.p.user_ref)).size, conversaciones: v.length,
        mensajes: v.reduce((s, c) => s + c.msgs.length, 0), del_cliente: v.reduce((s, c) => s + c.msgs.filter(m => m.papel === 'human').length, 0),
        del_asistente: v.reduce((s, c) => s + c.msgs.filter(m => m.papel !== 'human').length, 0),
        con_interes: v.filter(c => c.interes).length, con_contacto: v.filter(c => c.contacto).length, con_friccion: v.filter(c => c.friccion).length,
        sin_respuesta: v.filter(c => c.sin_respuesta).length, latencia_mediana: tiempoRespuesta(h)[0].mediana_s,
        ultimo: v.length ? iso(Math.max(...v.map(c => c.ultima))) : null }];
    },
    mt_por_hora: a => {
      const desde = desdeDe(a, 24), porDia = desde < AHORA - 48 * HORA, cuenta = new Map();
      for (const c of conversacionesQueCuentan()) for (const m of c.msgs) if (m.cuando > desde) {
        const k = truncar(m.cuando, porDia); cuenta.set(k, (cuenta.get(k) || 0) + 1);
      }
      return [...cuenta].sort((x, y) => x[0] - y[0]).map(([k, n]) => ({ tramo: iso(k), mensajes: n }));
    },
    mt_tiempo_respuesta: a => tiempoRespuesta(a?.p_horas),
    mt_actividad: a => conversacionesQueCuentan().flatMap(c => c.msgs.map(m => ({ c, m }))).filter(x => x.m.cuando > AHORA - 60 * DIA)
      .sort((x, y) => y.m.cuando - x.m.cuando).slice(0, a?.p_limite || 12)
      .map(({ c, m }) => ({ user_ref: c.p.user_ref, nombre: c.p.nombre, telefono: c.p.telefono, papel: m.papel, contenido: m.contenido, cuando: iso(m.cuando) })),
    mt_actividad_personas: a => vivas().filter(p => !EXCLUIDOS.has(p.user_ref))
      .map(p => ({ p, ult: p.convs[p.convs.length - 1] })).sort((x, y) => y.ult.ultima - x.ult.ultima).slice(0, a?.p_limite || 40)
      .map(({ p, ult }) => {
        const msgs = p.convs.flatMap(c => c.msgs);
        const ultH = [...msgs].reverse().find(m => m.papel === 'human');
        const ultM = msgs[msgs.length - 1];
        const at = p.convs.find(c => c.atencion && c.atencion > AHORA - 7 * DIA);
        return { user_ref: p.user_ref, nombre: p.nombre, telefono: p.telefono, ultima: iso(ultM.cuando),
          texto: (ultH || ultM).contenido.slice(0, 220), papel: ultH ? 'human' : ultM.papel,
          atencion_en: at ? iso(at.atencion) : null, atencion_motivo: at ? at.atencion_motivo : null,
          cita: p.visita && p.visita > AHORA ? iso(p.visita) : null,
          interes: p.convs.some(c => c.interes), friccion: p.convs.some(c => c.friccion), sin_respuesta: p.convs.some(c => c.sin_respuesta), contacto: p.convs.some(c => c.contacto) };
      }),
    mt_demanda: a => {
      const filas = [];
      const porServ = new Map(), porCentro = new Map();
      const desde = a?.p_desde ? +new Date(a.p_desde) : null;
      const lista = conversacionesQueCuentan().filter(c => !desde || c.ultima >= desde);
      for (const c of lista) {
        porServ.set(c.servicio, (porServ.get(c.servicio) || 0) + 1);
        porCentro.set(c.centro.clave, (porCentro.get(c.centro.clave) || 0) + 1);
      }
      for (const [k, n] of porServ) filas.push({ categoria: 'servicio', nombre: SERVICIOS[k].nombre, conversaciones: n, veces: Math.round(n * 1.6), lat: null, lng: null, ambito: 'espana', generico: false, coord_origen: 'estimada' });
      for (const c of CENTROS) { const n = porCentro.get(c.clave) || 0; filas.push({ categoria: 'ubicacion', nombre: c.lugar, conversaciones: n, veces: Math.round(n * 1.3), lat: c.lat, lng: c.lng, ambito: 'madrid', generico: false, coord_origen: 'verificada' }); }
      if (lista.length) filas.push({ categoria: 'ubicacion', nombre: 'Madrid', conversaciones: Math.max(1, Math.round(lista.length * 0.12)), veces: Math.max(1, Math.round(lista.length * 0.14)), lat: 40.4168, lng: -3.7038, ambito: 'espana', generico: true, coord_origen: 'verificada' });
      // Las otras ciudades son de todo el histórico: solo en periodos de un mes o más.
      if (!desde || desde <= AHORA - 29 * DIA) for (const [n, la, ln, k] of OTRAS_CIUDADES) filas.push({ categoria: 'ubicacion', nombre: n, conversaciones: k, veces: k + 1, lat: la, lng: ln, ambito: 'espana', generico: false, coord_origen: 'verificada' });
      return filas.filter(f => f.conversaciones > 0 && (!a?.p_categoria || f.categoria === a.p_categoria)).sort((x, y) => y.conversaciones - x.conversaciones || x.nombre.localeCompare(y.nombre));
    },
    mt_patron_horario: a => {
      const m = new Map(), desde = a?.p_desde ? +new Date(a.p_desde) : -Infinity;
      for (const c of conversacionesQueCuentan()) for (const x of c.msgs) if (x.papel === 'human' && x.cuando >= desde) {
        const p = partes(x.cuando), k = p.isodow * 100 + p.h; m.set(k, (m.get(k) || 0) + 1);
      }
      return [...m].sort((a, b) => a[0] - b[0]).map(([k, n]) => ({ dia: Math.floor(k / 100), hora: k % 100, mensajes: n }));
    },
    mt_mis_numeros: a => {
      // Como el SQL 175: el periodo (p_desde) o, sin él, el mes en curso; «conversaciones» son
      // las que atendió el asistente (con alguna respuesta suya), con actividad en el periodo.
      const ini = a?.p_desde ? +new Date(a.p_desde) : inicioMes;
      const per = conversacionesQueCuentan().filter(c => c.ultima >= ini);
      const convs = per.filter(c => c.msgs.some(m => m.papel !== 'human')).length, contactos = new Set(per.map(c => c.p.user_ref)).size;
      const fuera = vivas().filter(p => !EXCLUIDOS.has(p.user_ref) && p.convs[0].primera >= ini && fueraHorario(p.convs[0].msgs[0].cuando)).length;
      const ganados = LEADS.filter(l => l.etapa === 'ganado' && l.cerrado_en >= ini).length;
      const min = AJUSTES.minutos_por_conversacion, coste = AJUSTES.coste_hora_eur, ticket = AJUSTES.ticket_medio_eur;
      const tiempo = Math.round(convs * min / 60 * coste * 100) / 100, ventas = ganados * ticket;
      const d0 = partes(ini);
      return [{ desde: `${d0.y}-${String(d0.m).padStart(2, '0')}-${String(d0.d).padStart(2, '0')}`, contactos, conversaciones: convs, minutos_ahorrados: Math.round(convs * min),
        tiempo_eur: tiempo, ganados, ventas_eur: ventas, fuera_horario: fuera, fuera_horario_eur: fuera * ticket, total_eur: tiempo + ventas,
        coste_hora: coste, minutos_por_conv: min, ticket_medio: ticket, faltan: [], conversaciones_total: per.length, desde_ts: iso(ini) }];
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
        out.push({ user_ref: c.p.user_ref, nombre: c.p.nombre, contenido: m.contenido, papel: m.papel, cuando: iso(m.cuando) });
      return out.sort((x, y) => new Date(y.cuando) - new Date(x.cuando)).slice(0, a?.p_limite || 200);
    },
    // Foto de perfil de WhatsApp: unas 7 de cada 10 personas.
    mt_fotos_panel: () => Object.fromEntries(PERSONAS.map(p => [p.user_ref, fotoDe(p.nombre, 70)]).filter(x => x[1])),
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
      .concat(CITAS_CORREO.map(c => ({ ...c })))
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

    // Correo e Idealista (8 bis). Lo que se hace aquí solo vive en esta pestaña.
    mt_correo_panel: a => {
      crAlDia();
      const desde = a?.p_desde ? +new Date(a.p_desde) : 0;
      const hilos = HILOS.map(crVer).filter(Boolean)
        .filter(h => !desde || Math.max(+new Date(h.ultimo_en), +new Date(h.actualizado_en)) >= desde)
        .sort((x, y) => new Date(y.ultimo_en) - new Date(x.ultimo_en));
      return { hilos, resumen: [], faltan: FALTAN.filter(d => !d.estado).map(d => ({ dato: d.dato, veces: d.veces })) };
    },
    mt_correo_panel_buzones: () => ({ puede_editar: true, puede_cambiar_tope: false, tope: CR_TOPE, usado_hoy: usadoHoy(), visitas: { ...VISITA_URL },
      firma: { nombre: EMPRESA, web: 'https://coworkingdemo.es', telefono: TEL_EMPRESA, color: '#1B7CFF' },
      buzones: [{ id: BUZON_ID, email: BUZON_EMAIL, host: 'mail.coworkingdemo.es', modo: 'borrador', estado: 'ok', tiene_clave: true,
        leido_en: iso(Date.now() - (Math.floor(Date.now() / 1000) % 75) * 1000 - 5000), ultimo_error: null, ultimo_error_ia: null, ultimo_error_ia_en: null,
        desde: iso(AHORA - 75 * DIA), carpetas_entrada: ['INBOX'], carpetas_enviados: ['Enviados'] }] }),
    mt_correo_marcas: () => ({ ...CR_MARCAS, solo_mirar: false }),
    mt_correo_faltan: () => ({ puede_marcar: true, datos: FALTAN.map(d => ({ ...d })),
      hoja: { url: 'https://docs.google.com/spreadsheets/d/demo-coworking', pestanas: [{ clave: 'centros', gid: '0' }, { clave: 'tarifas', gid: '1' }, { clave: 'reglas', gid: '2' }] } }),
    mt_correo_marcar_leido: a => { const en = iso(Date.now()); for (const id of a?.p_hilos || []) CR_MARCAS.leidos[id] = { leido: !!a.p_leido, en }; return { ok: true }; },
    mt_correo_mover: a => {
      for (const id of a?.p_hilos || []) {
        if (a.p_carpeta) CR_MARCAS.carpetas[id] = { carpeta: a.p_carpeta, quien: YO, en: iso(Date.now()) }; else delete CR_MARCAS.carpetas[id];
      }
      return { ok: true };
    },
    mt_correo_marcar_respondido: a => {
      const h = crHilo(a?.p_hilo); if (!h) return { ok: false };
      h.respondido = a.p_respondido ? { en: iso(Date.now()), quien: YO, como: 'mano' } : null;
      if (a.p_respondido) delete CR_MARCAS.confirmar[h.id];
      return { ok: true };
    },
    mt_correo_borrador_guardar: a => {
      const h = crHiloBo(a?.p_borrador); if (!h) throw new Error('sin borrador');
      Object.assign(h.borrador, { texto: String(a.p_texto || ''), version: h.borrador.version + 1, estado: 'propuesto', revisado: true, error: null });
      return { version: h.borrador.version };
    },
    mt_correo_borrador_descartar: a => {
      const h = crHiloBo(a?.p_borrador); if (!h) throw new Error('sin borrador');
      h.borrador.estado = a.p_descartar ? 'descartado' : 'propuesto'; if (!a.p_descartar) h.borrador.version++;
      return { ok: true };
    },
    mt_correo_enviar_cancelar: a => {
      const e = ENVIOS.get(a?.p_envio);
      if (!e || e.estado !== 'enviando' || Date.now() > e.sale - 400) return { ok: false };
      e.estado = 'cancelado'; Object.assign(e.h.borrador, { estado: e.previo, envio: null });
      return { ok: true };
    },
    mt_correo_envio_estado: a => {
      crAlDia();
      const e = ENVIOS.get(a?.p_envio); if (!e) return null;
      return e.estado === 'enviado' ? { que: 'enviado', enviado_en: e.enviado_en, error: null, version: e.h.borrador.version }
        : e.estado === 'cancelado' ? { que: 'no_enviado', error: 'No se ha enviado.', enviado_en: null, version: e.h.borrador.version }
        : { que: 'enviando', error: null, enviado_en: null, version: e.h.borrador.version };
    },
    mt_correo_idealista_abrir: a => { CR_MARCAS.confirmar[a?.p_hilo] = { quien: YO, mio: true, abierto_en: iso(Date.now()) }; return { ok: true }; },
    mt_correo_idealista_confirmar: a => {
      const h = crHilo(a?.p_hilo), en = iso(Date.now());
      delete CR_MARCAS.confirmar[a?.p_hilo];
      if (a?.p_respuesta === 'todavia') CR_MARCAS.leidos[a.p_hilo] = { leido: false, en };
      else if (h) h.respondido = { en, quien: YO, como: a.p_respuesta === 'si' ? 'idealista' : 'no_hace_falta' };
      return { ok: true };
    },
    mt_correo_falta_marcar: a => { const d = FALTAN.find(x => x.dato === a?.p_dato); if (d) { d.estado = a.p_estado; d.marcado_en = iso(Date.now()); } return { ok: true }; },
    mt_correo_tope_cambiar: a => { CR_TOPE = Math.round(Number(a?.p_tope)) || CR_TOPE; return { ok: true }; },
    mt_correo_guardar_clave: () => ({ ok: true }),
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
        // En la demo no se sale nunca: no hay cuenta, la sesión es siempre la misma.
        signOut: async () => ({ error: null }),
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
  // Las llamadas a n8n no salen: las del correo se contestan aquí (leer el
  // correo del buzón, enviar una respuesta, el enlace de idealista); el resto, 503.
  const fetchReal = window.fetch.bind(window);
  const json = (x, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'Content-Type': 'application/json' } });
  const mensajeDe = id => { for (const h of HILOS) { const m = h.mensajes.find(x => x.id === id); if (m) return { h, m }; } return null; };
  function n8n(url, o) {
    const u = new window.URL(url), m = u.searchParams.get('m');
    if (/\/correo\/texto$/.test(u.pathname)) {
      const x = mensajeDe(m);
      return x ? json({ html: MSG_HTML.get(m) || null, texto: x.m.texto, dentro: [] }) : json({ error: 'No se encuentra el correo.' }, 404);
    }
    if (/\/correo\/enlace$/.test(u.pathname)) {
      const x = mensajeDe(m);
      return x ? json({ url: 'https://www.idealista.com/conversaciones/' + x.h.id.slice(0, 8) }) : json({ error: 'No se ha encontrado el enlace.' }, 404);
    }
    if (/\/correo\/envio$/.test(u.pathname)) {
      let b = {}; try { b = JSON.parse(o && o.body || '{}'); } catch (e) {}
      const h = crHiloBo(b.borrador);
      if (!h) return json({ error: 'No se encuentra la respuesta.' }, 400);
      if (Number(b.version) !== h.borrador.version) return json({ error: 'Alguien ha cambiado esta respuesta. Vuelve a abrirla.' }, 409);
      const id = uid();
      ENVIOS.set(id, { h, texto: String(b.texto || ''), sale: Date.now() + 10000, previo: h.borrador.estado, estado: 'enviando' });
      Object.assign(h.borrador, { estado: 'enviando', envio: id, quien: YO, error: null, reintento: false });
      return json({ envio: id, ms: 10000 });
    }
    return json({ ok: false, demo: true }, /\/correo\/(foto|adjunto)$/.test(u.pathname) ? 404 : 503);
  }
  window.fetch = (u, o) => {
    const url = String(u && u.url || u);
    if (/easypanel\.host/.test(url)) return new Promise(r => setTimeout(() => r(n8n(url, o)), 180 + azar() * 220));
    if (/supabase\.co/.test(url)) return Promise.resolve(json({ ok: false, demo: true }, 503));
    return fetchReal(u, o);
  };
  // «Copiar y abrir en idealista»: la conversación no existe, se avisa y sigue el resto (copiar y preguntar si se respondió).
  window.open = () => ({ opener: null, document: { write() {} }, close() {},
    location: { replace() { aviso('Demo: aquí se abriría la conversación en idealista, con la respuesta ya copiada para pegarla.'); } } });

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
    #demo-aviso.ver{opacity:1;transform:translate(-50%,0)}
    /* «Mover a…» en el correo abierto: tan pequeño como los otros botones. */
    .cr-accs .cr-mover{padding:0 4px 0 8px}
    .cr-accs .cr-mover select{width:84px;text-overflow:ellipsis}`;
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

  // Foto de quien escribe en Correo e Idealista: algunas personas, no todas
  // (empresas, avisos y boletines siguen con su inicial).
  const cara = p => fotoDe(p && p.nombre, 60);

  // Embudo con aire: solo unas pocas tarjetas por columna, para que se vean
  // huecos y se entienda que se pueden arrastrar. Se eligen una vez (las más
  // recientes de cada columna y canal) y luego se respetan aunque se muevan.
  const CUPO = { whatsapp: { pregunto: 2, datos: 2, reservada: 2, visito: 2, cerrado: 2 },
                 correo:   { pregunto: 1, datos: 2, reservada: 1, visito: 1, cerrado: 1 },
                 idealista:{ pregunto: 1, datos: 1, reservada: 0, visito: 1, cerrado: 1 } };
  const ELEGIDOS = {};
  function embudo(todas) {
    for (const canal of Object.keys(CUPO)) {
      if (ELEGIDOS[canal]) continue;
      const suyas = todas.filter(p => p.canal === canal);
      if (!suyas.length) continue;
      const set = new Set();
      for (const [col, n] of Object.entries(CUPO[canal])) {
        suyas.filter(p => p.col === col)
          .sort((a, b) => col === 'reservada' ? (a.fut || 0) - (b.fut || 0)
            : col === 'cerrado' && (a.cerrado === 'ganado') !== (b.cerrado === 'ganado') ? (a.cerrado === 'ganado' ? -1 : 1)   // en Cerrado, antes los clientes
            : new Date(b.ultima || 0) - new Date(a.ultima || 0))
          .slice(0, n).forEach(p => set.add(p.k));
      }
      ELEGIDOS[canal] = set;
    }
    return todas.filter(p => ELEGIDOS[p.canal] && ELEGIDOS[p.canal].has(p.k));
  }

  window.__DEMO = { createClient, aviso, cara, embudo, datos: { PERSONAS, CONVS, LEADS, RESERVAS, HILOS } };
})();
