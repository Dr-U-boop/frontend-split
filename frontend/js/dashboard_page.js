let currentToken = null;
let currentPatientId = null;
let patients = [];
let glucoseChart = null;
let simChart = null;
let comprehensiveData = null;
let simulationChartState = null;
let currentMonitoringView = 'chart';
let simulatorScenarios = [];
let hasRequestedInitialPatients = false;
const patientStatusById = new Map();
const STATUS_PRIORITY = ['status-attention', 'status-warning', 'status-ok'];

// --- DOM Элементы ---
const patientsListEl = document.getElementById('patients-list');
const welcomeMessageEl = document.getElementById('welcome-message');
const patientDetailsEl = document.getElementById('patient-details');
const patientNameEl = document.getElementById('patient-name');
const chartContainerEl = document.getElementById('glucose-chart');
const recommendationsListEl = document.getElementById('recommendations-list');
const startDateInput = document.getElementById('start-date');
const startTimeInput = document.getElementById('start-time');
const endDateInput = document.getElementById('end-date');
const endTimeInput = document.getElementById('end-time');
const updateChartBtn = document.getElementById('update-chart-btn');
const resetChartBtn = document.getElementById('reset-chart-btn');
const dashboardContainer = document.getElementById('dashboard-container');
const sidebarToggleBtn = document.getElementById('sidebar-toggle');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomResetBtn = document.getElementById('zoom-reset-btn');
const patientSearchInput = document.getElementById('patient-search');
const resizer = document.getElementById('sidebar-resizer');
const chartWrapperEl = document.querySelector('.chart-wrapper');
const tableWrapperEl = document.getElementById('comprehensive-table-wrapper');
const comprehensiveTableBodyEl = document.getElementById('comprehensive-table-body');
const viewChartBtn = document.getElementById('view-chart-btn');
const viewTableBtn = document.getElementById('view-table-btn');
const monitoringChartActionsEl = document.getElementById('monitoring-chart-actions');
const lastDayRangeBtn = document.getElementById('range-last-day-btn');
const lastMonthRangeBtn = document.getElementById('range-last-month-btn');
const lastThreeMonthsRangeBtn = document.getElementById('range-last-3-months-btn');
const statsPeriodLabelEl = document.getElementById('stats-period-label');
const statReadingsCountEl = document.getElementById('stat-readings-count');
const statAvgGlucoseEl = document.getElementById('stat-avg-glucose');
const statMinGlucoseEl = document.getElementById('stat-min-glucose');
const statMaxGlucoseEl = document.getElementById('stat-max-glucose');
const statStdGlucoseEl = document.getElementById('stat-std-glucose');
const statTirEl = document.getElementById('stat-tir');
const statHypoCountEl = document.getElementById('stat-hypo-count');
const statHyperCountEl = document.getElementById('stat-hyper-count');
const statTotalCarbsEl = document.getElementById('stat-total-carbs');
const statTotalInsulinEl = document.getElementById('stat-total-insulin');
const patientDiaryBodyEl = document.getElementById('patient-diary-body');
const refreshDiaryBtn = document.getElementById('refresh-diary-btn');
const simParamsCodeEl = document.getElementById('sim-params-code');
const simScenarioCodeEl = document.getElementById('sim-scenario-code');
const simSaveParamsBtn = document.getElementById('sim-save-params-btn');
const simScenarioSelectEl = document.getElementById('sim-scenario-select');
const simNewScenarioBtn = document.getElementById('sim-new-scenario-btn');
const simSaveScenarioBtn = document.getElementById('sim-save-scenario-btn');
const simRunBtn = document.getElementById('sim-run-btn');
const simStatsPeriodLabelEl = document.getElementById('sim-stats-period-label');
const simStatAvgEl = document.getElementById('sim-stat-avg');
const simStatMinEl = document.getElementById('sim-stat-min');
const simStatMaxEl = document.getElementById('sim-stat-max');
const simStatTirEl = document.getElementById('sim-stat-tir');
const simChartContainerEl = document.getElementById('sim-glucose-chart');
const simChartActionsEl = document.getElementById('sim-chart-actions');
const simModelTypeEl = document.getElementById('sim-model-type');
const simCgmSeedEl = document.getElementById('sim-cgm-seed');
const API_BASE_URL = window.electronAPI.getApiBaseUrl();
const ACCESS_TOKEN_KEY = 'accessToken';
const chartPanelState = {
    monitoring: {
        selectZoomActive: false
    },
    simulation: {
        selectZoomActive: false
    }
};
const chartInteractionState = {
    monitoring: {
        dragBound: false,
        selecting: false,
        startX: 0,
        overlayEl: null,
        selectionBoxEl: null
    },
    simulation: {
        dragBound: false,
        selecting: false,
        startX: 0,
        overlayEl: null,
        selectionBoxEl: null
    }
};

function getStoredAccessToken() {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem(ACCESS_TOKEN_KEY);
}

function setCurrentToken(token) {
    currentToken = token || null;

    if (!currentToken) {
        sessionStorage.removeItem(ACCESS_TOKEN_KEY);
        return;
    }

    sessionStorage.setItem(ACCESS_TOKEN_KEY, currentToken);
}

function ensureInitialPatientsLoaded() {
    if (!currentToken || hasRequestedInitialPatients) return;
    hasRequestedInitialPatients = true;
    fetchAndRenderPatients();
}

async function initAuthToken() {
    const tokenFromMain = window.electronAPI && typeof window.electronAPI.getUserToken === 'function'
        ? await window.electronAPI.getUserToken()
        : null;

    setCurrentToken(tokenFromMain || getStoredAccessToken());
    ensureInitialPatientsLoaded();
}

function readCssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
}

function getChartThemeConfig() {
    return {
        textPrimary: readCssVar('--color-text-primary', '#2f3b36'),
        textSecondary: readCssVar('--color-text-secondary', '#6c7773'),
        border: readCssVar('--color-border', '#d8e0ea'),
        surface: readCssVar('--color-surface', '#ffffff'),
        surfaceSoft: readCssVar('--color-surface-soft', '#f5f7fa'),
        primary: readCssVar('--color-primary', '#2f6fed'),
        primarySoft: readCssVar('--color-primary-soft', 'rgba(47, 111, 237, 0.18)'),
        accentGreen: readCssVar('--color-accent-green', '#2e8b57'),
        accentRed: '#e04343',
        accentPink: '#d81b84',
        tooltipShadow: readCssVar('--shadow-soft', '0 12px 32px rgba(16, 24, 40, 0.12)'),
        grid: readCssVar('--chart-grid-color', 'rgba(70, 89, 82, 0.14)')
    };
}

function createManagedChart(container) {
    if (!container || !window.EChartsBridge) return null;
    return window.EChartsBridge.createManagedChart(container, {
        renderer: 'canvas',
        useDirtyRect: true
    });
}

function ensureGlucoseChart() {
    if (!glucoseChart) {
        glucoseChart = createManagedChart(chartContainerEl);
        bindDragZoom(glucoseChart, 'monitoring', monitoringChartActionsEl, chartContainerEl);
    }
    return glucoseChart;
}

function ensureSimulationChart() {
    if (!simChart) {
        simChart = createManagedChart(simChartContainerEl);
        bindDragZoom(simChart, 'simulation', simChartActionsEl, simChartContainerEl);
    }
    return simChart;
}

function formatChartDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

function formatChartTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

function formatNumericValue(value, digits = 1) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '-';
    return numeric.toFixed(digits);
}

function toTimeSeries(points) {
    return (points || [])
        .map((point) => {
            const xValue = point?.x ?? point?.timestamp ?? point?.time ?? point?.date ?? point?.[0];
            const yValue = point?.y ?? point?.value ?? point?.[1];
            const timestamp = new Date(xValue).getTime();
            const numericValue = Number(yValue);
            if (!Number.isFinite(timestamp) || !Number.isFinite(numericValue)) return null;
            return [timestamp, numericValue];
        })
        .filter(Boolean)
        .sort((a, b) => a[0] - b[0]);
}

