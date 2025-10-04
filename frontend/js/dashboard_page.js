// Глобальные переменные для хранения состояния
let currentToken = null;
let patients = [];
let glucoseChart = null;

// --- Получение ссылок на DOM-элементы ---
const patientsListEl = document.getElementById('patients-list');
const patientDetailsEl = document.getElementById('patient-details');
const patientNameEl = document.getElementById('patient-name');
const chartCanvas = document.getElementById('glucose-chart').getContext('2d');
const apiForm = document.getElementById('api-form');
const responseDiv = document.getElementById('response');

// --- Инициализация страницы ---

// 1. Получаем токен от главного процесса Electron
window.electronAPI.handleToken((token) => {
    console.log("Токен получен от главного процесса:", token);
    currentToken = token;
    sessionStorage.setItem('accessToken', currentToken);
    
    // 2. После получения токена загружаем список пациентов
    fetchAndRenderPatients();
});

// --- Основные функции ---

/**
 * Обертка для fetch, автоматически добавляющая токен авторизации.
 * @param {string} endpoint - API эндпоинт (например, '/api/patients/')
 * @param {object} options - Опции для fetch (method, body, etc.)
 * @returns {Promise<any>} - JSON-ответ от сервера
 */
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

/**
 * Загружает список пациентов с сервера и отображает его в боковой панели.
 */
async function fetchAndRenderPatients() {
    try {
        patients = await apiFetch('/api/patients/');
        patientsListEl.innerHTML = ''; // Очищаем старый список
        patients.forEach(patient => {
            const li = document.createElement('li');
            li.className = 'patient-item';
            li.dataset.patientId = patient.id;
            const statusClass = Math.random() > 0.3 ? 'status-ok' : 'status-attention'; // Демо-статус
            li.innerHTML = `<div class="status-indicator ${statusClass}"></div><span>${patient.full_name}</span>`;
            
            li.addEventListener('click', () => {
                document.querySelectorAll('.patient-item').forEach(item => item.classList.remove('active'));
                li.classList.add('active');
                displayPatientDetails(patient.id);
            });
            patientsListEl.appendChild(li);
        });
    } catch (error) {
        console.error("Не удалось загрузить пациентов:", error);
    }
}

/**
 * Отображает детальную информацию о выбранном пациенте.
 * @param {number} patientId - ID пациента
 */
async function displayPatientDetails(patientId) {
    try {
        const patient = await apiFetch(`/api/patients/${patientId}`);
        patientDetailsEl.classList.remove('hidden');
        patientNameEl.textContent = patient.full_name;
        
        const glucoseData = await apiFetch(`/api/patients/${patientId}/glucose_data`);
        renderGlucoseChart(glucoseData);
    } catch (error) {
        console.error("Не удалось загрузить данные пациента:", error);
    }
}

/**
 * Рендерит график уровня глюкозы с помощью Chart.js.
 * @param {object} glucoseData - Объект с полями { labels: [], data: [] }
 */
function renderGlucoseChart(glucoseData) {
    if (!glucoseData || !glucoseData.labels || !glucoseData.data) return;
    const data = {
        labels: glucoseData.labels,
        datasets: [{
            label: 'Уровень глюкозы (ммоль/л)',
            backgroundColor: 'rgba(0, 123, 255, 0.5)',
            borderColor: 'rgb(0, 123, 255)',
            data: glucoseData.data,
            tension: 0.2,
            pointRadius: 2,
        }]
    };
    if (glucoseChart) glucoseChart.destroy();
    glucoseChart = new Chart(chartCanvas, {
        type: 'line',
        data: data,
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// --- Логика панели тестирования API ---

// Обработчик отправки формы
apiForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const method = event.target.method.value;
    const endpoint = event.target.endpoint.value;
    const bodyText = event.target.body.value;
    
    const requestOptions = { method };
    if (['POST', 'PUT'].includes(method) && bodyText) {
        try {
            JSON.parse(bodyText); // Проверка на валидность JSON
            requestOptions.body = bodyText;
        } catch (error) {
            responseDiv.textContent = `Ошибка в JSON: ${error.message}`;
            return;
        }
    }
    try {
        const data = await apiFetch(endpoint, requestOptions);
        responseDiv.textContent = JSON.stringify(data, null, 2);
    } catch (error) {
        responseDiv.textContent = `Ошибка: ${error.message}`;
    }
});

// Обработчики для кнопок-шаблонов
document.querySelectorAll('.template-btn').forEach(button => {
    button.addEventListener('click', () => {
        apiForm.method.value = button.dataset.method;
        apiForm.endpoint.value = button.dataset.endpoint;
        apiForm.body.value = button.dataset.body ? JSON.stringify(JSON.parse(button.dataset.body), null, 2) : '';
    });
});