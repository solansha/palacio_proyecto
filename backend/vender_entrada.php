<?php
/**
 * Backend - Venta de Entradas (Protegido con Sesion - Sin tildes)
 * Palacio de Festivales
 */
session_start();
header('Content-Type: text/html; charset=UTF-8');

if (!isset($_SESSION['usuario_activo'])) {
    header('Location: ../login.php');
    exit();
}

require_once __DIR__ . '/conexion.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawJson = file_get_contents('php://input');
    $jsonData = json_decode($rawJson, true);

    $isAjaxJson = is_array($jsonData);
    if ($isAjaxJson) {
        header('Content-Type: application/json; charset=UTF-8');
        $data = $jsonData;
    } else {
        $data = $_POST;
    }

    // Sanitizacion y Validacion de datos POST
    $id_actuacion     = filter_var($data['id_actuacion'] ?? null, FILTER_VALIDATE_INT);
    $id_butaca        = filter_var($data['id_butaca'] ?? null, FILTER_VALIDATE_INT);
    $nombre_comprador = trim($data['nombre_comprador'] ?? '');
    $email_comprador  = filter_var($data['email_comprador'] ?? '', FILTER_VALIDATE_EMAIL);

    if (!$id_actuacion || !$id_butaca || empty($nombre_comprador) || strlen($nombre_comprador) < 3 || !$email_comprador) {
        if ($isAjaxJson) {
            echo json_encode(['success' => false, 'mensaje' => 'Datos de formulario invalidos o incompletos.']);
        } else {
            $msg = urlencode("Datos de formulario invalidos o incompletos.");
            header("Location: ../frontend/index.php?status=error&msg=$msg");
        }
        exit;
    }

    try {
        // Verificar que la actuacion exista
        $stmtAct = $pdo->prepare("
            SELECT a.id_sala, a.precio_base, e.titulo, s.nombre AS sala_nombre
            FROM actuacion a
            JOIN espectaculo e ON a.id_espectaculo = e.id_espectaculo
            JOIN sala s ON a.id_sala = s.id_sala
            WHERE a.id_actuacion = ?
        ");
        $stmtAct->execute([$id_actuacion]);
        $actuacionData = $stmtAct->fetch();

        if (!$actuacionData) {
            $msg = urlencode("La funcion o espectaculo seleccionado no existe.");
            header("Location: ../frontend/index.php?status=error&msg=$msg");
            exit;
        }

        // Verificar que la butaca exista
        $stmtBut = $pdo->prepare("
            SELECT b.id_butaca, z.id_sala, z.nombre AS zona_nombre, z.multiplicador_precio, b.fila, b.numero
            FROM butaca b
            JOIN zona z ON b.id_zona = z.id_zona
            WHERE b.id_butaca = ?
        ");
        $stmtBut->execute([$id_butaca]);
        $butacaData = $stmtBut->fetch();

        if (!$butacaData) {
            $msg = urlencode("La butaca seleccionada no existe en el sistema.");
            header("Location: ../frontend/index.php?status=error&msg=$msg");
            exit;
        }

        // Validar que la butaca corresponda a la misma sala
        if ($actuacionData['id_sala'] !== $butacaData['id_sala']) {
            $msg = urlencode("La butaca seleccionada no pertenece a la sala de esta funcion.");
            header("Location: ../frontend/index.php?status=error&msg=$msg");
            exit;
        }

        // Verificar disponibilidad (UNIQUE id_actuacion, id_butaca)
        $stmtCheck = $pdo->prepare("
            SELECT id_entrada 
            FROM entrada 
            WHERE id_actuacion = ? AND id_butaca = ?
        ");
        $stmtCheck->execute([$id_actuacion, $id_butaca]);

        if ($stmtCheck->fetch()) {
            $msg = urlencode("La butaca (Fila " . $butacaData['fila'] . ", N " . $butacaData['numero'] . ") ya fue vendida para esta funcion.");
            header("Location: ../frontend/index.php?status=error&msg=$msg");
            exit;
        }

        // Calcular precio dinamico
        $precio_final = round($actuacionData['precio_base'] * $butacaData['multiplicador_precio'], 2);
        $subtotal = round($precio_final, 2);
        $iva = round($subtotal * 0.15, 2);
        $total = round($subtotal + $iva, 2);
        $montoPagado = $total;
        $vuelto = 0.00;
        $idUsuario = $_SESSION['usuario_activo']['id'] ?? null;

        // Insertar la entrada y registrar la factura en el historial de ventas
        $pdo->beginTransaction();

        $stmtInsert = $pdo->prepare("INSERT INTO entrada (id_actuacion, id_butaca, nombre_comprador, email_comprador, precio_final) VALUES (?, ?, ?, ?, ?)");
        $stmtInsert->execute([$id_actuacion, $id_butaca, $nombre_comprador, $email_comprador, $precio_final]);

        $stmtCount = $pdo->query("SELECT MAX(id) AS max_id FROM venta");
        $maxIdRow = $stmtCount->fetch();
        $nextVentaId = ((int)($maxIdRow['max_id'] ?? 0)) + 1;
        $numeroFactura = 'ENT-' . str_pad($nextVentaId, 5, '0', STR_PAD_LEFT);

        $stmtVenta = $pdo->prepare("INSERT INTO venta (numero_factura, cliente, subtotal, iva, total, monto_pagado, vuelto, estado, id_usuario, fecha_venta) VALUES (:numero_factura, :cliente, :subtotal, :iva, :total, :monto_pagado, :vuelto, 'Completada', :id_usuario, NOW())");
        $stmtVenta->execute([
            ':numero_factura' => $numeroFactura,
            ':cliente' => $nombre_comprador,
            ':subtotal' => $subtotal,
            ':iva' => $iva,
            ':total' => $total,
            ':monto_pagado' => $montoPagado,
            ':vuelto' => $vuelto,
            ':id_usuario' => $idUsuario
        ]);

        $pdo->commit();

        if ($isAjaxJson) {
            echo json_encode([
                'success' => true,
                'mensaje' => 'Entrada vendida con exito y registrada en historial.',
                'factura' => [
                    'numero_factura' => $numeroFactura,
                    'fecha_compra' => date('d/m/Y H:i'),
                    'cliente' => $nombre_comprador,
                    'email' => $email_comprador,
                    'funcion' => $actuacionData['titulo'],
                    'sala' => $actuacionData['sala_nombre'],
                    'zona' => $butacaData['zona_nombre'],
                    'fila' => $butacaData['fila'],
                    'numero' => $butacaData['numero'],
                    'subtotal' => number_format($subtotal, 2, '.', ''),
                    'iva' => number_format($iva, 2, '.', ''),
                    'total' => number_format($total, 2, '.', ''),
                ]
            ]);
            exit;
        }
        $successMsg = urlencode("Entrada vendida con exito a " . htmlspecialchars($nombre_comprador, ENT_QUOTES, 'UTF-8') . " por $" . number_format($precio_final, 2) . ".");
        header("Location: ../frontend/index.php?status=success&msg=$successMsg");
        exit;

    } catch (PDOException $e) {
        if ($isAjaxJson) {
            $message = ($e->getCode() == 23000)
                ? 'Conflicto de reserva: La butaca se vendio en otra transaccion.'
                : 'Error de Base de Datos: ' . $e->getMessage();
            echo json_encode(['success' => false, 'mensaje' => $message]);
        } else {
            if ($e->getCode() == 23000) {
                $msg = urlencode('Conflicto de reserva: La butaca se vendio en otra transaccion.');
            } else {
                $msg = urlencode('Error de Base de Datos: ' . $e->getMessage());
            }
            header("Location: ../frontend/index.php?status=error&msg=$msg");
        }
        exit;
    } catch (Exception $e) {
        if ($isAjaxJson) {
            echo json_encode(['success' => false, 'mensaje' => 'Error inesperado: ' . $e->getMessage()]);
        } else {
            $msg = urlencode('Error inesperado: ' . $e->getMessage());
            header("Location: ../frontend/index.php?status=error&msg=$msg");
        }
        exit;
    }
} else {
    header("Location: ../frontend/index.php");
    exit;
}