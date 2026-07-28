<?php
/**
 * API Endpoint: Procesar Venta POS con Transacción SQL PDO
 * Registra cabecera y detalle de venta, y descuenta el stock automáticamente.
 * Palacio de Festivales - POS
 */
header('Content-Type: application/json; charset=utf-8');
session_start();

if (!isset($_SESSION['usuario_activo'])) {
    echo json_encode(['success' => false, 'mensaje' => 'Sesion invalida o expirada.']);
    exit();
}

require_once __DIR__ . '/conexion.php';

// Leer cuerpo de la solicitud JSON o datos POST
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

if (!$data) {
    $data = $_POST;
}

$clienteInput = trim($data['cliente'] ?? 'Consumidor Final');
$cliente = ($clienteInput === '') ? 'Consumidor Final' : $clienteInput;
$montoPagado = isset($data['monto_pagado']) ? (float)$data['monto_pagado'] : 0.0;
$items = $data['items'] ?? [];
$idUsuario = $_SESSION['usuario_activo']['id'] ?? null;

if (empty($items) || !is_array($items)) {
    echo json_encode(['success' => false, 'mensaje' => 'El carrito de compras esta vacio.']);
    exit();
}

try {
    // Iniciar transacción PDO
    $pdo->beginTransaction();

    $subtotalVenta = 0.0;
    $itemsProcesados = [];

    // 1. Validar productos y stock en la base de datos
    $stmtProd = $pdo->prepare("SELECT id, nombre, precio, stock FROM producto WHERE id = :id FOR UPDATE");
    
    foreach ($items as $item) {
        $idProducto = (int)($item['id_producto'] ?? 0);
        $cantidad = (int)($item['cantidad'] ?? 0);

        if ($idProducto <= 0 || $cantidad <= 0) {
            throw new Exception("Cantidad invalida o producto no seleccionado.");
        }

        $stmtProd->execute([':id' => $idProducto]);
        $producto = $stmtProd->fetch();

        if (!$producto) {
            throw new Exception("El producto ID {$idProducto} no existe en la base de datos.");
        }

        if ($producto['stock'] < $cantidad) {
            throw new Exception("Stock insuficiente para '{$producto['nombre']}'. Disponible: {$producto['stock']} unidades.");
        }

        $precioUnitario = (float)$producto['precio'];
        $subtotalLinea = round($precioUnitario * $cantidad, 2);
        $subtotalVenta += $subtotalLinea;

        $itemsProcesados[] = [
            'id_producto' => $idProducto,
            'nombre' => $producto['nombre'],
            'cantidad' => $cantidad,
            'precio_unitario' => $precioUnitario,
            'subtotal_linea' => $subtotalLinea
        ];
    }

    $subtotalVenta = round($subtotalVenta, 2);
    $ivaVenta = round($subtotalVenta * 0.15, 2); // IVA 15%
    $totalVenta = round($subtotalVenta + $ivaVenta, 2);

    if ($montoPagado < $totalVenta) {
        throw new Exception("El monto pagado ($" . number_format($montoPagado, 2) . ") es menor que el total de la venta ($" . number_format($totalVenta, 2) . ").");
    }

    $vueltoVenta = round($montoPagado - $totalVenta, 2);

    // 2. Generar Número de Factura Correlativo (FAC-00001)
    $stmtCount = $pdo->query("SELECT MAX(id) AS max_id FROM venta");
    $maxIdRow = $stmtCount->fetch();
    $nextId = ((int)($maxIdRow['max_id'] ?? 0)) + 1;
    $numeroFactura = 'FAC-' . str_pad($nextId, 5, '0', STR_PAD_LEFT);

    // 3. Registrar Cabecera de Venta
    $stmtVenta = $pdo->prepare("
        INSERT INTO venta (numero_factura, cliente, subtotal, iva, total, monto_pagado, vuelto, estado, id_usuario, fecha_venta)
        VALUES (:numero_factura, :cliente, :subtotal, :iva, :total, :monto_pagado, :vuelto, 'Completada', :id_usuario, NOW())
    ");

    $stmtVenta->execute([
        ':numero_factura' => $numeroFactura,
        ':cliente' => $cliente,
        ':subtotal' => $subtotalVenta,
        ':iva' => $ivaVenta,
        ':total' => $totalVenta,
        ':monto_pagado' => $montoPagado,
        ':vuelto' => $vueltoVenta,
        ':id_usuario' => $idUsuario
    ]);

    $idVenta = $pdo->lastInsertId();

    // 4. Registrar Detalles de Venta y Descontar Stock
    $stmtDetalle = $pdo->prepare("
        INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario, subtotal_linea)
        VALUES (:id_venta, :id_producto, :cantidad, :precio_unitario, :subtotal_linea)
    ");

    $stmtStock = $pdo->prepare("
        UPDATE producto 
        SET stock = stock - :cantidad 
        WHERE id = :id_producto AND stock >= :cantidad
    ");

    foreach ($itemsProcesados as $item) {
        $stmtDetalle->execute([
            ':id_venta' => $idVenta,
            ':id_producto' => $item['id_producto'],
            ':cantidad' => $item['cantidad'],
            ':precio_unitario' => $item['precio_unitario'],
            ':subtotal_linea' => $item['subtotal_linea']
        ]);

        $stmtStock->execute([
            ':cantidad' => $item['cantidad'],
            ':id_producto' => $item['id_producto']
        ]);

        if ($stmtStock->rowCount() === 0) {
            throw new Exception("Error al actualizar el stock del producto '{$item['nombre']}'.");
        }
    }

    // Confirmar Transacción PDO
    $pdo->commit();

    echo json_encode([
        'success' => true,
        'mensaje' => 'Venta procesada con exito.',
        'venta' => [
            'id' => (int)$idVenta,
            'numero_factura' => $numeroFactura,
            'cliente' => $cliente,
            'subtotal' => $subtotalVenta,
            'iva' => $ivaVenta,
            'total' => $totalVenta,
            'monto_pagado' => $montoPagado,
            'vuelto' => $vueltoVenta,
            'fecha' => date('d/m/Y H:i:s'),
            'items' => $itemsProcesados
        ]
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'mensaje' => $e->getMessage()
    ]);
}
