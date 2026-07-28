/**
 * Validaciones del lado del cliente y Calculadora de Precio Dinamico
 * Palacio de Festivales (Sin tildes)
 */
document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('formVenta');
    const actuacionSelect = document.getElementById('id_actuacion');
    const butacaSelect = document.getElementById('id_butaca');
    const precioPreview = document.getElementById('precio_estimado');
    const nombreInput = document.getElementById('nombre_comprador');
    const emailInput = document.getElementById('email_comprador');

    // Calcular precio estimado
    function actualizarPrecioEstimado() {
        const selectedActuacion = actuacionSelect.options[actuacionSelect.selectedIndex];
        const selectedButaca = butacaSelect.options[butacaSelect.selectedIndex];

        if (actuacionSelect.value && butacaSelect.value && selectedActuacion && selectedButaca) {
            const precioBase = parseFloat(selectedActuacion.getAttribute('data-precio-base') || 0);
            const multiplicador = parseFloat(selectedButaca.getAttribute('data-multiplicador') || 1);
            const salaActuacion = selectedActuacion.getAttribute('data-sala-id');
            const salaButaca = selectedButaca.getAttribute('data-sala-id');

            if (salaActuacion !== salaButaca) {
                precioPreview.textContent = 'Butaca de otra sala';
                precioPreview.style.color = '#ef4444';
                return;
            }

            const precioFinal = (precioBase * multiplicador).toFixed(2);
            precioPreview.textContent = `$${precioFinal}`;
            precioPreview.style.color = '#1d4ed8';
        } else {
            precioPreview.textContent = '$0.00';
            precioPreview.style.color = '#64748b';
        }
    }

    // Filtrar butacas por sala
    function filtrarButacasPorSala() {
        const selectedActuacion = actuacionSelect.options[actuacionSelect.selectedIndex];
        const salaActuacionId = selectedActuacion ? selectedActuacion.getAttribute('data-sala-id') : null;

        Array.from(butacaSelect.options).forEach(option => {
            if (!option.value) return;
            const salaButacaId = option.getAttribute('data-sala-id');
            if (salaActuacionId && salaButacaId !== salaActuacionId) {
                option.hidden = true;
                option.disabled = true;
            } else {
                option.hidden = false;
                option.disabled = false;
            }
        });

        const currentSelectedButaca = butacaSelect.options[butacaSelect.selectedIndex];
        if (currentSelectedButaca && currentSelectedButaca.disabled) {
            butacaSelect.value = '';
        }

        actualizarPrecioEstimado();
    }

    if (actuacionSelect) {
        actuacionSelect.addEventListener('change', filtrarButacasPorSala);
    }

    if (butacaSelect) {
        butacaSelect.addEventListener('change', actualizarPrecioEstimado);
    }

    if (form) {
        form.addEventListener('submit', function (e) {
            const idActuacion = actuacionSelect ? actuacionSelect.value : '';
            const idButaca = butacaSelect ? butacaSelect.value : '';
            const nombre = nombreInput ? nombreInput.value.trim() : '';
            const email = emailInput ? emailInput.value.trim() : '';

            if (!idActuacion) {
                alert('Por favor, seleccione un espectaculo / funcion.');
                e.preventDefault();
                actuacionSelect.focus();
                return;
            }

            if (!idButaca) {
                alert('Por favor, seleccione una butaca.');
                e.preventDefault();
                butacaSelect.focus();
                return;
            }

            if (nombre.length < 3) {
                alert('El nombre del comprador debe incluir al menos 3 caracteres.');
                e.preventDefault();
                nombreInput.focus();
                return;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                alert('Por favor, ingrese un correo electronico valido.');
                e.preventDefault();
                emailInput.focus();
                return;
            }
        });
    }
});