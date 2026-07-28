<?php
// Activar reporte de errores en PHP para depuración explícita
ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

session_start();
header('Content-Type: text/html; charset=UTF-8');

if (isset($_SESSION['usuario_activo'])) {
    header('Location: frontend/index.php');
    exit();
}

$errorMsg = '';
if (isset($_GET['error'])) {
    if ($_GET['error'] === '1') {
        $errorMsg = 'Usuario o contrasena incorrectos.';
    } elseif ($_GET['error'] === '2') {
        $errorMsg = 'Por favor complete todos los campos.';
    }
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Acceso al Sistema - Palacio de Festivales</title>
    <link rel="stylesheet" href="frontend/css/estilos.css">
    <style>
        body {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background-color: var(--fondo-gris);
        }
        .login-box {
            width: 100%;
            max-width: 400px;
            padding: 32px 28px;
            border-top: 4px solid var(--azul-medio);
        }
        .login-header {
            text-align: center;
            margin-bottom: 24px;
        }
        .login-header h1 {
            font-size: 1.6rem;
            color: var(--azul-oscuro);
            margin-bottom: 4px;
            font-weight: 700;
        }
        .login-header p {
            color: var(--texto-secundario);
            font-size: 0.9rem;
        }
        .demo-credentials {
            margin-top: 20px;
            padding: 12px;
            background: var(--azul-soft);
            border: 1px dashed var(--azul-medio);
            border-radius: 6px;
            font-size: 0.85rem;
            color: var(--azul-oscuro);
            text-align: center;
        }
    </style>
</head>
<body>

    <div class="card login-box">
        <div class="login-header">
            <h1>Palacio de Festivales</h1>
            <p>Acceso al Sistema de Gestion</p>
        </div>

        <?php if (!empty($errorMsg)): ?>
            <div class="alert alert-error" style="margin-bottom: 18px;">
                <?= htmlspecialchars($errorMsg, ENT_QUOTES, 'UTF-8') ?>
            </div>
        <?php endif; ?>

        <form action="procesar_login.php" method="POST">
            <div class="form-group">
                <label for="usuario">Usuario:</label>
                <input type="text" name="usuario" id="usuario" class="form-control" placeholder="Ingrese su usuario" required autofocus>
            </div>

            <div class="form-group">
                <label for="password">Contrasena:</label>
                <input type="password" name="password" id="password" class="form-control" placeholder="Ingrese su contrasena" required>
            </div>

            <button type="submit" class="btn-submit">Iniciar Sesion</button>
        </form>

      
    </div>

</body>
</html>
