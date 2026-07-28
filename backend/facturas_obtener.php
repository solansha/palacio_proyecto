<?php
/**
 * API Endpoint: Obtener Historial de Facturas y KPIs
 * Filtros dinámicos por rango de fechas, cliente y N° Factura
 * Palacio de Festivales - Facturación
 */
header('Content-Type: application/json; charset=utf-8');
session_start();

if (!isset($_SESSION['usuario_activo'])) {
    echo json_encode(['success' => false, 'mensaje' => 'Sesion invalida o expirada.']);
    exit();
}

require_once __DIR__ . '/conexion.php';

try {
    $fechaInicio = trim($_GET['fecha_inicio'] ?? '');
    $fechaFin    = trim($_GET['fecha_fin'] ?? '');
    $cliente     = trim($_GET['cliente'] ?? '');
    $numeroFac   = trim($_GET['numero_factura'] ?? '');
    $estado      = trim($_GET['estado'] ?? '');

    $whereClauses = [];
    $params = [];

    if ($fechaInicio !== '') {
        $whereClauses[] = "DATE(v.fecha_venta) >= :fecha_inicio";
        $params[':fecha_inicio'] = $fechaInicio;
    }

    if ($fechaFin !== '') {
        $whereClauses[] = "DATE(v.fecha_venta) <= :fecha_fin";
        $params[':fecha_fin'] = $fechaFin;
    }

    if ($cliente !== '') {
        $whereClauses[] = "v.cliente LIKE :cliente";
        $params[':cliente'] = '%' . $cliente . '%';
    }

    if ($numeroFac !== '') {
        $whereClauses[] = "v.numero_factura LIKE :numero_factura";
        $params[':numero_factura'] = '%' . $numeroFac . '%';
    }

    if ($estado !== '' && $estado !== 'Todas') {
        $whereClauses[] = "v.estado = :estado";
        $params[':estado'] = $estado;
    }

    $whereSql = '';
    if (!empty($whereClauses)) {
        $whereSql = 'WHERE ' . implode(' AND ', $whereClauses);
    }

    // 1. Obtener listado de facturas
    $sqlFacturas = "
        SELECT v.id, v.numero_factura, v.cliente, v.subtotal, v.iva, v.total, v.monto_pagado, v.vuelto, 
               v.estado, v.fecha_venta, IFNULL(u.nombre, 'Sistema') AS vendedor
        FROM venta v
        LEFT JOIN usuarios u ON v.id_usuario = u.id
        {$whereSql}
        ORDER BY v.fecha_venta DESC, v.id DESC
    ";

    $stmtFacturas = $pdo->prepare($sqlFacturas);
    $stmtFacturas->execute($params);
    $facturas = $stmtFacturas->fetchAll();

    // 2. Calcular KPIs (Solo considerando ventas con estado 'Completada')
    $kpiWhereClauses = $whereClauses;
    $kpiParams = $params;

    // Asegurar que para el cálculo de KPI de total vendido solo contemos las 'Completada'
    $kpiWhereClausesCompletadas = $kpiWhereClauses;
    $kpiWhereClausesCompletadas[] = "v.estado = 'Completada'";
    $kpiWhereSqlCompletadas = 'WHERE ' . implode(' AND ', $kpiWhereClausesCompletadas);

    $sqlKpis = "
        SELECT 
            IFNULL(SUM(v.total), 0) AS total_vendido,
            COUNT(v.id) AS cantidad_facturas
        FROM venta v
        {$kpiWhereSqlCompletadas}
    ";

    $stmtKpis = $pdo->prepare($sqlKpis);
    $stmtKpis->execute($kpiParams);
    $kpiRow = $stmtKpis->fetch();

    $totalVendido = (float)($kpiRow['total_vendido'] ?? 0.0);
    $cantidadFacturas = (int)($kpiRow['cantidad_facturas'] ?? 0);
    $ticketPromedio = ($cantidadFacturas > 0) ? round($totalVendido / $cantidadFacturas, 2) : 0.0;

    // Formatear los datos de las facturas para la respuesta JSON
    foreach ($facturas as &$f) {
        $f['id'] = (int)$f['id'];
        $f['subtotal'] = (float)$f['subtotal'];
        $f['iva'] = (float)$f['iva'];
        $f['total'] = (float)$f['total'];
        $f['monto_pagado'] = (float)$f['monto_pagado'];
        $f['vuelto'] = (float)$f['vuelto'];
        $f['fecha_formateada'] = date('d/m/Y H:i', strtotime($f['fecha_venta']));
    }

    echo json_encode([
        'success' => true,
        'kpis' => [
            'total_vendido' => $totalVendido,
            'cantidad_facturas' => $cantidadFacturas,
            'ticket_promedio' => $ticketPromedio
        ],
        'facturas' => $facturas,
        'total_registros' => count($facturas)
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'mensaje' => 'Error al consultar las facturas: ' . $e->getMessage()
    ]);
}
