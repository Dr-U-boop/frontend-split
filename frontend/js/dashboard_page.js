let currentToken = null;
let currentPatientId = null;
let patients = [];
let glucoseChart = null;
let simChart = null;
let comprehensiveData = null;
let currentMonitoringView = 'chart';
let simulatorScenarios = [];
const patientStatusById = new Map();
const STATUS_PRIORITY = ['status-attention', 'status-warning', 'status-ok'];

// --- DOM Элементы ---
const patientsListEl = document.getElementById('patients-list');
const welcomeMessageEl = document.getElementById('welcome-message');
const patientDetailsEl = document.getElementById('patient-details');
const patientNameEl = document.getElementById('patient-name');
const chartCanvas = document.getElementById('glucose-chart').getContext('2d');
const recommendationsListEl = document.getElementById('recommendations-list');
const startDateInput = document.getElementById('start-date');
const startTimeInput = document.getElementById('start-time');
const endDateInput = document.getElementById('end-date');
const endTimeInput = document.getElementById('end-time');
const updateChartBtn = document.getElementById('update-chart-btn');
const resetChartBtn = document.getElementById('reset-chart-btn');
const dashboardContainer = document.getElementById('dashboard-container');
const sidebarToggleBtn = document.getElementById('sidebar-toggle');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomResetBtn = document.getElementById('zoom-reset-btn');
const patientSearchInput = document.getElementById('patient-search');
const resizer = document.getElementById('sidebar-resizer');
const chartWrapperEl = document.querySelector('.chart-wrapper');
const tableWrapperEl = document.getElementById('comprehensive-table-wrapper');
const comprehensiveTableBodyEl = document.getElementById('comprehensive-table-body');
const viewChartBtn = document.getElementById('view-chart-btn');
const viewTableBtn = document.getElementById('view-table-btn');
const lastDayRangeBtn = document.getElementById('range-last-day-btn');
const lastMonthRangeBtn = document.getElementById('range-last-month-btn');
const lastThreeMonthsRangeBtn = document.getElementById('range-last-3-months-btn');
const statsPeriodLabelEl = document.getElementById('stats-period-label');
const statReadingsCountEl = document.getElementById('stat-readings-count');
const statAvgGlucoseEl = document.getElementById('stat-avg-glucose');
const statMinGlucoseEl = document.getElementById('stat-min-glucose');
const statMaxGlucoseEl = document.getElementById('stat-max-glucose');
const statStdGlucoseEl = document.getElementById('stat-std-glucose');
const statTirEl = document.getElementById('stat-tir');
const statHypoCountEl = document.getElementById('stat-hypo-count');
const statHyperCountEl = document.getElementById('stat-hyper-count');
const statTotalCarbsEl = document.getElementById('stat-total-carbs');
const statTotalInsulinEl = document.getElementById('stat-total-insulin');
const patientDiaryBodyEl = document.getElementById('patient-diary-body');
const refreshDiaryBtn = document.getElementById('refresh-diary-btn');
const simParamsCodeEl = document.getElementById('sim-params-code');
const simScenarioCodeEl = document.getElementById('sim-scenario-code');
const simSaveParamsBtn = document.getElementById('sim-save-params-btn');
const simScenarioSelectEl = document.getElementById('sim-scenario-select');
const simNewScenarioBtn = document.getElementById('sim-new-scenario-btn');
const simSaveScenarioBtn = document.getElementById('sim-save-scenario-btn');
const simRunBtn = document.getElementById('sim-run-btn');
const simStatsPeriodLabelEl = document.getElementById('sim-stats-period-label');
const simStatAvgEl = document.getElementById('sim-stat-avg');
const simStatMinEl = document.getElementById('sim-stat-min');
const simStatMaxEl = document.getElementById('sim-stat-max');
const simStatTirEl = document.getElementById('sim-stat-tir');
const simChartCanvas = document.getElementById('sim-glucose-chart');
const simModelTypeEl = document.getElementById('sim-model-type');
const simCgmSeedEl = document.getElementById('sim-cgm-seed');
const API_BASE_URL = window.electronAPI.getApiBaseUrl();

function readCssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
}

function getChartThemeConfig() {
    return {
        textPrimary: readCssVar('--color-text-primary', '#2f3b36'),
        textSecondary: readCssVar('--color-text-secondary', '#6c7773'),
        grid: readCssVar('--chart-grid-color', 'rgba(70, 89, 82, 0.14)')
    };
}

// --- КОНСТАНТЫ ---
const SIDEBAR_WIDTH_KEY = 'sidebarWidth';
const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 600;
const DEFAULT_SIDEBAR_WIDTH = 280;
const THEME_MODES = ['light', 'dark', 'auto'];
const ZOOM_STORAGE_KEY = 'appZoomPercent';
const ZOOM_STEP = 10;
const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const THEME_LABELS = {
    light: 'Светлая',
    dark: 'Тёмная',
    auto: 'Авто'
};

function getCurrentThemeMode() {
    if (window.appTheme && typeof window.appTheme.getMode === 'function') {
        return window.appTheme.getMode();
    }
    return 'auto';
}

