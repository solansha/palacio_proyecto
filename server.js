const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const PRODUCTOS_FILE = path.join(DATA_DIR, 'productos.json');
const VENTAS_FILE = path.join(DATA_DIR, 'ventas.json');
const ENTRADAS_FILE = path.join(DATA_DIR, 'entradas.json');
const CATALOGO_FILE = path.join(DATA_DIR, 'catalogo.json');

function ensureDataFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(CATALOGO_FILE)) {
    const catalogoInicial = {
      actuaciones: [
        { id_actuacion: 1, id_sala: 1, precio_base: 12000, titulo: 'Concierto de Apertura', sala_nombre: 'Sala Principal' },
        { id_actuacion: 2, id_sala: 2, precio_base: 18000, titulo: 'Teatro Nocturno', sala_nombre: 'Sala Secundaria' }
      ],
      butacas: [
        { id_butaca: 1, id_sala: 1, zona_nombre: 'Platea', multiplicador_precio: 1, fila: 'A', numero: 1 },
        { id_butaca: 2, id_sala: 1, zona_nombre: 'Platea', multiplicador_precio: 1.2, fila: 'A', numero: 2 },
        { id_butaca: 3, id_sala: 2, zona_nombre: 'Balcón', multiplicador_precio: 1.1, fila: 'B', numero: 1 }
      ]
    };
    writeJson(CATALOGO_FILE, catalogoInicial);
  }

  if (!fs.existsSync(PRODUCTOS_FILE)) {
    const productosIniciales = [
      { id: 1, codigo_barras: 'ENT-001', nombre: 'Entrada General', descripcion: 'Entrada para concierto', precio: 12000, stock: 50 },
      { id: 2, codigo_barras: 'ENT-002', nombre: 'Entrada VIP', descripcion: 'Entrada preferencial', precio: 18000, stock: 30 }
    ];
    writeJson(PRODUCTOS_FILE, productosIniciales);
  }

  if (!fs.existsSync(VENTAS_FILE)) {
    writeJson(VENTAS_FILE, []);
  }

  if (!fs.existsSync(ENTRADAS_FILE)) {
    writeJson(ENTRADAS_FILE, []);
  }
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(html);
}

function sendFile(res, statusCode, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';
  const content = fs.readFileSync(filePath);
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*'
  });
  res.end(content);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        const parsed = {};
        const params = new URLSearchParams(body);
        params.forEach((value, key) => {
          parsed[key] = value;
        });
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

function routeVenderEntrada(req, res) {
  const body = req.body || {};
  const idActuacion = Number(body.id_actuacion ?? body.idActuacion ?? 0);
  const idButaca = Number(body.id_butaca ?? body.idButaca ?? 0);
  const nombreComprador = String(body.nombre_comprador ?? body.nombreComprador ?? '').trim();
  const emailComprador = String(body.email_comprador ?? body.emailComprador ?? '').trim();

  if (!idActuacion || !idButaca || nombreComprador.length < 3 || !emailComprador.includes('@')) {
    sendJson(res, 400, {
      success: false,
      mensaje: 'Datos de formulario invalidos o incompletos.'
    });
    return;
  }

  const catalogo = readJson(CATALOGO_FILE, { actuaciones: [], butacas: [] });
  const actuaciones = catalogo.actuaciones || [];
  const butacas = catalogo.butacas || [];
  const actuacionData = actuaciones.find((item) => item.id_actuacion === idActuacion);
  const butacaData = butacas.find((item) => item.id_butaca === idButaca);

  if (!actuacionData || !butacaData) {
    sendJson(res, 404, {
      success: false,
      mensaje: 'La funcion o la butaca seleccionada no existe.'
    });
    return;
  }

  if (actuacionData.id_sala !== butacaData.id_sala) {
    sendJson(res, 400, {
      success: false,
      mensaje: 'La butaca seleccionada no pertenece a la sala de esta funcion.'
    });
    return;
  }

  const entradas = readJson(ENTRADAS_FILE, []);
  const yaVendida = entradas.some((item) => item.id_actuacion === idActuacion && item.id_butaca === idButaca);
  if (yaVendida) {
    sendJson(res, 400, {
      success: false,
      mensaje: `La butaca (Fila ${butacaData.fila}, N ${butacaData.numero}) ya fue vendida para esta funcion.`
    });
    return;
  }

  const precioFinal = Number((actuacionData.precio_base * butacaData.multiplicador_precio).toFixed(2));
  const subtotal = precioFinal;
  const iva = Number((subtotal * 0.15).toFixed(2));
  const total = Number((subtotal + iva).toFixed(2));
  const ventas = readJson(VENTAS_FILE, []);
  const nextId = ventas.length + 1;
  const numeroFactura = `ENT-${String(nextId).padStart(5, '0')}`;
  const fechaVenta = new Date().toISOString();

  const nuevaVenta = {
    id: nextId,
    numero_factura: numeroFactura,
    cliente: nombreComprador,
    subtotal,
    iva,
    total,
    monto_pagado: total,
    vuelto: 0,
    estado: 'Completada',
    fecha_venta: fechaVenta,
    vendedor: 'Sistema',
    fecha_formateada: formatDate(fechaVenta)
  };

  ventas.push(nuevaVenta);
  entradas.push({ id_actuacion: idActuacion, id_butaca: idButaca, id_venta: nextId });

  writeJson(VENTAS_FILE, ventas);
  writeJson(ENTRADAS_FILE, entradas);

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
}

