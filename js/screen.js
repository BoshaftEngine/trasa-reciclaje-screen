import { MATERIALS } from "./materials.js?v=2";

import {
  loadFirebase,
  roomPath,
  isFirebaseConfigured
} from "./common.js";


const home =
  document.getElementById("homeView");

const res =
  document.getElementById("resultsView");

const grid =
  document.getElementById("materialGrid");


let db;
let dbMod;


/* ============================================================
   MOSTRAR PANTALLA PRINCIPAL
   ============================================================ */

function showHome() {

  home.classList.remove("hidden");
  res.classList.add("hidden");

  // Quitamos el modo compacto cuando volvemos al inicio
  res.classList.remove("compact-results");

}


/* ============================================================
   MOSTRAR RESULTADOS
   ============================================================ */

function showResults(values = {}) {

  grid.innerHTML = "";


  // Solo materiales con cantidad mayor que 0
  const visible =
    MATERIALS.filter(
      material =>
        Number(
          values[material.id] || 0
        ) > 0
    );


  // Si no hay materiales, volvemos al inicio
  if (!visible.length) {

    showHome();

    return;

  }


  /* ==========================================================
     MODO COMPACTO

     1 - 12 materiales:
     tamaño normal

     13 - 17 materiales:
     tamaño compacto para mantener 2 filas
     ========================================================== */

  res.classList.toggle(
    "compact-results",
    visible.length > 12
  );


  /* ==========================================================
     CREAR TARJETAS
     ========================================================== */

  for (const material of visible) {

    const quantity =
      Number(
        values[material.id] || 0
      );


    const card =
      document.createElement("div");

    card.className =
      "material-card";


    // IMAGEN

    const img =
      document.createElement("img");

    img.src =
      material.image;

    img.alt =
      material.name;


    // NOMBRE

    const name =
      document.createElement("div");

    name.className =
      "material-name";

    name.textContent =
      material.name;


    // CANTIDAD

    const qty =
      document.createElement("div");

    qty.className =
      "material-qty";

    // Ya no ponemos "u"
    qty.textContent =
      quantity;


    // Añadir elementos

    card.append(
      img,
      name,
      qty
    );


    grid.append(
      card
    );

  }


  // Mostrar resultados

  home.classList.add("hidden");
  res.classList.remove("hidden");

}


/* ============================================================
   HEARTBEAT

   Sirve para indicar en CONTROL si la pantalla GTA
   está conectada.
   ============================================================ */

async function heartbeat() {

  if (!db) {
    return;
  }


  try {

    await dbMod.update(
      dbMod.ref(
        db,
        roomPath("status")
      ),
      {
        online: true,
        updatedAt:
          dbMod.serverTimestamp()
      }
    );

  }
  catch {

    // Evitamos mostrar errores de heartbeat
    // continuamente en consola.

  }

}


/* ============================================================
   INICIAR
   ============================================================ */

async function init() {

  showHome();


  if (
    !isFirebaseConfigured()
  ) {

    return;

  }


  try {

    const firebase =
      await loadFirebase();


    db =
      firebase.db;

    dbMod =
      firebase.dbMod;


    // Autenticación anónima

    await firebase.authMod
      .signInAnonymously(
        firebase.auth
      );


    /* ========================================================
       ESCUCHAR CAMBIOS DE FIREBASE
       ======================================================== */

    dbMod.onValue(

      dbMod.ref(
        db,
        roomPath("display")
      ),

      snapshot => {

        const data =
          snapshot.val() || {};


        if (
          data.mode === "results"
        ) {

          showResults(
            data.materials || {}
          );

        }

        else {

          showHome();

        }

      }

    );


    /* ========================================================
       ESTADO DE CONEXIÓN
       ======================================================== */

    setInterval(
      heartbeat,
      3000
    );


    heartbeat();

  }

  catch (error) {

    console.error(
      error
    );

  }

}


init();
