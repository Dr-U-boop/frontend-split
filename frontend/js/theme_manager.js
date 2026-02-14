(function () {
    const THEME_STORAGE_KEY = 'appThemePreference';
    const MODE_LIGHT = 'light';
    const MODE_DARK = 'dark';
    const MODE_AUTO = 'auto';
    const SUPPORTED_MODES = new Set([MODE_LIGHT, MODE_DARK, MODE_AUTO]);
    const MODAL_ID = 'theme-choice-modal';
    const style = document.documentElement.style;

    let autoSwitchTimer = null;

    function getStoredMode() {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        return SUPPORTED_MODES.has(saved) ? saved : null;
    }

    function setStoredMode(mode) {
        localStorage.setItem(THEME_STORAGE_KEY, mode);
    }

    function getMode() {
        return getStoredMode() || MODE_AUTO;
    }

    function toRadians(degrees) {
        return (degrees * Math.PI) / 180;
    }

    function toDegrees(radians) {
        return (radians * 180) / Math.PI;
    }

    function normalizeAngle(angle) {
        let result = angle % 360;
        if (result < 0) result += 360;
        return result;
    }

    function getCoordinatesForCurrentZone() {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        const coordsByTimeZone = {
            'Europe/Moscow': { lat: 55.7558, lon: 37.6176 },
            'Europe/Kaliningrad': { lat: 54.7104, lon: 20.4522 },
            'Europe/Samara': { lat: 53.1959, lon: 50.1008 },
            'Europe/Volgograd': { lat: 48.708, lon: 44.5133 },
            'Asia/Yekaterinburg': { lat: 56.8389, lon: 60.6057 },
            'Asia/Omsk': { lat: 54.9885, lon: 73.3242 },
            'Asia/Novosibirsk': { lat: 55.0084, lon: 82.9357 },
            'Asia/Krasnoyarsk': { lat: 56.0153, lon: 92.8932 },
            'Asia/Irkutsk': { lat: 52.2869, lon: 104.305 },
            'Asia/Yakutsk': { lat: 62.0355, lon: 129.6755 },
            'Asia/Vladivostok': { lat: 43.1198, lon: 131.8869 },
            'Asia/Magadan': { lat: 59.5612, lon: 150.8301 },
            'Asia/Kamchatka': { lat: 53.0449, lon: 158.6508 },
            'America/New_York': { lat: 40.7128, lon: -74.006 },
            'America/Chicago': { lat: 41.8781, lon: -87.6298 },
            'America/Denver': { lat: 39.7392, lon: -104.9903 },
            'America/Los_Angeles': { lat: 34.0522, lon: -118.2437 },
            'Europe/London': { lat: 51.5074, lon: -0.1278 }
        };

        if (coordsByTimeZone[timeZone]) {
            return coordsByTimeZone[timeZone];
        }

        // Fallback when timezone is unknown: use timezone offset as rough longitude.
        const offsetHours = -new Date().getTimezoneOffset() / 60;
        return { lat: 45, lon: offsetHours * 15 };
    }

    // Based on NOAA sunrise/sunset equations.
    function calculateSunEvents(date, lat, lon) {
        const utcNoon = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
        const daysSinceJ2000 = (utcNoon - Date.UTC(2000, 0, 1, 12, 0, 0)) / 86400000;

        const meanSolarTime = daysSinceJ2000 - lon / 360;
        const solarMeanAnomaly = normalizeAngle(357.5291 + 0.98560028 * meanSolarTime);
        const anomalyRad = toRadians(solarMeanAnomaly);

        const equationOfCenter = 1.9148 * Math.sin(anomalyRad)
            + 0.02 * Math.sin(2 * anomalyRad)
            + 0.0003 * Math.sin(3 * anomalyRad);

        const eclipticLongitude = normalizeAngle(solarMeanAnomaly + equationOfCenter + 180 + 102.9372);
        const eclipticRad = toRadians(eclipticLongitude);
        const declination = Math.asin(Math.sin(eclipticRad) * Math.sin(toRadians(23.44)));

        const solarTransit = 2451545 + meanSolarTime + 0.0053 * Math.sin(anomalyRad) - 0.0069 * Math.sin(2 * eclipticRad);

        const latRad = toRadians(lat);
        const sunAltitude = toRadians(-0.833);
        const cosHourAngle = (Math.sin(sunAltitude) - Math.sin(latRad) * Math.sin(declination))
            / (Math.cos(latRad) * Math.cos(declination));

        if (cosHourAngle <= -1) {
            return { sunrise: null, sunset: null, polarDay: true, polarNight: false };
        }
        if (cosHourAngle >= 1) {
            return { sunrise: null, sunset: null, polarDay: false, polarNight: true };
        }

        const hourAngle = Math.acos(cosHourAngle);
        const hourAngleDegrees = toDegrees(hourAngle);
        const sunriseJulian = solarTransit - hourAngleDegrees / 360;
        const sunsetJulian = solarTransit + hourAngleDegrees / 360;

        const unixEpochJd = 2440587.5;
        const sunriseUtcMs = (sunriseJulian - unixEpochJd) * 86400000;
        const sunsetUtcMs = (sunsetJulian - unixEpochJd) * 86400000;

        return {
            sunrise: new Date(sunriseUtcMs),
            sunset: new Date(sunsetUtcMs),
            polarDay: false,
            polarNight: false
        };
    }

    function resolveAutoTheme(now = new Date()) {
        const { lat, lon } = getCoordinatesForCurrentZone();
        const events = calculateSunEvents(now, lat, lon);

        if (events.polarDay) {
            return { effectiveTheme: MODE_LIGHT, events };
        }
        if (events.polarNight) {
            return { effectiveTheme: MODE_DARK, events };
        }

        const { sunrise, sunset } = events;
        const isDark = now < sunrise || now >= sunset;
        return { effectiveTheme: isDark ? MODE_DARK : MODE_LIGHT, events };
    }

    function getNextAutoSwitchTime(now, events) {
        if (events.polarDay || events.polarNight || !events.sunrise || !events.sunset) {
            return null;
        }

        if (now < events.sunrise) return events.sunrise;
        if (now < events.sunset) return events.sunset;

        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const { lat, lon } = getCoordinatesForCurrentZone();
        const tomorrowEvents = calculateSunEvents(tomorrow, lat, lon);
        return tomorrowEvents.sunrise || null;
    }

    function applyTheme(effectiveTheme, selectedMode) {
        const isDark = effectiveTheme === MODE_DARK;
        document.documentElement.setAttribute('data-theme', isDark ? MODE_DARK : MODE_LIGHT);
        style.colorScheme = isDark ? 'dark' : 'light';

        window.dispatchEvent(new CustomEvent('app-theme-changed', {
            detail: {
                selectedMode,
                effectiveTheme: isDark ? MODE_DARK : MODE_LIGHT
            }
        }));
    }

    function applyCurrentTheme() {
        const mode = getMode();
        const now = new Date();

        if (autoSwitchTimer) {
            clearTimeout(autoSwitchTimer);
            autoSwitchTimer = null;
        }

        if (mode === MODE_AUTO) {
            const autoInfo = resolveAutoTheme(now);
            applyTheme(autoInfo.effectiveTheme, mode);
            const nextSwitch = getNextAutoSwitchTime(now, autoInfo.events);
            if (nextSwitch) {
                const timeout = Math.max(1000, nextSwitch.getTime() - now.getTime() + 1000);
                autoSwitchTimer = setTimeout(applyCurrentTheme, timeout);
            }
            return;
        }

        applyTheme(mode, mode);
    }

    function closeThemeModal() {
        const modal = document.getElementById(MODAL_ID);
        if (modal) {
            modal.remove();
        }
    }

    function saveModeAndApply(mode) {
        setStoredMode(mode);
        applyCurrentTheme();
        closeThemeModal();
    }

    function createThemeModal() {
        const modal = document.createElement('div');
        modal.id = MODAL_ID;
        modal.className = 'theme-modal-overlay';
        modal.innerHTML = `
            <div class="theme-modal" role="dialog" aria-modal="true" aria-labelledby="theme-modal-title">
                <h3 id="theme-modal-title">Выберите тему приложения</h3>
                <p>Настройка применяется ко всем экранам.</p>
                <div class="theme-modal-buttons">
                    <button type="button" data-theme-choice="${MODE_LIGHT}">Светлая</button>
                    <button type="button" data-theme-choice="${MODE_DARK}">Тёмная</button>
                    <button type="button" data-theme-choice="${MODE_AUTO}">Авто (закат)</button>
                </div>
            </div>
        `;

        modal.querySelectorAll('[data-theme-choice]').forEach((button) => {
            button.addEventListener('click', () => {
                saveModeAndApply(button.getAttribute('data-theme-choice'));
            });
        });

        return modal;
    }

    function ensureThemeChosen() {
        if (getStoredMode()) return;
        if (document.getElementById(MODAL_ID)) return;
        document.body.appendChild(createThemeModal());
    }

    function init() {
        applyCurrentTheme();
        ensureThemeChosen();
    }

    window.appTheme = {
        applyCurrentTheme,
        getMode,
        setMode: saveModeAndApply
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
