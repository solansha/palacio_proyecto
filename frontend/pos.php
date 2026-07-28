<?php
/**
 * Frontend - Punto de Venta (POS) con Venta de Entradas
 * Palacio de Festivales
 */
session_start();
header('Content-Type: text/html; charset=UTF-8');

if (!isset($_SESSION['usuario_activo'])) {
    header('Location: ../login.php');
    exit();
}

$usuarioSesion = $_SESSION['usuario_activo'];
require_once __DIR__ . '/../backend/conexion.php';

// Fetch Actuaciones disponibles (para venta de entradas)
$actuaciones = $pdo->query("SELECT a.id_actuacion, e.titulo, s.id_sala, s.nombre AS sala_nombre, a.fecha_hora, a.precio_base FROM actuacion a JOIN espectaculo e ON a.id_espectaculo = e.id_espectaculo JOIN sala s ON a.id_sala = s.id_sala ORDER BY a.fecha_hora ASC")->fetchAll();

// Fetch todas las butacas (se filtrarán por sala en JS)
$butacas = $pdo->query("SELECT b.id_butaca, s.id_sala, s.nombre AS sala_nombre, z.nombre AS zona_nombre, z.multiplicador_precio, b.fila, b.numero FROM butaca b JOIN zona z ON b.id_zona = z.id_zona JOIN sala s ON z.id_sala = s.id_sala ORDER BY s.nombre, z.nombre, b.fila, b.numero")->fetchAll();
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Palacio de Festivales - Punto de Venta (POS)</title>
    <link rel="stylesheet" href="css/estilos.css">
