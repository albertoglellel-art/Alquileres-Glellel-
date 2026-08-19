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
    pendiente: { texto: 'PENDIENTE', color: 'var(--pendiente)' }
  };

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
    nuevo: { nombre: '', propiedad: '', monto: '', conFactura: false, fechaIngreso: '', fechaFinContrato: '' },
    editBuffer: {},
    historialAbierto: null,
    busqueda: '',
    tema: document.documentElement.getAttribute('data-theme') || 'light',
    githubCfg: cargarGithubCfg(),
    mostrarConfigGithub: false,
    configBuffer: { owner: '', repo: '', token: '' },
    exportStatus: null
  };

  // ---------- Persistence ----------
  function cargarDatos() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        state.inquilinos = parsed.inquilinos || [];
        state.meses = parsed.meses || {};
      }
    } catch (e) {
      // primera vez, sin datos guardados todavia
    }
    state.loading = false;
  }

  function guardarDatos() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ inquilinos: state.inquilinos, meses: state.meses }));
      state.errorGuardado = false;
    } catch (e) {
      state.errorGuardado = true;
    }
  }

  // ---------- Derived ----------
  function registrosMes() {
    return state.meses[state.mesActual] || {};
  }

  function ultimoRegistroConocido(id, antesDe) {
    var claves = Object.keys(state.meses).filter(function (k) { return k < antesDe; }).sort().reverse();
    for (var i = 0; i < claves.length; i++) {
      var k = claves[i];
      if (state.meses[k] && state.meses[k][id]) return state.meses[k][id];
    }
    return null;
  }

  function asegurarMes() {
    if (state.meses[state.mesActual]) return;
    if (state.inquilinos.length === 0) return;
    var nuevoRegistro = {};
    state.inquilinos.forEach(function (t) {
      var previo = ultimoRegistroConocido(t.id, state.mesActual);
      nuevoRegistro[t.id] = {
        nombre: t.nombre,
        propiedad: t.propiedad,
        monto: previo ? previo.monto : t.monto,
        conFactura: previo ? !!previo.conFactura : !!t.conFactura,
        pagado: false,
        fechaPago: null
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

  function getFilas() {
    var h = getHoy();
    var rm = registrosMes();
    var filas = Object.keys(rm).map(function (id) {
      var r = rm[id];
      return Object.assign({ id: id }, r, { estado: calcularEstado(state.mesActual, r.pagado, h.todayKey, h.todayDia) });
    });
    var orden = { vencido: 0, pendiente: 1, pagado: 2 };
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

  function getTotales(filas) {
    var totalACobrar = filas.reduce(function (s, f) { return s + montoConIva(f.monto, f.conFactura); }, 0);
    var totalCobrado = filas.filter(function (f) { return f.pagado; }).reduce(function (s, f) { return s + montoConIva(f.monto, f.conFactura); }, 0);
    return { totalACobrar: totalACobrar, totalCobrado: totalCobrado, totalPendiente: totalACobrar - totalCobrado };
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

  // ---------- Mutations ----------
  function togglePagado(id) {
    var rm = registrosMes();
    var registro = rm[id];
    if (!registro) return;
    var nuevoEstado = !registro.pagado;
    var actualizado = Object.assign({}, registro, { pagado: nuevoEstado, fechaPago: nuevoEstado ? new Date().toISOString().slice(0, 10) : null });
    var nextRm = Object.assign({}, rm);
    nextRm[id] = actualizado;
    state.meses = Object.assign({}, state.meses);
    state.meses[state.mesActual] = nextRm;
    guardarDatos();
    render();
  }

  function abrirEdicion(fila) {
    var inquilino = state.inquilinos.find(function (t) { return t.id === fila.id; });
    state.editBuffer[fila.id] = {
      nombre: fila.nombre,
      propiedad: fila.propiedad || '',
      monto: String(fila.monto),
      conFactura: !!fila.conFactura,
      fechaIngreso: (inquilino && inquilino.fechaIngreso) || '',
      fechaFinContrato: (inquilino && inquilino.fechaFinContrato) || ''
    };
    state.expandedId = state.expandedId === fila.id ? null : fila.id;
    state.confirmDeleteId = null;
    render();
  }

  function guardarEdicion(id) {
    var buf = state.editBuffer[id];
    if (!buf) { state.expandedId = null; render(); return; }
    var montoNum = Number(buf.monto);
    if (!buf.nombre || !buf.nombre.trim() || !montoNum || montoNum <= 0) return;
    var rm = registrosMes();
    var registro = rm[id];
    var actualizado = Object.assign({}, registro, { nombre: buf.nombre.trim(), propiedad: buf.propiedad.trim(), monto: montoNum, conFactura: !!buf.conFactura });
    var nextRm = Object.assign({}, rm);
    nextRm[id] = actualizado;
    state.meses = Object.assign({}, state.meses);
    state.meses[state.mesActual] = nextRm;
    state.inquilinos = state.inquilinos.map(function (t) {
      if (t.id !== id) return t;
      return Object.assign({}, t, {
        nombre: actualizado.nombre,
        propiedad: actualizado.propiedad,
        conFactura: actualizado.conFactura,
        fechaIngreso: buf.fechaIngreso || '',
        fechaFinContrato: buf.fechaFinContrato || ''
      });
    });
    guardarDatos();
    state.expandedId = null;
    render();
  }

  function eliminarInquilino(id) {
    state.inquilinos = state.inquilinos.filter(function (t) { return t.id !== id; });
    var nextRm = Object.assign({}, registrosMes());
    delete nextRm[id];
    state.meses = Object.assign({}, state.meses);
    state.meses[state.mesActual] = nextRm;
    guardarDatos();
    state.confirmDeleteId = null;
    state.expandedId = null;
    render();
  }

  function agregarInquilino() {
    var montoNum = Number(state.nuevo.monto);
    if (!state.nuevo.nombre.trim() || !montoNum || montoNum <= 0) return;
    var id = uid();
    var nuevoInquilino = {
      id: id,
      nombre: state.nuevo.nombre.trim(),
      propiedad: state.nuevo.propiedad.trim(),
      monto: montoNum,
      conFactura: !!state.nuevo.conFactura,
      fechaIngreso: state.nuevo.fechaIngreso || '',
      fechaFinContrato: state.nuevo.fechaFinContrato || ''
    };
    state.inquilinos = state.inquilinos.concat([nuevoInquilino]);
    var nextRm = Object.assign({}, registrosMes());
    nextRm[id] = { nombre: nuevoInquilino.nombre, propiedad: nuevoInquilino.propiedad, monto: montoNum, conFactura: nuevoInquilino.conFactura, pagado: false, fechaPago: null };
    state.meses = Object.assign({}, state.meses);
    state.meses[state.mesActual] = nextRm;
    guardarDatos();
    state.nuevo = { nombre: '', propiedad: '', monto: '', conFactura: false, fechaIngreso: '', fechaFinContrato: '' };
    state.mostrarForm = false;
    render();
  }

  async function exportarDatos() {
    var payload = { inquilinos: state.inquilinos, meses: state.meses, exportadoEl: new Date().toISOString() };
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
      formatARS(montoConIva(fila.monto, fila.conFactura)) + (fila.conFactura ? ' +IVA' : '') +
      (fila.estado === 'pagado' && fila.fechaPago ? ' &middot; pagado el ' + formatFechaCorta(fila.fechaPago) : '');

    var html = '';
    html += '<div class="row">';
    html += '  <div class="row-summary" data-action="abrir-edicion" data-id="' + fila.id + '">';
    html += '    <div class="row-main">';
    html += '      <div class="row-title">' + escapeHtml(fila.propiedad || fila.nombre) + '</div>';
    html += '      <div class="row-sub">' + subLine + '</div>';
    html += avisoHtml;
    html += '    </div>';
    html += '    <button type="button" class="sello-btn" data-action="toggle-pagado" data-id="' + fila.id + '" aria-label="Cambiar estado de pago">' + renderSello(fila.estado) + '</button>';
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
    var montoNum = Number(buf.monto);
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

    var html = '';
    html += '<div class="edit-panel">';
    html += '  <div class="edit-inner">';
    html += '    <input type="text" placeholder="Propiedad / unidad (opcional)" value="' + escapeHtml(buf.propiedad || '') + '" data-scope="edit" data-id="' + fila.id + '" data-field="propiedad" data-focus-key="edit-' + fila.id + '-propiedad">';
    html += '    <input type="text" placeholder="Nombre del inquilino" value="' + escapeHtml(buf.nombre || '') + '" data-scope="edit" data-id="' + fila.id + '" data-field="nombre" data-focus-key="edit-' + fila.id + '-nombre">';
    html += '    <div class="field-2col">';
    html += '      <div><div class="field-label">Ingreso</div><input type="date" value="' + escapeHtml(buf.fechaIngreso || '') + '" data-scope="edit" data-id="' + fila.id + '" data-field="fechaIngreso" data-focus-key="edit-' + fila.id + '-fechaIngreso"></div>';
    html += '      <div><div class="field-label">Fin contrato</div><input type="date" value="' + escapeHtml(buf.fechaFinContrato || '') + '" data-scope="edit" data-id="' + fila.id + '" data-field="fechaFinContrato" data-focus-key="edit-' + fila.id + '-fechaFinContrato"></div>';
    html += '    </div>';
    html += '    <input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="Monto mensual" value="' + escapeHtml(buf.monto || '') + '" data-scope="edit" data-id="' + fila.id + '" data-field="monto" data-focus-key="edit-' + fila.id + '-monto">';
    html += '    <div class="toggle-row">';
    html += '      <button type="button" class="toggle-btn' + (!confactura ? ' active' : '') + '" data-action="factura-edit" data-id="' + fila.id + '" data-value="false">Sin factura</button>';
    html += '      <button type="button" class="toggle-btn' + (confactura ? ' active' : '') + '" data-action="factura-edit" data-id="' + fila.id + '" data-value="true">Con factura (+21% IVA)</button>';
    html += '    </div>';
    html += ivaHtml;
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

  function renderNuevoForm() {
    var n = state.nuevo;
    var montoNum = Number(n.monto);
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
    html += '    <input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="Monto mensual" value="' + escapeHtml(n.monto) + '" data-scope="nuevo" data-field="monto" data-focus-key="nuevo-monto">';
    html += '    <div class="toggle-row">';
    html += '      <button type="button" class="toggle-btn' + (!n.conFactura ? ' active' : '') + '" data-action="factura-nuevo" data-value="false">Sin factura</button>';
    html += '      <button type="button" class="toggle-btn' + (n.conFactura ? ' active' : '') + '" data-action="factura-nuevo" data-value="true">Con factura (+21% IVA)</button>';
    html += '    </div>';
    html += ivaHtml;
    html += '    <button type="button" class="primary-btn" data-action="agregar">Guardar alquiler</button>';
    html += '  </div>';
    html += '</div>';
    return html;
  }

  function renderApp() {
    if (state.loading) {
      return '<div class="cargando">Cargando el libro de alquileres…</div>';
    }
    var h = getHoy();
    var filas = getFilas();
    var filasFiltradas = getFilasFiltradas(filas);
    var totales = getTotales(filas);

    var html = '';
    html += '<div class="page"><div class="container">';

    html += '  <div class="top-row"><div class="eyebrow">Control mensual</div><button type="button" class="theme-toggle" data-action="toggle-tema" aria-label="Cambiar tema">' + (state.tema === 'dark' ? ICON_SUN : ICON_MOON) + '</button></div>';
    html += '  <h1 class="title">Alquileres</h1>';

    if (state.errorGuardado) {
      html += '  <div class="error-banner">No se pudo guardar el ultimo cambio. Este navegador podria tener el almacenamiento bloqueado o lleno.</div>';
    }

    html += '  <div class="card">';
    html += '    <div class="month-nav">';
    html += '      <button type="button" class="icon-btn" data-action="mes-prev" aria-label="Mes anterior">' + ICON_CHEVRON_LEFT + '</button>';
    html += '      <div class="month-label"><div class="name">' + formatMonthLabel(state.mesActual) + '</div>';
    if (state.mesActual !== h.todayKey) {
      html += '<button type="button" class="link-btn" data-action="mes-hoy">volver a hoy</button>';
    }
    html += '      </div>';
    html += '      <button type="button" class="icon-btn" data-action="mes-next" aria-label="Mes siguiente">' + ICON_CHEVRON_RIGHT + '</button>';
    html += '    </div>';
    html += '    <div class="stats">';
    html += '      <div><div class="stat-label">A cobrar</div><div class="stat-value" style="color:var(--ink)">' + formatARS(totales.totalACobrar) + '</div></div>';
    html += '      <div><div class="stat-label">Cobrado</div><div class="stat-value" style="color:var(--pagado)">' + formatARS(totales.totalCobrado) + '</div></div>';
    html += '      <div><div class="stat-label">Pendiente</div><div class="stat-value" style="color:' + (totales.totalPendiente > 0 ? 'var(--vencido)' : 'var(--ink-muted)') + '">' + formatARS(totales.totalPendiente) + '</div></div>';
    html += '    </div>';
    html += '  </div>';

    html += '  <div class="list-card">';
    if (state.inquilinos.length > 5) {
      html += '    <div class="search-wrap"><div class="search-inner">';
      html += '      <input type="text" class="input-search" placeholder="Buscar por nombre o propiedad" value="' + escapeHtml(state.busqueda) + '" data-scope="busqueda" data-focus-key="busqueda">';
      html += '      ' + ICON_SEARCH.replace('<svg ', '<svg class="search-icon" ');
      html += '    </div></div>';
    }
    if (filas.length === 0) {
      html += '    <div class="empty-state">Todavia no cargaste ningun alquiler.<br>Agrega el primero para empezar a llevar el control.</div>';
    }
    if (filas.length > 0 && filasFiltradas.length === 0) {
      html += '    <div class="empty-state small">No encontre alquileres para "' + escapeHtml(state.busqueda) + '".</div>';
    }
    filasFiltradas.forEach(function (fila) { html += renderRow(fila); });

    if (!state.mostrarForm) {
      html += '    <button type="button" class="add-toggle' + (filas.length > 0 ? ' with-rows' : '') + '" data-action="mostrar-form">' + ICON_PLUS + ' Agregar alquiler</button>';
    } else {
      html += renderNuevoForm();
    }
    html += '  </div>';

    html += '  <div class="footer-note">Vencimiento el dia 10 de cada mes</div>';
    html += '  <div style="display:flex;gap:8px;margin-top:8px">';
    html += '    <button type="button" class="footer-btn" style="flex:1" data-action="exportar">' + ICON_DOWNLOAD + ' Exportar backup (.json)</button>';
    html += '    <button type="button" class="footer-btn" style="flex:0 0 auto;padding-left:12px;padding-right:12px" data-action="toggle-config-github" aria-label="Configurar backup a GitHub">' + ICON_GEAR + '</button>';
    html += '  </div>';
    if (state.mostrarConfigGithub) html += renderConfigGithub();
    if (state.exportStatus) {
      var colorEstado = state.exportStatus.tipo === 'ok' ? 'var(--pagado)' : (state.exportStatus.tipo === 'error' ? 'var(--vencido)' : 'var(--ink-muted)');
      html += '  <div style="text-align:center;margin-top:8px;font-size:12px;font-family:var(--font-mono);color:' + colorEstado + '">' + escapeHtml(state.exportStatus.mensaje) + '</div>';
    }

    if (state.inquilinos.length === 0 && !state.mostrarForm) {
      html += '  <div class="import-banner"><p>&iquest;Tenes un backup de la version anterior?</p><button type="button" data-action="importar-trigger">Importar backup (.json)</button></div>';
    }

    html += '</div></div>';
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
  appEl.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var action = el.getAttribute('data-action');
    var id = el.getAttribute('data-id');
    switch (action) {
      case 'mes-prev': state.mesActual = addMonths(state.mesActual, -1); asegurarMes(); render(); break;
      case 'mes-next': state.mesActual = addMonths(state.mesActual, 1); asegurarMes(); render(); break;
      case 'mes-hoy': state.mesActual = getHoy().todayKey; asegurarMes(); render(); break;
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
        state.nuevo = { nombre: '', propiedad: '', monto: '', conFactura: false, fechaIngreso: '', fechaFinContrato: '' };
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

  // ---------- Init ----------
  cargarDatos();
  asegurarMes();
  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
