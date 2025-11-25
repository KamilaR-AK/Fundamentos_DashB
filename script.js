/**
 * SOCIAL MEDIA ANALYTICS DASHBOARD - COMPLETO
 * Powered by: Google Visualization API
 */

// --- CONFIGURACIÓN CON TU ID DE GOOGLE SHEET ---
const SPREADSHEET_ID = '1jKWnrW3_Av34qQ1ef209RUX620CuuCwit42AuHJRPL4';
const SHEET_NAMES = ['Bogota.Atl', 'Los_delaU', 'Grupo_Niche_Poli'];

// Variables globales para la carga y renderizado
const dashboardData = []; // Para el ordenamiento inicial
const allAnalytics = {};  // Para acceso rápido a los datos del modal
let sheetsProcessed = 0;

// CARGAR LIBRERÍA DE GOOGLE y llamar initDashboard
google.charts.load('current', { 'packages': ['corechart'] });
google.charts.setOnLoadCallback(initDashboard);

// Elementos del DOM
const app = document.getElementById('app');
const loader = document.getElementById('loader');
const modal = document.getElementById('post-detail-modal');

// --- Control de Tooltips (Ajuste 2: Posicionamiento dinámico) ---
document.addEventListener('mouseover', function(e) {
    const item = e.target.closest('.metric-item');
    if (!item) return;

    // Solo si el tooltip no está ya activado
    if (item.classList.contains('tooltip-active')) return;

    const tooltip = item.querySelector(':after');
    if (!tooltip) return;

    // Añadir clase para activar el CSS
    item.classList.add('tooltip-active');
    
    // Función para calcular la posición
    function positionTooltip() {
        if (!item.classList.contains('tooltip-active')) return; // Check if still active

        const rect = item.getBoundingClientRect();
        const tooltipHeight = 50; // Estimación de la altura del tooltip
        const spaceTop = rect.top;
        const spaceBottom = window.innerHeight - rect.bottom;

        // Determinar si poner arriba o abajo
        let finalTop = 0;
        let finalArrowTop = 0;

        // Si hay más espacio abajo que arriba, o si no hay suficiente espacio arriba
        if (spaceBottom > spaceTop || spaceTop < tooltipHeight + 20) {
            // Mostrar abajo
            finalTop = rect.bottom + 10; // 10px de margen
            finalArrowTop = rect.bottom + 2; // Flecha 2px debajo
        } else {
            // Mostrar arriba
            finalTop = rect.top - tooltipHeight - 20; // 20px de margen + altura
            finalArrowTop = rect.top - 12; // Flecha 12px debajo
        }

        // Aplicar posiciones a los pseudo-elementos (requiere usar un elemento real o clases)
        // Como no podemos modificar pseudo-elementos directamente con JS, usamos un truco:
        // Se aplicarán CSS variables o se asumirá que la posición fija funciona bien con un Z-index alto.
        // Dada la complejidad de modificar pseudo-elementos, nos apoyaremos en el CSS 'fixed'
        // y el Z-index alto para que esté visible. La corrección de posición fuera de pantalla
        // es más compleja y se recomienda usar una librería de tooltips para esto.
        // Mantendremos la solución CSS con Z-index alto para priorizar la visibilidad (Ajuste 2).
    }
    
    // Ejecutar inmediatamente y en scroll
    positionTooltip();
    window.addEventListener('scroll', positionTooltip);
    item.onmouseleave = () => {
        item.classList.remove('tooltip-active');
        window.removeEventListener('scroll', positionTooltip);
    };
});
// Nota: La corrección de posición se limita a Z-index alto, ya que la manipulación de pseudo-elementos
// en JS es ineficiente o imposible sin librerías. El CSS fixed + z-index 99999 asegura que esté visible (Ajuste 2).


