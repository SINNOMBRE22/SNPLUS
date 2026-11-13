/* SN PLUS · Panel web — dashboard + usuarios SSH */
'use strict';

const $ = (id) => document.getElementById(id);
const SVGNS = 'http://www.w3.org/2000/svg';
let temporizador = null;

// ---------- API ----------
async function api(ruta, opciones = {}) {
  const r = await fetch(ruta, {
    method: opciones.method || 'GET',
    headers: { 'Content-Type': 'application/json', 'X-SNP': '1' },
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  let datos = {};
  try { datos = await r.json(); } catch (e) { /* respuesta vacia */ }
  if (r.status === 401 && ruta !== '/api/login') { mostrarLogin(); throw new Error('sesion'); }
  if (!r.ok) throw new Error(datos.error || ('Error ' + r.status));
  return datos;
}

// ---------- formato ----------
function bytes(n) {
  if (!n || n < 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return (n >= 100 || i === 0 ? Math.round(n) : n.toFixed(1)) + ' ' + u[i];
}
function tiempo(seg) {
  const d = Math.floor(seg / 86400), h = Math.floor((seg % 86400) / 3600), m = Math.floor((seg % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
}
function pct(a, b) { return b > 0 ? Math.round((a / b) * 100) : 0; }
function texto(id, v) { const el = $(id); if (el) el.textContent = v; }
function barra(id, p) {
  const el = $(id);
  if (!el) return;
  el.style.width = Math.min(100, Math.max(0, p)) + '%';
  el.classList.toggle('alto', p >= 75 && p < 90);
  el.classList.toggle('critico', p >= 90);
}

// ---------- vistas ----------
let vistaActual = '';
let ultimoEstado = null;

function mostrarLogin() {
  clearInterval(temporizador);
  vistaActual = '';
  for (const d of document.querySelectorAll('dialog[open]')) d.close();
  $('vista-app').classList.add('oculto');
  $('vista-login').classList.remove('oculto');
  $('login-usuario').focus();
}
function mostrarApp() {
  $('vista-login').classList.add('oculto');
  $('vista-app').classList.remove('oculto');
  ir();
}
function ir() {
  const v = ({ '#/ssh': 'ssh', '#/vray': 'vray', '#/protos': 'protos', '#/terminal': 'terminal', '#/respaldos': 'resp' })[location.hash] || 'dashboard';
  if (v === vistaActual) return;
  vistaActual = v;
  for (const n of ['dashboard', 'ssh', 'vray', 'protos', 'terminal', 'resp']) $('vista-' + n).classList.toggle('oculto', n !== v);
  for (const a of document.querySelectorAll('.nav-item[data-vista]')) {
    const on = a.dataset.vista === v;
    a.classList.toggle('activo', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  document.title = ({ ssh: 'Usuarios SSH', vray: 'V2Ray / Xray', protos: 'Protocolos', terminal: 'Terminal', resp: 'Respaldos', dashboard: 'Dashboard' })[v] + ' · SN PLUS';
  const tarea = ({ ssh: cargarSsh, vray: cargarVray, protos: cargarProtos, resp: cargarResp })[v] || cargar;
  clearInterval(temporizador);
  tarea();
  temporizador = setInterval(() => { if (!document.hidden && !hayDialogo()) tarea(); }, v === 'dashboard' || v === 'terminal' ? 4000 : v === 'protos' || v === 'resp' ? 20000 : 10000);
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', () => { if (!$('vista-app').classList.contains('oculto')) ir(); });
function hayDialogo() { return !!document.querySelector('dialog[open]'); }

$('form-login').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const err = $('login-error'), btn = $('login-btn');
  err.classList.add('oculto');
  btn.disabled = true; btn.textContent = 'Entrando…';
  try {
    await api('/api/login', { method: 'POST', body: { usuario: $('login-usuario').value.trim(), clave: $('login-clave').value } });
    $('login-clave').value = '';
    mostrarApp();
  } catch (e) {
    err.textContent = e.message; err.classList.remove('oculto');
  } finally {
    btn.disabled = false; btn.textContent = 'Entrar';
  }
});

$('btn-salir').addEventListener('click', async () => {
  try { await api('/api/logout', { method: 'POST' }); } catch (e) { /* ya cerrada */ }
  mostrarLogin();
});

// ---------- dashboard ----------
async function cargar() {
  let d;
  try { d = await api('/api/estado'); } catch (e) { if (e.message !== 'sesion') texto('actualizado', 'Sin conexión con la VPS'); return; }
  ultimoEstado = d;
  const s = d.sistema || {}, r = d.recursos || {}, red = d.red || {}, u = d.usuarios || {}, lic = d.licencia || {};
  if (u.ssh !== undefined) texto('nav-ssh', u.ssh);
  if (u.v2ray !== undefined) texto('nav-vray', (u.v2ray || 0) + (u.xray || 0));

  texto('sys-ip', s.ip || '—');
  texto('sys-os', `${s.os || ''} · ${s.arch || ''}`);
  texto('sys-uptime', 'Activo ' + tiempo(s.uptime || 0));
  texto('sys-host', s.hostname || '—');
  texto('sys-kernel', s.kernel || '—');
  texto('sys-arch', s.arch || '—');
  texto('sys-nucleos', s.nucleos || '—');
  texto('sys-carga', s.carga || '—');
  texto('sys-swap', r.swapTotal ? `${bytes(r.swapUsada)} / ${bytes(r.swapTotal)}` : 'Sin swap');

  texto('cpu-val', (r.cpu || 0) + '%'); texto('cpu-sub', `${s.nucleos || 1} núcleo${s.nucleos > 1 ? 's' : ''}`); barra('cpu-bar', r.cpu || 0);
  const pr = pct(r.memUsada, r.memTotal);
  texto('ram-val', pr + '%'); texto('ram-sub', `${bytes(r.memUsada)} / ${bytes(r.memTotal)}`); barra('ram-bar', pr);
  const pd = pct(r.discoUsado, r.discoTotal);
  texto('disco-val', pd + '%'); texto('disco-sub', `${bytes(r.discoUsado)} / ${bytes(r.discoTotal)}`); barra('disco-bar', pd);
  texto('red-val', `↓ ${bytes(red.rxRate)}/s`);
  texto('red-sub', `↑ ${bytes(red.txRate)}/s`);
  texto('conex-sub', `${red.conexiones || 0} conexiones`);

  texto('us-total', u.total ?? '—'); texto('us-venc', u.vencidos ?? '—'); texto('us-pronto', u.pronto ?? '—'); texto('us-bloq', u.bloqueados ?? '—');
  texto('us-ssh', u.ssh ?? '—'); texto('us-v2', u.v2ray ?? '—'); texto('us-xr', u.xray ?? '—');

  const le = $('lic-estado');
  le.textContent = lic.valida ? 'ACTIVA' : 'NO VÁLIDA';
  le.className = 'pastilla ' + (lic.valida ? 'ok' : 'mal');
  texto('lic-reseller', lic.reseller || '—');
  texto('lic-version', s.version || '—');

  dibujarServicios(d.servicios || []);
  dibujarGrafica(red.historial || []);
  texto('actualizado', 'Actualizado ' + new Date().toLocaleTimeString());
}

function dibujarServicios(lista) {
  const cont = $('servicios');
  cont.replaceChildren();
  texto('sv-cuenta', lista.length + (lista.length === 1 ? ' servicio' : ' servicios'));
  if (!lista.length) {
    const p = document.createElement('p');
    p.className = 'tenue chico'; p.textContent = 'Calculando… (se actualiza cada 30 s)';
    cont.append(p);
    return;
  }
  for (const sv of lista) {
    const caja = document.createElement('div'); caja.className = 'servicio';
    const punto = document.createElement('span'); punto.className = 'punto';
    const txt = document.createElement('div'); txt.className = 'servicio-txt';
    const nom = document.createElement('span'); nom.className = 'servicio-nom'; nom.textContent = sv.nombre;
    const pto = document.createElement('span'); pto.className = 'servicio-pto'; pto.textContent = (sv.puertos || []).join(' · ');
    txt.append(nom, pto); caja.append(punto, txt); cont.append(caja);
  }
}

function svg(tag, attrs) {
  const el = document.createElementNS(SVGNS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}
function dibujarGrafica(h) {
  const g = $('grafica');
  g.replaceChildren();
  for (const y of [50, 100, 150]) g.append(svg('path', { d: `M0 ${y}H640`, class: 'guia' }));
  let rx = 0, tx = 0;
  for (const p of h) { rx += p.rx; tx += p.tx; }
  texto('tr-rx', bytes(rx)); texto('tr-tx', bytes(tx));
  $('grafica-vacia').classList.toggle('oculto', h.length >= 2);
  if (h.length < 2) return;
  const max = Math.max(1, ...h.map((p) => Math.max(p.rx, p.tx)));
  const paso = 640 / (h.length - 1);
  const pts = (campo) => h.map((p, i) => `${(i * paso).toFixed(1)} ${(192 - (p[campo] / max) * 180).toFixed(1)}`);
  const lrx = pts('rx'), ltx = pts('tx');
  g.append(svg('path', { d: `M${lrx.join(' L')} L640 200 L0 200 Z`, class: 'rx-area' }));
  g.append(svg('path', { d: `M${lrx.join(' L')}`, class: 'rx' }));
  g.append(svg('path', { d: `M${ltx.join(' L')}`, class: 'tx' }));
  const horas = ((h[h.length - 1].ts - h[0].ts) / 3600).toFixed(1);
  texto('tr-nota', `Últimas ${horas} h · un punto cada 5 min (se reinicia si el panel se reinicia).`);
}

// =========================================================
//  USUARIOS SSH
// =========================================================
let sshLista = [];
let sshFiltro = 'todos';
let sshConex = [];
let relojDif = 0;   // diferencia entre el reloj de la VPS y el del navegador
let sshCargado = false;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function el(tag, clase, txt) {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (txt !== undefined) e.textContent = txt;
  return e;
}
function icono(d) {
  const s = svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
  for (const p of d) s.append(svg('path', { d: p }));
  return s;
}
const ICONOS = {
  copiar: ['M9 9h11v11H9z', 'M5 15H4V4h11v1'],
  renovar: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5'],
  editar: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z'],
  candado: ['M6 11h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  abierto: ['M6 11h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z', 'M8 11V7a4 4 0 0 1 7.5-2'],
  cortar: ['M18.4 5.6a9 9 0 1 1-12.8 0', 'M12 2v10'],
  borrar: ['M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14'],
  estad: ['M3 21h18', 'M6 17v-4', 'M11 17V7', 'M16 17v-7', 'M21 17V4'],
};

function fechaCorta(iso) {
  if (!iso) return 'Sin vencimiento';
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES[m - 1]} ${a}`;
}
function fechaEnDias(n) {
  const f = new Date();
  f.setDate(f.getDate() + Number(n || 0));
  return `${f.getDate()} ${MESES[f.getMonth()]} ${f.getFullYear()}`;
}
function textoDias(d) {
  if (d < 0) return `venció hace ${-d} día${d === -1 ? '' : 's'}`;
  if (d === 0) return 'vence hoy';
  return `en ${d} día${d === 1 ? '' : 's'}`;
}
function estadoDe(u) {
  if (u.bloqueado && u.porConsumo) return 'agotado';
  if (u.bloqueado) return 'bloqueado';
  if (u.expira && u.dias < 0) return 'vencido';
  if (u.sesiones > 0) return 'enlinea';
  if (u.expira && u.dias <= 3) return 'pronto';
  return 'activo';
}
const ETIQUETA = { agotado: 'Consumo agotado', enlinea: 'En línea', activo: 'Activo', pronto: 'Por vencer', vencido: 'Vencido', bloqueado: 'Bloqueado' };
const FILTROS = [
  ['todos', 'Todos', () => true],
  ['enlinea', 'En línea', (u) => u.sesiones > 0],
  ['pronto', 'Por vencer', (u) => !u.bloqueado && u.expira && u.dias >= 0 && u.dias <= 3],
  ['vencido', 'Vencidos', (u) => u.expira && u.dias < 0],
  ['bloqueado', 'Bloqueados', (u) => u.bloqueado],
];
const mb = (n) => bytes(n * 1024 * 1024);

async function cargarSsh() {
  cargar();   // licencia, IP y puertos (para la barra lateral y la tarjeta)
  try {
    const [d, cx] = await Promise.all([api('/api/ssh'), api('/api/ssh/conexiones').catch(() => null)]);
    sshLista = d.usuarios || [];
    sshCargado = true;
    if (cx) { sshConex = cx.conexiones || []; relojDif = (cx.ahora || 0) * 1000 - Date.now(); }
    texto('nav-ssh', sshLista.length);
    pintarSsh();
  } catch (e) {
    if (e.message === 'sesion') return;
    texto('ssh-resumen', 'No se pudo leer la lista: ' + e.message);
  }
}

function pintarSsh() {
  const enLinea = sshLista.filter((u) => u.sesiones > 0).length;
  const conex = sshLista.reduce((a, u) => a + (u.sesiones || 0), 0);
  texto('ssh-resumen', sshCargado
    ? `${sshLista.length} usuario${sshLista.length === 1 ? '' : 's'} · ${enLinea} en línea · ${conex} conexion${conex === 1 ? '' : 'es'} abiertas`
    : 'Cargando…');

  const cf = $('ssh-filtros');
  cf.replaceChildren();
  for (const [id, nombre, fn] of FILTROS) {
    const b = el('button', 'filtro', nombre + ' ');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(sshFiltro === id));
    b.append(el('span', '', sshLista.filter(fn).length));
    b.addEventListener('click', () => { sshFiltro = id; pintarSsh(); });
    cf.append(b);
  }

  const q = $('ssh-buscar').value.trim().toLowerCase();
  const fn = FILTROS.find((f) => f[0] === sshFiltro)[2];
  const lista = sshLista.filter((u) => fn(u) && (!q || u.usuario.toLowerCase().includes(q) || (u.nombre || '').toLowerCase().includes(q)))
    .sort((a, b) => (a.nombre || a.usuario).localeCompare(b.nombre || b.usuario));

  pintarConectados(q);

  const tb = $('ssh-filas');
  tb.replaceChildren();
  for (const u of lista) tb.append(filaSsh(u));
  const vacio = $('ssh-vacio');
  vacio.classList.toggle('oculto', lista.length > 0);
  vacio.textContent = !sshLista.length
    ? 'Aún no hay usuarios SSH. Crea el primero con «Crear usuario».'
    : 'Ningún usuario coincide con la búsqueda.';
}

function filaSsh(u) {
  const tr = el('tr');
  const est = estadoDe(u);

  // usuario
  const c1 = el('td', 'c-usr');
  const box = el('div', 'usr');
  const txt = el('div', 'usr-txt');
  const esId = u.tipo === 'hwid' || u.tipo === 'token';
  const nom = el('span', 'usr-nom enlace', esId ? (u.nombre || u.usuario) : u.usuario);
  nom.title = 'Ver estadísticas';
  nom.addEventListener('click', () => abrirEstadisticas(u.usuario));
  if (esId) {
    const sub = el('span', 'usr-clave usr-id', u.usuario);
    sub.title = u.usuario;
    nom.append(el('span', 'etiq-chica etiq-id', u.tipo === 'hwid' ? 'HWID' : 'TOKEN'));
    txt.append(nom, sub);
  } else txt.append(nom, el('span', 'usr-clave', u.clave || '—'));
  box.append(el('span', 'avatar', (esId ? (u.nombre || u.usuario) : u.usuario).slice(0, 2)), txt);
  c1.append(box);

  // estado
  const c2 = el('td', 'c-est');
  c2.append(el('span', 'estado ' + est, ETIQUETA[est]));

  // vence
  const c3 = el('td'); c3.dataset.et = 'Vence';
  const col = el('div', 'columna');
  col.append(el('span', '', fechaCorta(u.expira)));
  if (u.expira) col.append(el('span', 'chico-tenue' + (u.dias < 0 ? ' rojo' : u.dias <= 3 ? ' ambar' : ''), textoDias(u.dias)));
  c3.append(col);

  // conexiones
  const c4 = el('td'); c4.dataset.et = 'Conexiones';
  const cx = el('span', 'mono' + (u.sesiones > u.limite ? ' ambar' : ''), `${u.sesiones} / ${u.limite}`);
  c4.append(cx);

  // consumo
  const c5 = el('td'); c5.dataset.et = 'Consumo';
  const cs = el('div', 'consumo');
  const linea = el('span', 'chico-tenue');
  linea.textContent = u.consumoMB > 0 ? `${bytes(u.usadoBytes)} / ${mb(u.consumoMB)}` : `${bytes(u.usadoBytes)} · sin límite`;
  if (u.kbps > 0) linea.append(el('span', 'etiq-chica', u.kbps + ' KB/s'));
  if (u.horario) linea.append(el('span', 'etiq-chica', 'horario'));
  cs.append(linea);
  if (u.consumoMB > 0) {
    const p = Math.min(100, (u.usadoBytes / (u.consumoMB * 1048576)) * 100);
    const b = el('div', 'barra'), r = el('div', 'barra-relleno cian');
    r.style.width = p + '%';
    r.classList.toggle('alto', p >= 75 && p < 100);
    r.classList.toggle('critico', p >= 100);
    b.append(r); cs.append(b);
  }
  c5.append(cs);

  // acciones
  const c6 = el('td', 'c-acc');
  const acc = el('div', 'acciones');
  const boton = (ico, etiqueta, fn, clase) => {
    const b = el('button', 'accion' + (clase ? ' ' + clase : ''));
    b.type = 'button'; b.title = etiqueta; b.setAttribute('aria-label', `${etiqueta} ${u.usuario}`);
    b.append(icono(ICONOS[ico]));
    b.addEventListener('click', () => fn(u, b));
    acc.append(b);
  };
  boton('estad', 'Estadísticas y conexiones', (x) => abrirEstadisticas(x.usuario));
  boton('copiar', 'Ver y copiar datos', mostrarTarjeta);
  boton('renovar', 'Renovar', abrirRenovar);
  boton('editar', 'Editar', (x) => abrirUsuario(x));
  boton(u.bloqueado ? 'abierto' : 'candado', u.bloqueado ? 'Desbloquear' : 'Bloquear', alternarBloqueo, u.bloqueado ? 'activa' : '');
  if (u.sesiones > 0) boton('cortar', 'Desconectar sesiones', desconectar);
  boton('borrar', 'Eliminar', confirmarEliminar, 'peligro');
  c6.append(acc);

  tr.append(c1, c2, c3, c4, c5, c6);
  return tr;
}

$('ssh-buscar').addEventListener('input', pintarSsh);


// ---------- conexiones con IP ----------
function haceCuanto(unix) {
  const seg = Math.max(0, Math.round((Date.now() + relojDif) / 1000 - unix));
  if (seg < 60) return 'menos de 1 min';
  const m = Math.floor(seg / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d > 0) return `${d} d ${h % 24} h`;
  if (h > 0) return `${h} h ${m % 60} min`;
  return `${m} min`;
}
function filaConexion(c, conUsuario, alCortar) {
  const f = el('div', 'conex');
  if (conUsuario) f.append(el('span', 'avatar', c.usuario.slice(0, 2)));
  const t = el('div', 'conex-txt');
  if (conUsuario) {
    const b = el('button', 'conex-usr', c.usuario);
    b.type = 'button'; b.title = 'Ver estadísticas';
    b.addEventListener('click', () => abrirEstadisticas(c.usuario));
    t.append(b);
  }
  t.append(el('span', 'conex-ip', c.ip || 'IP no disponible'));
  t.append(el('span', 'conex-via', c.puerto ? `${c.via} · puerto ${c.puerto}` : c.via));
  if (c.desde > 0) t.append(el('span', 'conex-t', 'hace ' + haceCuanto(c.desde)));
  f.append(t);
  if (c.pid > 0) {
    const x = el('button', 'accion peligro');
    x.type = 'button'; x.title = 'Cortar esta conexión';
    x.setAttribute('aria-label', `Cortar la conexión de ${c.usuario} desde ${c.ip || 'IP desconocida'}`);
    x.append(icono(ICONOS.cortar));
    x.addEventListener('click', () => cortarConexion(c, x, alCortar));
    f.append(x);
  }
  return f;
}
async function cortarConexion(c, btn, despues) {
  btn.disabled = true;
  try {
    await api('/api/ssh/cortar', { method: 'POST', body: { usuario: c.usuario, pid: c.pid } });
    avisar(`Conexión de ${c.usuario}${c.ip ? ' (' + c.ip + ')' : ''} cortada`);
    if (despues) await despues();
    await cargarSsh();
  } catch (e) { if (e.message !== 'sesion') avisar(e.message, true); btn.disabled = false; }
}
function pintarConectados(q) {
  const caja = $('ssh-conectados');
  const lista = sshConex.filter((c) => !q || c.usuario.toLowerCase().includes(q) || (c.ip || '').includes(q))
    .sort((a, b) => a.usuario.localeCompare(b.usuario) || (b.desde - a.desde));
  caja.classList.toggle('oculto', !sshConex.length);
  texto('ssh-conex-n', sshConex.length);
  const cont = $('ssh-conex-lista');
  cont.replaceChildren();
  for (const c of lista) cont.append(filaConexion(c, true));
  if (!lista.length) cont.append(el('p', 'conex-vacio', 'Nadie coincide con la búsqueda.'));
}

// ---------- estadisticas de un usuario ----------
let estadUsuario = '';
let estadReloj = null;
function dibujarBarras(caja, puntos, etiqueta, marcas) {
  caja.replaceChildren();
  const max = Math.max(0, ...puntos.map((p) => p.bytes));
  const tope = el('div', 'barras-tope');
  tope.append(el('span', '', max > 0 ? 'máx. ' + bytes(max) : 'sin consumo registrado'), el('span', '', 'total ' + bytes(puntos.reduce((a, p) => a + p.bytes, 0))));
  const W = 600, H = 120, n = puntos.length, paso = W / n, ancho = Math.max(2, paso * 0.68);
  const g = svg('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', class: 'barras', role: 'img', 'aria-label': etiqueta });
  for (const y of [H * 0.25, H * 0.5, H * 0.75]) g.append(svg('path', { d: `M0 ${y}H${W}`, class: 'guia' }));
  puntos.forEach((p, i) => {
    const h = max > 0 && p.bytes > 0 ? Math.max(3, (p.bytes / max) * (H - 4)) : 2;
    const r = svg('rect', { x: (i * paso + (paso - ancho) / 2).toFixed(1), y: (H - h).toFixed(1), width: ancho.toFixed(1), height: h.toFixed(1), rx: 2 });
    r.setAttribute('class', i === n - 1 ? 'actual' : p.bytes > 0 ? '' : 'cero');
    const t = svg('title', {}); t.textContent = `${p.etiqueta}: ${bytes(p.bytes)}`;
    r.append(t); g.append(r);
  });
  const ejes = el('div', 'barras-ejes');
  for (const m of marcas) ejes.append(el('span', '', m));
  caja.append(tope, g, ejes);
}
function fechaDia(iso) { const [, m, d] = iso.split('-').map(Number); return `${d} ${MESES[m - 1]}`; }

async function cargarEstadisticas() {
  const u = estadUsuario;
  const d = await api('/api/ssh/estadisticas', { method: 'POST', body: { usuario: u } });
  if (u !== estadUsuario) return;
  relojDif = (d.ahora || 0) * 1000 - Date.now();
  $('e-cargando').classList.add('oculto');
  $('e-cuerpo').classList.remove('oculto');
  texto('e-hoy', bytes(d.hoy));
  texto('e-semana', bytes(d.semana));
  texto('e-treinta', bytes(d.treinta));
  texto('e-mes', bytes(d.contador));
  texto('e-mes-lim', d.limiteMB > 0 ? `de ${mb(d.limiteMB)} (${pct(d.contador, d.limiteMB * 1048576)}%)` : 'sin límite de consumo');
  const cx = d.conexiones || [];
  texto('e-ultima', cx.length ? 'Conectado ahora' : d.ultimaVez > 0 ? 'hace ' + haceCuanto(d.ultimaVez) : 'Sin registro todavía');
  $('e-ultima').className = cx.length ? 'acento' : '';
  texto('e-pico', String(d.picoHoy || cx.length));

  const dias = (d.dias || []).map((p) => ({ bytes: p.bytes, etiqueta: fechaDia(p.fecha) }));
  const m30 = dias.length ? [dias[0].etiqueta, dias[Math.floor(dias.length / 2)].etiqueta, 'hoy'] : [];
  dibujarBarras($('e-g30'), dias, 'Consumo por día de los últimos 30 días', m30);
  const horas = (d.horas || []).map((p) => ({ bytes: p.bytes, etiqueta: p.hora }));
  const m24 = horas.length ? [horas[0].etiqueta, horas[6].etiqueta, horas[12].etiqueta, horas[18].etiqueta, 'ahora'] : [];
  dibujarBarras($('e-g24'), horas, 'Consumo por hora de las últimas 24 horas', m24);

  texto('e-cx-n', cx.length);
  const cont = $('e-conex');
  cont.replaceChildren();
  for (const c of cx) cont.append(filaConexion(c, false, cargarEstadisticas));
  if (!cx.length) cont.append(el('p', 'conex-vacio', 'No tiene conexiones abiertas en este momento.'));

  texto('e-nota', d.registrando
    ? 'El consumo es el tráfico real que pasó por la cuenta (subida + bajada). Se registra cada minuto; «Este mes» se reinicia el día 1.'
    : 'Las estadísticas empiezan a guardarse con esta versión: en unos minutos verás los primeros datos.');
}
async function abrirEstadisticas(usuario) {
  estadUsuario = usuario;
  const u = sshLista.find((x) => x.usuario === usuario) || { usuario };
  texto('e-titulo', u.nombre || usuario);
  texto('e-avatar', (u.nombre || usuario).slice(0, 2));
  const est = u.expira !== undefined ? estadoDe(u) : '';
  texto('e-sub', est ? `${ETIQUETA[est]} · ${u.expira ? 'vence ' + fechaCorta(u.expira) : 'sin vencimiento'} · ${u.limite} conexión${u.limite === 1 ? '' : 'es'} máx.` : '');
  $('e-cargando').classList.remove('oculto');
  texto('e-cargando', 'Cargando…');
  $('e-cuerpo').classList.add('oculto');
  const dlg = $('dlg-estad');
  if (!dlg.open) dlg.showModal();
  clearInterval(estadReloj);
  estadReloj = setInterval(() => { if (!document.hidden && dlg.open) cargarEstadisticas().catch(() => {}); }, 10000);
  try { await cargarEstadisticas(); }
  catch (e) { if (e.message !== 'sesion') texto('e-cargando', 'No se pudieron leer las estadísticas: ' + e.message); }
}
$('dlg-estad').addEventListener('close', () => { clearInterval(estadReloj); estadUsuario = ''; });

// ---------- avisos ----------
function avisar(msg, mal) {
  const a = el('div', 'aviso' + (mal ? ' mal' : ''), msg);
  a.setAttribute('role', mal ? 'alert' : 'status');
  $('avisos').append(a);
  setTimeout(() => a.remove(), mal ? 6000 : 3500);
}

// ---------- dialogos: cerrar ----------
for (const d of document.querySelectorAll('dialog')) {
  d.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-cerrar]') || (ev.target === d && !d.hasAttribute('data-sin-fondo'))) d.close();
  });
}

async function accionSsh(accion, cuerpo, ok) {
  const r = await api('/api/ssh/' + accion, { method: 'POST', body: cuerpo });
  if (ok) avisar(ok);
  await cargarSsh();
  return r;
}
function ocupado(btn, si, texto) {
  btn.disabled = si;
  if (texto) btn.textContent = texto;
}

// ---------- crear / editar ----------
let editando = null;
let tipoForm = 'ssh';
function ponerTipo(tipo) {
  tipoForm = tipo;
  const esId = tipo !== 'ssh';
  for (const b of $('f-tipo').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.tipo === tipo));
  $('f-nombre-campo').classList.toggle('oculto', !esId);
  $('f-clave-campo').classList.toggle('oculto', esId);
  texto('f-usuario-et', esId ? (tipo === 'hwid' ? 'HWID' : 'Token') : 'Usuario');
  texto('f-usuario-ayuda', editando && esId ? 'No se puede cambiar. Si el cliente cambió de celular, crea otra cuenta con el HWID nuevo.'
    : tipo === 'hwid' ? 'Pega el HWID que te manda el cliente desde su app (6 a 32 caracteres).'
    : tipo === 'token' ? 'El cliente pone este token en la app para entrar (6 a 32 caracteres).'
    : '2 a 20 caracteres: letras, números, punto, guion o guion bajo.');
  $('f-usuario').maxLength = esId ? 32 : 20;
  $('f-usuario').placeholder = tipo === 'hwid' ? 'ej. 7F3A9C21B04D' : tipo === 'token' ? 'ej. tk8Hq2xP' : 'ej. carlos_mx';
  $('f-generar-id').classList.toggle('oculto', tipo !== 'token' || !!editando);
  if (!editando) texto('dlg-usuario-titulo', tipo === 'hwid' ? 'Nuevo usuario HWID' : tipo === 'token' ? 'Nuevo usuario Token' : 'Nuevo usuario SSH');
}
for (const b of document.querySelectorAll('#f-tipo button')) b.addEventListener('click', () => { if (!editando) ponerTipo(b.dataset.tipo); });
function claveAleatoria() {
  const c = 'abcdefghjkmnpqrstuvwxyz23456789';
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => c[x % c.length]).join('');
}
function actualizarVence() { texto('f-vence', fechaEnDias($('f-dias').value)); }

function abrirUsuario(u) {
  editando = u || null;
  const f = $('form-usuario');
  f.reset();
  $('f-error').classList.add('oculto');
  const tipo = u ? (u.tipo === 'hwid' || u.tipo === 'token' ? u.tipo : 'ssh') : 'ssh';
  ponerTipo(tipo);
  $('f-tipo-campo').classList.toggle('oculto', !!u);
  texto('dlg-usuario-titulo', u ? 'Editar ' + (tipo !== 'ssh' ? (u.nombre || u.usuario) : u.usuario) : 'Nuevo usuario SSH');
  texto('f-guardar', u ? 'Guardar cambios' : 'Crear usuario');
  $('f-usuario').readOnly = !!u;
  $('f-usuario').value = u ? u.usuario : '';
  $('f-nombre').value = u ? (u.nombre || '') : '';
  $('f-clave').value = u ? u.clave : '';
  $('f-dias').value = u ? Math.max(1, Math.min(360, u.dias > 0 ? u.dias : 30)) : 30;
  $('f-limite').value = u ? u.limite || 1 : 1;
  $('f-kbps').value = u && u.kbps > 0 ? u.kbps : '';
  $('f-consumo').value = u && u.consumoMB > 0 ? +(u.consumoMB / 1024).toFixed(2) : '';
  texto('f-dias-et', u ? 'Días (desde hoy)' : 'Días');
  $('f-agotado').classList.toggle('oculto', !(u && u.bloqueado && u.porConsumo));
  actualizarVence();
  $('dlg-usuario').showModal();
  (u ? (tipo !== 'ssh' ? $('f-nombre') : $('f-clave')) : $('f-usuario')).focus();
}
$('ssh-nuevo').addEventListener('click', () => abrirUsuario(null));
$('f-generar').addEventListener('click', () => { $('f-clave').value = claveAleatoria(); });
$('f-dias').addEventListener('input', actualizarVence);
$('f-generar-id').addEventListener('click', () => { $('f-usuario').value = claveAleatoria() + claveAleatoria().slice(0, 4); });
$('f-usuario').addEventListener('input', (ev) => {
  const v = ev.target.value.replace(/[^A-Za-z0-9_.-]/g, '');
  if (v !== ev.target.value) ev.target.value = v;
});

function validarUsuario(c) {
  if (c.tipo !== 'ssh') {
    const que = c.tipo === 'hwid' ? 'HWID' : 'Token';
    if (!c.nombre || c.nombre.length < 2) return 'Escribe el nombre del cliente.';
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{5,31}$/.test(c.usuario)) return `${que} inválido: de 6 a 32 caracteres (letras, números, . _ -).`;
  } else {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{1,19}$/.test(c.usuario)) return 'Nombre de usuario inválido (2-20: letras, números, . _ -).';
    if (!/^[\x21-\x7e]{2,20}$/.test(c.clave) || /[,:|]/.test(c.clave)) return 'Contraseña de 2 a 20 caracteres, sin espacios ni , : |';
  }
  if (!(c.dias >= 1 && c.dias <= 360)) return 'Los días van de 1 a 360.';
  if (!(c.limite >= 1 && c.limite <= 999)) return 'Las conexiones van de 1 a 999.';
  if (c.kbps < 0 || c.consumoMB < 0) return 'Velocidad y consumo no pueden ser negativos.';
  return '';
}

$('form-usuario').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const c = {
    tipo: tipoForm,
    nombre: $('f-nombre').value.trim().replace(/[|,:]/g, ''),
    usuario: $('f-usuario').value.trim(),
    clave: tipoForm !== 'ssh' ? $('f-usuario').value.trim() : $('f-clave').value.trim(),
    dias: parseInt($('f-dias').value, 10),
    limite: parseInt($('f-limite').value, 10),
    kbps: parseInt($('f-kbps').value || '0', 10) || 0,
    consumoMB: Math.round(parseFloat($('f-consumo').value || '0') * 1024) || 0,
  };
  const err = $('f-error');
  const msg = validarUsuario(c);
  if (msg) { err.textContent = msg; err.classList.remove('oculto'); return; }
  err.classList.add('oculto');
  const btn = $('f-guardar');
  const antes = btn.textContent;
  ocupado(btn, true, editando ? 'Guardando…' : 'Creando…');
  try {
    if (editando) {
      await accionSsh('editar', c, `Usuario ${c.tipo !== 'ssh' ? c.nombre : c.usuario} actualizado`);
      $('dlg-usuario').close();
    } else {
      await accionSsh('crear', c, `Usuario ${c.tipo !== 'ssh' ? c.nombre : c.usuario} creado`);
      $('dlg-usuario').close();
      const nuevo = sshLista.find((u) => u.usuario === c.usuario);
      mostrarTarjeta(nuevo || { ...c, expira: '', dias: c.dias }, null, true);
    }
  } catch (e) {
    if (e.message !== 'sesion') { err.textContent = e.message; err.classList.remove('oculto'); }
  } finally {
    ocupado(btn, false, antes);
  }
});

// ---------- renovar (SSH y V2Ray/Xray) ----------
// opciones: { titulo, actual, etiqueta, desde (fecha ISO o ''), alGuardar(dias) }
let renovarCfg = null;
function fechaDesde(base, n) {
  const f = base ? new Date(base + 'T12:00:00') : new Date();
  f.setDate(f.getDate() + Number(n || 0));
  return `${f.getDate()} ${MESES[f.getMonth()]} ${f.getFullYear()}`;
}
function abrirRenovarCon(cfg) {
  renovarCfg = cfg;
  texto('dlg-renovar-titulo', cfg.titulo);
  texto('r-actual', cfg.actual);
  texto('r-dias-et', cfg.etiqueta);
  $('r-dias').value = 30;
  $('r-error').classList.add('oculto');
  const at = $('r-atajos');
  at.replaceChildren();
  for (const n of [7, 15, 30, 60, 90]) {
    const b = el('button', 'filtro', n + ' días');
    b.type = 'button';
    b.addEventListener('click', () => { $('r-dias').value = n; texto('r-vence', fechaDesde(cfg.desde, n)); });
    at.append(b);
  }
  texto('r-vence', fechaDesde(cfg.desde, 30));
  $('dlg-renovar').showModal();
}
function abrirRenovar(u) {
  abrirRenovarCon({
    titulo: 'Renovar ' + u.usuario,
    actual: u.expira ? `Vence: ${fechaCorta(u.expira)} (${textoDias(u.dias)})` : 'Sin vencimiento',
    etiqueta: 'Días a partir de hoy',
    desde: '',
    alGuardar: (dias) => accionSsh('renovar', { usuario: u.usuario, dias }, `${u.usuario} renovado hasta el ${fechaEnDias(dias)}`),
  });
}
$('r-dias').addEventListener('input', () => texto('r-vence', fechaDesde(renovarCfg && renovarCfg.desde, $('r-dias').value)));
$('form-renovar').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const dias = parseInt($('r-dias').value, 10);
  const err = $('r-error');
  if (!(dias >= 1 && dias <= 360)) { err.textContent = 'Los días van de 1 a 360.'; err.classList.remove('oculto'); return; }
  const btn = $('r-guardar');
  ocupado(btn, true, 'Renovando…');
  try {
    await renovarCfg.alGuardar(dias);
    $('dlg-renovar').close();
  } catch (e) {
    if (e.message !== 'sesion') { err.textContent = e.message; err.classList.remove('oculto'); }
  } finally { ocupado(btn, false, 'Renovar'); }
});

// ---------- bloquear / desconectar ----------
async function alternarBloqueo(u, btn) {
  btn.disabled = true;
  try {
    await accionSsh('bloquear', { usuario: u.usuario, bloquear: !u.bloqueado },
      u.bloqueado ? `${u.usuario} desbloqueado` : `${u.usuario} bloqueado y desconectado`);
  } catch (e) { if (e.message !== 'sesion') avisar(e.message, true); btn.disabled = false; }
}
async function desconectar(u, btn) {
  btn.disabled = true;
  try { await accionSsh('desconectar', { usuario: u.usuario }, `Sesiones de ${u.usuario} cerradas`); }
  catch (e) { if (e.message !== 'sesion') avisar(e.message, true); btn.disabled = false; }
}

// ---------- confirmar (eliminar) ----------
let confirmarCfg = null;
let confirmarBoton = 'Eliminar';
function confirmar(titulo, textoCuerpo, alAceptar, opciones = {}) {
  confirmarCfg = alAceptar;
  confirmarBoton = opciones.boton || 'Eliminar';
  texto('c-titulo', titulo);
  texto('c-texto', textoCuerpo);
  texto('c-ok', confirmarBoton);
  $('c-ok').className = 'btn ' + (opciones.peligro === false ? 'btn-primario' : 'btn-peligro');
  $('dlg-confirmar').showModal();
}
function confirmarEliminar(u) {
  confirmar(`¿Eliminar ${u.usuario}?`,
    'Se borra la cuenta, se cierran sus conexiones y se quitan sus límites. No se puede deshacer.',
    () => accionSsh('eliminar', { usuario: u.usuario }, `${u.usuario} eliminado`));
}
$('form-confirmar').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const btn = $('c-ok');
  ocupado(btn, true, 'Un momento…');
  try {
    await confirmarCfg();
    $('dlg-confirmar').close();
  } catch (e) { if (e.message !== 'sesion') avisar(e.message, true); }
  finally { ocupado(btn, false, confirmarBoton); }
});

// ---------- tarjeta de la cuenta ----------
function mostrarTarjeta(u, _btn, recien) {
  const e = ultimoEstado || {};
  const ip = (e.sistema && e.sistema.ip) || location.hostname;
  const linea = '━━━━━━━━━━━━━━━━━━━━━━━━━━';
  const filas = [
    linea, u.tipo === 'hwid' ? '  SN PLUS · CUENTA HWID' : u.tipo === 'token' ? '  SN PLUS · CUENTA TOKEN' : '  SN PLUS · CUENTA SSH', linea,
    `IP:          ${ip}`,
    ...(u.tipo === 'hwid' || u.tipo === 'token'
      ? [`Cliente:     ${u.nombre || '—'}`, `${u.tipo === 'hwid' ? 'HWID:       ' : 'Token:      '} ${u.usuario}`]
      : [`Usuario:     ${u.usuario}`, `Contraseña:  ${u.clave}`]),
    `Vence:       ${u.expira ? fechaCorta(u.expira) : fechaEnDias(u.dias)}`,
    `Conexiones:  ${u.limite}`,
  ];
  if (u.kbps > 0) filas.push(`Velocidad:   ${u.kbps} KB/s`);
  if (u.consumoMB > 0) filas.push(`Consumo:     ${mb(u.consumoMB)}`);
  const sv = (e.servicios || []).filter((s) => s.nombre !== 'Panel web' && s.nombre !== 'Check User' && s.puertos && s.puertos.length);
  if (sv.length) {
    filas.push(linea, 'PUERTOS');
    for (const s of sv) filas.push(`${(s.nombre + ':').padEnd(13)}${s.puertos.join(', ')}`);
  }
  filas.push(linea);
  texto('t-titulo', recien ? 'Cuenta creada' : 'Datos de ' + (u.nombre || u.usuario));
  texto('t-texto', filas.join('\n'));
  texto('t-copiar', 'Copiar datos');
  $('dlg-tarjeta').showModal();
}
$('t-copiar').addEventListener('click', async () => {
  const t = $('t-texto').textContent;
  try {
    await navigator.clipboard.writeText(t);
  } catch (e) {
    const r = document.createRange();
    r.selectNodeContents($('t-texto'));
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    document.execCommand('copy');
  }
  texto('t-copiar', '¡Copiado!');
});

// ---------- QR (modo byte, corrección M o L, versiones 1-40) ----------
// Implementación propia y compacta del estándar ISO/IEC 18004, para no
// cargar librerías externas en el panel.
const QR = (() => {
  const ECC = {
    L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  };
  const BLOQUES = {
    L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  };
  const FORMATO = { L: 1, M: 0 };

  const modulosCrudos = (v) => {
    let r = (16 * v + 128) * v + 64;
    if (v >= 2) {
      const n = Math.floor(v / 7) + 2;
      r -= (25 * n - 10) * n - 55;
      if (v >= 7) r -= 36;
    }
    return r;
  };
  const datosCw = (v, e) => Math.floor(modulosCrudos(v) / 8) - ECC[e][v] * BLOQUES[e][v];

  const mul = (x, y) => {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  };
  const divisor = (grado) => {
    const r = new Array(grado).fill(0);
    r[grado - 1] = 1;
    let raiz = 1;
    for (let i = 0; i < grado; i++) {
      for (let j = 0; j < r.length; j++) {
        r[j] = mul(r[j], raiz);
        if (j + 1 < r.length) r[j] ^= r[j + 1];
      }
      raiz = mul(raiz, 2);
    }
    return r;
  };
  const resto = (datos, div) => {
    const r = div.map(() => 0);
    for (const b of datos) {
      const f = b ^ r.shift();
      r.push(0);
      div.forEach((c, i) => { r[i] ^= mul(c, f); });
    }
    return r;
  };

  function crear(texto) {
    const bytes = Array.from(new TextEncoder().encode(texto));
    let ver = 0, ecl = 'M';
    for (const e of ['M', 'L']) {
      for (let v = 1; v <= 40; v++) {
        const bits = 4 + (v <= 9 ? 8 : 16) + bytes.length * 8;
        if (bits <= datosCw(v, e) * 8) { ver = v; break; }
      }
      if (ver) { ecl = e; break; }
    }
    if (!ver) throw new Error('Texto demasiado largo para QR');

    // ---- bits de datos ----
    const bits = [];
    const poner = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    poner(4, 4);
    poner(bytes.length, ver <= 9 ? 8 : 16);
    for (const b of bytes) poner(b, 8);
    const cap = datosCw(ver, ecl) * 8;
    poner(0, Math.min(4, cap - bits.length));
    poner(0, (8 - (bits.length % 8)) % 8);
    for (let p = 0xec; bits.length < cap; p ^= 0xec ^ 0x11) poner(p, 8);
    const datos = [];
    for (let i = 0; i < bits.length; i += 8) datos.push(parseInt(bits.slice(i, i + 8).join(''), 2));

    // ---- corrección de errores e intercalado ----
    const nb = BLOQUES[ecl][ver], le = ECC[ecl][ver];
    const crudos = Math.floor(modulosCrudos(ver) / 8);
    const cortos = nb - (crudos % nb), largoCorto = Math.floor(crudos / nb);
    const div = divisor(le), bloques = [];
    for (let i = 0, k = 0; i < nb; i++) {
      const d = datos.slice(k, k + largoCorto - le + (i < cortos ? 0 : 1));
      k += d.length;
      const ec = resto(d, div);
      if (i < cortos) d.push(0);
      bloques.push(d.concat(ec));
    }
    const final = [];
    for (let i = 0; i < bloques[0].length; i++)
      for (let j = 0; j < bloques.length; j++)
        if (i !== largoCorto - le || j >= cortos) final.push(bloques[j][i]);

    // ---- matriz ----
    const n = ver * 4 + 17;
    const m = Array.from({ length: n }, () => new Array(n).fill(false));
    const fn = Array.from({ length: n }, () => new Array(n).fill(false));
    const fijo = (x, y, v) => { m[y][x] = v; fn[y][x] = true; };

    for (let i = 0; i < n; i++) { fijo(6, i, i % 2 === 0); fijo(i, 6, i % 2 === 0); }
    const buscador = (x, y) => {
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const d = Math.max(Math.abs(dx), Math.abs(dy)), xx = x + dx, yy = y + dy;
          if (xx >= 0 && xx < n && yy >= 0 && yy < n) fijo(xx, yy, d !== 2 && d !== 4);
        }
    };
    buscador(3, 3); buscador(n - 4, 3); buscador(3, n - 4);
    if (ver > 1) {
      const na = Math.floor(ver / 7) + 2;
      const paso = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2;
      const pos = [6];
      for (let p = n - 7; pos.length < na; p -= paso) pos.splice(1, 0, p);
      for (let i = 0; i < na; i++)
        for (let j = 0; j < na; j++) {
          if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
          for (let dy = -2; dy <= 2; dy++)
            for (let dx = -2; dx <= 2; dx++) fijo(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
    }
    const formato = (mask) => {
      const d = (FORMATO[ecl] << 3) | mask;
      let r = d;
      for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const b = ((d << 10) | r) ^ 0x5412;
      const bit = (i) => ((b >>> i) & 1) !== 0;
      for (let i = 0; i <= 5; i++) fijo(8, i, bit(i));
      fijo(8, 7, bit(6)); fijo(8, 8, bit(7)); fijo(7, 8, bit(8));
      for (let i = 9; i < 15; i++) fijo(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) fijo(n - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) fijo(8, n - 15 + i, bit(i));
      fijo(8, n - 8, true);
    };
    formato(0);
    if (ver >= 7) {
      let r = ver;
      for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
      const b = (ver << 12) | r;
      for (let i = 0; i < 18; i++) {
        const v = ((b >>> i) & 1) !== 0, a = n - 11 + (i % 3), c = Math.floor(i / 3);
        fijo(a, c, v); fijo(c, a, v);
      }
    }
    let i = 0;
    for (let der = n - 1; der >= 1; der -= 2) {
      if (der === 6) der = 5;
      for (let vert = 0; vert < n; vert++)
        for (let j = 0; j < 2; j++) {
          const x = der - j, arriba = ((der + 1) & 2) === 0, y = arriba ? n - 1 - vert : vert;
          if (!fn[y][x] && i < final.length * 8) { m[y][x] = ((final[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0; i++; }
        }
    }

    // ---- máscara con menor penalización ----
    const invierte = (k, x, y) => [
      (x + y) % 2 === 0, y % 2 === 0, x % 3 === 0, (x + y) % 3 === 0,
      (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, ((x * y) % 2) + ((x * y) % 3) === 0,
      (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
    ][k];
    const mascara = (k) => {
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!fn[y][x] && invierte(k, x, y)) m[y][x] = !m[y][x];
    };
    const penal = () => {
      let p = 0, oscuros = 0;
      for (let a = 0; a < 2; a++)
        for (let y = 0; y < n; y++) {
          let run = 1;
          for (let x = 1; x <= n; x++) {
            const cur = x < n ? (a ? m[x][y] : m[y][x]) : null, prev = a ? m[x - 1][y] : m[y][x - 1];
            if (cur === prev) run++;
            else { if (run >= 5) p += run - 2; run = 1; }
          }
        }
      for (let y = 0; y < n - 1; y++)
        for (let x = 0; x < n - 1; x++) {
          const c = m[y][x];
          if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
        }
      const patron = [true, false, true, true, true, false, true, false, false, false, false];
      const inv = patron.slice().reverse();
      for (let y = 0; y < n; y++)
        for (let x = 0; x + 11 <= n; x++)
          for (const pt of [patron, inv]) {
            let h = true, v = true;
            for (let k = 0; k < 11; k++) { if (m[y][x + k] !== pt[k]) h = false; if (m[x + k][y] !== pt[k]) v = false; }
            if (h) p += 40; if (v) p += 40;
          }
      for (const fila of m) for (const c of fila) if (c) oscuros++;
      p += Math.floor(Math.abs(oscuros * 20 - n * n * 10) / (n * n)) * 10;
      return p;
    };
    let mejor = 0, minimo = Infinity;
    for (let k = 0; k < 8; k++) {
      mascara(k); formato(k);
      const pp = penal();
      if (pp < minimo) { minimo = pp; mejor = k; }
      mascara(k);
    }
    mascara(mejor); formato(mejor);
    return m;
  }

  function dibujar(canvas, texto, px) {
    const m = crear(texto), n = m.length, borde = 4;
    const lado = (n + borde * 2) * px;
    canvas.width = lado; canvas.height = lado;
    const c = canvas.getContext('2d');
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, lado, lado);
    c.fillStyle = '#000000';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m[y][x]) c.fillRect((x + borde) * px, (y + borde) * px, px, px);
  }
  return { crear, dibujar };
})();

// =========================================================
//  V2RAY / XRAY MOD
// =========================================================
const VR = { tipo: '', datos: { v2ray: null, xray: null }, filtro: 'todos' };
const VR_NOMBRE = { v2ray: 'V2Ray', xray: 'Xray MOD' };
const VR_FILTROS = [
  ['todos', 'Todos', () => true],
  ['activo', 'Activos', (c) => !c.bloqueado && !(c.expira && c.dias < 0)],
  ['pronto', 'Por vencer', (c) => !c.bloqueado && c.expira && c.dias >= 0 && c.dias <= 3],
  ['vencido', 'Vencidos', (c) => c.expira && c.dias < 0],
  ['bloqueado', 'Bloqueados', (c) => c.bloqueado],
];
function estadoVr(c) {
  if (c.bloqueado) return 'bloqueado';
  if (c.expira && c.dias < 0) return 'vencido';
  if (c.expira && c.dias <= 3) return 'pronto';
  return 'activo';
}

async function cargarVray() {
  cargar();
  const [a, b] = await Promise.allSettled([api('/api/vray/v2ray'), api('/api/vray/xray')]);
  if ([a, b].some((r) => r.status === 'rejected' && r.reason.message === 'sesion')) return;
  VR.datos.v2ray = a.status === 'fulfilled' ? a.value : { instalado: true, error: a.reason.message };
  VR.datos.xray = b.status === 'fulfilled' ? b.value : { instalado: true, error: b.reason.message };
  const instalados = ['v2ray', 'xray'].filter((t) => VR.datos[t].instalado);
  if (!instalados.includes(VR.tipo)) VR.tipo = instalados[0] || '';
  const total = instalados.reduce((n, t) => n + ((VR.datos[t].clientes || []).length), 0);
  texto('nav-vray', total);
  pintarVray();
}

function pintarVray() {
  const instalados = ['v2ray', 'xray'].filter((t) => VR.datos[t] && VR.datos[t].instalado);
  $('vr-nada').classList.toggle('oculto', instalados.length > 0);
  $('vr-contenido').classList.toggle('oculto', !VR.tipo);
  $('vr-nuevo').disabled = !VR.tipo;
  texto('vr-resumen', instalados.length
    ? instalados.map((t) => `${VR_NOMBRE[t]}: ${(VR.datos[t].clientes || []).length} usuarios`).join(' · ')
    : 'Sin servicios instalados');

  // pestañas
  const pe = $('vr-pestanas');
  pe.replaceChildren();
  pe.classList.toggle('oculto', instalados.length === 0);
  for (const t of instalados) {
    const b = el('button', 'pestana', VR_NOMBRE[t]);
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(t === VR.tipo));
    b.append(el('span', '', (VR.datos[t].clientes || []).length));
    b.addEventListener('click', () => { VR.tipo = t; VR.filtro = 'todos'; pintarVray(); });
    pe.append(b);
  }
  if (!VR.tipo) return;
  const d = VR.datos[VR.tipo];

  // datos del servicio
  const info = $('vr-info');
  info.replaceChildren();
  if (d.error) {
    info.append(el('p', 'error', d.error));
  } else {
    const chip = (et, val, punto) => {
      const c = el('span', 'chip');
      if (punto !== undefined) { const p = el('span', 'punto' + (punto ? '' : ' apagado')); c.append(p); }
      c.append(et + ' ');
      c.append(el('b', '', val));
      info.append(c);
    };
    chip('Servicio', d.activo ? 'Activo' : 'Detenido', !!d.activo);
    chip('Protocolo', (d.proto || '').toUpperCase());
    chip('Puerto', d.puerto || '—');
    chip('Red', (d.red || '').toUpperCase());
    chip('TLS', d.tls === 'tls' ? 'Sí' : 'No');
    if (d.ruta) chip(d.red === 'grpc' ? 'Servicio gRPC' : 'Path', d.ruta);
    chip('Dirección', d.direccion || '—');
    if (VR.tipo === 'xray' && !d.stats) chip('Consumo', 'activa las estadísticas en el menú de Xray');
  }

  // filtros
  const lista = d.clientes || [];
  const cf = $('vr-filtros');
  cf.replaceChildren();
  for (const [id, nombre, fn] of VR_FILTROS) {
    const b = el('button', 'filtro', nombre + ' ');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(VR.filtro === id));
    b.append(el('span', '', lista.filter(fn).length));
    b.addEventListener('click', () => { VR.filtro = id; pintarVray(); });
    cf.append(b);
  }

  const q = $('vr-buscar').value.trim().toLowerCase();
  const fn = VR_FILTROS.find((f) => f[0] === VR.filtro)[2];
  const filas = lista.filter((c) => fn(c) && (!q || c.email.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)))
    .sort((a, b) => a.email.localeCompare(b.email));
  const tb = $('vr-filas');
  tb.replaceChildren();
  for (const c of filas) tb.append(filaVray(c, d));
  const vacio = $('vr-vacio');
  vacio.classList.toggle('oculto', filas.length > 0);
  vacio.textContent = !lista.length
    ? `Aún no hay usuarios en ${VR_NOMBRE[VR.tipo]}. Crea el primero con «Crear usuario».`
    : 'Ningún usuario coincide con la búsqueda.';
}
$('vr-buscar').addEventListener('input', pintarVray);

function filaVray(c, d) {
  const tr = el('tr');
  const est = estadoVr(c);
  const c1 = el('td', 'c-usr');
  const box = el('div', 'usr');
  const txt = el('div', 'usr-txt');
  txt.append(el('span', 'usr-nom', c.email), el('span', 'usr-uuid', c.id.slice(0, 8) + '…' + c.id.slice(-4)));
  box.append(el('span', 'avatar', c.email.slice(0, 2)), txt);
  c1.append(box);

  const c2 = el('td', 'c-est');
  c2.append(el('span', 'estado ' + est, ETIQUETA[est]));

  const c3 = el('td'); c3.dataset.et = 'Vence';
  const col = el('div', 'columna');
  col.append(el('span', '', c.expira ? fechaCorta(c.expira) : 'Sin vencimiento'));
  if (c.expira) col.append(el('span', 'chico-tenue' + (c.dias < 0 ? ' rojo' : c.dias <= 3 ? ' ambar' : ''), textoDias(c.dias)));
  c3.append(col);

  const c4 = el('td'); c4.dataset.et = 'Consumo';
  if (d.stats) {
    const k = el('div', 'columna');
    k.append(el('span', '', bytes((c.subida || 0) + (c.bajada || 0))));
    k.append(el('span', 'chico-tenue', `↓ ${bytes(c.bajada)} · ↑ ${bytes(c.subida)}`));
    c4.append(k);
  } else {
    c4.append(el('span', 'chico-tenue', '—'));
  }

  const c5 = el('td', 'c-acc');
  const acc = el('div', 'acciones');
  const boton = (ico, etiqueta, fn, clase) => {
    const b = el('button', 'accion' + (clase ? ' ' + clase : ''));
    b.type = 'button'; b.title = etiqueta; b.setAttribute('aria-label', `${etiqueta} ${c.email}`);
    b.append(icono(ICONOS[ico]));
    b.addEventListener('click', () => fn(c, b));
    acc.append(b);
  };
  boton('qr', 'Ver link y QR', mostrarLink);
  boton('copiar', 'Copiar link', copiarLinkVr);
  boton('renovar', 'Renovar', renovarVr);
  boton(c.bloqueado ? 'abierto' : 'candado', c.bloqueado ? 'Desbloquear' : 'Bloquear', bloquearVr, c.bloqueado ? 'activa' : '');
  boton('borrar', 'Eliminar', eliminarVr, 'peligro');
  c5.append(acc);
  tr.append(c1, c2, c3, c4, c5);
  return tr;
}
ICONOS.qr = ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h3v3h-3z', 'M20 14v.01M14 20h.01M17 17h4v4h-4'];

async function accionVr(accion, cuerpo, ok) {
  const r = await api(`/api/vray/${VR.tipo}/${accion}`, { method: 'POST', body: cuerpo });
  if (ok) avisar(ok);
  await cargarVray();
  return r;
}

async function copiarTexto(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch (e) {
    const a = document.createElement('textarea');
    a.value = t; document.body.append(a); a.select();
    const ok = document.execCommand('copy'); a.remove(); return ok;
  }
}
async function copiarLinkVr(c) {
  avisar(await copiarTexto(c.link) ? `Link de ${c.email} copiado` : 'No se pudo copiar', false);
}

function mostrarLink(c) {
  const d = VR.datos[VR.tipo];
  texto('l-titulo', `${c.email} · ${VR_NOMBRE[VR.tipo]}`);
  const dl = $('l-datos');
  dl.replaceChildren();
  const dato = (k, v) => { if (!v) return; dl.append(el('dt', '', k), el('dd', '', v)); };
  dato('Dirección', d.direccion);
  dato('Puerto', d.puerto);
  dato('UUID', c.id);
  dato('Protocolo', (d.proto || '').toUpperCase());
  dato('Red', d.red);
  dato(d.red === 'grpc' ? 'Servicio' : 'Path', d.ruta);
  dato('Host', d.host);
  dato('TLS', d.tls);
  dato('SNI', d.sni);
  dato('Vence', c.expira ? fechaCorta(c.expira) : 'Sin vencimiento');
  if (c.bloqueado) dato('Estado', 'Bloqueado');
  texto('l-texto', c.link);
  try { QR.dibujar($('l-qr'), c.link, 6); } catch (e) { /* link enorme */ }
  texto('l-copiar', 'Copiar link');
  $('dlg-link').showModal();
}
$('l-copiar').addEventListener('click', async () => {
  texto('l-copiar', await copiarTexto($('l-texto').textContent) ? '¡Copiado!' : 'No se pudo copiar');
});

function renovarVr(c) {
  const base = c.expira && c.dias >= 0 ? c.expira : '';
  abrirRenovarCon({
    titulo: 'Renovar ' + c.email,
    actual: c.expira ? `Vence: ${fechaCorta(c.expira)} (${textoDias(c.dias)})` : 'Sin vencimiento',
    etiqueta: base ? 'Días a sumar' : 'Días a partir de hoy',
    desde: base,
    alGuardar: (dias) => accionVr('renovar', { email: c.email, dias }, `${c.email} renovado`),
  });
}
async function bloquearVr(c, btn) {
  btn.disabled = true;
  try {
    await accionVr('bloquear', { email: c.email, bloquear: !c.bloqueado },
      c.bloqueado ? `${c.email} desbloqueado` : `${c.email} bloqueado`);
  } catch (e) { if (e.message !== 'sesion') avisar(e.message, true); btn.disabled = false; }
}
function eliminarVr(c) {
  confirmar(`¿Eliminar ${c.email}?`,
    `Se borra de ${VR_NOMBRE[VR.tipo]} y su link deja de funcionar. No se puede deshacer.`,
    () => accionVr('eliminar', { email: c.email }, `${c.email} eliminado`));
}

// ---------- crear ----------
function venceVr() {
  const n = parseInt($('v-dias').value, 10);
  texto('v-vence', n === 0 && VR.tipo === 'v2ray' ? 'Sin vencimiento' : fechaEnDias(n || 0));
}
$('vr-nuevo').addEventListener('click', () => {
  if (!VR.tipo) return;
  $('form-vray').reset();
  $('v-error').classList.add('oculto');
  texto('v-titulo', 'Nuevo usuario · ' + VR_NOMBRE[VR.tipo]);
  const v2 = VR.tipo === 'v2ray';
  $('v-dias').min = v2 ? 0 : 1;
  texto('v-dias-ayuda', v2 ? '0 = sin vencimiento.' : 'De 1 a 3650.');
  texto('v-email-ayuda', v2 ? '2 a 32: letras, números y guion bajo.' : '4 a 32: letras, números y guion bajo.');
  venceVr();
  $('dlg-vray').showModal();
  $('v-email').focus();
});
$('v-dias').addEventListener('input', venceVr);
$('v-email').addEventListener('input', (ev) => {
  const v = ev.target.value.replace(/[^A-Za-z0-9_]/g, '');
  if (v !== ev.target.value) ev.target.value = v;
});
$('form-vray').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const email = $('v-email').value.trim();
  const dias = parseInt($('v-dias').value, 10);
  const uuid = $('v-uuid').value.trim();
  const v2 = VR.tipo === 'v2ray';
  const err = $('v-error');
  let msg = '';
  if (!new RegExp(`^[A-Za-z0-9_]{${v2 ? 2 : 4},32}$`).test(email)) msg = $('v-email-ayuda').textContent;
  else if (!(dias >= (v2 ? 0 : 1) && dias <= 3650)) msg = 'Días inválidos.';
  else if (uuid && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) msg = 'UUID inválido.';
  if (msg) { err.textContent = msg; err.classList.remove('oculto'); return; }
  err.classList.add('oculto');
  const btn = $('v-guardar');
  ocupado(btn, true, 'Creando…');
  try {
    await accionVr('crear', { email, dias, uuid }, `Usuario ${email} creado`);
    $('dlg-vray').close();
    const nuevo = (VR.datos[VR.tipo].clientes || []).find((c) => c.email === email);
    if (nuevo) mostrarLink(nuevo);
  } catch (e) {
    if (e.message !== 'sesion') { err.textContent = e.message; err.classList.remove('oculto'); }
  } finally { ocupado(btn, false, 'Crear usuario'); }
});

// =========================================================
//  TERMINAL (emulador VT100/xterm compacto, sin librerías)
//  Interpreta lo que usan los menús de SN PLUS: colores (16, 256 y
//  RGB), negritas, limpiar pantalla, mover cursor, borrar líneas,
//  pantalla alterna y regiones de scroll.
// =========================================================
class Terminal {
  constructor(caja) {
    this.caja = caja;
    this.hist = el('div', 'term-hist');
    this.pant = el('div', 'term-pant');
    caja.replaceChildren(this.hist, this.pant);
    this.dec = new TextDecoder('utf-8');
    this.onDatos = null;   // respuestas de la terminal (DSR)
    this.redim(80, 30);
  }
  redim(cols, filas) {
    const viejo = this.p;
    this.cols = cols; this.filas = filas;
    this.p = [];
    for (let y = 0; y < filas; y++) this.p.push(this.linea());
    if (viejo) for (let y = 0; y < Math.min(viejo.length, filas); y++)
      for (let x = 0; x < Math.min(viejo[y].length, cols); x++) this.p[y][x] = viejo[y][x];
    this.x = Math.min(this.x || 0, cols - 1); this.y = Math.min(this.y || 0, filas - 1);
    this.arriba = 0; this.abajo = filas - 1;
    if (!this.estilo) this.reiniciar();
    this.pintar();
  }
  reiniciar() {
    this.estilo = { f: -1, b: -1, n: false, t: false, i: false, s: false, inv: false };
    this.estado = 0; this.params = ''; this.visible = true; this.alterna = null; this.guardado = null;
    this.arriba = 0; this.abajo = this.filas - 1; this.pendiente = false;
  }
  linea() { const l = []; for (let x = 0; x < this.cols; x++) l.push(null); return l; }
  borrarTodo() {
    for (let y = 0; y < this.filas; y++) this.p[y] = this.linea();
    this.hist.replaceChildren();
  }
  escribir(bytes) {
    const t = this.dec.decode(bytes, { stream: true });
    for (const ch of t) this.caracter(ch);
    if (!this.pendientePintar) {
      this.pendientePintar = true;
      requestAnimationFrame(() => { this.pendientePintar = false; this.pintar(); });
    }
  }
  caracter(ch) {
    const c = ch.codePointAt(0);
    if (this.estado === 0) {
      if (c === 0x1b) { this.estado = 1; return; }
      if (c === 13) { this.x = 0; this.pendiente = false; return; }
      if (c === 10 || c === 11 || c === 12) { this.saltoLinea(); this.pendiente = false; return; }
      if (c === 8) { if (this.x > 0) this.x--; this.pendiente = false; return; }
      if (c === 9) { this.x = Math.min(this.cols - 1, (this.x + 8) & ~7); return; }
      if (c < 32 || c === 127) return;
      if (this.pendiente) { this.x = 0; this.saltoLinea(); this.pendiente = false; }
      this.p[this.y][this.x] = { c: ch, e: this.estilo };
      if (this.x >= this.cols - 1) this.pendiente = true; else this.x++;
      return;
    }
    if (this.estado === 1) {   // después de ESC
      this.estado = 0;
      if (ch === '[') { this.estado = 2; this.params = ''; return; }
      if (ch === ']') { this.estado = 3; return; }
      if (ch === '(' || ch === ')' || ch === '#') { this.estado = 4; return; }
      if (ch === '7') { this.guardar(); return; }
      if (ch === '8') { this.restaurar(); return; }
      if (ch === 'D') { this.saltoLinea(); return; }
      if (ch === 'E') { this.x = 0; this.saltoLinea(); return; }
      if (ch === 'M') { if (this.y === this.arriba) this.bajarRegion(1); else if (this.y > 0) this.y--; return; }
      if (ch === 'c') { this.reiniciar(); this.borrarTodo(); this.x = this.y = 0; }
      return;
    }
    if (this.estado === 2) {   // CSI
      if (c >= 0x30 && c <= 0x3f) { this.params += ch; return; }
      if (c >= 0x20 && c <= 0x2f) return;
      this.estado = 0;
      this.csi(ch, this.params);
      return;
    }
    if (this.estado === 3) {   // OSC hasta BEL o ESC
      if (c === 7) this.estado = 0;
      else if (c === 0x1b) this.estado = 1;
      return;
    }
    if (this.estado === 4) { this.estado = 0; }
  }
  guardar() { this.guardado = { x: this.x, y: this.y, e: this.estilo }; }
  restaurar() { if (this.guardado) { this.x = this.guardado.x; this.y = this.guardado.y; this.estilo = this.guardado.e; } }
  saltoLinea() {
    if (this.y === this.abajo) this.subirRegion(1);
    else if (this.y < this.filas - 1) this.y++;
  }
  subirRegion(n) {
    for (let i = 0; i < n; i++) {
      const sale = this.p.splice(this.arriba, 1)[0];
      if (this.arriba === 0 && !this.alterna) this.alHistorial(sale);
      this.p.splice(this.abajo, 0, this.linea());
    }
  }
  bajarRegion(n) {
    for (let i = 0; i < n; i++) {
      this.p.splice(this.abajo, 1);
      this.p.splice(this.arriba, 0, this.linea());
    }
  }
  alHistorial(l) {
    this.hist.append(this.renglon(l, -1));
    while (this.hist.childElementCount > 1000) this.hist.firstChild.remove();
  }
  csi(f, params) {
    const priv = params.startsWith('?');
    const n = params.replace(/^[?>=]/, '').split(';').map((v) => (v === '' ? NaN : parseInt(v, 10)));
    const a = (i, def) => (Number.isNaN(n[i]) || n[i] === undefined ? def : n[i]);
    const lim = (v, max) => Math.max(0, Math.min(max, v));
    this.pendiente = false;
    switch (f) {
      case 'm': this.sgr(n); break;
      case 'H': case 'f': this.y = lim(a(0, 1) - 1, this.filas - 1); this.x = lim(a(1, 1) - 1, this.cols - 1); break;
      case 'A': this.y = lim(this.y - a(0, 1), this.filas - 1); break;
      case 'B': case 'e': this.y = lim(this.y + a(0, 1), this.filas - 1); break;
      case 'C': case 'a': this.x = lim(this.x + a(0, 1), this.cols - 1); break;
      case 'D': this.x = lim(this.x - a(0, 1), this.cols - 1); break;
      case 'E': this.y = lim(this.y + a(0, 1), this.filas - 1); this.x = 0; break;
      case 'F': this.y = lim(this.y - a(0, 1), this.filas - 1); this.x = 0; break;
      case 'G': case '`': this.x = lim(a(0, 1) - 1, this.cols - 1); break;
      case 'd': this.y = lim(a(0, 1) - 1, this.filas - 1); break;
      case 'J': {
        const m = a(0, 0);
        if (m === 0) { this.borrarLinea(this.y, this.x, this.cols); for (let y = this.y + 1; y < this.filas; y++) this.p[y] = this.linea(); }
        else if (m === 1) { this.borrarLinea(this.y, 0, this.x + 1); for (let y = 0; y < this.y; y++) this.p[y] = this.linea(); }
        else { for (let y = 0; y < this.filas; y++) this.p[y] = this.linea(); if (m === 3) this.hist.replaceChildren(); }
        break;
      }
      case 'K': {
        const m = a(0, 0);
        if (m === 0) this.borrarLinea(this.y, this.x, this.cols);
        else if (m === 1) this.borrarLinea(this.y, 0, this.x + 1);
        else this.p[this.y] = this.linea();
        break;
      }
      case 'X': this.borrarLinea(this.y, this.x, Math.min(this.cols, this.x + a(0, 1))); break;
      case 'P': { const l = this.p[this.y]; l.splice(this.x, a(0, 1)); while (l.length < this.cols) l.push(null); break; }
      case '@': { const l = this.p[this.y]; for (let i = 0; i < a(0, 1); i++) l.splice(this.x, 0, null); l.length = this.cols; break; }
      case 'L': if (this.y >= this.arriba && this.y <= this.abajo) { const t = this.arriba; this.arriba = this.y; this.bajarRegion(a(0, 1)); this.arriba = t; } break;
      case 'M': if (this.y >= this.arriba && this.y <= this.abajo) { const t = this.arriba; this.arriba = this.y; this.subirRegionSinHist(a(0, 1)); this.arriba = t; } break;
      case 'S': this.subirRegion(a(0, 1)); break;
      case 'T': this.bajarRegion(a(0, 1)); break;
      case 'r': this.arriba = lim(a(0, 1) - 1, this.filas - 1); this.abajo = lim(a(1, this.filas) - 1, this.filas - 1); this.x = 0; this.y = 0; break;
      case 's': this.guardar(); break;
      case 'u': this.restaurar(); break;
      case 'n': if (a(0, 0) === 6 && this.onDatos) this.onDatos(`\x1b[${this.y + 1};${this.x + 1}R`); break;
      case 'c': if (!priv && this.onDatos) this.onDatos('\x1b[?1;2c'); break;
      case 'h': case 'l':
        if (priv) for (const m of n) {
          if (m === 25) this.visible = f === 'h';
          if (m === 1049 || m === 47 || m === 1047) this.pantallaAlterna(f === 'h');
        }
        break;
      default: break;
    }
  }
  subirRegionSinHist(n) {
    for (let i = 0; i < n; i++) { this.p.splice(this.arriba, 1); this.p.splice(this.abajo, 0, this.linea()); }
  }
  pantallaAlterna(si) {
    if (si && !this.alterna) {
      this.alterna = { p: this.p, x: this.x, y: this.y };
      this.p = []; for (let y = 0; y < this.filas; y++) this.p.push(this.linea());
    } else if (!si && this.alterna) {
      this.p = this.alterna.p; this.x = this.alterna.x; this.y = this.alterna.y; this.alterna = null;
    }
  }
  borrarLinea(y, desde, hasta) { for (let x = desde; x < hasta && x < this.cols; x++) this.p[y][x] = null; }
  sgr(n) {
    if (!n.length || (n.length === 1 && Number.isNaN(n[0]))) n = [0];
    let e = { ...this.estilo };
    for (let i = 0; i < n.length; i++) {
      const v = Number.isNaN(n[i]) ? 0 : n[i];
      if (v === 0) e = { f: -1, b: -1, n: false, t: false, i: false, s: false, inv: false };
      else if (v === 1) e.n = true;
      else if (v === 2) e.t = true;
      else if (v === 3) e.i = true;
      else if (v === 4) e.s = true;
      else if (v === 7) e.inv = true;
      else if (v === 22) { e.n = false; e.t = false; }
      else if (v === 23) e.i = false;
      else if (v === 24) e.s = false;
      else if (v === 27) e.inv = false;
      else if (v >= 30 && v <= 37) e.f = v - 30;
      else if (v === 39) e.f = -1;
      else if (v >= 40 && v <= 47) e.b = v - 40;
      else if (v === 49) e.b = -1;
      else if (v >= 90 && v <= 97) e.f = v - 82;
      else if (v >= 100 && v <= 107) e.b = v - 92;
      else if (v === 38 || v === 48) {
        let col = -1;
        if (n[i + 1] === 5) { col = n[i + 2]; i += 2; }
        else if (n[i + 1] === 2) { col = `rgb(${n[i + 2] | 0},${n[i + 3] | 0},${n[i + 4] | 0})`; i += 4; }
        if (v === 38) e.f = col; else e.b = col;
      }
    }
    this.estilo = e;
  }
  // ---------- dibujo ----------
  static color256(c) {
    if (c < 16) return null;
    if (c >= 232) { const g = 8 + (c - 232) * 10; return `rgb(${g},${g},${g})`; }
    c -= 16;
    const k = [0, 95, 135, 175, 215, 255];
    return `rgb(${k[Math.floor(c / 36)]},${k[Math.floor(c / 6) % 6]},${k[c % 6]})`;
  }
  span(texto, e, cursor) {
    const s = document.createElement('span');
    s.textContent = texto;
    let f = e ? e.f : -1, b = e ? e.b : -1;
    if (e && e.n && typeof f === 'number' && f >= 0 && f < 8) f += 8;   // negrita = color brillante
    if (e && e.inv) { const t = f; f = b === -1 ? 'fondo' : b; b = t === -1 ? 'texto' : t; }
    const cls = [];
    if (f === 'fondo') cls.push('tf-inv'); else if (typeof f === 'number' && f >= 0 && f < 16) cls.push('tf' + f);
    else if (typeof f === 'number' && f >= 16) s.style.color = Terminal.color256(f);
    else if (typeof f === 'string') s.style.color = f;
    if (b === 'texto') cls.push('tb-inv'); else if (typeof b === 'number' && b >= 0 && b < 16) cls.push('tb' + b);
    else if (typeof b === 'number' && b >= 16) s.style.backgroundColor = Terminal.color256(b);
    else if (typeof b === 'string') s.style.backgroundColor = b;
    if (e && e.n) cls.push('tn');
    if (e && e.t) cls.push('tt');
    if (e && e.i) cls.push('ti');
    if (e && e.s) cls.push('ts');
    if (cursor) cls.push('tcur');
    if (cls.length) s.className = cls.join(' ');
    return s;
  }
  renglon(l, xCursor) {
    const d = document.createElement('div');
    let ultimo = l.length - 1;
    while (ultimo >= 0 && !l[ultimo] && ultimo !== xCursor) ultimo--;
    let txt = '', est;
    const vaciar = () => { if (txt) d.append(this.span(txt, est, false)); txt = ''; };
    for (let x = 0; x <= ultimo; x++) {
      const c = l[x], e = c ? c.e : null;
      if (x === xCursor) { vaciar(); d.append(this.span(c ? c.c : ' ', e, true)); est = undefined; continue; }
      if (e !== est) { vaciar(); est = e; }
      txt += c ? c.c : ' ';
    }
    vaciar();
    if (!d.childNodes.length) d.textContent = ' ';
    return d;
  }
  pintar() {
    const filas = [];
    for (let y = 0; y < this.filas; y++)
      filas.push(this.renglon(this.p[y], this.visible && y === this.y ? Math.min(this.x, this.cols - 1) : -1));
    this.pant.replaceChildren(...filas);
    if (this.alPintar) this.alPintar();
  }
}

// =========================================================
//  CONSOLA EN VIVO (diálogo)
// =========================================================
const CONSOLA = { id: 0, term: null, desde: 0, viva: false, cola: '', envio: null, alCerrar: null };

// Los menús de SN PLUS miden ~62 columnas: en pantallas chicas se achica
// la letra para que quepan sin cortarse.
const MIN_COLS = 64;
function medirConsola() {
  const caja = $('k-term');
  caja.style.fontSize = '';
  let t = medirConsolaUna();
  if (t.cols < MIN_COLS) {
    const base = parseFloat(getComputedStyle(caja).fontSize) || 13;
    caja.style.fontSize = Math.max(8, Math.floor(base * t.cols / MIN_COLS * 10) / 10) + 'px';
    t = medirConsolaUna();
  }
  return t;
}
function medirConsolaUna() {
  const caja = $('k-term');
  const p = document.createElement('span');
  p.className = 'term-medida';
  p.textContent = 'MMMMMMMMMM';
  caja.append(p);
  const ancho = p.getBoundingClientRect().width / 10 || 8, alto = p.getBoundingClientRect().height || 17;
  p.remove();
  const est = getComputedStyle(caja);
  const util = caja.clientWidth - parseFloat(est.paddingLeft) - parseFloat(est.paddingRight);
  const utilAlto = caja.clientHeight - parseFloat(est.paddingTop) - parseFloat(est.paddingBottom);
  return {
    cols: Math.max(40, Math.min(160, Math.floor(util / ancho))),
    filas: Math.max(12, Math.min(60, Math.floor(utilAlto / alto))),
  };
}

function enviarConsola(texto) {
  if (!CONSOLA.viva) return;
  CONSOLA.cola += texto;
  if (CONSOLA.envio) return;
  CONSOLA.envio = setTimeout(async () => {
    const datos = CONSOLA.cola;
    CONSOLA.cola = ''; CONSOLA.envio = null;
    try { await api(`/api/consola/${CONSOLA.id}/escribir`, { method: 'POST', body: { datos } }); }
    catch (e) { /* el lector avisa si terminó */ }
  }, 25);
}

async function leerConsola(id) {
  while (CONSOLA.viva && CONSOLA.id === id) {
    let d;
    try {
      const r = await fetch(`/api/consola/${id}/leer/${CONSOLA.desde}`, { credentials: 'same-origin', cache: 'no-store' });
      if (r.status === 401) { cerrarConsolaLocal(); mostrarLogin(); return; }
      d = await r.json();
      if (!r.ok) { terminoConsola('La consola se cerró.'); return; }
    } catch (e) {
      await new Promise((ok) => setTimeout(ok, 1500));
      continue;
    }
    if (CONSOLA.id !== id) return;
    if (d.datos) {
      const bin = atob(d.datos), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      CONSOLA.term.escribir(bytes);
    }
    CONSOLA.desde = d.hasta;
    if (d.fin) { terminoConsola(d.codigo === 0 ? 'El menú se cerró.' : `El proceso terminó (código ${d.codigo}).`); return; }
  }
}

function terminoConsola(msg) {
  CONSOLA.viva = false;
  $('k-estado').textContent = msg;
  $('k-punto').classList.add('apagado');
  $('k-reabrir').classList.remove('oculto');
  $('k-entrada').disabled = true;
}

let consolaPedida = null;
async function abrirConsola(pedido) {
  consolaPedida = pedido;
  const dlg = $('dlg-consola');
  if (!dlg.open) dlg.showModal();
  texto('k-titulo', pedido.titulo || 'Consola');
  $('k-estado').textContent = 'Conectando…';
  $('k-punto').classList.remove('apagado');
  $('k-reabrir').classList.add('oculto');
  $('k-entrada').disabled = false;
  $('k-entrada').value = '';
  CONSOLA.term = CONSOLA.term || new Terminal($('k-term'));
  CONSOLA.term.onDatos = (t) => enviarConsola(t);
  CONSOLA.term.reiniciar();
  CONSOLA.term.borrarTodo();
  CONSOLA.term.x = CONSOLA.term.y = 0;
  await new Promise((ok) => requestAnimationFrame(ok));
  const tam = medirConsola();
  CONSOLA.term.redim(tam.cols, tam.filas);
  try {
    const r = await api('/api/consola/abrir', { method: 'POST', body: { ...pedido.cuerpo, cols: tam.cols, filas: tam.filas } });
    CONSOLA.id = r.id; CONSOLA.desde = 0; CONSOLA.viva = true;
    texto('k-titulo', r.titulo);
    $('k-estado').textContent = 'En vivo · ' + tam.cols + '×' + tam.filas;
    $('k-term').focus();
    leerConsola(r.id);
  } catch (e) {
    if (e.message !== 'sesion') terminoConsola(e.message);
  }
}

function cerrarConsolaLocal() {
  const id = CONSOLA.id;
  if (id && CONSOLA.viva) api(`/api/consola/${id}/cerrar`, { method: 'POST' }).catch(() => {});
  CONSOLA.viva = false; CONSOLA.id = 0;
}
$('dlg-consola').addEventListener('close', () => {
  cerrarConsolaLocal();
  if (CONSOLA.alCerrar) CONSOLA.alCerrar();
});
// Esc va a la terminal, no cierra el diálogo
$('dlg-consola').addEventListener('cancel', (ev) => { ev.preventDefault(); if (CONSOLA.viva) enviarConsola('\x1b'); });
$('k-cerrar').addEventListener('click', () => $('dlg-consola').close());
// Si se cierra la pestaña con la consola abierta, se cierra también en la VPS.
window.addEventListener('pagehide', () => {
  if (!CONSOLA.viva || !CONSOLA.id) return;
  fetch(`/api/consola/${CONSOLA.id}/cerrar`, { method: 'POST', keepalive: true, credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-SNP': '1' }, body: '{}' }).catch(() => {});
});
$('k-reabrir').addEventListener('click', () => { if (consolaPedida) abrirConsola(consolaPedida); });

const TECLAS = {
  Enter: '\r', Backspace: '\x7f', Tab: '\t', Escape: '\x1b',
  ArrowUp: '\x1b[A', ArrowDown: '\x1b[B', ArrowRight: '\x1b[C', ArrowLeft: '\x1b[D',
  Home: '\x1b[H', End: '\x1b[F', Delete: '\x1b[3~', PageUp: '\x1b[5~', PageDown: '\x1b[6~',
};
$('k-term').addEventListener('keydown', (ev) => {
  if (!CONSOLA.viva) return;
  let s = null;
  if (ev.ctrlKey && !ev.altKey && ev.key.length === 1) {
    const k = ev.key.toLowerCase();
    if (k === 'v') return;   // pegar lo maneja 'paste'
    if (k >= 'a' && k <= 'z') s = String.fromCharCode(k.charCodeAt(0) - 96);
  } else if (TECLAS[ev.key]) s = TECLAS[ev.key];
  else if (ev.key.length === 1 && !ev.metaKey) s = ev.key;
  if (s !== null) { ev.preventDefault(); enviarConsola(s); }
});
$('k-term').addEventListener('paste', (ev) => {
  ev.preventDefault();
  enviarConsola((ev.clipboardData.getData('text') || '').replace(/\r?\n/g, '\r'));
});
$('k-term').addEventListener('click', () => { if (!getSelection().toString()) $('k-term').focus(); });

// barra para celular: escribir una línea y teclas rápidas
$('k-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  enviarConsola($('k-entrada').value + '\r');
  $('k-entrada').value = '';
});
for (const b of document.querySelectorAll('[data-tecla]')) {
  b.addEventListener('click', () => {
    const t = { enter: '\r', ctrlc: '\x03', esc: '\x1b', arriba: '\x1b[A', abajo: '\x1b[B', tab: '\t' }[b.dataset.tecla];
    enviarConsola(t);
  });
}
let redimPend = null;
window.addEventListener('resize', () => {
  if (!CONSOLA.viva) return;
  clearTimeout(redimPend);
  redimPend = setTimeout(() => {
    const t = medirConsola();
    if (t.cols === CONSOLA.term.cols && t.filas === CONSOLA.term.filas) return;
    CONSOLA.term.redim(t.cols, t.filas);
    $('k-estado').textContent = 'En vivo · ' + t.cols + '×' + t.filas;
    api(`/api/consola/${CONSOLA.id}/tam`, { method: 'POST', body: { cols: t.cols, filas: t.filas } }).catch(() => {});
  }, 250);
});

// =========================================================
//  PROTOCOLOS
// =========================================================
let protosLista = [];
const GRUPOS = ['Conexión SSH', 'UDP', 'V2Ray / Xray', 'Extras'];

async function cargarProtos() {
  cargar();
  try {
    const d = await api('/api/protocolos');
    protosLista = d.protocolos || [];
    pintarProtos();
  } catch (e) {
    if (e.message !== 'sesion') texto('pr-resumen', 'No se pudo leer el estado: ' + e.message);
  }
}

function pintarProtos() {
  const activos = protosLista.filter((p) => p.activo && p.conServicio).length;
  const inst = protosLista.filter((p) => p.instalado && p.conServicio).length;
  texto('pr-resumen', `${activos} activos · ${inst} instalados de ${protosLista.filter((p) => p.conServicio).length}`);
  texto('nav-protos', activos);
  const cont = $('pr-grupos');
  cont.replaceChildren();
  for (const g of GRUPOS) {
    const items = protosLista.filter((p) => p.grupo === g);
    if (!items.length) continue;
    const sec = el('section', 'pr-grupo');
    sec.append(el('h2', '', g));
    const grid = el('div', 'pr-grid');
    for (const p of items) grid.append(tarjetaProto(p));
    sec.append(grid);
    cont.append(sec);
  }
}

function tarjetaProto(p) {
  const c = el('article', 'pr-card' + (p.activo ? ' on' : ''));
  const cab = el('div', 'fila-entre');
  cab.append(el('h3', '', p.nombre));
  let est, cls;
  if (!p.conServicio) { est = p.id === 'ssl' ? (p.instalado ? 'Con certificado' : 'Sin certificado') : 'Herramienta'; cls = p.instalado && p.id === 'ssl' ? 'activo' : 'neutro'; }
  else if (p.activo) { est = 'Activo'; cls = 'enlinea'; }
  else if (p.instalado) { est = 'Detenido'; cls = 'vencido'; }
  else { est = 'No instalado'; cls = 'neutro'; }
  cab.append(el('span', 'estado ' + cls, est));
  c.append(cab);

  const pts = el('p', 'pr-puertos mono');
  pts.textContent = p.puertos.length ? p.puertos.join(' · ') : (p.conServicio ? 'Sin puertos' : '');
  if (p.puertos.length || p.conServicio) c.append(pts);

  const acc = el('div', 'pr-acciones');
  const principal = el('button', 'btn btn-borde btn-chico', !p.modulo ? 'Módulo no disponible' : (p.conServicio && !p.instalado ? 'Instalar' : 'Administrar'));
  principal.type = 'button';
  principal.disabled = !p.modulo;
  principal.addEventListener('click', () => {
    CONSOLA.alCerrar = cargarProtos;
    abrirConsola({ titulo: p.nombre, cuerpo: { tipo: 'protocolo', id: p.id } });
  });
  acc.append(principal);
  if (p.controlable) {
    const mini = (ico, etiqueta, accion, clase) => {
      const b = el('button', 'accion' + (clase ? ' ' + clase : ''));
      b.type = 'button'; b.title = etiqueta; b.setAttribute('aria-label', `${etiqueta} ${p.nombre}`);
      b.append(icono(ICONOS[ico]));
      b.addEventListener('click', () => accionProto(p, accion, b));
      acc.append(b);
    };
    if (!p.activo) mini('play', 'Iniciar', 'iniciar');
    if (p.activo && p.sePuedeDetener) mini('stop', 'Detener', 'detener', 'peligro');
    mini('renovar', 'Reiniciar', 'reiniciar');
  }
  c.append(acc);
  return c;
}
ICONOS.play = ['M7 4.5v15l12-7.5z'];
ICONOS.stop = ['M6 6h12v12H6z'];

async function accionProto(p, accion, btn) {
  for (const b of btn.parentElement.querySelectorAll('button')) b.disabled = true;
  try {
    const d = await api(`/api/protocolos/${p.id}/${accion}`, { method: 'POST' });
    protosLista = d.protocolos || protosLista;
    avisar(`${p.nombre}: ${{ iniciar: 'iniciado', detener: 'detenido', reiniciar: 'reiniciado' }[accion]}`);
    pintarProtos();
  } catch (e) {
    if (e.message !== 'sesion') { avisar(e.message, true); pintarProtos(); }
  }
}

$('pr-menu').addEventListener('click', () => {
  CONSOLA.alCerrar = cargarProtos;
  abrirConsola({ titulo: 'Menú SN PLUS', cuerpo: { tipo: 'menu' } });
});

// =========================================================
//  TERMINAL
// =========================================================
$('tm-menu').addEventListener('click', () => {
  CONSOLA.alCerrar = null;
  abrirConsola({ titulo: 'Menú SN PLUS', cuerpo: { tipo: 'menu' } });
});
$('tm-bash').addEventListener('click', () => {
  CONSOLA.alCerrar = null;
  abrirConsola({ titulo: 'Terminal root', cuerpo: { tipo: 'bash' } });
});

// =========================================================
//  RESPALDOS
// =========================================================
let respTipos = [];
function fechaResp(f) {
  if (!f) return '—';
  const [d, h] = f.split(' ');
  return fechaCorta(d) + (h ? ' · ' + h : '');
}
async function cargarResp() {
  cargar();
  try {
    const d = await api('/api/respaldos');
    respTipos = d.tipos || [];
    pintarResp();
  } catch (e) {
    if (e.message !== 'sesion') texto('rs-resumen', 'No se pudo leer: ' + e.message);
  }
}
function pintarResp() {
  const total = respTipos.reduce((n, t) => n + t.respaldos.length, 0);
  texto('rs-resumen', `${total} respaldo${total === 1 ? '' : 's'} guardado${total === 1 ? '' : 's'} en /root`);
  texto('nav-resp', total);
  const cont = $('rs-tipos');
  cont.replaceChildren();
  for (const t of respTipos) {
    const sec = el('section', 'panel panel-tabla');
    const cab = el('div', 'rs-cab');
    cab.append(el('h2', '', t.nombre));
    cab.append(el('span', 'chip', t.instalado ? `${t.usuarios} usuario${t.usuarios === 1 ? '' : 's'} ahora` : 'No instalado en esta VPS'));
    const b = el('button', 'btn btn-borde btn-chico', 'Crear respaldo');
    b.type = 'button';
    b.disabled = !t.instalado || !t.usuarios;
    b.title = !t.usuarios ? 'No hay usuarios para respaldar' : '';
    b.addEventListener('click', () => crearResp(t.tipo, b));
    cab.append(b);
    sec.append(cab);
    if (!t.respaldos.length) {
      sec.append(el('p', 'vacio', 'Sin respaldos todavía.'));
    } else {
      const tabla = el('table', 'tabla rs-tabla');
      const th = el('thead'), tr0 = el('tr');
      for (const [txt, cls] of [['Versión'], ['Fecha'], ['Usuarios'], ['VPS de origen'], ['Tamaño'], ['Acciones', 'der']]) {
        const h = el('th', cls || '', txt); h.scope = 'col'; tr0.append(h);
      }
      th.append(tr0); tabla.append(th);
      const tb = el('tbody');
      t.respaldos.forEach((r, i) => tb.append(filaResp(t, r, i === 0)));
      tabla.append(tb);
      sec.append(tabla);
    }
    cont.append(sec);
  }
}
function filaResp(t, r, nueva) {
  const tr = el('tr');
  const c1 = el('td', 'c-usr');
  const v = el('div', 'usr-txt');
  const lv = el('span', 'ver', 'v' + r.version);
  if (nueva) lv.append(el('span', 'etiq-nueva', 'Más reciente'));
  v.append(lv, el('span', 'usr-uuid', r.nombre));
  c1.append(v);
  const c2 = el('td'); c2.dataset.et = 'Fecha'; c2.append(el('span', '', r.valido ? fechaResp(r.fecha) : 'Archivo dañado'));
  const c3 = el('td', 'mono'); c3.dataset.et = 'Usuarios'; c3.textContent = r.valido ? r.usuarios : '—';
  const c4 = el('td'); c4.dataset.et = 'VPS de origen'; c4.textContent = r.host || '—';
  const c5 = el('td', 'mono'); c5.dataset.et = 'Tamaño'; c5.textContent = bytes(r.tamano);
  const c6 = el('td', 'c-acc');
  const acc = el('div', 'acciones');
  const boton = (ico, etiqueta, fn, clase) => {
    const b = el('button', 'accion' + (clase ? ' ' + clase : ''));
    b.type = 'button'; b.title = etiqueta; b.setAttribute('aria-label', `${etiqueta} ${r.nombre}`);
    b.append(icono(ICONOS[ico]));
    b.addEventListener('click', () => fn(t, r, b));
    acc.append(b);
  };
  boton('restaurar', 'Restaurar', restaurarResp);
  boton('descargar', 'Descargar', descargarResp);
  boton('borrar', 'Eliminar', eliminarResp, 'peligro');
  c6.append(acc);
  tr.append(c1, c2, c3, c4, c5, c6);
  return tr;
}
ICONOS.restaurar = ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5', 'M12 8v4l3 2'];
ICONOS.descargar = ['M12 4v12M7 11l5 5 5-5', 'M4 20h16'];

async function crearResp(tipo, btn) {
  if (btn) btn.disabled = true;
  try {
    const d = await api('/api/respaldos/crear', { method: 'POST', body: { tipo } });
    const hechos = (d.creados || []).map((c) => `${c.nombre} (${c.usuarios})`).join(', ');
    avisar('Respaldo creado: ' + hechos);
    for (const e of d.errores || []) avisar(e, true);
    await cargarResp();
  } catch (e) {
    if (e.message !== 'sesion') avisar(e.message, true);
    if (btn) btn.disabled = false;
  }
}
$('rs-todo').addEventListener('click', () => crearResp('todos', $('rs-todo')).finally(() => { $('rs-todo').disabled = false; }));

function restaurarResp(t, r) {
  confirmar(`¿Restaurar v${r.version} de ${t.nombre}?`,
    `Se agregan los ${r.usuarios} usuarios del respaldo que no existan en esta VPS. Los que ya existen no se tocan.`,
    async () => {
      const d = await api('/api/respaldos/restaurar', { method: 'POST', body: { nombre: r.nombre } });
      avisar(`${t.nombre}: ${d.restaurados} restaurados · ${d.existian} ya existían${d.fallaron ? ' · ' + d.fallaron + ' fallaron' : ''}`, d.fallaron > 0);
      await cargarResp();
    }, { boton: 'Restaurar', peligro: false });
}
function descargarResp(t, r) {
  const a = document.createElement('a');
  a.href = '/api/respaldos/descargar/' + encodeURIComponent(r.nombre);
  a.download = r.nombre;
  document.body.append(a); a.click(); a.remove();
}
function eliminarResp(t, r) {
  confirmar(`¿Eliminar ${r.nombre}?`, 'Se borra el archivo de /root. No se puede deshacer.',
    async () => {
      await api('/api/respaldos/eliminar', { method: 'POST', body: { nombre: r.nombre } });
      avisar(r.nombre + ' eliminado');
      await cargarResp();
    });
}
$('rs-archivo').addEventListener('change', async (ev) => {
  const f = ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  if (f.size > 3 * 1024 * 1024) { avisar('El archivo es demasiado grande para ser un respaldo.', true); return; }
  const buf = new Uint8Array(await f.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  try {
    const d = await api('/api/respaldos/subir', { method: 'POST', body: { datos: btoa(bin) } });
    avisar(`Respaldo subido como ${d.nombre}. Ya puedes restaurarlo.`);
    await cargarResp();
  } catch (e) { if (e.message !== 'sesion') avisar(e.message, true); }
});
// ---------- inicio ----------
api('/api/sesion').then(mostrarApp).catch(() => mostrarLogin());