function toSimulationSeries(time, glucose) {
    return (time || [])
        .map((timePoint, index) => {
            const xValue = Number(timePoint);
            const yValue = Number(glucose?.[index]);
            if (!Number.isFinite(xValue) || !Number.isFinite(yValue)) return null;
            return [xValue, yValue];
        })
        .filter(Boolean)
        .sort((a, b) => a[0] - b[0]);
}

function createEmptyChartGraphic(theme, text) {
    return [{
        type: 'text',
        left: 'center',
        top: 'middle',
        silent: true,
        style: {
            text,
            fill: theme.textSecondary,
            fontSize: 14,
            fontWeight: 500
        }
    }];
}

function setChartSelectZoomState(chartKey, isActive) {
    if (!chartPanelState[chartKey]) return;
    chartPanelState[chartKey].selectZoomActive = Boolean(isActive);
    const container = chartKey === 'monitoring' ? chartContainerEl : simChartContainerEl;
    container?.classList.toggle('is-selection-armed', chartPanelState[chartKey].selectZoomActive);
    const overlayEl = chartInteractionState[chartKey]?.overlayEl;
    overlayEl?.classList.toggle('is-armed', chartPanelState[chartKey].selectZoomActive);
}

function syncChartActionPanel(panelElement, chartKey) {
    if (!panelElement || !chartPanelState[chartKey]) return;
    const toggleButton = panelElement.querySelector('[data-chart-action="selectZoom"]');
    if (!toggleButton) return;
    toggleButton.classList.toggle('is-active', chartPanelState[chartKey].selectZoomActive);
    toggleButton.setAttribute('aria-pressed', chartPanelState[chartKey].selectZoomActive ? 'true' : 'false');
}

function resetChartPanelState(chartKey, panelElement) {
    setChartSelectZoomState(chartKey, false);
    syncChartActionPanel(panelElement, chartKey);
}

function bindChartActionPanel(panelElement, chartKey, getChart) {
    if (!panelElement) return;
    syncChartActionPanel(panelElement, chartKey);

    panelElement.addEventListener('click', (event) => {
        const button = event.target.closest('[data-chart-action]');
        if (!button) return;

        const chart = getChart();
        if (!chart) return;

        const action = button.dataset.chartAction;
        if (action === 'selectZoom') {
            const nextState = !chartPanelState[chartKey].selectZoomActive;
            setChartSelectZoomState(chartKey, nextState);
            syncChartActionPanel(panelElement, chartKey);
            return;
        }

        if (action === 'resetZoom') {
            chart.dispatchAction({
                type: 'dataZoom',
                start: 0,
                end: 100
            });
            resetChartPanelState(chartKey, panelElement);
            return;
        }

        if (action === 'restoreView') {
            chart.dispatchAction({ type: 'restore' });
            resetChartPanelState(chartKey, panelElement);
        }
    });
}

function ensureSelectionOverlay(container, chartKey) {
    const state = chartInteractionState[chartKey];
    if (state.overlayEl) return state.overlayEl;

    const overlayEl = document.createElement('div');
    overlayEl.className = 'chart-selection-overlay';
    const selectionBoxEl = document.createElement('div');
    selectionBoxEl.className = 'chart-selection-box';
    overlayEl.appendChild(selectionBoxEl);
    const overlayParent = container.parentElement || container;
    overlayParent.appendChild(overlayEl);
    state.overlayEl = overlayEl;
    state.selectionBoxEl = selectionBoxEl;
    return overlayEl;
}

function hideSelectionOverlay(chartKey) {
    const state = chartInteractionState[chartKey];
    const overlayEl = state?.overlayEl;
    const selectionBoxEl = state?.selectionBoxEl;
    overlayEl?.classList.remove('is-armed');
    if (!selectionBoxEl) return;
    selectionBoxEl.style.display = 'none';
    selectionBoxEl.style.left = '0px';
    selectionBoxEl.style.width = '0px';
}

function updateSelectionOverlay(chartKey, startX, currentX) {
    const selectionBoxEl = chartInteractionState[chartKey]?.selectionBoxEl;
    if (!selectionBoxEl) return;
    selectionBoxEl.style.display = 'block';
    const left = Math.min(startX, currentX);
    const width = Math.max(2, Math.abs(currentX - startX));
    selectionBoxEl.style.left = `${left}px`;
    selectionBoxEl.style.width = `${width}px`;
}

function bindDragZoom(chart, chartKey, panelElement, container) {
    if (!chart || !container || chartInteractionState[chartKey]?.dragBound) return;

    const overlayEl = ensureSelectionOverlay(container, chartKey);
    const state = chartInteractionState[chartKey];

    overlayEl.addEventListener('mousedown', (event) => {
        if (!chartPanelState[chartKey].selectZoomActive) return;

        const instance = chart.getInstance();
        const rect = overlayEl.getBoundingClientRect();
        const localX = event.clientX - rect.left;
        const localY = event.clientY - rect.top;

        if (!instance.containPixel({ gridIndex: 0 }, [localX, localY])) {
            return;
        }

        state.selecting = true;
        state.startX = localX;
        updateSelectionOverlay(chartKey, localX, localX);
        event.preventDefault();
    });

    window.addEventListener('mousemove', (event) => {
        if (!state.selecting) return;
        const rect = overlayEl.getBoundingClientRect();
        const boundedX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
        updateSelectionOverlay(chartKey, state.startX, boundedX);
    });

    window.addEventListener('mouseup', (event) => {
        if (!state.selecting) return;

        state.selecting = false;
        const rect = overlayEl.getBoundingClientRect();
        const endX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
        const pixelDelta = Math.abs(endX - state.startX);

        if (pixelDelta < 6) {
            hideSelectionOverlay(chartKey);
            resetChartPanelState(chartKey, panelElement);
            return;
        }

        const instance = chart.getInstance();
        const startValueRaw = instance.convertFromPixel({ xAxisIndex: 0 }, state.startX);
        const endValueRaw = instance.convertFromPixel({ xAxisIndex: 0 }, endX);
        const startValue = Number(startValueRaw);
        const endValue = Number(endValueRaw);

        hideSelectionOverlay(chartKey);

        if (!Number.isFinite(startValue) || !Number.isFinite(endValue)) {
            resetChartPanelState(chartKey, panelElement);
            return;
        }

        chart.dispatchAction({
            type: 'dataZoom',
            startValue: Math.min(startValue, endValue),
            endValue: Math.max(startValue, endValue)
        });
        resetChartPanelState(chartKey, panelElement);
    });

    chartInteractionState[chartKey].dragBound = true;
}

function buildComprehensiveTooltip(params) {
    if (!Array.isArray(params) || params.length === 0) return '';
    const timestamp = params[0].axisValue;
    const rows = params
        .filter((item) => Array.isArray(item.value) && Number.isFinite(Number(item.value[1])))
        .map((item) => {
            const unit = item.seriesName.includes('Углеводы')
                ? 'г'
                : item.seriesName.includes('Инсулин')
                    ? 'ЕД'
                    : 'ммоль/л';
            return `${item.marker}${item.seriesName}: <strong>${formatNumericValue(item.value[1])} ${unit}</strong>`;
        });

    return [formatChartDateTime(timestamp), ...rows].join('<br>');
}

function buildSimulationTooltip(params) {
    if (!Array.isArray(params) || params.length === 0) return '';
    const point = params[0];
    const value = Array.isArray(point.value) ? point.value[1] : point.value;
    const time = Array.isArray(point.value) ? point.value[0] : point.axisValue;
    return [
        `Время: ${formatNumericValue(time, 0)} мин`,
        `${point.marker}${point.seriesName}: <strong>${formatNumericValue(value)} ммоль/л</strong>`
    ].join('<br>');
}

