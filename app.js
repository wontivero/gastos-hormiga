import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, onValue, set, push, update, remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBK7eFOAHz-6pv_6nO17wuqdKCqHcpIzmg",
  authDomain: "gastos-hormiga-674f9.firebaseapp.com",
  databaseURL: "https://gastos-hormiga-674f9-default-rtdb.firebaseio.com",
  projectId: "gastos-hormiga-674f9",
  storageBucket: "gastos-hormiga-674f9.firebasestorage.app",
  messagingSenderId: "738300409403",
  appId: "1:738300409403:web:ef2fe75ba7ec44a5d38e1e"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos DOM ---
    const expenseForm = document.getElementById('expenseForm');
    const motivoInput = document.getElementById('motivoInput');
    const montoInput = document.getElementById('montoInput');
    const historyGrid = document.getElementById('historyGrid');
    const quickMotivesContainer = document.getElementById('quickMotivesContainer');
    
    // Navegación
    const configToggleBtn = document.getElementById('configToggleBtn');
    const configIcon = document.getElementById('configIcon');
    const headerTitle = document.getElementById('headerTitle');
    const mainView = document.getElementById('mainView');
    const configView = document.getElementById('configView');
    const reportToggleBtn = document.getElementById('reportToggleBtn');
    const reportIcon = document.getElementById('reportIcon');
    const reportView = document.getElementById('reportView');
    
    // Integrantes y Motivos (Configuración)
    const memberSelection = document.getElementById('memberSelection');
    const configMembersList = document.getElementById('configMembersList');
    const newEmojiInput = document.getElementById('newEmojiInput');
    const newNameInput = document.getElementById('newNameInput');
    const addMemberBtn = document.getElementById('addMemberBtn');

    const configMotivesList = document.getElementById('configMotivesList');
    const newMotiveEmojiInput = document.getElementById('newMotiveEmojiInput');
    const newMotiveNameInput = document.getElementById('newMotiveNameInput');
    const addMotiveBtn = document.getElementById('addMotiveBtn');

    // Modales
    const editModalElement = document.getElementById('editModal');
    const editModal = new bootstrap.Modal(editModalElement);
    const editModalLabel = document.getElementById('editModalLabel');
    const editEmojiInput = document.getElementById('editEmojiInput');
    const editNameInput = document.getElementById('editNameInput');
    const saveEditBtn = document.getElementById('saveEditBtn');

    const editExpenseModalElement = document.getElementById('editExpenseModal');
    const editExpenseModal = new bootstrap.Modal(editExpenseModalElement);
    const editExpenseForm = document.getElementById('editExpenseForm');
    const editExpenseMemberSelect = document.getElementById('editExpenseMemberSelect');
    const editExpenseMotivoInput = document.getElementById('editExpenseMotivoInput');
    const editExpenseMontoInput = document.getElementById('editExpenseMontoInput');
    const editExpenseDateInput = document.getElementById('editExpenseDateInput');

    const syncOverlay = document.getElementById('syncOverlay');

    // Filtros de Historial
    const historyFilterContainer = document.getElementById('historyFilterContainer');
    const historyFilterTotal = document.getElementById('historyFilterTotal');
    const customDateRangeBox = document.getElementById('customDateRangeBox');
    const historyDateFrom = document.getElementById('historyDateFrom');
    const historyDateTo = document.getElementById('historyDateTo');

    // Reportes
    const reportFilter = document.getElementById('reportFilter');
    const reportCustomDateRangeBox = document.getElementById('reportCustomDateRangeBox');
    const reportDateFrom = document.getElementById('reportDateFrom');
    const reportDateTo = document.getElementById('reportDateTo');
    const reportTotal = document.getElementById('reportTotal');
    const reportByMember = document.getElementById('reportByMember');
    const reportByMotive = document.getElementById('reportByMotive');

    // --- Estado de la Aplicación ---
    let selectedMember = null;
    let familyMembers = [];
    let quickMotives = [];
    let editingType = null; // 'member' o 'motive'
    let editingId = null;
    
    let editingExpenseKey = null;
    let rawExpenses = []; // Todos los gastos recibidos con su key
    let activeHistoryFilter = 'today';

    // --- Inicialización ---
    function initConfig() {
        const storedMembers = localStorage.getItem('gastosHormigaMembers');
        if (storedMembers) {
            familyMembers = JSON.parse(storedMembers);
        } else {
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

        renderMembers();
        renderMotives();
        loadCachedExpenses();
        syncWithCloud();
    }

    function saveConfig() {
        localStorage.setItem('gastosHormigaMembers', JSON.stringify(familyMembers));
        localStorage.setItem('gastosHormigaMotives', JSON.stringify(quickMotives));
        
        set(ref(db, 'configuracion'), {
            members: familyMembers,
            motives: quickMotives
        }).catch(err => console.error('Error guardando configuración en Firebase:', err));
    }

    function loadCachedExpenses() {
        const cached = localStorage.getItem('gastosHormigaExpenses');
        if (cached) {
            try {
                rawExpenses = JSON.parse(cached);
                applyHistoryFilterAndRender();
            } catch (e) {
                console.error('Error al parsear cache local:', e);
            }
        }
    }

    // --- Sincronización Realtime ---
    function syncWithCloud() {
        syncOverlay.classList.remove('d-none');

        // Escuchar Configuración
        onValue(ref(db, 'configuracion'), (snapshot) => {
            const data = snapshot.val();
            if (data) {
                familyMembers = data.members || familyMembers;
                quickMotives = data.motives || quickMotives;
                localStorage.setItem('gastosHormigaMembers', JSON.stringify(familyMembers));
                localStorage.setItem('gastosHormigaMotives', JSON.stringify(quickMotives));
                renderMembers();
                renderMotives();
            }
        });

        // Escuchar Gastos con preservación de Keys de Firebase
        onValue(ref(db, 'gastos'), (snapshot) => {
            syncOverlay.classList.add('d-none');
            const data = snapshot.val();

            if (data) {
                // Convertir objeto de Firebase a Array conservando la Key
                rawExpenses = Object.entries(data).map(([key, value]) => ({
                    ...value,
                    key: key
                })).reverse(); // Los más recientes primero

                localStorage.setItem('gastosHormigaExpenses', JSON.stringify(rawExpenses));
                applyHistoryFilterAndRender();
                if (!reportView.classList.contains('d-none')) {
                    generateReport();
                }
            } else {
                rawExpenses = [];
                localStorage.setItem('gastosHormigaExpenses', JSON.stringify([]));
                applyHistoryFilterAndRender();
                if (!reportView.classList.contains('d-none')) {
                    generateReport();
                }
            }
        }, (error) => {
            console.error('Error en conexión Firebase:', error);
            syncOverlay.classList.add('d-none');
        });
    }

    // --- Filtros de Fecha Avanzados ---
    function filterExpensesByDate(expenses, filterType, customFromVal, customToVal) {
        const today = new Date();

        return expenses.filter(gasto => {
            let d = null;
            if (gasto.fecha) {
                if (gasto.fecha.includes('T')) {
                    d = new Date(gasto.fecha);
                } else {
                    const parts = gasto.fecha.split('/');
                    if (parts.length === 3) {
                        d = new Date(parts[2], parts[1] - 1, parts[0]);
                    }
                }
            }
            if (!d || isNaN(d.getTime())) return true; // Si no hay fecha válida, se incluye

            gasto.parsedDateObj = d;

            if (filterType === 'today') {
                return d.getDate() === today.getDate() &&
                       d.getMonth() === today.getMonth() &&
                       d.getFullYear() === today.getFullYear();
            }
            
            if (filterType === 'week') {
                const currentDay = today.getDay();
                const diffToMonday = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
                const monday = new Date(today.getFullYear(), today.getMonth(), diffToMonday);
                monday.setHours(0, 0, 0, 0);
                return d >= monday;
            }

            if (filterType === 'month') {
                return d.getMonth() === today.getMonth() &&
                       d.getFullYear() === today.getFullYear();
            }

            if (filterType === 'last_month') {
                const lastMonthYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
                const lastMonth = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
                return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
            }

            if (filterType === 'custom') {
                if (!customFromVal && !customToVal) return true;
                const fromDate = customFromVal ? new Date(customFromVal + 'T00:00:00') : new Date(0);
                const toDate = customToVal ? new Date(customToVal + 'T23:59:59') : new Date();
                return d >= fromDate && d <= toDate;
            }

            return true; // 'all'
        });
    }

    // Aplicar filtro al Historial y Renderizar
    function applyHistoryFilterAndRender() {
        const filtered = filterExpensesByDate(
            rawExpenses,
            activeHistoryFilter,
            historyDateFrom.value,
            historyDateTo.value
        );

        renderExpensesList(filtered);
    }

    // --- Renderizado del Historial con Acciones (Editar/Borrar) ---
    function renderExpensesList(gastosArray) {
        historyGrid.innerHTML = '';
        let currentFilterTotal = 0;

        if (gastosArray && gastosArray.length > 0) {
            gastosArray.forEach(gasto => {
                const montoNum = parseFloat(gasto.monto) || 0;
                currentFilterTotal += montoNum;

                const member = familyMembers.find(m => m.name === gasto.integrante);
                const color = member ? member.color : 'secondary';

                // Formatear Fecha y Hora amigablemente
                let fechaTexto = gasto.fecha || '';
                let horaTexto = gasto.hora || '';
                
                if (gasto.parsedDateObj || (gasto.fecha && gasto.fecha.includes('T'))) {
                    const d = gasto.parsedDateObj || new Date(gasto.fecha);
                    const hoy = new Date();
                    const esHoy = d.getDate() === hoy.getDate() && d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear();
                    
                    if (esHoy) {
                        fechaTexto = 'Hoy';
                    } else {
                        fechaTexto = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                    }
                    
                    if (gasto.hora && gasto.hora.includes('T')) {
                        horaTexto = new Date(gasto.hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
                    }
                }

                const card = document.createElement('div');
                card.className = 'expense-card d-flex align-items-center justify-content-between fade-in';
                card.innerHTML = `
                    <div class="d-flex align-items-center flex-grow-1 me-2 overflow-hidden">
                        <div class="rounded-circle bg-${color} bg-opacity-10 text-${color} d-flex flex-shrink-0 align-items-center justify-content-center fs-3 me-3" style="width: 48px; height: 48px;">
                            ${gasto.emoji || '💸'}
                        </div>
                        <div class="text-truncate">
                            <div class="d-flex align-items-center gap-2">
                                <h4 class="h6 fw-bold mb-0 text-dark text-truncate">${gasto.motivo}</h4>
                                <span class="badge bg-light text-secondary border small" style="font-size: 0.7rem;">${gasto.integrante}</span>
                            </div>
                            <p class="x-small text-muted mb-0 mt-1" style="font-size: 0.75rem;">${fechaTexto}${horaTexto ? `, ${horaTexto} hs` : ''}</p>
                        </div>
                    </div>

                    <div class="d-flex align-items-center gap-2 flex-shrink-0">
                        <div class="fw-bold text-danger fs-6 me-1">
                            -$${montoNum.toLocaleString('es-AR')}
                        </div>
                        <div class="expense-actions d-flex gap-1">
                            <button class="btn btn-sm btn-light text-primary edit-exp-btn" title="Editar gasto">
                                <i class="bi bi-pencil-fill"></i>
                            </button>
                            <button class="btn btn-sm btn-light text-danger del-exp-btn" title="Eliminar gasto">
                                <i class="bi bi-trash-fill"></i>
                            </button>
                        </div>
                    </div>
                `;

                // Event Listeners para Editar y Eliminar
                const editBtn = card.querySelector('.edit-exp-btn');
                const delBtn = card.querySelector('.del-exp-btn');

                editBtn.addEventListener('click', () => openEditExpenseModal(gasto));
                delBtn.addEventListener('click', () => deleteExpense(gasto.key));

                historyGrid.appendChild(card);
            });
        } else {
            historyGrid.innerHTML = `
                <div class="text-center text-muted py-5 card-custom">
                    <p class="fs-2 mb-1">🐜</p>
                    <p class="small mb-0 fw-semibold">No hay gastos registrados en este período.</p>
                </div>
            `;
        }

        historyFilterTotal.innerText = `-$${currentFilterTotal.toLocaleString('es-AR')}`;
    }

    // --- Manejo de Eventos de Filtros ---
    historyFilterContainer.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            historyFilterContainer.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');

            activeHistoryFilter = chip.dataset.filter;
            if (activeHistoryFilter === 'custom') {
                customDateRangeBox.classList.remove('d-none');
            } else {
                customDateRangeBox.classList.add('d-none');
            }
            applyHistoryFilterAndRender();
        });
    });

    historyDateFrom.addEventListener('change', applyHistoryFilterAndRender);
    historyDateTo.addEventListener('change', applyHistoryFilterAndRender);

    // --- Lógica para Editar y Eliminar Gastos en Firebase ---
    function openEditExpenseModal(gasto) {
        editingExpenseKey = gasto.key;

        // Cargar integrantes en el selector del modal
        editExpenseMemberSelect.innerHTML = '';
        familyMembers.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.name;
            opt.textContent = `${m.emoji} ${m.name}`;
            if (m.name === gasto.integrante) opt.selected = true;
            editExpenseMemberSelect.appendChild(opt);
        });

        editExpenseMotivoInput.value = gasto.motivo;
        editExpenseMontoInput.value = gasto.monto;

        // Formatear datetime-local
        if (gasto.fecha && gasto.fecha.includes('T')) {
            const d = new Date(gasto.fecha);
            const isoLocal = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
            editExpenseDateInput.value = isoLocal;
        } else {
            editExpenseDateInput.value = '';
        }

        editExpenseModal.show();
    }

    editExpenseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!editingExpenseKey) return;

        const selectedMemberName = editExpenseMemberSelect.value;
        const memberInfo = familyMembers.find(m => m.name === selectedMemberName) || { emoji: '👤' };

        const newMotivo = editExpenseMotivoInput.value.trim();
        const newMonto = editExpenseMontoInput.value.trim();
        const dateVal = editExpenseDateInput.value;

        const newIsoDate = dateVal ? new Date(dateVal).toISOString() : new Date().toISOString();

        const updatedData = {
            integrante: selectedMemberName,
            emoji: memberInfo.emoji,
            motivo: newMotivo,
            monto: newMonto,
            fecha: newIsoDate,
            hora: newIsoDate
        };

        update(ref(db, `gastos/${editingExpenseKey}`), updatedData)
            .then(() => {
                editExpenseModal.hide();
                editingExpenseKey = null;
            })
            .catch(err => alert('Error al actualizar el gasto: ' + err.message));
    });

    function deleteExpense(key) {
        if (confirm('¿Estás seguro de borrar este gasto?')) {
            remove(ref(db, `gastos/${key}`))
                .catch(err => alert('Error al borrar el gasto: ' + err.message));
        }
    }

    // --- Renderizado de Integrantes y Motivos Rápidos ---
    function renderMembers() {
        memberSelection.innerHTML = '';
        configMembersList.innerHTML = '';

        familyMembers.forEach((member, index) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            const isActive = index === 0;
            if (isActive) selectedMember = member;

            btn.className = `btn member-btn d-flex flex-column align-items-center p-2 ${isActive ? 'active' : ''}`;
            btn.style.minWidth = '72px';
            btn.innerHTML = `
                <span class="fs-3 mb-1">${member.emoji}</span>
                <span class="small fw-semibold text-dark">${member.name}</span>
            `;

            btn.addEventListener('click', () => selectMember(btn, member));
            memberSelection.appendChild(btn);

            // Lista Configuración
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center px-0 bg-transparent';
            li.innerHTML = `<div><span class="fs-4 me-2">${member.emoji}</span> <span class="fw-bold text-dark">${member.name}</span></div>`;
            
            const btnContainer = document.createElement('div');
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-sm text-primary border-0 me-1';
            editBtn.innerHTML = '<i class="bi bi-pencil-square fs-5"></i>';
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

    function selectMember(clickedBtn, member) {
        document.querySelectorAll('.member-btn').forEach(btn => btn.classList.remove('active'));
        clickedBtn.classList.add('active');
        selectedMember = member;
    }

    addMemberBtn.addEventListener('click', () => {
        const emoji = newEmojiInput.value.trim();
        const name = newNameInput.value.trim();

        if (!emoji || !name) {
            alert('Ingresá un emoji y un nombre.');
            return;
        }

        const colores = ['primary', 'danger', 'success', 'warning', 'info', 'secondary', 'dark'];
        const randomColor = colores[Math.floor(Math.random() * colores.length)];

        familyMembers.push({
            id: Date.now(),
            name: name,
            emoji: emoji,
            color: randomColor
        });

        saveConfig();
        renderMembers();

        newEmojiInput.value = '';
        newNameInput.value = '';
    });

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

    function deleteMember(id) {
        if(confirm('¿Eliminar este integrante?')) {
            familyMembers = familyMembers.filter(m => m.id !== id);
            saveConfig();
            renderMembers();
        }
    }

    function renderMotives() {
        quickMotivesContainer.innerHTML = '';
        configMotivesList.innerHTML = '';

        quickMotives.forEach(motive => {
            // Principal
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-sm btn-light border rounded-pill fw-semibold px-3 text-secondary';
            btn.innerText = `${motive.emoji} ${motive.name}`;
            btn.addEventListener('click', () => {
                motivoInput.value = motive.name;
            });
            quickMotivesContainer.appendChild(btn);

            // Configuración
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center px-0 bg-transparent';
            li.innerHTML = `<div><span class="fs-5 me-2">${motive.emoji}</span> <span class="fw-bold text-dark">${motive.name}</span></div>`;
            
            const btnContainer = document.createElement('div');
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-sm text-primary border-0 me-1';
            editBtn.innerHTML = '<i class="bi bi-pencil-square fs-5"></i>';
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
            alert('Ingresá un emoji y nombre para el motivo.');
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
        if(confirm('¿Eliminar este motivo?')) {
            quickMotives = quickMotives.filter(m => m.id !== id);
            saveConfig();
            renderMotives();
        }
    }

    saveEditBtn.addEventListener('click', () => {
        const newEmoji = editEmojiInput.value.trim();
        const newName = editNameInput.value.trim();

        if (!newEmoji || !newName) return;

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

    // --- Navegación entre Pantallas ---
    function switchView(viewName) {
        mainView.classList.add('d-none');
        configView.classList.add('d-none');
        reportView.classList.add('d-none');
        
        configIcon.className = 'bi bi-gear-fill';
        reportIcon.className = 'bi bi-bar-chart-fill';

        if (viewName === 'main') {
            mainView.classList.remove('d-none');
            headerTitle.innerHTML = '<span class="me-2">🐜</span> Gastos Hormiga';
        } else if (viewName === 'config') {
            configView.classList.remove('d-none');
            configIcon.className = 'bi bi-x-lg';
            headerTitle.innerHTML = '<span class="me-2">⚙️</span> Configuración';
        } else if (viewName === 'report') {
            reportView.classList.remove('d-none');
            reportIcon.className = 'bi bi-x-lg';
            headerTitle.innerHTML = '<span class="me-2">📊</span> Reportes';
            generateReport();
        }
    }

    configToggleBtn.addEventListener('click', () => switchView(configView.classList.contains('d-none') ? 'config' : 'main'));
    reportToggleBtn.addEventListener('click', () => switchView(reportView.classList.contains('d-none') ? 'report' : 'main'));

    // --- Generación de Reportes ---
    reportFilter.addEventListener('change', () => {
        if (reportFilter.value === 'custom') {
            reportCustomDateRangeBox.classList.remove('d-none');
        } else {
            reportCustomDateRangeBox.classList.add('d-none');
        }
        generateReport();
    });

    reportDateFrom.addEventListener('change', generateReport);
    reportDateTo.addEventListener('change', generateReport);

    function generateReport() {
        const filterVal = reportFilter.value;
        const filteredExpenses = filterExpensesByDate(rawExpenses, filterVal, reportDateFrom.value, reportDateTo.value);

        let total = 0;
        const byMember = {};
        const byMotive = {};

        filteredExpenses.forEach(gasto => {
            const montoNum = parseFloat(gasto.monto) || 0;
            total += montoNum;

            // Por integrante
            if (!byMember[gasto.integrante]) {
                const memberInfo = familyMembers.find(m => m.name === gasto.integrante) || { color: 'secondary', emoji: gasto.emoji || '👤' };
                byMember[gasto.integrante] = { monto: 0, color: memberInfo.color, emoji: memberInfo.emoji };
            }
            byMember[gasto.integrante].monto += montoNum;

            // Por motivo
            if (!byMotive[gasto.motivo]) {
                byMotive[gasto.motivo] = { monto: 0, emoji: gasto.emoji || '📝' };
            }
            byMotive[gasto.motivo].monto += montoNum;
        });

        reportTotal.innerText = `-$${total.toLocaleString('es-AR')}`;

        reportByMember.innerHTML = '';
        Object.keys(byMember).sort((a, b) => byMember[b].monto - byMember[a].monto).forEach(name => {
            const data = byMember[name];
            const percent = total > 0 ? (data.monto / total) * 100 : 0;
            reportByMember.innerHTML += `
                <div>
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="small fw-semibold text-dark">${data.emoji} ${name}</span>
                        <span class="small fw-bold text-dark">$${data.monto.toLocaleString('es-AR')}</span>
                    </div>
                    <div class="progress bg-light" style="height: 10px; border-radius: 20px;">
                        <div class="progress-bar bg-${data.color} rounded-pill" role="progressbar" style="width: ${percent}%"></div>
                    </div>
                </div>
            `;
        });
        if (Object.keys(byMember).length === 0) reportByMember.innerHTML = '<p class="text-muted small text-center py-2">Sin gastos en este período.</p>';

        reportByMotive.innerHTML = '';
        Object.keys(byMotive).sort((a, b) => byMotive[b].monto - byMotive[a].monto).forEach(name => {
            const data = byMotive[name];
            const percent = total > 0 ? (data.monto / total) * 100 : 0;
            const cleanName = name.replace(/^[^\w\s]+/u, '').trim(); 
            reportByMotive.innerHTML += `
                <div>
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="small text-muted">${data.emoji} ${cleanName}</span>
                        <span class="small fw-bold text-dark">$${data.monto.toLocaleString('es-AR')}</span>
                    </div>
                    <div class="progress bg-light" style="height: 10px; border-radius: 20px;">
                        <div class="progress-bar bg-primary opacity-75 rounded-pill" role="progressbar" style="width: ${percent}%"></div>
                    </div>
                </div>
            `;
        });
        if (Object.keys(byMotive).length === 0) reportByMotive.innerHTML = '<p class="text-muted small text-center py-2">Sin gastos en este período.</p>';
    }

    // --- Guardar Nuevo Gasto ---
    expenseForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (!selectedMember) {
            alert('Seleccioná un integrante.');
            return;
        }

        const motivo = motivoInput.value.trim();
        const monto = montoInput.value.trim();

        if (!motivo || !monto) {
            alert('Completá el motivo y el monto.');
            return;
        }

        const isoDate = new Date().toISOString();
        const gastoData = {
            fecha: isoDate,
            hora: isoDate,
            integrante: selectedMember.name,
            emoji: selectedMember.emoji,
            motivo: motivo,
            monto: monto
        };

        push(ref(db, 'gastos'), gastoData)
            .then(() => {
                motivoInput.value = '';
                montoInput.value = '';
            })
            .catch(error => alert('Error al guardar gasto: ' + error.message));
    });

    // Arrancar la app
    initConfig();
});