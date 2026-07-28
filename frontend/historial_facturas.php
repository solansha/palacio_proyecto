<?php
/**
 * Frontend - Historial de Facturas y Registro de Ventas con KPIs
 * Palacio de Festivales
 */
session_start();
header('Content-Type: text/html; charset=UTF-8');

if (!isset($_SESSION['usuario_activo'])) {
    header('Location: ../login.php');
    exit();
}

$usuarioSesion = $_SESSION['usuario_activo'];
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Palacio de Festivales - Historial de Facturas</title>
    <link rel="stylesheet" href="css/estilos.css">
</head>
<body>

    <!-- Header & Topbar -->
    <header class="topbar">
        <div class="topbar-title">
            <h1>Palacio de Festivales</h1>
            <p>Historial General de Facturacion y Registro de Ventas</p>
        </div>
        <nav class="nav-tabs">
            <a href="index.php" class="nav-link">🎟 Entradas</a>
            <a href="pos.php" class="nav-link">🛒 Punto de Venta (POS)</a>
            <a href="historial_facturas.php" class="nav-link active">📄 Historial Facturas</a>
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

    <main class="main-container">
        
        <!-- TARJETAS KPI DE RENDIMIENTO DE VENTAS -->
        <section class="kpi-grid">
            <div class="kpi-card kpi-green">
                <div class="kpi-icon">💰</div>
                <div class="kpi-info">
                    <span class="kpi-value" id="kpi-total-vendido">$0.00</span>
                    <span class="kpi-label">Total Vendido</span>
                </div>
            </div>

            <div class="kpi-card">
                <div class="kpi-icon">📄</div>
                <div class="kpi-info">
                    <span class="kpi-value" id="kpi-cantidad-facturas">0</span>
                    <span class="kpi-label">Facturas Emitidas</span>
                </div>
            </div>

            <div class="kpi-card kpi-orange">
                <div class="kpi-icon">📊</div>
                <div class="kpi-info">
                    <span class="kpi-value" id="kpi-ticket-promedio">$0.00</span>
                    <span class="kpi-label">Ticket Promedio</span>
                </div>
            </div>
        </section>

        <!-- FILTROS AVANZADOS DE BÚSQUEDA -->
        <section class="filter-box">
            <form id="form-filtros-facturas" onsubmit="return false;">
                <div class="filter-grid">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label for="filter-fecha-inicio">Fecha Inicio:</label>
                        <input type="date" id="filter-fecha-inicio" class="form-control">
                    </div>

                    <div class="form-group" style="margin-bottom: 0;">
                        <label for="filter-fecha-fin">Fecha Fin:</label>
                        <input type="date" id="filter-fecha-fin" class="form-control">
                    </div>

                    <div class="form-group" style="margin-bottom: 0;">
                        <label for="filter-cliente">Cliente:</label>
                        <input type="text" id="filter-cliente" class="form-control" placeholder="Nombre de cliente...">
                    </div>

                    <div class="form-group" style="margin-bottom: 0;">
                        <label for="filter-numero-factura">N° Factura:</label>
                        <input type="text" id="filter-numero-factura" class="form-control" placeholder="Ej. FAC-00001">
                    </div>

                    <div class="form-group" style="margin-bottom: 0;">
                        <label for="filter-estado">Estado:</label>
                        <select id="filter-estado" class="form-control">
                            <option value="Todas">Todas</option>
                            <option value="Completada">Completada</option>
                            <option value="Anulada">Anulada</option>
                        </select>
                    </div>

                    <div style="display: flex; gap: 6px;">
                        <button type="button" id="btn-limpiar-filtros" class="btn-secondary" style="padding: 9px 12px;" title="Limpiar Filtros">🔄</button>
                        <button type="submit" id="btn-filtrar" class="btn-submit" style="padding: 9px 16px;">Filtrar</button>
                    </div>
                </div>
            </form>
        </section>

        <!-- TABLA PRINCIPAL DE FACTURAS -->
        <section class="card">
            <div class="card-title">
                <span>📋 Listado General de Facturas</span>
                <span id="facturas-count-badge" class="badge badge-blue">0 registros</span>
            </div>

            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>N° Factura</th>
                            <th>Fecha y Hora</th>
                            <th>Cliente</th>
                            <th>Vendedor</th>
                            <th style="text-align: right;">Total ($)</th>
                            <th style="text-align: center;">Estado</th>
                            <th style="text-align: center;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="facturas-table-body">
                        <!-- Carga dinámica JS -->
                    </tbody>
                </table>
            </div>
        </section>

    </main>

    <!-- MODAL DETALLE DE FACTURA -->
    <div class="modal-overlay" id="modal-detalle-factura">
        <div class="modal-dialog">
            <div class="modal-header">
                <h3 class="modal-title" id="modal-factura-titulo">Detalle de Factura #FAC-00000</h3>
                <button type="button" class="modal-close" onclick="cerrarModalDetalle()">&times;</button>
            </div>
            <div class="modal-body">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px; font-size: 0.88rem; background: var(--fondo-gris); padding: 14px; border-radius: 8px; border: 1px solid var(--borde);">
                    <div>
                        <p><strong>Cliente:</strong> <span id="modal-factura-cliente">-</span></p>
                        <p><strong>Vendedor:</strong> <span id="modal-factura-vendedor">-</span></p>
                    </div>
                    <div>
                        <p><strong>Fecha:</strong> <span id="modal-factura-fecha">-</span></p>
                        <p><strong>Estado:</strong> <span id="modal-factura-estado-badge">-</span></p>
                    </div>
                </div>

                <h4 style="font-size: 0.95rem; color: var(--azul-oscuro); margin-bottom: 10px;">Ítems Facturados:</h4>
                
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>Cant</th>
                                <th>Producto</th>
                                <th style="text-align: right;">Precio Unit.</th>
                                <th style="text-align: right;">Subtotal Linea</th>
                            </tr>
                        </thead>
                        <tbody id="modal-factura-items-body">
                            <!-- Items JS -->
                        </tbody>
                    </table>
                </div>

                <!-- Totales del Modal -->
                <div style="margin-top: 16px; background: var(--azul-soft); padding: 14px; border-radius: 8px; border: 1px solid #bfdbfe; font-size: 0.9rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span>Subtotal:</span>
                        <strong id="modal-factura-subtotal">$0.00</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span>IVA (15%):</span>
                        <strong id="modal-factura-iva">$0.00</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 1.1rem; color: var(--azul-oscuro); font-weight: bold; border-top: 1px solid #93c5fd; padding-top: 6px; margin-top: 6px;">
                        <span>TOTAL FACTURA:</span>
                        <span id="modal-factura-total" style="color: var(--azul-medio);">$0.00</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 0.82rem; color: var(--texto-secundario);">
                        <span>Monto Pagado: <span id="modal-factura-pagado">$0.00</span></span>
                        <span>Vuelto / Cambio: <span id="modal-factura-vuelto">$0.00</span></span>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn-secondary" onclick="cerrarModalDetalle()">Cerrar</button>
            </div>
        </div>
    </div>

    <script src="js/facturas.js"></script>
</body>
</html>
