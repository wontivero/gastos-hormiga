// Asegúrate de que esta URL sea la correcta de tu Google Script
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby9HF61PKFZVv3Y41WJKXd8_hZHIjSWvGcjPWhL-irPAjInABrVa1_WEEwPBAHmlZVVpw/exec';

document.addEventListener('DOMContentLoaded', () => {
    // Elementos DOM - Formularios y Vistas
    const expenseForm = document.getElementById('expenseForm');
    const motivoInput = document.getElementById('motivoInput');
    const montoInput = document.getElementById('montoInput');
    const historyGrid = document.getElementById('historyGrid');
    const quickMotivesContainer = document.getElementById('quickMotivesContainer');
    
    // Elementos DOM - Navegación
    const configToggleBtn = document.getElementById('configToggleBtn');
    const configIcon = document.getElementById('configIcon');
    const headerTitle = document.getElementById('headerTitle');
    const mainView = document.getElementById('mainView');
    const configView = document.getElementById('configView');
    const reportToggleBtn = document.getElementById('reportToggleBtn');
    const reportIcon = document.getElementById('reportIcon');
    const reportView = document.getElementById('reportView');
    
    // Elementos DOM - Configuración e Integrantes
    const memberSelection = document.getElementById('memberSelection');
    const configMembersList = document.getElementById('configMembersList');
    const newEmojiInput = document.getElementById('newEmojiInput');
    const newNameInput = document.getElementById('newNameInput');
    const addMemberBtn = document.getElementById('addMemberBtn');

    const configMotivesList = document.getElementById('configMotivesList');
    const newMotiveEmojiInput = document.getElementById('newMotiveEmojiInput');
    const newMotiveNameInput = document.getElementById('newMotiveNameInput');
    const addMotiveBtn = document.getElementById('addMotiveBtn');

    // Elementos DOM - Modal de Edición
    const editModalElement = document.getElementById('editModal');
    const editModal = new bootstrap.Modal(editModalElement);
    const editModalLabel = document.getElementById('editModalLabel');
    const editEmojiInput = document.getElementById('editEmojiInput');
    const editNameInput = document.getElementById('editNameInput');
    const saveEditBtn = document.getElementById('saveEditBtn');
    
    const syncOverlay = document.getElementById('syncOverlay');

    // Elementos DOM - Reportes
    const reportFilter = document.getElementById('reportFilter');
    const reportTotal = document.getElementById('reportTotal');
    const reportByMember = document.getElementById('reportByMember');
    const reportByMotive = document.getElementById('reportByMotive');

    // Estado local de la aplicación
    let selectedMember = null;
    let familyMembers = [];
    let quickMotives = [];
    let editingType = null; // 'member' o 'motive'
    let editingId = null;
    let allExpenses = []; // Almacena todos los gastos para los reportes

    // Inicializar Configuración (Desde localStorage o predeterminados)
    function initConfig() {
        const storedMembers = localStorage.getItem('gastosHormigaMembers');
        if (storedMembers) {
            // Si ya hay guardados, los usamos
            familyMembers = JSON.parse(storedMembers);
        } else {
            // Predeterminados si es la primera vez que se abre la app
            familyMembers = [
                { id: 1, name: 'Papá', emoji: '👨🏻', color: 'primary' },
                { id: 2, name: 'Mamá', emoji: '👩🏻', color: 'danger' },
                { id: 3, name: 'Hijo', emoji: '👦🏽', color: 'success' }
            ];
        }

        const storedMotives = localStorage.getItem('gastosHormigaMotives');
        if (storedMotives) {
            quickMotives = JSON.parse(storedMotives);
        } else {
            quickMotives = [
                { id: 1, name: 'Café', emoji: '☕' },
                { id: 2, name: 'Kiosco', emoji: '🍫' },
                { id: 3, name: 'Viaje', emoji: '🚕' },
                { id: 4, name: 'Propina', emoji: '💸' },
                { id: 5, name: 'Ocio', emoji: '🎮' }
            ];
        }

        // Eliminamos saveConfig() de aquí para que el navegador nuevo no sobrescriba la nube
        renderMembers();
        renderMotives();
        syncWithCloud(); // <- Llamamos a la sincronización al iniciar
    }

    // Guardar en local y enviar respaldo a Google Sheets
    function saveConfig() {
        localStorage.setItem('gastosHormigaMembers', JSON.stringify(familyMembers));
        localStorage.setItem('gastosHormigaMotives', JSON.stringify(quickMotives));
        
        // Enviar respaldo en segundo plano a Google Sheets
        const configData = {
            action: 'save_config',
            members: familyMembers,
            motives: quickMotives
        };
        
        fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Evita bloqueos de CORS en el envío en segundo plano
            redirect: 'follow', // Permite seguir las redirecciones internas de Google
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(configData)
        }).catch(err => console.log('Sincronización fallida', err));
    }

    // Sincronizar (Descargar) datos desde Google Sheets
    function syncWithCloud() {
        // Asegurarnos de que el overlay se muestre
        syncOverlay.classList.remove('d-none');

        fetch(GOOGLE_SCRIPT_URL, {
            method: 'GET',
            redirect: 'follow'
        })
            .then(response => response.json())
            .then(data => {
                // 1. Sincronizar Configuración (Familia y Motivos)
                if (data.configuracion) {
                    familyMembers = data.configuracion.members || familyMembers;
                    quickMotives = data.configuracion.motives || quickMotives;
                    localStorage.setItem('gastosHormigaMembers', JSON.stringify(familyMembers));
                    localStorage.setItem('gastosHormigaMotives', JSON.stringify(quickMotives));
                    renderMembers();
                    renderMotives();
                }

                // 2. Dibujar el Historial de Gastos
                historyGrid.innerHTML = ''; // Limpiamos el mensaje de carga
                
                if (data.gastos && data.gastos.length > 0) {
                    allExpenses = []; // Limpiamos el arreglo antes de llenarlo

                    data.gastos.forEach(gasto => {
                        // Buscar el color del integrante, por defecto 'secondary'
                        const member = familyMembers.find(m => m.name === gasto.integrante);
                        const color = member ? member.color : 'secondary';

                        // Arreglar fechas y horas si vienen en formato crudo (ISO) desde Google Sheets
                        let displayFecha = gasto.fecha;
                        let displayHora = gasto.hora;
                        
                        if (displayFecha && displayFecha.toString().includes('T')) {
                            const d = new Date(displayFecha);
                            displayFecha = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                            gasto.parsedDate = d;
                        } else if (displayFecha) {
                            // Si viene como string 'dd/mm/yyyy', la convertimos para poder filtrarla
                            const parts = displayFecha.split('/');
                            if (parts.length === 3) {
                                gasto.parsedDate = new Date(parts[2], parts[1] - 1, parts[0]);
                            }
                        }

                        if (displayHora && displayHora.toString().includes('T')) {
                            displayHora = new Date(displayHora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
                        }

                        gasto.montoNum = parseFloat(gasto.monto) || 0;
                        allExpenses.push(gasto);

                        const newExpense = document.createElement('div');
                        newExpense.className = 'd-flex align-items-center bg-white p-3 rounded-4 shadow-sm mb-3 fade-in';
                        newExpense.innerHTML = `
                            <div class="rounded-circle bg-${color} bg-opacity-10 d-flex flex-shrink-0 align-items-center justify-content-center fs-3 me-3" style="width: 50px; height: 50px;">
                                ${gasto.emoji}
                            </div>
                            <div class="flex-grow-1">
                                <h4 class="h6 fw-bold mb-0 text-dark">${gasto.motivo}</h4>
                                <p class="small text-muted mb-0">${displayFecha}, ${displayHora} hs</p>
                            </div>
                            <div class="fs-5 fw-bold text-danger">
                                -$${gasto.monto}
                            </div>
                        `;
                        historyGrid.appendChild(newExpense);
                    });
                } else {
                    historyGrid.innerHTML = '<p class="text-center text-muted small py-4">No hay gastos registrados aún.</p>';
                }

                // Ocultar el overlay de sincronización al terminar con éxito
                syncOverlay.classList.add('d-none');
            })
            .catch(error => {
                console.error('Error sincronizando:', error);
                // Ocultar el overlay de todas formas si falla el internet, para no dejar la app bloqueada
                syncOverlay.classList.add('d-none');
            });
    }

    // Función maestra: Dibuja los integrantes en la pantalla principal y en la configuración
    function renderMembers() {
        memberSelection.innerHTML = '';
        configMembersList.innerHTML = '';

        if (familyMembers.length === 0) {
            memberSelection.innerHTML = '<p class="small text-muted mb-0">No hay integrantes. Agrégalos en ⚙️.</p>';
        }

        familyMembers.forEach((member, index) => {
            // -- 1. Renderizar en la pantalla PRINCIPAL --
            const btn = document.createElement('button');
            btn.type = 'button';
            
            // Marcar el primero como seleccionado por defecto
            const isActive = index === 0;
            if (isActive) selectedMember = member;

            const activeBtnClass = isActive ? 'btn-outline-primary active' : 'btn-outline-secondary';
            const fwClass = isActive ? 'fw-bold' : '';

            btn.className = `btn ${activeBtnClass} d-flex flex-column align-items-center p-2 rounded-3 member-btn`;
            btn.style.minWidth = '70px';
            btn.innerHTML = `
                <span class="fs-3">${member.emoji}</span>
                <span class="small ${fwClass} mt-1">${member.name}</span>
            `;

            // Al hacer clic, se selecciona
            btn.addEventListener('click', () => selectMember(btn, member));
            memberSelection.appendChild(btn);

            // -- 2. Renderizar en la pantalla de CONFIGURACIÓN --
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center px-0';
            li.innerHTML = `<div><span class="fs-4 me-2">${member.emoji}</span> <span class="fw-bold text-dark">${member.name}</span></div>`;
            
            const btnContainer = document.createElement('div');

            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-sm text-primary border-0 me-2';
            editBtn.innerHTML = '<i class="bi bi-pencil fs-5"></i>';
            editBtn.addEventListener('click', () => editMember(member.id));

            const delBtn = document.createElement('button');
            delBtn.className = 'btn btn-sm text-danger border-0';
            delBtn.innerHTML = '<i class="bi bi-trash fs-5"></i>';
            delBtn.addEventListener('click', () => deleteMember(member.id));
            
            btnContainer.appendChild(editBtn);
            btnContainer.appendChild(delBtn);
            li.appendChild(btnContainer);
            configMembersList.appendChild(li);
        });
    }

    // Seleccionar visualmente un integrante en la pantalla principal
    function selectMember(clickedBtn, member) {
        document.querySelectorAll('.member-btn').forEach(btn => {
            btn.classList.remove('btn-outline-primary', 'active');
            btn.classList.add('btn-outline-secondary');
            btn.querySelector('span:nth-child(2)').classList.remove('fw-bold');
        });
        
        clickedBtn.classList.remove('btn-outline-secondary');
        clickedBtn.classList.add('btn-outline-primary', 'active');
        clickedBtn.querySelector('span:nth-child(2)').classList.add('fw-bold');

        selectedMember = member;
    }

    // Agregar nuevo integrante
    addMemberBtn.addEventListener('click', () => {
        const emoji = newEmojiInput.value.trim();
        const name = newNameInput.value.trim();

        if (!emoji || !name) {
            alert('Por favor ingresa un emoji y un nombre.');
            return;
        }

        // Asignamos un color aleatorio de Bootstrap para darle estilo
        const colores = ['primary', 'danger', 'success', 'warning', 'info', 'secondary', 'dark'];
        const randomColor = colores[Math.floor(Math.random() * colores.length)];

        familyMembers.push({
            id: Date.now(), // ID único basado en el tiempo actual
            name: name,
            emoji: emoji,
            color: randomColor
        });

        saveConfig();
        renderMembers(); // Redibujar todo

        // Limpiar inputs
        newEmojiInput.value = '';
        newNameInput.value = '';
    });

    // Editar integrante
    function editMember(id) {
        const member = familyMembers.find(m => m.id === id);
        if (!member) return;

        editingType = 'member';
        editingId = id;

        editModalLabel.innerText = 'Editar Integrante';
        editEmojiInput.value = member.emoji;
        editNameInput.value = member.name;

        editModal.show();
    }

    // Eliminar integrante
    function deleteMember(id) {
        if(confirm('¿Seguro que quieres eliminar este integrante?')) {
            familyMembers = familyMembers.filter(m => m.id !== id);
            saveConfig();
            renderMembers();
        }
    }

    // --- LÓGICA DE MOTIVOS RÁPIDOS ---
    function renderMotives() {
        quickMotivesContainer.innerHTML = '';
        configMotivesList.innerHTML = '';

        quickMotives.forEach(motive => {
            // 1. Renderizar en la pantalla PRINCIPAL
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-sm btn-outline-secondary rounded-pill quick-motive-btn';
            btn.innerText = `${motive.emoji} ${motive.name}`;
            btn.addEventListener('click', () => {
                motivoInput.value = btn.innerText;
            });
            quickMotivesContainer.appendChild(btn);

            // 2. Renderizar en CONFIGURACIÓN
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center px-0';
            li.innerHTML = `<div><span class="fs-5 me-2">${motive.emoji}</span> <span class="fw-bold text-dark">${motive.name}</span></div>`;
            
            const btnContainer = document.createElement('div');

            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-sm text-primary border-0 me-2';
            editBtn.innerHTML = '<i class="bi bi-pencil fs-5"></i>';
            editBtn.addEventListener('click', () => editMotive(motive.id));

            const delBtn = document.createElement('button');
            delBtn.className = 'btn btn-sm text-danger border-0';
            delBtn.innerHTML = '<i class="bi bi-trash fs-5"></i>';
            delBtn.addEventListener('click', () => deleteMotive(motive.id));
            
            btnContainer.appendChild(editBtn);
            btnContainer.appendChild(delBtn);
            li.appendChild(btnContainer);
            configMotivesList.appendChild(li);
        });
    }

    addMotiveBtn.addEventListener('click', () => {
        const emoji = newMotiveEmojiInput.value.trim();
        const name = newMotiveNameInput.value.trim();

        if (!emoji || !name) {
            alert('Por favor ingresa un emoji y un nombre para el motivo.');
            return;
        }

        quickMotives.push({ id: Date.now(), name: name, emoji: emoji });
        saveConfig();
        renderMotives();
        newMotiveEmojiInput.value = '';
        newMotiveNameInput.value = '';
    });

    function editMotive(id) {
        const motive = quickMotives.find(m => m.id === id);
        if (!motive) return;

        editingType = 'motive';
        editingId = id;

        editModalLabel.innerText = 'Editar Motivo';
        editEmojiInput.value = motive.emoji;
        editNameInput.value = motive.name;

        editModal.show();
    }

    function deleteMotive(id) {
        if(confirm('¿Seguro que quieres eliminar este motivo?')) {
            quickMotives = quickMotives.filter(m => m.id !== id);
            saveConfig();
            renderMotives();
        }
    }

    // Guardar cambios desde el modal
    saveEditBtn.addEventListener('click', () => {
        const newEmoji = editEmojiInput.value.trim();
        const newName = editNameInput.value.trim();

        if (!newEmoji || !newName) {
            alert('El emoji y el nombre no pueden estar vacíos.');
            return;
        }

        if (editingType === 'member') {
            const member = familyMembers.find(m => m.id === editingId);
            if (member) {
                member.emoji = newEmoji;
                member.name = newName;
                saveConfig();
                renderMembers();
            }
        } else if (editingType === 'motive') {
            const motive = quickMotives.find(m => m.id === editingId);
            if (motive) {
                motive.emoji = newEmoji;
                motive.name = newName;
                saveConfig();
                renderMotives();
            }
        }

        editModal.hide();
    });

    // -----------------------------------------------------
    // Lógica ya existente que trajimos desde el HTML
    // -----------------------------------------------------

    // Navegación de Vistas
    function switchView(viewName) {
        mainView.classList.add('d-none');
        configView.classList.add('d-none');
        reportView.classList.add('d-none');
        
        configIcon.className = 'bi bi-gear-fill';
        reportIcon.className = 'bi bi-bar-chart-fill';

        if (viewName === 'main') {
            mainView.classList.remove('d-none');
            headerTitle.innerText = '🐜 Gastos Hormiga';
        } else if (viewName === 'config') {
            configView.classList.remove('d-none');
            configIcon.className = 'bi bi-x-lg';
            headerTitle.innerText = '⚙️ Configuración';
        } else if (viewName === 'report') {
            reportView.classList.remove('d-none');
            reportIcon.className = 'bi bi-x-lg';
            headerTitle.innerText = '📊 Reportes';
            generateReport(); // Calcular reportes al entrar a la pantalla
        }
    }

    configToggleBtn.addEventListener('click', () => {
        switchView(configView.classList.contains('d-none') ? 'config' : 'main');
    });

    reportToggleBtn.addEventListener('click', () => {
        switchView(reportView.classList.contains('d-none') ? 'report' : 'main');
    });

    // Generación de Reportes
    reportFilter.addEventListener('change', generateReport);

    function generateReport() {
        const filter = reportFilter.value;
        const today = new Date();

        // 1. Filtrar los gastos según la fecha seleccionada
        const filteredExpenses = allExpenses.filter(gasto => {
            const d = gasto.parsedDate;
            if (!d) return true; // Si por alguna razón no tiene fecha, lo mostramos
            
            if (filter === 'today') {
                return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
            } else if (filter === 'week') {
                const day = today.getDay();
                const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Obtener el lunes de esta semana
                const firstDayOfWeek = new Date(today.getFullYear(), today.getMonth(), diff);
                firstDayOfWeek.setHours(0, 0, 0, 0);
                return d >= firstDayOfWeek;
            } else if (filter === 'month') {
                return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
            }
            return true; // 'all'
        });

        let total = 0;
        const byMember = {};
        const byMotive = {};

        // 2. Agrupar montos
        filteredExpenses.forEach(gasto => {
            total += gasto.montoNum;
            
            // Por integrante
            if (!byMember[gasto.integrante]) {
                const memberInfo = familyMembers.find(m => m.name === gasto.integrante) || { color: 'secondary', emoji: gasto.emoji || '👤' };
                byMember[gasto.integrante] = { monto: 0, color: memberInfo.color, emoji: memberInfo.emoji };
            }
            byMember[gasto.integrante].monto += gasto.montoNum;

            // Por motivo
            if (!byMotive[gasto.motivo]) {
                byMotive[gasto.motivo] = { monto: 0, emoji: gasto.emoji || '📝' };
            }
            byMotive[gasto.motivo].monto += gasto.montoNum;
        });

        // 3. Renderizar resultados
        reportTotal.innerText = `-$${total.toLocaleString('es-AR')}`;

        reportByMember.innerHTML = '';
        Object.keys(byMember).sort((a, b) => byMember[b].monto - byMember[a].monto).forEach(name => {
            const data = byMember[name];
            const percent = total > 0 ? (data.monto / total) * 100 : 0;
            reportByMember.innerHTML += `
                <div>
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="small fw-bold">${data.emoji} ${name}</span>
                        <span class="small fw-bold text-dark">$${data.monto.toLocaleString('es-AR')}</span>
                    </div>
                    <div class="progress bg-light" style="height: 10px;">
                        <div class="progress-bar bg-${data.color} rounded-pill" role="progressbar" style="width: ${percent}%"></div>
                    </div>
                </div>
            `;
        });
        if (Object.keys(byMember).length === 0) reportByMember.innerHTML = '<p class="text-muted small text-center">No hay datos</p>';

        reportByMotive.innerHTML = '';
        Object.keys(byMotive).sort((a, b) => byMotive[b].monto - byMotive[a].monto).forEach(name => {
            const data = byMotive[name];
            const percent = total > 0 ? (data.monto / total) * 100 : 0;
            // Quitamos el emoji de la palabra si ya viene incluido, para que no se vea duplicado
            const cleanName = name.replace(/^[^\w\s]+/u, '').trim(); 
            reportByMotive.innerHTML += `
                <div>
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="small text-muted">${data.emoji} ${cleanName}</span>
                        <span class="small fw-bold text-dark">$${data.monto.toLocaleString('es-AR')}</span>
                    </div>
                    <div class="progress bg-light" style="height: 10px;">
                        <div class="progress-bar bg-secondary opacity-50 rounded-pill" role="progressbar" style="width: ${percent}%"></div>
                    </div>
                </div>
            `;
        });
        if (Object.keys(byMotive).length === 0) reportByMotive.innerHTML = '<p class="text-muted small text-center">No hay datos</p>';
    }

    // Guardar Gasto
    expenseForm.addEventListener('submit', function(e) {
        e.preventDefault(); // Evita que la página se recargue
        
        if (!selectedMember) {
            alert('Por favor, selecciona un integrante.');
            return;
        }

        const motivo = motivoInput.value.trim();
        const monto = montoInput.value.trim();

        if (!motivo || !monto) {
            alert('Por favor, completa el motivo y el monto.');
            return;
        }

        // Cambiar estado del botón a "Cargando"
        const submitBtn = expenseForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Guardando...';
        submitBtn.disabled = true;

        // Preparar los datos
        const gastoData = {
            integrante: selectedMember.name,
            emoji: selectedMember.emoji,
            motivo: motivo,
            monto: monto
        };

        // Enviar a la nube
        fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Fundamental para evitar bloqueos de Google al hacer POST
            redirect: 'follow', // Permite que la petición termine su ciclo
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
            body: JSON.stringify(gastoData)
        })
        .then(() => {
            // Al usar no-cors la respuesta es opaca. Asumimos éxito si no hay error de red.
            agregarGastoVisualmente(motivo, monto);
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Hubo un problema guardando en la nube. Revisa tu conexión.');
        })
        .finally(() => {
            // Restaurar botón
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
        });
    });

    // Función separada para agregar la tarjeta a la lista y limpiar el formulario
    function agregarGastoVisualmente(motivo, monto) {
        const now = new Date();
        const timeString = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const dateText = `Hoy, ${timeString} hs`;

        const newExpense = document.createElement('div');
        newExpense.className = 'd-flex align-items-center bg-white p-3 rounded-4 shadow-sm mb-3 fade-in';
        newExpense.innerHTML = `
            <div class="rounded-circle bg-${selectedMember.color} bg-opacity-10 d-flex flex-shrink-0 align-items-center justify-content-center fs-3 me-3" style="width: 50px; height: 50px;">
                ${selectedMember.emoji}
            </div>
            <div class="flex-grow-1">
                <h4 class="h6 fw-bold mb-0 text-dark">${motivo}</h4>
                <p class="small text-muted mb-0">${dateText}</p>
            </div>
            <div class="fs-5 fw-bold text-danger">
                -$${monto}
            </div>
        `;

        // Quitar el mensaje de "No hay gastos registrados aún" si existe
        const emptyMsg = historyGrid.querySelector('p.text-center');
        if(emptyMsg) emptyMsg.remove();

        historyGrid.prepend(newExpense);

        motivoInput.value = '';
        montoInput.value = '';

        // Agregar el nuevo gasto a nuestro arreglo global para que los reportes se actualicen sin recargar
        allExpenses.unshift({
            fecha: dateText,
            hora: timeString,
            integrante: selectedMember.name,
            emoji: selectedMember.emoji,
            motivo: motivo,
            monto: monto,
            parsedDate: new Date(),
            montoNum: parseFloat(monto) || 0
        });
    }

    // -----------------------------------------------------
    // ARRANQUE DE LA APLICACIÓN
    // -----------------------------------------------------
    initConfig();
});