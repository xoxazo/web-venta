// Configuración de Sincronización (Usando Cloudflare Worker - Alta Disponibilidad)
const SYNC_ENDPOINT = 'https://ventas-db.kinghost.workers.dev';
const SYNC_ID_KEY = 'ventas_sync_id';

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
    theme: 'light'
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

function updateSyncStatus(status, text) {
    if (!syncIndicator) return;
    syncIndicator.className = 'sync-indicator ' + status;
    const textEl = syncIndicator.querySelector('.sync-text');
    if (textEl) textEl.textContent = text;
}

// Persistencia Global (Simple y Directa)
async function saveToDatabase() {
    updateSyncStatus('syncing', 'Guardando...');
    localStorage.setItem('ventas_state_v2', JSON.stringify(state));

    let syncId = localStorage.getItem(SYNC_ID_KEY);
    if (!syncId) {
        syncId = 'v_' + Math.random().toString(36).substring(2, 10);
        localStorage.setItem(SYNC_ID_KEY, syncId);
    }
    
    try {
        const response = await fetch(`${SYNC_ENDPOINT}/save`, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: syncId, data: state })
        });

        if (response.ok) {
            updateSyncStatus('success', 'Sincronizado');
        } else {
            throw new Error('Servidor');
        }
    } catch (e) {
        console.warn("Error nube, usando local:", e);
        updateSyncStatus('offline', 'Local OK');
    }
}

async function loadFromDatabase() {
    updateSyncStatus('syncing', 'Cargando...');
    
    let syncId = localStorage.getItem(SYNC_ID_KEY);
    
    if (!syncId) {
        loadFromLocalStorage();
        updateSyncStatus('success', 'Local');
        return;
    }

    try {
        const response = await fetch(`${SYNC_ENDPOINT}/load?id=${syncId}`, {
            method: 'GET',
            mode: 'cors'
        });

        if (response.ok) {
            const result = await response.json();
            if (result && result.data) {
                state = result.data;
                updateSyncStatus('success', 'Sincronizado');
            } else {
                loadFromLocalStorage();
            }
        } else {
            loadFromLocalStorage();
            updateSyncStatus('success', 'Local');
        }
    } catch (e) {
        console.error("Error red:", e);
        loadFromLocalStorage();
        updateSyncStatus('offline', 'Local');
    }

    if (state.theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.textContent = '☀️';
    }
    
    initCharts();
    updateUI();
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

// Inicio
loadFromDatabase();
