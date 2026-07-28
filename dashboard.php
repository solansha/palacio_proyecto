<?php
/**
 * Redirección de compatibilidad a la Vista Principal del Palacio de Festivales
 */
session_start();

if (!isset($_SESSION['usuario_activo'])) {
    header('Location: login.php');
    exit();
} else {
    header('Location: frontend/index.php');
    exit();
}