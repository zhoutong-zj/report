/**
 * Global Theme Manager for Train Report Web
 * Supports Light & Dark themes, system preference detection,
 * cross-iframe synchronization, and Chart.js theme adaptation.
 */

(function () {
    const THEME_STORAGE_KEY = 'train_report_theme_v2';

    // 1. 获取当前存储的主题（系统默认是夜间模式）
    function getPreferredTheme() {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'dark' || stored === 'light') {
            return stored;
        }
        // 系统默认是夜间模式
        return 'dark';
    }

    // 2. 立即应用主题（防止页面刷新时发生白屏闪烁）
    const initialTheme = getPreferredTheme();
    document.documentElement.setAttribute('data-theme', initialTheme);

    // 3. 全局 ThemeManager 命名空间
    window.ThemeManager = {
        STORAGE_KEY: THEME_STORAGE_KEY,

        getTheme: function () {
            return document.documentElement.getAttribute('data-theme') || getPreferredTheme();
        },

        setTheme: function (theme, broadcast = true) {
            if (theme !== 'dark' && theme !== 'light') return;

            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem(THEME_STORAGE_KEY, theme);

            // 触发自定义事件供本页面内部监听（如 Chart.js 重绘）
            window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));

            // 如果是在主页面中，向当前 iframe 广播
            if (broadcast) {
                const contentFrame = document.getElementById('contentFrame');
                if (contentFrame && contentFrame.contentWindow) {
                    try {
                        contentFrame.contentWindow.postMessage({ action: 'themeChange', theme: theme }, '*');
                    } catch (e) {
                        console.warn('Failed to postMessage to iframe:', e);
                    }
                }
            }
        },

        toggleTheme: function () {
            const current = this.getTheme();
            const next = current === 'dark' ? 'light' : 'dark';
            this.setTheme(next, true);
            return next;
        },

        // 获取图表适配的颜色配置（支持 ECharts 和 Chart.js）
        getChartTheme: function (theme) {
            const isDark = (theme || this.getTheme()) === 'dark';
            return {
                isDark: isDark,
                textColor: isDark ? '#94a3b8' : '#606266',
                gridColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                borderColor: isDark ? '#334155' : '#e2e8f0',
                tooltipBg: isDark ? '#1e293b' : '#ffffff',
                tooltipText: isDark ? '#f8fafc' : '#303133',
                tooltipBorder: isDark ? '#334155' : '#e4e7ed',
                legendColor: isDark ? '#cbd5e1' : '#606266'
            };
        },

        // ECharts 专用初始化与主题自适应方法
        initEChart: function (dom, theme) {
            if (!dom || typeof echarts === 'undefined') return null;
            const currentTheme = theme || this.getTheme();
            const isDark = currentTheme === 'dark';

            // 如果已有实例先销毁
            const existing = echarts.getInstanceByDom(dom);
            if (existing) {
                existing.dispose();
            }

            const chart = echarts.init(dom, isDark ? 'dark' : null, {
                renderer: 'canvas'
            });

            // 自动支持窗口尺寸自适应
            window.addEventListener('resize', () => {
                if (chart && !chart.isDisposed()) {
                    chart.resize();
                }
            });

            return chart;
        },

        // 统一更新指定的 Chart 实例颜色 (兼顾传统 Chart.js)
        updateChartTheme: function (chartInstance, theme) {
            if (!chartInstance) return;
            // 如果是 ECharts 实例
            if (typeof chartInstance.setOption === 'function' && !chartInstance.isDisposed()) {
                // 如果需要刷新主题配置，建议通过业务层在 themeChanged 事件中重新调用 setOption 或重新渲染
                return;
            }
            const colors = this.getChartTheme(theme);

            // 更新 Scale 轴颜色 (Chart.js)
            if (chartInstance.options && chartInstance.options.scales) {
                Object.values(chartInstance.options.scales).forEach(scale => {
                    if (scale.ticks) {
                        scale.ticks.color = colors.textColor;
                    }
                    if (scale.grid) {
                        scale.grid.color = colors.gridColor;
                    }
                    if (scale.title) {
                        scale.title.color = colors.textColor;
                    }
                });
            }

            // 更新图例颜色
            if (chartInstance.options && chartInstance.options.plugins && chartInstance.options.plugins.legend) {
                if (chartInstance.options.plugins.legend.labels) {
                    chartInstance.options.plugins.legend.labels.color = colors.legendColor;
                }
            }

            // 更新 Tooltip
            if (chartInstance.options && chartInstance.options.plugins && chartInstance.options.plugins.tooltip) {
                chartInstance.options.plugins.tooltip.backgroundColor = colors.tooltipBg;
                chartInstance.options.plugins.tooltip.titleColor = colors.tooltipText;
                chartInstance.options.plugins.tooltip.bodyColor = colors.tooltipText;
                chartInstance.options.plugins.tooltip.borderColor = colors.borderColor;
                chartInstance.options.plugins.tooltip.borderWidth = colors.isDark ? 1 : 0;
            }

            try {
                chartInstance.update();
            } catch (e) {
                console.warn('Error updating chart theme:', e);
            }
        }
    };

    // 4. 监听跨窗口/跨域消息（子 iframe 接收主框架的主题变更通知）
    window.addEventListener('message', (event) => {
        if (event.data && event.data.action === 'themeChange') {
            const newTheme = event.data.theme;
            if (newTheme === 'dark' || newTheme === 'light') {
                ThemeManager.setTheme(newTheme, false);
            }
        }
    });

    // 5. 监听浏览器多标签页切换 storage 事件
    window.addEventListener('storage', (e) => {
        if (e.key === THEME_STORAGE_KEY && (e.newValue === 'dark' || e.newValue === 'light')) {
            ThemeManager.setTheme(e.newValue, false);
        }
    });



    // 7. 当在主页面且 iframe 加载完成时，向 iframe 同步当前主题
    window.addEventListener('DOMContentLoaded', () => {
        const contentFrame = document.getElementById('contentFrame');
        if (contentFrame) {
            contentFrame.addEventListener('load', () => {
                const currentTheme = ThemeManager.getTheme();
                try {
                    contentFrame.contentWindow.postMessage({ action: 'themeChange', theme: currentTheme }, '*');
                } catch (e) { }
            });
        }
    });
})();
