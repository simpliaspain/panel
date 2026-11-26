# Panel de demostración

`panel.simpliaspain.com/demo/` (también `simpliaspain.github.io/panel/demo/`).

Es el **mismo panel de producción** (`index.html`) con los datos de un cliente
inventado, «Coworking Demo». Sirve para enseñarlo en reuniones sin tocar datos
reales.

- **No se conecta a ningún servidor.** `demo-datos.js` contesta todas las
  llamadas que el panel haría a Supabase. Los datos se generan al abrir la
  página con una semilla fija y con fechas referidas al momento en que se abre:
  siempre parece «de hoy» y siempre salen las mismas personas.
- **Todo se puede pulsar.** Pausar, dejar fuera del recuento, mover un lead,
  apuntar un toque… funciona y se ve, pero solo en esa pestaña: al recargar
  vuelve a estar como al principio.
- **Llamar, WhatsApp y Correo no abren nada** (son personas inventadas): sale
  un aviso «Demo: aquí se…».
- Las preferencias que el panel guarda en el navegador van con el prefijo
  `simplia-demo:` y no se mezclan con las del panel real.
- Correo e Idealista no salen: en producción solo los tiene Oficinas YA.

## Actualizarla cuando cambie el panel

```
node demo/construir.mjs
```

Regenera `demo/index.html` a partir de `index.html` (cambia solo de dónde salen
los datos, el título y la versión). Si el panel empieza a usar una función nueva
de Supabase, hay que añadirla en `demo-datos.js` (objeto `R`); mientras no esté,
el panel la trata como «aún no disponible en el servidor».
