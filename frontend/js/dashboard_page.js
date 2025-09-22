// Переменная для хранения токена в сессии
let currentToken = null;

// --- Сохраняем токен после успешного логина ---
// Эта часть кода симулирует получение токена после первого входа
// В реальном приложении токен придет со страницы логина
window.addEventListener('DOMContentLoaded', () => {
    // Попробуем получить токен из sessionStorage, если он там был сохранен
    currentToken = sessionStorage.getItem('accessToken');
    if(currentToken) {
        console.log("Токен загружен из сессии.");
    }
});


document.getElementById('api-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const method = event.target.method.value;
    const endpoint = event.target.endpoint.value;
    const bodyText = event.target.body.value;
    const responseDiv = document.getElementById('response');
    
    const requestOptions = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
        },
    };

    // --- ДОБАВЛЕНИЕ ТОКЕНА В ЗАГОЛОВОК ---
    // Если токен есть, добавляем его в заголовки Authorization
    if (currentToken) {
        requestOptions.headers['Authorization'] = `Bearer ${currentToken}`;
    }

    if (method === 'POST' && bodyText) {
        try {
            JSON.parse(bodyText);
            requestOptions.body = bodyText;
        } catch (error) {
            responseDiv.textContent = `Ошибка в JSON: ${error.message}`;
            return;
        }
    }

    try {
        const response = await fetch(`http://127.0.0.1:8000${endpoint}`, requestOptions);
        const data = await response.json();
        
        responseDiv.textContent = JSON.stringify(data, null, 2);

        // --- ЗАПОМИНАЕМ ТОКЕН ПОСЛЕ АВТОРИЗАЦИИ ---
        // Если это был эндпоинт входа и мы получили токен, сохраняем его
        if (endpoint === '/api/auth/login' && data.access_token) {
            currentToken = data.access_token;
            // Сохраняем токен в sessionStorage, чтобы он не терялся при перезагрузке
            sessionStorage.setItem('accessToken', currentToken);
            console.log("Новый токен получен и сохранен!");
        }

    } catch (error) {
        responseDiv.textContent = `Ошибка сети: ${error.message}`;
        console.error('Fetch error:', error);
    }
});