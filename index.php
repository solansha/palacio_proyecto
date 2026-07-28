<?php
session_start();

// Si el usuario ya inició sesión, enviarlo al dashboard dentro de frontend/
if (isset($_SESSION['usuario_activo'])) {
    header('Location: frontend/index.php');
    exit();
} else {
    // Si no ha iniciado sesión, enviarlo directo al formulario de login
    header('Location: login.php');
    exit();
}
?>