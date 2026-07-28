/**
 * Lógica JS para el Historial de Facturas - Palacio de Festivales
 * Carga de datos asíncrona, actualización reactiva de KPIs, modal de detalle y anulación con devolución de stock.
 */

document.addEventListener('DOMContentLoaded', () => {

    // Elementos DOM
    const formFiltros = document.getElementById('form-filtros-facturas');
    const inputFechaInicio = document.getElementById('filter-fecha-inicio');
    const inputFechaFin = document.getElementById('filter-fecha-fin');
    const inputCliente = document.getElementById('filter-cliente');
    const inputNumeroFactura = document.getElementById('filter-numero-factura');
    const selectEstado = document.getElementById('filter-estado');
    const btnLimpiarFiltros = document.getElementById('btn-limpiar-filtros');

    const kpiTotalVendido = document.getElementById('kpi-total-vendido');
    const kpiCantidadFacturas = document.getElementById('kpi-cantidad-facturas');
    const kpiTicketPromedio = document.getElementById('kpi-ticket-promedio');

    const facturasTableBody = document.getElementById('facturas-table-body');
    const facturasCountBadge = document.getElementById('facturas-count-badge');

    // 1. Cargar Facturas y KPIs al cargar la página
    cargarFacturasYKPIs();

    // Event listener para el formulario de filtros
    formFiltros.addEventListener('submit', (e) => {
        e.preventDefault();
        cargarFacturasYKPIs();
    });

    btnLimpiarFiltros.addEventListener('click', () => {
        inputFechaInicio.value = '';
        inputFechaFin.value = '';
        inputCliente.value = '';
        inputNumeroFactura.value = '';
        selectEstado.value = 'Todas';
        cargarFacturasYKPIs();
    });

    // 2. Función AJAX para obtener facturas y métricas KPI
    function cargarFacturasYKPIs() {
        facturasTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">⏳ Cargando historial de facturas...</td>
            </tr>
        `;

        const params = new URLSearchParams({
            fecha_inicio: inputFechaInicio.value,
            fecha_fin: inputFechaFin.value,
            cliente: inputCliente.value.trim(),
            numero_factura: inputNumeroFactura.value.trim(),
            estado: selectEstado.value
        });

        fetch(`../backend/facturas_obtener.php?${params.toString()}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    renderKPIs(data.kpis);
                    renderFacturas(data.facturas);
                } else {
                    alert("Error al cargar las facturas: " + data.mensaje);
                }
            })
            .catch(err => {
                console.error("Error al obtener facturas:", err);
                facturasTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="empty-state" style="color: #dc2626;">Error de conexión con el servidor.</td>
                    </tr>
                `;
            });
    }

    // 3. Renderizar Tarjetas KPI
    function renderKPIs(kpis) {
        kpiTotalVendido.textContent = `$${parseFloat(kpis.total_vendido).toFixed(2)}`;
        kpiCantidadFacturas.textContent = kpis.cantidad_facturas;
        kpiTicketPromedio.textContent = `$${parseFloat(kpis.ticket_promedio).toFixed(2)}`;
    }

    // 4. Renderizar Tabla Principal de Facturas
    function renderFacturas(facturas) {
        facturasTableBody.innerHTML = '';
        facturasCountBadge.textContent = `${facturas.length} registros`;

        if (facturas.length === 0) {
            facturasTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">No se encontraron facturas registradas con los filtros seleccionados.</td>
                </tr>
            `;
            return;
        }

        facturas.forEach(f => {
            const tr = document.createElement('tr');

            const isAnulada = f.estado === 'Anulada';
            const badgeClass = isAnulada ? 'badge-danger' : 'badge-success';

            tr.innerHTML = `
                <td><strong>${escapeHtml(f.numero_factura)}</strong></td>
                <td>${escapeHtml(f.fecha_formateada)}</td>
                <td>${escapeHtml(f.cliente)}</td>
                <td>${escapeHtml(f.vendedor)}</td>
                <td style="text-align: right; font-weight: bold; color: var(--azul-oscuro);">$${parseFloat(f.total).toFixed(2)}</td>
                <td style="text-align: center;">
                    <span class="badge ${badgeClass}">${escapeHtml(f.estado)}</span>
                </td>
                <td style="text-align: center;">
                    <div style="display: flex; gap: 6px; justify-content: center;">
                        <button type="button" class="btn-action-icon btn-ver-detalle" data-id="${f.id}">👁️ Detalle</button>
                        ${!isAnulada ? `<button type="button" class="btn-action-icon btn-action-anular btn-anular" data-id="${f.id}" data-numero="${f.numero_factura}">🚫 Anular</button>` : ''}
                    </div>
                </td>
            `;

            // Listeners
            tr.querySelector('.btn-ver-detalle').addEventListener('click', () => abrirModalDetalle(f.id));
            
            const btnAnular = tr.querySelector('.btn-anular');
            if (btnAnular) {
                btnAnular.addEventListener('click', () => ejecutarAnulacion(f.id, f.numero_factura));
            }

            facturasTableBody.appendChild(tr);
        });
    }

    // 5. Modal de Detalle de Factura
    function abrirModalDetalle(idFactura) {
        fetch(`../backend/factura_detalle.php?id=${idFactura}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    const venta = data.venta;
                    const detalles = data.detalles;

                    document.getElementById('modal-factura-titulo').textContent = `Detalle de Factura ${venta.numero_factura}`;
                    document.getElementById('modal-factura-cliente').textContent = venta.cliente;
                    document.getElementById('modal-factura-vendedor').textContent = venta.vendedor;
                    document.getElementById('modal-factura-fecha').textContent = venta.fecha_formateada;

                    const badgeClass = (venta.estado === 'Anulada') ? 'badge-danger' : 'badge-success';
                    document.getElementById('modal-factura-estado-badge').innerHTML = `<span class="badge ${badgeClass}">${venta.estado}</span>`;

                    const itemsBody = document.getElementById('modal-factura-items-body');
                    itemsBody.innerHTML = '';

                    detalles.forEach(item => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td><strong>${item.cantidad}x</strong></td>
                            <td>
                                <div>${escapeHtml(item.producto_nombre)}</div>
                                <small style="color: var(--texto-secundario);">${escapeHtml(item.codigo_barras)}</small>
                            </td>
                            <td style="text-align: right;">$${parseFloat(item.precio_unitario).toFixed(2)}</td>
                            <td style="text-align: right; font-weight: bold;">$${parseFloat(item.subtotal_linea).toFixed(2)}</td>
                        `;
                        itemsBody.appendChild(tr);
                    });

                    document.getElementById('modal-factura-subtotal').textContent = `$${parseFloat(venta.subtotal).toFixed(2)}`;
                    document.getElementById('modal-factura-iva').textContent = `$${parseFloat(venta.iva).toFixed(2)}`;
                    document.getElementById('modal-factura-total').textContent = `$${parseFloat(venta.total).toFixed(2)}`;
                    document.getElementById('modal-factura-pagado').textContent = `$${parseFloat(venta.monto_pagado).toFixed(2)}`;
                    document.getElementById('modal-factura-vuelto').textContent = `$${parseFloat(venta.vuelto).toFixed(2)}`;

                    document.getElementById('modal-detalle-factura').classList.add('active');
                } else {
                    alert("Error al cargar el detalle: " + data.mensaje);
                }
            })
            .catch(err => {
                alert("Error al comunicarse con el servidor.");
                console.error(err);
            });
    }

    window.cerrarModalDetalle = function() {
        document.getElementById('modal-detalle-factura').classList.remove('active');
    };

    // 6. Anulación de Factura con Transacción PDO
    function ejecutarAnulacion(idFactura, numeroFactura) {
        const mensajeConfirmacion = `¿Está seguro de anular la factura ${numeroFactura}?\n\n- El estado cambiará a 'Anulada'.\n- Las cantidades vendidas se devolverán automáticamente al stock del inventario.`;

        if (confirm(mensajeConfirmacion)) {
            fetch('../backend/factura_anular.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: idFactura })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    alert(data.mensaje);
                    cargarFacturasYKPIs(); // Recargar tabla y KPIs sin recargar página
                } else {
                    alert("No se pudo anular la factura: " + data.mensaje);
                }
            })
            .catch(err => {
                alert("Error de conexión al intentar anular la factura.");
                console.error(err);
            });
        }
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
});
