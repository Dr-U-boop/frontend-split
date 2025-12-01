let currentToken = null;
let currentPatientId = null;
let patients = [];
let glucoseChart = null;

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
const patientSearchInput = document.getElementById('patient-search');
const resizer = document.getElementById('sidebar-resizer');

// --- КОНСТАНТЫ ---
const SIDEBAR_WIDTH_KEY = 'sidebarWidth';
const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 600;
const DEFAULT_SIDEBAR_WIDTH = 280;

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
    const response = await fetch(`http://127.0.0.1:8000${endpoint}`, { ...defaultOptions, ...options });
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

    patientsArray.forEach(patient => {
        const li = document.createElement('li');
        li.className = 'patient-item';
        // Если этот пациент сейчас выбран, добавляем класс active
        if (patient.id === currentPatientId) {
            li.classList.add('active');
        }
        
        li.dataset.patientId = patient.id;
        const statusClass = Math.random() > 0.3 ? 'status-ok' : 'status-attention';
        
        // Форматируем дату для отображения (опционально)
        // const dob = new Date(patient.date_of_birth).toLocaleDateString('ru-RU');

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
            // Если экран маленький (мобильный), можно автоматически скрывать меню при выборе
            // dashboardContainer.classList.add('sidebar-collapsed'); 
            displayPatientDetails(patient.id);
        });
        patientsListEl.appendChild(li);
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
        
        renderComprehensiveChart(chartData);
        renderRecommendations(recommendationsData);
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
        const chartData = await apiFetch(endpoint);
        renderComprehensiveChart(chartData);
    } catch (error) { console.error("Не удалось обновить график:", error); }
}

function renderComprehensiveChart(apiData) {
    if (glucoseChart) glucoseChart.destroy();
    glucoseChart = new Chart(chartCanvas, {
        type: 'bar',
        data: {
            datasets: [
                { type: 'line', label: 'Глюкоза (ммоль/л)', data: apiData.glucose, borderColor: 'rgb(0, 123, 255)', backgroundColor: 'rgba(0, 123, 255, 0.5)', yAxisID: 'yGlucose', tension: 0.2, pointRadius: 1 },
                { type: 'line', label: 'Углеводы (г)', data: apiData.carbs, backgroundColor: 'rgba(255, 7, 7, 0.7)', yAxisID: 'yEvents' },
                { type: 'line', label: 'Инсулин (ЕД)', data: apiData.insulin, backgroundColor: 'rgba(255, 5, 201, 1)', yAxisID: 'yEvents' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { decimation: { enabled: true, algorithm: 'lttb', samples: 200, threshold: 500 } },
            scales: {
                x: { type: 'time', time: { tooltipFormat: 'dd.MM.yyyy HH:mm' } },
                yGlucose: { position: 'left', title: { display: true, text: 'Глюкоза (ммоль/л)' } },
                yEvents: { position: 'right', title: { display: true, text: 'Углеводы (г) / Инсулин (ЕД)' }, grid: { drawOnChartArea: false }, beginAtZero: true }
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

// --- Обработчики событий ---
updateChartBtn.addEventListener('click', updateComprehensiveChart);
resetChartBtn.addEventListener('click', () => {
    if (currentPatientId) displayPatientDetails(currentPatientId);
});

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

// --- ЛОГИКА ПЕРЕКЛЮЧЕНИЯ ВКЛАДОК ---
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        // 1. Убираем класс active у всех кнопок и контента
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        // 2. Добавляем класс active нажатой кнопке
        button.classList.add('active');

        // 3. Находим соответствующий контент по data-tab и показываем его
        const tabId = button.getAttribute('data-tab');
        const contentToShow = document.getElementById(`tab-${tabId}`);
        if (contentToShow) {
            contentToShow.classList.add('active');
        }
        
        // 4. ВАЖНО: Если переключились на вкладку с графиком, обновляем его размер
        // Chart.js может некорректно отображаться, если он был в display:none
        if (tabId === 'monitoring' && glucoseChart) {
            setTimeout(() => {
                glucoseChart.resize();
            }, 10); // Небольшая задержка для завершения рендеринга CSS
        }
    });
});