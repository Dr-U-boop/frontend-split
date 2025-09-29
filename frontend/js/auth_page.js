document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault(); // Предотвращаем перезагрузку страницы

    const username = event.target.username.value;
    const password = event.target.password.value;
    const messageDiv = document.getElementById('message');

    try {
        const response = await fetch('http://127.0.0.1:8000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (response.ok) {
            messageDiv.textContent = `Добро пожаловать, ${data.user_full_name}!`;
            messageDiv.className = 'message success';
           // Отправляем полученный токен главному процессу
            window.electronAPI.loginSuccess(data.access_token);

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