function buildComprehensiveChartOption(apiData) {
    const theme = getChartThemeConfig();
    const glucoseSeries = toTimeSeries(apiData?.glucose);
    const carbsSeries = toTimeSeries(apiData?.carbs);
    const insulinSeries = toTimeSeries(apiData?.insulin);
    const hasData = glucoseSeries.length > 0 || carbsSeries.length > 0 || insulinSeries.length > 0;
    const compactSymbols = glucoseSeries.length + insulinSeries.length > 240;

    return {
        backgroundColor: 'transparent',
        animation: true,
        animationDuration: 220,
        animationDurationUpdate: 180,
        textStyle: {
            color: theme.textPrimary
        },
        grid: {
            left: 78,
            right: 92,
            top: 72,
            bottom: 104,
            containLabel: true
        },
        legend: {
            top: 10,
            left: 10,
            itemWidth: 14,
            itemHeight: 8,
            textStyle: {
                color: theme.textPrimary,
                fontWeight: 500
            }
        },
        tooltip: {
            trigger: 'axis',
            confine: true,
            axisPointer: {
                type: 'cross',
                snap: false,
                lineStyle: {
                    color: theme.textSecondary,
                    opacity: 0.35
                },
                label: {
                    backgroundColor: theme.surface
                }
            },
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderWidth: 1,
            textStyle: {
                color: theme.textPrimary
            },
            extraCssText: `box-shadow:${theme.tooltipShadow}; border-radius: 12px;`,
            formatter: buildComprehensiveTooltip
        },
        dataZoom: [
            {
                type: 'inside',
                xAxisIndex: 0,
                filterMode: 'none',
                zoomOnMouseWheel: true,
                moveOnMouseWheel: false,
                moveOnMouseMove: true,
                throttle: 50,
                minValueSpan: 30 * 60 * 1000
            },
            {
                type: 'slider',
                xAxisIndex: 0,
                filterMode: 'none',
                height: 28,
                bottom: 24,
                brushSelect: false,
                borderColor: theme.border,
                backgroundColor: theme.surfaceSoft,
                fillerColor: theme.primarySoft,
                moveHandleSize: 14,
                dataBackground: {
                    lineStyle: {
                        color: theme.primary,
                        opacity: 0.55
                    },
                    areaStyle: {
                        color: theme.primarySoft,
                        opacity: 0.2
                    }
                },
                textStyle: {
                    color: theme.textSecondary
                },
                handleStyle: {
                    color: theme.primary,
                    borderColor: theme.primary
                }
            }
        ],
        xAxis: {
            type: 'time',
            boundaryGap: ['2%', '2%'],
            axisLine: {
                lineStyle: {
                    color: theme.border
                }
            },
            axisLabel: {
                color: theme.textSecondary,
                hideOverlap: true,
                formatter: (value) => formatChartTime(value)
            },
            splitLine: {
                show: true,
                lineStyle: {
                    color: theme.grid
                }
            },
            minorSplitLine: {
                show: false
            }
        },
        yAxis: [
            {
                type: 'value',
                name: 'Глюкоза (ммоль/л)',
                position: 'left',
                nameLocation: 'middle',
                nameRotate: 90,
                nameGap: 56,
                nameTextStyle: {
                    color: theme.textPrimary,
                    fontWeight: 600,
                    padding: [0, 0, 0, 0]
                },
                axisLabel: {
                    color: theme.textSecondary
                },
                axisLine: {
                    show: true,
                    lineStyle: {
                        color: theme.border
                    }
                },
                splitLine: {
                    lineStyle: {
                        color: theme.grid
                    }
                },
                min: (value) => {
                    const boundedMin = Math.floor((value.min - 0.5) * 2) / 2;
                    return Math.max(0, boundedMin);
                }
            },
            {
                type: 'value',
                name: 'Углеводы (г) / Инсулин (ЕД)',
                position: 'right',
                min: 0,
                nameLocation: 'middle',
                nameRotate: 270,
                nameGap: 66,
                nameTextStyle: {
                    color: theme.textPrimary,
                    fontWeight: 600,
                    padding: [0, 0, 0, 0]
                },
                axisLabel: {
                    color: theme.textSecondary
                },
                axisLine: {
                    show: true,
                    lineStyle: {
                        color: theme.border
                    }
                },
                splitLine: {
                    show: false
                }
            }
        ],
        graphic: hasData ? [] : createEmptyChartGraphic(theme, 'Нет данных за выбранный период'),
        series: [
            {
                name: 'Глюкоза',
                type: 'line',
                yAxisIndex: 0,
                data: glucoseSeries,
                smooth: 0.22,
                showSymbol: !compactSymbols,
                symbol: 'circle',
                symbolSize: 6,
                sampling: 'lttb',
                lineStyle: {
                    width: 2.5,
                    color: theme.primary
                },
                itemStyle: {
                    color: theme.primary
                },
                emphasis: {
                    focus: 'series'
                }
            },
            {
                name: 'Углеводы',
                type: 'bar',
                yAxisIndex: 1,
                data: carbsSeries,
                barMaxWidth: 18,
                itemStyle: {
                    color: theme.accentRed,
                    opacity: 0.84,
                    borderRadius: [5, 5, 0, 0]
                },
                emphasis: {
                    focus: 'series'
                }
            },
            {
                name: 'Инсулин',
                type: 'line',
                yAxisIndex: 1,
                data: insulinSeries,
                smooth: 0.18,
                showSymbol: !compactSymbols,
                symbol: 'circle',
                symbolSize: 5,
                sampling: 'lttb',
                lineStyle: {
                    width: 2,
                    color: theme.accentPink
                },
                itemStyle: {
                    color: theme.accentPink
                },
                emphasis: {
                    focus: 'series'
                }
            }
        ]
    };
}

function buildSimulationChartOption(time, glucose) {
    const theme = getChartThemeConfig();
    const data = toSimulationSeries(time, glucose);
    const hasData = data.length > 0;

    return {
        backgroundColor: 'transparent',
        animation: true,
        animationDuration: 180,
        animationDurationUpdate: 140,
        textStyle: {
            color: theme.textPrimary
        },
        grid: {
            left: 82,
            right: 42,
            top: 72,
            bottom: 100,
            containLabel: true
        },
        legend: {
            top: 10,
            left: 10,
            textStyle: {
                color: theme.textPrimary
            }
        },
        tooltip: {
            trigger: 'axis',
            confine: true,
            axisPointer: {
                type: 'line',
                lineStyle: {
                    color: theme.textSecondary,
                    opacity: 0.35
                }
            },
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderWidth: 1,
            textStyle: {
                color: theme.textPrimary
            },
            extraCssText: `box-shadow:${theme.tooltipShadow}; border-radius: 12px;`,
            formatter: buildSimulationTooltip
        },
        dataZoom: [
            {
                type: 'inside',
                xAxisIndex: 0,
                filterMode: 'none',
                zoomOnMouseWheel: true,
                moveOnMouseWheel: false,
                moveOnMouseMove: true,
                throttle: 50,
                minSpan: 10
            },
            {
                type: 'slider',
                xAxisIndex: 0,
                filterMode: 'none',
                height: 28,
                bottom: 18,
                brushSelect: false,
                borderColor: theme.border,
                backgroundColor: theme.surfaceSoft,
                fillerColor: theme.primarySoft,
                moveHandleSize: 14,
                dataBackground: {
                    lineStyle: {
                        color: theme.primary,
                        opacity: 0.55
                    },
                    areaStyle: {
                        color: theme.primarySoft,
                        opacity: 0.2
                    }
                },
                textStyle: {
                    color: theme.textSecondary
                },
                handleStyle: {
                    color: theme.primary,
                    borderColor: theme.primary
                }
            }
        ],
        xAxis: {
            type: 'value',
            name: 'Время, мин',
            nameLocation: 'middle',
            nameGap: 34,
            axisLine: {
                lineStyle: {
                    color: theme.border
                }
            },
            axisLabel: {
                color: theme.textSecondary
            },
            splitLine: {
                lineStyle: {
                    color: theme.grid
                }
            }
        },
        yAxis: {
            type: 'value',
            name: 'Глюкоза (ммоль/л)',
            nameLocation: 'middle',
            nameRotate: 90,
            nameGap: 58,
            nameTextStyle: {
                color: theme.textPrimary,
                fontWeight: 600,
                padding: [0, 0, 0, 0]
            },
            axisLine: {
                show: true,
                lineStyle: {
                    color: theme.border
                }
            },
            axisLabel: {
                color: theme.textSecondary
            },
            splitLine: {
                lineStyle: {
                    color: theme.grid
                }
            },
            min: (value) => Math.max(0, Math.floor((value.min - 0.5) * 2) / 2)
        },
        graphic: hasData ? [] : createEmptyChartGraphic(theme, 'Симуляция не запускалась'),
        series: [
            {
                name: 'Глюкоза',
                type: 'line',
                data,
                smooth: 0.18,
                showSymbol: data.length <= 160,
                symbolSize: 5,
                sampling: 'lttb',
                lineStyle: {
                    width: 2.4,
                    color: theme.accentGreen
                },
                itemStyle: {
                    color: theme.accentGreen
                },
                areaStyle: {
                    color: theme.primarySoft,
                    opacity: 0.16
                }
            }
        ]
    };
}

