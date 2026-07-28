<?php
/**
 * API Endpoint: Obtener Detalle de una Factura
 * Devuelve la cabecera y los ítems vendidos para mostrar en el modal
 * Palacio de Festivales - Facturación
 */
header('Content-Type: application/json; charset=utf-8');
session_start();

if (!isset($_SESSION['usuario_activo'])) {
    echo json_encode(['success' => false, 'mensaje' => 'Sesion invalida o expirada.']);
    exit();
}

require_once __DIR__ . '/conexion.php';

$idVenta = (int)($_GET['id'] ?? $_POST['id'] ?? 0);

if ($idVenta <= 0) {
    echo json_encode(['success' => false, 'mensaje' => 'ID de factura no especificarse o invalido.']);
    exit();
}

try {
    // 1. Obtener cabecera de la factura
    $stmtVenta = $pdo->prepare("
        SELECT v.id, v.numero_factura, v.cliente, v.subtotal, v.iva, v.total, v.monto_pagado, v.vuelto,
               v.estado, v.fecha_venta, IFNULL(u.nombre, 'Sistema') AS vendedor
        FROM venta v
        LEFT JOIN usuarios u ON v.id_usuario = u.id
        WHERE v.id = :id
        LIMIT 1
    ");
    $stmtVenta->execute([':id' => $idVenta]);
    $venta = $stmtVenta->fetch();

    if (!$venta) {
        throw new Exception("Factura con ID {$idVenta} no encontrada.");
    }

    // 2. Obtener detalles de la factura con info de productos
    $stmtDetalles = $pdo->prepare("
        SELECT d.id, d.id_producto, p.codigo_barras, p.nombre AS producto_nombre,
               d.cantidad, d.precio_unitario, d.subtotal_linea
        FROM detalle_venta d
        JOIN producto p ON d.id_producto = p.id
        WHERE d.id_venta = :id_venta
        ORDER BY d.id ASC
    ");
    $stmtDetalles->execute([':id_venta' => $idVenta]);
    $detalles = $stmtDetalles->fetchAll();

    // Formatear tipos
    $venta['id'] = (int)$venta['id'];
    $venta['subtotal'] = (float)$venta['subtotal'];
    $venta['iva'] = (float)$venta['iva'];
    $venta['total'] = (float)$venta['total'];
    $venta['monto_pagado'] = (float)$venta['monto_pagado'];
    $venta['vuelto'] = (float)$venta['vuelto'];
    $venta['fecha_formateada'] = date('d/m/Y H:i:s', strtotime($venta['fecha_venta']));

    foreach ($detalles as &$det) {
        $det['id'] = (int)$det['id'];
        $det['id_producto'] = (int)$det['id_producto'];
        $det['cantidad'] = (int)$det['cantidad'];
        $det['precio_unitario'] = (float)$det['precio_unitario'];
        $det['subtotal_linea'] = (float)$det['subtotal_linea'];
    }

    echo json_encode([
        'success' => true,
        'venta' => $venta,
        'detalles' => $detalles
    ]);

} catch (Exception $e) {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'mensaje' => $e->getMessage()
    ]);
}
