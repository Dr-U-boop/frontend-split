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

    if (method === 'POST' && bodyText) {
        try {
            // Проверяем, что в поле body валидный JSON
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
        
        // Красиво форматируем JSON для вывода
        responseDiv.textContent = JSON.stringify(data, null, 2);

    } catch (error) {
        responseDiv.textContent = `Ошибка сети: ${error.message}`;
        console.error('Fetch error:', error);
    }
});