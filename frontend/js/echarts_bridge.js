(function initEChartsBridge(global) {
    function createManagedChart(container, options = {}) {
        if (!container || !global.echarts) return null;

        const initOptions = {
            renderer: options.renderer || 'canvas',
            useDirtyRect: options.useDirtyRect !== false
        };

        let instance = global.echarts.getInstanceByDom(container) || global.echarts.init(container, null, initOptions);
        let resizeFrame = 0;

        const scheduleResize = () => {
            cancelAnimationFrame(resizeFrame);
            resizeFrame = requestAnimationFrame(() => {
                if (!instance || (typeof instance.isDisposed === 'function' && instance.isDisposed())) return;
                instance.resize();
            });
        };

        const windowResizeHandler = () => scheduleResize();
        global.addEventListener('resize', windowResizeHandler);

        const resizeObserver = typeof ResizeObserver === 'function'
            ? new ResizeObserver(() => scheduleResize())
            : null;

        if (resizeObserver) {
            resizeObserver.observe(container);
        }

        return {
            getInstance() {
                if (!instance || (typeof instance.isDisposed === 'function' && instance.isDisposed())) {
                    instance = global.echarts.getInstanceByDom(container) || global.echarts.init(container, null, initOptions);
                }
                return instance;
            },
            setOption(option, setOptionOptions = {}) {
                this.getInstance().setOption(option, {
                    notMerge: true,
                    lazyUpdate: true,
                    ...setOptionOptions
                });
            },
            resize() {
                scheduleResize();
            },
            dispatchAction(action) {
                this.getInstance().dispatchAction(action);
            },
            on(eventName, handler) {
                this.getInstance().on(eventName, handler);
            },
            off(eventName, handler) {
                this.getInstance().off(eventName, handler);
            },
            dispose() {
                cancelAnimationFrame(resizeFrame);
                global.removeEventListener('resize', windowResizeHandler);
                if (resizeObserver) {
                    resizeObserver.disconnect();
                }
                if (instance && !(typeof instance.isDisposed === 'function' && instance.isDisposed())) {
                    instance.dispose();
                }
                instance = null;
            }
        };
    }

    global.EChartsBridge = {
        createManagedChart
    };
})(window);
