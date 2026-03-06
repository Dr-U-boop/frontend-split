const assert = require('node:assert/strict');
const recommendationVM = require('./recommendation_view_model');
const mockData = require('./recommendation_mock_data');

function findByKind(items, kind) {
    return items.find((item) => item.kind === kind);
}

function runTests() {
    const multiResponse = {
        count: 3,
        items: [
            {
                recommendation_type: 'basal_rate',
                text: 'базал',
                value: 0.8,
                unit: 'Ед/ч',
                time_start: '23:00',
                time_end: '02:00'
            },
            {
                recommendation_type: 'carb_ratio',
                text: 'ук',
                value: 9,
                unit: 'г/Ед'
            },
            {
                recommendation_type: 'prebolus_time',
                text: 'предболюс',
                value: 15,
                unit: 'мин'
            }
        ]
    };
    const formattedMulti = recommendationVM.toDisplayItemsFromInterpretation(multiResponse);
    assert.equal(formattedMulti.length, 3);
    assert.equal(formattedMulti[0].kind, 'basal_rate');
    assert.equal(formattedMulti[1].kind, 'carb_ratio');
    assert.equal(formattedMulti[2].kind, 'prebolus_time');

    const singleResponse = {
        recommendation_type: 'basal_rate',
        text: 'Изменить базальную скорость до 0.80 Ед/ч в период 23:00-02:00',
        value: 0.8,
        unit: 'Ед/ч',
        time_start: '23:00',
        time_end: '02:00',
        confidence: 0.97
    };
    const formattedSingle = recommendationVM.toDisplayItemsFromInterpretation(singleResponse);
    assert.equal(formattedSingle.length, 1);
    assert.equal(formattedSingle[0].kind, 'basal_rate');
    assert.equal(formattedSingle[0].primaryValue, '0.80 Ед/ч');
    assert.equal(formattedSingle[0].scheduleText, '23:00–02:00');

    const formattedMock = recommendationVM.toDisplayItems(mockData);
    assert.ok(formattedMock.length >= 11, 'expected display items for all supported recommendation types');

    const tempBasal = findByKind(formattedMock, 'temp_basal_percent');
    assert.equal(tempBasal.title, 'Базальный инсулин');
    assert.equal(tempBasal.primaryValue, '-20%');
    assert.equal(tempBasal.scheduleText, '20:00–06:00');

    const carbRatio = findByKind(formattedMock, 'carb_ratio');
    assert.equal(carbRatio.primaryValue, '1:9');

    const correctionFactor = findByKind(formattedMock, 'correction_factor');
    assert.equal(correctionFactor.primaryValue, '1 Ед → 2.2 ммоль/л');

    const targetRange = findByKind(formattedMock, 'target_range');
    assert.equal(targetRange.primaryValue, '5.5–7.0 ммоль/л');

    const dualBolus = findByKind(formattedMock, 'dual_bolus_split');
    assert.equal(dualBolus.primaryValue, '60% сразу, 40% за 2 ч');

    const fallback = findByKind(formattedMock, 'unknown_custom_type');
    assert.equal(fallback.title, 'Рекомендация');
    assert.equal(fallback.primaryValue, 'Кастомная рекомендация без форматтера');
    assert.equal(fallback.secondaryValue, 'unknown_custom_type');

    const legacyPayload = {
        basal_changes: [{ time_segment: '20:00-06:00', change_percent: -25 }],
        carb_ratio_changes: [{ meal_time: '06:00-11:00', value: 8 }]
    };
    const formattedLegacy = recommendationVM.toDisplayItemsFromInterpretation(legacyPayload);
    assert.equal(formattedLegacy.length, 2, 'legacy payload should map to 2 display items');
    assert.equal(formattedLegacy[0].kind, 'temp_basal_percent');
    assert.equal(formattedLegacy[0].primaryValue, '-25%');
    assert.equal(formattedLegacy[1].kind, 'carb_ratio');
    assert.equal(formattedLegacy[1].primaryValue, '1:8');
}

runTests();
console.log('recommendation_view_model tests passed');