</head>
<body>

    <!-- Header & Topbar -->
    <header class="topbar">
        <div class="topbar-title">
            <h1>Palacio de Festivales</h1>
            <p>Punto de Venta e Inventario POS</p>
        </div>
        <nav class="nav-tabs">
            <a href="index.php" class="nav-link">🎟 Entradas</a>
            <a href="pos.php" class="nav-link active">🛒 Punto de Venta (POS)</a>
            <a href="historial_facturas.php" class="nav-link">📄 Historial Facturas</a>
        </nav>
        <div class="topbar-user">
            <div class="topbar-user-chip">
                <div class="topbar-avatar"><?php echo strtoupper(substr($usuarioSesion['usuario'], 0, 1)); ?></div>
                <div style="display: flex; flex-direction: column;">
                    <span class="topbar-user-nombre"><?php echo htmlspecialchars($usuarioSesion['nombre'], ENT_QUOTES, 'UTF-8'); ?></span>
                    <span class="topbar-user-rol"><?php echo htmlspecialchars($usuarioSesion['rol'], ENT_QUOTES, 'UTF-8'); ?></span>
                </div>
            </div>
            <a href="../logout.php" class="btn-logout">Cerrar Sesion</a>
        </div>
    </header>

    <main class="main-container">
        <div class="pos-grid">
            
            <!-- PANEL IZQUIERDO: Venta de Entradas -->
            <section class="card">
                <div class="card-title">
                    <span>🧾 Venta de Entradas</span>
                </div>
                <form action="../backend/vender_entrada.php" method="POST" id="formVentaEntradas">
                    <div class="form-group">
                        <label for="id_actuacion">Seleccionar Función / Espectáculo:</label>
                        <select name="id_actuacion" id="id_actuacion" class="form-control" required>
                            <option value="" data-precio-base="0" data-sala-id="">-- Seleccione una función --</option>
                            <?php foreach ($actuaciones as $act): ?>
                                <option value="<?php echo $act['id_actuacion']; ?>"
                                        data-precio-base="<?php echo $act['precio_base']; ?>"
                                        data-sala-id="<?php echo $act['id_sala']; ?>">
                                    <?php echo htmlspecialchars($act['titulo'], ENT_QUOTES, 'UTF-8'); ?> (<?php echo htmlspecialchars($act['sala_nombre'], ENT_QUOTES, 'UTF-8'); ?>) - <?php echo date('d/m/Y H:i', strtotime($act['fecha_hora'])); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="id_butaca">Seleccionar Butaca:</label>
                        <select name="id_butaca" id="id_butaca" class="form-control" required>
                            <option value="" data-multiplicador="1" data-sala-id="">-- Seleccione una butaca --</option>
                            <?php foreach ($butacas as $b): ?>
                                <option value="<?php echo $b['id_butaca']; ?>"
                                        data-multiplicador="<?php echo $b['multiplicador_precio']; ?>"
                                        data-sala-id="<?php echo $b['id_sala']; ?>">
                                    <?php echo htmlspecialchars($b['sala_nombre'], ENT_QUOTES, 'UTF-8'); ?> | <?php echo htmlspecialchars($b['zona_nombre'], ENT_QUOTES, 'UTF-8'); ?> (x<?php echo $b['multiplicador_precio']; ?>) - Fila <?php echo $b['fila']; ?>, N <?php echo $b['numero']; ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="price-box">
                        <span class="label">Precio Ticket Calculado:</span>
                        <span class="amount" id="precio_ticket">$0.00</span>
                    </div>
                    <div class="form-group">
                        <label for="nombre_comprador">Nombre Completo del Comprador:</label>
                        <input type="text" name="nombre_comprador" id="nombre_comprador" class="form-control" placeholder="Ej. Juan Perez" required minlength="3">
                    </div>
                    <div class="form-group">
                        <label for="email_comprador">Correo Electrónico:</label>
                        <input type="email" name="email_comprador" id="email_comprador" class="form-control" placeholder="Ej. juan.perez@email.com" required>
                    </div>
                    <button type="submit" class="btn-submit">Confirmar y Emitir Entrada</button>
                </form>
            </section>

            <section class="card">
                <div class="card-title">
                    <span>📌 Instrucciones</span>
                </div>
                <p>Seleccione la función, la butaca y complete los datos del comprador. Luego haga clic en "Confirmar y Emitir Entrada" para generar la factura de la entrada y poder imprimirla.</p>
            </section>

        </div>
    </main>

    <!-- MODAL DE FACTURA / ENTRADA -->
    <div class="modal-overlay" id="modal-recibo">
        <div class="modal-dialog">
            <div class="modal-header">
                <h3 class="modal-title">🧾 Factura de Entrada Emitida</h3>
                <button type="button" class="modal-close" onclick="cerrarModalRecibo()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="ticket-container" id="ticket-print-area">
                    <div class="ticket-header">
                        <h3>PALACIO DE FESTIVALES</h3>
                        <p>Factura de Entrada</p>
                        <p id="ticket-factura-num" style="font-weight: bold; margin-top: 4px;">ENT-00000</p>
                        <p id="ticket-fecha" style="font-size: 0.75rem; color: #64748b;"></p>
                    </div>
                    <p style="font-size: 0.8rem; margin-bottom: 4px;">
                        <strong>Comprador:</strong> <span id="ticket-cliente"></span>
                    </p>
                    <p style="font-size: 0.8rem; margin-bottom: 4px;">
                        <strong>Correo:</strong> <span id="ticket-email"></span>
                    </p>
                    <p style="font-size: 0.8rem; margin-bottom: 4px;">
                        <strong>Función:</strong> <span id="ticket-funcion"></span>
                    </p>
                    <p style="font-size: 0.8rem; margin-bottom: 8px;">
                        <strong>Ubicación:</strong> <span id="ticket-ubicacion"></span>
                    </p>

                    <table class="ticket-table">
                        <thead>
                            <tr>
                                <th>Detalle</th>
                                <th class="colcant" style="text-align: center;">Cant</th>
                                <th class="colsubt" style="text-align: right;">Total</th>
                            </tr>
                        </thead>
                        <tbody id="ticket-items-body">
                            <!-- Items JS -->
                        </tbody>
                    </table>

                    <div class="ticket-totals">
                        <div style="display: flex; justify-content: space-between;">
                            <span>Subtotal:</span>
                            <span id="ticket-subtotal">$0.00</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>IVA (15%):</span>
                            <span id="ticket-iva">$0.00</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 0.95rem; margin-top: 4px;">
                            <span>TOTAL:</span>
                            <span id="ticket-total">$0.00</span>
                        </div>
                    </div>
                    <div style="text-align: center; margin-top: 12px; font-size: 0.75rem; color: #64748b;">
                        ¡Gracias por su compra!
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn-secondary" onclick="window.print()">🖨️ Imprimir Factura</button>
                <button type="button" class="btn-submit" style="width: auto; padding: 8px 18px;" onclick="cerrarModalRecibo()">Nueva Venta</button>
            </div>
        </div>
    </div>

    <script src="js/validaciones.js"></script>
    <script src="js/pos.js"></script>
</body>
</html>
