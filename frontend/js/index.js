/**
 * Lógica JS para el Frontend de Venta de Entradas
 * Permite crear una funcion, seleccionar butacas y emitir factura imprimible.
 */

document.addEventListener('DOMContentLoaded', () => {
    const formCrearFuncion = document.getElementById('formCrearFuncion');
    const formCrearObra = document.getElementById('formCrearObra');
    const inputTituloObra = document.getElementById('titulo_obra');
    const inputDescripcionObra = document.getElementById('descripcion_obra');
    const inputDuracionObra = document.getElementById('duracion_obra');
    const alertaObra = document.getElementById('alerta-obra');
    const selectEspectaculo = document.getElementById('id_espectaculo');
    const selectSala = document.getElementById('id_sala');
    const inputFechaHora = document.getElementById('fecha_hora');
    const inputPrecioBase = document.getElementById('precio_base');
    const alertaFuncion = document.getElementById('alerta-funcion');

    const selectActuacion = document.getElementById('id_actuacion');
    const selectButaca = document.getElementById('id_butaca');
    const precioEstimado = document.getElementById('precio_estimado');
    const nombreComprador = document.getElementById('nombre_comprador');
    const emailComprador = document.getElementById('email_comprador');
    const modalRecibo = document.getElementById('modal-recibo');

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

    const crearFuncionButton = document.getElementById('btnCrearFuncion');
    const imprimirBtn = document.getElementById('btnImprimirFactura');
    const nuevaVentaBtn = document.getElementById('btnNuevaVenta');

    const formularios = {
        crearFuncion: document.getElementById('formCrearFuncion'),
        ventaEntrada: document.getElementById('formVenta')
    };

    function actualizarPrecioEstimado() {
        const actuacionSeleccionada = selectActuacion.options[selectActuacion.selectedIndex];
        const butacaSeleccionada = selectButaca.options[selectButaca.selectedIndex];

        if (!selectActuacion.value || !selectButaca.value) {
            precioEstimado.textContent = '$0.00';
            precioEstimado.style.color = '#64748b';
            return;
        }

        const precioBase = parseFloat(actuacionSeleccionada.dataset.precioBase || '0');
        const multiplicador = parseFloat(butacaSeleccionada.dataset.multiplicador || '1');
        const salaAct = actuacionSeleccionada.dataset.salaId;
        const salaBut = butacaSeleccionada.dataset.salaId;

        if (!salaAct || !salaBut || salaAct !== salaBut) {
            precioEstimado.textContent = 'Butaca no pertenece a la misma sala';
            precioEstimado.style.color = '#ef4444';
            return;
        }

        precioEstimado.textContent = `$${(precioBase * multiplicador).toFixed(2)}`;
        precioEstimado.style.color = '#1d4ed8';
    }

    function filtrarButacasPorSala() {
        const actuacionSeleccionada = selectActuacion.options[selectActuacion.selectedIndex];
        const salaId = actuacionSeleccionada ? actuacionSeleccionada.dataset.salaId : null;

        Array.from(selectButaca.options).forEach(option => {
            if (!option.value) {
                option.disabled = false;
                option.hidden = false;
                return;
            }
            option.disabled = salaId && option.dataset.salaId !== salaId;
            option.hidden = salaId && option.dataset.salaId !== salaId;
        });

        if (selectButaca.value && selectButaca.selectedOptions[0].disabled) {
            selectButaca.value = '';
        }
    }

    function mostrarAlertaFuncion(mensaje, tipo = 'success') {
        alertaFuncion.textContent = mensaje;
        alertaFuncion.classList.remove('success', 'error');
        alertaFuncion.classList.add(tipo);
        alertaFuncion.style.display = 'block';
    }

    function ocultarAlertaFuncion() {
        alertaFuncion.style.display = 'none';
    }

    function mostrarAlertaObra(mensaje, tipo = 'success') {
        alertaObra.textContent = mensaje;
        alertaObra.classList.remove('success', 'error');
        alertaObra.classList.add(tipo);
        alertaObra.style.display = 'block';
    }

    function ocultarAlertaObra() {
        alertaObra.style.display = 'none';
    }

    if (formCrearObra) {
        formCrearObra.addEventListener('submit', async event => {
            event.preventDefault();
            ocultarAlertaObra();

            const payload = {
                titulo: inputTituloObra.value.trim(),
                descripcion: inputDescripcionObra.value.trim(),
                duracion_minutos: inputDuracionObra.value
            };

            try {
                const response = await fetch('../backend/crear_espectaculo.php', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                });
                const data = await response.json();

                if (!data.success) {
                    mostrarAlertaObra(data.mensaje || 'Error al crear la obra.', 'error');
                    return;
                }

                const esp = data.espectaculo;
                const opcion = document.createElement('option');
                opcion.value = esp.id_espectaculo;
                opcion.textContent = esp.titulo;
                selectEspectaculo.appendChild(opcion);
                selectEspectaculo.value = esp.id_espectaculo;

                mostrarAlertaObra('Obra creada correctamente. Ahora puede crear la función.', 'success');
                formCrearObra.reset();
            } catch (error) {
                console.error(error);
                mostrarAlertaObra('Error al crear la obra. Intente nuevamente.', 'error');
            }
        });
    }

    if (formularios.crearFuncion) {
        formularios.crearFuncion.addEventListener('submit', async event => {
            event.preventDefault();
            ocultarAlertaFuncion();

            const payload = {
                id_espectaculo: selectEspectaculo.value,
                id_sala: selectSala.value,
                fecha_hora: inputFechaHora.value,
                precio_base: inputPrecioBase.value
            };

            try {
                const response = await fetch('../backend/crear_actuacion.php', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                });
                const data = await response.json();

                if (!data.success) {
                    mostrarAlertaFuncion(data.mensaje || 'Error al crear la funcion.', 'error');
                    return;
                }

                const act = data.actuacion;
                const option = document.createElement('option');
                option.value = act.id_actuacion;
                option.dataset.precioBase = act.precio_base;
                option.dataset.salaId = act.id_sala;
                option.textContent = `${act.titulo} (${act.sala_nombre}) - ${new Date(act.fecha_hora).toLocaleString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit', hour:'2-digit', minute:'2-digit'})}`;
                selectActuacion.appendChild(option);
                selectActuacion.value = act.id_actuacion;
                filtrarButacasPorSala();
                actualizarPrecioEstimado();

                mostrarAlertaFuncion('Funcion creada y seleccionada correctamente.', 'success');
                formularios.crearFuncion.reset();
            } catch (error) {
                console.error(error);
                mostrarAlertaFuncion('Error al crear la funcion. Intente nuevamente.', 'error');
            }
        });
    }

    if (selectActuacion) {
        selectActuacion.addEventListener('change', () => {
            filtrarButacasPorSala();
            actualizarPrecioEstimado();
        });
    }

    if (selectButaca) {
        selectButaca.addEventListener('change', actualizarPrecioEstimado);
    }

    if (formularios.ventaEntrada) {
        formularios.ventaEntrada.addEventListener('submit', async event => {
            event.preventDefault();

            if (!selectActuacion.value) {
                alert('Debe seleccionar una funcion.');
                selectActuacion.focus();
                return;
            }
            if (!selectButaca.value) {
                alert('Debe seleccionar una butaca.');
                selectButaca.focus();
                return;
            }
            if (nombreComprador.value.trim().length < 3) {
                alert('Ingrese un nombre valido para el comprador.');
                nombreComprador.focus();
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailComprador.value.trim())) {
                alert('Ingrese un correo electronico valido.');
                emailComprador.focus();
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
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                });
                const data = await response.json();

                if (!data.success) {
                    alert(data.mensaje || 'Error al vender la entrada.');
                    return;
                }

                const factura = data.factura;
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
                modalRecibo.classList.add('active');

                formularios.ventaEntrada.reset();
                precioEstimado.textContent = '$0.00';
                precioEstimado.style.color = '#64748b';
            } catch (error) {
                console.error(error);
                alert('Error al emitir la factura de la entrada. Intente nuevamente.');
            }
        });
    }

    if (document.getElementById('cerrarModalRecibo')) {
        document.getElementById('cerrarModalRecibo').addEventListener('click', () => {
            modalRecibo.classList.remove('active');
        });
    }

    if (imprimirBtn) {
        imprimirBtn.addEventListener('click', () => window.print());
    }

    if (nuevaVentaBtn) {
        nuevaVentaBtn.addEventListener('click', () => {
            modalRecibo.classList.remove('active');
        });
    }
});