function updateThemeToggleLabel() {
    if (!themeToggleBtn) return;
    const mode = getCurrentThemeMode();
    themeToggleBtn.textContent = `Тема: ${THEME_LABELS[mode] || THEME_LABELS.auto}`;
}

function cycleThemeMode() {
    if (!window.appTheme || typeof window.appTheme.setMode !== 'function') return;
    const currentMode = getCurrentThemeMode();
    const currentIndex = THEME_MODES.indexOf(currentMode);
    const nextMode = THEME_MODES[(currentIndex + 1 + THEME_MODES.length) % THEME_MODES.length];
    window.appTheme.setMode(nextMode);
    updateThemeToggleLabel();
}

function getSavedZoomPercent() {
    const raw = localStorage.getItem(ZOOM_STORAGE_KEY);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return null;
    if (parsed < MIN_ZOOM || parsed > MAX_ZOOM) return null;
    return parsed;
}

function getCurrentZoomPercent() {
    return getSavedZoomPercent() ?? 100;
}

async function applyZoomPercent(percent, persist = true) {
    if (!window.electronAPI || typeof window.electronAPI.setZoomFactor !== 'function') return;

    if (percent === null) {
        await window.electronAPI.setZoomFactor(1);
        if (persist) localStorage.removeItem(ZOOM_STORAGE_KEY);
    } else {
        const boundedPercent = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, percent));
        await window.electronAPI.setZoomFactor(boundedPercent / 100);
        if (persist) localStorage.setItem(ZOOM_STORAGE_KEY, String(boundedPercent));
    }

    updateZoomResetLabel();
    if (glucoseChart) {
        setTimeout(() => glucoseChart.resize(), 0);
    }
}

function updateZoomResetLabel() {
    if (!zoomResetBtn) return;
    const savedZoom = getSavedZoomPercent();
    zoomResetBtn.textContent = savedZoom === null ? 'Авто' : `${savedZoom}%`;
}

async function increaseZoom() {
    const nextZoom = getCurrentZoomPercent() + ZOOM_STEP;
    await applyZoomPercent(nextZoom);
}

async function decreaseZoom() {
    const nextZoom = getCurrentZoomPercent() - ZOOM_STEP;
    await applyZoomPercent(nextZoom);
}

async function resetZoomToAuto() {
    await applyZoomPercent(null);
}

function initZoomControls() {
    if (!zoomOutBtn || !zoomInBtn || !zoomResetBtn) return;

    zoomOutBtn.addEventListener('click', () => { void decreaseZoom(); });
    zoomInBtn.addEventListener('click', () => { void increaseZoom(); });
    zoomResetBtn.addEventListener('click', () => { void resetZoomToAuto(); });

    void applyZoomPercent(getSavedZoomPercent(), false);
}

// --- Инициализация ---
window.electronAPI.handleToken((token) => {
    currentToken = token;
    sessionStorage.setItem('accessToken', currentToken);
    fetchAndRenderPatients();
});

// --- ИНИЦИАЛИЗАЦИЯ ШИРИНЫ ПРИ ЗАГРУЗКЕ ---
// Проверяем, есть ли сохраненная ширина
const savedSidebarWidth = localStorage.getItem(SIDEBAR_WIDTH_KEY);
if (savedSidebarWidth) {
    // Применяем сохраненную ширину
    dashboardContainer.style.gridTemplateColumns = `${savedSidebarWidth}px 1fr`;
}

// --- ЛОГИКА СВОРАЧИВАНИЯ МЕНЮ (ОБНОВЛЕННАЯ) ---
sidebarToggleBtn.addEventListener('click', () => {
    const isCollapsed = dashboardContainer.classList.toggle('sidebar-collapsed');

    if (isCollapsed) {
        // Если свернули - очищаем стиль, чтобы сработал CSS класс (0px)
        dashboardContainer.style.gridTemplateColumns = '';
    } else {
        // Если развернули - восстанавливаем сохраненную ширину или дефолтную
        const widthToRestore = localStorage.getItem(SIDEBAR_WIDTH_KEY) || DEFAULT_SIDEBAR_WIDTH;
        dashboardContainer.style.gridTemplateColumns = `${widthToRestore}px 1fr`;
    }

    if (glucoseChart) {
        setTimeout(() => { glucoseChart.resize(); }, 300);
    }
});

// --- ЛОГИКА ИЗМЕНЕНИЯ ШИРИНЫ (RESIZING ОБНОВЛЕННАЯ) ---
let isResizing = false;
let currentWidth = DEFAULT_SIDEBAR_WIDTH; // Временная переменная для хранения текущей ширины

resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizer.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    // Если начали тянуть свернутое меню - разворачиваем его
    if (dashboardContainer.classList.contains('sidebar-collapsed')) {
        dashboardContainer.classList.remove('sidebar-collapsed');
    }

    let newWidth = e.clientX;

    // Ограничения
    if (newWidth < MIN_SIDEBAR_WIDTH) newWidth = MIN_SIDEBAR_WIDTH;
    if (newWidth > MAX_SIDEBAR_WIDTH) newWidth = MAX_SIDEBAR_WIDTH;

    currentWidth = newWidth; // Запоминаем текущую позицию

    // Применяем стиль
    dashboardContainer.style.gridTemplateColumns = `${newWidth}px 1fr`;
});