// --- КОНСТАНТЫ ---
const SIDEBAR_WIDTH_KEY = 'sidebarWidth';
const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 600;
const DEFAULT_SIDEBAR_WIDTH = 280;
const THEME_MODES = ['light', 'dark', 'auto'];
const ZOOM_STORAGE_KEY = 'appZoomPercent';
const ZOOM_STEP = 10;
const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const THEME_LABELS = {
    light: 'Светлая',
    dark: 'Тёмная',
    auto: 'Авто'
};

function getCurrentThemeMode() {
    if (window.appTheme && typeof window.appTheme.getMode === 'function') {
        return window.appTheme.getMode();
    }
    return 'auto';
}

function updateThemeToggleLabel() {
    if (!themeToggleBtn) return;
    const mode = getCurrentThemeMode();
    themeToggleBtn.textContent = `Тема: ${THEME_LABELS[mode] || THEME_LABELS.auto}`;
}

function cycleThemeMode() {
    if (!window.appTheme || typeof window.appTheme.setMode !== 'function') return;
    const currentMode = getCurrentThemeMode();
    const currentIndex = THEME_MODES.indexOf(currentMode);
    const nextMode = THEME_MODES[(currentIndex + 1 + THEME_MODES.length) % THEME_MODES.length];
    window.appTheme.setMode(nextMode);
    updateThemeToggleLabel();
}

function getSavedZoomPercent() {
    const raw = localStorage.getItem(ZOOM_STORAGE_KEY);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return null;
    if (parsed < MIN_ZOOM || parsed > MAX_ZOOM) return null;
    return parsed;
}

function getCurrentZoomPercent() {
    return getSavedZoomPercent() ?? 100;
}

async function applyZoomPercent(percent, persist = true) {
    if (!window.electronAPI || typeof window.electronAPI.setZoomFactor !== 'function') return;

    if (percent === null) {
        await window.electronAPI.setZoomFactor(1);
        if (persist) localStorage.removeItem(ZOOM_STORAGE_KEY);
    } else {
        const boundedPercent = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, percent));
        await window.electronAPI.setZoomFactor(boundedPercent / 100);
        if (persist) localStorage.setItem(ZOOM_STORAGE_KEY, String(boundedPercent));
    }

    updateZoomResetLabel();
    if (glucoseChart) {
        setTimeout(() => glucoseChart.resize(), 0);
    }
    if (simChart) {
        setTimeout(() => simChart.resize(), 0);
    }
}

function updateZoomResetLabel() {
    if (!zoomResetBtn) return;
    const savedZoom = getSavedZoomPercent();
    zoomResetBtn.textContent = savedZoom === null ? 'Авто' : `${savedZoom}%`;
}

async function increaseZoom() {
    const nextZoom = getCurrentZoomPercent() + ZOOM_STEP;
    await applyZoomPercent(nextZoom);
}

async function decreaseZoom() {
    const nextZoom = getCurrentZoomPercent() - ZOOM_STEP;
    await applyZoomPercent(nextZoom);
}

async function resetZoomToAuto() {
    await applyZoomPercent(null);
}

function initZoomControls() {
    if (!zoomOutBtn || !zoomInBtn || !zoomResetBtn) return;

    zoomOutBtn.addEventListener('click', () => { void decreaseZoom(); });
    zoomInBtn.addEventListener('click', () => { void increaseZoom(); });
    zoomResetBtn.addEventListener('click', () => { void resetZoomToAuto(); });

    void applyZoomPercent(getSavedZoomPercent(), false);
}

// --- Инициализация ---
window.electronAPI.handleToken((token) => {
    setCurrentToken(token);
    ensureInitialPatientsLoaded();
});

void initAuthToken();

// --- ИНИЦИАЛИЗАЦИЯ ШИРИНЫ ПРИ ЗАГРУЗКЕ ---
// Проверяем, есть ли сохраненная ширина
const savedSidebarWidth = localStorage.getItem(SIDEBAR_WIDTH_KEY);
if (savedSidebarWidth) {
    // Применяем сохраненную ширину
    dashboardContainer.style.gridTemplateColumns = `${savedSidebarWidth}px 1fr`;
}

// --- ЛОГИКА СВОРАЧИВАНИЯ МЕНЮ (ОБНОВЛЕННАЯ) ---
sidebarToggleBtn.addEventListener('click', () => {
    const isCollapsed = dashboardContainer.classList.toggle('sidebar-collapsed');

    if (isCollapsed) {
        // Если свернули - очищаем стиль, чтобы сработал CSS класс (0px)
        dashboardContainer.style.gridTemplateColumns = '';
    } else {
        // Если развернули - восстанавливаем сохраненную ширину или дефолтную
        const widthToRestore = localStorage.getItem(SIDEBAR_WIDTH_KEY) || DEFAULT_SIDEBAR_WIDTH;
        dashboardContainer.style.gridTemplateColumns = `${widthToRestore}px 1fr`;
    }

    if (glucoseChart) {
        setTimeout(() => { glucoseChart.resize(); }, 300);
    }
});

// --- ЛОГИКА ИЗМЕНЕНИЯ ШИРИНЫ (RESIZING ОБНОВЛЕННАЯ) ---
let isResizing = false;
let currentWidth = DEFAULT_SIDEBAR_WIDTH; // Временная переменная для хранения текущей ширины

resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizer.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    // Если начали тянуть свернутое меню - разворачиваем его
    if (dashboardContainer.classList.contains('sidebar-collapsed')) {
        dashboardContainer.classList.remove('sidebar-collapsed');
    }

    let newWidth = e.clientX;

    // Ограничения
    if (newWidth < MIN_SIDEBAR_WIDTH) newWidth = MIN_SIDEBAR_WIDTH;
    if (newWidth > MAX_SIDEBAR_WIDTH) newWidth = MAX_SIDEBAR_WIDTH;

    currentWidth = newWidth; // Запоминаем текущую позицию

    // Применяем стиль
    dashboardContainer.style.gridTemplateColumns = `${newWidth}px 1fr`;
});

document.addEventListener('mouseup', () => {
    if (isResizing) {
        isResizing = false;
        resizer.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        // --- НОВОЕ: Сохраняем итоговую ширину в Local Storage ---
        localStorage.setItem(SIDEBAR_WIDTH_KEY, currentWidth);
        console.log(`Ширина панели сохранена: ${currentWidth}px`);

        if (glucoseChart) glucoseChart.resize();
    }
});

patientSearchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();

    // Фильтруем локальный массив patients
    const filteredPatients = patients.filter(patient => {
        const nameMatch = patient.full_name.toLowerCase().includes(query);
        const dobMatch = patient.date_of_birth.includes(query);
        return nameMatch || dobMatch;
    });

    renderPatientsList(filteredPatients);
});

// --- Функции ---
async function apiFetch(endpoint, options = {}) {
    const token = currentToken || getStoredAccessToken();
    if (!token) {
        throw new Error('Токен авторизации не найден.');
    }

    currentToken = token;

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...(options.headers || {})
        }
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Ошибка API: ${response.statusText}`);
    }
    return response.json();
}

async function fetchAndRenderPatients() {
    try {
        // Сохраняем ответ сервера в глобальную переменную patients
        patients = await apiFetch('/api/patients/');
        assignAndNormalizePatientStatuses(patients);
        // Рендерим полный список
        renderPatientsList(patients);
    } catch (error) {
        console.error("Не удалось загрузить пациентов:", error);
    }
}

// Выносим рендеринг списка в отдельную функцию для переиспользования в поиске
function renderPatientsList(patientsArray) {
    patientsListEl.innerHTML = '';

    if (patientsArray.length === 0) {
        patientsListEl.innerHTML = '<li style="padding:10px; color:#999; text-align:center;">Ничего не найдено</li>';
        return;
    }

    const sortedPatients = [...patientsArray].sort((a, b) => {
        const statusA = getOrCreatePatientStatus(a.id);
        const statusB = getOrCreatePatientStatus(b.id);
        const statusDiff = STATUS_PRIORITY.indexOf(statusA) - STATUS_PRIORITY.indexOf(statusB);
        if (statusDiff !== 0) return statusDiff;
        return a.full_name.localeCompare(b.full_name, 'ru');
    });

    sortedPatients.forEach(patient => {
        const li = document.createElement('li');
        li.className = 'patient-item';
        if (patient.id === currentPatientId) {
            li.classList.add('active');
        }

        li.dataset.patientId = patient.id;
        const statusClass = getOrCreatePatientStatus(patient.id);

        li.innerHTML = `
            <div class="status-indicator ${statusClass}"></div>
            <div style="display:flex; flex-direction:column;">
                <span style="font-weight:500;">${patient.full_name}</span>
                <span style="font-size:11px; color:var(--color-text-secondary);">${patient.date_of_birth}</span>
            </div>
        `;

        li.addEventListener('click', () => {
            document.querySelectorAll('.patient-item').forEach(item => item.classList.remove('active'));
            li.classList.add('active');
            displayPatientDetails(patient.id);
        });
        patientsListEl.appendChild(li);
    });
}

function getRandomStatus() {
    return STATUS_PRIORITY[Math.floor(Math.random() * STATUS_PRIORITY.length)];
}

function getOrCreatePatientStatus(patientId) {
    if (!patientStatusById.has(patientId)) {
        patientStatusById.set(patientId, getRandomStatus());
    }
    return patientStatusById.get(patientId);
}

function assignAndNormalizePatientStatuses(patientsArray) {
    const incomingIds = new Set(patientsArray.map((patient) => patient.id));

    Array.from(patientStatusById.keys()).forEach((patientId) => {
        if (!incomingIds.has(patientId)) {
            patientStatusById.delete(patientId);
        }
    });

    patientsArray.forEach((patient) => {
        getOrCreatePatientStatus(patient.id);
    });

    if (patientsArray.length < STATUS_PRIORITY.length) return;

    const statusBuckets = new Map(STATUS_PRIORITY.map((status) => [status, []]));
    patientsArray.forEach((patient) => {
        const status = getOrCreatePatientStatus(patient.id);
        statusBuckets.get(status).push(patient.id);
    });

    STATUS_PRIORITY.forEach((requiredStatus) => {
        if (statusBuckets.get(requiredStatus).length > 0) return;

        const donorStatus = STATUS_PRIORITY.find((status) => statusBuckets.get(status).length > 1);
        if (!donorStatus) return;

        const donorPatientId = statusBuckets.get(donorStatus).pop();
        patientStatusById.set(donorPatientId, requiredStatus);
        statusBuckets.get(requiredStatus).push(donorPatientId);
    });
}

async function displayPatientDetails(patientId) {
    currentPatientId = patientId;
    try {
        welcomeMessageEl.classList.add('hidden');
        patientDetailsEl.classList.remove('hidden');

        const patient = await apiFetch(`/api/patients/${patientId}`);
        patientNameEl.textContent = patient.full_name;

        startDateInput.value = '';
        endDateInput.value = '';
        startTimeInput.value = '';
        endTimeInput.value = '';

        const [chartData, recommendationsData] = await Promise.all([
            apiFetch(`/api/patients/${currentPatientId}/comprehensive_data`),
            apiFetch(`/api/patients/${currentPatientId}/recommendations`)
        ]);

        comprehensiveData = chartData;
        renderComprehensiveView();
        renderRecommendations(recommendationsData);
        await loadPatientDiary(currentPatientId);
    } catch (error) { console.error("Не удалось загрузить данные пациента:", error); }
}

async function updateComprehensiveChart() {
    if (!currentPatientId) return;
    let endpoint = `/api/patients/${currentPatientId}/comprehensive_data`;

    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    if (startDate && endDate) {
        const startTime = startTimeInput.value || "00:00";
        const endTime = endTimeInput.value || "23:59";
        const startISO = `${startDate}T${startTime}`;
        const endISO = `${endDate}T${endTime}`;
        endpoint += `?start_datetime=${startISO}&end_datetime=${endISO}`;
    }

    try {
        comprehensiveData = await apiFetch(endpoint);
        renderComprehensiveView();
    } catch (error) { console.error("Не удалось обновить график:", error); }
}

function formatDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatTimeInputValue(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function setQuickRangeActiveButton(activeButton) {
    [lastDayRangeBtn, lastMonthRangeBtn, lastThreeMonthsRangeBtn].forEach((btn) => {
        if (!btn) return;
        btn.classList.toggle('active', btn === activeButton);
    });
}

function applyQuickRange(period) {
    const end = new Date();
    const start = new Date(end);

    if (period === 'day') {
        start.setDate(start.getDate() - 1);
    } else if (period === 'month') {
        start.setMonth(start.getMonth() - 1);
    } else if (period === '3months') {
        start.setMonth(start.getMonth() - 3);
    }

    startDateInput.value = formatDateInputValue(start);
    startTimeInput.value = formatTimeInputValue(start);
    endDateInput.value = formatDateInputValue(end);
    endTimeInput.value = formatTimeInputValue(end);

    updateComprehensiveChart();
}

function formatTimestampForTable(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('ru-RU');
}

function toNumberArray(points) {
    return (points || [])
        .map((point) => Number(point.y))
        .filter((value) => Number.isFinite(value));
}

function sum(values) {
    return values.reduce((acc, value) => acc + value, 0);
}

function roundTo(value, digits = 1) {
    return Number(value).toFixed(digits);
}

function updateStatValue(element, value) {
    if (!element) return;
    element.textContent = value;
}

function resetStatistics() {
    updateStatValue(statReadingsCountEl, '-');
    updateStatValue(statAvgGlucoseEl, '-');
    updateStatValue(statMinGlucoseEl, '-');
    updateStatValue(statMaxGlucoseEl, '-');
    updateStatValue(statStdGlucoseEl, '-');
    updateStatValue(statTirEl, '-');
    updateStatValue(statHypoCountEl, '-');
    updateStatValue(statHyperCountEl, '-');
    updateStatValue(statTotalCarbsEl, '-');
    updateStatValue(statTotalInsulinEl, '-');
}

function renderPeriodStatistics(apiData) {
    if (!apiData) {
        updateStatValue(statsPeriodLabelEl, 'Период: не выбран');
        resetStatistics();
        return;
    }

    const glucoseValues = toNumberArray(apiData.glucose);
    const carbsValues = toNumberArray(apiData.carbs);
    const insulinValues = toNumberArray(apiData.insulin);

    const startDateTime = startDateInput.value && startTimeInput.value ? `${startDateInput.value} ${startTimeInput.value}` : '';
    const endDateTime = endDateInput.value && endTimeInput.value ? `${endDateInput.value} ${endTimeInput.value}` : '';
    const periodText = startDateTime && endDateTime
        ? `Период: ${startDateTime} - ${endDateTime}`
        : 'Период: последние 7 дней (по умолчанию)';
    updateStatValue(statsPeriodLabelEl, periodText);

    if (glucoseValues.length === 0) {
        resetStatistics();
        return;
    }

    const glucoseCount = glucoseValues.length;
    const glucoseSum = sum(glucoseValues);
    const glucoseAvg = glucoseSum / glucoseCount;
    const glucoseMin = Math.min(...glucoseValues);
    const glucoseMax = Math.max(...glucoseValues);
    const variance = glucoseValues.reduce((acc, value) => acc + (value - glucoseAvg) ** 2, 0) / glucoseCount;
    const stdDev = Math.sqrt(variance);

    const inRangeCount = glucoseValues.filter((value) => value >= 3.9 && value <= 10.0).length;
    const hypoCount = glucoseValues.filter((value) => value < 3.9).length;
    const hyperCount = glucoseValues.filter((value) => value > 10.0).length;
    const tir = (inRangeCount / glucoseCount) * 100;

    const totalCarbs = sum(carbsValues);
    const totalInsulin = sum(insulinValues);

    updateStatValue(statReadingsCountEl, String(glucoseCount));
    updateStatValue(statAvgGlucoseEl, `${roundTo(glucoseAvg)} ммоль/л`);
    updateStatValue(statMinGlucoseEl, `${roundTo(glucoseMin)} ммоль/л`);
    updateStatValue(statMaxGlucoseEl, `${roundTo(glucoseMax)} ммоль/л`);
    updateStatValue(statStdGlucoseEl, roundTo(stdDev, 2));
    updateStatValue(statTirEl, `${roundTo(tir, 1)}%`);
    updateStatValue(statHypoCountEl, String(hypoCount));
    updateStatValue(statHyperCountEl, String(hyperCount));
    updateStatValue(statTotalCarbsEl, roundTo(totalCarbs, 1));
    updateStatValue(statTotalInsulinEl, roundTo(totalInsulin, 1));
}

function buildRowMap(points) {
    const map = new Map();
    points.forEach((point) => {
        if (point && point.x !== undefined && point.y !== undefined) {
            map.set(String(point.x), point.y);
        }
    });
    return map;
}

function renderComprehensiveTable(apiData) {
    comprehensiveTableBodyEl.innerHTML = '';
    if (!apiData) return;

    const glucoseMap = buildRowMap(apiData.glucose || []);
    const carbsMap = buildRowMap(apiData.carbs || []);
    const insulinMap = buildRowMap(apiData.insulin || []);

    const timestamps = new Set([
        ...glucoseMap.keys(),
        ...carbsMap.keys(),
        ...insulinMap.keys()
    ]);

    const sortedTimestamps = Array.from(timestamps).sort((a, b) => new Date(a) - new Date(b));

    if (sortedTimestamps.length === 0) {
        comprehensiveTableBodyEl.innerHTML = '<tr><td colspan="4">Нет данных за выбранный период</td></tr>';
        return;
    }

    sortedTimestamps.forEach((timestamp) => {
        const row = document.createElement('tr');
        const glucose = glucoseMap.get(timestamp);
        const carbs = carbsMap.get(timestamp);
        const insulin = insulinMap.get(timestamp);

        row.innerHTML = `
            <td>${formatTimestampForTable(timestamp)}</td>
            <td>${glucose ?? '-'}</td>
            <td>${carbs ?? '-'}</td>
            <td>${insulin ?? '-'}</td>
        `;
        comprehensiveTableBodyEl.appendChild(row);
    });
}

function updateMonitoringViewUI() {
    const isChart = currentMonitoringView === 'chart';
    chartWrapperEl.classList.toggle('hidden', !isChart);
    tableWrapperEl.classList.toggle('hidden', isChart);
    if (monitoringChartActionsEl) {
        monitoringChartActionsEl.classList.toggle('hidden', !isChart);
        monitoringChartActionsEl.setAttribute('aria-hidden', isChart ? 'false' : 'true');
    }
    viewChartBtn.classList.toggle('active', isChart);
    viewTableBtn.classList.toggle('active', !isChart);

    if (isChart && glucoseChart) {
        setTimeout(() => glucoseChart.resize(), 0);
    }
}

function renderComprehensiveView() {
    if (!comprehensiveData) return;
    renderComprehensiveChart(comprehensiveData);
    renderComprehensiveTable(comprehensiveData);
    renderPeriodStatistics(comprehensiveData);
    updateMonitoringViewUI();
}

function renderComprehensiveChart(apiData) {
    const chart = ensureGlucoseChart();
    if (!chart) return;
    chart.setOption(buildComprehensiveChartOption(apiData));
    chart.resize();
}

function renderRecommendations(data) {
    recommendationsListEl.innerHTML = '';
    if (data.recommendations && data.recommendations.length > 0) {
        data.recommendations.forEach(text => {
            const li = document.createElement('li');
            li.textContent = text;
            recommendationsListEl.appendChild(li);
        });
    }
}

function setDiaryMessage(text) {
    if (!patientDiaryBodyEl) return;
    patientDiaryBodyEl.innerHTML = `<tr><td colspan="2">${text}</td></tr>`;
}

function renderPatientDiary(entries) {
    if (!patientDiaryBodyEl) return;
    patientDiaryBodyEl.innerHTML = '';

    if (!entries || entries.length === 0) {
        setDiaryMessage('Нет записей дневника самоконтроля');
        return;
    }

    entries.forEach((entry) => {
        const row = document.createElement('tr');
        const timeCell = document.createElement('td');
        const textCell = document.createElement('td');

        timeCell.textContent = formatTimestampForTable(entry.timestamp);
        textCell.textContent = entry.text || '-';
        textCell.className = 'diary-text-cell';

        row.appendChild(timeCell);
        row.appendChild(textCell);
        patientDiaryBodyEl.appendChild(row);
    });
}

async function loadPatientDiary(patientId) {
    if (!patientDiaryBodyEl) return;
    if (!patientId) {
        setDiaryMessage('Выберите пациента для просмотра дневника.');
        return;
    }

    setDiaryMessage('Загрузка дневника...');
    try {
        const entries = await apiFetch(`/api/patients/${patientId}/diary`);
        renderPatientDiary(entries);
    } catch (error) {
        console.error('Не удалось загрузить дневник пациента:', error);
        setDiaryMessage(`Ошибка загрузки: ${error.message}`);
    }
}

// --- Обработчики событий ---
if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', cycleThemeMode);
    updateThemeToggleLabel();
}
initZoomControls();
bindChartActionPanel(monitoringChartActionsEl, 'monitoring', ensureGlucoseChart);
bindChartActionPanel(simChartActionsEl, 'simulation', ensureSimulationChart);

updateChartBtn.addEventListener('click', updateComprehensiveChart);
resetChartBtn.addEventListener('click', () => {
    if (currentPatientId) displayPatientDetails(currentPatientId);
});
viewChartBtn.addEventListener('click', () => {
    currentMonitoringView = 'chart';
    updateMonitoringViewUI();
});
viewTableBtn.addEventListener('click', () => {
    currentMonitoringView = 'table';
    updateMonitoringViewUI();
});
lastDayRangeBtn.addEventListener('click', () => {
    setQuickRangeActiveButton(lastDayRangeBtn);
    applyQuickRange('day');
});
lastMonthRangeBtn.addEventListener('click', () => {
    setQuickRangeActiveButton(lastMonthRangeBtn);
    applyQuickRange('month');
});
lastThreeMonthsRangeBtn.addEventListener('click', () => {
    setQuickRangeActiveButton(lastThreeMonthsRangeBtn);
    applyQuickRange('3months');
});
[startDateInput, startTimeInput, endDateInput, endTimeInput].forEach((input) => {
    input.addEventListener('input', () => setQuickRangeActiveButton(null));
});
if (refreshDiaryBtn) {
    refreshDiaryBtn.addEventListener('click', () => {
        if (currentPatientId) {
            loadPatientDiary(currentPatientId);
        }
    });
}

const recommendTextEl = document.getElementById('recommendation-text');
const interpretBtn = document.getElementById('interpret-btn');
const confirmationFormEl = document.getElementById('confirmation-form');
const parsedResultsEl = document.getElementById('parsed-results');

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildRecommendationCardHtml(item) {
    const colorVariant = item.colorVariant || 'default';
    const kindBadge = item.kind && item.kind !== 'free_text'
        ? `<span class="recommendation-kind">${escapeHtml(item.kind)}</span>`
        : '';
    const scheduleHtml = item.scheduleText
        ? `<p class="recommendation-meta recommendation-time">${escapeHtml(item.scheduleText)}</p>`
        : '';
    const primaryValueHtml = item.primaryValue
        ? `<p class="recommendation-primary">${escapeHtml(item.primaryValue)}</p>`
        : '';
    const secondaryValueHtml = item.secondaryValue
        ? `<p class="recommendation-secondary">${escapeHtml(item.secondaryValue)}</p>`
        : '';
    const conditionHtml = item.conditionText
        ? `<p class="recommendation-meta">${escapeHtml(item.conditionText)}</p>`
        : '';
    const confidenceHtml = item.confidenceText
        ? `<p class="recommendation-meta recommendation-confidence">${escapeHtml(item.confidenceText)}</p>`
        : '';
    const rawTextHtml = item.rawText
        ? `
            <details class="recommendation-raw">
                <summary>Исходный текст</summary>
                <p>${escapeHtml(item.rawText)}</p>
            </details>`
        : '';

    return `
        <article class="result-card recommendation-result-card recommendation-result-card--${escapeHtml(colorVariant)}" data-kind="${escapeHtml(item.kind)}" data-id="${escapeHtml(item.id)}">
            <div class="recommendation-header">
                <h5>${escapeHtml(item.title || 'Рекомендация')}</h5>
                ${kindBadge}
            </div>
            ${scheduleHtml}
            ${primaryValueHtml}
            ${secondaryValueHtml}
            ${conditionHtml}
            ${confidenceHtml}
            ${rawTextHtml}
        </article>
    `;
}

interpretBtn.addEventListener('click', async () => {
    const text = recommendTextEl.value;
    if (!text || !currentPatientId) return;

    try {
        let interpretation;
        try {
            interpretation = await apiFetch(`/api/recommendations/interpret-multi`, {
                method: 'POST',
                body: JSON.stringify({ text: text })
            });
        } catch (multiError) {
            console.warn('interpret-multi failed, fallback to interpret:', multiError);
            interpretation = await apiFetch(`/api/recommendations/interpret`, {
                method: 'POST',
                body: JSON.stringify({ text: text })
            });
        }

        try {
            renderConfirmationForm(interpretation);
        } catch (renderError) {
            console.error('Ошибка рендера интерпретации:', renderError, interpretation);
            parsedResultsEl.innerHTML = `<p class="no-results">Получены данные, но не удалось отобразить результат. Проверьте формат ответа сервера.</p>`;
        }
        confirmationFormEl.classList.remove('hidden');

    } catch (error) {
        alert(`Ошибка интерпретации: ${error.message}`);
    }
});

function renderConfirmationForm(data) {
    const mapper = window.RecommendationViewModel;
    const displayItems = mapper && typeof mapper.toDisplayItemsFromInterpretation === 'function'
        ? mapper.toDisplayItemsFromInterpretation(data)
        : [];
    if (displayItems.length > 0) {
        parsedResultsEl.innerHTML = displayItems.map(buildRecommendationCardHtml).join('');
        return;
    }
    parsedResultsEl.innerHTML = ''; // Очищаем старые результаты

    let htmlContent = '';

    if (data.basal_changes?.length > 0) {
        data.basal_changes.forEach((change, index) => {
            const sign = change.change_percent >= 0 ? '+' : '';
            const typeText = "Базальный Профиль";

            htmlContent += `
                <div class="result-card basal-card" data-type="basal" data-index="${index}">
                    <h5>${typeText}</h5>
                    <label>Временной сегмент:</label>
                    <input type="text" class="time-segment" value="${change.time_segment}">
                    <label>Изменение:</label>
                    <div class="input-group">
                        <input type="number" class="change-percent" value="${change.change_percent}">
                        <span>%</span>
                    </div>
                </div>`;
        });
    }

    if (data.carb_ratio_changes?.length > 0) {
        data.carb_ratio_changes.forEach((change, index) => {
            const typeText = "Углеводный Коэффициент (УК)";

            htmlContent += `
                <div class="result-card carb-card" data-type="carb" data-index="${index}">
                    <h5>${typeText}</h5>
                    <label>Прием пищи:</label>
                    <input type="text" class="meal-time" value="${change.meal_time}">
                    <label>Грамм на 1 ЕД:</label>
                    <div class="input-group">
                        <span>1 : </span>
                        <input type="number" class="carb-value" value="${change.value}">
                    </div>
                </div>`;
        });
    }

    parsedResultsEl.innerHTML = htmlContent;
    if (htmlContent === '') {
        parsedResultsEl.innerHTML = `<p class="no-results">Не удалось извлечь параметры. Попробуйте более точную формулировку.</p>`;
    }
}

// ... (В конце файла) ...

// --- ЛОГИКА СИМУЛЯТОРА ---
function getSelectedScenario() {
    const selectedIdRaw = simScenarioSelectEl.value;
    if (!selectedIdRaw) return null;
    if (selectedIdRaw === 'new') return null;
    const selectedId = Number(selectedIdRaw);
    return simulatorScenarios.find((s) => Number(s.scenario_id) === selectedId) || null;
}

function renderScenarioSelect() {
    simScenarioSelectEl.innerHTML = '';
    simulatorScenarios.forEach((scenario, index) => {
        const option = document.createElement('option');
        option.value = String(scenario.scenario_id);
        option.textContent = `Сценарий #${scenario.scenario_id ?? index + 1}`;
        simScenarioSelectEl.appendChild(option);
    });
}

