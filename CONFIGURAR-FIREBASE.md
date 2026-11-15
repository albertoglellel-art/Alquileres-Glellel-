# Cómo activar los datos compartidos (Firebase)

Con esto, toda la familia ve los mismos alquileres desde su celular:
3 personas pueden cargar y modificar, y 2 solo pueden ver.
Se hace **una sola vez** y lleva unos 15 minutos. Es gratis para este uso.

> Mientras no lo actives, la app sigue funcionando como siempre (datos solo en tu celular).

---

## 1. Crear el proyecto

1. Entrá a <https://console.firebase.google.com> con tu cuenta de Gmail.
2. **Crear un proyecto** → nombre: `alquileres-familia` → podés desactivar Google Analytics → **Crear**.

## 2. Activar el inicio de sesión con Google

1. Menú izquierdo: **Compilación → Authentication → Comenzar**.
2. Pestaña **Método de acceso** → **Google** → **Habilitar** → elegí tu mail de soporte → **Guardar**.
3. Pestaña **Configuración → Dominios autorizados → Agregar dominio** → escribí:
   `albertoglellel-art.github.io`

## 3. Crear la base de datos

1. Menú izquierdo: **Compilación → Firestore Database → Crear base de datos**.
2. Ubicación: `southamerica-east1 (São Paulo)` → **Siguiente**.
3. Elegí **Comenzar en modo de producción** → **Crear**.
4. Pestaña **Reglas**: borrá todo, pegá el contenido del archivo [`firestore.rules`](firestore.rules) de este repo y tocá **Publicar**.

## 4. Decir quién puede entrar

Todavía en **Firestore Database → Datos**:

1. **Iniciar colección** → ID de la colección: `config` → **Siguiente**.
2. ID del documento: `acceso`.
3. Agregá dos campos de tipo **array**:
   - `editores`: los 3 mails que pueden cargar y modificar (por ejemplo `albertoglellel@gmail.com`, …).
   - `lectores`: los 2 mails que solo pueden ver.
4. **Guardar**.

Los mails van **en minúscula** y deben ser cuentas de Google (Gmail).
Para sumar o sacar a alguien más adelante, se edita este mismo documento. Nadie puede cambiarlo desde la app.

## 5. Conectar la app con el proyecto

1. Ícono de engranaje ⚙️ (arriba a la izquierda) → **Configuración del proyecto**.
2. Abajo, en **Tus apps**, tocá el ícono **`</>`** (Web) → apodo: `alquileres` → **Registrar app** (no hace falta Hosting).
3. Te muestra un bloque `const firebaseConfig = { apiKey: ..., ... }`. Copialo.
4. En GitHub, abrí el archivo `firebase-config.js` de este repo → lápiz ✏️ para editar → reemplazá
   `window.FIREBASE_CONFIG = null;` por:

   ```js
   window.FIREBASE_CONFIG = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```

   con los valores que copiaste → **Commit changes**.

Estos datos **no son secretos** (identifican el proyecto, como una dirección). Lo que protege los datos son las reglas del paso 3.

## 6. Pasar los datos que ya tenés

1. Antes que nada, en tu celular tocá **Exportar backup (.json)** y guardá el archivo.
2. Abrí la app en **el mismo celular donde cargaste los alquileres** → **Entrar con Google** con tu mail de editor.
3. Va a aparecer: *"Este celular tiene N alquiler(es) cargados de antes. ¿Subirlos a la nube?"* → **Subir a la nube**.

Listo. Cada familiar abre el link de la app, entra con su Gmail y ve lo mismo.

---

## Qué ve cada uno

| | Editores (3) | Lectores (2) |
|---|---|---|
| Ver alquileres, meses, totales e histórico | ✅ | ✅ |
| Marcar pagos | ✅ | — |
| Agregar, editar o eliminar alquileres | ✅ | — |
| Aviso de "facturar" | ✅ | — |

Cuando alguien marca un pago, queda anotado quién fue: *"pagado el 15/11 (Alberto)"*.

## Si algo no anda

- **"La cuenta … todavía no tiene acceso"**: el mail no está en `config/acceso`, o está escrito con mayúsculas o con un error.
- **El botón "Entrar con Google" no hace nada en iPhone con la app instalada**: abrila una vez desde Safari, iniciá sesión ahí y después volvé a la app.