document.addEventListener('mouseup', () => {
    if (isResizing) {
        isResizing = false;
        resizer.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        // --- НОВОЕ: Сохраняем итоговую ширину в Local Storage ---
        localStorage.setItem(SIDEBAR_WIDTH_KEY, currentWidth);
        console.log(`Ширина панели сохранена: ${currentWidth}px`);

        if (glucoseChart) glucoseChart.resize();
    }
});

patientSearchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();

    // Фильтруем локальный массив patients
    const filteredPatients = patients.filter(patient => {
        const nameMatch = patient.full_name.toLowerCase().includes(query);
        const dobMatch = patient.date_of_birth.includes(query);
        return nameMatch || dobMatch;
    });

    renderPatientsList(filteredPatients);
});

// --- Функции ---
async function apiFetch(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentToken}`
        }
    };
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...defaultOptions, ...options });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Ошибка API: ${response.statusText}`);
    }
    return response.json();
}

async function fetchAndRenderPatients() {
    try {
        // Сохраняем ответ сервера в глобальную переменную patients
        patients = await apiFetch('/api/patients/');
        assignAndNormalizePatientStatuses(patients);
        // Рендерим полный список
        renderPatientsList(patients);
    } catch (error) {
        console.error("Не удалось загрузить пациентов:", error);
    }
}

// Выносим рендеринг списка в отдельную функцию для переиспользования в поиске
function renderPatientsList(patientsArray) {
    patientsListEl.innerHTML = '';

    if (patientsArray.length === 0) {
        patientsListEl.innerHTML = '<li style="padding:10px; color:#999; text-align:center;">Ничего не найдено</li>';
        return;
    }

    const sortedPatients = [...patientsArray].sort((a, b) => {
        const statusA = getOrCreatePatientStatus(a.id);
        const statusB = getOrCreatePatientStatus(b.id);
        const statusDiff = STATUS_PRIORITY.indexOf(statusA) - STATUS_PRIORITY.indexOf(statusB);
        if (statusDiff !== 0) return statusDiff;
        return a.full_name.localeCompare(b.full_name, 'ru');
    });

    sortedPatients.forEach(patient => {
        const li = document.createElement('li');
        li.className = 'patient-item';
        if (patient.id === currentPatientId) {
            li.classList.add('active');
        }

        li.dataset.patientId = patient.id;
        const statusClass = getOrCreatePatientStatus(patient.id);

        li.innerHTML = `
            <div class="status-indicator ${statusClass}"></div>
            <div style="display:flex; flex-direction:column;">
                <span style="font-weight:500;">${patient.full_name}</span>
                <span style="font-size:11px; color:var(--color-text-secondary);">${patient.date_of_birth}</span>
            </div>
        `;

        li.addEventListener('click', () => {
            document.querySelectorAll('.patient-item').forEach(item => item.classList.remove('active'));
            li.classList.add('active');
            displayPatientDetails(patient.id);
        });
        patientsListEl.appendChild(li);
    });
}

function getRandomStatus() {
    return STATUS_PRIORITY[Math.floor(Math.random() * STATUS_PRIORITY.length)];
}

function getOrCreatePatientStatus(patientId) {
    if (!patientStatusById.has(patientId)) {
        patientStatusById.set(patientId, getRandomStatus());
    }
    return patientStatusById.get(patientId);
}

function assignAndNormalizePatientStatuses(patientsArray) {
    const incomingIds = new Set(patientsArray.map((patient) => patient.id));

    Array.from(patientStatusById.keys()).forEach((patientId) => {
        if (!incomingIds.has(patientId)) {
            patientStatusById.delete(patientId);
        }
    });

    patientsArray.forEach((patient) => {
        getOrCreatePatientStatus(patient.id);
    });

    if (patientsArray.length < STATUS_PRIORITY.length) return;

    const statusBuckets = new Map(STATUS_PRIORITY.map((status) => [status, []]));
    patientsArray.forEach((patient) => {
        const status = getOrCreatePatientStatus(patient.id);
        statusBuckets.get(status).push(patient.id);
    });

    STATUS_PRIORITY.forEach((requiredStatus) => {
        if (statusBuckets.get(requiredStatus).length > 0) return;

        const donorStatus = STATUS_PRIORITY.find((status) => statusBuckets.get(status).length > 1);
        if (!donorStatus) return;

        const donorPatientId = statusBuckets.get(donorStatus).pop();
        patientStatusById.set(donorPatientId, requiredStatus);
        statusBuckets.get(requiredStatus).push(donorPatientId);
    });
}

async function displayPatientDetails(patientId) {
    currentPatientId = patientId;
    try {
        welcomeMessageEl.classList.add('hidden');
        patientDetailsEl.classList.remove('hidden');

        const patient = await apiFetch(`/api/patients/${patientId}`);
        patientNameEl.textContent = patient.full_name;

        startDateInput.value = '';
        endDateInput.value = '';
        startTimeInput.value = '';
        endTimeInput.value = '';

        const [chartData, recommendationsData] = await Promise.all([
            apiFetch(`/api/patients/${currentPatientId}/comprehensive_data`),
            apiFetch(`/api/patients/${currentPatientId}/recommendations`)
        ]);

        comprehensiveData = chartData;
        renderComprehensiveView();
        renderRecommendations(recommendationsData);
        await loadPatientDiary(currentPatientId);
    } catch (error) { console.error("Не удалось загрузить данные пациента:", error); }
}

