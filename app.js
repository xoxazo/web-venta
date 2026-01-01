// Configuración de JSONBin.io
const BIN_ID_KEY = 'ventas_jsonbin_id';
const MASTER_KEY = '$2a$10$mM..UNQapnjXnJQE0QfBUeoBqUXJHBk1tElUb16AY1CedHOPTR7lu';

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

// Inicialización de Gráficas
let salesChart;
let profitChart;

function updateSyncStatus(status, text) {
    if (!syncIndicator) return;
    syncIndicator.className = 'sync-indicator ' + status;
    const textEl = syncIndicator.querySelector('.sync-text');
    if (textEl) textEl.textContent = text;
}

// Persistencia Global con JSONBin
async function saveToDatabase() {
    updateSyncStatus('syncing', 'Sincronizando...');
    
    // Guardamos en LocalStorage siempre como respaldo rápido
    localStorage.setItem('ventas_state_v2', JSON.stringify(state));

    let binId = localStorage.getItem(BIN_ID_KEY);
    
    try {
        const method = binId ? 'PUT' : 'POST';
        const url = binId ? `https://api.jsonbin.io/v3/b/${binId}` : `https://api.jsonbin.io/v3/b`;
        
        const headers = {
            'Content-Type': 'application/json',
            'X-Master-Key': MASTER_KEY
        };
        
        if (!binId) {
            headers['X-Bin-Name'] = 'Ventas_App_Data';
        }

        const response = await fetch(url, {
            method: method,
            headers: headers,
            body: JSON.stringify(state)
        });

        const data = await response.json();

        if (response.ok) {
            if (!binId && data.metadata && data.metadata.id) {
                localStorage.setItem(BIN_ID_KEY, data.metadata.id);
            }
            updateSyncStatus('success', 'Sincronizado');
            console.log("Sincronización global completada.");
        } else {
            throw new Error(data.message || 'Error en la sincronización');
        }
    } catch (e) {
        console.error("Error en sincronización global:", e);
        updateSyncStatus('offline', 'Error de conexión');
    }
}

async function loadFromDatabase() {
    updateSyncStatus('syncing', 'Cargando...');
    
    let binId = localStorage.getItem(BIN_ID_KEY);
    
    // Si no hay binId, intentamos cargar de LocalStorage primero
    if (!binId) {
        loadFromLocalStorage();
        updateSyncStatus('success', 'Local');
        return;
    }

    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
            headers: {
                'X-Master-Key': MASTER_KEY
            }
        });

        if (response.ok) {
            const result = await response.json();
            if (result.record) {
                state = result.record;
                updateSyncStatus('success', 'Sincronizado');
                console.log("Datos cargados desde la nube.");
            }
        } else {
            loadFromLocalStorage();
            updateSyncStatus('offline', 'Error al cargar');
        }
    } catch (e) {
        console.error("Error cargando de la nube:", e);
        loadFromLocalStorage();
        updateSyncStatus('offline', 'Sin conexión');
    }

    if (state.theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.textContent = '☀️';
    }
    
    initCharts();
    updateUI();
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
