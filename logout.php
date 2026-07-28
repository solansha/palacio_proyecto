<?php
/**
 * Cierre de Sesión Seguro
 * Palacio de Festivales
 */
declare(strict_types=1);
session_start();

// Limpiar todas las variables de sesión
$_SESSION = [];

// Destruir la cookie de sesión si existe
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        time() - 42000,
        $params["path"],
        $params["domain"],
        $params["secure"],
        $params["httponly"]
    );
}

// Destruir la sesión totalmente
session_destroy();

header('Location: login.php');
exit();