async function updateComprehensiveChart() {
    if (!currentPatientId) return;
    let endpoint = `/api/patients/${currentPatientId}/comprehensive_data`;

    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    if (startDate && endDate) {
        const startTime = startTimeInput.value || "00:00";
        const endTime = endTimeInput.value || "23:59";
        const startISO = `${startDate}T${startTime}`;
        const endISO = `${endDate}T${endTime}`;
        endpoint += `?start_datetime=${startISO}&end_datetime=${endISO}`;
    }

    try {
        comprehensiveData = await apiFetch(endpoint);
        renderComprehensiveView();
    } catch (error) { console.error("Не удалось обновить график:", error); }
}

function formatDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatTimeInputValue(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function setQuickRangeActiveButton(activeButton) {
    [lastDayRangeBtn, lastMonthRangeBtn, lastThreeMonthsRangeBtn].forEach((btn) => {
        if (!btn) return;
        btn.classList.toggle('active', btn === activeButton);
    });
}

function applyQuickRange(period) {
    const end = new Date();
    const start = new Date(end);

    if (period === 'day') {
        start.setDate(start.getDate() - 1);
    } else if (period === 'month') {
        start.setMonth(start.getMonth() - 1);
    } else if (period === '3months') {
        start.setMonth(start.getMonth() - 3);
    }

    startDateInput.value = formatDateInputValue(start);
    startTimeInput.value = formatTimeInputValue(start);
    endDateInput.value = formatDateInputValue(end);
    endTimeInput.value = formatTimeInputValue(end);

    updateComprehensiveChart();
}

function formatTimestampForTable(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('ru-RU');
}

function toNumberArray(points) {
    return (points || [])
        .map((point) => Number(point.y))
        .filter((value) => Number.isFinite(value));
}

function sum(values) {
    return values.reduce((acc, value) => acc + value, 0);
}

function roundTo(value, digits = 1) {
    return Number(value).toFixed(digits);
}

function updateStatValue(element, value) {
    if (!element) return;
    element.textContent = value;
}

function resetStatistics() {
    updateStatValue(statReadingsCountEl, '-');
    updateStatValue(statAvgGlucoseEl, '-');
    updateStatValue(statMinGlucoseEl, '-');
    updateStatValue(statMaxGlucoseEl, '-');
    updateStatValue(statStdGlucoseEl, '-');
    updateStatValue(statTirEl, '-');
    updateStatValue(statHypoCountEl, '-');
    updateStatValue(statHyperCountEl, '-');
    updateStatValue(statTotalCarbsEl, '-');
    updateStatValue(statTotalInsulinEl, '-');
}

function renderPeriodStatistics(apiData) {
    if (!apiData) {
        updateStatValue(statsPeriodLabelEl, 'Период: не выбран');
        resetStatistics();
        return;
    }

    const glucoseValues = toNumberArray(apiData.glucose);
    const carbsValues = toNumberArray(apiData.carbs);
    const insulinValues = toNumberArray(apiData.insulin);

    const startDateTime = startDateInput.value && startTimeInput.value ? `${startDateInput.value} ${startTimeInput.value}` : '';
    const endDateTime = endDateInput.value && endTimeInput.value ? `${endDateInput.value} ${endTimeInput.value}` : '';
    const periodText = startDateTime && endDateTime
        ? `Период: ${startDateTime} - ${endDateTime}`
        : 'Период: последние 7 дней (по умолчанию)';
    updateStatValue(statsPeriodLabelEl, periodText);

    if (glucoseValues.length === 0) {
        resetStatistics();
        return;
    }

    const glucoseCount = glucoseValues.length;
    const glucoseSum = sum(glucoseValues);
    const glucoseAvg = glucoseSum / glucoseCount;
    const glucoseMin = Math.min(...glucoseValues);
    const glucoseMax = Math.max(...glucoseValues);
    const variance = glucoseValues.reduce((acc, value) => acc + (value - glucoseAvg) ** 2, 0) / glucoseCount;
    const stdDev = Math.sqrt(variance);

    const inRangeCount = glucoseValues.filter((value) => value >= 3.9 && value <= 10.0).length;
    const hypoCount = glucoseValues.filter((value) => value < 3.9).length;
    const hyperCount = glucoseValues.filter((value) => value > 10.0).length;
    const tir = (inRangeCount / glucoseCount) * 100;

    const totalCarbs = sum(carbsValues);
    const totalInsulin = sum(insulinValues);

    updateStatValue(statReadingsCountEl, String(glucoseCount));
    updateStatValue(statAvgGlucoseEl, `${roundTo(glucoseAvg)} ммоль/л`);
    updateStatValue(statMinGlucoseEl, `${roundTo(glucoseMin)} ммоль/л`);
    updateStatValue(statMaxGlucoseEl, `${roundTo(glucoseMax)} ммоль/л`);
    updateStatValue(statStdGlucoseEl, roundTo(stdDev, 2));
    updateStatValue(statTirEl, `${roundTo(tir, 1)}%`);
    updateStatValue(statHypoCountEl, String(hypoCount));
    updateStatValue(statHyperCountEl, String(hyperCount));
    updateStatValue(statTotalCarbsEl, roundTo(totalCarbs, 1));
    updateStatValue(statTotalInsulinEl, roundTo(totalInsulin, 1));
}

function buildRowMap(points) {
    const map = new Map();
    points.forEach((point) => {
        if (point && point.x !== undefined && point.y !== undefined) {
            map.set(String(point.x), point.y);
        }
    });
    return map;
}

function renderComprehensiveTable(apiData) {
    comprehensiveTableBodyEl.innerHTML = '';
    if (!apiData) return;

    const glucoseMap = buildRowMap(apiData.glucose || []);
    const carbsMap = buildRowMap(apiData.carbs || []);
    const insulinMap = buildRowMap(apiData.insulin || []);

    const timestamps = new Set([
        ...glucoseMap.keys(),
        ...carbsMap.keys(),
        ...insulinMap.keys()
    ]);

    const sortedTimestamps = Array.from(timestamps).sort((a, b) => new Date(a) - new Date(b));

    if (sortedTimestamps.length === 0) {
        comprehensiveTableBodyEl.innerHTML = '<tr><td colspan="4">Нет данных за выбранный период</td></tr>';
        return;
    }

    sortedTimestamps.forEach((timestamp) => {
        const row = document.createElement('tr');
        const glucose = glucoseMap.get(timestamp);
        const carbs = carbsMap.get(timestamp);
        const insulin = insulinMap.get(timestamp);

        row.innerHTML = `
            <td>${formatTimestampForTable(timestamp)}</td>
            <td>${glucose ?? '-'}</td>
            <td>${carbs ?? '-'}</td>
            <td>${insulin ?? '-'}</td>
        `;
        comprehensiveTableBodyEl.appendChild(row);
    });
}

function updateMonitoringViewUI() {
    const isChart = currentMonitoringView === 'chart';
    chartWrapperEl.classList.toggle('hidden', !isChart);
    tableWrapperEl.classList.toggle('hidden', isChart);
    viewChartBtn.classList.toggle('active', isChart);
    viewTableBtn.classList.toggle('active', !isChart);

    if (isChart && glucoseChart) {
        setTimeout(() => glucoseChart.resize(), 0);
    }
}

function renderComprehensiveView() {
    if (!comprehensiveData) return;
    renderComprehensiveChart(comprehensiveData);
    renderComprehensiveTable(comprehensiveData);
    renderPeriodStatistics(comprehensiveData);
    updateMonitoringViewUI();
}

function renderComprehensiveChart(apiData) {
    const theme = getChartThemeConfig();

    if (glucoseChart) glucoseChart.destroy();
    glucoseChart = new Chart(chartCanvas, {
        data: {
            datasets: [
                { type: 'line', label: 'Глюкоза (ммоль/л)', data: apiData.glucose, borderColor: 'rgb(0, 123, 255)', backgroundColor: 'rgba(0, 123, 255, 0.5)', yAxisID: 'yGlucose', tension: 0.5, pointRadius: 2, pointHoverRadius: 5 },
                { type: 'bar', label: 'Углеводы (г)', data: apiData.carbs, backgroundColor: 'rgba(255, 7, 7, 0.5)', borderColor: 'rgb(255, 7, 7)', borderWidth: 2, borderRadius: 5, borderSkipped: false, yAxisID: 'yEvents' },
                { type: 'line', label: 'Инсулин (ЕД)', data: apiData.insulin, borderColor: 'rgba(255, 5, 201, 0.72)', yAxisID: 'yEvents', tension: 0.5 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                decimation: { enabled: true, algorithm: 'lttb', samples: 200, threshold: 500 },
                legend: {
                    labels: {
                        color: theme.textPrimary
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        tooltipFormat: 'dd.MM.yyyy HH:mm',
                        displayFormats: {
                            minute: 'HH:mm',
                            hour: 'HH:mm',
                            day: 'dd.MM HH:mm'
                        }
                    },
                    ticks: {
                        color: theme.textSecondary,
                        callback: (value) => {
                            const date = new Date(value);
                            if (Number.isNaN(date.getTime())) return value;
                            return date.toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false
                            });
                        }
                    },
                    grid: { color: theme.grid }
                },
                yGlucose: {
                    position: 'left',
                    title: { display: true, text: 'Глюкоза (ммоль/л)', color: theme.textPrimary },
                    ticks: { color: theme.textSecondary },
                    grid: { color: theme.grid }
                },
                yEvents: {
                    position: 'right',
                    title: { display: true, text: 'Углеводы (г) / Инсулин (ЕД)', color: theme.textPrimary },
                    ticks: { color: theme.textSecondary },
                    grid: { drawOnChartArea: false, color: theme.grid },
                    beginAtZero: true
                }
            }
        }
    });
    glucoseChart.resize();
}

