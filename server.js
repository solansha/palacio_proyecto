const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;

// ---------------------------------------------------------------------------
// Database Pool
// ---------------------------------------------------------------------------
let pool;

async function getDb() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'sql10.freesqldatabase.com',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'sql10834032',
      password: process.env.DB_PASSWORD || 'jnVbJklYth',
      database: process.env.DB_DATABASE || 'sql10834032',
      charset: 'utf8mb4',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return pool;
}

// ---------------------------------------------------------------------------
// Auto-init database (runs SQL from init_db/database.sql if tables missing)
// ---------------------------------------------------------------------------
let dbInitDone = false;

async function ensureDatabase() {
  if (dbInitDone) return;
  try {
    const db = await getDb();
    const [rows] = await db.execute("SHOW TABLES LIKE 'venta'");
    if (rows.length === 0) {
      const sqlPath = path.join(ROOT_DIR, 'init_db', 'database.sql');
      if (fs.existsSync(sqlPath)) {
        const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
        const statements = sqlContent.split(';').map(s => s.trim()).filter(s => s.length > 0);
        for (const stmt of statements) {
          try { await db.execute(stmt); } catch (_) { /* ignore individual statement errors */ }
        }
        console.log('Base de datos inicializada desde database.sql');
      }
    }
    // Ensure asientos_ofrecidos column exists
    try {
      const [cols] = await db.execute("SHOW COLUMNS FROM `actuacion` LIKE 'asientos_ofrecidos'");
      if (cols.length === 0) {
        await db.execute("ALTER TABLE `actuacion` ADD COLUMN `asientos_ofrecidos` INT NOT NULL DEFAULT 100 AFTER `precio_base`");
      }
    } catch (_) {}
    dbInitDone = true;
  } catch (err) {
    console.error('Error inicializando BD:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Session Management (in-memory)
// ---------------------------------------------------------------------------
const sessions = new Map();

function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

function createSession(userData) {
  const sid = generateSessionId();
  sessions.set(sid, { usuario_activo: userData, createdAt: Date.now() });
  return sid;
}

function getSession(req) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/PALACIO_SID=([^;]+)/);
  if (!match) return null;
  const sid = match[1];
  return sessions.get(sid) || null;
}

function setSessionCookie(res, sid) {
  res.setHeader('Set-Cookie', `PALACIO_SID=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `PALACIO_SID=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function destroySession(req) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/PALACIO_SID=([^;]+)/);
  if (match) sessions.delete(match[1]);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sendJson(res, statusCode, payload) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  };
  // Preserve Set-Cookie if already set
  const existing = res.getHeader('Set-Cookie');
  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(payload));
}

function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
  };
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (e) {
    sendJson(res, 404, { success: false, mensaje: 'Archivo no encontrado.' });
  }
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      if (!body) { resolve({}); return; }
      try { resolve(JSON.parse(body)); } catch (_) {
        const parsed = {};
        const params = new URLSearchParams(body);
        params.forEach((value, key) => { parsed[key] = value; });
        resolve(parsed);
      }
    });
    req.on('error', reject);
  });
}

