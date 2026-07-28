<?php
declare(strict_types=1);

require_once 'conexion.php';

session_start();
if (!isset($_SESSION['usuario_activo'])) {
    header('Location: ../index.php');
    exit();
}

$venta_id = (int)($_GET['venta_id'] ?? 0);
if ($venta_id <= 0) {
    die('Venta no válida');
}

$stmt = $pdo->prepare("
    SELECT v.*, c.nombre_completo AS cliente_nombre, c.cedula AS cliente_cedula,
           u.usuario AS vendedor_nombre
    FROM ventas v
    LEFT JOIN clientes c ON v.cliente_id = c.id
    INNER JOIN usuarios u ON v.usuario_id = u.id
    WHERE v.id = :id
");
$stmt->execute([':id' => $venta_id]);
$venta = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$venta) {
    die('Venta no encontrada');
}

$stmtDet = $pdo->prepare("
    SELECT dv.*, p.nombre_producto, p.codigo_barras
    FROM detalles_venta dv
    INNER JOIN productos p ON dv.producto_id = p.id
    WHERE dv.venta_id = :venta_id
");
$stmtDet->execute([':venta_id' => $venta_id]);
$detalles = $stmtDet->fetchAll(PDO::FETCH_ASSOC);

$fechaVenta = date('d/m/Y H:i:s', strtotime($venta['fecha_emision']));
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Recibo #<?php echo $venta_id; ?> - SISTEMA POS</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Courier New', monospace;
            background: #f0f0f0;
            display: flex;
            justify-content: center;
            padding: 20px;
        }
        .recibo {
            background: #fff;
            width: 320px;
            padding: 20px;
            border: 1px solid #ddd;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .recibo-header {
            text-align: center;
            border-bottom: 2px dashed #333;
            padding-bottom: 10px;
            margin-bottom: 10px;
        }
        .recibo-header h2 { font-size: 1.2em; margin-bottom: 2px; }
        .recibo-header small { color: #666; font-size: 0.8em; }
        .recibo-info { font-size: 0.8em; margin-bottom: 10px; color: #444; }
        .recibo-info p { margin-bottom: 2px; }
        .recibo-tabla { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 0.8em; }
        .recibo-tabla th { border-bottom: 1px solid #333; text-align: left; padding: 4px 0; font-weight: bold; }
        .recibo-tabla td { padding: 4px 0; vertical-align: top; }
        .recibo-tabla .colcant { text-align: center; width: 40px; }
        .recibo-tabla .colprec { text-align: right; width: 70px; }
        .recibo-tabla .colsubt { text-align: right; width: 70px; }
        .recibo-totales { border-top: 2px dashed #333; padding-top: 10px; margin-top: 10px; font-size: 0.85em; }
        .recibo-totales .fila { display: flex; justify-content: space-between; margin-bottom: 4px; }
        .recibo-totales .fila-total { font-weight: bold; font-size: 1.15em; border-top: 1px solid #333; padding-top: 6px; margin-top: 6px; }
        .recibo-footer { text-align: center; border-top: 2px dashed #333; margin-top: 15px; padding-top: 10px; font-size: 0.75em; color: #666; }
        .btn-imprimir { display: block; margin: 20px auto; padding: 12px 30px; background: #1b4332; color: #fff; border: none; border-radius: 8px; font-size: 1em; font-weight: bold; cursor: pointer; }
        .btn-imprimir:hover { background: #2d6a4f; }
        .btn-cerrar { display: block; margin: 10px auto; padding: 10px 30px; background: #dc3545; color: #fff; border: none; border-radius: 8px; font-size: 0.9em; cursor: pointer; }
        @media print { body { background: #fff; padding: 0; } .recibo { box-shadow: none; border: none; width: 100%; } .btn-imprimir, .btn-cerrar { display: none !important; } }
    </style>
</head>
<body>
    <div>
        <div class="recibo" id="recibo">
            <div class="recibo-header">
                <h2>SISTEMA POS</h2>
                <small>GESTION COMERCIAL</small><br>
                <small>Recibo de Venta #<?php echo $venta_id; ?></small>
            </div>
            <div class="recibo-info">
                <p><strong>Fecha:</strong> <?php echo $fechaVenta; ?></p>
                <p><strong>Vendedor:</strong> <?php echo htmlspecialchars($venta['vendedor_nombre']); ?></p>
                <?php if ($venta['cliente_nombre']): ?>
                    <p><strong>Cliente:</strong> <?php echo htmlspecialchars($venta['cliente_nombre']); ?></p>
                    <p><strong>Cedula:</strong> <?php echo htmlspecialchars($venta['cliente_cedula']); ?></p>
                <?php else: ?>
                    <p><strong>Cliente:</strong> Consumidor Final</p>
                <?php endif; ?>
            </div>
            <table class="recibo-tabla">
                <thead><tr><th>Prod</th><th class="colcant">Cant</th><th class="colprec">Precio</th><th class="colsubt">Subt.</th></tr></thead>
                <tbody>
                    <?php foreach ($detalles as $det): ?>
                    <tr>
                        <td><?php echo htmlspecialchars($det['nombre_producto']); ?></td>
                        <td class="colcant"><?php echo $det['cantidad']; ?></td>
                        <td class="colprec">$<?php echo number_format((float)$det['precio_congelado'], 2); ?></td>
                        <td class="colsubt">$<?php echo number_format((float)$det['subtotal'], 2); ?></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            <div class="recibo-totales">
                <div class="fila"><span>Subtotal:</span><span>$<?php echo number_format((float)$venta['subtotal'], 2); ?></span></div>
                <div class="fila"><span>IVA (15%):</span><span>$<?php echo number_format((float)$venta['iva'], 2); ?></span></div>
                <div class="fila fila-total"><span>TOTAL:</span><span>$<?php echo number_format((float)$venta['total_factura'], 2); ?></span></div>
                <div class="fila" style="margin-top:8px;"><span>Pago con:</span><span>$<?php echo number_format((float)$venta['monto_pago'], 2); ?></span></div>
                <div class="fila"><span>Cambio:</span><span>$<?php echo number_format((float)$venta['cambio'], 2); ?></span></div>
            </div>
            <div class="recibo-footer">
                <p>¡Gracias por su compra!</p>
                <p>Sistema POS v1.0.0 &copy; 2026</p>
            </div>
        </div>
        <button class="btn-imprimir" onclick="window.print()">Imprimir Recibo</button>
        <button class="btn-cerrar" onclick="window.close()">Cerrar</button>
    </div>
</body>
</html>