function renderRecommendations(data) {
    recommendationsListEl.innerHTML = '';
    if (data.recommendations && data.recommendations.length > 0) {
        data.recommendations.forEach(text => {
            const li = document.createElement('li');
            li.textContent = text;
            recommendationsListEl.appendChild(li);
        });
    }
}

function setDiaryMessage(text) {
    if (!patientDiaryBodyEl) return;
    patientDiaryBodyEl.innerHTML = `<tr><td colspan="2">${text}</td></tr>`;
}

function renderPatientDiary(entries) {
    if (!patientDiaryBodyEl) return;
    patientDiaryBodyEl.innerHTML = '';

    if (!entries || entries.length === 0) {
        setDiaryMessage('Нет записей дневника самоконтроля');
        return;
    }

    entries.forEach((entry) => {
        const row = document.createElement('tr');
        const timeCell = document.createElement('td');
        const textCell = document.createElement('td');

        timeCell.textContent = formatTimestampForTable(entry.timestamp);
        textCell.textContent = entry.text || '-';
        textCell.className = 'diary-text-cell';

        row.appendChild(timeCell);
        row.appendChild(textCell);
        patientDiaryBodyEl.appendChild(row);
    });
}

async function loadPatientDiary(patientId) {
    if (!patientDiaryBodyEl) return;
    if (!patientId) {
        setDiaryMessage('Выберите пациента для просмотра дневника.');
        return;
    }

    setDiaryMessage('Загрузка дневника...');
    try {
        const entries = await apiFetch(`/api/patients/${patientId}/diary`);
        renderPatientDiary(entries);
    } catch (error) {
        console.error('Не удалось загрузить дневник пациента:', error);
        setDiaryMessage(`Ошибка загрузки: ${error.message}`);
    }
}

