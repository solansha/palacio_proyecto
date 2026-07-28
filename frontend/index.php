<?php
/**
 * Frontend - Vista Principal del Palacio de Festivales (Minimalista Azul)
 * Sin tildes para maxima compatibilidad
 */
session_start();
header('Content-Type: text/html; charset=UTF-8');

if (!isset($_SESSION['usuario_activo'])) {
    header('Location: ../login.php');
    exit();
}

$usuarioSesion = $_SESSION['usuario_activo'];

require_once __DIR__ . '/../backend/conexion.php';
// Fetch Espectaculos disponibles para crear funciones
$espectaculos = $pdo->query(
    "SELECT id_espectaculo, titulo FROM espectaculo ORDER BY titulo ASC"
)->fetchAll();
// Fetch Actuaciones disponibles
$actuaciones = $pdo->query("
    SELECT a.id_actuacion, e.titulo, s.id_sala, s.nombre AS sala_nombre, a.fecha_hora, a.precio_base
    FROM actuacion a
    JOIN espectaculo e ON a.id_espectaculo = e.id_espectaculo
    JOIN sala s ON a.id_sala = s.id_sala
    ORDER BY a.fecha_hora ASC
")->fetchAll();

// Fetch Butacas
$butacas = $pdo->query("
    SELECT b.id_butaca, s.id_sala, s.nombre AS sala_nombre, z.nombre AS zona_nombre, z.multiplicador_precio, b.fila, b.numero
    FROM butaca b
    JOIN zona z ON b.id_zona = z.id_zona
    JOIN sala s ON z.id_sala = s.id_sala
    ORDER BY s.nombre, z.nombre, b.fila, b.numero
")->fetchAll();

// Fetch Entradas Vendidas
$entradas = $pdo->query("
    SELECT en.id_entrada, e.titulo, s.nombre AS sala_nombre, z.nombre AS zona_nombre, b.fila, b.numero, 
           en.nombre_comprador, en.email_comprador, en.precio_final, en.fecha_compra
    FROM entrada en
    JOIN actuacion a ON en.id_actuacion = a.id_actuacion
    JOIN espectaculo e ON a.id_espectaculo = e.id_espectaculo
    JOIN sala s ON a.id_sala = s.id_sala
    JOIN butaca b ON en.id_butaca = b.id_butaca
    JOIN zona z ON b.id_zona = z.id_zona
    ORDER BY en.fecha_compra DESC
")->fetchAll();
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Palacio de Festivales - Venta de Entradas</title>
    <link rel="stylesheet" href="css/estilos.css">
</head>
<body>

    <header class="topbar">
        <div class="topbar-title">
            <h1>Palacio de Festivales</h1>
            <p>Sistema Centralizado de Gestion y Venta de Entradas</p>
        </div>
        <nav class="nav-tabs">
            <a href="index.php" class="nav-link active">🎟 Entradas</a>
            <a href="pos.php" class="nav-link">🛒 Punto de Venta (POS)</a>
            <a href="historial_facturas.php" class="nav-link">📄 Historial Facturas</a>
        </nav>
        <div class="topbar-user">
            <div class="topbar-user-chip">
                <div class="topbar-avatar"><?= strtoupper(substr($usuarioSesion['usuario'], 0, 1)) ?></div>
                <div style="display: flex; flex-direction: column;">
                    <span class="topbar-user-nombre"><?= htmlspecialchars($usuarioSesion['nombre'], ENT_QUOTES, 'UTF-8') ?></span>
                    <span class="topbar-user-rol"><?= htmlspecialchars($usuarioSesion['rol'], ENT_QUOTES, 'UTF-8') ?></span>
                </div>
            </div>
            <a href="../logout.php" class="btn-logout">Cerrar Sesion</a>
        </div>
    </header>

    <!-- Alertas -->
    <?php if (isset($_GET['status'])): ?>
        <div class="alert-container">
            <?php if ($_GET['status'] === 'success'): ?>
                <div class="alert alert-success">
                    ✓ <?= htmlspecialchars($_GET['msg'] ?? 'Operacion realizada con exito.', ENT_QUOTES, 'UTF-8') ?>
                </div>
            <?php elseif ($_GET['status'] === 'error'): ?>
                <div class="alert alert-error">
                    Error: <?= htmlspecialchars($_GET['msg'] ?? 'Ha ocurrido un error al procesar la solicitud.', ENT_QUOTES, 'UTF-8') ?>
                </div>
            <?php endif; ?>
        </div>
    <?php endif; ?>

    <main class="main-container">
        <section class="card">
            <h2 class="card-title">Crear Nueva Obra</h2>
            <div id="alerta-obra" class="alert" style="display: none;"></div>
            <form id="formCrearObra">
                <div class="form-group">
                    <label for="titulo_obra">Nombre de la Obra:</label>
                    <input type="text" id="titulo_obra" class="form-control" required minlength="3" placeholder="Ej. La Casa de Bernarda Alba">
                </div>
                <div class="form-group">
                    <label for="descripcion_obra">Descripcion:</label>
                    <textarea id="descripcion_obra" class="form-control" rows="3" placeholder="Descripcion corta de la obra"></textarea>
                </div>
                <div class="form-group">
                    <label for="duracion_obra">Duracion (minutos):</label>
                    <input type="number" id="duracion_obra" class="form-control" min="1" required placeholder="Ej. 120">
                </div>
                <button type="submit" class="btn-submit">Crear Obra</button>
            </form>
        </section>

        <section class="card">
            <h2 class="card-title">Crear Nueva Funcion</h2>
            <div id="alerta-funcion" class="alert" style="display: none;"></div>
            <form id="formCrearFuncion">
                <div class="form-group">
                    <label for="id_espectaculo">Seleccionar Espectaculo:</label>
                    <select id="id_espectaculo" class="form-control" required>
                        <option value="">-- Seleccione un espectaculo --</option>
                        <?php foreach ($espectaculos as $esp): ?>
                            <option value="<?= $esp['id_espectaculo'] ?>"><?= htmlspecialchars($esp['titulo'], ENT_QUOTES, 'UTF-8') ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="form-group">
                    <label for="id_sala">Seleccionar Sala:</label>
                    <select id="id_sala" class="form-control" required>
                        <option value="">-- Seleccione una sala --</option>
                        <?php $salas = $pdo->query('SELECT id_sala, nombre FROM sala ORDER BY nombre')->fetchAll(); ?>
                        <?php foreach ($salas as $sala): ?>
                            <option value="<?= $sala['id_sala'] ?>"><?= htmlspecialchars($sala['nombre'], ENT_QUOTES, 'UTF-8') ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="form-group">
                    <label for="fecha_hora">Fecha y Hora:</label>
                    <input type="datetime-local" id="fecha_hora" class="form-control" required>
                </div>
                <div class="form-group">
                    <label for="precio_base">Precio Base:</label>
                    <input type="number" step="0.01" min="0" id="precio_base" class="form-control" required>
                </div>
                <button type="submit" class="btn-submit">Crear Funcion</button>
            </form>
        </section>

        <section class="card">
            <h2 class="card-title">Venta de Entrada</h2>
            <form action="../backend/vender_entrada.php" method="POST" id="formVenta">
                
                <div class="form-group">
                    <label for="id_actuacion">Seleccionar Funcion / Espectaculo:</label>
                    <select name="id_actuacion" id="id_actuacion" class="form-control" required>
                        <option value="" data-precio-base="0" data-sala-id="">-- Seleccione una funcion --</option>
                        <?php foreach ($actuaciones as $act): ?>
                            <option value="<?= $act['id_actuacion'] ?>" 
                                    data-precio-base="<?= $act['precio_base'] ?>"
                                    data-sala-id="<?= $act['id_sala'] ?>">
                                <?= htmlspecialchars($act['titulo'], ENT_QUOTES, 'UTF-8') ?> (<?= htmlspecialchars($act['sala_nombre'], ENT_QUOTES, 'UTF-8') ?>) - <?= date('d/m/Y H:i', strtotime($act['fecha_hora'])) ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>

                <div class="form-group">
                    <label for="id_butaca">Seleccionar Butaca:</label>
                    <select name="id_butaca" id="id_butaca" class="form-control" required>
                        <option value="" data-multiplicador="1" data-sala-id="">-- Seleccione una butaca --</option>
                        <?php foreach ($butacas as $b): ?>
                            <option value="<?= $b['id_butaca'] ?>" 
                                    data-multiplicador="<?= $b['multiplicador_precio'] ?>"
                                    data-sala-id="<?= $b['id_sala'] ?>">
                                <?= htmlspecialchars($b['sala_nombre'], ENT_QUOTES, 'UTF-8') ?> | <?= htmlspecialchars($b['zona_nombre'], ENT_QUOTES, 'UTF-8') ?> (x<?= $b['multiplicador_precio'] ?>) - Fila <?= $b['fila'] ?>, N <?= $b['numero'] ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>

                <!-- Calculadora de precio -->
                <div class="price-box">
                    <span class="label">Precio Total Calculado:</span>
                    <span class="amount" id="precio_estimado">$0.00</span>
                </div>

                <div class="form-group">
                    <label for="nombre_comprador">Nombre Completo del Comprador:</label>
                    <input type="text" name="nombre_comprador" id="nombre_comprador" class="form-control" placeholder="Ej. Juan Perez" required minlength="3">
                </div>

                <div class="form-group">
                    <label for="email_comprador">Correo Electronico:</label>
                    <input type="email" name="email_comprador" id="email_comprador" class="form-control" placeholder="Ej. juan.perez@email.com" required>
                </div>

                <button type="submit" class="btn-submit">Confirmar y Emitir Entrada</button>
            </form>
        </section>

        <!-- Tabla -->
        <section class="card">
            <h2 class="card-title">Registro de Entradas Emitidas</h2>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Espectaculo</th>
                            <th>Ubicacion</th>
                            <th>Comprador</th>
                            <th>Precio Final</th>
                            <th>Fecha Venta</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($entradas)): ?>
                            <tr>
                                <td colspan="6" class="empty-state">No hay entradas vendidas registradas.</td>
                            </tr>
                        <?php else: ?>
                            <?php foreach ($entradas as $e): ?>
                                <tr>
                                    <td><strong>#<?= sprintf('%04d', $e['id_entrada']) ?></strong></td>
                                    <td>
                                        <div><strong><?= htmlspecialchars($e['titulo'], ENT_QUOTES, 'UTF-8') ?></strong></div>
                                        <small style="color: var(--texto-secundario);"><?= htmlspecialchars($e['sala_nombre'], ENT_QUOTES, 'UTF-8') ?></small>
                                    </td>
                                    <td>
                                        <span class="badge badge-blue"><?= htmlspecialchars($e['zona_nombre'], ENT_QUOTES, 'UTF-8') ?></span>
                                        <div style="font-size: 0.85rem; margin-top: 2px;">Fila <?= $e['fila'] ?>, N <?= $e['numero'] ?></div>
                                    </td>
                                    <td>
                                        <div><?= htmlspecialchars($e['nombre_comprador'], ENT_QUOTES, 'UTF-8') ?></div>
                                        <small style="color: var(--texto-secundario);"><?= htmlspecialchars($e['email_comprador'], ENT_QUOTES, 'UTF-8') ?></small>
                                    </td>
                                    <td>
                                        <span class="badge badge-blue" style="font-size: 0.9rem;">$<?= number_format($e['precio_final'], 2) ?></span>
                                    </td>
                                    <td><?= date('d/m/Y H:i', strtotime($e['fecha_compra'])) ?></td>
                                </tr>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </section>
    </main>

    <script src="js/validaciones.js"></script>
    <script src="js/index.js"></script>
</body>
</html>