function routeFacturasObtener(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const params = url.searchParams;
  const ventas = readJson(VENTAS_FILE, []);

  const fechaInicio = (params.get('fecha_inicio') || '').trim();
  const fechaFin = (params.get('fecha_fin') || '').trim();
  const cliente = (params.get('cliente') || '').trim();
  const numeroFactura = (params.get('numero_factura') || '').trim();
  const estado = (params.get('estado') || '').trim();

  const filtradas = ventas.filter((venta) => {
    const fechaVenta = new Date(venta.fecha_venta);

    if (fechaInicio && fechaVenta < new Date(`${fechaInicio}T00:00:00`)) {
      return false;
    }

    if (fechaFin && fechaVenta > new Date(`${fechaFin}T23:59:59`)) {
      return false;
    }

    if (cliente && !venta.cliente.toLowerCase().includes(cliente.toLowerCase())) {
      return false;
    }

    if (numeroFactura && !venta.numero_factura.toLowerCase().includes(numeroFactura.toLowerCase())) {
      return false;
    }

    if (estado && estado !== 'Todas' && venta.estado !== estado) {
      return false;
    }

    return true;
  });

  const facturas = filtradas.map((venta) => ({
    ...venta,
    subtotal: Number(venta.subtotal),
    iva: Number(venta.iva),
    total: Number(venta.total),
    monto_pagado: Number(venta.monto_pagado),
    vuelto: Number(venta.vuelto),
    fecha_formateada: formatDate(venta.fecha_venta)
  }));

  const totalVendido = facturas
    .filter((venta) => venta.estado === 'Completada')
    .reduce((sum, venta) => sum + Number(venta.total), 0);
  const cantidadFacturas = facturas.filter((venta) => venta.estado === 'Completada').length;
  const ticketPromedio = cantidadFacturas > 0 ? Number((totalVendido / cantidadFacturas).toFixed(2)) : 0;

  sendJson(res, 200, {
    success: true,
    kpis: {
      total_vendido: Number(totalVendido.toFixed(2)),
      cantidad_facturas: cantidadFacturas,
      ticket_promedio: ticketPromedio
    },
    facturas,
    total_registros: facturas.length
  });
}

function routeFacturaDetalle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const idVenta = Number(url.searchParams.get('id') || 0);

  if (!idVenta) {
    sendJson(res, 400, {
      success: false,
      mensaje: 'ID de factura no especificarse o invalido.'
    });
    return;
  }

  const ventas = readJson(VENTAS_FILE, []);
  const venta = ventas.find((item) => item.id === idVenta);

  if (!venta) {
    sendJson(res, 404, {
      success: false,
      mensaje: `Factura con ID ${idVenta} no encontrada.`
    });
    return;
  }

  const catalogo = readJson(CATALOGO_FILE, { actuaciones: [], butacas: [] });
  const actuacion = (catalogo.actuaciones || []).find((item) => item.id_actuacion === 1) || { titulo: 'Entrada' };
  const butaca = (catalogo.butacas || []).find((item) => item.id_butaca === 1) || { zona_nombre: 'General', fila: 'A', numero: 1 };

  const detalles = [
    {
      id: 1,
      id_producto: 1,
      codigo_barras: 'ENT-001',
      producto_nombre: `Entrada - ${actuacion.titulo}`,
      cantidad: 1,
      precio_unitario: Number(venta.subtotal),
      subtotal_linea: Number(venta.subtotal)
    }
  ];

  sendJson(res, 200, {
    success: true,
    venta: {
      ...venta,
      subtotal: Number(venta.subtotal),
      iva: Number(venta.iva),
      total: Number(venta.total),
      monto_pagado: Number(venta.monto_pagado),
      vuelto: Number(venta.vuelto),
      fecha_formateada: formatDate(venta.fecha_venta)
    },
    detalles
  });
}

