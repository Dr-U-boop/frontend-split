let currentToken = null;

// --- ПРИНИМАЕМ ТОКЕН ОТ ГЛАВНОГО ПРОЦЕССА ---
// Эта функция будет вызвана, когда main.js пришлет токен
window.electronAPI.handleToken((token) => {
    console.log("Токен получен от главного процесса:", token);
    currentToken = token;
    sessionStorage.setItem('accessToken', currentToken);
    
    // Опционально: можно вывести приветствие или обновить UI
    const welcomeMessage = document.getElementById('welcome-message'); // Предполагается, что у вас есть элемент с таким id
    if(welcomeMessage) {
        welcomeMessage.textContent = "Токен успешно получен. Готов к работе!";
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

    } catch (error) {
        responseDiv.textContent = `Ошибка сети: ${error.message}`;
        console.error('Fetch error:', error);
    }
});

document.querySelectorAll('.template-btn').forEach(button => {
    button.addEventListener('click', () => {
        const form = document.getElementById('api-form');
        form.method.value = button.dataset.method;
        form.endpoint.value = button.dataset.endpoint;
        form.body.value = button.dataset.body ? JSON.stringify(JSON.parse(button.dataset.body), null, 2) : '';
    });
});
