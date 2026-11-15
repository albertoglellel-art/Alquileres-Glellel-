// Datos del proyecto de Firebase (Consola de Firebase -> Configuracion del proyecto -> Tus apps -> App web).
// Estos datos NO son secretos: identifican el proyecto. La seguridad la dan las reglas de Firestore (firestore.rules).
//
// Mientras quede en null, la app funciona como antes: los datos quedan solo en este celular.
window.FIREBASE_CONFIG = null;

// Ejemplo de como queda completo:
// window.FIREBASE_CONFIG = {
//   apiKey: "AIza...",
//   authDomain: "alquileres-familia.firebaseapp.com",
//   projectId: "alquileres-familia",
//   storageBucket: "alquileres-familia.appspot.com",
//   messagingSenderId: "1234567890",
//   appId: "1:1234567890:web:abcdef"
// };
