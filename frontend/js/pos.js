/**
 * Lógica JS para el Punto de Venta de Entradas - Palacio de Festivales
 * Controla selección de función/butaca, precio dinámico y factura imprimible.
 */

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('formVentaEntradas');
    const selectActuacion = document.getElementById('id_actuacion');
    const selectButaca = document.getElementById('id_butaca');
    const precioTicket = document.getElementById('precio_ticket');
    const nombreComprador = document.getElementById('nombre_comprador');
    const emailComprador = document.getElementById('email_comprador');
    const modal = document.getElementById('modal-recibo');
    const ticketNumero = document.getElementById('ticket-factura-num');
    const ticketFecha = document.getElementById('ticket-fecha');
    const ticketCliente = document.getElementById('ticket-cliente');
    const ticketEmail = document.getElementById('ticket-email');
    const ticketFuncion = document.getElementById('ticket-funcion');
    const ticketUbicacion = document.getElementById('ticket-ubicacion');
    const ticketBody = document.getElementById('ticket-items-body');
    const ticketSubtotal = document.getElementById('ticket-subtotal');
    const ticketIva = document.getElementById('ticket-iva');
    const ticketTotal = document.getElementById('ticket-total');

    if (!form || !selectActuacion || !selectButaca) {
        return;
    }

    function actualizarPrecioTicket() {
        const actuacionSeleccionada = selectActuacion.options[selectActuacion.selectedIndex];
        const butacaSeleccionada = selectButaca.options[selectButaca.selectedIndex];

        if (!selectActuacion.value || !selectButaca.value) {
            precioTicket.textContent = '$0.00';
            precioTicket.style.color = '#64748b';
            return;
        }

        const precioBase = parseFloat(actuacionSeleccionada.dataset.precioBase || '0');
        const multiplicador = parseFloat(butacaSeleccionada.dataset.multiplicador || '1');
        const salaAct = actuacionSeleccionada.dataset.salaId;
        const salaBut = butacaSeleccionada.dataset.salaId;

        if (!salaAct || !salaBut || salaAct !== salaBut) {
            precioTicket.textContent = 'Butaca no pertenece a la misma sala';
            precioTicket.style.color = '#ef4444';
            return;
        }

        const precioFinal = (precioBase * multiplicador).toFixed(2);
        precioTicket.textContent = `$${precioFinal}`;
        precioTicket.style.color = '#1d4ed8';
    }

    function filtrarButacasPorSala() {
        const actuacionSeleccionada = selectActuacion.options[selectActuacion.selectedIndex];
        const salaSeleccionada = actuacionSeleccionada ? actuacionSeleccionada.dataset.salaId : null;

        Array.from(selectButaca.options).forEach(option => {
            if (!option.value) {
                option.disabled = false;
                option.hidden = false;
                return;
            }
            const salaButaca = option.dataset.salaId;
            if (salaSeleccionada && salaButaca !== salaSeleccionada) {
                option.disabled = true;
                option.hidden = true;
            } else {
                option.disabled = false;
                option.hidden = false;
            }
        });

        if (selectButaca.selectedOptions.length > 0 && selectButaca.selectedOptions[0].disabled) {
            selectButaca.value = '';
        }
    }

    function validarFormulario() {
        const nombre = nombreComprador.value.trim();
        const email = emailComprador.value.trim();

        if (!selectActuacion.value) {
            alert('Seleccione una función o espectáculo.');
            selectActuacion.focus();
            return false;
        }

        if (!selectButaca.value) {
            alert('Seleccione una butaca válida.');
            selectButaca.focus();
            return false;
        }

        if (nombre.length < 3) {
            alert('El nombre del comprador debe tener al menos 3 caracteres.');
            nombreComprador.focus();
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert('Ingrese un correo electrónico válido.');
            emailComprador.focus();
            return false;
        }

        if (precioTicket.textContent.includes('Butaca')) {
            alert('La butaca seleccionada no es válida para la función escogida.');
            selectButaca.focus();
            return false;
        }

        return true;
    }

    selectActuacion.addEventListener('change', () => {
        filtrarButacasPorSala();
        actualizarPrecioTicket();
    });

    selectButaca.addEventListener('change', actualizarPrecioTicket);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!validarFormulario()) {
            return;
        }

        const payload = {
            id_actuacion: selectActuacion.value,
            id_butaca: selectButaca.value,
            nombre_comprador: nombreComprador.value.trim(),
            email_comprador: emailComprador.value.trim()
        };

        try {
            const response = await fetch('../backend/vender_entrada.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();

            if (!data.success) {
                alert('Error: ' + (data.mensaje || 'No se pudo procesar la venta.'));
                return;
            }

            mostrarModalRecibo(data.factura);
            form.reset();
            precioTicket.textContent = '$0.00';
            precioTicket.style.color = '#64748b';
        } catch (error) {
            console.error(error);
            alert('Ocurrió un error al procesar la venta. Intente nuevamente.');
        }
    });

    function mostrarModalRecibo(factura) {
        ticketNumero.textContent = factura.numero_factura;
        ticketFecha.textContent = factura.fecha_compra;
        ticketCliente.textContent = factura.cliente;
        ticketEmail.textContent = factura.email;
        ticketFuncion.textContent = factura.funcion;
        ticketUbicacion.textContent = `${factura.sala} / ${factura.zona} — Fila ${factura.fila}, N ${factura.numero}`;

        ticketBody.innerHTML = `
            <tr>
                <td>Entrada</td>
                <td class="colcant" style="text-align:center;">1</td>
                <td class="colsubt" style="text-align:right;">$${parseFloat(factura.subtotal).toFixed(2)}</td>
            </tr>
        `;

        ticketSubtotal.textContent = `$${parseFloat(factura.subtotal).toFixed(2)}`;
        ticketIva.textContent = `$${parseFloat(factura.iva).toFixed(2)}`;
        ticketTotal.textContent = `$${parseFloat(factura.total).toFixed(2)}`;
        modal.classList.add('active');
    }

    window.cerrarModalRecibo = function () {
        modal.classList.remove('active');
    };
});
