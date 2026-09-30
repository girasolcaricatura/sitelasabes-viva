/* ============================================================
   ¿SÍ TE LA SABES? · VIVA Aerobus
   Configuración del juego. Se puede editar con cualquier editor
   de texto. No hace falta tocar nada más.
   ============================================================ */
window.CONFIG = {

  // Duración de cada partida, en segundos (se puede cambiar al prender con ▲ ▼
  // y en el menú). El reloj nunca se detiene.
  tiempo: 90,
  tiemposMenu: [30, 60, 90, 120, 150, 180],

  // Puntos por cada respuesta correcta.
  puntosPorRespuesta: 10,

  // Puntos con los que se llenan las barras laterales (si alguien pasa de
  // aquí, las barras se reajustan solas).
  puntosBarra: 100,

  // Tiempos de seguridad (en segundos, no se ven en pantalla): si nadie
  // presiona nada, el juego avanza solo y nunca se queda trabado.
  tiempos: {
    inicio: 15,      // al encender: si nadie cambia el evento, arranca solo
    pista: 20,       // si nadie contesta una pregunta, se muestra la respuesta y sigue
    contestar: 6,    // después de marcar quién contesta, la respuesta aparece sola
    calificar: 15,   // si nadie califica, cuenta como que no se la sabe
    resultados: 15   // pantalla de ganador antes de volver a la espera
  },

  // Eventos del circuito (en el orden en que aparecen al configurar).
  //   nombre: el artista o equipo (se usa en el menú y para las preguntas).
  //   gira:   nombre del tour; si existe, es lo que se ve en grande en pantalla.
  //   claves: qué bancos de preguntas usa (columna EVENTO del Excel).
  //           Un evento puede mezclar varios bancos, como el Clásico Regio.
  eventos: [
    { nombre: "MAROON 5",       gira: "LOVE IS LIKE TOUR",    tipo: "CONCIERTO", fecha: "3 OCT",  claves: ["MAROON 5"] },
    { nombre: "ALEJANDRO SANZ", gira: "¿Y AHORA QUÉ? TOUR",   tipo: "CONCIERTO", fecha: "17 OCT", claves: ["ALEJANDRO SANZ"] },
    { nombre: "INTOCABLE",      gira: "CULTURA TOUR",         tipo: "CONCIERTO", fecha: "7 NOV",  claves: ["INTOCABLE", "NORTEÑO"] },
    { nombre: "ROD STEWART",    gira: "THE FINAL RUN",        tipo: "CONCIERTO", fecha: "",       claves: ["ROD STEWART"] },
    { nombre: "TIGRES",         tipo: "PARTIDO",   fecha: "",       claves: ["TIGRES"] },
    { nombre: "RAYADOS",        tipo: "PARTIDO",   fecha: "",       claves: ["RAYADOS"] },
    { nombre: "CLÁSICO REGIO",  tipo: "PARTIDO",   fecha: "",       claves: ["TIGRES", "RAYADOS"] },
    { nombre: "BORREGOS",       tipo: "PARTIDO",   fecha: "",       claves: ["BORREGOS"] },
    { nombre: "ANUEL AA",       gira: "REAL HASTA LA MUERTE", tipo: "CONCIERTO", fecha: "8 ABR 2027", claves: ["ANUEL AA"] }
  ],

  // Sonidos del juego.
  sonido: true,

  // Teclado de respaldo: las mismas flechas que la cruz del control NES.
  // (El control NES no se configura: se lee solo. Ver juego.js.)
  //   ←  contestó el jugador 1      →  contestó el jugador 2
  //   ↑  sí se la sabe              ↓  no se la sabe
  //   Enter  continuar (empezar, mostrar respuesta, siguiente pareja)
  teclas: {
    izq:    ["ArrowLeft"],
    der:    ["ArrowRight"],
    arriba: ["ArrowUp"],
    abajo:  ["ArrowDown"],
    ok:     ["Enter", " "],
    menu:   ["m", "Escape"]  // menú (en el control NES: START)
  }
};