function drawSimulationChart(time, glucose) {
    const chart = ensureSimulationChart();
    if (!chart) return;
    simulationChartState = { time: [...(time || [])], glucose: [...(glucose || [])] };
    chart.setOption(buildSimulationChartOption(time, glucose));
    chart.resize();
}

function resetSimulationStatistics() {
    updateStatValue(simStatsPeriodLabelEl, 'Симуляция не запускалась');
    updateStatValue(simStatAvgEl, '-');
    updateStatValue(simStatMinEl, '-');
    updateStatValue(simStatMaxEl, '-');
    updateStatValue(simStatTirEl, '-');
}

function normalizeSimulationGlucose(values) {
    if (!Array.isArray(values)) return [];
    const numeric = values.map(Number).filter(Number.isFinite);
    if (numeric.length === 0) return [];

    // Backward compatibility: old API may return glucose in mg/dL.
    const looksLikeMgDl = numeric.some((v) => v > 40);
    return looksLikeMgDl ? numeric.map((v) => v / 18) : numeric;
}

function normalizeSimulationMetrics(metrics) {
    if (!metrics || typeof metrics !== 'object') return metrics;
    const normalized = { ...metrics };
    const average = Number(normalized.average);
    const looksLikeMgDl = Number.isFinite(average) && average > 40;
    if (!looksLikeMgDl) return normalized;

    ['average', 'average_before_meals', 'average_after_meals', 'min', 'max', 'min_with_30min_meal_delay', 'integral_above_180']
        .forEach((key) => {
            const value = Number(normalized[key]);
            if (Number.isFinite(value)) normalized[key] = value / 18;
        });

    return normalized;
}