// --- Lógica de la API y Carga de Datos ---
function initDashboard() {
    loader.style.display = 'flex';
    app.innerHTML = '';
    sheetsProcessed = 0; 

    SHEET_NAMES.forEach(sheetName => {
        const apiURL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?sheet=${sheetName}&headers=1`;
        const query = new google.visualization.Query(apiURL);
        query.setQuery('SELECT A, B, C'); 
        query.send(response => handleQueryResponse(response, sheetName));
    });
}

function handleQueryResponse(response, sheetName) {
    sheetsProcessed++;

    if (!response.isError()) {
        const dataTable = response.getDataTable();
        const rows = [];
        const numRows = dataTable.getNumberOfRows();
        
        for (let i = 0; i < numRows; i++) {
            const fecha = dataTable.getFormattedValue(i, 0); 
            const likes = dataTable.getValue(i, 1);
            const url = dataTable.getValue(i, 2);

            if (fecha && likes !== null) {
                rows.push({ fecha: fecha, likes: Number(likes), url: url || '#' });
            }
        }

        if (rows.length > 0) {
            const analytics = calculateMetrics(rows);
            dashboardData.push({ name: sheetName, metrics: analytics });
            allAnalytics[sheetName] = analytics; // Almacenar para el modal
        }
    }

    if (sheetsProcessed === SHEET_NAMES.length) {
        renderDashboard();
    }
}

// Función para ordenar y renderizar
function renderDashboard() {
    loader.style.display = 'none'; 
    
    dashboardData.sort((a, b) => b.metrics.totalRecognized - a.metrics.totalRecognized);
    
    dashboardData.forEach((data, index) => {
        const isWinner = index === 0;
        renderCard(data.name, data.metrics, isWinner);
    });

    if (dashboardData.length === 0) {
         showError("Datos no encontrados", "No se pudo extraer información válida de ninguna hoja. Verifica tus permisos y el formato de las columnas (Fecha, Likes, URL).");
    }
}

// --- Lógica Matemática ---
function calculateMetrics(data) {
    const likesArray = data.map(d => d.likes);
    const n = likesArray.length;
    
    const totalLikes = likesArray.reduce((a, b) => a + b, 0);
    const average = n > 0 ? totalLikes / n : 0;
    
    const variance = n > 0 ? likesArray.reduce((acc, val) => acc + Math.pow(val - average, 2), 0) / n : 0;
    const stdDev = Math.sqrt(variance);
    
    const maxAllowed = average + stdDev;
    let totalRecognized = 0;
    
    const processedData = data.map(item => {
        const isCapped = item.likes > maxAllowed;
        const recognizedValue = isCapped ? maxAllowed : item.likes;
        totalRecognized += recognizedValue;
        
        const lostLikes = isCapped ? item.likes - maxAllowed : 0;
        
        return {
            ...item,
            recognized: recognizedValue,
            isCapped: isCapped,
            lost: lostLikes
        };
    });

    return {
        totalLikes, average, stdDev, maxAllowed, totalRecognized, posts: processedData
    };
}

// 4. Renderizado UI
function renderCard(name, metrics, isWinner) {
    const card = document.createElement('article');
    card.className = `account-card ${isWinner ? 'winner-card' : ''}`;
    
    const fmtNum = (n) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n);
    const fmtDec = (n) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(n);

    // Definiciones de Tooltip
    const tooltipRecognized = "Suma de Likes, donde los valores atípicos (Likes > Promedio + Desv. Est.) son ajustados al tope.";
    const tooltipTotal = "Suma total de likes sin ajuste (valor real).";
    const tooltipAverage = "Suma total de likes reales dividida por el número de publicaciones.";
    const tooltipStdDev = "Mide la dispersión de los likes. Indica qué tan variables son los resultados.";
    const tooltipMaxAllowed = "Valor por encima del cual una publicación es considerada atípica (Promedio + Desv. Est.).";

    // --- AJUSTE 3: Estructura iconográfica ---
    card.innerHTML = `
        <div class="card-header">
            <div class="account-name">${name} ${isWinner ? '<i class="fa-solid fa-trophy" style="color: var(--accent-hover); margin-left: 5px;"></i>' : ''}</div>
            <i class="fa-solid fa-chart-bar account-icon"></i>
        </div>

        <div class="metrics-grid">
            <div class="metric-item full-width" data-tooltip="${tooltipRecognized}">
                <div>
                    <span class="metric-label">Likes Reconocidos</span>
                    <span class="metric-value text-success">${fmtNum(metrics.totalRecognized)}</span>
                </div>
                <div class="metric-icon-box icon-recognized">
                    <i class="fa-solid fa-heart-circle-check"></i>
                </div>
            </div>

            <div class="metric-item" data-tooltip="${tooltipTotal}">
                <div class="metric-icon-box icon-total">
                    <i class="fa-solid fa-heart"></i>
                </div>
                <span class="metric-value">${fmtNum(metrics.totalLikes)}</span>
                <span class="metric-label">Total Real</span>
            </div>
            
            <div class="metric-item" data-tooltip="${tooltipAverage}">
                <div class="metric-icon-box icon-average">
                    <i class="fa-solid fa-calculator"></i>
                </div>
                <span class="metric-value text-purple">${fmtNum(metrics.average)}</span>
                <span class="metric-label">Promedio</span>
            </div>

            <div class="metric-item full-width" data-tooltip="${tooltipMaxAllowed}">
                <div>
                    <span class="metric-label">Tope Máx (Prom + Desv. Est.)</span>
                    <span class="metric-value text-warning">${fmtNum(metrics.maxAllowed)}</span>
                </div>
                <div class="metric-icon-box icon-max">
                    <i class="fa-solid fa-stop-circle"></i>
                </div>
            </div>
        </div>

        <button class="detail-button" onclick="showModal('${name}')">
            Ver Posts Detallados <i class="fa-solid fa-table-list"></i>
        </button>
    `;

    app.appendChild(card);
}

// --- Funciones de Modal (Ajuste 4) ---
function showModal(sheetName) {
    const data = allAnalytics[sheetName];
    if (!data) return;

    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    
    const fmtNum = (n) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n);
    const fmtDec = (n) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(n);

    // 1. Título
    modalTitle.textContent = `Detalle de Publicaciones - ${sheetName}`;

    // 2. Construir la tabla
    const tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Likes Reales</th>
                    <th>Likes Reconocidos</th>
                    <th>Likes Perdidos</th>
                    <th>Link</th>
                </tr>
            </thead>
            <tbody>
                ${data.posts.map(post => `
                    <tr>
                        <td>${post.fecha}</td>
                        <td class="text-purple">${fmtNum(post.likes)}</td>
                        <td class="${post.isCapped ? 'text-warning' : 'text-success'}" 
                            title="${post.isCapped ? `Tope de ${fmtDec(data.maxAllowed)} aplicado` : 'Valor normal'}">
                            ${fmtDec(post.recognized)}
                        </td>
                        <td class="${post.lost > 0 ? 'text-danger' : 'text-secondary'}">
                            ${post.lost > 0 ? `-${fmtDec(post.lost)}` : '0.0'}
                        </td>
                        <td>
                            <a href="${post.url}" target="_blank" class="link-icon">
                                <i class="fa-solid fa-arrow-up-right-from-square"></i>
                            </a>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    modalBody.innerHTML = tableHTML;

    // 3. Mostrar Modal
    modal.style.display = 'flex';
    // Usar timeout para que la transición CSS funcione
    setTimeout(() => modal.classList.add('is-open'), 10);
}

function closeModal() {
    modal.classList.remove('is-open');
    // Esperar a que termine la transición antes de ocultar
    setTimeout(() => modal.style.display = 'none', 300);
}

function showError(title, msg) {
    loader.style.display = 'flex';
    loader.innerHTML = `
        <div style="text-align: center; color: var(--danger);">
            <i class="fa-solid fa-circle-xmark" style="font-size: 3rem; margin-bottom: 1rem;"></i>
            <h3>${title}</h3>
            <p>${msg}</p>
        </div>
    `;
}