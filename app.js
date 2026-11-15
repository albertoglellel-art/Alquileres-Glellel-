(function () {
  'use strict';

  var STORAGE_KEY = 'alquileres-data';
  var MESES_NOMBRE = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  // ---------- Helpers ----------
  function monthKey(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
  }
  function addMonths(key, delta) {
    var parts = key.split('-').map(Number);
    var d = new Date(parts[0], parts[1] - 1 + delta, 1);
    return monthKey(d);
  }
  function formatMonthLabel(key) {
    var parts = key.split('-').map(Number);
    return MESES_NOMBRE[parts[1] - 1] + ' ' + parts[0];
  }
  function formatARS(n) {
    var num = Number(n) || 0;
    return '$' + Math.round(num).toLocaleString('es-AR');
  }
  // Acepta "150000", "150.000", "150.000,50", "$ 150.000"
  function parseMonto(valor) {
    var str = String(valor == null ? '' : valor).replace(/[\s$]/g, '');
    if (!str) return 0;
    if (str.indexOf(',') !== -1) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
      str = str.replace(/\./g, '');
    }
    var n = Number(str);
    return isFinite(n) ? n : 0;
  }
  // Fecha de hoy en hora local (toISOString usa UTC y despues de las 21 hs da el dia siguiente)
  function hoyISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function montoConIva(monto, conFactura) {
    var base = Number(monto) || 0;
    return conFactura ? base * 1.21 : base;
  }
  function formatFechaCorta(iso) {
    if (!iso) return '';
    var parts = iso.split('-');
    return parts[2] + '/' + parts[1];
  }
  function formatFechaLarga(iso) {
    if (!iso) return '';
    var parts = iso.split('-');
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }
  function diasHasta(fechaISO) {
    if (!fechaISO) return null;
    var hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    var objetivo = new Date(fechaISO + 'T00:00:00');
    return Math.round((objetivo - hoy) / 86400000);
  }
  function calcularEstado(mesKey, pagado, todayKey, todayDia) {
    if (pagado) return 'pagado';
    if (mesKey < todayKey) return 'vencido';
    if (mesKey > todayKey) return 'pendiente';
    return todayDia > 10 ? 'vencido' : 'pendiente';
  }
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function uid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return String(Date.now()) + Math.random().toString(16).slice(2);
  }

  var ESTADO_CONFIG = {
    pagado: { texto: 'PAGADO', color: 'var(--pagado)' },
    vencido: { texto: 'VENCIDO', color: 'var(--vencido)' },
    pendiente: { texto: 'PENDIENTE', color: 'var(--pendiente)' },
    parcial: { texto: 'PARCIAL', color: 'var(--pendiente)' }
  };
  var MEDIOS_PAGO = ['Transferencia', 'Efectivo', 'Otro'];
  var IPC_URL = 'https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&limit=40&sort=desc&format=json';

  function totalRegistro(r) { return montoConIva(r.monto, r.conFactura); }
  function sumaPagos(r) { return (r.pagos || []).reduce(function (s, p) { return s + (Number(p.monto) || 0); }, 0); }
  function cobradoRegistro(r) { return r.pagado ? totalRegistro(r) : Math.min(sumaPagos(r), totalRegistro(r)); }
  // Recalcula si el mes quedo pagado completo segun los pagos registrados
  function recalcularPagado(r) {
    if (!r.pagos || r.pagos.length === 0) return r;
    var completo = sumaPagos(r) >= totalRegistro(r) - 0.5;
    var ultimo = r.pagos[r.pagos.length - 1];
    return Object.assign({}, r, {
      pagado: completo,
      fechaPago: completo ? (r.fechaPago || ultimo.fecha) : null,
      marcadoPor: completo ? (r.marcadoPor || ultimo.por || null) : null
    });
  }
  function formatPct(n) { return (Math.round(n * 100) / 100).toLocaleString('es-AR'); }
  function numCSV(n) { return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).replace('.', ','); }
  function celdaCSV(v) {
    var str = String(v == null ? '' : v);
    return /[;"\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
  }
  function etiquetaInquilino(r) { return r.propiedad || r.nombre; }

  var ICON_CHEVRON_LEFT = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
  var ICON_CHEVRON_RIGHT = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
  var ICON_PLUS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
  var ICON_TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
  var ICON_X = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  var ICON_SEARCH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
  var ICON_DOWNLOAD = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>';
  var ICON_SUN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
  var ICON_MOON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
  var ICON_GEAR = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>';

  var LETRA_KEY = 'alquileres-letra';
  function aplicarLetra(grande) {
    document.documentElement.setAttribute('data-letra', grande ? 'grande' : 'normal');
    try { localStorage.setItem(LETRA_KEY, grande ? 'grande' : 'normal'); } catch (e) {}
  }

  var TEMA_KEY = 'alquileres-tema';
  function aplicarTema(tema) {
    document.documentElement.setAttribute('data-theme', tema);
    try { localStorage.setItem(TEMA_KEY, tema); } catch (e) {}
  }

  var GITHUB_CFG_KEY = 'alquileres-github-cfg';
  function cargarGithubCfg() {
    try {
      var raw = localStorage.getItem(GITHUB_CFG_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function guardarGithubCfgLocal(cfg) {
    try { localStorage.setItem(GITHUB_CFG_KEY, JSON.stringify(cfg)); } catch (e) {}
  }
  function borrarGithubCfgLocal() {
    try { localStorage.removeItem(GITHUB_CFG_KEY); } catch (e) {}
  }
  function utf8ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }
  async function verificarGithubCfg(cfg) {
    try {
      var res = await fetch('https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo, {
        headers: { 'Authorization': 'Bearer ' + cfg.token, 'Accept': 'application/vnd.github+json' }
      });
      if (res.status === 200) {
        var data = await res.json();
        if (data.private === false) return { ok: false, reason: 'ese repo es publico, usa uno privado' };
        return { ok: true };
      }
      if (res.status === 404) return { ok: false, reason: 'no encontrado (revisa usuario/repo o permisos del token)' };
      if (res.status === 401) return { ok: false, reason: 'token invalido' };
      return { ok: false, reason: 'HTTP ' + res.status };
    } catch (e) {
      return { ok: false, reason: e.message };
    }
  }
  async function subirBackupAGithub(jsonStr, cfg) {
    var path = 'backup.json';
    var apiUrl = 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' + path;
    var headers = { 'Authorization': 'Bearer ' + cfg.token, 'Accept': 'application/vnd.github+json' };
    try {
      var sha = null;
      var getRes = await fetch(apiUrl, { headers: headers });
      if (getRes.status === 200) {
        var getData = await getRes.json();
        sha = getData.sha;
      }
      var body = {
        message: 'Backup ' + new Date().toISOString().slice(0, 19).replace('T', ' '),
        content: utf8ToBase64(jsonStr)
      };
      if (sha) body.sha = sha;
      var putRes = await fetch(apiUrl, { method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: JSON.stringify(body) });
      if (putRes.ok) return { ok: true };
      var errData = await putRes.json().catch(function () { return {}; });
      return { ok: false, reason: errData.message || ('HTTP ' + putRes.status) };
    } catch (e) {
      return { ok: false, reason: e.message };
    }
  }

  // ---------- State ----------
  var state = {
    loading: true,
    errorGuardado: false,
    inquilinos: [],
    meses: {},
    mesActual: monthKey(new Date()),
    expandedId: null,
    confirmDeleteId: null,
    mostrarForm: false,
    nuevo: { nombre: '', propiedad: '', monto: '', conFactura: false, fechaIngreso: '', fechaFinContrato: '', ajusteCadaMeses: '', ultimoAjuste: '' },
    editBuffer: {},
    historialAbierto: null,
    busqueda: '',
    tema: document.documentElement.getAttribute('data-theme') || 'light',
    githubCfg: cargarGithubCfg(),
    mostrarConfigGithub: false,
    configBuffer: { owner: '', repo: '', token: '' },
    exportStatus: null,
    mostrarCalendario: false,
    calendarioAno: Number(monthKey(new Date()).split('-')[0]),
    filtroEstado: null,
    mostrarHistorico: false,
    deshacerEliminar: null,
    usuario: null,
    rol: null,
    errorNube: null,
    hayDatosLocalesParaSubir: 0,
    gastos: {},
    pagoBuffer: {},
    aumentoAbierto: null,
    aumentoPct: {},
    ipc: null,
    ipcEstado: null,
    letraGrande: document.documentElement.getAttribute('data-letra') === 'grande'
  };
  var deshacerTimeoutHandle = null;

  // ---------- Persistence ----------
  // Modo local: datos solo en este navegador (como antes).
  // Modo nube: si firebase-config.js tiene datos, todos comparten los mismos datos en Firestore.
  var CONFIG_NUBE = !!(window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey);
  var NUBE = CONFIG_NUBE && typeof firebase !== 'undefined';
  var db = null, docRef = null, auth = null, desuscribir = null;
  var ultimoSincronizado = { inquilinos: {}, meses: {}, gastos: {} };

  function puedeEditar() { return !NUBE || state.rol === 'editor'; }

  function clonar(obj) { return JSON.parse(JSON.stringify(obj || {})); }
  function estable(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(estable).join(',') + ']';
    return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + estable(v[k]); }).join(',') + '}';
  }
  function inquilinosAMapa(lista) {
    var m = {};
    lista.forEach(function (t) { m[t.id] = t; });
    return m;
  }
  function mapaAInquilinos(mapa) {
    return Object.keys(mapa || {}).map(function (id) { return Object.assign({}, mapa[id], { id: id }); });
  }

  function leerDatosLocales() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        return { inquilinos: parsed.inquilinos || [], meses: parsed.meses || {}, gastos: parsed.gastos || {} };
      }
    } catch (e) {}
    return { inquilinos: [], meses: {}, gastos: {} };
  }

  function cargarDatos() {
    var local = leerDatosLocales();
    state.inquilinos = local.inquilinos;
    state.meses = local.meses;
    state.gastos = local.gastos;
    state.loading = false;
  }

  // Compara lo ultimo que vino de la nube con el estado actual y devuelve solo los registros que cambiaron.
  // Asi, si dos personas cargan cosas distintas al mismo tiempo, no se pisan.
  function calcularCambios(prev, next) {
    var cambios = [];
    function comparar(base, a, b) {
      a = a || {}; b = b || {};
      Object.keys(Object.assign({}, a, b)).forEach(function (k) {
        if (!(k in b)) cambios.push({ path: base.concat([k]), valor: undefined });
        else if (!(k in a) || estable(a[k]) !== estable(b[k])) cambios.push({ path: base.concat([k]), valor: b[k] });
      });
    }
    comparar(['inquilinos'], prev.inquilinos, next.inquilinos);
    comparar(['gastos'], prev.gastos, next.gastos);
    var pm = prev.meses || {}, nm = next.meses || {};
    Object.keys(Object.assign({}, pm, nm)).forEach(function (mes) {
      if (!(mes in nm)) cambios.push({ path: ['meses', mes], valor: undefined });
      else if (!(mes in pm)) cambios.push({ path: ['meses', mes], valor: nm[mes] });
      else comparar(['meses', mes], pm[mes], nm[mes]);
    });
    return cambios;
  }

  function guardarDatos() {
    if (!NUBE) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ inquilinos: state.inquilinos, meses: state.meses, gastos: state.gastos }));
        state.errorGuardado = false;
      } catch (e) {
        state.errorGuardado = true;
      }
      return;
    }
    if (!puedeEditar() || !docRef) return;
    var actual = clonar({ inquilinos: inquilinosAMapa(state.inquilinos), meses: state.meses, gastos: state.gastos });
    var cambios = calcularCambios(ultimoSincronizado, actual);
    if (cambios.length === 0) return;
    ultimoSincronizado = actual;
    var args = [];
    cambios.forEach(function (c) {
      var fp = new (Function.prototype.bind.apply(firebase.firestore.FieldPath, [null].concat(c.path)))();
      args.push(fp);
      args.push(c.valor === undefined ? firebase.firestore.FieldValue.delete() : c.valor);
    });
    docRef.update.apply(docRef, args).then(function () {
      if (state.errorGuardado) { state.errorGuardado = false; render(); }
    }).catch(function () {
      state.errorGuardado = true;
      render();
    });
  }

  function aplicarSnapshot(snap) {
    var data = snap.exists ? clonar(snap.data()) : {};
    data.inquilinos = data.inquilinos || {};
    data.meses = data.meses || {};
    data.gastos = data.gastos || {};
    if (!snap.exists && state.rol === 'editor') {
      docRef.set({ inquilinos: {}, meses: {}, gastos: {} }, { merge: true }).catch(function () {});
    }
    ultimoSincronizado = clonar(data);
    state.inquilinos = mapaAInquilinos(data.inquilinos);
    state.meses = data.meses;
    state.gastos = data.gastos;
    state.loading = false;
    state.hayDatosLocalesParaSubir = 0;
    if (state.rol === 'editor' && state.inquilinos.length === 0) {
      state.hayDatosLocalesParaSubir = leerDatosLocales().inquilinos.length;
    }
    asegurarMes();
    render();
  }

  async function obtenerRol(email) {
    try {
      var snap = await db.collection('config').doc('acceso').get();
      if (!snap.exists) return 'sin-acceso';
      var d = snap.data() || {};
      var norm = function (l) { return (Array.isArray(l) ? l : []).map(function (e) { return String(e).toLowerCase().trim(); }); };
      if (norm(d.editores).indexOf(email) !== -1) return 'editor';
      if (norm(d.lectores).indexOf(email) !== -1) return 'lector';
      return 'sin-acceso';
    } catch (e) {
      return 'sin-acceso';
    }
  }

  function iniciarNube() {
    firebase.initializeApp(window.FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();
    try { db.enablePersistence({ synchronizeTabs: true }).catch(function () {}); } catch (e) {}
    docRef = db.collection('alquileres').doc('principal');
    auth.getRedirectResult().catch(function () {});
    auth.onAuthStateChanged(async function (user) {
      if (desuscribir) { desuscribir(); desuscribir = null; }
      state.inquilinos = [];
      state.meses = {};
      state.gastos = {};
      ultimoSincronizado = { inquilinos: {}, meses: {}, gastos: {} };
      state.errorNube = null;
      if (!user) {
        state.usuario = null;
        state.rol = null;
        state.loading = false;
        render();
        return;
      }
      state.usuario = { email: String(user.email || '').toLowerCase(), nombre: user.displayName || user.email || '' };
      state.loading = true;
      render();
      state.rol = await obtenerRol(state.usuario.email);
      if (state.rol === 'sin-acceso') { state.loading = false; render(); return; }
      desuscribir = docRef.onSnapshot(aplicarSnapshot, function () {
        state.loading = false;
        state.errorNube = 'No se pudieron leer los datos. Revisa la conexion o los permisos.';
        render();
      });
    });
  }

  function iniciarSesion() {
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    auth.signInWithPopup(provider).catch(function (e) {
      var code = e && e.code;
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        auth.signInWithRedirect(provider);
      } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        state.errorNube = 'No se pudo iniciar sesion: ' + (e && e.message ? e.message : code);
        render();
      }
    });
  }

  function primerNombre() {
    if (!state.usuario) return null;
    var n = (state.usuario.nombre || state.usuario.email).split(/[\s@]/)[0];
    return n || null;
  }

  // ---------- Derived ----------
  function registrosMes() {
    return state.meses[state.mesActual] || {};
  }

  function ultimoRegistroConMes(id, antesDe) {
    var claves = Object.keys(state.meses).filter(function (k) { return k < antesDe; }).sort().reverse();
    for (var i = 0; i < claves.length; i++) {
      var k = claves[i];
      if (state.meses[k] && state.meses[k][id]) return { mes: k, registro: state.meses[k][id] };
    }
    return null;
  }
  function ultimoRegistroConocido(id, antesDe) {
    var x = ultimoRegistroConMes(id, antesDe);
    return x ? x.registro : null;
  }

  // ---------- Aumentos por IPC ----------
  function baseAjuste(t) {
    return t.ultimoAjuste || (t.fechaIngreso ? t.fechaIngreso.slice(0, 7) : '');
  }
  function proximoAjuste(t) {
    var cada = Number(t.ajusteCadaMeses) || 0;
    var base = baseAjuste(t);
    if (!cada || !/^\d{4}-\d{2}$/.test(base)) return null;
    return addMonths(base, cada);
  }
  function ajusteVigente(t, mesKey) {
    var lista = (t.ajustes || []).filter(function (a) { return a.desde <= mesKey; });
    lista.sort(function (a, b) { return a.desde < b.desde ? -1 : 1; });
    return lista.length ? lista[lista.length - 1] : null;
  }
  function montoBaseAjuste(t, desde) {
    var prev = ultimoRegistroConocido(t.id, desde);
    return prev ? Number(prev.monto) : Number(t.monto);
  }
  function ipcAcumulado(meses) {
    var d = state.ipc;
    if (!d || d.length <= meses) return null;
    var ultimo = d[0], inicio = d[meses];
    return {
      pct: (ultimo[1] / inicio[1] - 1) * 100,
      desde: addMonths(inicio[0].slice(0, 7), 1),
      hasta: ultimo[0].slice(0, 7)
    };
  }
  function cargarIPC() {
    if (state.ipc || state.ipcEstado === 'cargando') return;
    state.ipcEstado = 'cargando';
    fetch(IPC_URL).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      var data = (j && j.data || []).filter(function (x) { return x && x[1] != null; });
      if (data.length < 2) throw new Error('sin datos');
      state.ipc = data;
      state.ipcEstado = 'ok';
    }).catch(function () {
      state.ipcEstado = 'error';
    }).then(render);
  }
  function pctSugerido(t) {
    var acum = ipcAcumulado(Number(t.ajusteCadaMeses) || 0);
    return acum ? String(Math.round(acum.pct * 100) / 100).replace('.', ',') : '';
  }
  function aplicarAumento(id) {
    var t = state.inquilinos.find(function (x) { return x.id === id; });
    if (!t) return;
    var desde = proximoAjuste(t);
    if (!desde) return;
    var pctStr = state.aumentoPct[id] != null ? state.aumentoPct[id] : pctSugerido(t);
    var pct = parseMonto(pctStr);
    if (!pct || pct <= 0) { alert('Carga el porcentaje de aumento.'); return; }
    var base = montoBaseAjuste(t, desde);
    var nuevo = Math.round(base * (1 + pct / 100));
    if (!confirm('Aplicar aumento de ' + formatPct(pct) + '% a ' + etiquetaInquilino(t) + '?\n' + formatARS(base) + ' -> ' + formatARS(nuevo) + ' desde ' + formatMonthLabel(desde) + '.')) return;
    state.inquilinos = state.inquilinos.map(function (x) {
      if (x.id !== id) return x;
      return Object.assign({}, x, {
        ultimoAjuste: desde,
        ajustes: (x.ajustes || []).concat([{ desde: desde, monto: nuevo, pct: Math.round(pct * 100) / 100, fecha: hoyISO(), por: primerNombre() }])
      });
    });
    state.meses = Object.assign({}, state.meses);
    Object.keys(state.meses).filter(function (k) { return k >= desde; }).forEach(function (k) {
      var r = state.meses[k][id];
      if (!r || r.pagado || (r.pagos && r.pagos.length)) return;
      state.meses[k] = Object.assign({}, state.meses[k]);
      state.meses[k][id] = Object.assign({}, r, { monto: nuevo });
    });
    state.aumentoAbierto = null;
    delete state.aumentoPct[id];
    guardarDatos();
    render();
  }

  function asegurarMes() {
    if (state.meses[state.mesActual]) return;
    if (state.inquilinos.length === 0) return;
    var nuevoRegistro = {};
    state.inquilinos.forEach(function (t) {
      var previoInfo = ultimoRegistroConMes(t.id, state.mesActual);
      var previo = previoInfo ? previoInfo.registro : null;
      var monto = previo ? previo.monto : t.monto;
      var aj = ajusteVigente(t, state.mesActual);
      if (aj && (!previoInfo || previoInfo.mes < aj.desde)) monto = aj.monto;
      nuevoRegistro[t.id] = {
        nombre: t.nombre,
        propiedad: t.propiedad,
        monto: monto,
        conFactura: previo ? !!previo.conFactura : !!t.conFactura,
        pagado: false,
        fechaPago: null,
        pagos: [],
        facturado: false
      };
    });
    state.meses = Object.assign({}, state.meses);
    state.meses[state.mesActual] = nuevoRegistro;
    guardarDatos();
  }

  function getHoy() {
    var hoy = new Date();
    return { hoy: hoy, todayKey: monthKey(hoy), todayDia: hoy.getDate() };
  }

  function primerDiaHabil(anio, mesUno) {
    var d = new Date(anio, mesUno - 1, 1);
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1);
    }
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function tenantesConFacturaDelMes(mesKey) {
    var registros = state.meses[mesKey] || {};
    return Object.keys(registros).map(function (id) { return Object.assign({ id: id }, registros[id]); }).filter(function (r) { return r.conFactura; });
  }

  function getFilas() {
    var h = getHoy();
    var rm = registrosMes();
    var filas = Object.keys(rm).map(function (id) {
      var r = rm[id];
      var estado = calcularEstado(state.mesActual, r.pagado, h.todayKey, h.todayDia);
      if (estado !== 'pagado' && sumaPagos(r) > 0) estado = 'parcial';
      return Object.assign({ id: id }, r, { estado: estado });
    });
    var orden = { vencido: 0, parcial: 1, pendiente: 2, pagado: 3 };
    filas.sort(function (a, b) {
      return (orden[a.estado] - orden[b.estado]) || a.nombre.localeCompare(b.nombre);
    });
    return filas;
  }

  function getFilasFiltradas(filas) {
    var q = state.busqueda.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter(function (f) {
      return f.nombre.toLowerCase().indexOf(q) !== -1 || (f.propiedad || '').toLowerCase().indexOf(q) !== -1;
    });
  }

  function aplicarFiltroEstado(filas) {
    if (!state.filtroEstado) return filas;
    if (state.filtroEstado === 'pagado') return filas.filter(function (f) { return f.estado === 'pagado'; });
    if (state.filtroEstado === 'pendiente') return filas.filter(function (f) { return f.estado !== 'pagado'; });
    return filas;
  }

  function getTotales(filas) {
    var totalACobrar = filas.reduce(function (s, f) { return s + montoConIva(f.monto, f.conFactura); }, 0);
    var totalCobrado = filas.reduce(function (s, f) { return s + cobradoRegistro(f); }, 0);
    return { totalACobrar: totalACobrar, totalCobrado: totalCobrado, totalPendiente: totalACobrar - totalCobrado };
  }

  function historicoMensual() {
    var claves = Object.keys(state.meses).sort();
    return claves.map(function (k) {
      var registros = state.meses[k] || {};
      var lista = Object.keys(registros).map(function (id) { return registros[id]; });
      var totalACobrar = lista.reduce(function (s, r) { return s + montoConIva(r.monto, r.conFactura); }, 0);
      var totalCobrado = lista.reduce(function (s, r) { return s + cobradoRegistro(r); }, 0);
      return { mes: k, totalCobrado: totalCobrado, totalPendiente: totalACobrar - totalCobrado };
    });
  }

  function totalesAnio(anio) {
    var claves = Object.keys(state.meses).filter(function (k) { return k.indexOf(anio + '-') === 0; });
    var totalCobrado = 0;
    claves.forEach(function (k) {
      var registros = state.meses[k] || {};
      Object.keys(registros).forEach(function (id) {
        var r = registros[id];
        totalCobrado += cobradoRegistro(r);
      });
    });
    return { totalCobrado: totalCobrado };
  }

  function historialMontos(id) {
    var claves = Object.keys(state.meses).filter(function (k) { return state.meses[k] && state.meses[k][id]; }).sort();
    var historial = [];
    var anterior = null;
    claves.forEach(function (k) {
      var m = state.meses[k][id].monto;
      if (m !== anterior) {
        historial.push({ mes: k, monto: m });
        anterior = m;
      }
    });
    return historial;
  }

  function mesesPosteriores(mesKey) {
    return Object.keys(state.meses).filter(function (k) { return k > mesKey; });
  }

  // ---------- Mutations ----------
  function actualizarRegistro(id, fn) {
    var rm = registrosMes();
    if (!rm[id]) return;
    var nextRm = Object.assign({}, rm);
    nextRm[id] = fn(rm[id]);
    state.meses = Object.assign({}, state.meses);
    state.meses[state.mesActual] = nextRm;
    guardarDatos();
    render();
  }

  function togglePagado(id) {
    var registro = registrosMes()[id];
    if (!registro) return;
    if (registro.pagado) {
      actualizarRegistro(id, function (r) { return Object.assign({}, r, { pagado: false, fechaPago: null, marcadoPor: null, pagos: [] }); });
    } else {
      registrarPago(id, totalRegistro(registro) - cobradoRegistro(registro), '', '');
    }
  }

  function registrarPago(id, monto, medio, nota) {
    if (!monto || monto <= 0) return;
    actualizarRegistro(id, function (r) {
      var pagos = (r.pagos || []).concat([{ monto: Math.round(monto * 100) / 100, fecha: hoyISO(), medio: medio || '', nota: nota || '', por: primerNombre() }]);
      return recalcularPagado(Object.assign({}, r, { pagos: pagos, fechaPago: null, marcadoPor: null }));
    });
  }

  function eliminarPago(id, idx) {
    actualizarRegistro(id, function (r) {
      var pagos = (r.pagos || []).slice();
      pagos.splice(idx, 1);
      var next = Object.assign({}, r, { pagos: pagos, fechaPago: null, marcadoPor: null });
      if (pagos.length === 0) return Object.assign(next, { pagado: false });
      return recalcularPagado(next);
    });
  }

  function marcarFacturado(id, valor) {
    actualizarRegistro(id, function (r) { return Object.assign({}, r, { facturado: !!valor }); });
  }

  function abrirEdicion(fila) {
    var inquilino = state.inquilinos.find(function (t) { return t.id === fila.id; });
    state.editBuffer[fila.id] = {
      nombre: fila.nombre,
      propiedad: fila.propiedad || '',
      monto: String(fila.monto),
      conFactura: !!fila.conFactura,
      fechaIngreso: (inquilino && inquilino.fechaIngreso) || '',
      fechaFinContrato: (inquilino && inquilino.fechaFinContrato) || '',
      ajusteCadaMeses: inquilino && inquilino.ajusteCadaMeses ? String(inquilino.ajusteCadaMeses) : '',
      ultimoAjuste: (inquilino && inquilino.ultimoAjuste) || ''
    };
    state.expandedId = state.expandedId === fila.id ? null : fila.id;
    state.confirmDeleteId = null;
    render();
  }

  function guardarEdicion(id) {
    var buf = state.editBuffer[id];
    if (!buf) { state.expandedId = null; render(); return; }
    var montoNum = parseMonto(buf.monto);
    if (!buf.nombre || !buf.nombre.trim() || !montoNum || montoNum <= 0) return;
    var rm = registrosMes();
    var registro = rm[id];
    var actualizado = recalcularPagado(Object.assign({}, registro, { nombre: buf.nombre.trim(), propiedad: buf.propiedad.trim(), monto: montoNum, conFactura: !!buf.conFactura }));
    var nextRm = Object.assign({}, rm);
    nextRm[id] = actualizado;
    state.meses = Object.assign({}, state.meses);
    state.meses[state.mesActual] = nextRm;
    // Si ya existen meses posteriores (por haberlos visitado), actualizar los que siguen sin cobrar
    mesesPosteriores(state.mesActual).forEach(function (k) {
      var r = state.meses[k][id];
      if (!r || r.pagado) return;
      state.meses[k] = Object.assign({}, state.meses[k]);
      state.meses[k][id] = recalcularPagado(Object.assign({}, r, { nombre: actualizado.nombre, propiedad: actualizado.propiedad, monto: montoNum, conFactura: actualizado.conFactura }));
    });
    state.inquilinos = state.inquilinos.map(function (t) {
      if (t.id !== id) return t;
      return Object.assign({}, t, {
        nombre: actualizado.nombre,
        propiedad: actualizado.propiedad,
        monto: montoNum,
        conFactura: actualizado.conFactura,
        fechaIngreso: buf.fechaIngreso || '',
        fechaFinContrato: buf.fechaFinContrato || '',
        ajusteCadaMeses: Number(buf.ajusteCadaMeses) || 0,
        ultimoAjuste: buf.ultimoAjuste || ''
      });
    });
    guardarDatos();
    state.expandedId = null;
    render();
  }

  function eliminarInquilino(id) {
    var inquilinoBorrado = state.inquilinos.find(function (t) { return t.id === id; });
    var registroBorrado = registrosMes()[id];
    state.inquilinos = state.inquilinos.filter(function (t) { return t.id !== id; });
    var nextRm = Object.assign({}, registrosMes());
    delete nextRm[id];
    state.meses = Object.assign({}, state.meses);
    state.meses[state.mesActual] = nextRm;
    var posterioresBorrados = {};
    mesesPosteriores(state.mesActual).forEach(function (k) {
      var r = state.meses[k][id];
      if (!r || r.pagado) return;
      posterioresBorrados[k] = r;
      state.meses[k] = Object.assign({}, state.meses[k]);
      delete state.meses[k][id];
    });
    guardarDatos();
    state.confirmDeleteId = null;
    state.expandedId = null;
    state.deshacerEliminar = { id: id, inquilino: inquilinoBorrado, registro: registroBorrado, mes: state.mesActual, posteriores: posterioresBorrados };
    render();
    clearTimeout(deshacerTimeoutHandle);
    deshacerTimeoutHandle = setTimeout(function () { state.deshacerEliminar = null; render(); }, 6000);
  }

  function deshacerUltimaEliminacion() {
    var d = state.deshacerEliminar;
    if (!d || !d.inquilino) { state.deshacerEliminar = null; render(); return; }
    state.inquilinos = state.inquilinos.concat([d.inquilino]);
    var nextRm = Object.assign({}, state.meses[d.mes] || {});
    if (d.registro) nextRm[d.id] = d.registro;
    state.meses = Object.assign({}, state.meses);
    state.meses[d.mes] = nextRm;
    Object.keys(d.posteriores || {}).forEach(function (k) {
      if (!state.meses[k]) return;
      state.meses[k] = Object.assign({}, state.meses[k]);
      state.meses[k][d.id] = d.posteriores[k];
    });
    guardarDatos();
    state.deshacerEliminar = null;
    clearTimeout(deshacerTimeoutHandle);
    render();
  }

  function agregarInquilino() {
    var montoNum = parseMonto(state.nuevo.monto);
    if (!state.nuevo.nombre.trim() || !montoNum || montoNum <= 0) return;
    var id = uid();
    var nuevoInquilino = {
      id: id,
      nombre: state.nuevo.nombre.trim(),
      propiedad: state.nuevo.propiedad.trim(),
      monto: montoNum,
      conFactura: !!state.nuevo.conFactura,
      fechaIngreso: state.nuevo.fechaIngreso || '',
      fechaFinContrato: state.nuevo.fechaFinContrato || '',
      ajusteCadaMeses: Number(state.nuevo.ajusteCadaMeses) || 0,
      ultimoAjuste: state.nuevo.ultimoAjuste || (state.nuevo.fechaIngreso ? state.nuevo.fechaIngreso.slice(0, 7) : '')
    };
    state.inquilinos = state.inquilinos.concat([nuevoInquilino]);
    var nextRm = Object.assign({}, registrosMes());
    nextRm[id] = { nombre: nuevoInquilino.nombre, propiedad: nuevoInquilino.propiedad, monto: montoNum, conFactura: nuevoInquilino.conFactura, pagado: false, fechaPago: null, pagos: [], facturado: false };
    state.meses = Object.assign({}, state.meses);
    state.meses[state.mesActual] = nextRm;
    // Si ya existen meses posteriores, el nuevo inquilino tambien tiene que aparecer ahi
    mesesPosteriores(state.mesActual).forEach(function (k) {
      state.meses[k] = Object.assign({}, state.meses[k]);
      state.meses[k][id] = Object.assign({}, nextRm[id]);
    });
    guardarDatos();
    state.nuevo = { nombre: '', propiedad: '', monto: '', conFactura: false, fechaIngreso: '', fechaFinContrato: '', ajusteCadaMeses: '', ultimoAjuste: '' };
    state.mostrarForm = false;
    render();
  }

  async function exportarDatos() {
    var payload = { inquilinos: state.inquilinos, meses: state.meses, gastos: state.gastos, exportadoEl: new Date().toISOString() };
    var jsonStr = JSON.stringify(payload, null, 2);

    var blob = new Blob([jsonStr], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'alquileres-backup-' + monthKey(new Date()) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (state.githubCfg) {
      state.exportStatus = { tipo: 'cargando', mensaje: 'Subiendo a GitHub...' };
      render();
      var resultado = await subirBackupAGithub(jsonStr, state.githubCfg);
      state.exportStatus = resultado.ok
        ? { tipo: 'ok', mensaje: 'Backup actualizado en GitHub.' }
        : { tipo: 'error', mensaje: 'No se pudo subir: ' + resultado.reason };
      render();
      setTimeout(function () { state.exportStatus = null; render(); }, 5000);
    }
  }

  function importarDatos(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== 'object') throw new Error('formato invalido');
        state.inquilinos = Array.isArray(parsed.inquilinos) ? parsed.inquilinos : [];
        state.meses = (parsed.meses && typeof parsed.meses === 'object') ? parsed.meses : {};
        state.gastos = (parsed.gastos && typeof parsed.gastos === 'object') ? parsed.gastos : {};
        guardarDatos();
        asegurarMes();
        render();
        alert('Backup importado correctamente.');
      } catch (e) {
        alert('No pude leer ese archivo. ¿Es un backup exportado desde la app?');
      }
    };
    reader.readAsText(file);
  }

  function descargarArchivo(contenido, nombre, tipo) {
    var blob = new Blob([contenido], { type: tipo });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // Exporta un CSV con ";" y coma decimal: Excel en espanol lo abre directo en columnas
  function exportarExcel(alcance) {
    var anio = state.mesActual.split('-')[0];
    var meses = alcance === 'anio'
      ? Object.keys(state.meses).filter(function (k) { return k.indexOf(anio + '-') === 0; }).sort()
      : [state.mesActual];
    var filas = [['Mes', 'Propiedad', 'Inquilino', 'Neto', 'IVA', 'Total', 'Cobrado', 'Falta', 'Estado', 'Facturado', 'Detalle de pagos']];
    var tNeto = 0, tIva = 0, tTotal = 0, tCobrado = 0;
    meses.forEach(function (k) {
      var rm = state.meses[k] || {};
      Object.keys(rm).forEach(function (id) {
        var r = rm[id];
        var neto = Number(r.monto) || 0;
        var iva = r.conFactura ? neto * 0.21 : 0;
        var total = neto + iva;
        var cobrado = cobradoRegistro(r);
        tNeto += neto; tIva += iva; tTotal += total; tCobrado += cobrado;
        var detalle = (r.pagos || []).map(function (p) {
          return formatFechaLarga(p.fecha) + ' ' + formatARS(p.monto) + (p.medio ? ' ' + p.medio : '') + (p.nota ? ' (' + p.nota + ')' : '') + (p.por ? ' - ' + p.por : '');
        }).join(' | ');
        if (!detalle && r.pagado) detalle = 'Pagado ' + formatFechaLarga(r.fechaPago);
        var estado = r.pagado ? 'Pagado' : (sumaPagos(r) > 0 ? 'Parcial' : 'Pendiente');
        filas.push([formatMonthLabel(k), r.propiedad || '', r.nombre, numCSV(neto), numCSV(iva), numCSV(total), numCSV(cobrado), numCSV(total - cobrado), estado, r.conFactura ? (r.facturado ? 'Si' : 'No') : '-', detalle]);
      });
    });
    filas.push([]);
    filas.push(['Totales', '', '', numCSV(tNeto), numCSV(tIva), numCSV(tTotal), numCSV(tCobrado), numCSV(tTotal - tCobrado)]);
    var csv = '\ufeff' + filas.map(function (f) { return f.map(celdaCSV).join(';'); }).join('\r\n');
    descargarArchivo(csv, 'alquileres-' + (alcance === 'anio' ? anio : state.mesActual) + '.csv', 'text/csv;charset=utf-8');
  }

  function textoResumen() {
    var filas = getFilas();
    var tot = getTotales(filas);
    var pct = tot.totalACobrar > 0 ? Math.round((tot.totalCobrado / tot.totalACobrar) * 100) : 0;
    var lineas = ['*Alquileres ' + formatMonthLabel(state.mesActual) + '*', 'Cobrado: ' + formatARS(tot.totalCobrado) + ' de ' + formatARS(tot.totalACobrar) + ' (' + pct + '%)'];
    var pendientes = filas.filter(function (f) { return f.estado !== 'pagado'; });
    if (pendientes.length) {
      lineas.push('', 'Falta cobrar:');
      pendientes.forEach(function (f) {
        var extra = f.estado === 'vencido' ? ' (vencido)' : (f.estado === 'parcial' ? ' (pago una parte)' : '');
        lineas.push('- ' + etiquetaInquilino(f) + ': ' + formatARS(totalRegistro(f) - cobradoRegistro(f)) + extra);
      });
    }
    var pagados = filas.filter(function (f) { return f.estado === 'pagado'; });
    if (pagados.length) {
      lineas.push('', 'Pagaron:');
      pagados.forEach(function (f) { lineas.push('- ' + etiquetaInquilino(f)); });
    }
    return lineas.join('\n');
  }

  function compartirResumen() {
    var texto = textoResumen();
    if (navigator.share) {
      navigator.share({ text: texto }).catch(function () {});
    } else {
      window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
    }
  }

  // ---------- Rendering ----------
  var appEl = document.getElementById('app');

  function renderSello(estado) {
    var cfg = ESTADO_CONFIG[estado];
    return '<div class="sello" style="color:' + cfg.color + ';border-color:' + cfg.color + '">' + cfg.texto + '</div>';
  }

  function renderRow(fila) {
    var inquilino = state.inquilinos.find(function (t) { return t.id === fila.id; });
    var diasFin = inquilino ? diasHasta(inquilino.fechaFinContrato) : null;
    var mostrarAviso = diasFin !== null && diasFin <= 60;
    var avisoHtml = '';
    if (mostrarAviso) {
      var color = diasFin < 15 ? 'var(--vencido)' : 'var(--pendiente)';
      var texto = diasFin < 0
        ? ('Contrato vencido el ' + formatFechaLarga(inquilino.fechaFinContrato))
        : ('Contrato vence el ' + formatFechaLarga(inquilino.fechaFinContrato) + ' (en ' + diasFin + ' dias)');
      avisoHtml = '<div class="row-warning" style="color:' + color + '">' + escapeHtml(texto) + '</div>';
    }
    var subLine = (fila.propiedad ? escapeHtml(fila.nombre) + ' &middot; ' : '') +
      formatARS(totalRegistro(fila)) + (fila.conFactura ? ' IVA incl.' : '') +
      (fila.estado === 'pagado' && fila.fechaPago ? ' &middot; pagado el ' + formatFechaCorta(fila.fechaPago) + (fila.marcadoPor ? ' (' + escapeHtml(fila.marcadoPor) + ')' : '') : '') +
      (fila.estado === 'parcial' ? ' &middot; falta ' + formatARS(totalRegistro(fila) - cobradoRegistro(fila)) : '');

    var html = '';
    html += '<div class="row">';
    var editable = puedeEditar();
    html += '  <div class="row-summary' + (editable ? '' : ' solo-lectura') + '"' + (editable ? ' data-action="abrir-edicion" data-id="' + fila.id + '"' : '') + '>';
    html += '    <div class="row-main">';
    html += '      <div class="row-title">' + escapeHtml(fila.propiedad || fila.nombre) + '</div>';
    html += '      <div class="row-sub">' + subLine + '</div>';
    html += avisoHtml;
    html += '    </div>';
    if (editable) {
      html += '    <button type="button" class="sello-btn" data-action="toggle-pagado" data-id="' + fila.id + '" aria-label="Cambiar estado de pago">' + renderSello(fila.estado) + '</button>';
    } else {
      html += '    <div class="sello-btn">' + renderSello(fila.estado) + '</div>';
    }
    html += '  </div>';
    if (state.expandedId === fila.id) {
      html += renderEditPanel(fila);
    }
    html += '</div>';
    return html;
  }

  function renderEditPanel(fila) {
    var buf = state.editBuffer[fila.id] || {};
    var confactura = !!buf.conFactura;
    var montoNum = parseMonto(buf.monto);
    var ivaHtml = (confactura && montoNum > 0)
      ? '<div class="iva-hint">Total con IVA: ' + formatARS(montoNum * 1.21) + '</div>'
      : '';
    var historialOpen = state.historialAbierto === fila.id;
    var historialHtml = '';
    if (historialOpen) {
      var hist = historialMontos(fila.id);
      var items = '';
      if (hist.length === 0) {
        items = '<div class="historial-item">Sin historial todavia.</div>';
      } else {
        items = hist.map(function (h, i) {
          var variacion = null;
          if (i > 0) variacion = Math.round(((h.monto - hist[i - 1].monto) / hist[i - 1].monto) * 100);
          var pct = variacion !== null ? ' (' + (variacion > 0 ? '+' : '') + variacion + '%)' : '';
          return '<div class="historial-item">' + escapeHtml(formatMonthLabel(h.mes)) + ': ' + formatARS(h.monto) + pct + '</div>';
        }).join('');
      }
      historialHtml = '<div class="historial-list">' + items + '</div>';
    }
    var deleteAreaHtml;
    if (state.confirmDeleteId === fila.id) {
      deleteAreaHtml = '<div class="confirm-row"><span>&iquest;Eliminar?</span>' +
        '<button type="button" class="text-btn" style="color:var(--vencido)" data-action="confirmar-eliminar" data-id="' + fila.id + '">Si</button>' +
        '<button type="button" class="text-btn muted-btn" data-action="cancelar-eliminar">No</button></div>';
    } else {
      deleteAreaHtml = '<button type="button" class="text-btn delete-btn" data-action="pedir-eliminar" data-id="' + fila.id + '">' + ICON_TRASH + ' Eliminar</button>';
    }

    var registroMes = registrosMes()[fila.id] || {};
    var html = '';
    html += '<div class="edit-panel">';
    html += '  <div class="edit-inner">';
    html += renderPagosPanel(fila.id, registroMes);
    if (registroMes.conFactura) {
      html += '    <div class="field-label" style="margin-top:4px">Factura de ' + escapeHtml(formatMonthLabel(state.mesActual)) + '</div>';
      html += '    <div class="toggle-row">';
      html += '      <button type="button" class="toggle-btn' + (!registroMes.facturado ? ' active' : '') + '" data-action="facturado-set" data-id="' + fila.id + '" data-value="false">Sin emitir</button>';
      html += '      <button type="button" class="toggle-btn' + (registroMes.facturado ? ' active' : '') + '" data-action="facturado-set" data-id="' + fila.id + '" data-value="true">Emitida</button>';
      html += '    </div>';
    }
    html += '    <div class="seccion-label">Datos del alquiler</div>';
    html += '    <input type="text" placeholder="Propiedad / unidad (opcional)" value="' + escapeHtml(buf.propiedad || '') + '" data-scope="edit" data-id="' + fila.id + '" data-field="propiedad" data-focus-key="edit-' + fila.id + '-propiedad">';
    html += '    <input type="text" placeholder="Nombre del inquilino" value="' + escapeHtml(buf.nombre || '') + '" data-scope="edit" data-id="' + fila.id + '" data-field="nombre" data-focus-key="edit-' + fila.id + '-nombre">';
    html += '    <div class="field-2col">';
    html += '      <div><div class="field-label">Ingreso</div><input type="date" value="' + escapeHtml(buf.fechaIngreso || '') + '" data-scope="edit" data-id="' + fila.id + '" data-field="fechaIngreso" data-focus-key="edit-' + fila.id + '-fechaIngreso"></div>';
    html += '      <div><div class="field-label">Fin contrato</div><input type="date" value="' + escapeHtml(buf.fechaFinContrato || '') + '" data-scope="edit" data-id="' + fila.id + '" data-field="fechaFinContrato" data-focus-key="edit-' + fila.id + '-fechaFinContrato"></div>';
    html += '    </div>';
    html += '    <input type="text" inputmode="decimal" placeholder="Monto mensual (ej: 450.000)" value="' + escapeHtml(buf.monto || '') + '" data-scope="edit" data-id="' + fila.id + '" data-field="monto" data-focus-key="edit-' + fila.id + '-monto">';
    html += '    <div class="toggle-row">';
    html += '      <button type="button" class="toggle-btn' + (!confactura ? ' active' : '') + '" data-action="factura-edit" data-id="' + fila.id + '" data-value="false">Sin factura</button>';
    html += '      <button type="button" class="toggle-btn' + (confactura ? ' active' : '') + '" data-action="factura-edit" data-id="' + fila.id + '" data-value="true">Con factura (+21% IVA)</button>';
    html += '    </div>';
    html += ivaHtml;
    html += renderCamposAjuste('edit', ' data-id="' + fila.id + '"', buf, 'edit-' + fila.id + '-');
    html += '    <button type="button" class="historial-toggle" data-action="toggle-historial" data-id="' + fila.id + '">' + (historialOpen ? 'Ocultar historial de montos' : 'Ver historial de montos') + '</button>';
    html += historialHtml;
    html += '    <div class="row-actions">';
    html += deleteAreaHtml;
    html += '      <div style="display:flex;align-items:center;gap:12px">';
    html += '        <button type="button" class="text-btn muted-btn" data-action="cancelar-edicion">Cancelar</button>';
    html += '        <button type="button" class="text-btn save-btn" data-action="guardar-edicion" data-id="' + fila.id + '">Guardar</button>';
    html += '      </div>';
    html += '    </div>';
    html += '  </div>';
    html += '</div>';
    return html;
  }

  function renderCamposAjuste(scope, idAttr, valores, focusPrefix) {
    var ops = [['', 'Sin aumento'], ['3', 'Cada 3 meses'], ['4', 'Cada 4 meses'], ['6', 'Cada 6 meses'], ['12', 'Cada 12 meses']];
    var actual = String(valores.ajusteCadaMeses || '');
    var html = '';
    html += '    <div class="field-2col">';
    html += '      <div><div class="field-label">Aumento IPC</div><select data-scope="' + scope + '"' + idAttr + ' data-field="ajusteCadaMeses" data-focus-key="' + focusPrefix + 'ajusteCadaMeses">' +
      ops.map(function (o) { return '<option value="' + o[0] + '"' + (actual === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>';
    html += '      <div><div class="field-label">Ultimo aumento</div><input type="month" placeholder="AAAA-MM" value="' + escapeHtml(valores.ultimoAjuste || '') + '" data-scope="' + scope + '"' + idAttr + ' data-field="ultimoAjuste" data-focus-key="' + focusPrefix + 'ultimoAjuste"></div>';
    html += '    </div>';
    return html;
  }

  function renderPagosPanel(id, r) {
    var total = totalRegistro(r);
    var cobrado = cobradoRegistro(r);
    var falta = Math.max(0, total - cobrado);
    var buf = state.pagoBuffer[id] || { monto: '', medio: '', nota: '' };
    var html = '<div class="pagos-panel">';
    html += '<div class="field-label">Pagos de ' + escapeHtml(formatMonthLabel(state.mesActual)) + '</div>';
    (r.pagos || []).forEach(function (p, i) {
      var detalle = formatFechaCorta(p.fecha) + ' &middot; ' + formatARS(p.monto) +
        (p.medio ? ' &middot; ' + escapeHtml(p.medio) : '') +
        (p.nota ? ' &middot; ' + escapeHtml(p.nota) : '') +
        (p.por ? ' (' + escapeHtml(p.por) + ')' : '');
      html += '<div class="pago-item"><span>' + detalle + '</span><button type="button" class="icon-plain-btn" data-action="eliminar-pago" data-id="' + id + '" data-idx="' + i + '" aria-label="Borrar pago">' + ICON_X + '</button></div>';
    });
    if (r.pagado && !(r.pagos && r.pagos.length)) {
      html += '<div class="pago-item"><span>Pagado el ' + formatFechaCorta(r.fechaPago) + ' (sin detalle)</span></div>';
    }
    if (falta > 0.5) {
      html += '<input type="text" inputmode="decimal" placeholder="Monto (falta ' + formatARS(falta) + ')" value="' + escapeHtml(buf.monto) + '" data-scope="pago" data-id="' + id + '" data-field="monto" data-focus-key="pago-' + id + '-monto">';
      html += '<div class="toggle-row">' + MEDIOS_PAGO.map(function (m) {
        return '<button type="button" class="toggle-btn' + (buf.medio === m ? ' active' : '') + '" data-action="pago-medio" data-id="' + id + '" data-value="' + m + '">' + m + '</button>';
      }).join('') + '</div>';
      html += '<input type="text" placeholder="Nota (opcional): cuenta, recibo, etc." value="' + escapeHtml(buf.nota) + '" data-scope="pago" data-id="' + id + '" data-field="nota" data-focus-key="pago-' + id + '-nota">';
      html += '<button type="button" class="primary-btn" data-action="registrar-pago" data-id="' + id + '">Registrar pago</button>';
      html += '<div class="iva-hint">Si dejas el monto vacio, se registra lo que falta (' + formatARS(falta) + ').</div>';
    } else {
      html += '<div class="iva-hint" style="color:var(--pagado)">Mes pagado completo.</div>';
    }
    html += '</div>';
    return html;
  }

  function renderAumentos(h) {
    var limite = addMonths(h.todayKey, 1);
    var lista = state.inquilinos.map(function (t) { return { t: t, prox: proximoAjuste(t) }; })
      .filter(function (x) { return x.prox && x.prox <= limite; })
      .sort(function (a, b) { return a.prox < b.prox ? -1 : 1; });
    if (lista.length === 0) return '';
    var html = '<div class="aviso-aumento"><div class="aviso-titulo">Aumentos por IPC</div>';
    lista.forEach(function (x) {
      var t = x.t;
      var cuando = x.prox < h.todayKey ? 'le tocaba en ' : (x.prox === h.todayKey ? 'le toca este mes, ' : 'le toca en ');
      html += '<div class="aumento-item">';
      html += '<div class="aumento-linea"><span><strong>' + escapeHtml(etiquetaInquilino(t)) + '</strong>: ' + cuando + escapeHtml(formatMonthLabel(x.prox).toLowerCase()) + ' (cada ' + t.ajusteCadaMeses + ' meses)</span>';
      if (puedeEditar()) html += '<button type="button" class="link-btn" data-action="toggle-aumento" data-id="' + t.id + '">' + (state.aumentoAbierto === t.id ? 'Cerrar' : 'Calcular') + '</button>';
      html += '</div>';
      if (state.aumentoAbierto === t.id && puedeEditar()) html += renderCalculadoraAumento(t, x.prox);
      html += '</div>';
    });
    html += '<div class="aviso-hint">Este aviso es solo para la familia: no se le envia nada al inquilino.</div>';
    html += '</div>';
    return html;
  }

  function renderCalculadoraAumento(t, desde) {
    var cada = Number(t.ajusteCadaMeses) || 0;
    var acum = ipcAcumulado(cada);
    var pctStr = state.aumentoPct[t.id] != null ? state.aumentoPct[t.id] : pctSugerido(t);
    var pct = parseMonto(pctStr);
    var base = montoBaseAjuste(t, desde);
    var html = '<div class="calc-aumento">';
    if (state.ipcEstado === 'cargando') {
      html += '<div class="iva-hint">Buscando el IPC del INDEC...</div>';
    } else if (acum) {
      html += '<div class="iva-hint">IPC acumulado ' + escapeHtml(formatMonthLabel(acum.desde)) + ' a ' + escapeHtml(formatMonthLabel(acum.hasta)) + ' (ultimos ' + cada + ' meses publicados por INDEC): <strong>' + formatPct(acum.pct) + '%</strong>. Revisalo segun lo que diga el contrato.</div>';
    } else {
      html += '<div class="iva-hint">No pude traer el IPC automaticamente. Carga el porcentaje a mano.</div>';
    }
    html += '<input type="text" inputmode="decimal" placeholder="% de aumento (ej: 7,5)" value="' + escapeHtml(pctStr) + '" data-scope="aumento" data-id="' + t.id + '" data-focus-key="aumento-' + t.id + '">';
    if (pct > 0) {
      var nuevo = Math.round(base * (1 + pct / 100));
      html += '<div class="iva-hint">' + formatARS(base) + ' &rarr; <strong>' + formatARS(nuevo) + '</strong>' + (t.conFactura ? ' + IVA = ' + formatARS(nuevo * 1.21) : '') + '</div>';
    }
    html += '<button type="button" class="primary-btn" data-action="aplicar-aumento" data-id="' + t.id + '">Aplicar desde ' + escapeHtml(formatMonthLabel(desde)) + '</button>';
    html += '</div>';
    return html;
  }

  function renderNuevoForm() {
    var n = state.nuevo;
    var montoNum = parseMonto(n.monto);
    var ivaHtml = (n.conFactura && montoNum > 0)
      ? '<div class="iva-hint">Total con IVA: ' + formatARS(montoNum * 1.21) + '</div>'
      : '';
    var html = '';
    html += '<div class="new-form">';
    html += '  <div class="new-form-head"><div class="t">Nuevo alquiler</div><button type="button" class="icon-plain-btn" data-action="cerrar-form" aria-label="Cerrar formulario">' + ICON_X + '</button></div>';
    html += '  <div class="new-form-body">';
    html += '    <input type="text" placeholder="Propiedad / unidad (opcional)" value="' + escapeHtml(n.propiedad) + '" data-scope="nuevo" data-field="propiedad" data-focus-key="nuevo-propiedad">';
    html += '    <input type="text" placeholder="Nombre del inquilino" value="' + escapeHtml(n.nombre) + '" data-scope="nuevo" data-field="nombre" data-focus-key="nuevo-nombre">';
    html += '    <div class="field-2col">';
    html += '      <div><div class="field-label">Ingreso</div><input type="date" value="' + escapeHtml(n.fechaIngreso) + '" data-scope="nuevo" data-field="fechaIngreso" data-focus-key="nuevo-fechaIngreso"></div>';
    html += '      <div><div class="field-label">Fin contrato</div><input type="date" value="' + escapeHtml(n.fechaFinContrato) + '" data-scope="nuevo" data-field="fechaFinContrato" data-focus-key="nuevo-fechaFinContrato"></div>';
    html += '    </div>';
    html += '    <input type="text" inputmode="decimal" placeholder="Monto mensual (ej: 450.000)" value="' + escapeHtml(n.monto) + '" data-scope="nuevo" data-field="monto" data-focus-key="nuevo-monto">';
    html += '    <div class="toggle-row">';
    html += '      <button type="button" class="toggle-btn' + (!n.conFactura ? ' active' : '') + '" data-action="factura-nuevo" data-value="false">Sin factura</button>';
    html += '      <button type="button" class="toggle-btn' + (n.conFactura ? ' active' : '') + '" data-action="factura-nuevo" data-value="true">Con factura (+21% IVA)</button>';
    html += '    </div>';
    html += ivaHtml;
    html += renderCamposAjuste('nuevo', '', n, 'nuevo-');
    html += '    <button type="button" class="primary-btn" data-action="agregar">Guardar alquiler</button>';
    html += '  </div>';
    html += '</div>';
    return html;
  }

  function renderApp() {
    if (CONFIG_NUBE && !NUBE) {
      return '<div class="cargando">No se pudo conectar. Revisa internet y volve a abrir la app.</div>';
    }
    if (state.loading) {
      return '<div class="cargando">Cargando el libro de alquileres…</div>';
    }
    if (NUBE && !state.usuario) return renderLogin();
    if (NUBE && state.rol === 'sin-acceso') return renderSinAcceso();
    var h = getHoy();
    var filas = getFilas();
    var filasFiltradas = aplicarFiltroEstado(getFilasFiltradas(filas));
    var totales = getTotales(filas);

    var html = '';
    html += '<div class="page"><div class="container">';

    html += '  <div class="top-row"><div class="eyebrow">Control mensual</div><div style="display:flex;gap:8px"><button type="button" class="theme-toggle letra-btn' + (state.letraGrande ? ' activo' : '') + '" data-action="toggle-letra" aria-label="Letra grande">A+</button>' + (puedeEditar() ? '<button type="button" class="theme-toggle" data-action="toggle-config-github" aria-label="Configurar backup a GitHub">' + ICON_GEAR + '</button>' : '') + '<button type="button" class="theme-toggle" data-action="toggle-tema" aria-label="Cambiar tema">' + (state.tema === 'dark' ? ICON_SUN : ICON_MOON) + '</button></div></div>';
    html += '  <h1 class="title">Alquileres</h1>';
    if (NUBE && state.usuario) {
      html += '  <div class="cuenta-row"><span>' + escapeHtml(state.usuario.nombre) + '</span>' +
        '<span class="rol-chip">' + (state.rol === 'editor' ? 'Puede editar' : 'Solo lectura') + '</span>' +
        '<button type="button" class="link-btn" data-action="logout">Salir</button></div>';
    }
    if (state.errorNube) {
      html += '  <div class="error-banner">' + escapeHtml(state.errorNube) + '</div>';
    }
    if (state.hayDatosLocalesParaSubir > 0) {
      html += '  <div class="import-banner"><p>Este celular tiene ' + state.hayDatosLocalesParaSubir + ' alquiler(es) cargados de antes. &iquest;Subirlos a la nube para que los vea toda la familia?</p><button type="button" data-action="subir-datos-locales">Subir a la nube</button></div>';
    }

    if (state.errorGuardado) {
      html += '  <div class="error-banner">' + (NUBE ? 'No se pudo guardar el ultimo cambio en la nube. Revisa la conexion.' : 'No se pudo guardar el ultimo cambio. Este navegador podria tener el almacenamiento bloqueado o lleno.') + '</div>';
    }

    if (puedeEditar() && state.mesActual === h.todayKey) {
      var hoyNorm = new Date(); hoyNorm.setHours(0, 0, 0, 0);
      var habilEsteMes = primerDiaHabil(hoyNorm.getFullYear(), hoyNorm.getMonth() + 1);
      if (hoyNorm >= habilEsteMes) {
        var conFacturaLista = tenantesConFacturaDelMes(h.todayKey).filter(function (r) { return !r.facturado; });
        if (conFacturaLista.length > 0) {
          var nombresFactura = conFacturaLista.map(function (r) {
            return '<button type="button" class="chip-btn" data-action="marcar-facturado" data-id="' + r.id + '">' + escapeHtml(r.nombre) + ' &#10003;</button>';
          }).join(' ');
          html += '  <div class="aviso-facturar">Ya paso el primer dia habil del mes: facturar a ' + nombresFactura +
            '<div class="aviso-hint">Toca cada nombre cuando ya este facturado.</div></div>';
        }
      }
    }

    html += renderAumentos(h);
    html += '  <div class="card swipe-area" data-swipe-mes="1">';
    html += '    <div class="month-nav">';
    html += '      <button type="button" class="icon-btn" data-action="mes-prev" aria-label="Mes anterior">' + ICON_CHEVRON_LEFT + '</button>';
    html += '      <div class="month-label">';
    html += '        <button type="button" class="month-name-btn" data-action="toggle-calendario"><span class="name">' + formatMonthLabel(state.mesActual) + '</span></button>';
    if (state.mesActual !== h.todayKey) {
      html += '<button type="button" class="link-btn" data-action="mes-hoy">volver a hoy</button>';
    }
    html += '      </div>';
    html += '      <button type="button" class="icon-btn" data-action="mes-next" aria-label="Mes siguiente">' + ICON_CHEVRON_RIGHT + '</button>';
    html += '    </div>';
    if (state.mostrarCalendario) html += renderCalendarioPicker();
    html += '    <div class="stats">';
    html += '      <button type="button" class="stat-btn' + (!state.filtroEstado ? ' stat-btn-activo' : '') + '" data-action="filtrar-estado" data-filtro="">';
    html += '        <div class="stat-label">A cobrar</div><div class="stat-value" style="color:var(--ink)">' + formatARS(totales.totalACobrar) + '</div>';
    html += '      </button>';
    html += '      <button type="button" class="stat-btn' + (state.filtroEstado === 'pagado' ? ' stat-btn-activo' : '') + '" data-action="filtrar-estado" data-filtro="pagado">';
    html += '        <div class="stat-label">Cobrado</div><div class="stat-value" style="color:var(--pagado)">' + formatARS(totales.totalCobrado) + '</div>';
    html += '      </button>';
    html += '      <button type="button" class="stat-btn' + (state.filtroEstado === 'pendiente' ? ' stat-btn-activo' : '') + '" data-action="filtrar-estado" data-filtro="pendiente">';
    html += '        <div class="stat-label">Pendiente</div><div class="stat-value" style="color:' + (totales.totalPendiente > 0 ? 'var(--vencido)' : 'var(--ink-muted)') + '">' + formatARS(totales.totalPendiente) + '</div>';
    html += '      </button>';
    html += '    </div>';
    var pctCobrado = totales.totalACobrar > 0 ? Math.round((totales.totalCobrado / totales.totalACobrar) * 100) : 0;
    html += '    <div class="progreso-bar-track"><div class="progreso-bar-fill" style="width:' + pctCobrado + '%"></div></div>';
    html += '    <div class="progreso-label">' + pctCobrado + '% cobrado este mes</div>';
    var netoMes = filas.reduce(function (s, f) { return s + (Number(f.monto) || 0); }, 0);
    var ivaMes = filas.filter(function (f) { return f.conFactura; }).reduce(function (s, f) { return s + (Number(f.monto) || 0) * 0.21; }, 0);
    if (ivaMes > 0) {
      html += '    <div class="anio-resumen">Neto ' + formatARS(netoMes) + ' &middot; IVA del mes <strong style="color:var(--pendiente)">' + formatARS(ivaMes) + '</strong></div>';
    }
    var anioActual = state.mesActual.split('-')[0];
    var totAnio = totalesAnio(anioActual);
    html += '    <div class="anio-resumen">Acumulado ' + anioActual + ': <strong style="color:var(--pagado)">' + formatARS(totAnio.totalCobrado) + '</strong> cobrados</div>';
    html += '    <button type="button" class="historial-toggle" style="margin-top:10px" data-action="toggle-historico">' + (state.mostrarHistorico ? 'Ocultar historico mensual' : 'Ver historico mensual') + '</button>';
    if (state.mostrarHistorico) html += renderHistorico();
    html += '  </div>';

    html += '  <div class="list-card">';
    if (state.inquilinos.length > 5) {
      html += '    <div class="search-wrap"><div class="search-inner">';
      html += '      <input type="text" class="input-search" placeholder="Buscar por nombre o propiedad" value="' + escapeHtml(state.busqueda) + '" data-scope="busqueda" data-focus-key="busqueda">';
      html += '      ' + ICON_SEARCH.replace('<svg ', '<svg class="search-icon" ');
      html += '    </div></div>';
    }
    if (filas.length === 0) {
      html += '    <div class="empty-state">' + (puedeEditar() ? 'Todavia no cargaste ningun alquiler.<br>Agrega el primero para empezar a llevar el control.' : 'Todavia no hay alquileres cargados.') + '</div>';
    }
    if (filas.length > 0 && filasFiltradas.length === 0) {
      var motivoVacio = state.busqueda.trim()
        ? ('para "' + escapeHtml(state.busqueda) + '"')
        : (state.filtroEstado ? 'con ese filtro' : '');
      html += '    <div class="empty-state small">No encontre alquileres ' + motivoVacio + '.</div>';
    }
    filasFiltradas.forEach(function (fila) { html += renderRow(fila); });

    if (!puedeEditar()) {
      // solo lectura: sin boton de agregar
    } else if (!state.mostrarForm) {
      html += '    <button type="button" class="add-toggle' + (filas.length > 0 ? ' with-rows' : '') + '" data-action="mostrar-form">' + ICON_PLUS + ' Agregar alquiler</button>';
    } else {
      html += renderNuevoForm();
    }
    html += '  </div>';

    html += '  <div class="footer-note">Vencimiento el dia 10 de cada mes</div>';
    html += '  <div class="acciones-grid">';
    html += '    <button type="button" class="footer-btn" data-action="compartir-resumen">Compartir resumen del mes</button>';
    html += '    <button type="button" class="footer-btn" data-action="excel-mes">' + ICON_DOWNLOAD + ' Excel del mes</button>';
    html += '    <button type="button" class="footer-btn" data-action="excel-anio">' + ICON_DOWNLOAD + ' Excel del a&ntilde;o</button>';
    html += '  </div>';
    html += '  <button type="button" class="footer-btn" data-action="exportar">' + ICON_DOWNLOAD + ' Exportar backup (.json)</button>';
    if (state.mostrarConfigGithub) html += renderConfigGithub();
    if (state.exportStatus) {
      var colorEstado = state.exportStatus.tipo === 'ok' ? 'var(--pagado)' : (state.exportStatus.tipo === 'error' ? 'var(--vencido)' : 'var(--ink-muted)');
      html += '  <div style="text-align:center;margin-top:8px;font-size:12px;font-family:var(--font-mono);color:' + colorEstado + '">' + escapeHtml(state.exportStatus.mensaje) + '</div>';
    }

    if (puedeEditar() && !state.hayDatosLocalesParaSubir && state.inquilinos.length === 0 && !state.mostrarForm) {
      html += '  <div class="import-banner"><p>&iquest;Tenes un backup de la version anterior?</p><button type="button" data-action="importar-trigger">Importar backup (.json)</button></div>';
    }

    html += '</div></div>';
    if (state.deshacerEliminar) {
      html += '<div class="undo-toast">Inquilino eliminado. <button type="button" data-action="deshacer-eliminar">Deshacer</button></div>';
    }
    return html;
  }

  function renderLogin() {
    var html = '<div class="page"><div class="container">';
    html += '<div class="eyebrow">Control mensual</div><h1 class="title">Alquileres</h1>';
    html += '<div class="card login-card">';
    html += '<p>Entra con tu cuenta de Google para ver los alquileres de la familia.</p>';
    html += '<button type="button" class="primary-btn" data-action="login">Entrar con Google</button>';
    if (state.errorNube) html += '<div class="error-banner" style="margin-top:12px">' + escapeHtml(state.errorNube) + '</div>';
    html += '</div></div></div>';
    return html;
  }

  function renderSinAcceso() {
    var html = '<div class="page"><div class="container">';
    html += '<div class="eyebrow">Control mensual</div><h1 class="title">Alquileres</h1>';
    html += '<div class="card login-card">';
    html += '<p>La cuenta <strong>' + escapeHtml(state.usuario.email) + '</strong> todavia no tiene acceso.</p>';
    html += '<p>Pedile a quien administra la app que agregue este mail.</p>';
    html += '<button type="button" class="primary-btn" data-action="logout">Entrar con otra cuenta</button>';
    html += '</div></div></div>';
    return html;
  }

  var SELECTABLE_TYPES = { text: 1, search: 1, tel: 1, url: 1, password: 1 };

  function renderConfigGithub() {
    var cfg = state.githubCfg;
    var buf = state.configBuffer;
    var html = '';
    html += '<div class="new-form">';
    html += '  <div class="new-form-head"><div class="t">Backup automatico a GitHub</div><button type="button" class="icon-plain-btn" data-action="cerrar-config-github" aria-label="Cerrar">' + ICON_X + '</button></div>';
    if (cfg) {
      html += '  <div class="iva-hint" style="margin-bottom:10px">Conectado a <strong>' + escapeHtml(cfg.owner) + '/' + escapeHtml(cfg.repo) + '</strong>. Cada "Exportar" tambien actualiza <code>backup.json</code> ahi, con historial.</div>';
      html += '  <button type="button" class="text-btn delete-btn" data-action="borrar-config-github">' + ICON_TRASH + ' Desconectar</button>';
    } else {
      html += '  <div class="iva-hint" style="margin-bottom:10px">Repo privado + token con permiso solo a ese repo (GitHub &rarr; Settings &rarr; Developer settings &rarr; Fine-grained tokens &rarr; Contents: Read and write).</div>';
      html += '  <div class="new-form-body">';
      html += '    <input type="text" placeholder="Usuario de GitHub" value="' + escapeHtml(buf.owner) + '" data-scope="config-github" data-field="owner" data-focus-key="cfg-owner">';
      html += '    <input type="text" placeholder="Nombre del repo privado" value="' + escapeHtml(buf.repo) + '" data-scope="config-github" data-field="repo" data-focus-key="cfg-repo">';
      html += '    <input type="password" placeholder="Token" value="' + escapeHtml(buf.token) + '" data-scope="config-github" data-field="token" data-focus-key="cfg-token">';
      html += '    <button type="button" class="primary-btn" data-action="guardar-config-github">Conectar</button>';
      html += '  </div>';
    }
    html += '</div>';
    return html;
  }
  function renderCalendarioPicker() {
    var anoBase = state.calendarioAno;
    var partes = state.mesActual.split('-');
    var anoActual = Number(partes[0]);
    var mesActualNum = Number(partes[1]);
    var html = '';
    html += '<div class="calendario-panel">';
    html += '  <div class="calendario-anos">';
    html += '    <button type="button" class="icon-btn" data-action="calendario-ano-prev" aria-label="Ano anterior">' + ICON_CHEVRON_LEFT + '</button>';
    html += '    <div class="calendario-ano-label">' + anoBase + '</div>';
    html += '    <button type="button" class="icon-btn" data-action="calendario-ano-next" aria-label="Ano siguiente">' + ICON_CHEVRON_RIGHT + '</button>';
    html += '  </div>';
    html += '  <div class="calendario-grid">';
    for (var m = 1; m <= 12; m++) {
      var key = anoBase + '-' + String(m).padStart(2, '0');
      var esActual = (anoBase === anoActual && m === mesActualNum);
      var tieneDatos = !!state.meses[key];
      html += '<button type="button" class="calendario-mes' + (esActual ? ' activo' : '') + (tieneDatos ? ' con-datos' : '') + '" data-action="calendario-elegir-mes" data-mes="' + key + '">' + MESES_NOMBRE[m - 1].slice(0, 3) + '</button>';
    }
    html += '  </div>';
    html += '</div>';
    return html;
  }

  function renderHistorico() {
    var datos = historicoMensual().slice().reverse();
    var html = '';
    html += '<div class="historico-panel">';
    if (datos.length === 0) {
      html += '<div class="iva-hint">Todavia no hay datos para mostrar.</div>';
    } else {
      html += '<div class="historico-header-row"><div>Mes</div><div>Cobrado</div><div>Pendiente</div></div>';
      datos.forEach(function (d) {
        html += '<div class="historico-row">';
        html += '<div class="historico-mes">' + formatMonthLabel(d.mes) + '</div>';
        html += '<div class="historico-val" style="color:var(--pagado)">' + formatARS(d.totalCobrado) + '</div>';
        html += '<div class="historico-val" style="color:' + (d.totalPendiente > 0 ? 'var(--vencido)' : 'var(--ink-muted)') + '">' + formatARS(d.totalPendiente) + '</div>';
        html += '</div>';
      });
    }
    html += '</div>';
    return html;
  }

  function render() {
    var active = document.activeElement;
    var focusInfo = null;
    if (active && active.dataset && active.dataset.focusKey && appEl.contains(active)) {
      var canSelect = active.tagName === 'TEXTAREA' || SELECTABLE_TYPES[active.type];
      focusInfo = { key: active.dataset.focusKey, start: null, end: null };
      if (canSelect) {
        try { focusInfo.start = active.selectionStart; focusInfo.end = active.selectionEnd; } catch (e) {}
      }
    }
    appEl.innerHTML = renderApp();
    if (focusInfo) {
      var el = appEl.querySelector('[data-focus-key="' + focusInfo.key + '"]');
      if (el) {
        el.focus();
        if (typeof focusInfo.start === 'number' && el.setSelectionRange) {
          try { el.setSelectionRange(focusInfo.start, focusInfo.end); } catch (e) {}
        }
      }
    }
  }

  // ---------- Event delegation ----------
  var ACCIONES_EDICION = {
    'abrir-edicion': 1, 'toggle-pagado': 1, 'factura-edit': 1, 'factura-nuevo': 1, 'pedir-eliminar': 1,
    'confirmar-eliminar': 1, 'guardar-edicion': 1, 'mostrar-form': 1, 'agregar': 1, 'importar-trigger': 1,
    'toggle-config-github': 1, 'guardar-config-github': 1, 'deshacer-eliminar': 1, 'subir-datos-locales': 1,
    'registrar-pago': 1, 'eliminar-pago': 1, 'pago-medio': 1, 'marcar-facturado': 1, 'facturado-set': 1,
    'toggle-aumento': 1, 'aplicar-aumento': 1
  };
  appEl.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var action = el.getAttribute('data-action');
    var id = el.getAttribute('data-id');
    if (ACCIONES_EDICION[action] && !puedeEditar()) return;
    switch (action) {
      case 'login': iniciarSesion(); break;
      case 'toggle-letra':
        state.letraGrande = !state.letraGrande;
        aplicarLetra(state.letraGrande);
        render();
        break;
      case 'pago-medio': {
        var pb = Object.assign({ monto: '', medio: '', nota: '' }, state.pagoBuffer[id]);
        var medio = el.getAttribute('data-value');
        pb.medio = pb.medio === medio ? '' : medio;
        state.pagoBuffer[id] = pb;
        render();
        break;
      }
      case 'registrar-pago': {
        var reg = registrosMes()[id];
        if (!reg) break;
        var pbuf = state.pagoBuffer[id] || { monto: '', medio: '', nota: '' };
        var falta = totalRegistro(reg) - cobradoRegistro(reg);
        var montoPago = pbuf.monto.trim() ? parseMonto(pbuf.monto) : falta;
        if (!montoPago || montoPago <= 0) break;
        delete state.pagoBuffer[id];
        registrarPago(id, montoPago, pbuf.medio, pbuf.nota.trim());
        break;
      }
      case 'eliminar-pago':
        if (confirm('Borrar este pago?')) eliminarPago(id, Number(el.getAttribute('data-idx')));
        break;
      case 'marcar-facturado': marcarFacturado(id, true); break;
      case 'facturado-set': marcarFacturado(id, el.getAttribute('data-value') === 'true'); break;
      case 'toggle-aumento':
        state.aumentoAbierto = state.aumentoAbierto === id ? null : id;
        if (state.aumentoAbierto) cargarIPC();
        render();
        break;
      case 'aplicar-aumento': aplicarAumento(id); break;
      case 'compartir-resumen': compartirResumen(); break;
      case 'excel-mes': exportarExcel('mes'); break;
      case 'excel-anio': exportarExcel('anio'); break;
      case 'logout': if (auth) auth.signOut(); break;
      case 'subir-datos-locales': {
        var local = leerDatosLocales();
        state.inquilinos = local.inquilinos;
        state.meses = local.meses;
        state.gastos = local.gastos;
        state.hayDatosLocalesParaSubir = 0;
        asegurarMes();
        guardarDatos();
        render();
        break;
      }
      case 'mes-prev': state.mesActual = addMonths(state.mesActual, -1); asegurarMes(); render(); break;
      case 'mes-next': state.mesActual = addMonths(state.mesActual, 1); asegurarMes(); render(); break;
      case 'mes-hoy': state.mesActual = getHoy().todayKey; asegurarMes(); render(); break;
      case 'toggle-calendario':
        if (!state.mostrarCalendario) state.calendarioAno = Number(state.mesActual.split('-')[0]);
        state.mostrarCalendario = !state.mostrarCalendario;
        render();
        break;
      case 'calendario-ano-prev': state.calendarioAno -= 1; render(); break;
      case 'calendario-ano-next': state.calendarioAno += 1; render(); break;
      case 'calendario-elegir-mes':
        state.mesActual = el.getAttribute('data-mes');
        state.mostrarCalendario = false;
        asegurarMes();
        render();
        break;
      case 'filtrar-estado': {
        var val = el.getAttribute('data-filtro') || null;
        state.filtroEstado = (state.filtroEstado === val) ? null : val;
        render();
        break;
      }
      case 'toggle-historico': state.mostrarHistorico = !state.mostrarHistorico; render(); break;
      case 'deshacer-eliminar': deshacerUltimaEliminacion(); break;
      case 'abrir-edicion': {
        var filaData = registrosMes()[id];
        if (filaData) abrirEdicion(Object.assign({ id: id }, filaData));
        break;
      }
      case 'toggle-pagado': togglePagado(id); break;
      case 'factura-edit':
        state.editBuffer[id] = Object.assign({}, state.editBuffer[id], { conFactura: el.getAttribute('data-value') === 'true' });
        render();
        break;
      case 'factura-nuevo':
        state.nuevo.conFactura = el.getAttribute('data-value') === 'true';
        render();
        break;
      case 'toggle-historial': state.historialAbierto = state.historialAbierto === id ? null : id; render(); break;
      case 'pedir-eliminar': state.confirmDeleteId = id; render(); break;
      case 'cancelar-eliminar': state.confirmDeleteId = null; render(); break;
      case 'confirmar-eliminar': eliminarInquilino(id); break;
      case 'cancelar-edicion': state.expandedId = null; render(); break;
      case 'guardar-edicion': guardarEdicion(id); break;
      case 'mostrar-form': state.mostrarForm = true; render(); break;
      case 'cerrar-form':
        state.mostrarForm = false;
        state.nuevo = { nombre: '', propiedad: '', monto: '', conFactura: false, fechaIngreso: '', fechaFinContrato: '', ajusteCadaMeses: '', ultimoAjuste: '' };
        render();
        break;
      case 'agregar': agregarInquilino(); break;
      case 'exportar': exportarDatos(); break;
      case 'importar-trigger': document.getElementById('input-importar').click(); break;
      case 'toggle-tema':
        state.tema = state.tema === 'dark' ? 'light' : 'dark';
        aplicarTema(state.tema);
        render();
        break;
      case 'toggle-config-github': state.mostrarConfigGithub = !state.mostrarConfigGithub; render(); break;
      case 'cerrar-config-github': state.mostrarConfigGithub = false; render(); break;
      case 'borrar-config-github':
        state.githubCfg = null;
        borrarGithubCfgLocal();
        state.exportStatus = { tipo: 'ok', mensaje: 'Desconectado.' };
        render();
        setTimeout(function () { state.exportStatus = null; render(); }, 3000);
        break;
      case 'guardar-config-github':
        (async function () {
          var buf = state.configBuffer;
          var owner = buf.owner.trim(), repo = buf.repo.trim(), token = buf.token.trim();
          if (!owner || !repo || !token) return;
          state.exportStatus = { tipo: 'cargando', mensaje: 'Verificando acceso...' };
          render();
          var cfgIntento = { owner: owner, repo: repo, token: token };
          var test = await verificarGithubCfg(cfgIntento);
          if (test.ok) {
            state.githubCfg = cfgIntento;
            guardarGithubCfgLocal(cfgIntento);
            state.configBuffer = { owner: '', repo: '', token: '' };
            state.mostrarConfigGithub = false;
            state.exportStatus = { tipo: 'ok', mensaje: 'Conectado correctamente.' };
          } else {
            state.exportStatus = { tipo: 'error', mensaje: 'No se pudo conectar: ' + test.reason };
          }
          render();
          setTimeout(function () { state.exportStatus = null; render(); }, 4000);
        })();
        break;
    }
  });

  appEl.addEventListener('input', function (e) {
    var t = e.target;
    var scope = t.getAttribute('data-scope');
    if (!scope) return;
    if (scope === 'busqueda') {
      state.busqueda = t.value;
      render();
    } else if (scope === 'nuevo') {
      var field = t.getAttribute('data-field');
      state.nuevo[field] = t.value;
      render();
    } else if (scope === 'edit') {
      var eid = t.getAttribute('data-id');
      var f = t.getAttribute('data-field');
      state.editBuffer[eid] = Object.assign({}, state.editBuffer[eid]);
      state.editBuffer[eid][f] = t.value;
      render();
    } else if (scope === 'pago') {
      var pid = t.getAttribute('data-id');
      state.pagoBuffer[pid] = Object.assign({ monto: '', medio: '', nota: '' }, state.pagoBuffer[pid]);
      state.pagoBuffer[pid][t.getAttribute('data-field')] = t.value;
      render();
    } else if (scope === 'aumento') {
      state.aumentoPct[t.getAttribute('data-id')] = t.value;
      render();
    } else if (scope === 'config-github') {
      var cf = t.getAttribute('data-field');
      state.configBuffer = Object.assign({}, state.configBuffer);
      state.configBuffer[cf] = t.value;
      render();
    }
  });

  document.getElementById('input-importar').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (file) importarDatos(file);
    e.target.value = '';
  });

  var swipeStartX = null, swipeStartY = null;
  appEl.addEventListener('touchstart', function (e) {
    var area = e.target.closest('[data-swipe-mes]');
    if (!area) { swipeStartX = null; return; }
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
  }, { passive: true });
  appEl.addEventListener('touchend', function (e) {
    if (swipeStartX === null) return;
    var endX = e.changedTouches[0].clientX;
    var endY = e.changedTouches[0].clientY;
    var deltaX = endX - swipeStartX;
    var deltaY = endY - swipeStartY;
    swipeStartX = null;
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      state.mesActual = addMonths(state.mesActual, deltaX < 0 ? 1 : -1);
      asegurarMes();
      render();
    }
  }, { passive: true });

  // ---------- Init ----------
  if (NUBE) {
    render();
    iniciarNube();
  } else {
    cargarDatos();
    asegurarMes();
    render();
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
