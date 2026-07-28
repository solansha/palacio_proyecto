<?php
/**
 * Backend - Crear nuevo Espectaculo / Obra
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

$titulo = trim($data['titulo'] ?? '');
$descripcion = trim($data['descripcion'] ?? '');
$duracionMinutos = filter_var($data['duracion_minutos'] ?? null, FILTER_VALIDATE_INT);

if ($titulo === '' || $duracionMinutos === false || $duracionMinutos <= 0) {
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode(['success' => false, 'mensaje' => 'Complete el nombre de la obra y la duracion en minutos.']);
    exit;
}

try {
    $stmt = $pdo->prepare('INSERT INTO espectaculo (titulo, descripcion, duracion_minutos) VALUES (:titulo, :descripcion, :duracion_minutos)');
    $stmt->execute([
        ':titulo' => $titulo,
        ':descripcion' => $descripcion,
        ':duracion_minutos' => $duracionMinutos,
    ]);

    $idEspectaculo = $pdo->lastInsertId();

    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode([
        'success' => true,
        'mensaje' => 'Obra creada correctamente.',
        'espectaculo' => [
            'id_espectaculo' => (int)$idEspectaculo,
            'titulo' => $titulo,
            'descripcion' => $descripcion,
            'duracion_minutos' => $duracionMinutos,
        ]
    ]);
    exit;
} catch (Exception $e) {
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode(['success' => false, 'mensaje' => 'Error al crear la obra: ' . $e->getMessage()]);
    exit;
}