function computeTirFromGlucoseMmol(glucoseMmol) {
    if (!Array.isArray(glucoseMmol)) return null;
    const values = glucoseMmol.map(Number).filter(Number.isFinite);
    if (values.length === 0) return null;
    return values.filter((v) => v >= 3.9 && v <= 10.0).length / values.length;
}

function renderSimulationStatistics(metrics, glucoseMmol = []) {
    const safeMetrics = normalizeSimulationMetrics(metrics);
    const tirFromSeries = computeTirFromGlucoseMmol(glucoseMmol);
    updateStatValue(simStatsPeriodLabelEl, 'Симуляция выполнена');
    if (!safeMetrics) {
        updateStatValue(simStatAvgEl, '-');
        updateStatValue(simStatMinEl, '-');
        updateStatValue(simStatMaxEl, '-');
        updateStatValue(simStatTirEl, '-');
        return;
    }

    updateStatValue(
        simStatAvgEl,
        Number.isFinite(Number(safeMetrics.average)) ? `${roundTo(Number(safeMetrics.average), 2)} ммоль/л` : '-'
    );
    updateStatValue(
        simStatMinEl,
        Number.isFinite(Number(safeMetrics.min)) ? `${roundTo(Number(safeMetrics.min), 2)} ммоль/л` : '-'
    );
    updateStatValue(
        simStatMaxEl,
        Number.isFinite(Number(safeMetrics.max)) ? `${roundTo(Number(safeMetrics.max), 2)} ммоль/л` : '-'
    );
    updateStatValue(
        simStatTirEl,
        Number.isFinite(Number(tirFromSeries))
            ? `${roundTo(Number(tirFromSeries) * 100, 1)}%`
            : Number.isFinite(Number(safeMetrics.fraction_within_target))
            ? `${roundTo(Number(safeMetrics.fraction_within_target) * 100, 1)}%`
            : '-'
    );
}