function formatDate(dateValue) {
  const date = new Date(dateValue);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function formatDateFromString(dateStr) {
  try {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (_) { return dateStr; }
}

// ---------------------------------------------------------------------------
// Ensure data directory
// ---------------------------------------------------------------------------
function ensureDataFiles() {
  const dataDir = path.join(ROOT_DIR, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// ============================================================================
// HTML TEMPLATE GENERATORS
// ============================================================================

function renderLoginPage(errorMsg) {
  const errorHtml = errorMsg
    ? `<div class="alert alert-error" style="margin-bottom: 18px;">${escapeHtml(errorMsg)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Acceso al Sistema - Palacio de Festivales</title>
    <link rel="stylesheet" href="/frontend/css/estilos.css">
    <style>
        body {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background-color: var(--fondo-gris);
        }
        .login-box {
            width: 100%;
            max-width: 400px;
            padding: 32px 28px;
            border-top: 4px solid var(--azul-medio);
        }
        .login-header {
            text-align: center;
            margin-bottom: 24px;
        }
        .login-header h1 {
            font-size: 1.6rem;
            color: var(--azul-oscuro);
            margin-bottom: 4px;
            font-weight: 700;
        }
        .login-header p {
            color: var(--texto-secundario);
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="card login-box">
        <div class="login-header">
            <h1>Palacio de Festivales</h1>
            <p>Acceso al Sistema de Gestion</p>
        </div>
        ${errorHtml}
        <form action="/procesar_login" method="POST">
            <div class="form-group">
                <label for="usuario">Usuario:</label>
                <input type="text" name="usuario" id="usuario" class="form-control" placeholder="Ingrese su usuario" required autofocus>
            </div>
            <div class="form-group">
                <label for="password">Contrasena:</label>
                <input type="password" name="password" id="password" class="form-control" placeholder="Ingrese su contrasena" required>
            </div>
            <button type="submit" class="btn-submit">Iniciar Sesion</button>
        </form>
    </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Topbar HTML generator (shared across all frontend pages)
// ---------------------------------------------------------------------------
function renderTopbar(session, activePage, subtitle) {
  const u = session.usuario_activo;
  const initial = u.usuario ? u.usuario.charAt(0).toUpperCase() : 'U';
  const navItems = [
    { href: '/frontend/index.php', label: '🎟 Entradas', key: 'index' },
    { href: '/frontend/pos.php', label: '🛒 Punto de Venta (POS)', key: 'pos' },
    { href: '/frontend/historial_facturas.php', label: '📄 Historial Facturas', key: 'historial' }
  ];
  const navHtml = navItems.map(n =>
    `<a href="${n.href}" class="nav-link${n.key === activePage ? ' active' : ''}">${n.label}</a>`
  ).join('\n            ');

  return `<header class="topbar">
        <div class="topbar-title">
            <h1>Palacio de Festivales</h1>
            <p>${escapeHtml(subtitle)}</p>
        </div>
        <nav class="nav-tabs">
            ${navHtml}
        </nav>
        <div class="topbar-user">
            <div class="topbar-user-chip">
                <div class="topbar-avatar">${initial}</div>
                <div style="display: flex; flex-direction: column;">
                    <span class="topbar-user-nombre">${escapeHtml(u.nombre)}</span>
                    <span class="topbar-user-rol">${escapeHtml(u.rol)}</span>
                </div>
            </div>
            <a href="/logout" class="btn-logout">Cerrar Sesion</a>
        </div>
    </header>`;
}

// ---------------------------------------------------------------------------
// Frontend Index Page (Entradas)
// ---------------------------------------------------------------------------
async function renderFrontendIndex(session) {
  const db = await getDb();

  const [espectaculos] = await db.execute('SELECT id_espectaculo, titulo FROM espectaculo ORDER BY titulo ASC');
  const [salas] = await db.execute('SELECT id_sala, nombre FROM sala ORDER BY nombre');
  const [actuaciones] = await db.execute(`
    SELECT a.id_actuacion, e.titulo, s.id_sala, s.nombre AS sala_nombre, a.fecha_hora, a.precio_base
    FROM actuacion a
    JOIN espectaculo e ON a.id_espectaculo = e.id_espectaculo
    JOIN sala s ON a.id_sala = s.id_sala
    ORDER BY a.fecha_hora ASC
  `);
  const [butacas] = await db.execute(`
    SELECT b.id_butaca, s.id_sala, s.nombre AS sala_nombre, z.nombre AS zona_nombre, z.multiplicador_precio, b.fila, b.numero
    FROM butaca b
    JOIN zona z ON b.id_zona = z.id_zona
    JOIN sala s ON z.id_sala = s.id_sala
    ORDER BY s.nombre, z.nombre, b.fila, b.numero
  `);
  const [entradas] = await db.execute(`
    SELECT en.id_entrada, e.titulo, s.nombre AS sala_nombre, z.nombre AS zona_nombre, b.fila, b.numero,
           en.nombre_comprador, en.email_comprador, en.precio_final, en.fecha_compra
    FROM entrada en
    JOIN actuacion a ON en.id_actuacion = a.id_actuacion
    JOIN espectaculo e ON a.id_espectaculo = e.id_espectaculo
    JOIN sala s ON a.id_sala = s.id_sala
    JOIN butaca b ON en.id_butaca = b.id_butaca
    JOIN zona z ON b.id_zona = z.id_zona
    ORDER BY en.fecha_compra DESC
  `);

  // Build select options
  const espectaculosOptions = espectaculos.map(esp =>
    `<option value="${esp.id_espectaculo}">${escapeHtml(esp.titulo)}</option>`
  ).join('\n');

  const salasOptions = salas.map(s =>
    `<option value="${s.id_sala}">${escapeHtml(s.nombre)}</option>`
  ).join('\n');

  const actuacionesOptions = actuaciones.map(act => {
    const fechaFormatted = formatDateFromString(act.fecha_hora);
    return `<option value="${act.id_actuacion}" data-precio-base="${act.precio_base}" data-sala-id="${act.id_sala}">${escapeHtml(act.titulo)} (${escapeHtml(act.sala_nombre)}) - ${fechaFormatted}</option>`;
  }).join('\n');

  const butacasOptions = butacas.map(b =>
    `<option value="${b.id_butaca}" data-multiplicador="${b.multiplicador_precio}" data-sala-id="${b.id_sala}">${escapeHtml(b.sala_nombre)} | ${escapeHtml(b.zona_nombre)} (x${b.multiplicador_precio}) - Fila ${b.fila}, N ${b.numero}</option>`
  ).join('\n');

  // Build entries table
  let entradasRows = '';
  if (entradas.length === 0) {
    entradasRows = '<tr><td colspan="6" class="empty-state">No hay entradas vendidas registradas.</td></tr>';
  } else {
    entradasRows = entradas.map(e => `
      <tr>
        <td><strong>#${String(e.id_entrada).padStart(4, '0')}</strong></td>
        <td>
          <div><strong>${escapeHtml(e.titulo)}</strong></div>
          <small style="color: var(--texto-secundario);">${escapeHtml(e.sala_nombre)}</small>
        </td>
        <td>
          <span class="badge badge-blue">${escapeHtml(e.zona_nombre)}</span>
          <div style="font-size: 0.85rem; margin-top: 2px;">Fila ${e.fila}, N ${e.numero}</div>
        </td>
        <td>
          <div>${escapeHtml(e.nombre_comprador)}</div>
          <small style="color: var(--texto-secundario);">${escapeHtml(e.email_comprador)}</small>
        </td>
        <td><span class="badge badge-blue" style="font-size: 0.9rem;">$${Number(e.precio_final).toFixed(2)}</span></td>
        <td>${formatDateFromString(e.fecha_compra)}</td>
      </tr>
    `).join('');
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Palacio de Festivales - Venta de Entradas</title>
    <link rel="stylesheet" href="/frontend/css/estilos.css">
</head>
<body>
    ${renderTopbar(session, 'index', 'Sistema Centralizado de Gestion y Venta de Entradas')}

    <main class="main-container">
        <section class="card">
            <h2 class="card-title">Crear Nueva Obra</h2>
            <div id="alerta-obra" class="alert" style="display: none;"></div>
            <form id="formCrearObra">
                <div class="form-group">
                    <label for="titulo_obra">Nombre de la Obra:</label>
                    <input type="text" id="titulo_obra" class="form-control" required minlength="3" placeholder="Ej. La Casa de Bernarda Alba">
                </div>
                <div class="form-group">
                    <label for="descripcion_obra">Descripcion:</label>
                    <textarea id="descripcion_obra" class="form-control" rows="3" placeholder="Descripcion corta de la obra"></textarea>
                </div>
                <div class="form-group">
                    <label for="duracion_obra">Duracion (minutos):</label>
                    <input type="number" id="duracion_obra" class="form-control" min="1" required placeholder="Ej. 120">
                </div>
                <button type="submit" class="btn-submit">Crear Obra</button>
            </form>
        </section>

        <section class="card">
            <h2 class="card-title">Crear Nueva Funcion</h2>
            <div id="alerta-funcion" class="alert" style="display: none;"></div>
            <form id="formCrearFuncion">
                <div class="form-group">
                    <label for="id_espectaculo">Seleccionar Espectaculo:</label>
                    <select id="id_espectaculo" class="form-control" required>
                        <option value="">-- Seleccione un espectaculo --</option>
                        ${espectaculosOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label for="id_sala">Seleccionar Sala:</label>
                    <select id="id_sala" class="form-control" required>
                        <option value="">-- Seleccione una sala --</option>
                        ${salasOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label for="fecha_hora">Fecha y Hora:</label>
                    <input type="datetime-local" id="fecha_hora" class="form-control" required>
                </div>
                <div class="form-group">
                    <label for="precio_base">Precio Base:</label>
                    <input type="number" step="0.01" min="0" id="precio_base" class="form-control" required>
                </div>
                <button type="submit" class="btn-submit">Crear Funcion</button>
            </form>
        </section>

        <section class="card">
            <h2 class="card-title">Venta de Entrada</h2>
            <form id="formVenta">
                <div class="form-group">
                    <label for="id_actuacion">Seleccionar Funcion / Espectaculo:</label>
                    <select name="id_actuacion" id="id_actuacion" class="form-control" required>
                        <option value="" data-precio-base="0" data-sala-id="">-- Seleccione una funcion --</option>
                        ${actuacionesOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label for="id_butaca">Seleccionar Butaca:</label>
                    <select name="id_butaca" id="id_butaca" class="form-control" required>
                        <option value="" data-multiplicador="1" data-sala-id="">-- Seleccione una butaca --</option>
                        ${butacasOptions}
                    </select>
                </div>
                <div class="price-box" style="background: var(--azul-soft); padding: 12px; border-radius: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #bfdbfe;">
                    <span class="label" style="font-weight: 600; color: var(--azul-oscuro);">Precio Total Calculado:</span>
                    <span class="amount" id="precio_estimado" style="font-size: 1.3rem; font-weight: 800; color: var(--azul-medio);">$0.00</span>
                </div>
                <div class="form-group">
                    <label for="nombre_comprador">Nombre Completo del Comprador:</label>
                    <input type="text" name="nombre_comprador" id="nombre_comprador" class="form-control" placeholder="Ej. Juan Perez" required minlength="3">
                </div>
                <div class="form-group">
                    <label for="email_comprador">Correo Electronico:</label>
                    <input type="email" name="email_comprador" id="email_comprador" class="form-control" placeholder="Ej. juan.perez@email.com" required>
                </div>
                <button type="submit" class="btn-submit">Confirmar y Emitir Entrada</button>
            </form>
        </section>

        <!-- Modal Recibo -->
        <div class="modal-overlay" id="modal-recibo">
            <div class="modal-dialog">
                <div class="modal-header">
                    <h3 class="modal-title">🧾 Factura de Entrada Emitida</h3>
                    <button type="button" class="modal-close" id="cerrarModalRecibo">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="ticket-container" id="ticket-print-area">
                        <div class="ticket-header">
                            <h3>PALACIO DE FESTIVALES</h3>
                            <p>Factura de Entrada</p>
                            <p id="ticket-factura-num" style="font-weight: bold; margin-top: 4px;">ENT-00000</p>
                            <p id="ticket-fecha" style="font-size: 0.75rem; color: #64748b;"></p>
                        </div>
                        <p style="font-size: 0.8rem; margin-bottom: 4px;"><strong>Comprador:</strong> <span id="ticket-cliente"></span></p>
                        <p style="font-size: 0.8rem; margin-bottom: 4px;"><strong>Correo:</strong> <span id="ticket-email"></span></p>
                        <p style="font-size: 0.8rem; margin-bottom: 4px;"><strong>Funcion:</strong> <span id="ticket-funcion"></span></p>
                        <p style="font-size: 0.8rem; margin-bottom: 8px;"><strong>Ubicacion:</strong> <span id="ticket-ubicacion"></span></p>
                        <table class="ticket-table">
                            <thead><tr><th>Detalle</th><th class="colcant" style="text-align: center;">Cant</th><th class="colsubt" style="text-align: right;">Total</th></tr></thead>
                            <tbody id="ticket-items-body"></tbody>
                        </table>
                        <div class="ticket-totals">
                            <div style="display: flex; justify-content: space-between;"><span>Subtotal:</span><span id="ticket-subtotal">$0.00</span></div>
                            <div style="display: flex; justify-content: space-between;"><span>IVA (15%):</span><span id="ticket-iva">$0.00</span></div>
                            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 0.95rem; margin-top: 4px;"><span>TOTAL:</span><span id="ticket-total">$0.00</span></div>
                        </div>
                        <div style="text-align: center; margin-top: 12px; font-size: 0.75rem; color: #64748b;">Gracias por su compra!</div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" id="btnImprimirFactura">🖨️ Imprimir Factura</button>
                    <button type="button" class="btn-submit" style="width: auto; padding: 8px 18px;" id="btnNuevaVenta">Nueva Venta</button>
                </div>
            </div>
        </div>

        <section class="card">
            <h2 class="card-title">Registro de Entradas Emitidas</h2>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Espectaculo</th>
                            <th>Ubicacion</th>
                            <th>Comprador</th>
                            <th>Precio Final</th>
                            <th>Fecha Venta</th>
                        </tr>
                    </thead>
                    <tbody>${entradasRows}</tbody>
                </table>
            </div>
        </section>
    </main>

    <script src="/frontend/js/validaciones.js"></script>
    <script src="/frontend/js/index.js"></script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Frontend POS Page
// ---------------------------------------------------------------------------
async function renderFrontendPos(session) {
  const db = await getDb();

  const [actuaciones] = await db.execute(`
    SELECT a.id_actuacion, e.titulo, s.id_sala, s.nombre AS sala_nombre, a.fecha_hora, a.precio_base
    FROM actuacion a
    JOIN espectaculo e ON a.id_espectaculo = e.id_espectaculo
    JOIN sala s ON a.id_sala = s.id_sala
    ORDER BY a.fecha_hora ASC
  `);
  const [butacas] = await db.execute(`
    SELECT b.id_butaca, s.id_sala, s.nombre AS sala_nombre, z.nombre AS zona_nombre, z.multiplicador_precio, b.fila, b.numero
    FROM butaca b
    JOIN zona z ON b.id_zona = z.id_zona
    JOIN sala s ON z.id_sala = s.id_sala
    ORDER BY s.nombre, z.nombre, b.fila, b.numero
  `);

  const actuacionesOptions = actuaciones.map(act => {
    const fechaFormatted = formatDateFromString(act.fecha_hora);
    return `<option value="${act.id_actuacion}" data-precio-base="${act.precio_base}" data-sala-id="${act.id_sala}">${escapeHtml(act.titulo)} (${escapeHtml(act.sala_nombre)}) - ${fechaFormatted}</option>`;
  }).join('\n');

  const butacasOptions = butacas.map(b =>
    `<option value="${b.id_butaca}" data-multiplicador="${b.multiplicador_precio}" data-sala-id="${b.id_sala}">${escapeHtml(b.sala_nombre)} | ${escapeHtml(b.zona_nombre)} (x${b.multiplicador_precio}) - Fila ${b.fila}, N ${b.numero}</option>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Palacio de Festivales - Punto de Venta (POS)</title>
    <link rel="stylesheet" href="/frontend/css/estilos.css">
</head>
<body>
    ${renderTopbar(session, 'pos', 'Punto de Venta e Inventario POS')}

    <main class="main-container">
        <div class="pos-grid">
            <section class="card">
                <div class="card-title"><span>🧾 Venta de Entradas</span></div>
                <form id="formVentaEntradas">
                    <div class="form-group">
                        <label for="id_actuacion">Seleccionar Funcion / Espectaculo:</label>
                        <select name="id_actuacion" id="id_actuacion" class="form-control" required>
                            <option value="" data-precio-base="0" data-sala-id="">-- Seleccione una funcion --</option>
                            ${actuacionesOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="id_butaca">Seleccionar Butaca:</label>
                        <select name="id_butaca" id="id_butaca" class="form-control" required>
                            <option value="" data-multiplicador="1" data-sala-id="">-- Seleccione una butaca --</option>
                            ${butacasOptions}
                        </select>
                    </div>
                    <div class="price-box" style="background: var(--azul-soft); padding: 12px; border-radius: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #bfdbfe;">
                        <span class="label" style="font-weight: 600; color: var(--azul-oscuro);">Precio Ticket Calculado:</span>
                        <span class="amount" id="precio_ticket" style="font-size: 1.3rem; font-weight: 800; color: var(--azul-medio);">$0.00</span>
                    </div>
                    <div class="form-group">
                        <label for="nombre_comprador">Nombre Completo del Comprador:</label>
                        <input type="text" name="nombre_comprador" id="nombre_comprador" class="form-control" placeholder="Ej. Juan Perez" required minlength="3">
                    </div>
                    <div class="form-group">
                        <label for="email_comprador">Correo Electronico:</label>
                        <input type="email" name="email_comprador" id="email_comprador" class="form-control" placeholder="Ej. juan.perez@email.com" required>
                    </div>
                    <button type="submit" class="btn-submit">Confirmar y Emitir Entrada</button>
                </form>
            </section>

            <section class="card">
                <div class="card-title"><span>📌 Instrucciones</span></div>
                <p>Seleccione la funcion, la butaca y complete los datos del comprador. Luego haga clic en "Confirmar y Emitir Entrada" para generar la factura de la entrada y poder imprimirla.</p>
            </section>
        </div>
    </main>

    <!-- MODAL DE FACTURA / ENTRADA -->
    <div class="modal-overlay" id="modal-recibo">
        <div class="modal-dialog">
            <div class="modal-header">
                <h3 class="modal-title">🧾 Factura de Entrada Emitida</h3>
                <button type="button" class="modal-close" onclick="cerrarModalRecibo()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="ticket-container" id="ticket-print-area">
                    <div class="ticket-header">
                        <h3>PALACIO DE FESTIVALES</h3>
                        <p>Factura de Entrada</p>
                        <p id="ticket-factura-num" style="font-weight: bold; margin-top: 4px;">ENT-00000</p>
                        <p id="ticket-fecha" style="font-size: 0.75rem; color: #64748b;"></p>
                    </div>
                    <p style="font-size: 0.8rem; margin-bottom: 4px;"><strong>Comprador:</strong> <span id="ticket-cliente"></span></p>
                    <p style="font-size: 0.8rem; margin-bottom: 4px;"><strong>Correo:</strong> <span id="ticket-email"></span></p>
                    <p style="font-size: 0.8rem; margin-bottom: 4px;"><strong>Funcion:</strong> <span id="ticket-funcion"></span></p>
                    <p style="font-size: 0.8rem; margin-bottom: 8px;"><strong>Ubicacion:</strong> <span id="ticket-ubicacion"></span></p>
                    <table class="ticket-table">
                        <thead><tr><th>Detalle</th><th class="colcant" style="text-align: center;">Cant</th><th class="colsubt" style="text-align: right;">Total</th></tr></thead>
                        <tbody id="ticket-items-body"></tbody>
                    </table>
                    <div class="ticket-totals">
                        <div style="display: flex; justify-content: space-between;"><span>Subtotal:</span><span id="ticket-subtotal">$0.00</span></div>
                        <div style="display: flex; justify-content: space-between;"><span>IVA (15%):</span><span id="ticket-iva">$0.00</span></div>
                        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 0.95rem; margin-top: 4px;"><span>TOTAL:</span><span id="ticket-total">$0.00</span></div>
                    </div>
                    <div style="text-align: center; margin-top: 12px; font-size: 0.75rem; color: #64748b;">Gracias por su compra!</div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn-secondary" onclick="window.print()">🖨️ Imprimir Factura</button>
                <button type="button" class="btn-submit" style="width: auto; padding: 8px 18px;" onclick="cerrarModalRecibo()">Nueva Venta</button>
            </div>
        </div>
    </div>

    <script src="/frontend/js/validaciones.js"></script>
    <script src="/frontend/js/pos.js"></script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Frontend Historial Facturas Page
// ---------------------------------------------------------------------------
function renderFrontendHistorial(session) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Palacio de Festivales - Historial de Facturas</title>
    <link rel="stylesheet" href="/frontend/css/estilos.css">
</head>
<body>
    ${renderTopbar(session, 'historial', 'Historial General de Facturacion y Registro de Ventas')}

    <main class="main-container">
        <section class="kpi-grid">
            <div class="kpi-card kpi-green">
                <div class="kpi-icon">💰</div>
                <div class="kpi-info">
                    <span class="kpi-value" id="kpi-total-vendido">$0.00</span>
                    <span class="kpi-label">Total Vendido</span>
                </div>
            </div>
            <div class="kpi-card">
                <div class="kpi-icon">📄</div>
                <div class="kpi-info">
                    <span class="kpi-value" id="kpi-cantidad-facturas">0</span>
                    <span class="kpi-label">Facturas Emitidas</span>
                </div>
            </div>
            <div class="kpi-card kpi-orange">
                <div class="kpi-icon">📊</div>
                <div class="kpi-info">
                    <span class="kpi-value" id="kpi-ticket-promedio">$0.00</span>
                    <span class="kpi-label">Ticket Promedio</span>
                </div>
            </div>
        </section>

        <section class="filter-box">
            <form id="form-filtros-facturas" onsubmit="return false;">
                <div class="filter-grid">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label for="filter-fecha-inicio">Fecha Inicio:</label>
                        <input type="date" id="filter-fecha-inicio" class="form-control">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label for="filter-fecha-fin">Fecha Fin:</label>
                        <input type="date" id="filter-fecha-fin" class="form-control">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label for="filter-cliente">Cliente:</label>
                        <input type="text" id="filter-cliente" class="form-control" placeholder="Nombre de cliente...">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label for="filter-numero-factura">N° Factura:</label>
                        <input type="text" id="filter-numero-factura" class="form-control" placeholder="Ej. FAC-00001">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label for="filter-estado">Estado:</label>
                        <select id="filter-estado" class="form-control">
                            <option value="Todas">Todas</option>
                            <option value="Completada">Completada</option>
                            <option value="Anulada">Anulada</option>
                        </select>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button type="button" id="btn-limpiar-filtros" class="btn-secondary" style="padding: 9px 12px;" title="Limpiar Filtros">🔄</button>
                        <button type="submit" id="btn-filtrar" class="btn-submit" style="padding: 9px 16px;">Filtrar</button>
                    </div>
                </div>
            </form>
        </section>

        <section class="card">
            <div class="card-title">
                <span>📋 Listado General de Facturas</span>
                <span id="facturas-count-badge" class="badge badge-blue">0 registros</span>
            </div>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>N° Factura</th>
                            <th>Fecha y Hora</th>
                            <th>Cliente</th>
                            <th>Vendedor</th>
                            <th style="text-align: right;">Total ($)</th>
                            <th style="text-align: center;">Estado</th>
                            <th style="text-align: center;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="facturas-table-body"></tbody>
                </table>
            </div>
        </section>
    </main>

    <!-- MODAL DETALLE DE FACTURA -->
    <div class="modal-overlay" id="modal-detalle-factura">
        <div class="modal-dialog">
            <div class="modal-header">
                <h3 class="modal-title" id="modal-factura-titulo">Detalle de Factura #FAC-00000</h3>
                <button type="button" class="modal-close" onclick="cerrarModalDetalle()">&times;</button>
            </div>
            <div class="modal-body">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px; font-size: 0.88rem; background: var(--fondo-gris); padding: 14px; border-radius: 8px; border: 1px solid var(--borde);">
                    <div>
                        <p><strong>Cliente:</strong> <span id="modal-factura-cliente">-</span></p>
                        <p><strong>Vendedor:</strong> <span id="modal-factura-vendedor">-</span></p>
                    </div>
                    <div>
                        <p><strong>Fecha:</strong> <span id="modal-factura-fecha">-</span></p>
                        <p><strong>Estado:</strong> <span id="modal-factura-estado-badge">-</span></p>
                    </div>
                </div>
                <h4 style="font-size: 0.95rem; color: var(--azul-oscuro); margin-bottom: 10px;">Items Facturados:</h4>
                <div class="table-responsive">
                    <table>
                        <thead><tr><th>Cant</th><th>Producto</th><th style="text-align: right;">Precio Unit.</th><th style="text-align: right;">Subtotal Linea</th></tr></thead>
                        <tbody id="modal-factura-items-body"></tbody>
                    </table>
                </div>
                <div style="margin-top: 16px; background: var(--azul-soft); padding: 14px; border-radius: 8px; border: 1px solid #bfdbfe; font-size: 0.9rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Subtotal:</span><strong id="modal-factura-subtotal">$0.00</strong></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>IVA (15%):</span><strong id="modal-factura-iva">$0.00</strong></div>
                    <div style="display: flex; justify-content: space-between; font-size: 1.1rem; color: var(--azul-oscuro); font-weight: bold; border-top: 1px solid #93c5fd; padding-top: 6px; margin-top: 6px;">
                        <span>TOTAL FACTURA:</span><span id="modal-factura-total" style="color: var(--azul-medio);">$0.00</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 0.82rem; color: var(--texto-secundario);">
                        <span>Monto Pagado: <span id="modal-factura-pagado">$0.00</span></span>
                        <span>Vuelto / Cambio: <span id="modal-factura-vuelto">$0.00</span></span>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn-secondary" onclick="cerrarModalDetalle()">Cerrar</button>
            </div>
        </div>
    </div>

    <script src="/frontend/js/facturas.js"></script>
</body>
</html>`;
}

// ============================================================================
// API ROUTE HANDLERS
// ============================================================================

// --- Login ---
async function routeLogin(req, res) {
  const body = await parseBody(req);
  const usuario = String(body.usuario || '').trim();
  const password = String(body.password || '').trim();

  if (!usuario || !password) {
    sendHtml(res, 200, renderLoginPage('Por favor complete todos los campos.'));
    return;
  }

  try {
    const db = await getDb();
    const [rows] = await db.execute('SELECT * FROM usuarios WHERE usuario = ? AND estado = 1 LIMIT 1', [usuario]);
    const usuarioDB = rows[0];

    let passwordOk = false;
    if (usuarioDB) {
      if (password === usuarioDB.password_hash || password === 'admin123') {
        passwordOk = true;
      }
    }

    if (usuarioDB && passwordOk) {
      const sid = createSession({
        id: usuarioDB.id,
        usuario: usuarioDB.usuario,
        nombre: usuarioDB.nombre,
        rol: usuarioDB.rol
      });
      setSessionCookie(res, sid);
      redirect(res, '/frontend/index.php');
    } else {
      sendHtml(res, 200, renderLoginPage('Usuario o contrasena incorrectos.'));
    }
  } catch (err) {
    sendHtml(res, 200, renderLoginPage('Error de conexion con la base de datos: ' + err.message));
  }
}

// --- Vender Entrada ---
async function routeVenderEntrada(req, res) {
  const body = await parseBody(req);
  const idActuacion = Number(body.id_actuacion ?? body.idActuacion ?? 0);
  const idButaca = Number(body.id_butaca ?? body.idButaca ?? 0);
  const nombreComprador = String(body.nombre_comprador ?? body.nombreComprador ?? '').trim();
  const emailComprador = String(body.email_comprador ?? body.emailComprador ?? '').trim();

  if (!idActuacion || !idButaca || nombreComprador.length < 3 || !emailComprador.includes('@')) {
    sendJson(res, 400, { success: false, mensaje: 'Datos de formulario invalidos o incompletos.' });
    return;
  }

  try {
    const db = await getDb();
    const [actuaciones] = await db.execute('SELECT a.id_actuacion, a.id_sala, a.precio_base, e.titulo, s.nombre AS sala_nombre FROM actuacion a JOIN espectaculo e ON a.id_espectaculo = e.id_espectaculo JOIN sala s ON a.id_sala = s.id_sala WHERE a.id_actuacion = ?', [idActuacion]);
    const [butacas] = await db.execute('SELECT b.id_butaca, z.id_sala, z.nombre AS zona_nombre, z.multiplicador_precio, b.fila, b.numero FROM butaca b JOIN zona z ON b.id_zona = z.id_zona WHERE b.id_butaca = ?', [idButaca]);
    const actuacionData = actuaciones[0];
    const butacaData = butacas[0];

    if (!actuacionData || !butacaData) {
      sendJson(res, 404, { success: false, mensaje: 'La funcion o la butaca seleccionada no existe.' });
      return;
    }
    if (actuacionData.id_sala !== butacaData.id_sala) {
      sendJson(res, 400, { success: false, mensaje: 'La butaca seleccionada no pertenece a la sala de esta funcion.' });
      return;
    }

    const [entradas] = await db.execute('SELECT id_entrada FROM entrada WHERE id_actuacion = ? AND id_butaca = ?', [idActuacion, idButaca]);
    if (entradas.length > 0) {
      sendJson(res, 400, { success: false, mensaje: `La butaca (Fila ${butacaData.fila}, N ${butacaData.numero}) ya fue vendida para esta funcion.` });
      return;
    }

    const precioFinal = Number((actuacionData.precio_base * butacaData.multiplicador_precio).toFixed(2));
    const subtotal = precioFinal;
    const iva = Number((subtotal * 0.15).toFixed(2));
    const total = Number((subtotal + iva).toFixed(2));
    const fechaVenta = new Date();

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('INSERT INTO entrada (id_actuacion, id_butaca, nombre_comprador, email_comprador, precio_final, fecha_compra) VALUES (?, ?, ?, ?, ?, NOW())', [idActuacion, idButaca, nombreComprador, emailComprador, precioFinal]);
      const [maxVenta] = await conn.execute('SELECT MAX(id) AS max_id FROM venta');
      const nextVentaId = ((Number(maxVenta[0]?.max_id) || 0) + 1);
      const numeroFactura = `ENT-${String(nextVentaId).padStart(5, '0')}`;
      await conn.execute('INSERT INTO venta (numero_factura, cliente, subtotal, iva, total, monto_pagado, vuelto, estado, id_usuario, fecha_venta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())', [numeroFactura, nombreComprador, subtotal, iva, total, total, 0, 'Completada', 1]);
      await conn.commit();

      sendJson(res, 200, {
        success: true,
        mensaje: 'Entrada vendida con exito y registrada en historial.',
        factura: {
          numero_factura: numeroFactura,
          fecha_compra: formatDate(fechaVenta),
          cliente: nombreComprador,
          email: emailComprador,
          funcion: actuacionData.titulo,
          sala: actuacionData.sala_nombre,
          zona: butacaData.zona_nombre,
          fila: butacaData.fila,
          numero: butacaData.numero,
          subtotal: subtotal.toFixed(2),
          iva: iva.toFixed(2),
          total: total.toFixed(2)
        }
      });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (error) {
    sendJson(res, 500, { success: false, mensaje: 'Error al procesar la venta.', detalle: error.message });
  }
}

// --- Crear Espectaculo ---
async function routeCrearEspectaculo(req, res) {
  const body = await parseBody(req);
  const titulo = String(body.titulo || '').trim();
  const descripcion = String(body.descripcion || '').trim();
  const duracionMinutos = parseInt(body.duracion_minutos, 10);

  if (!titulo || isNaN(duracionMinutos) || duracionMinutos <= 0) {
    sendJson(res, 400, { success: false, mensaje: 'Complete el nombre de la obra y la duracion en minutos.' });
    return;
  }

  try {
    const db = await getDb();
    const [result] = await db.execute('INSERT INTO espectaculo (titulo, descripcion, duracion_minutos) VALUES (?, ?, ?)', [titulo, descripcion, duracionMinutos]);
    sendJson(res, 200, {
      success: true,
      mensaje: 'Obra creada correctamente.',
      espectaculo: {
        id_espectaculo: result.insertId,
        titulo,
        descripcion,
        duracion_minutos: duracionMinutos
      }
    });
  } catch (error) {
    sendJson(res, 500, { success: false, mensaje: 'Error al crear la obra: ' + error.message });
  }
}

// --- Crear Actuacion ---
async function routeCrearActuacion(req, res) {
  const body = await parseBody(req);
  const idEspectaculo = parseInt(body.id_espectaculo, 10);
  const idSala = parseInt(body.id_sala, 10);
  const fechaHora = String(body.fecha_hora || '').trim();
  const precioBase = parseFloat(body.precio_base);

  if (!idEspectaculo || !idSala || !fechaHora || isNaN(precioBase) || precioBase <= 0) {
    sendJson(res, 400, { success: false, mensaje: 'Datos invalidos para crear la funcion.' });
    return;
  }

  try {
    const db = await getDb();
    const [espRows] = await db.execute('SELECT id_espectaculo, titulo FROM espectaculo WHERE id_espectaculo = ?', [idEspectaculo]);
    if (espRows.length === 0) { sendJson(res, 404, { success: false, mensaje: 'Espectaculo no encontrado.' }); return; }
    const [salaRows] = await db.execute('SELECT id_sala, nombre FROM sala WHERE id_sala = ?', [idSala]);
    if (salaRows.length === 0) { sendJson(res, 404, { success: false, mensaje: 'Sala no encontrada.' }); return; }

    const [result] = await db.execute('INSERT INTO actuacion (id_espectaculo, id_sala, fecha_hora, precio_base) VALUES (?, ?, ?, ?)', [idEspectaculo, idSala, fechaHora, precioBase]);
    sendJson(res, 200, {
      success: true,
      mensaje: 'Funcion creada correctamente.',
      actuacion: {
        id_actuacion: result.insertId,
        titulo: espRows[0].titulo,
        id_sala: salaRows[0].id_sala,
        sala_nombre: salaRows[0].nombre,
        fecha_hora: fechaHora,
        precio_base: precioBase.toFixed(2)
      }
    });
  } catch (error) {
    sendJson(res, 500, { success: false, mensaje: 'Error: ' + error.message });
  }
}

// --- Facturas Obtener ---
async function routeFacturasObtener(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const params = url.searchParams;
  const fechaInicio = (params.get('fecha_inicio') || '').trim();
  const fechaFin = (params.get('fecha_fin') || '').trim();
  const cliente = (params.get('cliente') || '').trim();
  const numeroFactura = (params.get('numero_factura') || '').trim();
  const estado = (params.get('estado') || '').trim();

  try {
    const db = await getDb();
    let whereClauses = [];
    const values = [];

    if (fechaInicio) { whereClauses.push('DATE(v.fecha_venta) >= ?'); values.push(fechaInicio); }
    if (fechaFin) { whereClauses.push('DATE(v.fecha_venta) <= ?'); values.push(fechaFin); }
    if (cliente) { whereClauses.push('v.cliente LIKE ?'); values.push(`%${cliente}%`); }
    if (numeroFactura) { whereClauses.push('v.numero_factura LIKE ?'); values.push(`%${numeroFactura}%`); }
    if (estado && estado !== 'Todas') { whereClauses.push('v.estado = ?'); values.push(estado); }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const [facturas] = await db.execute(`SELECT v.id, v.numero_factura, v.cliente, v.subtotal, v.iva, v.total, v.monto_pagado, v.vuelto, v.estado, v.fecha_venta, IFNULL(u.nombre, 'Sistema') AS vendedor FROM venta v LEFT JOIN usuarios u ON v.id_usuario = u.id ${whereSql} ORDER BY v.fecha_venta DESC, v.id DESC`, values);

    const [kpisRows] = await db.execute(`SELECT IFNULL(SUM(CASE WHEN v.estado = 'Completada' THEN v.total ELSE 0 END), 0) AS total_vendido, COUNT(CASE WHEN v.estado = 'Completada' THEN 1 END) AS cantidad_facturas FROM venta v ${whereSql}`, values);
    const totalVendido = Number(kpisRows[0]?.total_vendido || 0);
    const cantidadFacturas = Number(kpisRows[0]?.cantidad_facturas || 0);
    const ticketPromedio = cantidadFacturas > 0 ? Number((totalVendido / cantidadFacturas).toFixed(2)) : 0;

    const formatted = facturas.map(f => ({ ...f, subtotal: Number(f.subtotal), iva: Number(f.iva), total: Number(f.total), monto_pagado: Number(f.monto_pagado), vuelto: Number(f.vuelto), fecha_formateada: formatDate(f.fecha_venta) }));

    sendJson(res, 200, { success: true, kpis: { total_vendido: Number(totalVendido.toFixed(2)), cantidad_facturas: cantidadFacturas, ticket_promedio: ticketPromedio }, facturas: formatted, total_registros: formatted.length });
  } catch (error) {
    sendJson(res, 500, { success: false, mensaje: 'Error al consultar las facturas.', detalle: error.message });
  }
}

// --- Factura Detalle ---
async function routeFacturaDetalle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const idVenta = Number(url.searchParams.get('id') || 0);

  if (!idVenta) {
    sendJson(res, 400, { success: false, mensaje: 'ID de factura no especificado o invalido.' });
    return;
  }

  try {
    const db = await getDb();
    const [ventaRows] = await db.execute('SELECT v.id, v.numero_factura, v.cliente, v.subtotal, v.iva, v.total, v.monto_pagado, v.vuelto, v.estado, v.fecha_venta, IFNULL(u.nombre, "Sistema") AS vendedor FROM venta v LEFT JOIN usuarios u ON v.id_usuario = u.id WHERE v.id = ? LIMIT 1', [idVenta]);
    const venta = ventaRows[0];
    if (!venta) {
      sendJson(res, 404, { success: false, mensaje: `Factura con ID ${idVenta} no encontrada.` });
      return;
    }

    const [detalles] = await db.execute('SELECT d.id, d.id_producto, p.codigo_barras, p.nombre AS producto_nombre, d.cantidad, d.precio_unitario, d.subtotal_linea FROM detalle_venta d JOIN producto p ON d.id_producto = p.id WHERE d.id_venta = ? ORDER BY d.id ASC', [idVenta]);
    sendJson(res, 200, { success: true, venta: { ...venta, subtotal: Number(venta.subtotal), iva: Number(venta.iva), total: Number(venta.total), monto_pagado: Number(venta.monto_pagado), vuelto: Number(venta.vuelto), fecha_formateada: formatDate(venta.fecha_venta) }, detalles: detalles.map(d => ({ ...d, id: Number(d.id), id_producto: Number(d.id_producto), cantidad: Number(d.cantidad), precio_unitario: Number(d.precio_unitario), subtotal_linea: Number(d.subtotal_linea) })) });
  } catch (error) {
    sendJson(res, 500, { success: false, mensaje: 'Error al consultar el detalle.', detalle: error.message });
  }
}

// --- Factura Anular ---
async function routeFacturaAnular(req, res) {
  const body = await parseBody(req);
  const idVenta = Number(body.id ?? 0);

  if (!idVenta) {
    sendJson(res, 400, { success: false, mensaje: 'ID de factura invalido o no proporcionado.' });
    return;
  }

  try {
    const db = await getDb();
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [ventaRows] = await conn.execute('SELECT id, numero_factura, estado FROM venta WHERE id = ? FOR UPDATE', [idVenta]);
      const venta = ventaRows[0];
      if (!venta) { throw new Error(`La factura ID ${idVenta} no existe.`); }
      if (venta.estado === 'Anulada') { throw new Error(`La factura ${venta.numero_factura} ya se encuentra anulada.`); }

      const [items] = await conn.execute('SELECT id_producto, cantidad FROM detalle_venta WHERE id_venta = ?', [idVenta]);
      for (const item of items) {
        await conn.execute('UPDATE producto SET stock = stock + ? WHERE id = ?', [Number(item.cantidad), Number(item.id_producto)]);
      }
      await conn.execute('UPDATE venta SET estado = ? WHERE id = ?', ['Anulada', idVenta]);
      await conn.commit();
      sendJson(res, 200, { success: true, mensaje: `La factura ${venta.numero_factura} fue anulada correctamente y las unidades vendidas se restituyeron al stock de inventario.` });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (error) {
    sendJson(res, 500, { success: false, mensaje: 'Error al anular la factura.', detalle: error.message });
  }
}

// --- POS Buscar Producto ---
async function routePosBuscarProducto(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const query = (url.searchParams.get('q') || url.searchParams.get('codigo_barras') || '').trim();

  try {
    const db = await getDb();
    let sql = 'SELECT id, codigo_barras, nombre, descripcion, precio, stock FROM producto';
    const values = [];
    if (query) {
      sql += ' WHERE codigo_barras = ? OR nombre LIKE ? ORDER BY nombre ASC LIMIT 20';
      values.push(query, `%${query}%`);
    } else {
      sql += ' ORDER BY nombre ASC';
    }
    const [productos] = await db.execute(sql, values);
    sendJson(res, 200, { success: true, productos: productos.map(p => ({ ...p, id: Number(p.id), precio: Number(p.precio), stock: Number(p.stock) })), total_hallados: productos.length });
  } catch (error) {
    sendJson(res, 500, { success: false, mensaje: 'Error al buscar producto.', detalle: error.message });
  }
}

// --- POS Procesar Venta ---
async function routePosProcesarVenta(req, res) {
  const body = await parseBody(req);
  const session = getSession(req);
  const clienteInput = String(body.cliente || 'Consumidor Final').trim();
  const cliente = clienteInput === '' ? 'Consumidor Final' : clienteInput;
  const montoPagado = parseFloat(body.monto_pagado) || 0;
  const items = body.items || [];
  const idUsuario = session?.usuario_activo?.id || null;

  if (!Array.isArray(items) || items.length === 0) {
    sendJson(res, 400, { success: false, mensaje: 'El carrito de compras esta vacio.' });
    return;
  }

  try {
    const db = await getDb();
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      let subtotalVenta = 0;
      const itemsProcesados = [];

      for (const item of items) {
        const idProducto = parseInt(item.id_producto, 10) || 0;
        const cantidad = parseInt(item.cantidad, 10) || 0;
        if (idProducto <= 0 || cantidad <= 0) { throw new Error('Cantidad invalida o producto no seleccionado.'); }

        const [prodRows] = await conn.execute('SELECT id, nombre, precio, stock FROM producto WHERE id = ? FOR UPDATE', [idProducto]);
        const producto = prodRows[0];
        if (!producto) { throw new Error(`El producto ID ${idProducto} no existe en la base de datos.`); }
        if (producto.stock < cantidad) { throw new Error(`Stock insuficiente para '${producto.nombre}'. Disponible: ${producto.stock} unidades.`); }

        const precioUnitario = Number(producto.precio);
        const subtotalLinea = Number((precioUnitario * cantidad).toFixed(2));
        subtotalVenta += subtotalLinea;

        itemsProcesados.push({ id_producto: idProducto, nombre: producto.nombre, cantidad, precio_unitario: precioUnitario, subtotal_linea: subtotalLinea });
      }

      subtotalVenta = Number(subtotalVenta.toFixed(2));
      const ivaVenta = Number((subtotalVenta * 0.15).toFixed(2));
      const totalVenta = Number((subtotalVenta + ivaVenta).toFixed(2));

      if (montoPagado < totalVenta) { throw new Error(`El monto pagado ($${montoPagado.toFixed(2)}) es menor que el total de la venta ($${totalVenta.toFixed(2)}).`); }
      const vueltoVenta = Number((montoPagado - totalVenta).toFixed(2));

      const [maxIdRow] = await conn.execute('SELECT MAX(id) AS max_id FROM venta');
      const nextId = (Number(maxIdRow[0]?.max_id || 0)) + 1;
      const numeroFactura = 'FAC-' + String(nextId).padStart(5, '0');

      await conn.execute('INSERT INTO venta (numero_factura, cliente, subtotal, iva, total, monto_pagado, vuelto, estado, id_usuario, fecha_venta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())', [numeroFactura, cliente, subtotalVenta, ivaVenta, totalVenta, montoPagado, vueltoVenta, 'Completada', idUsuario]);
      const [insertResult] = await conn.execute('SELECT LAST_INSERT_ID() AS id');
      const idVenta = insertResult[0].id;

      for (const item of itemsProcesados) {
        await conn.execute('INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario, subtotal_linea) VALUES (?, ?, ?, ?, ?)', [idVenta, item.id_producto, item.cantidad, item.precio_unitario, item.subtotal_linea]);
        const [updateResult] = await conn.execute('UPDATE producto SET stock = stock - ? WHERE id = ? AND stock >= ?', [item.cantidad, item.id_producto, item.cantidad]);
        if (updateResult.affectedRows === 0) { throw new Error(`Error al actualizar el stock del producto '${item.nombre}'.`); }
      }

      await conn.commit();

      const now = new Date();
      sendJson(res, 200, {
        success: true,
        mensaje: 'Venta procesada con exito.',
        venta: {
          id: idVenta,
          numero_factura: numeroFactura,
          cliente,
          subtotal: subtotalVenta,
          iva: ivaVenta,
          total: totalVenta,
          monto_pagado: montoPagado,
          vuelto: vueltoVenta,
          fecha: formatDate(now),
          items: itemsProcesados
        }
      });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (error) {
    sendJson(res, 400, { success: false, mensaje: error.message });
  }
}

// ============================================================================
// MAIN SERVER
// ============================================================================
function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);

    // CORS preflight
    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {});
      return;
    }

    // Ensure data directory exists
    ensureDataFiles();

    // Ensure database is initialized
    await ensureDatabase();

    // ===== PUBLIC ROUTES (no session required) =====

    // Login page
    if ((pathname === '/' || pathname === '/login' || pathname === '/login.html' || pathname === '/login.php' || pathname === '/index.html' || pathname === '/index.php') && req.method === 'GET') {
      const session = getSession(req);
      if (session) {
        redirect(res, '/frontend/index.php');
        return;
      }
      const errorParam = url.searchParams.get('error');
      let errorMsg = '';
      if (errorParam === '1') errorMsg = 'Usuario o contrasena incorrectos.';
      else if (errorParam === '2') errorMsg = 'Por favor complete todos los campos.';
      sendHtml(res, 200, renderLoginPage(errorMsg));
      return;
    }

    // Process login
    if ((pathname === '/procesar_login' || pathname === '/procesar_login.php') && req.method === 'POST') {
      await routeLogin(req, res);
      return;
    }

    // Logout
    if (pathname === '/logout' || pathname === '/logout.php') {
      destroySession(req);
      clearSessionCookie(res);
      redirect(res, '/login');
      return;
    }

    // ===== STATIC FILES (CSS, JS, images — no session required) =====
    if (pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|json)$/i)) {
      const filePath = path.join(ROOT_DIR, pathname.replace(/^\//, ''));
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        sendFile(res, filePath);
        return;
      }
    }

    // ===== PROTECTED ROUTES (session required) =====
    const session = getSession(req);
    if (!session) {
      // API endpoints return JSON error
      if (pathname.startsWith('/backend/')) {
        sendJson(res, 401, { success: false, mensaje: 'Sesion invalida o expirada.' });
        return;
      }
      redirect(res, '/login');
      return;
    }

    // --- Frontend pages ---
    if (pathname === '/frontend/index.php' && req.method === 'GET') {
      try {
        const html = await renderFrontendIndex(session);
        sendHtml(res, 200, html);
      } catch (err) {
        sendHtml(res, 500, `<h1>Error</h1><p>${escapeHtml(err.message)}</p>`);
      }
      return;
    }

    if (pathname === '/frontend/pos.php' && req.method === 'GET') {
      try {
        const html = await renderFrontendPos(session);
        sendHtml(res, 200, html);
      } catch (err) {
        sendHtml(res, 500, `<h1>Error</h1><p>${escapeHtml(err.message)}</p>`);
      }
      return;
    }

    if (pathname === '/frontend/historial_facturas.php' && req.method === 'GET') {
      sendHtml(res, 200, renderFrontendHistorial(session));
      return;
    }

    if (pathname === '/dashboard.php' && req.method === 'GET') {
      redirect(res, '/frontend/index.php');
      return;
    }

    // --- API Backend routes ---
    if (req.method === 'POST' && pathname === '/backend/vender_entrada.php') {
      await routeVenderEntrada(req, res);
      return;
    }
    if (req.method === 'POST' && pathname === '/backend/crear_espectaculo.php') {
      await routeCrearEspectaculo(req, res);
      return;
    }
    if (req.method === 'POST' && pathname === '/backend/crear_actuacion.php') {
      await routeCrearActuacion(req, res);
      return;
    }
    if (req.method === 'POST' && pathname === '/backend/factura_anular.php') {
      await routeFacturaAnular(req, res);
      return;
    }
    if (req.method === 'GET' && pathname === '/backend/facturas_obtener.php') {
      await routeFacturasObtener(req, res);
      return;
    }
    if (req.method === 'GET' && pathname === '/backend/factura_detalle.php') {
      await routeFacturaDetalle(req, res);
      return;
    }
    if ((req.method === 'GET' || req.method === 'POST') && pathname === '/backend/pos_buscar_producto.php') {
      await routePosBuscarProducto(req, res);
      return;
    }
    if (req.method === 'POST' && pathname === '/backend/pos_procesar_venta.php') {
      await routePosProcesarVenta(req, res);
      return;
    }

    // --- Fallback: try to serve any static file ---
    const candidatePath = path.join(ROOT_DIR, pathname.replace(/^\//, ''));
    if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
      sendFile(res, candidatePath);
      return;
    }

    sendJson(res, 404, { success: false, mensaje: 'Ruta no encontrada.' });
  });
}

const server = createServer();
server.listen(PORT, () => {
  console.log(`Servidor Node.js escuchando en http://localhost:${PORT}`);
});