// --- Обработчики событий ---
if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', cycleThemeMode);
    updateThemeToggleLabel();
}
initZoomControls();

updateChartBtn.addEventListener('click', updateComprehensiveChart);
resetChartBtn.addEventListener('click', () => {
    if (currentPatientId) displayPatientDetails(currentPatientId);
});
viewChartBtn.addEventListener('click', () => {
    currentMonitoringView = 'chart';
    updateMonitoringViewUI();
});
viewTableBtn.addEventListener('click', () => {
    currentMonitoringView = 'table';
    updateMonitoringViewUI();
});
lastDayRangeBtn.addEventListener('click', () => {
    setQuickRangeActiveButton(lastDayRangeBtn);
    applyQuickRange('day');
});
lastMonthRangeBtn.addEventListener('click', () => {
    setQuickRangeActiveButton(lastMonthRangeBtn);
    applyQuickRange('month');
});
lastThreeMonthsRangeBtn.addEventListener('click', () => {
    setQuickRangeActiveButton(lastThreeMonthsRangeBtn);
    applyQuickRange('3months');
});
[startDateInput, startTimeInput, endDateInput, endTimeInput].forEach((input) => {
    input.addEventListener('input', () => setQuickRangeActiveButton(null));
});
if (refreshDiaryBtn) {
    refreshDiaryBtn.addEventListener('click', () => {
        if (currentPatientId) {
            loadPatientDiary(currentPatientId);
        }
    });
}

const recommendTextEl = document.getElementById('recommendation-text');
const interpretBtn = document.getElementById('interpret-btn');
const confirmationFormEl = document.getElementById('confirmation-form');
const parsedResultsEl = document.getElementById('parsed-results');

interpretBtn.addEventListener('click', async () => {
    const text = recommendTextEl.value;
    if (!text || !currentPatientId) return;

    try {
        const interpretation = await apiFetch(`/api/recommendations/interpret`, {
            method: 'POST',
            body: JSON.stringify({ text: text })
        });

        // Отображаем форму для верификации
        renderConfirmationForm(interpretation);
        confirmationFormEl.classList.remove('hidden');

    } catch (error) {
        alert(`Ошибка интерпретации: ${error.message}`);
    }
});

function renderConfirmationForm(data) {
    parsedResultsEl.innerHTML = ''; // Очищаем старые результаты

    let htmlContent = '';

    if (data.basal_changes?.length > 0) {
        data.basal_changes.forEach((change, index) => {
            const sign = change.change_percent >= 0 ? '+' : '';
            const typeText = "Базальный Профиль";

            htmlContent += `
                <div class="result-card basal-card" data-type="basal" data-index="${index}">
                    <h5>${typeText}</h5>
                    <label>Временной сегмент:</label>
                    <input type="text" class="time-segment" value="${change.time_segment}">
                    <label>Изменение:</label>
                    <div class="input-group">
                        <input type="number" class="change-percent" value="${change.change_percent}">
                        <span>%</span>
                    </div>
                </div>`;
        });
    }

    if (data.carb_ratio_changes?.length > 0) {
        data.carb_ratio_changes.forEach((change, index) => {
            const typeText = "Углеводный Коэффициент (УК)";

            htmlContent += `
                <div class="result-card carb-card" data-type="carb" data-index="${index}">
                    <h5>${typeText}</h5>
                    <label>Прием пищи:</label>
                    <input type="text" class="meal-time" value="${change.meal_time}">
                    <label>Грамм на 1 ЕД:</label>
                    <div class="input-group">
                        <span>1 : </span>
                        <input type="number" class="carb-value" value="${change.value}">
                    </div>
                </div>`;
        });
    }

    parsedResultsEl.innerHTML = htmlContent;
    if (htmlContent === '') {
        parsedResultsEl.innerHTML = `<p class="no-results">Не удалось извлечь параметры. Попробуйте более точную формулировку.</p>`;
    }
}

