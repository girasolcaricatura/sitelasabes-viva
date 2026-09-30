/* ============================================================
   ¿SÍ TE LA SABES? · versión web (GitHub Pages)
   Solo para jugar en una computadora o celular: agrega el mouse y
   el toque a los botones de abajo, y una ayuda de teclado.
   El juego (juego.js) es el mismo que corre en la Raspberry.
   ============================================================ */
(function () {
  "use strict";

  // En la Raspberry el cursor va oculto; aquí se necesita.
  const estilo = document.createElement("style");
  estilo.textContent = `
    html, body { cursor: default !important; }
    #ayuda .chip { cursor: pointer; transition: transform .1s; }
    #ayuda .chip:hover { transform: scale(1.04); }
    #ayuda .chip:active { transform: scale(.97); }
    #ayuda-web {
      position: fixed; left: 12px; top: 12px; z-index: 50; max-width: 360px; transition: opacity .6s;
      background: rgba(10,43,27,.95); color: #fff; border: 2px solid #7CF06A; border-radius: 14px;
      padding: 12px 38px 12px 14px; font: 600 13px/1.5 Arial, sans-serif;
    }
    #ayuda-web b { color: #7CF06A; }
    .p-control { display: none !important; }   /* el aviso del control USB no aplica en la web */
    #ayuda-web button {
      position: absolute; top: 6px; right: 8px; background: none; border: 0; color: #fff;
      font: 700 18px Arial, sans-serif; cursor: pointer;
    }`;
  document.head.appendChild(estilo);

  // Clic o toque en los botones de abajo = presionar ese botón del control.
  // Los botones dobles (◀▶, ▲▼) se dividen a la mitad.
  document.getElementById("ayuda").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip || !window.STLS) return;
    const r = chip.getBoundingClientRect();
    const mitadIzq = e.clientX < r.left + r.width / 2;
    const tipo = ["izq", "der", "arriba", "abajo", "ok", "izqder", "arribaabajo"].find((c) => chip.classList.contains(c));
    const accion = tipo === "izqder" ? (mitadIzq ? "izq" : "der")
                 : tipo === "arribaabajo" ? (mitadIzq ? "arriba" : "abajo")
                 : tipo;
    if (accion) window.STLS.accion(accion);
  });

  // Ayuda de teclado (se puede cerrar).
  const ayuda = document.createElement("div");
  ayuda.id = "ayuda-web";
  ayuda.innerHTML = "<button aria-label='Cerrar'>×</button>" +
    "<b>Cómo jugar en la compu</b><br>" +
    "Haz clic en los botones de abajo, o usa el teclado:<br>" +
    "<b>← →</b> quién contestó (jugador 1 / 2) · <b>Enter</b> continuar<br>" +
    "<b>↑</b> sí se la sabe · <b>↓</b> no se la sabe · <b>M</b> menú";
  const cerrar = () => { ayuda.style.opacity = "0"; setTimeout(() => ayuda.remove(), 600); };
  ayuda.querySelector("button").onclick = cerrar;
  setTimeout(cerrar, 20000);
  document.body.appendChild(ayuda);
})();