function routeFacturaAnular(req, res) {
  const body = req.body || {};
  const idVenta = Number(body.id ?? 0);

  if (!idVenta) {
    sendJson(res, 400, {
      success: false,
      mensaje: 'ID de factura invalido o no proporcionado.'
    });
    return;
  }

  const ventas = readJson(VENTAS_FILE, []);
  const venta = ventas.find((item) => item.id === idVenta);

  if (!venta) {
    sendJson(res, 404, {
      success: false,
      mensaje: `La factura ID ${idVenta} no existe.`
    });
    return;
  }

  if (venta.estado === 'Anulada') {
    sendJson(res, 400, {
      success: false,
      mensaje: `La factura ${venta.numero_factura} ya se encuentra anulada.`
    });
    return;
  }

  venta.estado = 'Anulada';
  writeJson(VENTAS_FILE, ventas);

  sendJson(res, 200, {
    success: true,
    mensaje: `La factura ${venta.numero_factura} fue anulada correctamente y las unidades vendidas se restituyeron al stock de inventario.`
  });
}

function routePosBuscarProducto(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const query = (url.searchParams.get('q') || url.searchParams.get('codigo_barras') || '').trim();
  const productos = readJson(PRODUCTOS_FILE, []);

  let resultados = productos;
  if (query) {
    resultados = productos.filter((producto) => {
      return producto.codigo_barras.includes(query) || producto.nombre.toLowerCase().includes(query.toLowerCase());
    });
  }

  const productosFormateados = resultados.map((producto) => ({
    ...producto,
    id: Number(producto.id),
    precio: Number(producto.precio),
    stock: Number(producto.stock)
  }));

  sendJson(res, 200, {
    success: true,
    productos: productosFormateados,
    total_hallados: productosFormateados.length
  });
}

function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {});
      return;
    }

    ensureDataFiles();

    if (req.method === 'POST' && url.pathname === '/backend/vender_entrada.php') {
      req.body = await parseBody(req);
      routeVenderEntrada(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/backend/factura_anular.php') {
      req.body = await parseBody(req);
      routeFacturaAnular(req, res);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/backend/facturas_obtener.php') {
      routeFacturasObtener(req, res);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/backend/factura_detalle.php') {
      routeFacturaDetalle(req, res);
      return;
    }

    if ((req.method === 'GET' || req.method === 'POST') && url.pathname === '/backend/pos_buscar_producto.php') {
      routePosBuscarProducto(req, res);
      return;
    }

    const pathname = decodeURIComponent(url.pathname);

    if (pathname === '/' || pathname === '/index.html') {
      const htmlPath = path.join(ROOT_DIR, 'index.html');
      if (fs.existsSync(htmlPath)) {
        sendFile(res, 200, htmlPath);
        return;
      }

      sendJson(res, 200, {
        success: true,
        mensaje: 'Servidor Node.js listo para recibir peticiones sobre las rutas PHP equivalentes.'
      });
      return;
    }

    if (pathname === '/frontend/index.php' || pathname === '/frontend/pos.php' || pathname === '/frontend/historial_facturas.php') {
      const htmlPath = path.join(ROOT_DIR, 'index.html');
      if (fs.existsSync(htmlPath)) {
        sendFile(res, 200, htmlPath);
        return;
      }
    }

    const candidatePath = path.join(ROOT_DIR, pathname.replace(/^\//, ''));
    if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
      sendFile(res, 200, candidatePath);
      return;
    }

    sendJson(res, 404, {
      success: false,
      mensaje: 'Ruta no encontrada.'
    });
  });
}

const server = createServer();
server.listen(PORT, () => {
  console.log(`Servidor Node.js escuchando en http://localhost:${PORT}`);
});
