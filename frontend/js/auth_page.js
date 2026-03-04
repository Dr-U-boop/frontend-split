// frontend/script.js

const loginForm = document.getElementById('login-form');
const messageDiv = document.getElementById('message');
const API_BASE_URL = window.electronAPI.getApiBaseUrl();
const ACCESS_TOKEN_KEY = 'accessToken';

function persistAccessToken(token, rememberMe) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token);

    if (rememberMe) {
        localStorage.setItem(ACCESS_TOKEN_KEY, token);
        return;
    }

    localStorage.removeItem(ACCESS_TOKEN_KEY);
}

window.electronAPI.onBackendReady(async () => {
    const savedToken = localStorage.getItem(ACCESS_TOKEN_KEY);

    if (savedToken) {
        messageDiv.textContent = 'Проверка сессии...';
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${savedToken}` }
            });

            if (response.ok) {
                await response.json();
                sessionStorage.setItem(ACCESS_TOKEN_KEY, savedToken);
                window.electronAPI.loginSuccess(savedToken);
            } else {
                sessionStorage.removeItem(ACCESS_TOKEN_KEY);
                localStorage.removeItem(ACCESS_TOKEN_KEY);
                messageDiv.textContent = '';
            }
        } catch (error) {
            messageDiv.textContent = 'Сервер недоступен.';
            messageDiv.className = 'message error';
        }
    }
});

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = event.target.username.value;
    const password = event.target.password.value;
    const rememberMe = event.target['remember-me'].checked;

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (response.ok) {
            const token = data.access_token;
            persistAccessToken(token, rememberMe);

            messageDiv.textContent = 'Добро пожаловать! Переходим на панель управления...';
            messageDiv.className = 'message success';
            window.electronAPI.loginSuccess(token);
        } else {
            messageDiv.textContent = data.detail || 'Произошла ошибка';
            messageDiv.className = 'message error';
        }
    } catch (error) {
        messageDiv.textContent = 'Не удалось подключиться к серверу.';
        messageDiv.className = 'message error';
    }
});
