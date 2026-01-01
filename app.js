// Configuración de JSONbin.io (Persistencia Global Unitaria)
const JSONBIN_BIN_ID = '6956d92bae596e708fbec9c0';
const JSONBIN_MASTER_KEY = '$2a$10$k8PX4X2h0wusO15mj1YOVOa7aBmjdr6YKca/1ts3MQ3rLeIHNA3ku';
const JSONBIN_ACCESS_KEY = '$2a$10$mM..UNQapnjXnJQE0QfBUeoBqUXJHBk1tElUb16AY1CedHOPTR7lu';
const USER_SESSION_KEY = 'ventas_user_session';

// Estado de la aplicación
let state = {
    activeGroupId: 'default',
    groups: {
        'default': {
            id: 'default',
            name: 'Venta Principal',
            date: new Date().toLocaleDateString(),
            exchangeRate: 445,
            articles: [],
            manualTotalUsd: 0,
            manualExpensesUsd: 0
        }
    },
    theme: 'dark',
    version: '4.0'
};

// Referencias al DOM
const articleForm = document.getElementById('article-form');
const exchangeRateInput = document.getElementById('exchange-rate');
const articlesBody = document.getElementById('articles-body');
const manualTotalUsdInput = document.getElementById('manual-total-usd');
const manualExpensesUsdInput = document.getElementById('manual-expenses-usd');
const totalInvestmentUsdEl = document.getElementById('total-investment-usd');
const totalRevenueUsdEl = document.getElementById('total-revenue-usd');
const netProfitUsdEl = document.getElementById('net-profit-usd');
const netProfitCupEl = document.getElementById('net-profit-cup');
const projectedProfitUsdEl = document.getElementById('projected-profit-usd');
const projectedRevenueUsdEl = document.getElementById('projected-revenue-usd');
const clearDataBtn = document.getElementById('clear-data-btn');
const themeToggle = document.getElementById('theme-toggle');
const groupsListEl = document.getElementById('groups-list');
const newGroupBtn = document.getElementById('new-group-btn');
const currentGroupNameEl = document.getElementById('current-group-name');
const currentGroupDateEl = document.getElementById('current-group-date');
const saveDbBtn = document.getElementById('save-db-btn');
const syncIndicator = document.getElementById('sync-indicator');
const showSyncIdBtn = document.getElementById('show-sync-id');

// Inicialización de Gráficas
let salesChart;
let profitChart;

// Variables de Sesión
let currentUser = null;
let isSyncing = false;

// Referencias al DOM (Login)
const loginModal = document.getElementById('login-modal');
const loginForm = document.getElementById('login-form');
const usernameText = document.getElementById('username-text');
const logoutBtn = document.getElementById('logout-btn');

// Manejo de Sesión de Usuario (Local)
async function handleLogin(e) {
    if (e) e.preventDefault();
    const user = document.getElementById('login-user').value.trim().toLowerCase();
    const pass = document.getElementById('login-pass').value.trim();
    
    // Validación Estricta: wawita / wawita
    if (user === 'wawita' && pass === 'wawita') {
        updateSyncStatus('syncing', 'Iniciando sesión...');
        
        currentUser = user;
        localStorage.setItem(USER_SESSION_KEY, JSON.stringify({ user, pass }));
        document.body.classList.add('logged-in');
        usernameText.textContent = user;
        
        // Cargar datos de JSONbin inmediatamente
        await loadFromDatabase();
    } else {
        alert('Usuario o contraseña incorrectos.');
    }
}

function handleLogout() {
    if (confirm('¿Cerrar sesión? Los cambios locales se perderán si no están sincronizados.')) {
        localStorage.removeItem(USER_SESSION_KEY);
        location.reload();
    }
}

// Persistencia en JSONbin.io
async function saveToDatabase() {
    if (!currentUser || isSyncing) return;
    
    isSyncing = true;
    updateSyncStatus('syncing', 'Guardando en la nube...');
    
    // Guardar local como backup rápido
    localStorage.setItem('ventas_state_v2', JSON.stringify(state));
    
    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': JSONBIN_MASTER_KEY,
                'X-Access-Key': JSONBIN_ACCESS_KEY
            },
            body: JSON.stringify(state)
        });

        if (response.ok) {
            updateSyncStatus('success', 'Sincronizado');
        } else {
            throw new Error('Error en JSONbin');
        }
    } catch (e) {
        console.error("Error al guardar en nube:", e);
        updateSyncStatus('offline', 'Error de guardado');
    } finally {
        isSyncing = false;
    }
}

