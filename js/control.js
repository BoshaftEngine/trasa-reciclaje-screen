import {
  MATERIALS
} from "./materials.js?v=2";


import {
  loadFirebase,
  roomPath,
  isFirebaseConfigured
} from "./common.js";


/* ============================================================
   ELEMENTOS HTML
   ============================================================ */

const inputs =
  document.getElementById(
    "materialInputs"
  );


const showBtn =
  document.getElementById(
    "showResultsBtn"
  );


const updateBtn =
  document.getElementById(
    "updateResultsBtn"
  );


const homeBtn =
  document.getElementById(
    "homeBtn"
  );


const clearBtn =
  document.getElementById(
    "clearBtn"
  );


const dot =
  document.getElementById(
    "statusDot"
  );


const statusText =
  document.getElementById(
    "statusText"
  );


const uid =
  document.getElementById(
    "uidBox"
  );


const cfg =
  document.getElementById(
    "configError"
  );


const msg =
  document.getElementById(
    "message"
  );



/* ============================================================
   VARIABLES
   ============================================================ */

let db;

let dbMod;

let timer;



/* ============================================================
   MOSTRAR MENSAJES
   ============================================================ */

function flash(
  text,
  type = ""
) {

  clearTimeout(
    timer
  );


  msg.textContent =
    text;


  msg.className =
    `notice ${type}`.trim();


  msg.classList.remove(
    "hidden"
  );


  timer =
    setTimeout(
      () => {

        msg.classList.add(
          "hidden"
        );

      },
      3500
    );

}



/* ============================================================
   CREAR LISTA DE MATERIALES
   ============================================================ */

function build() {

  for (
    const material
    of MATERIALS
  ) {

    /* CONTENEDOR */

    const row =
      document.createElement(
        "div"
      );

    row.className =
      "material-row";


    /* IMAGEN */

    const image =
      document.createElement(
        "img"
      );

    image.src =
      material.image;


    /* NOMBRE */

    const label =
      document.createElement(
        "label"
      );

    label.htmlFor =
      `mat-${material.id}`;

    label.textContent =
      material.name;


    /* CANTIDAD */

    const input =
      document.createElement(
        "input"
      );

    input.type =
      "number";

    input.min =
      "0";

    input.step =
      "1";

    input.value =
      "0";

    input.id =
      `mat-${material.id}`;


    /* AÑADIR AL PANEL */

    row.append(
      image,
      label,
      input
    );


    inputs.append(
      row
    );

  }

}



/* ============================================================
   LEER CANTIDADES
   ============================================================ */

function values() {

  const result = {};


  for (
    const material
    of MATERIALS
  ) {

    const input =
      document.getElementById(
        `mat-${material.id}`
      );


    result[
      material.id
    ] =
      Math.max(
        0,
        Number(
          input.value
        ) || 0
      );

  }


  return result;

}



/* ============================================================
   PUBLICAR RESULTADOS
   ============================================================ */

async function publish() {

  if (!db) {
    return;
  }


  const materialValues =
    values();


  /* Comprobar que existe al menos un material */

  const hasMaterials =
    Object
      .values(
        materialValues
      )
      .some(
        value =>
          value > 0
      );


  if (!hasMaterials) {

    flash(
      "Introduce al menos una cantidad mayor que 0.",
      "error"
    );

    return;

  }


  try {

    await dbMod.set(

      dbMod.ref(
        db,
        roomPath(
          "display"
        )
      ),

      {

        mode:
          "results",

        materials:
          materialValues,

        updatedAt:
          dbMod.serverTimestamp()

      }

    );


    flash(
      "Resultado mostrado en pantalla.",
      "success"
    );

  }

  catch (error) {

    flash(
      `No se pudo actualizar: ${error.message}`,
      "error"
    );

  }

}



/* ============================================================
   VOLVER A PANTALLA PRINCIPAL
   ============================================================ */

async function home() {

  if (!db) {
    return;
  }


  try {

    await dbMod.set(

      dbMod.ref(
        db,
        roomPath(
          "display"
        )
      ),

      {

        mode:
          "home",

        updatedAt:
          dbMod.serverTimestamp()

      }

    );


    flash(
      "Pantalla principal restaurada.",
      "success"
    );

  }

  catch (error) {

    flash(
      error.message,
      "error"
    );

  }

}



/* ============================================================
   LIMPIAR CANTIDADES
   ============================================================ */

function clearAll() {

  for (
    const material
    of MATERIALS
  ) {

    document
      .getElementById(
        `mat-${material.id}`
      )
      .value =
        "0";

  }


  flash(
    "Cantidades limpiadas.",
    "success"
  );

}



/* ============================================================
   ESTADO DE LA PANTALLA GTA
   ============================================================ */

function renderStatus(
  status = {}
) {

  const online =

    status.online === true

    &&

    (
      Date.now()
      -
      (
        Number(
          status.updatedAt
        )
        || 0
      )
      <
      8000
    );


  dot.className =
    `dot ${
      online
        ? "ok"
        : "bad"
    }`;


  statusText.textContent =
    online
      ? "Pantalla GTA conectada"
      : "Pantalla desconectada";

}



/* ============================================================
   INICIAR
   ============================================================ */

async function init() {

  /* Crear materiales */

  build();


  /* Asignar botones */

  showBtn.onclick =
    publish;


  updateBtn.onclick =
    publish;


  homeBtn.onclick =
    home;


  clearBtn.onclick =
    clearAll;



  /* ==========================================================
     COMPROBAR FIREBASE
     ========================================================== */

  if (
    !isFirebaseConfigured()
  ) {

    cfg.textContent =
      "Configura Firebase en js/firebase-config.js y vuelve a cargar.";


    cfg.classList.remove(
      "hidden"
    );


    uid.textContent =
      "Firebase todavía no está configurado.";


    return;

  }



  /* ==========================================================
     CONECTAR FIREBASE
     ========================================================== */

  try {

    const firebase =
      await loadFirebase();


    db =
      firebase.db;


    dbMod =
      firebase.dbMod;



    /* AUTENTICACIÓN ANÓNIMA */

    const credential =
      await firebase
        .authMod
        .signInAnonymously(
          firebase.auth
        );


    uid.textContent =
      credential.user.uid;



    /* ========================================================
       ESCUCHAR ESTADO DE LA PANTALLA
       ======================================================== */

    dbMod.onValue(

      dbMod.ref(
        db,
        roomPath(
          "status"
        )
      ),

      snapshot => {

        renderStatus(
          snapshot.val()
          || {}
        );

      }

    );

  }

  catch (error) {

    cfg.textContent =
      `Error Firebase: ${error.message}`;


    cfg.classList.remove(
      "hidden"
    );


    uid.textContent =
      "No se pudo iniciar Firebase.";

  }

}



/* ============================================================
   ARRANCAR
   ============================================================ */

init();
