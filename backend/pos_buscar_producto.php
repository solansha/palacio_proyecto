<?php
/**
 * API Endpoint: Buscar Producto por Código de Barras o Nombre
 * Palacio de Festivales - POS
 */
header('Content-Type: application/json; charset=utf-8');
session_start();

if (!isset($_SESSION['usuario_activo'])) {
    echo json_encode(['success' => false, 'mensaje' => 'Sesion invalida o expirada.']);
    exit();
}

require_once __DIR__ . '/conexion.php';

try {
    $q = trim($_GET['q'] ?? $_POST['q'] ?? $_GET['codigo_barras'] ?? $_POST['codigo_barras'] ?? '');

    if ($q === '') {
        // Si no envía término, retornar todos los productos con stock > 0
        $stmt = $pdo->prepare("
            SELECT id, codigo_barras, nombre, descripcion, precio, stock 
            FROM producto 
            ORDER BY nombre ASC
        ");
        $stmt->execute();
        $productos = $stmt->fetchAll();
    } else {
        // Primero buscar coincidencia exacta por código de barras
        $stmtExact = $pdo->prepare("
            SELECT id, codigo_barras, nombre, descripcion, precio, stock 
            FROM producto 
            WHERE codigo_barras = :exact_code
            LIMIT 1
        ");
        $stmtExact->execute([':exact_code' => $q]);
        $exactProduct = $stmtExact->fetch();

        if ($exactProduct) {
            $productos = [$exactProduct];
        } else {
            // Si no hay coincidencia exacta por código, buscar por coincidencia parcial en nombre o código
            $stmtLike = $pdo->prepare("
                SELECT id, codigo_barras, nombre, descripcion, precio, stock 
                FROM producto 
                WHERE codigo_barras LIKE :like_term OR nombre LIKE :like_term 
                ORDER BY nombre ASC 
                LIMIT 20
            ");
            $stmtLike->execute([':like_term' => '%' . $q . '%']);
            $productos = $stmtLike->fetchAll();
        }
    }

    // Castear tipos numéricos correctamente para JSON
    foreach ($productos as &$p) {
        $p['id'] = (int)$p['id'];
        $p['precio'] = (float)$p['precio'];
        $p['stock'] = (int)$p['stock'];
    }

    echo json_encode([
        'success' => true,
        'productos' => $productos,
        'total_hallados' => count($productos)
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'mensaje' => 'Error al buscar producto: ' . $e->getMessage()
    ]);
}
