/* ============================================================
   ¿SÍ TE LA SABES? · VIVA Aerobus
   Motor del juego. Corre sin internet, desde una carpeta local.

   Duelo de dos jugadores con reloj de 90 segundos. Los botones del
   counter son de utilería: el anfitrión marca con el control quién
   contestó primero y si se la sabe.

   Control NES por USB (o teclado, con las mismas flechas):
     ◀ / ←      contestó el jugador 1 (izquierda)
     ▶ / →      contestó el jugador 2 (derecha)
     ▲ / ↑      sí se la sabe
     ▼ / ↓      no se la sabe
     A, B, Start, Select / Enter   continuar (empezar, mostrar respuesta, siguiente)

   El control se lee por DIRECCIÓN de la cruz y "cualquier otro botón",
   así que funciona igual aunque cada marca numere distinto sus botones.
   Si nadie presiona nada, el juego sigue solo: nunca se queda trabado.
   ============================================================ */
(function () {
  "use strict";
  const C = window.CONFIG;
  const T = Object.assign({ inicio: 15, pista: 20, contestar: 6, calificar: 15, resultados: 15 }, C.tiempos);
  const $ = (s) => document.querySelector(s);
  const escenario = $("#escenario"), pantalla = $("#pantalla");
  const tablero = $("#tablero"), lista = $("#lista"), etiqueta = $("#etiqueta");
  const tarjeta = $("#tarjeta"), pistaEl = $("#pista"), fichas = $("#fichas"), ayudaEl = $("#ayuda");
  const contador = $("#contador"), digitos = contador.querySelector(".digitos"), leyenda = contador.querySelector(".leyenda");
  const J = { 1: $("#j1"), 2: $("#j2") };
  const EVENTOS = C.eventos;
  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

  /* ---------------------------------------------------------- ajustes guardados */
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const leer = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const TIEMPOS = C.tiemposMenu || [30, 60, 90, 120, 150, 180];
  const ajustes = Object.assign({ evento: 0, tiempo: C.tiempo, sonido: C.sonido }, leer("stls.ajustes3", {}));
  if (!TIEMPOS.includes(ajustes.tiempo)) ajustes.tiempo = C.tiempo;
  if (!(ajustes.evento >= 0 && ajustes.evento < EVENTOS.length)) ajustes.evento = 0;
  const evento = () => EVENTOS[ajustes.evento];
  const guardarAjustes = () => guardar("stls.ajustes3", ajustes);

  /* ---------------------------------------------------------- escala */
  function escalar() { escenario.style.transform = `scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`; }
  addEventListener("resize", escalar); escalar();

  /* ---------------------------------------------------------- utilidades */
  const may = (t) => String(t == null ? "" : t).toUpperCase();
  const clave = (t) => may(t).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  function el(tag, clase, cont) {
    const e = document.createElement(tag);
    if (clase) e.className = clase;
    if (Array.isArray(cont)) cont.filter(Boolean).forEach((c) => e.append(c));
    else if (cont != null) e.textContent = cont;
    return e;
  }
  // El contador grande de arriba: un número y una leyenda.
  function marcador(numero, texto = "SEGUNDOS") { digitos.textContent = numero; leyenda.textContent = texto; }

  /* ---------------------------------------------------------- sonido */
  let audio = null;
  function tono(frec, dur, tipo = "sine", vol = 0.18, cuando = 0) {
    if (!ajustes.sonido) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      const t0 = audio.currentTime + cuando;
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = tipo; o.frequency.setValueAtTime(frec, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(audio.destination); o.start(t0); o.stop(t0 + dur + 0.05);
    } catch (e) {}
  }
  const SFX = {
    campana() { tono(784, .9, "sine", .2); tono(587, 1.2, "sine", .2, .45); },
    boton()   { tono(220, .28, "square", .12); tono(330, .2, "square", .08, .05); },
    bien()    { tono(660, .18, "triangle", .2); tono(880, .18, "triangle", .2, .12); tono(1320, .35, "triangle", .18, .24); },
    mal()     { tono(160, .45, "sawtooth", .12); },
    flap()    { tono(90 + Math.random() * 40, .03, "square", .04); },
    clic()    { tono(900, .04, "square", .05); },
    fin()     { tono(523, .25, "triangle", .2); tono(659, .25, "triangle", .2, .2); tono(784, .6, "triangle", .2, .4); }
  };

  /* ---------------------------------------------------------- banco de preguntas */
  function textoTipo(q) {
    const t = clave(q.tipo);
    if (t === "CANCION") return "COMPLETA EL TÍTULO DE LA CANCIÓN";
    if (t === "DISCO") return "COMPLETA EL NOMBRE DEL DISCO";
    return /_{2,}/.test(q.pista) ? "COMPLETA LA FRASE" : "RESPONDE CON UNA PALABRA";
  }
  let banco = {}, fuenteBanco = "archivo de respaldo";
  function normalizarBanco(obj) {
    const out = {};
    for (const k in obj) {
      const l = (obj[k] || []).filter((p) => p && p[0] && p[1])
        .map((p) => ({ pista: String(p[0]).trim(), resp: String(p[1]).trim(), tipo: String(p[2] || "").trim() }));
      if (l.length) out[clave(k)] = (out[clave(k)] || []).concat(l);
    }
    return out;
  }
  function bancoDesdeFilas(filas) {
    const enc = (filas[0] || []).map(clave);
    const iA = enc.findIndex((h) => h === "EVENTO" || h === "ARTISTA");
    const iP = enc.findIndex((h) => h === "PISTA" || h === "PREGUNTA");
    const iR = enc.indexOf("RESPUESTA"), iT = enc.indexOf("TIPO");
    if (iA < 0 || iP < 0 || iR < 0) throw new Error("El Excel necesita las columnas EVENTO, PISTA y RESPUESTA.");
    const obj = {};
    filas.slice(1).forEach((f) => {
      const a = clave(f[iA]); if (!a || !f[iP] || !f[iR]) return;
      (obj[a] = obj[a] || []).push([f[iP], f[iR], iT >= 0 ? f[iT] : ""]);
    });
    return normalizarBanco(obj);
  }
  function leerLibro(datos) {
    const libro = XLSX.read(datos, { type: "array" });
    return bancoDesdeFilas(XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]], { header: 1, defval: "" }));
  }
  async function cargarBanco() {
    banco = normalizarBanco(window.PREGUNTAS || {}); fuenteBanco = "archivo de respaldo (preguntas.js)";
    const imp = leer("stls.banco2", null);
    if (imp && Object.keys(imp).length) { banco = imp; fuenteBanco = "Excel importado desde el menú"; }
    if (location.protocol.startsWith("http")) {
      try {
        const r = await fetch("datos/preguntas.xlsx", { cache: "no-store" });
        if (r.ok) { const b = leerLibro(new Uint8Array(await r.arrayBuffer())); if (Object.keys(b).length) { banco = b; fuenteBanco = "datos/preguntas.xlsx"; } }
      } catch (e) {}
    }
  }
  const preguntasDe = (ev) => ev.claves.reduce((a, c) => a.concat(banco[clave(c)] || []), []);
  // Mazo por evento: las preguntas no se repiten hasta agotarse.
  function siguientePregunta() {
    const l = preguntasDe(evento());
    if (!l.length) return null;
    const id = "stls.mazo2." + clave(evento().nombre);
    let m = leer(id, null);
    if (!m || m.n !== l.length || m.pos >= m.orden.length) {
      const orden = l.map((_, i) => i);
      for (let i = orden.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [orden[i], orden[j]] = [orden[j], orden[i]]; }
      m = { n: l.length, orden, pos: 0 };
    }
    const p = l[m.orden[m.pos++]];
    guardar(id, m);
    return Object.assign({}, p);
  }

  /* ---------------------------------------------------------- guía de botones (abajo)
     Siempre dice qué botones sirven en este momento, con el mismo símbolo que el control.
  */
  const ICONO = { izq: "◀", der: "▶", arriba: "▲", abajo: "▼", ok: "A", start: "START", izqder: "◀▶", arribaabajo: "▲▼" };
  function ayuda(...items) {
    ayudaEl.innerHTML = "";
    ayudaEl.className = items.length === 1 ? "uno" : "";
    items.forEach(([accion, texto]) => {
      const chip = el("div", "chip " + accion, [el("b", "", ICONO[accion]), el("span", "", may(texto))]);
      if (accion === "ok") chip.append(el("small", "", "O ENTER"));
      ayudaEl.appendChild(chip);
    });
  }

  /* ---------------------------------------------------------- jugadores */
  const pj = { 1: { pts: 0 }, 2: { pts: 0 } };
  J[1].querySelector(".lado").textContent = "◀";
  J[2].querySelector(".lado").textContent = "▶";
  // Barras a los lados: se llenan con los puntos de cada jugador.
  const BARRA = { 1: $("#b1"), 2: $("#b2") };
  function pintarBarras() {
    const escala = Math.max(C.puntosBarra || 100, pj[1].pts, pj[2].pts);
    [1, 2].forEach((n) => {
      BARRA[n].querySelector("i").style.height = (100 * pj[n].pts / escala) + "%";
      BARRA[n].querySelector("span").textContent = pj[n].pts;
    });
  }
  function pintarJugador(n, txt = "", clase = "") {
    J[n].className = "jugador j" + n + (clase ? " " + clase : "");
    J[n].querySelector(".estado").textContent = may(txt);
    J[n].querySelector(".marcador").textContent = pj[n].pts;
    pintarBarras();
  }
  function sumar(n) {
    pj[n].pts += C.puntosPorRespuesta;
    J[n].querySelector(".marcador").textContent = pj[n].pts;
    pintarBarras();
    const s = el("div", "suma", "+" + C.puntosPorRespuesta);
    J[n].appendChild(s); setTimeout(() => s.remove(), 1300);
  }

  /* ---------------------------------------------------------- estados y reloj
     inicio → espera → cuenta → pista → contesta → calificar → resultado → pista … → final → espera
     El reloj de la partida nunca se detiene: corre hasta llegar a cero.
     Cada fase tiene un tiempo límite invisible para que el juego nunca se trabe.
  */
  let estado = "inicio", ocupado = false, pausa = false;
  let reloj = null, ultimoTic = 0, quedaMs = 0;
  let fase = { ms: 0, limite: 0, fin: null };
  let q = null, huecoEl = null, turno = null, revelada = false, temporizadorFinal = null, rotacion = null, paginaEspera = 0;

  function iniciarFase(seg, fin) { fase = { ms: 0, limite: seg * 1000, fin }; }
  function tic() {
    const ahora = performance.now(), dt = ahora - ultimoTic; ultimoTic = ahora;
    if (pausa) return;
    if (["pista", "contesta", "calificar", "resultado"].includes(estado)) {
      quedaMs -= dt;
      const r = Math.max(0, Math.ceil(quedaMs / 1000));
      if (String(r) !== digitos.textContent) marcador(r);
      if (quedaMs <= 0) { terminar(); return; }
    }
    if (ocupado || !fase.fin) return;
    fase.ms += dt;
    if (fase.ms >= fase.limite) { const f = fase.fin; fase.fin = null; f(); }
  }
  function arrancarReloj() { clearInterval(reloj); ultimoTic = performance.now(); reloj = setInterval(tic, 100); }

  /* ---- 1. inicio: confirmar el evento ---- */
  function irInicio() {
    clearTimeout(temporizadorFinal); clearInterval(rotacion);
    estado = "inicio"; escenario.className = "inicio";
    marcador(ajustes.tiempo);
    pintarInicio();
    iniciarFase(T.inicio, irEspera);
    arrancarReloj();
  }
  function pintarInicio() {
    const ev = evento(), nq = preguntasDe(ev).length;
    marcador(ajustes.tiempo);
    pantalla.innerHTML = "";
    pantalla.append(
      el("div", "p-arriba", [el("span", "p-titulo", "El juego de hoy es de:")]),
      el("div", "p-valor", [
        el("div", "grande", ev.nombre),
        nq ? el("div", "detalle", [ev.tipo, ev.fecha].filter(Boolean).join(" · "))
           : el("div", "aviso", "Este evento no tiene preguntas"),
        el("div", "tiempo", [el("span", "", "▲ ▼"), el("b", "", ajustes.tiempo + " segundos"), el("span", "", "por partida")])
      ]),
      el("div", "p-control " + (padNombre ? "si" : "no"), textoControl())
    );
    const g = pantalla.querySelector(".grande");
    let t = 150; while (g.scrollWidth > 1600 && t > 60) { t -= 4; g.style.fontSize = t + "px"; }
    ayuda(["izqder", "CAMBIAR EVENTO"], ["ok", "LISTO, EMPEZAR"], ["arribaabajo", "CAMBIAR TIEMPO"]);
  }
  function cambiarEvento(d) {
    SFX.clic();
    ajustes.evento = (ajustes.evento + d + EVENTOS.length) % EVENTOS.length; guardarAjustes();
    pintarInicio(); iniciarFase(T.inicio, irEspera);
  }
  function cambiarTiempo(d) {
    SFX.clic();
    const i = Math.max(0, Math.min(TIEMPOS.length - 1, TIEMPOS.indexOf(ajustes.tiempo) + d));
    ajustes.tiempo = TIEMPOS[i]; guardarAjustes();
    marcador(ajustes.tiempo); pintarInicio(); iniciarFase(T.inicio, irEspera);
  }

  /* ---- 2. espera: la fila ve el juego ---- */
  function pintarLista(lineas) {
    tablero.className = "lista";
    lista.innerHTML = "";
    lineas.forEach((l) => {
      if (l.marcadores) {   // puntos de cada jugador, cada uno debajo de su nombre
        lista.appendChild(el("div", "linea " + l.c, [1, 2].map((n) =>
          el("div", "final-jugador", [el("span", "", "JUGADOR " + n), el("b", "", pj[n].pts + " PTS")]))));
        return;
      }
      const d = el("div", "linea" + (l.c ? " " + l.c : ""), may(l.t));
      lista.appendChild(d);
      let t = parseFloat(getComputedStyle(d).fontSize);
      while (d.scrollWidth > d.clientWidth + 1 && t > 28) { t -= 2; d.style.fontSize = t + "px"; }
    });
    lista.classList.remove("entra"); void lista.offsetWidth; lista.classList.add("entra");
  }
  function paginasEspera() {
    return [
      [{ t: "¿Sí te la sabes?", c: "titulo" }, { t: "Hoy: " + evento().nombre, c: "valor" }, { t: "¡Acércate y juega!" }],
      [{ t: "Cómo se juega", c: "titulo" }, { t: "Presiona tu botón antes que el otro", c: "chico" }, { t: "y di la palabra que falta", c: "chico" }]
    ];
  }
  function mostrarPaginaEspera() { const p = paginasEspera(); pintarLista(p[paginaEspera++ % p.length]); }
  function irEspera() {
    clearTimeout(temporizadorFinal); clearInterval(rotacion); clearInterval(reloj); fase.fin = null;
    estado = "espera"; escenario.className = "espera";
    marcador(ajustes.tiempo);
    [1, 2].forEach((n) => { pj[n].pts = 0; pintarJugador(n); });
    paginaEspera = 0; mostrarPaginaEspera();
    rotacion = setInterval(mostrarPaginaEspera, 6000);
    ayuda(["ok", "EMPEZAR PARTIDA"]);
  }

  /* ---- 3. cuenta regresiva ---- */
  function iniciarCuenta() {
    clearInterval(rotacion); clearInterval(reloj); fase.fin = null;
    estado = "cuenta"; escenario.className = "juego";
    [1, 2].forEach((n) => { pj[n].pts = 0; pintarJugador(n); });
    pintarLista([{ t: "¡A jugar!", c: "titulo" }, { t: evento().nombre, c: "valor" }, { t: "Prepárense…", c: "chico" }]);
    ayuda();
    SFX.campana();
    let n = 3; marcador(n, "¡PREPÁRENSE!");
    const t = setInterval(() => {
      n--;
      if (estado !== "cuenta") { clearInterval(t); return; }
      if (n > 0) marcador(n, "¡PREPÁRENSE!");
      else { clearInterval(t); quedaMs = ajustes.tiempo * 1000; marcador(ajustes.tiempo); arrancarReloj(); nuevaPregunta(); }
    }, 1000);
  }

  /* ---- 4. preguntas ---- */
  function pintarPregunta() {
    tablero.className = "pregunta";
    etiqueta.innerHTML = ""; etiqueta.append(el("span", "", textoTipo(q)));
    pistaEl.innerHTML = ""; pistaEl.style.fontSize = "";
    const titulo = ["CANCION", "DISCO"].includes(clave(q.tipo));
    const m = q.pista.match(/_{2,}/);
    const antes = (titulo ? "«" : "") + (m ? q.pista.slice(0, m.index) : q.pista);
    const despues = (m ? q.pista.slice(m.index + m[0].length) : "") + (titulo ? "»" : "");
    huecoEl = m ? el("span", "hueco") : null;
    pistaEl.append(...[el("span", "", antes), huecoEl, el("span", "", despues)].filter(Boolean));
    let t = 66;
    while (pistaEl.offsetHeight > t * 1.18 * 2 + t * 0.4 && t > 40) { t -= 2; pistaEl.style.fontSize = t + "px"; }
    fichas.innerHTML = "";
    const r = may(q.resp);
    fichas.className = r.length > 14 ? "mini" : r.length > 11 ? "chicas" : "";
    for (const ch of r) fichas.appendChild(el("div", "ficha" + (ch === " " ? " espacio" : "")));
    tarjeta.className = ""; void tarjeta.offsetWidth; tarjeta.className = "entra";
  }
  async function revelar() {
    if (revelada) return; revelada = true;
    const r = may(q.resp);
    if (huecoEl) { huecoEl.className = "hueco lleno"; huecoEl.textContent = q.resp; }
    const fs = fichas.querySelectorAll(".ficha");
    for (let i = 0; i < r.length; i++) { if (r[i] !== " ") { fs[i].textContent = r[i]; SFX.flap(); await espera(40); } }
  }

  async function nuevaPregunta() {
    if (!["pista", "resultado", "cuenta"].includes(estado)) return;
    const sig = siguientePregunta();
    if (!sig) { estado = "pista"; terminar(true); return; }
    q = sig; turno = null; revelada = false;
    estado = "pista"; ocupado = true;
    escenario.classList.remove("decidir");
    [1, 2].forEach((n) => pintarJugador(n));
    pintarPregunta();
    ayuda();
    await espera(350);
    if (estado !== "pista") return;
    ocupado = false;
    iniciarFase(T.pista, nadie);   // si nadie contesta en un buen rato, pasa sola
    ayuda(["izq", "CONTESTA JUGADOR 1"], ["ok", "NADIE, PASAR"], ["der", "CONTESTA JUGADOR 2"]);
  }
  // El anfitrión marca quién contestó primero. El reloj se detiene.
  function darTurno(n) {
    if (estado !== "pista" && estado !== "contesta") return;
    turno = n; estado = "contesta"; SFX.boton();
    tarjeta.className = "turno";
    pintarJugador(n, "¡CONTESTA!", "turno");
    pintarJugador(3 - n, "", "apagado");
    ayuda(["ok", "YA CONTESTÓ: MOSTRAR RESPUESTA"]);
    iniciarFase(T.contestar, mostrarParaCalificar);   // si no, la respuesta se muestra sola
  }
  async function mostrarParaCalificar() {
    if (estado !== "contesta") return;
    estado = "calificar"; ocupado = true;
    ayuda();
    await revelar();
    if (estado !== "calificar") return;   // se acabó el tiempo mientras tanto
    ocupado = false;
    pintarJugador(turno, "¿SE LA SABE?", "turno");
    escenario.classList.add("decidir");
    ayuda(["abajo", "NO SE LA SABE"], ["arriba", "SÍ SE LA SABE"]);
    iniciarFase(T.calificar, () => calificar(false));   // si nadie califica, cuenta como no
  }
  async function calificar(acierto) {
    if (estado !== "calificar" || !revelada) return;   // nunca sin haber visto la respuesta
    estado = "resultado"; ocupado = true; fase.fin = null;
    escenario.classList.remove("decidir");
    const n = turno;
    ayuda();
    revelar();
    if (acierto) { tarjeta.className = "bien"; SFX.bien(); sumar(n); pintarJugador(n, "¡CORRECTO!", "bien"); }
    else { tarjeta.className = "mal"; SFX.mal(); pintarJugador(n, "NO ERA ESA"); }
    await espera(acierto ? 1600 : 2000);
    if (estado !== "resultado") return;
    ocupado = false;
    nuevaPregunta();
  }
  // Nadie contestó: se muestra la respuesta y sigue.
  async function nadie() {
    if (estado !== "pista") return;
    estado = "resultado"; ocupado = true; fase.fin = null;
    tarjeta.className = "mal";
    ayuda();
    await revelar();
    await espera(1800);
    if (estado !== "resultado") return;
    ocupado = false;
    nuevaPregunta();
  }

  /* ---- 5. final: los dos ganan; se muestran los puntos de cada quien ---- */
  async function terminar(sinPreguntas = false) {
    if (!["pista", "contesta", "calificar", "resultado"].includes(estado)) return;
    estado = "final"; ocupado = true; clearInterval(reloj); fase.fin = null;
    escenario.classList.remove("decidir");
    marcador(0);
    if (q && !revelada) { tarjeta.className = "mal"; revelar(); }
    SFX.fin(); ayuda();
    await espera(1500);
    if (estado !== "final") return;
    ocupado = false;
    pintarLista([
      { t: sinPreguntas ? "Se acabaron las preguntas" : "¡Aterrizamos!", c: "titulo" },
      { marcadores: true, c: "valor marcadores" },
      { t: "Gracias por volar con VIVA", c: "chico" }
    ]);
    [1, 2].forEach((n) => pintarJugador(n, "", "bien"));
    ayuda(["ok", "SIGUIENTE PAREJA"]);
    temporizadorFinal = setTimeout(irEspera, T.resultados * 1000);
  }

  /* ---------------------------------------------------------- qué hace cada botón en cada momento */
  function accion(a) {
    if (a === "start") { abrirMenu(); return; }
    if (ocupado) return;
    switch (estado) {
      case "inicio":
        if (a === "izq") cambiarEvento(-1);
        else if (a === "der") cambiarEvento(1);
        else if (a === "arriba") cambiarTiempo(1);
        else if (a === "abajo") cambiarTiempo(-1);
        else if (a === "ok") { SFX.boton(); irEspera(); }
        break;
      case "espera":
        if (a === "ok") iniciarCuenta();
        break;
      case "pista":
        if (a === "izq") darTurno(1);
        else if (a === "der") darTurno(2);
        else if (a === "ok") nadie();
        break;
      case "contesta":   // se puede corregir el jugador; para calificar primero hay que ver la respuesta
        if (a === "izq" && turno !== 1) darTurno(1);
        else if (a === "der" && turno !== 2) darTurno(2);
        else if (a === "ok") mostrarParaCalificar();
        break;
      case "calificar":
        if (a === "arriba") calificar(true);
        else if (a === "abajo") calificar(false);
        break;
      case "final":
        if (a === "ok") irEspera();
        break;
    }
  }

  /* ---------------------------------------------------------- menú (START del control, o tecla M)
     ▲ ▼ moverse · ◀ ▶ cambiar · A elegir · START cerrar.
     Se cierra solo si nadie lo toca en 30 segundos.
  */
  const menu = $("#menu"), menuOps = $("#menuOps"), menuInfo = $("#menuInfo"), menuPrueba = $("#menuPrueba");
  let sel = 0, menuAbierto = false, menuInactivo = null;
  const enJuego = () => ["pista", "contesta", "calificar", "resultado"].includes(estado);
  function opciones() {
    const ops = [
      { t: "Evento de hoy", v: evento().nombre, mover: (d) => { ajustes.evento = (ajustes.evento + d + EVENTOS.length) % EVENTOS.length; } },
      { t: "Tiempo por partida", v: ajustes.tiempo + " s", mover: (d) => { const i = TIEMPOS.indexOf(ajustes.tiempo); ajustes.tiempo = TIEMPOS[(i + d + TIEMPOS.length) % TIEMPOS.length]; } },
      { t: "Sonido", v: ajustes.sonido ? "Sí" : "No", mover: () => { ajustes.sonido = !ajustes.sonido; } }
    ];
    if (enJuego() || estado === "cuenta") ops.push({ t: "Terminar la partida ahora", v: "", accion: () => { cerrarMenu(false); estado === "cuenta" ? irEspera() : terminar(); } });
    ops.push({ t: "Volver al inicio", v: "", accion: () => { cerrarMenu(false); irInicio(); } });
    ops.push({ t: "Cerrar menú", v: "", accion: () => cerrarMenu() });
    return ops;
  }
  function pintarMenu() {
    const ops = opciones(); sel = Math.min(sel, ops.length - 1);
    menuOps.innerHTML = "";
    ops.forEach((o, i) => {
      const d = el("div", "op" + (i === sel ? " sel" : ""), [el("span", "", o.t), el("span", "val", o.v ? (o.mover ? "◀  " + o.v + "  ▶" : o.v) : "")]);
      menuOps.appendChild(d);
    });
    menuInfo.textContent = `Preguntas: ` + EVENTOS.map((e) => `${e.nombre} ${preguntasDe(e).length}`).join(" · ")
      + `\nControl: ${padNombre || "no detectado"}`;
  }
  function reiniciarInactividad() { clearTimeout(menuInactivo); menuInactivo = setTimeout(() => menuAbierto && cerrarMenu(), 30000); }
  function abrirMenu() {
    if (menuAbierto) { cerrarMenu(); return; }
    menuAbierto = true; pausa = true; sel = 0; menu.classList.add("abierto"); pintarMenu(); reiniciarInactividad();
  }
  function cerrarMenu(refrescar = true) {
    clearTimeout(menuInactivo);
    menuAbierto = false; menu.classList.remove("abierto");
    guardarAjustes(); pausa = false; ultimoTic = performance.now();
    if (refrescar && estado === "espera") irEspera();
    if (refrescar && estado === "inicio") pintarInicio();
  }
  function menuAccion(a) {
    const ops = opciones();
    reiniciarInactividad();
    if (a === "abajo") sel = (sel + 1) % ops.length;
    else if (a === "arriba") sel = (sel - 1 + ops.length) % ops.length;
    else if (a === "izq" && ops[sel].mover) ops[sel].mover(-1);
    else if (a === "der" && ops[sel].mover) ops[sel].mover(1);
    else if (a === "ok") { if (ops[sel].accion) { ops[sel].accion(); return; } if (ops[sel].mover) ops[sel].mover(1); }
    else if (a === "start") { cerrarMenu(); return; }
    SFX.clic();
    guardarAjustes();
    if (menuAbierto) pintarMenu();
  }

  /* ---------------------------------------------------------- teclado (respaldo) */
  addEventListener("keydown", (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (audio && audio.state === "suspended") audio.resume();
    if (k === "Tab" || e.altKey || e.ctrlKey || e.metaKey) { e.preventDefault(); return; }
    if (e.repeat) { e.preventDefault(); return; }
    const a = ["izq", "der", "arriba", "abajo", "ok"].find((x) => C.teclas[x].includes(k)) || (C.teclas.menu.includes(k) ? "start" : null);
    if (!a) return;
    e.preventDefault();
    if (menuAbierto) menuAccion(a); else accion(a);
  });

  /* ---------------------------------------------------------- control NES por USB
     Cada marca numera distinto sus botones, así que no dependemos de números:
       - Cruz: se lee como dirección (ejes, botones 12-15 del mapeo estándar
         o "sombrero" en un solo eje). ◀ ▶ ▲ ▼ son iguales en todos.
       - START (botón 9 en casi todos los controles USB; en controles de
         pocos botones, el último) = menú.
       - Cualquier otro botón (A, B, Select) = continuar.
  */
  let padNombre = "", ultimoBoton = "";
  function textoControl() {
    if (!padNombre) return "Control no detectado todavía: presiona cualquier botón del control";
    return "✓ Control conectado  ·  START abre el menú" + (ultimoBoton ? "  ·  último botón: " + ultimoBoton : "");
  }
  const previo = {};           // acciones activas en la lectura anterior, por control
  const ejeTrabado = {};       // ejes que se quedan fijos (gatillos): se ignoran
  function accionesDe(pad) {
    const act = new Set();
    const std = pad.mapping === "standard";
    const cruz = { 12: "arriba", 13: "abajo", 14: "izq", 15: "der" };
    const start = pad.buttons.length >= 10 ? 9 : pad.buttons.length - 1;
    pad.buttons.forEach((b, i) => {
      if (!b.pressed) return;
      act.add(std && cruz[i] ? cruz[i] : (i === start ? "start" : "ok"));
    });
    pad.axes.forEach((v, i) => {
      const id = pad.index + ":" + i;
      // "Sombrero" en un solo eje (algunos controles): valores escalonados, reposo > 1.
      if (i === 9 && pad.axes.length >= 10) {
        if (v > 1.1 || v < -1.1) return;
        const pos = Math.round((v + 1) / (2 / 7));   // 0 arriba, 2 derecha, 4 abajo, 6 izquierda
        act.add(["arriba", "arriba", "der", "abajo", "abajo", "abajo", "izq", "arriba"][pos] || "arriba");
        return;
      }
      if (Math.abs(v) < 0.5) { ejeTrabado[id] = 0; return; }
      // Un eje que marca lo mismo más de 5 s seguido es un gatillo o está suelto: se ignora.
      ejeTrabado[id] = (ejeTrabado[id] || performance.now());
      if (performance.now() - ejeTrabado[id] > 5000) return;
      if (i % 2 === 0) act.add(v < 0 ? "izq" : "der");
      else act.add(v < 0 ? "arriba" : "abajo");
    });
    return act;
  }
  (function leerControles() {
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
    if (pads.length && !padNombre) { padNombre = pads[0].id || "control"; if (estado === "inicio") pintarInicio(); }
    pads.forEach((pad) => {
      const ahora = accionesDe(pad), antes = previo[pad.index] || new Set();
      ahora.forEach((a) => {
        if (antes.has(a)) return;                 // solo cuenta al presionar, no al mantener
        if (audio && audio.state === "suspended") audio.resume();
        ultimoBoton = ICONO[a];
        if (menuAbierto) menuAccion(a); else accion(a);
        const pc = pantalla.querySelector(".p-control");
        if (pc && estado === "inicio") { pc.className = "p-control si"; pc.textContent = textoControl(); }
      });
      previo[pad.index] = ahora;
    });
    requestAnimationFrame(leerControles);
  })();

  /* ---------------------------------------------------------- arranque */
  window.STLS = { estado: () => estado, jugadores: pj, accion };   // para pruebas
  const fuentes = document.fonts ? document.fonts.ready : Promise.resolve();
  Promise.all([cargarBanco(), fuentes]).then(irInicio);
})();