// ... (В конце файла) ...

// --- ЛОГИКА СИМУЛЯТОРА ---
function getSelectedScenario() {
    const selectedIdRaw = simScenarioSelectEl.value;
    if (!selectedIdRaw) return null;
    if (selectedIdRaw === 'new') return null;
    const selectedId = Number(selectedIdRaw);
    return simulatorScenarios.find((s) => Number(s.scenario_id) === selectedId) || null;
}

function renderScenarioSelect() {
    simScenarioSelectEl.innerHTML = '';
    simulatorScenarios.forEach((scenario, index) => {
        const option = document.createElement('option');
        option.value = String(scenario.scenario_id);
        option.textContent = `Сценарий #${scenario.scenario_id ?? index + 1}`;
        simScenarioSelectEl.appendChild(option);
    });
}

function drawSimulationChart(time, glucose) {
    if (!simChartCanvas) return;
    const labels = time.map((t) => Number(t));
    const data = glucose.map((v) => Number(v));
    if (simChart) simChart.destroy();

    simChart = new Chart(simChartCanvas.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Глюкоза (ммоль/л)',
                    data,
                    borderWidth: 2,
                    pointRadius: 1,
                    borderColor: '#2e8b57'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'Время, мин' } },
                y: { title: { display: true, text: 'Глюкоза' } }
            }
        }
    });
}

function resetSimulationStatistics() {
    updateStatValue(simStatsPeriodLabelEl, 'Симуляция не запускалась');
    updateStatValue(simStatAvgEl, '-');
    updateStatValue(simStatMinEl, '-');
    updateStatValue(simStatMaxEl, '-');
    updateStatValue(simStatTirEl, '-');
}

function normalizeSimulationGlucose(values) {
    if (!Array.isArray(values)) return [];
    const numeric = values.map(Number).filter(Number.isFinite);
    if (numeric.length === 0) return [];

    // Backward compatibility: old API may return glucose in mg/dL.
    const looksLikeMgDl = numeric.some((v) => v > 40);
    return looksLikeMgDl ? numeric.map((v) => v / 18) : numeric;
}

function normalizeSimulationMetrics(metrics) {
    if (!metrics || typeof metrics !== 'object') return metrics;
    const normalized = { ...metrics };
    const average = Number(normalized.average);
    const looksLikeMgDl = Number.isFinite(average) && average > 40;
    if (!looksLikeMgDl) return normalized;

    ['average', 'average_before_meals', 'average_after_meals', 'min', 'max', 'min_with_30min_meal_delay', 'integral_above_180']
        .forEach((key) => {
            const value = Number(normalized[key]);
            if (Number.isFinite(value)) normalized[key] = value / 18;
        });

    return normalized;
}

function computeTirFromGlucoseMmol(glucoseMmol) {
    if (!Array.isArray(glucoseMmol)) return null;
    const values = glucoseMmol.map(Number).filter(Number.isFinite);
    if (values.length === 0) return null;
    return values.filter((v) => v >= 3.9 && v <= 10.0).length / values.length;
}

function renderSimulationStatistics(metrics, glucoseMmol = []) {
    const safeMetrics = normalizeSimulationMetrics(metrics);
    const tirFromSeries = computeTirFromGlucoseMmol(glucoseMmol);
    updateStatValue(simStatsPeriodLabelEl, 'Симуляция выполнена');
    if (!safeMetrics) {
        updateStatValue(simStatAvgEl, '-');
        updateStatValue(simStatMinEl, '-');
        updateStatValue(simStatMaxEl, '-');
        updateStatValue(simStatTirEl, '-');
        return;
    }

    updateStatValue(
        simStatAvgEl,
        Number.isFinite(Number(safeMetrics.average)) ? `${roundTo(Number(safeMetrics.average), 2)} ммоль/л` : '-'
    );
    updateStatValue(
        simStatMinEl,
        Number.isFinite(Number(safeMetrics.min)) ? `${roundTo(Number(safeMetrics.min), 2)} ммоль/л` : '-'
    );
    updateStatValue(
        simStatMaxEl,
        Number.isFinite(Number(safeMetrics.max)) ? `${roundTo(Number(safeMetrics.max), 2)} ммоль/л` : '-'
    );
    updateStatValue(
        simStatTirEl,
        Number.isFinite(Number(tirFromSeries))
            ? `${roundTo(Number(tirFromSeries) * 100, 1)}%`
            : Number.isFinite(Number(safeMetrics.fraction_within_target))
            ? `${roundTo(Number(safeMetrics.fraction_within_target) * 100, 1)}%`
            : '-'
    );
}

