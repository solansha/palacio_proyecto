<?php
/**
 * Backend - Crear nueva Actuacion / Funcion
 * Palacio de Festivales
 */
session_start();

if (!isset($_SESSION['usuario_activo'])) {
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode(['success' => false, 'mensaje' => 'Sesion invalida o expirada.']);
    exit;
}

require_once __DIR__ . '/conexion.php';

$rawJson = file_get_contents('php://input');
$jsonData = json_decode($rawJson, true);
$data = is_array($jsonData) ? $jsonData : $_POST;

$idEspectaculo = filter_var($data['id_espectaculo'] ?? null, FILTER_VALIDATE_INT);
$idSala = filter_var($data['id_sala'] ?? null, FILTER_VALIDATE_INT);
$fechaHora = trim($data['fecha_hora'] ?? '');
$precioBase = filter_var($data['precio_base'] ?? null, FILTER_VALIDATE_FLOAT);

if (!$idEspectaculo || !$idSala || empty($fechaHora) || $precioBase === false || $precioBase <= 0) {
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode(['success' => false, 'mensaje' => 'Datos invalidos para crear la funcion.']);
    exit;
}

try {
    $stmtSpec = $pdo->prepare('SELECT id_espectaculo, titulo FROM espectaculo WHERE id_espectaculo = ?');
    $stmtSpec->execute([$idEspectaculo]);
    $espectaculo = $stmtSpec->fetch();

    if (!$espectaculo) {
        throw new Exception('Espectaculo no encontrado.');
    }

    $stmtSala = $pdo->prepare('SELECT id_sala, nombre FROM sala WHERE id_sala = ?');
    $stmtSala->execute([$idSala]);
    $sala = $stmtSala->fetch();

    if (!$sala) {
        throw new Exception('Sala no encontrada.');
    }

    $stmt = $pdo->prepare('INSERT INTO actuacion (id_espectaculo, id_sala, fecha_hora, precio_base) VALUES (:id_espectaculo, :id_sala, :fecha_hora, :precio_base)');
    $stmt->execute([
        ':id_espectaculo' => $idEspectaculo,
        ':id_sala' => $idSala,
        ':fecha_hora' => $fechaHora,
        ':precio_base' => $precioBase,
    ]);

    $idActuacion = $pdo->lastInsertId();

    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode([
        'success' => true,
        'mensaje' => 'Funcion creada correctamente.',
        'actuacion' => [
            'id_actuacion' => (int)$idActuacion,
            'titulo' => $espectaculo['titulo'],
            'id_sala' => (int)$sala['id_sala'],
            'sala_nombre' => $sala['nombre'],
            'fecha_hora' => $fechaHora,
            'precio_base' => number_format($precioBase, 2, '.', ''),
        ]
    ]);
    exit;
} catch (Exception $e) {
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode(['success' => false, 'mensaje' => 'Error: ' . $e->getMessage()]);
    exit;
}
