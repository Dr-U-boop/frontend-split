(function (globalScope) {
    const TYPE_ALIASES = {
        basal: 'temp_basal_percent',
        basal_change: 'temp_basal_percent',
        temp_basal: 'temp_basal_percent',
        temp_basal_percent: 'temp_basal_percent',
        basal_rate: 'basal_rate',
        carb: 'carb_ratio',
        carb_ratio: 'carb_ratio'
    };

    const TITLE_BY_TYPE = {
        temp_basal_percent: 'Базальный инсулин',
        basal_rate: 'Базальная скорость',
        carb_ratio: 'Углеводный коэффициент',
        correction_factor: 'Фактор чувствительности',
        target_glucose: 'Целевая глюкоза',
        target_range: 'Целевой диапазон',
        prebolus_time: 'Предболюс',
        active_insulin_time: 'Активный инсулин',
        correction_interval: 'Интервал коррекции',
        low_glucose_alert_threshold: 'Порог низкой глюкозы',
        high_glucose_alert_threshold: 'Порог высокой глюкозы',
        dual_bolus_split: 'Комбинированный болюс'
    };

    function isFiniteNumber(value) {
        return Number.isFinite(Number(value));
    }

    function normalizeNumber(value, digits) {
        if (!isFiniteNumber(value)) return null;
        const num = Number(value);
        if (!isFiniteNumber(digits)) return num;
        return Number(num.toFixed(Number(digits)));
    }

    function formatNumber(value, digits) {
        const normalized = normalizeNumber(value, digits);
        if (normalized === null) return '';
        if (Number.isInteger(normalized)) return String(normalized);
        return String(normalized);
    }

    function formatFixed(value, digits) {
        if (!isFiniteNumber(value)) return '';
        return Number(value).toFixed(Number(digits));
    }

    function normalizeType(type) {
        if (!type) return 'unknown';
        const raw = String(type).trim().toLowerCase();
        return TYPE_ALIASES[raw] || raw;
    }

    function formatTimeValue(rawValue) {
        if (!rawValue) return null;
        const value = String(rawValue).trim();
        const match = value.match(/^(\d{1,2}):(\d{1,2})/);
        if (!match) return null;

        const hour = Number(match[1]);
        const minute = Number(match[2]);
        if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            return null;
        }

        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }

    function parseTimeRange(rawRange) {
        if (!rawRange || typeof rawRange !== 'string') return null;
        const parts = rawRange.split(/\s*(?:-|–|—|to|до)\s*/i).map((part) => part.trim()).filter(Boolean);
        if (parts.length !== 2) return null;
        const start = formatTimeValue(parts[0]);
        const end = formatTimeValue(parts[1]);
        if (!start || !end) return null;
        return { time_start: start, time_end: end };
    }

    function formatTimeRange(timeStart, timeEnd) {
        const start = formatTimeValue(timeStart);
        const end = formatTimeValue(timeEnd);
        if (start && end) return `${start}–${end}`;
        if (start) return `С ${start}`;
        if (end) return `До ${end}`;
        return '';
    }

    function formatCondition(condition) {
        if (!condition) return '';
        const text = String(condition).trim();
        if (!text) return '';
        return `Условие: ${text}`;
    }

    function formatConfidence(confidence) {
        if (!isFiniteNumber(confidence)) return '';
        const raw = Number(confidence);
        const percent = raw <= 1 ? raw * 100 : raw;
        const bounded = Math.max(0, Math.min(100, percent));
        return `Уверенность: ${formatNumber(bounded, 0)}%`;
    }

    function makeFallbackText(rawRecommendation) {
        if (!rawRecommendation || typeof rawRecommendation !== 'object') return '';
        if (rawRecommendation.text) return String(rawRecommendation.text);
        if (rawRecommendation.value !== undefined && rawRecommendation.value !== null) return String(rawRecommendation.value);
        return '';
    }

    function createStableId(rec, index) {
        const type = normalizeType(rec.recommendation_type || rec.type || 'unknown');
        const rawId = rec.id || `${type}-${rec.time_start || rec.time_segment || rec.meal_time || 'na'}-${rec.value || rec.change_percent || rec.text || ''}-${index}`;
        return String(rawId);
    }

    function normalizeLegacyBasalChange(change, index) {
        const parsedRange = parseTimeRange(change.time_segment || '');
        return {
            id: change.id || `legacy-basal-${index}`,
            recommendation_type: 'temp_basal_percent',
            text: change.text || '',
            value: isFiniteNumber(change.change_percent) ? Number(change.change_percent) : change.change_percent,
            unit: '%',
            time_start: parsedRange ? parsedRange.time_start : null,
            time_end: parsedRange ? parsedRange.time_end : null,
            schedule_hint: change.time_segment || null,
            condition: change.condition || null,
            confidence: change.confidence
        };
    }

    function normalizeLegacyCarbRatioChange(change, index) {
        const parsedRange = parseTimeRange(change.meal_time || '');
        return {
            id: change.id || `legacy-carb-${index}`,
            recommendation_type: 'carb_ratio',
            text: change.text || '',
            value: isFiniteNumber(change.value) ? Number(change.value) : change.value,
            unit: change.unit || 'г/Ед',
            time_start: parsedRange ? parsedRange.time_start : null,
            time_end: parsedRange ? parsedRange.time_end : null,
            schedule_hint: change.meal_time || null,
            condition: change.condition || null,
            confidence: change.confidence
        };
    }

    function normalizeRecommendation(rawRecommendation, index) {
        if (typeof rawRecommendation === 'string') {
            return {
                id: `string-${index}`,
                recommendation_type: 'free_text',
                text: rawRecommendation
            };
        }

        if (!rawRecommendation || typeof rawRecommendation !== 'object') return null;

        const normalizedType = normalizeType(rawRecommendation.recommendation_type || rawRecommendation.type || rawRecommendation.kind);

        if (normalizedType === 'basal' || normalizedType === 'temp_basal') {
            return normalizeLegacyBasalChange(rawRecommendation, index);
        }

        return {
            ...rawRecommendation,
            id: rawRecommendation.id || null,
            recommendation_type: normalizedType
        };
    }

    function normalizeInterpretationPayload(payload) {
        if (!payload) return [];

        if (Array.isArray(payload)) {
            return payload.map((item, index) => normalizeRecommendation(item, index)).filter(Boolean);
        }

        const normalized = [];

        if (Array.isArray(payload.recommendations)) {
            payload.recommendations.forEach((item, index) => {
                const normalizedItem = normalizeRecommendation(item, index);
                if (normalizedItem) normalized.push(normalizedItem);
            });
        }

        if (Array.isArray(payload.items)) {
            payload.items.forEach((item, index) => {
                const normalizedItem = normalizeRecommendation(item, index);
                if (normalizedItem) normalized.push(normalizedItem);
            });
        }

        if (Array.isArray(payload.basal_changes)) {
            payload.basal_changes.forEach((change, index) => normalized.push(normalizeLegacyBasalChange(change, index)));
        }

        if (Array.isArray(payload.carb_ratio_changes)) {
            payload.carb_ratio_changes.forEach((change, index) => normalized.push(normalizeLegacyCarbRatioChange(change, index)));
        }

        if (normalized.length > 0) return normalized;

        if (payload.recommendation_type || payload.type || payload.kind) {
            const single = normalizeRecommendation(payload, 0);
            return single ? [single] : [];
        }

        const flattenedKeys = [
            'correction_factor',
            'target_glucose',
            'target_range',
            'prebolus_time',
            'active_insulin_time',
            'correction_interval',
            'low_glucose_alert_threshold',
            'high_glucose_alert_threshold',
            'dual_bolus_split'
        ];

        flattenedKeys.forEach((key) => {
            const value = payload[key];
            if (!value) return;
            if (Array.isArray(value)) {
                value.forEach((item, index) => {
                    normalized.push(normalizeRecommendation({ ...item, recommendation_type: key }, index));
                });
            } else if (typeof value === 'object') {
                normalized.push(normalizeRecommendation({ ...value, recommendation_type: key }, 0));
            }
        });

        return normalized.filter(Boolean);
    }

    function createBaseDisplayItem(recommendation, index) {
        const type = normalizeType(recommendation.recommendation_type);
        const schedule = formatTimeRange(recommendation.time_start, recommendation.time_end);
        const scheduleText = schedule || recommendation.schedule_hint || '';
        return {
            id: createStableId(recommendation, index),
            kind: type,
            title: TITLE_BY_TYPE[type] || 'Рекомендация',
            primaryValue: '',
            secondaryValue: '',
            scheduleText,
            conditionText: formatCondition(recommendation.condition),
            confidenceText: formatConfidence(recommendation.confidence),
            rawText: recommendation.text ? String(recommendation.text) : '',
            colorVariant: 'default',
            iconName: null
        };
    }

    function withUnit(valueText, unitText) {
        const value = String(valueText || '').trim();
        const unit = String(unitText || '').trim();
        if (!value) return '';
        if (!unit) return value;
        return `${value} ${unit}`;
    }

    function formatTempBasalRecommendation(recommendation, baseItem) {
        const value = isFiniteNumber(recommendation.value) ? Number(recommendation.value) : null;
        if (value === null) {
            return {
                ...baseItem,
                primaryValue: makeFallbackText(recommendation)
            };
        }
        const sign = value >= 0 ? '+' : '';
        return {
            ...baseItem,
            primaryValue: `${sign}${formatNumber(value, 0)}%`
        };
    }

    function formatCarbRatioRecommendation(recommendation, baseItem) {
        const value = isFiniteNumber(recommendation.value) ? Number(recommendation.value) : null;
        return {
            ...baseItem,
            primaryValue: value === null ? makeFallbackText(recommendation) : `1:${formatNumber(value, 1)}`
        };
    }

    function formatBasalRateRecommendation(recommendation, baseItem) {
        const value = isFiniteNumber(recommendation.value) ? Number(recommendation.value) : null;
        const unit = recommendation.unit || 'Ед/ч';
        return {
            ...baseItem,
            primaryValue: value === null ? makeFallbackText(recommendation) : `${formatFixed(value, 2)} ${unit}`
        };
    }

    function formatCorrectionFactorRecommendation(recommendation, baseItem) {
        const value = isFiniteNumber(recommendation.value) ? Number(recommendation.value) : null;
        const rawUnit = recommendation.unit || 'ммоль/л';
        const normalizedUnit = String(rawUnit)
            .replace(/\/U/gi, '')
            .replace(/\/Ед/gi, '')
            .replace(/на\s*Ед/gi, '')
            .replace(/на\s*U/gi, '')
            .trim() || 'ммоль/л';
        return {
            ...baseItem,
            primaryValue: value === null ? makeFallbackText(recommendation) : `1 Ед → ${formatNumber(value, 2)} ${normalizedUnit}`
        };
    }

    function formatTargetGlucoseRecommendation(recommendation, baseItem) {
        const value = isFiniteNumber(recommendation.value) ? Number(recommendation.value) : null;
        return {
            ...baseItem,
            primaryValue: value === null ? makeFallbackText(recommendation) : withUnit(formatFixed(value, 1), recommendation.unit || 'ммоль/л')
        };
    }

    function formatTargetRangeRecommendation(recommendation, baseItem) {
        const valueMin = isFiniteNumber(recommendation.value_min) ? Number(recommendation.value_min) : null;
        const valueMax = isFiniteNumber(recommendation.value_max) ? Number(recommendation.value_max) : null;
        if (valueMin === null || valueMax === null) {
            return {
                ...baseItem,
                primaryValue: makeFallbackText(recommendation)
            };
        }
        return {
            ...baseItem,
            primaryValue: `${formatFixed(valueMin, 1)}–${formatFixed(valueMax, 1)} ${recommendation.unit || 'ммоль/л'}`
        };
    }

    function formatPrebolusTimeRecommendation(recommendation, baseItem) {
        const value = isFiniteNumber(recommendation.value) ? Number(recommendation.value) : null;
        return {
            ...baseItem,
            primaryValue: value === null ? makeFallbackText(recommendation) : `за ${formatNumber(value, 0)} ${recommendation.unit || 'мин'} до еды`
        };
    }

    function formatActiveInsulinTimeRecommendation(recommendation, baseItem) {
        const value = isFiniteNumber(recommendation.value) ? Number(recommendation.value) : null;
        return {
            ...baseItem,
            primaryValue: value === null ? makeFallbackText(recommendation) : withUnit(formatNumber(value, 1), recommendation.unit || 'ч')
        };
    }

    function formatCorrectionIntervalRecommendation(recommendation, baseItem) {
        const value = isFiniteNumber(recommendation.value) ? Number(recommendation.value) : null;
        return {
            ...baseItem,
            primaryValue: value === null ? makeFallbackText(recommendation) : `не ранее чем через ${formatNumber(value, 1)} ${recommendation.unit || 'ч'}`
        };
    }

    function formatLowThresholdRecommendation(recommendation, baseItem) {
        const value = isFiniteNumber(recommendation.value) ? Number(recommendation.value) : null;
        return {
            ...baseItem,
            colorVariant: 'warning',
            primaryValue: value === null ? makeFallbackText(recommendation) : withUnit(formatFixed(value, 1), recommendation.unit || 'ммоль/л')
        };
    }

    function formatHighThresholdRecommendation(recommendation, baseItem) {
        const value = isFiniteNumber(recommendation.value) ? Number(recommendation.value) : null;
        return {
            ...baseItem,
            colorVariant: 'warning',
            primaryValue: value === null ? makeFallbackText(recommendation) : withUnit(formatFixed(value, 1), recommendation.unit || 'ммоль/л')
        };
    }

    function formatDualBolusSplitRecommendation(recommendation, baseItem) {
        let immediate = isFiniteNumber(recommendation.immediate_percent) ? Number(recommendation.immediate_percent) : null;
        let extended = isFiniteNumber(recommendation.extended_percent) ? Number(recommendation.extended_percent) : null;
        const duration = isFiniteNumber(recommendation.duration) ? Number(recommendation.duration) : isFiniteNumber(recommendation.value_min) ? Number(recommendation.value_min) : null;

        if ((immediate === null || extended === null) && typeof recommendation.value === 'string') {
            const match = recommendation.value.match(/(\d+(?:[.,]\d+)?)\s*%\s*\/\s*(\d+(?:[.,]\d+)?)\s*%/);
            if (match) {
                immediate = Number(String(match[1]).replace(',', '.'));
                extended = Number(String(match[2]).replace(',', '.'));
            }
        }

        if (immediate === null || extended === null || duration === null) {
            return {
                ...baseItem,
                primaryValue: makeFallbackText(recommendation)
            };
        }

        return {
            ...baseItem,
            primaryValue: `${formatNumber(immediate, 0)}% сразу, ${formatNumber(extended, 0)}% за ${formatNumber(duration, 1)} ${recommendation.duration_unit || 'ч'}`
        };
    }

    function formatFallbackRecommendation(recommendation, baseItem) {
        const type = normalizeType(recommendation.recommendation_type);
        return {
            ...baseItem,
            secondaryValue: type === 'free_text' ? '' : type,
            primaryValue: recommendation.text ? String(recommendation.text) : makeFallbackText(recommendation),
            rawText: ''
        };
    }

    const FORMATTERS = {
        temp_basal_percent: formatTempBasalRecommendation,
        basal_rate: formatBasalRateRecommendation,
        carb_ratio: formatCarbRatioRecommendation,
        correction_factor: formatCorrectionFactorRecommendation,
        target_glucose: formatTargetGlucoseRecommendation,
        target_range: formatTargetRangeRecommendation,
        prebolus_time: formatPrebolusTimeRecommendation,
        active_insulin_time: formatActiveInsulinTimeRecommendation,
        correction_interval: formatCorrectionIntervalRecommendation,
        low_glucose_alert_threshold: formatLowThresholdRecommendation,
        high_glucose_alert_threshold: formatHighThresholdRecommendation,
        dual_bolus_split: formatDualBolusSplitRecommendation
    };

    function toDisplayItem(rawRecommendation, index) {
        const recommendation = normalizeRecommendation(rawRecommendation, index);
        if (!recommendation) return null;
        const baseItem = createBaseDisplayItem(recommendation, index);
        const formatter = FORMATTERS[baseItem.kind] || formatFallbackRecommendation;
        return formatter(recommendation, baseItem);
    }

    function toDisplayItems(rawRecommendations) {
        if (!Array.isArray(rawRecommendations)) return [];
        return rawRecommendations
            .map((item, index) => toDisplayItem(item, index))
            .filter(Boolean);
    }

    function toDisplayItemsFromInterpretation(payload) {
        return toDisplayItems(normalizeInterpretationPayload(payload));
    }

    const api = {
        normalizeInterpretationPayload,
        toDisplayItems,
        toDisplayItemsFromInterpretation
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    globalScope.RecommendationViewModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
