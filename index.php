<?php
/**
 * Punto de Entrada Principal (Root Router)
 * Palacio de Festivales
 */
session_start();

if (isset($_SESSION['usuario_activo'])) {
    header('Location: frontend/index.php');
    exit();
} else {
    header('Location: login.php');
    exit();
}
