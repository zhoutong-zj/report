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

    // ==========================================
    // 8. 全局统一：版本号多色彩分类管理系统
    // 确保单日日活、单用户查询、异常详情、学生行为等各列表中的版本号呈现一致的多彩分类
    // ==========================================
    const globalVersionColorMap = new Map();
    const TOTAL_VERSION_PALETTES = 10;

    /**
     * 注册/更新版本列表的色彩映射
     * @param {Array} list 含有版本号的对象数组或纯版本字符串数组
     */
    window.updateVersionColorMapping = function (list) {
        if (!Array.isArray(list)) return;
        const uniqueVersions = [];
        list.forEach(item => {
            let v = '';
            if (typeof item === 'string') {
                v = item;
            } else if (item && typeof item === 'object') {
                v = item.appVersion || item.version || item.versionName || item.platformVersion || '';
            }
            v = (v || '').trim();
            if (v && v !== '-' && !uniqueVersions.includes(v)) {
                uniqueVersions.push(v);
            }
        });

        // 语义降序排序（例如 2.5.4 > 2.5.3 > 2.5.2）
        uniqueVersions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }));

        uniqueVersions.forEach((v) => {
            if (!globalVersionColorMap.has(v)) {
                const usedIndices = new Set(globalVersionColorMap.values());
                let assigned = -1;
                for (let i = 0; i < TOTAL_VERSION_PALETTES; i++) {
                    if (!usedIndices.has(i)) {
                        assigned = i;
                        break;
                    }
                }
                if (assigned === -1) {
                    assigned = globalVersionColorMap.size % TOTAL_VERSION_PALETTES;
                }
                globalVersionColorMap.set(v, assigned);
            }
        });
    };

    /**
     * 获取指定版本号对应的色彩类名
     * @param {string} version
     * @returns {string} 类名，如 'dau-version-c0' 或 'dau-version-default'
     */
    window.getVersionBadgeClass = function (version) {
        const v = (version || '').trim();
        if (!v || v === '-') {
            return 'dau-version-default';
        }
        if (globalVersionColorMap.has(v)) {
            return `dau-version-c${globalVersionColorMap.get(v)}`;
        }
        // 未提前登记时的确定性哈希
        let hash = 0;
        for (let i = 0; i < v.length; i++) {
            hash = ((hash << 5) - hash) + v.charCodeAt(i);
            hash |= 0;
        }
        const colorIdx = Math.abs(hash) % TOTAL_VERSION_PALETTES;
        globalVersionColorMap.set(v, colorIdx);
        return `dau-version-c${colorIdx}`;
    };

    /**
     * 生成统一的多彩版本号徽章 HTML
     * @param {string} version 版本号
     * @param {string} extraClass 附加类名
     * @returns {string} HTML 字符串
     */
    window.createVersionBadgeHtml = function (version, extraClass = '') {
        const v = (version || '-').trim() || '-';
        const colorClass = window.getVersionBadgeClass(v);
        const safeText = v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        return `<span class="version-badge dau-version-badge ${colorClass} ${extraClass}" data-version="${safeText}" title="版本号: ${safeText}">${safeText}</span>`;
    };

    // =========================================================================
    // 全局统一时间管理器 (Global Date Manager)
    // 解决项目中各页面日期不同步、时区偏移等问题，确保“选了今日全部都是今日”
    // =========================================================================
    const GLOBAL_DATE_KEY = 'global_unified_report_date';

    function getLocalTodayStr() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function isValidDateStr(str) {
        if (!str || typeof str !== 'string') return false;
        return /^\d{4}-\d{2}-\d{2}$/.test(str);
    }

    const DateManager = {
        STORAGE_KEY: GLOBAL_DATE_KEY,

        /**
         * 获取当前全局选中的日期，默认为准确的本地系统今日 (YYYY-MM-DD)
         */
        getDate: function () {
            const stored = localStorage.getItem(GLOBAL_DATE_KEY) ||
                           sessionStorage.getItem('reportDate') ||
                           sessionStorage.getItem('dauReportDate') ||
                           sessionStorage.getItem('exceptionReportDate');
            if (isValidDateStr(stored)) {
                return stored;
            }
            return getLocalTodayStr();
        },

        /**
         * 设置全局统一选中的日期，并全站广播同步
         */
        setDate: function (dateStr, broadcast = true) {
            if (!isValidDateStr(dateStr)) return;

            // 持久化存储到各个历史键名，彻底杜绝任何页面读取到旧日期
            localStorage.setItem(GLOBAL_DATE_KEY, dateStr);
            sessionStorage.setItem('reportDate', dateStr);
            sessionStorage.setItem('dauReportDate', dateStr);
            sessionStorage.setItem('exceptionReportDate', dateStr);
            sessionStorage.setItem('autoSearchDate', dateStr);

            // 触发当前页面内部监听
            window.dispatchEvent(new CustomEvent('unifiedDateChanged', { detail: { date: dateStr } }));

            // 跨页面广播
            if (broadcast) {
                // 如果在主框架页面中，向 contentFrame 广播
                const contentFrame = document.getElementById('contentFrame');
                if (contentFrame && contentFrame.contentWindow) {
                    try {
                        contentFrame.contentWindow.postMessage({ action: 'globalDateChange', date: dateStr }, '*');
                    } catch (_) {}
                }
                // 如果是在 iframe 中，向 parent 广播并通知兄弟页面
                if (window.parent && window.parent !== window) {
                    try {
                        window.parent.postMessage({ action: 'globalDateChange', date: dateStr }, '*');
                    } catch (_) {}
                }
            }
        },

        /**
         * 计算相对今天偏移指定天数的日期字符串 (0: 今日, -1: 昨天, -2: 前天)
         */
        getDateWithOffset: function (offset) {
            const target = new Date();
            target.setDate(target.getDate() + (parseInt(offset, 10) || 0));
            const y = target.getFullYear();
            const m = String(target.getMonth() + 1).padStart(2, '0');
            const d = String(target.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        },

        getTodayStr: getLocalTodayStr
    };

    window.DateManager = DateManager;

    // 监听跨 iframe 的 postMessage 日期同步消息
    window.addEventListener('message', (event) => {
        if (!event.data || event.data.action !== 'globalDateChange') return;
        const newDate = event.data.date;
        if (isValidDateStr(newDate)) {
            // 更新本窗口存储
            localStorage.setItem(GLOBAL_DATE_KEY, newDate);
            sessionStorage.setItem('reportDate', newDate);
            sessionStorage.setItem('dauReportDate', newDate);
            sessionStorage.setItem('exceptionReportDate', newDate);
            sessionStorage.setItem('autoSearchDate', newDate);

            // 转发给当前页面的 iframe（如果当前是主框架）
            const contentFrame = document.getElementById('contentFrame');
            if (contentFrame && contentFrame.contentWindow && event.source !== contentFrame.contentWindow) {
                try {
                    contentFrame.contentWindow.postMessage({ action: 'globalDateChange', date: newDate }, '*');
                } catch (_) {}
            }

            // 触发事件通知本页面输入框自动更新
            window.dispatchEvent(new CustomEvent('unifiedDateChanged', { detail: { date: newDate } }));
        }
    });

    // 监听 storage 事件（跨浏览器标签页同步）
    window.addEventListener('storage', (e) => {
        if (e.key === GLOBAL_DATE_KEY && isValidDateStr(e.newValue)) {
            sessionStorage.setItem('reportDate', e.newValue);
            sessionStorage.setItem('dauReportDate', e.newValue);
            sessionStorage.setItem('exceptionReportDate', e.newValue);
            sessionStorage.setItem('autoSearchDate', e.newValue);
            window.dispatchEvent(new CustomEvent('unifiedDateChanged', { detail: { date: e.newValue } }));
        }
    });
})();

