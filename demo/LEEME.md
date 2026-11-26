# Panel de demostración

`panel.simpliaspain.com/demo/` (también `simpliaspain.github.io/panel/demo/`).

Es el **mismo panel de producción** (`index.html`) con los datos de un cliente
inventado, «Coworking Demo». Sirve para enseñarlo en reuniones y para enviarlo
a posibles clientes sin tocar datos reales.

- **No se conecta a ningún servidor.** `demo-datos.js` contesta todas las
  llamadas que el panel haría a Supabase y a n8n. Los datos se generan al abrir
  la página con una semilla fija y con fechas referidas al momento en que se
  abre: siempre parece «de hoy» y siempre salen las mismas personas.
- **Todo se puede pulsar, nada se guarda.** Pausar, mover un lead, marcar como
  no leído, enviar una respuesta… se ve, pero solo en esa pestaña. Tampoco se
  guarda nada en el navegador: **al recargar, todo vuelve a estar como al
  principio**. Varias personas pueden usarla a la vez sin verse entre ellas.
- **No hay cuenta ni «Salir»:** entra directa, sin pedir nada a nadie.
- **Llamar, WhatsApp y Correo no abren nada** (son personas inventadas): sale
  un aviso «Demo: aquí se…». Enviar un correo tampoco manda nada.
- **WhatsApp:** todos tienen nombre, unos 7 de cada 10 con foto, y arriba del
  todo salen primero los que han reservado visita y luego los que han dejado su
  correo, con servicios variados. No hay ejemplos de fricción ni de «sin
  respuesta».
- **Correo e Idealista salen como en el panel real**, con el buzón
  inventado `comercial@coworkingdemo.es`: carpetas, respuestas propuestas
  (editar, guardar, descartar, enviar con 10 s para deshacer), leído y mover,
  «Para el equipo», lo que le falta al asistente (Configuración › General) y
  los mensajes de idealista (copiar y abrir, «¿le has respondido?»).
  Por defecto, el correo a la izquierda y la respuesta a la derecha.
- **Fotos de las personas:** retratos de prueba gratuitos de randomuser.me
  (los carga el navegador de quien mira). Nunca el logo del dominio de quien
  escribe: un dominio inventado podría existir y sacar el de otra empresa.
  Empresas, avisos y boletines salen con su inicial.
- **Embudo con aire:** solo unas pocas tarjetas por columna (se eligen al
  abrir), para que se vean huecos y se entienda que se pueden mover.
- **En vivo:** unos 2 minutos y medio después de abrir la página entra un
  correo de un cliente nuevo (se ve «Clasificando…», luego «Redactando…» y
  al final la respuesta), y a los 7 minutos un mensaje de idealista.

## Actualizarla cuando cambie el panel

```
node demo/construir.mjs
```

Regenera `demo/index.html` a partir de `index.html` (cambia solo de dónde salen
los datos, el título, la versión, el acceso de «demo» al Correo y a Idealista,
las fotos de quien escribe, la vista del correo y el embudo). Si el panel
empieza a usar una función nueva de Supabase, hay que añadirla en
`demo-datos.js` (objeto `R`); mientras no esté, el panel la trata como «aún no
disponible en el servidor».
