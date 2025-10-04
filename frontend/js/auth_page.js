// frontend/script.js

const loginForm = document.getElementById('login-form');
const messageDiv = document.getElementById('message');

// --- ИЗМЕНЕНИЕ ЗДЕСЬ ---
// Ждем сигнала от main.js, что бэкенд запущен
window.electronAPI.onBackendReady(async () => {
    console.log("Получен сигнал 'backend-ready'. Проверяем токен...");
    const savedToken = localStorage.getItem('accessToken');

    if (savedToken) {
        messageDiv.textContent = 'Проверка сессии...';
        try {
            const response = await fetch('http://127.0.0.1:8000/api/auth/me', {
                headers: { 'Authorization': `Bearer ${savedToken}` }
            });

            if (response.ok) {
                const userData = await response.json();
                console.log(`Автоматический вход для ${userData.full_name}`);
                window.electronAPI.loginSuccess(savedToken);
            } else {
                localStorage.removeItem('accessToken');
                messageDiv.textContent = '';
            }
        } catch (error) {
            console.error("Ошибка при проверке токена:", error);
            // Эта ошибка теперь будет появляться только если сервер действительно упал
            messageDiv.textContent = 'Сервер недоступен.'; 
            messageDiv.className = 'message error';
        }
    }
});

// --- 2. ОБРАБОТКА РУЧНОГО ВХОДА ---
loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = event.target.username.value;
    const password = event.target.password.value;
    const rememberMe = event.target['remember-me'].checked;

    try {
        const response = await fetch('http://127.0.0.1:8000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (response.ok) {
            const token = data.access_token;
            
            // --- 3. СОХРАНЕНИЕ ТОКЕНА ---
            if (rememberMe) {
                // Если "Запомнить меня" - сохраняем в localStorage
                localStorage.setItem('accessToken', token);
                console.log("Токен сохранен в localStorage.");
            } else {
                // Иначе - удаляем, чтобы сессия была временной
                localStorage.removeItem('accessToken');
            }

            messageDiv.textContent = `Добро пожаловать! Переходим на панель управления...`;
            messageDiv.className = 'message success';
            window.electronAPI.loginSuccess(token);

        } else {
            messageDiv.textContent = data.detail || 'Произошла ошибка';
            messageDiv.className = 'message error';
        }
    } catch (error) {
        messageDiv.textContent = 'Не удалось подключиться к серверу.';
        messageDiv.className = 'message error';
        console.error('Fetch error:', error);
    }
});