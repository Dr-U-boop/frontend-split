# Flutter Frontend (Material 3)

Отдельная Flutter-реализация фронтенда приложения с сохранением текущей логики API:

- авторизация `/api/auth/login`, проверка сессии `/api/auth/me`
- список пациентов `/api/patients/`
- мониторинг `/api/patients/{id}/comprehensive_data`
- рекомендации `/api/patients/{id}/recommendations`, `/api/recommendations/interpret`
- дневник `/api/patients/{id}/diary`
- симулятор `/api/simulator/patients/{id}/*`

## Запуск

1. Установите Flutter SDK.
2. Инициализируйте платформенные папки (если их ещё нет):

```bash
flutter create .
```

3. В этой папке выполните:

```bash
flutter pub get
flutter run -d macos --dart-define=API_BASE_URL=http://127.0.0.1:8000
```

Можно использовать `windows`, `linux`, `chrome` или другой доступный target.

## Конфигурация API

`API_BASE_URL` передаётся через `--dart-define`.
По умолчанию используется `http://127.0.0.1:8000`.