async function loadSimulatorConfig(patientId) {
    simParamsCodeEl.value = 'Загрузка параметров...';
    simScenarioCodeEl.value = 'Загрузка сценариев...';
    try {
        const payload = await apiFetch(`/api/simulator/patients/${patientId}/config`);
        simParamsCodeEl.value = JSON.stringify(payload.parameters, null, 2);

        simulatorScenarios = payload.scenarios || [];
        if (simulatorScenarios.length === 0) {
            simulatorScenarios = [{ scenario_id: null, scenario_data: {} }];
        }
        renderScenarioSelect();
        simScenarioSelectEl.value = String(simulatorScenarios[0].scenario_id ?? '');
        simScenarioCodeEl.value = JSON.stringify(simulatorScenarios[0].scenario_data, null, 2);
    } catch (error) {
        console.error('Failed to load simulator config:', error);
        simParamsCodeEl.value = `Ошибка загрузки: ${error.message}`;
        simScenarioCodeEl.value = `Ошибка загрузки: ${error.message}`;
    }
}

simScenarioSelectEl?.addEventListener('change', () => {
    const selected = getSelectedScenario();
    if (!selected) return;
    simScenarioCodeEl.value = JSON.stringify(selected.scenario_data, null, 2);
});

simNewScenarioBtn?.addEventListener('click', () => {
    simScenarioCodeEl.value = JSON.stringify(
        {
            M: 90,
            tm: 60,
            Tm: 20,
            t0: 0,
            t1: 720,
            ti_1: 30,
            ti_2: 60,
            Ti_1: 10,
            Ti_2: 10,
            Dbol_1: 2.6,
            Dbol_2: 4.0,
            Vbas: 1.22
        },
        null,
        2
    );
    simScenarioSelectEl.value = '';
});

simSaveParamsBtn?.addEventListener('click', async () => {
    if (!currentPatientId) return;
    try {
        const parsed = JSON.parse(simParamsCodeEl.value);
        await apiFetch(`/api/simulator/patients/${currentPatientId}/parameters`, {
            method: 'PUT',
            body: JSON.stringify({ parameters: parsed })
        });
        alert('Параметры симуляции сохранены');
    } catch (error) {
        alert(`Не удалось сохранить параметры: ${error.message}`);
    }
});

simSaveScenarioBtn?.addEventListener('click', async () => {
    if (!currentPatientId) return;
    try {
        const parsed = JSON.parse(simScenarioCodeEl.value);
        const selected = getSelectedScenario();
        if (selected && selected.scenario_id != null) {
            await apiFetch(`/api/simulator/patients/${currentPatientId}/scenarios/${selected.scenario_id}`, {
                method: 'PUT',
                body: JSON.stringify({ scenario_data: parsed })
            });
        } else {
            await apiFetch(`/api/simulator/patients/${currentPatientId}/scenarios`, {
                method: 'POST',
                body: JSON.stringify({ scenario_data: parsed })
            });
        }
        await loadSimulatorConfig(currentPatientId);
        alert('Сценарий симуляции сохранен');
    } catch (error) {
        alert(`Не удалось сохранить сценарий: ${error.message}`);
    }
});

simRunBtn?.addEventListener('click', async () => {
    if (!currentPatientId) return;
    try {
        const parameters = JSON.parse(simParamsCodeEl.value);
        const scenario_data = JSON.parse(simScenarioCodeEl.value);
        const model_type = simModelTypeEl?.value || 'sibr';
        const cgm_noise_seed = simCgmSeedEl?.value !== '' ? Number(simCgmSeedEl.value) : null;
        const result = await apiFetch(`/api/simulator/patients/${currentPatientId}/run`, {
            method: 'POST',
            body: JSON.stringify({ parameters, scenario_data, model_type, cgm_noise_seed })
        });
        const glucoseForChart = Array.isArray(result.glucose_mmol) && result.glucose_mmol.length > 0
            ? result.glucose_mmol
            : normalizeSimulationGlucose(result.glucose || []);
        drawSimulationChart(result.time || [], glucoseForChart);
        renderSimulationStatistics(result.metrics, glucoseForChart);
    } catch (error) {
        alert(`Ошибка симуляции: ${error.message}`);
    }
});

// --- ЛОГИКА ПЕРЕКЛЮЧЕНИЯ ВКЛАДОК ---
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

function switchTab(tabId) {
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(ct => ct.classList.remove('visible'));

    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('visible');

    if (tabId === 'monitoring' && glucoseChart) {
        setTimeout(() => glucoseChart.resize(), 50);
    }

    if (tabId === 'patient-sim' && currentPatientId) {
        loadSimulatorConfig(currentPatientId);
        if (simChart) {
            setTimeout(() => simChart.resize(), 50);
        }
    }
    if (tabId === 'patient-diary' && currentPatientId) {
        loadPatientDiary(currentPatientId);
    }
}

tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        switchTab(tabId);
    });
});

// Стартовое состояние
switchTab('monitoring');
resetSimulationStatistics();


window.addEventListener('app-theme-changed', () => {
    updateThemeToggleLabel();
    if (!comprehensiveData) return;
    renderComprehensiveChart(comprehensiveData);
});
