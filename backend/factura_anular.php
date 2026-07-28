<?php
/**
 * API Endpoint: Anular Factura y Restituir Stock al Inventario
 * Transacción SQL PDO que cambia el estado a 'Anulada' y devuelve el stock.
 * Palacio de Festivales - Facturación
 */
header('Content-Type: application/json; charset=utf-8');
session_start();

if (!isset($_SESSION['usuario_activo'])) {
    echo json_encode(['success' => false, 'mensaje' => 'Sesion invalida o expirada.']);
    exit();
}

require_once __DIR__ . '/conexion.php';

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true) ?: $_POST;

$idVenta = (int)($data['id'] ?? 0);

if ($idVenta <= 0) {
    echo json_encode(['success' => false, 'mensaje' => 'ID de factura invalido o no proporcionado.']);
    exit();
}

try {
    // Iniciar Transacción PDO
    $pdo->beginTransaction();

    // 1. Verificar si la factura existe y su estado actual
    $stmtVenta = $pdo->prepare("SELECT id, numero_factura, estado FROM venta WHERE id = :id FOR UPDATE");
    $stmtVenta->execute([':id' => $idVenta]);
    $venta = $stmtVenta->fetch();

    if (!$venta) {
        throw new Exception("La factura ID {$idVenta} no existe.");
    }

    if ($venta['estado'] === 'Anulada') {
        throw new Exception("La factura {$venta['numero_factura']} ya se encuentra anulada.");
    }

    // 2. Obtener los productos e ítems vendidos en esta factura
    $stmtDetalle = $pdo->prepare("
        SELECT id_producto, cantidad 
        FROM detalle_venta 
        WHERE id_venta = :id_venta
    ");
    $stmtDetalle->execute([':id_venta' => $idVenta]);
    $items = $stmtDetalle->fetchAll();

    // 3. Restituir el stock de cada producto en la tabla producto
    $stmtRestituir = $pdo->prepare("
        UPDATE producto 
        SET stock = stock + :cantidad 
        WHERE id = :id_producto
    ");

    foreach ($items as $item) {
        $stmtRestituir->execute([
            ':cantidad' => (int)$item['cantidad'],
            ':id_producto' => (int)$item['id_producto']
        ]);
    }

    // 4. Actualizar estado de la factura a 'Anulada'
    $stmtUpdateVenta = $pdo->prepare("
        UPDATE venta 
        SET estado = 'Anulada' 
        WHERE id = :id
    ");
    $stmtUpdateVenta->execute([':id' => $idVenta]);

    // Confirmar Transacción PDO
    $pdo->commit();

    echo json_encode([
        'success' => true,
        'mensaje' => "La factura {$venta['numero_factura']} fue anulada correctamente y las unidades vendidas se restituyeron al stock de inventario."
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