async function loadFromDatabase() {
    if (!currentUser) return;
    
    updateSyncStatus('syncing', 'Recuperando datos...');
    
    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
            method: 'GET',
            headers: {
                'X-Master-Key': JSONBIN_MASTER_KEY,
                'X-Access-Key': JSONBIN_ACCESS_KEY
            }
        });

        if (response.ok) {
            const result = await response.json();
            if (result && result.record) {
                state = result.record;
                localStorage.setItem('ventas_state_v2', JSON.stringify(state));
                updateUI();
                initCharts();
                updateSyncStatus('success', 'Datos actualizados');
            }
        }
    } catch (e) {
        console.warn("Usando copia local por error de red.");
        loadFromLocalStorage();
        updateUI();
    }
}

// Manejo del ID de Sincronización
if (showSyncIdBtn) {
    showSyncIdBtn.addEventListener('click', () => {
        let currentId = localStorage.getItem(SYNC_ID_KEY);
        const newId = prompt('Tu ID de sincronización actual es:\n' + currentId + '\n\nSi quieres sincronizar con otro navegador, copia este ID y pégalo aquí en el otro navegador:', currentId);
        
        if (newId && newId !== currentId) {
            if (confirm('¿Quieres cambiar tu ID al nuevo: ' + newId + '? Se cargarán los datos asociados a ese ID.')) {
                localStorage.setItem(SYNC_ID_KEY, newId);
                loadFromDatabase();
            }
        }
    });
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('ventas_state_v2');
    if (saved) {
        state = JSON.parse(saved);
        console.log("Datos cargados desde LocalStorage");
    }
}

function initCharts() {
    const isDark = state.theme === 'dark';
    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    const ctxSales = document.getElementById('salesChart').getContext('2d');
    const ctxProfit = document.getElementById('profitChart').getContext('2d');

    // Destruir si existen
    if (salesChart) salesChart.destroy();
    if (profitChart) profitChart.destroy();

    salesChart = new Chart(ctxSales, {
        type: 'pie',
        data: {
            labels: ['Vendidos', 'Stock'],
            datasets: [{
                data: [0, 0],
                backgroundColor: ['#22c55e', '#ef4444'],
                borderWidth: isDark ? 2 : 1,
                borderColor: isDark ? '#1e293b' : '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Distribución de Unidades',
                    color: textColor
                },
                legend: {
                    labels: { color: textColor }
                }
            }
        }
    });

    profitChart = new Chart(ctxProfit, {
        type: 'bar',
        data: {
            labels: ['Inversión', 'Vendido', 'Gastos', 'Ganancia Neta'],
            datasets: [{
                label: 'USD',
                data: [0, 0, 0, 0],
                backgroundColor: ['#3b82f6', '#22c55e', '#ef4444', '#8b5cf6'],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Análisis de Rentabilidad (USD)',
                    color: textColor
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: textColor }
                }
            }
        }
    });
}

