(function (globalScope) {
    const recommendationMockData = [
        {
            recommendation_type: 'temp_basal_percent',
            text: 'Снизить временный базал ночью',
            value: -20,
            unit: '%',
            time_start: '20:00',
            time_end: '06:00',
            condition: 'вечерняя физическая нагрузка',
            confidence: 0.88
        },
        {
            recommendation_type: 'carb_ratio',
            text: 'Ослабить УК утром',
            value: 9,
            unit: 'г/Ед',
            time_start: '06:00',
            time_end: '11:00'
        },
        {
            recommendation_type: 'correction_factor',
            text: 'Коррекция в ранние часы',
            value: 2.2,
            unit: 'ммоль/л на Ед',
            time_start: '00:00',
            time_end: '06:00'
        },
        {
            recommendation_type: 'target_glucose',
            text: 'Целевая глюкоза ночью',
            value: 6.0,
            unit: 'ммоль/л',
            time_start: '22:00',
            time_end: '06:00'
        },
        {
            recommendation_type: 'target_range',
            text: 'Целевой диапазон днем',
            value_min: 5.5,
            value_max: 7.0,
            unit: 'ммоль/л',
            time_start: '06:00',
            time_end: '23:00'
        },
        {
            recommendation_type: 'prebolus_time',
            text: 'Предболюс перед завтраком',
            value: 15,
            unit: 'мин',
            time_start: '06:00',
            time_end: '10:00'
        },
        {
            recommendation_type: 'active_insulin_time',
            text: 'DIA',
            value: 4,
            unit: 'ч'
        },
        {
            recommendation_type: 'correction_interval',
            text: 'Пауза между коррекциями',
            value: 3,
            unit: 'ч'
        },
        {
            recommendation_type: 'low_glucose_alert_threshold',
            text: 'Порог предупреждения low',
            value: 4.4,
            unit: 'ммоль/л',
            time_start: '00:00',
            time_end: '06:00'
        },
        {
            recommendation_type: 'high_glucose_alert_threshold',
            text: 'Порог предупреждения high',
            value: 10,
            unit: 'ммоль/л',
            time_start: '06:00',
            time_end: '23:00'
        },
        {
            recommendation_type: 'dual_bolus_split',
            text: 'Комбинированный болюс на жирный ужин',
            immediate_percent: 60,
            extended_percent: 40,
            duration: 2,
            duration_unit: 'ч',
            time_start: '18:00',
            time_end: '22:00'
        },
        {
            recommendation_type: 'unknown_custom_type',
            text: 'Кастомная рекомендация без форматтера'
        }
    ];

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = recommendationMockData;
    }

    globalScope.recommendationMockData = recommendationMockData;
})(typeof window !== 'undefined' ? window : globalThis);