async function loadSimulatorConfig(patientId) {
    simParamsCodeEl.value = 'Загрузка параметров...';
    simScenarioCodeEl.value = 'Загрузка сценариев...';
    try {
        const payload = await apiFetch(`/api/simulator/patients/${patientId}/config`);
        simParamsCodeEl.value = JSON.stringify(payload.parameters, null, 2);

        simulatorScenarios = payload.scenarios || [];
        if (simulatorScenarios.length === 0) {
            simulatorScenarios = [{ scenario_id: null, scenario_data: {} }];
        }
        renderScenarioSelect();
        simScenarioSelectEl.value = String(simulatorScenarios[0].scenario_id ?? '');
        simScenarioCodeEl.value = JSON.stringify(simulatorScenarios[0].scenario_data, null, 2);
    } catch (error) {
        console.error('Failed to load simulator config:', error);
        simParamsCodeEl.value = `Ошибка загрузки: ${error.message}`;
        simScenarioCodeEl.value = `Ошибка загрузки: ${error.message}`;
    }
}

simScenarioSelectEl?.addEventListener('change', () => {
    const selected = getSelectedScenario();
    if (!selected) return;
    simScenarioCodeEl.value = JSON.stringify(selected.scenario_data, null, 2);
});

simNewScenarioBtn?.addEventListener('click', () => {
    simScenarioCodeEl.value = JSON.stringify(
        {
            M: 90,
            tm: 60,
            Tm: 20,
            t0: 0,
            t1: 720,
            ti_1: 30,
            ti_2: 60,
            Ti_1: 10,
            Ti_2: 10,
            Dbol_1: 2.6,
            Dbol_2: 4.0,
            Vbas: 1.22
        },
        null,
        2
    );
    simScenarioSelectEl.value = '';
});

simSaveParamsBtn?.addEventListener('click', async () => {
    if (!currentPatientId) return;
    try {
        const parsed = JSON.parse(simParamsCodeEl.value);
        await apiFetch(`/api/simulator/patients/${currentPatientId}/parameters`, {
            method: 'PUT',
            body: JSON.stringify({ parameters: parsed })
        });
        alert('Параметры симуляции сохранены');
    } catch (error) {
        alert(`Не удалось сохранить параметры: ${error.message}`);
    }
});

simSaveScenarioBtn?.addEventListener('click', async () => {
    if (!currentPatientId) return;
    try {
        const parsed = JSON.parse(simScenarioCodeEl.value);
        const selected = getSelectedScenario();
        if (selected && selected.scenario_id != null) {
            await apiFetch(`/api/simulator/patients/${currentPatientId}/scenarios/${selected.scenario_id}`, {
                method: 'PUT',
                body: JSON.stringify({ scenario_data: parsed })
            });
        } else {
            await apiFetch(`/api/simulator/patients/${currentPatientId}/scenarios`, {
                method: 'POST',
                body: JSON.stringify({ scenario_data: parsed })
            });
        }
        await loadSimulatorConfig(currentPatientId);
        alert('Сценарий симуляции сохранен');
    } catch (error) {
        alert(`Не удалось сохранить сценарий: ${error.message}`);
    }
});

simRunBtn?.addEventListener('click', async () => {
    if (!currentPatientId) return;
    try {
        const parameters = JSON.parse(simParamsCodeEl.value);
        const scenario_data = JSON.parse(simScenarioCodeEl.value);
        const model_type = simModelTypeEl?.value || 'sibr';
        const cgm_noise_seed = simCgmSeedEl?.value !== '' ? Number(simCgmSeedEl.value) : null;
        const result = await apiFetch(`/api/simulator/patients/${currentPatientId}/run`, {
            method: 'POST',
            body: JSON.stringify({ parameters, scenario_data, model_type, cgm_noise_seed })
        });
        const glucoseForChart = Array.isArray(result.glucose_mmol) && result.glucose_mmol.length > 0
            ? result.glucose_mmol
            : normalizeSimulationGlucose(result.glucose || []);
        drawSimulationChart(result.time || [], glucoseForChart);
        renderSimulationStatistics(result.metrics, glucoseForChart);
    } catch (error) {
        alert(`Ошибка симуляции: ${error.message}`);
    }
});

// --- ЛОГИКА ПЕРЕКЛЮЧЕНИЯ ВКЛАДОК ---
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

function switchTab(tabId) {
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(ct => ct.classList.remove('visible'));

    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('visible');

    if (tabId === 'monitoring' && glucoseChart) {
        setTimeout(() => glucoseChart.resize(), 50);
    }

    if (tabId === 'patient-sim' && currentPatientId) {
        loadSimulatorConfig(currentPatientId);
        if (simChart) {
            setTimeout(() => simChart.resize(), 50);
        }
    }
    if (tabId === 'patient-diary' && currentPatientId) {
        loadPatientDiary(currentPatientId);
    }
}

tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        switchTab(tabId);
    });
});

// Стартовое состояние
switchTab('monitoring');
resetSimulationStatistics();


window.addEventListener('app-theme-changed', () => {
    updateThemeToggleLabel();
    if (comprehensiveData) {
        renderComprehensiveChart(comprehensiveData);
    }
    if (simulationChartState) {
        drawSimulationChart(simulationChartState.time, simulationChartState.glucose);
    }
});

window.addEventListener('beforeunload', () => {
    if (glucoseChart) {
        glucoseChart.dispose();
        glucoseChart = null;
    }
    if (simChart) {
        simChart.dispose();
        simChart = null;
    }
});