// Lógica de Negocio
function updateUI() {
    const activeGroup = state.groups[state.activeGroupId];
    // Si no hay grupo activo, no hacemos nada
    if (!activeGroup) return;
    if (!activeGroup) return;

    // Actualizar Header
    currentGroupNameEl.textContent = activeGroup.name;
    currentGroupDateEl.textContent = activeGroup.date;
    exchangeRateInput.value = activeGroup.exchangeRate;

    // Limpiar tabla
    articlesBody.innerHTML = '';

    let totalInvestment = 0;
    let totalRevenue = 0;
    let totalProjectedRevenue = 0;
    let totalSoldQty = 0;
    let totalStockQty = 0;

    activeGroup.articles.forEach((article, index) => {
        const costTotalUsd = article.costUsd || 0;
        const priceUnitUsd = article.priceUsd || 0;
        const cupPrice = (priceUnitUsd * activeGroup.exchangeRate).toFixed(2);
        const costUnitUsd = costTotalUsd / article.totalQuantity;
        const profitPerUnit = priceUnitUsd - costUnitUsd;
        
        totalInvestment += costTotalUsd;
        totalRevenue += article.soldQuantity * priceUnitUsd;
        totalProjectedRevenue += article.totalQuantity * priceUnitUsd;
        
        totalSoldQty += article.soldQuantity;
        totalStockQty += (article.totalQuantity - article.soldQuantity);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${article.name}</td>
            <td>${article.totalQuantity - article.soldQuantity}</td>
            <td>
                <button class="qty-btn minus" onclick="updateSold(${index}, -1)">-</button>
                ${article.soldQuantity}
                <button class="qty-btn plus" onclick="updateSold(${index}, 1)">+</button>
            </td>
            <td>$${costTotalUsd.toFixed(2)} <small>(Total)</small></td>
            <td>$${priceUnitUsd.toFixed(2)}</td>
            <td>${cupPrice} CUP</td>
            <td style="color: ${profitPerUnit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}; font-weight: bold;">
                $${profitPerUnit.toFixed(2)}
            </td>
            <td>
                <button class="delete-btn" onclick="deleteArticle(${index})">Eliminar</button>
            </td>
        `;
        articlesBody.appendChild(row);
    });

    const netProfitUsd = totalRevenue - activeGroup.manualTotalUsd - activeGroup.manualExpensesUsd;
    const projectedProfitUsd = totalProjectedRevenue - activeGroup.manualTotalUsd - activeGroup.manualExpensesUsd;

    // Actualizar Resumen (solo si no están siendo editados)
    if (document.activeElement !== manualTotalUsdInput) {
        manualTotalUsdInput.value = activeGroup.manualTotalUsd.toFixed(2);
    }
    if (document.activeElement !== manualExpensesUsdInput) {
        manualExpensesUsdInput.value = activeGroup.manualExpensesUsd.toFixed(2);
    }
    
    totalInvestmentUsdEl.textContent = `$${totalInvestment.toFixed(2)}`;
    totalRevenueUsdEl.textContent = `$${totalRevenue.toFixed(2)}`;
    netProfitUsdEl.textContent = `$${netProfitUsd.toFixed(2)}`;
    netProfitCupEl.textContent = `${(netProfitUsd * activeGroup.exchangeRate).toLocaleString()} CUP`;
    
    projectedProfitUsdEl.textContent = `$${projectedProfitUsd.toFixed(2)}`;
    projectedRevenueUsdEl.textContent = `Ingresos totales: $${totalProjectedRevenue.toFixed(2)}`;

    // Actualizar Gráficas
    updateCharts(totalSoldQty, totalStockQty, activeGroup.manualTotalUsd, totalRevenue, activeGroup.manualExpensesUsd, netProfitUsd);
    
    // Actualizar lista de grupos
    renderGroups();
}

function renderGroups() {
    groupsListEl.innerHTML = '';
    Object.values(state.groups).forEach(group => {
        const item = document.createElement('div');
        item.className = `group-item ${state.activeGroupId === group.id ? 'active' : ''}`;
        item.onclick = () => switchGroup(group.id);
        
        item.innerHTML = `
            <h3>${group.name}</h3>
            <small>${group.date}</small>
            <button class="delete-group-btn" onclick="event.stopPropagation(); deleteGroup('${group.id}')">✕</button>
        `;
        groupsListEl.appendChild(item);
    });
}

function switchGroup(id) {
    state.activeGroupId = id;
    saveToDatabase();
    updateUI();
}

function addGroup() {
    const name = prompt('Nombre de la nueva venta/lote:');
    if (name) {
        const id = 'group_' + Date.now();
        state.groups[id] = {
            id: id,
            name: name,
            date: new Date().toLocaleDateString(),
            exchangeRate: 445,
            articles: [],
            manualTotalUsd: 0,
            manualExpensesUsd: 0
        };
        state.activeGroupId = id;
        saveToDatabase();
        updateUI();
    }
}

function deleteGroup(id) {
    if (Object.keys(state.groups).length <= 1) {
        alert('No puedes eliminar todas las ventas.');
        return;
    }
    
    if (confirm('¿Estás seguro de que quieres eliminar esta venta y todos sus artículos?')) {
        delete state.groups[id];
        if (state.activeGroupId === id) {
            state.activeGroupId = Object.keys(state.groups)[0];
        }
        saveToDatabase();
        updateUI();
    }
}

function updateCharts(soldQty, stockQty, investment, revenue, expenses, netProfit) {
    if (salesChart) {
        salesChart.data.datasets[0].data = [soldQty, stockQty];
        salesChart.update();
    }
    if (profitChart) {
        profitChart.data.datasets[0].data = [investment, revenue, expenses, netProfit];
        profitChart.update();
    }
}

// Event Handlers
articleForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const activeGroup = state.groups[state.activeGroupId];
    const name = document.getElementById('article-name').value;
    const totalQuantity = parseInt(document.getElementById('article-quantity').value);
    const costUsd = parseFloat(document.getElementById('article-cost-usd').value);
    const priceUsd = parseFloat(document.getElementById('article-price-usd').value);

    activeGroup.articles.push({
        name,
        totalQuantity,
        soldQuantity: 0,
        costUsd,
        priceUsd
    });

    articleForm.reset();
    saveToDatabase();
    updateUI();
});

exchangeRateInput.addEventListener('input', (e) => {
    state.groups[state.activeGroupId].exchangeRate = parseFloat(e.target.value) || 0;
    saveToDatabase();
    updateUI();
});

clearDataBtn.addEventListener('click', () => {
    if (confirm('¿Estás seguro de que quieres borrar TODOS los artículos de ESTA venta?')) {
        state.groups[state.activeGroupId].articles = [];
        state.groups[state.activeGroupId].manualTotalUsd = 0;
        state.groups[state.activeGroupId].manualExpensesUsd = 0;
        saveToDatabase();
        updateUI();
    }
});

manualTotalUsdInput.addEventListener('input', (e) => {
    state.groups[state.activeGroupId].manualTotalUsd = parseFloat(e.target.value) || 0;
    saveToDatabase();
    updateUI();
});

manualExpensesUsdInput.addEventListener('input', (e) => {
    state.groups[state.activeGroupId].manualExpensesUsd = parseFloat(e.target.value) || 0;
    saveToDatabase();
    updateUI();
});

newGroupBtn.addEventListener('click', addGroup);

if (saveDbBtn) {
    saveDbBtn.addEventListener('click', saveToDatabase);
}

themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        state.theme = 'light';
        themeToggle.textContent = '🌓';
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        state.theme = 'dark';
        themeToggle.textContent = '☀️';
    }
    
    initCharts();
    saveToDatabase();
    updateUI();
});

window.updateSold = (index, delta) => {
    const activeGroup = state.groups[state.activeGroupId];
    const article = activeGroup.articles[index];
    const newSold = article.soldQuantity + delta;
    
    if (newSold >= 0 && newSold <= article.totalQuantity) {
        article.soldQuantity = newSold;
        saveToDatabase();
        updateUI();
    }
};

window.deleteArticle = (index) => {
    if (confirm('¿Estás seguro de que quieres eliminar este artículo?')) {
        state.groups[state.activeGroupId].articles.splice(index, 1);
        saveToDatabase();
        updateUI();
    }
};

window.deleteGroup = deleteGroup;

// Referencias al DOM (Respaldo)
const backupBtn = document.getElementById('backup-db-btn');
const restoreBtn = document.getElementById('restore-db-btn');
const importFileInput = document.getElementById('import-file');

// Función para exportar datos a un archivo TXT/JSON
function exportData() {
    const dataStr = JSON.stringify(state, null, 4);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `ventas_respaldo_${new Date().toISOString().slice(0,10)}.txt`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

// Función para importar datos desde un archivo
function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedState = JSON.parse(e.target.result);
            
            // Validación básica de estructura
            if (importedState.groups && importedState.activeGroupId) {
                if (confirm('¿Estás seguro de que quieres restaurar estos datos? Los datos actuales se sobrescribirán.')) {
                    state = importedState;
                    localStorage.setItem('ventas_state_v2', JSON.stringify(state));
                    updateUI();
                    initCharts();
                    alert('Datos restaurados con éxito.');
                    saveToDatabase(); // Intentar sincronizar los nuevos datos cargados
                }
            } else {
                alert('El archivo no tiene el formato correcto.');
            }
        } catch (err) {
            alert('Error al leer el archivo. Asegúrate de que es un archivo válido.');
            console.error(err);
        }
    };
    reader.readAsText(file);
}

// Inicialización corregida
document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificar sesión previa
    const savedSession = localStorage.getItem(USER_SESSION_KEY);
    if (savedSession) {
        const session = JSON.parse(savedSession);
        // Validar que la sesión guardada sea la permitida
        if (session.user === 'wawita' && session.pass === 'wawita') {
            currentUser = session.user;
            document.body.classList.add('logged-in');
            loadFromDatabase(); 
        } else {
            localStorage.removeItem(USER_SESSION_KEY);
        }
    }

    // 2. Listeners de Auth
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    // 3. Listener de Guardado Cloud
    if (saveDbBtn) saveDbBtn.addEventListener('click', saveToDatabase);

    // ... resto de listeners existentes ...
});
