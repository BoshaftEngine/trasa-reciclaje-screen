# TRASA · Pantalla de resultados de reciclaje

Sistema independiente del proyecto de música.

## Archivos principales
- `control.html`: panel del operario.
- `screen.html`: URL del proyector GTA.
- `assets/inicio.png`: imagen fija inicial.
- `assets/materiales/`: imágenes de los materiales.

## Materiales
- `acero.png` → Acero
- `aluminio.png` → Aluminio
- `arena.png` → Arena
- `madera.png` → Madera
- `caucho.png` → Caucho
- `silicona.png` → Silicona
- `componentes-electronicos.png` → Componentes electrónicos
- `cobre.png` → Cobre
- `plastico.png` → Plástico
- `titanio.png` → Titanio
- `fibra-carbono.png` → Fibra de carbono
- `platino.png` → Platino
- `tela.png` → Tela
- `litio.png` → Litio
- `vidrio.png` → Vidrio
- `oro.png` → Oro
- `piedra-caliza.png` → Piedra caliza

La lista contiene 17 materiales únicos; Platino estaba repetido y se ha dejado una sola vez.

## Tus imágenes
Sustituye `assets/inicio.png` y cada PNG de `assets/materiales/` manteniendo exactamente los nombres. No hace falta editar el código.

## Firebase
1. Crea una app Web.
2. Crea Realtime Database.
3. Activa Authentication → Anonymous.
4. Pega tu configuración en `js/firebase-config.js`.
5. Publica en GitHub Pages.
6. Abre `control.html`, copia el UID.
7. Sustituye `PEGA_AQUI_TU_UID_DE_CONTROL` en `firebase-rules.json`.
8. Pega esas reglas en Realtime Database → Rules → Publish.

## Uso
1. Introduce cantidades.
2. Pulsa **MOSTRAR MATERIALES**.
3. Solo se muestran materiales con cantidad > 0.
4. Modifica valores y pulsa **Actualizar resultado** si hace falta.
5. Pulsa **VOLVER A INICIO** al terminar.
6. Pulsa **Limpiar cantidades** para preparar el siguiente cliente.
