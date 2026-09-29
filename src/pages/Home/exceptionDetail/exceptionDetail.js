document.addEventListener('DOMContentLoaded', () => {
    // 1. DOM Elements
    const backBtn = document.getElementById('backBtn');
    const exceptionDateInput = document.getElementById('exceptionDateInput');
    const exceptionSearchInput = document.getElementById('exceptionSearchInput');
    const categoryTabs = document.getElementById('categoryTabs');
    const exceptionTableBody = document.getElementById('exceptionTableBody');
    const pageSubtitle = document.getElementById('pageSubtitle');
    const noConfigAlert = document.getElementById('noConfigAlert');

    // Tab badges
    const badgeAll = document.getElementById('badge-all');
    const badgeEval = document.getElementById('badge-eval');
    const badgeData = document.getElementById('badge-data');
    const badgePlatform = document.getElementById('badge-platform');
    const badgeAv = document.getElementById('badge-av');
    const badgeAvTest = document.getElementById('badge-av-test');
    const badgeOther = document.getElementById('badge-other');

    // Modal elements
    const logModal = document.getElementById('logModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalSubtitle = document.getElementById('modalSubtitle');
    const modalCodeBlock = document.getElementById('modalCodeBlock');
    const modalCloseX = document.getElementById('modalCloseX');
    const modalCopyBtn = document.getElementById('modalCopyBtn');
    const modalCloseBtn = document.getElementById('modalCloseBtn');

    // State Variables
    let ossClient = null;
    let currentLogsList = []; // Array of log objects
    let selectedCategory = 'evaluation_error'; // Current active tab
    let errorBarChart = null; // Chart.js instance
    let activeSelectedAccount = ''; // 当前选中的排查用户账号

    // Popover State Variables
    let hoverTimer = null;          // 鼠标悬停停顿计时器
    let popoverHideTimer = null;    // 弹框隐藏延时计时器
    let currentPopoverItem = null;  // 当前悬停项数据

    // Category mappings
    const folderToName = {
        'evaluation_error': '评测异常',
        'data_error': '数据异常',
        'platform_error': '平台异常',
        'audio_video_error': '音视频异常',
        'audio_video_test': '音视频测试',
        'other_error': '其他异常'
    };

    const folderToColor = {
        'evaluation_error': '#48e59e',
        'data_error': '#e5837a',
        'platform_error': '#f5a623',
        'audio_video_error': '#ab47bc',
        'audio_video_test': '#2196f3',
        'other_error': '#909090',
        'dataException': '#e5837a',
        'platformException': '#f5a623',
        'otherException': '#909090',
        'evaluationException': '#48e59e',
        'audioVideoException': '#ab47bc',
        'audioVideoTest': '#2196f3'
    };

    const folderToClass = {
        'evaluation_error': 'eval',
        'data_error': 'data',
        'platform_error': 'platform',
        'audio_video_error': 'av',
        'audio_video_test': 'av-test',
        'other_error': 'other'
    };

    // 2. Initialize Date Picker & Quick Date Selectors
    const savedDate = sessionStorage.getItem('exceptionReportDate') || sessionStorage.getItem('reportDate') || new Date().toISOString().split('T')[0];
    exceptionDateInput.value = savedDate;

    function updateQuickDateActive(dateStr) {
        const quickDateBtns = document.querySelectorAll('.quick-date-btn');
        if (!dateStr) {
            quickDateBtns.forEach(btn => btn.classList.remove('active'));
            return;
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const parts = dateStr.split('-');
        if (parts.length !== 3) {
            quickDateBtns.forEach(btn => btn.classList.remove('active'));
            return;
        }
        const curr = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        curr.setHours(0, 0, 0, 0);
        const diffDays = Math.round((curr - today) / (1000 * 60 * 60 * 24));

        quickDateBtns.forEach(btn => {
            const offset = parseInt(btn.dataset.offset, 10);
            if (offset === diffDays) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    updateQuickDateActive(savedDate);

    // 检查是否有强制刷新标记（例如在单查询页面删除了用户数据）
    const needForceRefresh = sessionStorage.getItem('force_refresh_exception') === 'true';
    if (needForceRefresh) {
        sessionStorage.removeItem('force_refresh_exception');
        sessionStorage.removeItem('exception_state_cache');
    }

    // 3. Back Button
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            const selectedDate = exceptionDateInput ? exceptionDateInput.value : '';
            if (selectedDate) {
                sessionStorage.setItem('reportDate', selectedDate);
            }
            sessionStorage.removeItem('exception_state_cache');
            window.location.href = '../logReport/logReport.html';
        });
    }

    // 缓存管理方法
    function getGlobalCache() {
        try {
            const str = sessionStorage.getItem('exception_state_cache');
            if (str) return JSON.parse(str);
        } catch (e) { }
        return null;
    }

    function saveExceptionStateToCache(activeAccount = '') {
        const selectedDate = exceptionDateInput ? exceptionDateInput.value : '';
        const searchQuery = exceptionSearchInput ? exceptionSearchInput.value : '';
        const scrollY = window.scrollY || document.documentElement.scrollTop || 0;

        // 避免 sessionStorage 达到配额上限，缓存时去除体积较大的 rawContent 和 parsedData
        const compactList = (currentLogsList || []).map(item => {
            const { rawContent, parsedData, ...rest } = item;
            return rest;
        });

        const cacheObj = {
            date: selectedDate,
            list: compactList,
            selectedCategory: selectedCategory,
            searchQuery: searchQuery,
            activeSelectedAccount: activeAccount || activeSelectedAccount,
            scrollY: scrollY
        };

        try {
            sessionStorage.setItem('exception_state_cache', JSON.stringify(cacheObj));
        } catch (e) {
            try {
                const compactObj = { ...cacheObj, list: [] };
                sessionStorage.setItem('exception_state_cache', JSON.stringify(compactObj));
            } catch (err) { }
        }
    }

    // 4. Initialize OSS Client
    function initOssClient() {
        const savedConfig = localStorage.getItem('oss_tool_config');
        if (!savedConfig) {
            noConfigAlert.style.display = 'flex';
            return null;
        }

        try {
            const config = JSON.parse(savedConfig);
            const { accessKeyId, accessKeySecret, endpoint, bucket } = config;

            if (!accessKeyId || !accessKeySecret || !endpoint || !bucket) {
                noConfigAlert.style.display = 'flex';
                return null;
            }

            noConfigAlert.style.display = 'none';

            let region = 'oss-cn-shanghai';
            if (endpoint.includes('.aliyuncs.com')) {
                region = endpoint.split('.aliyuncs.com')[0];
            } else {
                region = endpoint;
            }

            return new OSS({
                region: region,
                accessKeyId: accessKeyId,
                accessKeySecret: accessKeySecret,
                bucket: bucket,
                secure: true
            });
        } catch (e) {
            console.error('Failed to initialize OSS client:', e);
            noConfigAlert.style.display = 'flex';
            return null;
        }
    }

    ossClient = initOssClient();

    // HTML转义工具方法，避免XSS与特殊字符渲染异常
    function escapeHtml(str) {
        if (!str && str !== 0) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Format file sizes
    function formatSize(bytes) {
        if (bytes === 0 || bytes === undefined || bytes === null) return '0 B';
        const k = 1024;
        const dm = 1;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Helper to format Date/Time
    function formatDateTime(dateInput) {
        if (!dateInput) return '-';
        try {
            const d = new Date(dateInput);
            if (isNaN(d.getTime())) return String(dateInput);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const hh = String(d.getHours()).padStart(2, '0');
            const mi = String(d.getMinutes()).padStart(2, '0');
            const ss = String(d.getSeconds()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
        } catch (e) {
            return String(dateInput);
        }
    }

    // 5. Fetch Log files from OSS (always fetch live real-time data)
    async function fetchLogs(dateStr) {
        if (!ossClient) {
            return generateMockLogs(dateStr);
        }

        const formattedDate = dateStr.replace(/-/g, '_');
        const prefix = `usertemp/xuelianxitong/${formattedDate}/`;

        try {
            // 分页完整拉取指定前缀下的所有对象（彻底解决超过1000条截断导致数据不一致问题）
            let objects = [];
            let marker = null;
            do {
                const listParams = {
                    prefix: prefix,
                    'max-keys': 1000
                };
                if (marker) listParams.marker = marker;
                const result = await ossClient.list(listParams);
                objects = objects.concat(result.objects || []);
                marker = result.isTruncated ? result.nextMarker : null;
            } while (marker);

            const validFolders = new Set(['data_error', 'platform_error', 'other_error', 'evaluation_error', 'audio_video_error', 'audio_video_test']);

            const filteredObjects = objects.filter(obj => {
                const key = obj.name;
                const parts = key.split('/');
                if (parts.length >= 5) {
                    const folder = parts[4];
                    const fileName = parts[parts.length - 1];
                    return fileName && fileName.trim() !== '' && validFolders.has(folder);
                }
                return false;
            });

            // 1. 同步瞬间构建完整的异常日志基础列表（包含精确的统计分类与时间信息，无需任何网络GET请求）
            const parsedLogs = filteredObjects.map(obj => {
                const key = obj.name;
                const parts = key.split('/');
                const username = parts[3];
                const folder = parts[4];
                const fileName = parts[parts.length - 1];

                let errorTime = '';
                const timeMatch = fileName.match(/_(\d{2})(\d{2})(\d{2})\.(?:json|txt)$/);
                if (timeMatch) {
                    errorTime = `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`;
                } else if (obj.lastModified) {
                    const d = new Date(obj.lastModified);
                    const h = String(d.getHours()).padStart(2, '0');
                    const m = String(d.getMinutes()).padStart(2, '0');
                    const s = String(d.getSeconds()).padStart(2, '0');
                    errorTime = `${h}:${m}:${s}`;
                }

                return {
                    key: key,
                    username: username,
                    studentName: '-',
                    schoolName: '-',
                    teacherName: '-',
                    version: '-',
                    category: folder,
                    fileName: fileName,
                    timeStr: errorTime || '-',
                    lastModified: obj.lastModified || new Date().toISOString(),
                    size: obj.size,
                    rawContent: '',
                    parsedData: null
                };
            });

            // 按日志时间倒序排列（最新优先）
            parsedLogs.sort((a, b) => b.lastModified.localeCompare(a.lastModified));

            // 2. 异步后台安全并发解析学生姓名、学校、老师、版本（同账号缓存+限制并发数，杜绝并发风暴与丢包）
            enrichLogDetails(parsedLogs);

            return parsedLogs;
        } catch (e) {
            console.error('Failed to list files from OSS:', e);
            return generateMockLogs(dateStr, true);
        }
    }

    /**
     * 异步后台并发解析日志中的学生姓名、学校、老师、版本，并实时局部刷新到表格中
     */
    async function enrichLogDetails(logsList) {
        if (!ossClient || !logsList || logsList.length === 0) return;

        const userToInfoCache = {};
        const concurrency = 6;
        let index = 0;

        async function worker() {
            while (index < logsList.length) {
                const currentIndex = index++;
                const item = logsList[currentIndex];
                if (!item || !item.key) continue;

                // 同一账号直接复用已解析的学生基础信息，极大减少请求量
                if (userToInfoCache[item.username]) {
                    const cached = userToInfoCache[item.username];
                    if (cached.studentName && item.studentName === '-') item.studentName = cached.studentName;
                    if (cached.schoolName && item.schoolName === '-') item.schoolName = cached.schoolName;
                    if (cached.teacherName && item.teacherName === '-') item.teacherName = cached.teacherName;
                    if (cached.version && item.version === '-') item.version = cached.version;
                    updateTableRowInfo(item);
                    continue;
                }

                try {
                    const fileRes = await ossClient.get(item.key);
                    const fileContent = fileRes.content ? fileRes.content.toString() : '';
                    if (fileContent && fileContent.trim() !== '') {
                        item.rawContent = fileContent;
                        const parsed = JSON.parse(fileContent);
                        item.parsedData = parsed;
                        const data = Array.isArray(parsed) ? (parsed[0] || {}) : parsed;
                        const studentInfo = data.studentInfo || {};

                        const name = data.nickName || studentInfo.nickName || data.userName || studentInfo.userName || '';
                        const school = studentInfo.shopName || data.shopName || studentInfo.schoolName || data.schoolName || '';
                        const teacher = studentInfo.teacherName || data.teacherName || '';
                        const version = data.versionName || studentInfo.versionName || data.appVersion || data.version || data.clientVersion || studentInfo.appVersion || studentInfo.version || (data.meta && data.meta.client ? data.meta.client.replace(/.*Client\//, 'v') : '') || '';

                        if (name) item.studentName = name;
                        if (school) item.schoolName = school;
                        if (teacher) item.teacherName = teacher;
                        if (version) item.version = version;

                        if (name || school || teacher || version) {
                            userToInfoCache[item.username] = {
                                studentName: item.studentName,
                                schoolName: item.schoolName,
                                teacherName: item.teacherName,
                                version: item.version
                            };
                            updateTableRowInfo(item);
                        }
                    }
                } catch (e) {
                    // 局部读取错误不影响全局统计
                }
            }
        }

        const workers = [];
        for (let i = 0; i < Math.min(concurrency, logsList.length); i++) {
            workers.push(worker());
        }
        await Promise.all(workers);
        saveExceptionStateToCache();
    }

    /**
     * 局部更新表格指定行的数据（学生姓名、学校、老师、版本）
     */
    function updateTableRowInfo(item) {
        if (!item || !item.key) return;
        const rows = exceptionTableBody.querySelectorAll('tr[data-key]');
        for (const row of rows) {
            if (row.dataset.key === item.key) {
                const nameCell = row.querySelector('.student-name-cell');
                if (nameCell && item.studentName && item.studentName !== '-') {
                    nameCell.textContent = item.studentName;
                }
                const schoolCell = row.querySelector('.school-name-cell');
                if (schoolCell && item.schoolName && item.schoolName !== '-') {
                    schoolCell.textContent = item.schoolName;
                    schoolCell.title = item.schoolName;
                }
                const teacherCell = row.querySelector('.teacher-name-cell');
                if (teacherCell && item.teacherName && item.teacherName !== '-') {
                    teacherCell.textContent = item.teacherName;
                    teacherCell.title = item.teacherName;
                }
                const versionCell = row.querySelector('.version-cell');
                if (versionCell) {
                    versionCell.innerHTML = `<span class="version-badge">${escapeHtml(item.version || '-')}</span>`;
                }
                break;
            }
        }
    }

    // Render Statistics Chart with ECharts
    let lastExceptionChartParams = null;

    function renderExceptionChart(evalCount, dataCount, platformCount, avCount, avTestCount = 0, otherCount = 0) {
        lastExceptionChartParams = { evalCount, dataCount, platformCount, avCount, avTestCount, otherCount };
        const dom = document.getElementById('errorTypePieChart');
        if (!dom || typeof echarts === 'undefined') return;

        const theme = window.ThemeManager ? window.ThemeManager.getTheme() : 'light';
        const colors = window.ThemeManager ? window.ThemeManager.getChartTheme(theme) : {};

        if (errorBarChart && !errorBarChart.isDisposed()) {
            errorBarChart.dispose();
        }
        errorBarChart = echarts.init(dom, theme === 'dark' ? 'dark' : null);

        const total = evalCount + dataCount + platformCount + avCount + avTestCount + otherCount;
        const categoryKeys = ['other_error', 'audio_video_test', 'audio_video_error', 'platform_error', 'data_error', 'evaluation_error'];
        const categories = ['其他异常', '音视频测试', '音视频异常', '平台异常', '数据异常', '评测异常'];
        const values = [otherCount, avTestCount, avCount, platformCount, dataCount, evalCount];

        const rawGradients = [
            new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#6a85b6' }, { offset: 1, color: '#bac8e0' }]),
            new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#1976d2' }, { offset: 1, color: '#42a5f5' }]),
            new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#8e44ad' }, { offset: 1, color: '#bb86fc' }]),
            new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#f7971e' }, { offset: 1, color: '#ffd200' }]),
            new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#ff6b6b' }, { offset: 1, color: '#ff8e53' }]),
            new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#11998e' }, { offset: 1, color: '#38ef7d' }])
        ];

        const isDark = (window.ThemeManager && window.ThemeManager.getTheme() === 'dark') || document.documentElement.getAttribute('data-theme') === 'dark';
        const dimColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(203, 213, 225, 0.4)';

        const seriesData = values.map((val, idx) => {
            const catKey = categoryKeys[idx];
            const isDimmed = selectedCategory !== 'all' && selectedCategory !== catKey;
            return {
                value: val,
                catKey: catKey,
                itemStyle: {
                    borderRadius: [0, 4, 4, 0],
                    color: isDimmed ? dimColor : rawGradients[idx]
                }
            };
        });

        const option = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: function (params) {
                    const p = params[0];
                    const val = p.value;
                    const pct = total === 0 ? '0.0' : ((val / total) * 100).toFixed(1);
                    return `<div style="font-weight: 600; margin-bottom: 4px;">${p.name}</div>
                            <div>异常频次: <span style="font-weight: bold;">${val}</span> 次 (${pct}%)</div>
                            <div style="font-size: 11px; color: #909399; margin-top: 2px;">(点击柱条可直接筛选该分类)</div>`;
                }
            },
            grid: {
                top: 15,
                left: 85,
                right: 60,
                bottom: 25
            },
            xAxis: {
                type: 'value',
                minInterval: 1,
                splitLine: { lineStyle: { color: colors.gridColor || '#f0f2f5' } },
                axisLabel: { color: colors.textColor || '#909399', fontSize: 11 }
            },
            yAxis: {
                type: 'category',
                data: categories,
                axisLine: { lineStyle: { color: colors.borderColor || '#e2e8f0' } },
                axisLabel: {
                    color: colors.textColor || '#303133',
                    fontWeight: 500,
                    fontSize: 12
                }
            },
            series: [{
                name: '异常数量',
                type: 'bar',
                barWidth: 16,
                label: {
                    show: true,
                    position: 'right',
                    formatter: '{c} 次',
                    color: colors.textColor || '#303133',
                    fontWeight: 600,
                    fontSize: 11
                },
                data: seriesData
            }]
        };

        errorBarChart.setOption(option);
        errorBarChart.on('click', (params) => {
            if (params.data && params.data.catKey) {
                switchTab(params.data.catKey);
            }
        });
    }

    // Switch Category Tabs
    function switchTab(categoryKey) {
        selectedCategory = categoryKey;

        // Update UI styling of tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.getAttribute('data-category') === categoryKey) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Re-draw chart to update highlighted selection
        updateChartHighlight();

        saveExceptionStateToCache();

        // Render matching rows in table
        renderTable();
    }

    function updateChartHighlight() {
        if (!errorBarChart || typeof errorBarChart.setOption !== 'function' || errorBarChart.isDisposed() || !lastExceptionChartParams) return;
        const { evalCount, dataCount, platformCount, avCount, avTestCount, otherCount } = lastExceptionChartParams;
        const categoryKeys = ['other_error', 'audio_video_test', 'audio_video_error', 'platform_error', 'data_error', 'evaluation_error'];
        const values = [otherCount, avTestCount, avCount, platformCount, dataCount, evalCount];

        const rawGradients = [
            new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#6a85b6' }, { offset: 1, color: '#bac8e0' }]),
            new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#1976d2' }, { offset: 1, color: '#42a5f5' }]),
            new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#8e44ad' }, { offset: 1, color: '#bb86fc' }]),
            new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#f7971e' }, { offset: 1, color: '#ffd200' }]),
            new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#ff6b6b' }, { offset: 1, color: '#ff8e53' }]),
            new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#11998e' }, { offset: 1, color: '#38ef7d' }])
        ];

        const isDark = (window.ThemeManager && window.ThemeManager.getTheme() === 'dark') || document.documentElement.getAttribute('data-theme') === 'dark';
        const dimColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(203, 213, 225, 0.4)';

        const seriesData = values.map((val, idx) => {
            const catKey = categoryKeys[idx];
            const isDimmed = selectedCategory !== 'all' && selectedCategory !== catKey;
            return {
                value: val,
                catKey: catKey,
                itemStyle: {
                    borderRadius: [0, 4, 4, 0],
                    color: isDimmed ? dimColor : rawGradients[idx]
                }
            };
        });

        errorBarChart.setOption({
            series: [{
                data: seriesData
            }]
        });
    }

    // Bind event listeners for Tab controls
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const cat = btn.getAttribute('data-category');
            switchTab(cat);
        });
    });

    // Handle inputs for filtering
    exceptionSearchInput.addEventListener('input', () => {
        saveExceptionStateToCache();
        renderTable();
    });

    /**
     * 初始化悬停错误数据弹框相关的事件与DOM引用
     */
    function initErrorPopover() {
        const popover = document.getElementById('errorDataPopover');
        const closeBtn = document.getElementById('popoverCloseBtn');
        const copyBtn = document.getElementById('popoverCopyBtn');

        if (!popover) return;

        // 鼠标移入弹框本身时，取消关闭计时器，保持显示以便复制或查看
        popover.addEventListener('mouseenter', () => {
            if (popoverHideTimer) {
                clearTimeout(popoverHideTimer);
                popoverHideTimer = null;
            }
        });

        // 鼠标离开弹框时，延时关闭
        popover.addEventListener('mouseleave', () => {
            scheduleHidePopover();
        });

        // 关闭按钮
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                hideErrorPopover();
            });
        }

        // 复制按钮
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const codeEl = document.getElementById('popoverContent');
                if (codeEl && codeEl.textContent) {
                    navigator.clipboard.writeText(codeEl.textContent).then(() => {
                        const originalText = copyBtn.textContent;
                        copyBtn.textContent = '已复制！';
                        copyBtn.style.backgroundColor = '#67c23a';
                        copyBtn.style.borderColor = '#67c23a';
                        copyBtn.style.color = '#fff';
                        setTimeout(() => {
                            copyBtn.textContent = originalText;
                            copyBtn.style.backgroundColor = '';
                            copyBtn.style.borderColor = '';
                            copyBtn.style.color = '';
                        }, 1500);
                    }).catch(err => {
                        console.error('复制失败:', err);
                    });
                }
            });
        }

        // 页面滚动或窗口大小改变时隐藏弹框
        window.addEventListener('scroll', () => {
            hideErrorPopover();
        }, { passive: true });

        window.addEventListener('resize', () => {
            hideErrorPopover();
        }, { passive: true });
    }

    /**
     * 异步获取单项日志完整内容（若未预加载）
     */
    async function getLogItemContent(item) {
        if (item.parsedData || item.rawContent || item.errorData || item.stackTrace) {
            return item;
        }
        if (!ossClient) {
            const mockStr = getMockFileContent(item.key);
            item.rawContent = mockStr;
            try {
                item.parsedData = JSON.parse(mockStr);
            } catch (e) { }
            return item;
        }
        try {
            const res = await ossClient.get(item.key);
            const content = res.content ? res.content.toString() : '';
            item.rawContent = content;
            try {
                const parsed = JSON.parse(content);
                item.parsedData = parsed;
                const data = Array.isArray(parsed) ? (parsed[0] || {}) : parsed;
                if (data.errorData) item.errorData = data.errorData;
                if (data.stackTrace) item.stackTrace = data.stackTrace;
                const studentInfo = data.studentInfo || {};
                if (!item.studentName || item.studentName === '-') {
                    item.studentName = data.nickName || studentInfo.nickName || data.userName || studentInfo.userName || '-';
                }
                if (!item.schoolName || item.schoolName === '-') {
                    item.schoolName = studentInfo.shopName || data.shopName || studentInfo.schoolName || data.schoolName || '-';
                }
                if (!item.teacherName || item.teacherName === '-') {
                    item.teacherName = studentInfo.teacherName || data.teacherName || '-';
                }
                if (!item.version || item.version === '-') {
                    item.version = data.versionName || studentInfo.versionName || data.appVersion || data.version || data.clientVersion || studentInfo.appVersion || studentInfo.version || '-';
                }
            } catch (e) { }
        } catch (e) {
            console.error('Failed to get log item content on hover:', e);
        }
        return item;
    }

    /**
     * 鼠标悬停展示错误数据弹框
     */
    function showErrorPopover(item, rowRect, mouseX, mouseY) {
        const popover = document.getElementById('errorDataPopover');
        const typeBadge = document.getElementById('popoverTypeBadge');
        const metaEl = document.getElementById('popoverMeta');
        const contentEl = document.getElementById('popoverContent');

        if (!popover || !contentEl) return;

        currentPopoverItem = item;

        // 计算异常类型与标签
        const categoryName = folderToName[item.category] || item.category || '未知异常';
        const color = folderToColor[item.category] || '#909399';

        if (typeBadge) {
            typeBadge.textContent = categoryName;
            const categoryClass = folderToClass[item.category] || 'other';
            typeBadge.className = `type-badge popover-type-badge ${categoryClass}`;
            typeBadge.style.backgroundColor = '';
        }

        const userIdVal = item.username || item.userId || '-';
        const nickNameVal = item.studentName || item.nickName || '-';
        const schoolVal = item.schoolName || '-';
        const teacherVal = item.teacherName || '-';
        const versionVal = item.version || '-';
        const timeVal = item.timeStr || item.errorTime || item.lastModified || '-';

        if (metaEl) {
            metaEl.innerHTML = `
                <span><strong>用户:</strong> ${userIdVal} (${nickNameVal})</span>
                <span><strong>学校:</strong> ${schoolVal}</span>
                <span><strong>老师:</strong> ${teacherVal}</span>
                <span><strong>版本:</strong> ${versionVal}</span>
                <span><strong>时间:</strong> ${timeVal}</span>
            `;
        }

        function extractErrorDataText(logItem) {
            let errorDataText = '';
            const dataObj = logItem.parsedData ? (Array.isArray(logItem.parsedData) ? logItem.parsedData[0] : logItem.parsedData) : null;

            if (logItem.errorData) {
                if (typeof logItem.errorData === 'object') {
                    errorDataText = JSON.stringify(logItem.errorData, null, 2);
                } else if (typeof logItem.errorData === 'string') {
                    try {
                        const parsed = JSON.parse(logItem.errorData);
                        errorDataText = JSON.stringify(parsed, null, 2);
                    } catch (e) {
                        errorDataText = logItem.errorData;
                    }
                }
            } else if (dataObj && dataObj.errorData) {
                if (typeof dataObj.errorData === 'object') {
                    errorDataText = JSON.stringify(dataObj.errorData, null, 2);
                } else if (typeof dataObj.errorData === 'string') {
                    try {
                        const parsed = JSON.parse(dataObj.errorData);
                        errorDataText = JSON.stringify(parsed, null, 2);
                    } catch (e) {
                        errorDataText = dataObj.errorData;
                    }
                }
            } else if (logItem.stackTrace) {
                errorDataText = logItem.stackTrace;
            } else if (dataObj && dataObj.stackTrace) {
                errorDataText = dataObj.errorMessage ? `${dataObj.errorMessage}\n\n${dataObj.stackTrace}` : dataObj.stackTrace;
            } else if (dataObj && dataObj.errorMessage) {
                errorDataText = typeof dataObj === 'object' ? JSON.stringify(dataObj, null, 2) : dataObj.errorMessage;
            } else if (logItem.parsedData) {
                errorDataText = JSON.stringify(logItem.parsedData, null, 2);
            } else if (logItem.rawContent) {
                try {
                    const parsed = JSON.parse(logItem.rawContent);
                    errorDataText = JSON.stringify(parsed, null, 2);
                } catch (e) {
                    errorDataText = logItem.rawContent;
                }
            } else {
                return null;
            }
            return errorDataText;
        }

        function renderPopoverContent(rawText) {
            if (!rawText) {
                contentEl.textContent = '-';
                return;
            }
            try {
                const parsed = JSON.parse(rawText);
                contentEl.innerHTML = syntaxHighlightJson(JSON.stringify(parsed, null, 2));
            } catch (e) {
                if (/^\s*[\{\[]/.test(rawText)) {
                    contentEl.innerHTML = syntaxHighlightJson(rawText);
                } else {
                    contentEl.textContent = rawText;
                }
            }
        }

        const text = extractErrorDataText(item);
        if (text) {
            renderPopoverContent(text);
        } else {
            contentEl.textContent = '正在获取错误数据...';
            getLogItemContent(item).then(updatedItem => {
                if (currentPopoverItem === item) {
                    const updatedText = extractErrorDataText(updatedItem);
                    if (updatedText) {
                        renderPopoverContent(updatedText);
                    } else {
                        const summary = {
                            loginName: item.username,
                            studentName: item.studentName,
                            category: categoryName,
                            time: timeVal,
                            fileName: item.fileName,
                            remark: '暂无独立errorData字段，可点击「查看内容」查看完整日志'
                        };
                        renderPopoverContent(JSON.stringify(summary, null, 2));
                    }
                }
            });
        }

        // 计算弹框定位（防止超出屏幕边界）
        popover.style.display = 'flex';

        const popoverWidth = 480;
        const popoverHeight = popover.offsetHeight || 320;
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        let left = (mouseX || rowRect.left + 80) + 15;
        let top = (mouseY || rowRect.top) + 10;

        // 右边界防溢出
        if (left + popoverWidth > screenWidth - 20) {
            left = Math.max(20, screenWidth - popoverWidth - 20);
        }

        // 下边界防溢出，若下方空间不足则弹出在上方
        if (top + popoverHeight > screenHeight - 20) {
            top = Math.max(20, (rowRect.top || mouseY) - popoverHeight - 10);
        }

        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;
    }

    /**
     * 延时隐藏错误数据弹框
     */
    function scheduleHidePopover() {
        if (popoverHideTimer) {
            clearTimeout(popoverHideTimer);
        }
        popoverHideTimer = setTimeout(() => {
            hideErrorPopover();
        }, 200);
    }

    /**
     * 立即隐藏错误数据弹框
     */
    function hideErrorPopover() {
        const popover = document.getElementById('errorDataPopover');
        if (popover) {
            popover.style.display = 'none';
        }
        if (hoverTimer) {
            clearTimeout(hoverTimer);
            hoverTimer = null;
        }
        if (popoverHideTimer) {
            clearTimeout(popoverHideTimer);
            popoverHideTimer = null;
        }
        currentPopoverItem = null;
    }

    // Render Table based on selected category and text search
    function renderTable() {
        hideErrorPopover();
        const query = exceptionSearchInput.value.trim().toLowerCase();

        const filteredList = currentLogsList.filter(item => {
            // Category filter
            if (selectedCategory !== 'all' && item.category !== selectedCategory) {
                return false;
            }

            // Search filter (Match username, studentName, school, teacher, or version)
            if (query) {
                const usernameMatch = item.username && item.username.toLowerCase().includes(query);
                const nameMatch = item.studentName && item.studentName.toLowerCase().includes(query);
                const schoolMatch = item.schoolName && item.schoolName.toLowerCase().includes(query);
                const teacherMatch = item.teacherName && item.teacherName.toLowerCase().includes(query);
                const versionMatch = item.version && item.version.toLowerCase().includes(query);
                return usernameMatch || nameMatch || schoolMatch || teacherMatch || versionMatch;
            }

            return true;
        });

        const currentDate = exceptionDateInput.value;
        if (pageSubtitle) {
            pageSubtitle.textContent = `报表日期：${currentDate} · 共 ${filteredList.length} 条异常日志记录`;
        }

        if (filteredList.length === 0) {
            exceptionTableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 40px; color: #909399;">
                        暂无符合条件的异常日志
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        filteredList.forEach((item, index) => {
            const serialNum = index + 1;
            const timeFormatted = item.timeStr;
            const categoryName = folderToName[item.category] || item.category;
            const categoryClass = folderToClass[item.category] || 'other';
            const isSelected = !!(activeSelectedAccount && (
                item.username === activeSelectedAccount ||
                item.studentName === activeSelectedAccount
            ));
            const selectedClass = isSelected ? 'exception-row-selected' : '';

            const schoolName = item.schoolName && item.schoolName !== '-' ? item.schoolName : '-';
            const teacherName = item.teacherName && item.teacherName !== '-' ? item.teacherName : '-';
            const versionStr = item.version || '-';
            const versionHtml = `<span class="version-badge">${escapeHtml(versionStr)}</span>`;

            html += `
                <tr class="${selectedClass}" data-key="${item.key}">
                    <td style="text-align: center; color: ${isSelected ? '#f5222d' : '#909399'}; font-weight: ${isSelected ? '700' : '500'};">
                        ${isSelected ? '👉 ' + serialNum : serialNum}
                    </td>
                    <td class="account-cell" title="${escapeHtml(item.username)}" style="font-weight: 600; color: #303133;">${escapeHtml(item.username)}</td>
                    <td class="student-name-cell" title="${escapeHtml(item.studentName || '-')}" style="font-weight: 600; color: #303133;">${escapeHtml(item.studentName || '-')}</td>
                    <td class="school-name-cell" title="${escapeHtml(schoolName)}">${escapeHtml(schoolName)}</td>
                    <td class="teacher-name-cell" title="${escapeHtml(teacherName)}">${escapeHtml(teacherName)}</td>
                    <td class="version-cell" style="text-align: center;">${versionHtml}</td>
                    <td style="text-align: center;">
                        <span class="type-badge ${categoryClass}">${categoryName}</span>
                    </td>
                    <td class="time-cell" style="text-align: center;"><span style="font-weight: 500; color: #0050b3;">${timeFormatted}</span></td>
                    <td style="text-align: center;">
                        <button class="action-btn" onclick="window.viewExceptionLogContent('${item.key}')">查看内容</button>
                        <button class="trouble-btn ${isSelected ? 'selected' : ''}" onclick="window.troubleshootAccount('${item.username}')">
                            ${isSelected ? '排查中 →' : '排查 →'}
                        </button>
                    </td>
                </tr>
            `;
        });

        exceptionTableBody.innerHTML = html;

        // 为表格行绑定悬停错误数据弹框和点击高亮事件
        const rows = exceptionTableBody.querySelectorAll('tr');
        rows.forEach((tr, index) => {
            const item = filteredList[index];
            if (!item) return;

            // 单击行：高亮选中该行
            tr.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                exceptionTableBody.querySelectorAll('tr.exception-row-selected').forEach(r => {
                    r.classList.remove('exception-row-selected');
                });
                tr.classList.add('exception-row-selected');
                activeSelectedAccount = item.username;
            });

            // 鼠标悬停停顿逻辑：悬停超过350ms时弹出错误数据弹框
            tr.addEventListener('mouseenter', (e) => {
                if (popoverHideTimer) {
                    clearTimeout(popoverHideTimer);
                    popoverHideTimer = null;
                }
                if (hoverTimer) {
                    clearTimeout(hoverTimer);
                    hoverTimer = null;
                }

                // 如果鼠标当前已经在“排查”按钮上，不触发弹框
                const troubleBtn = tr.querySelector('.trouble-btn');
                if (troubleBtn && (troubleBtn === e.target || troubleBtn.contains(e.target) || troubleBtn.matches(':hover'))) {
                    return;
                }

                const rect = tr.getBoundingClientRect();
                const clientX = e.clientX;
                const clientY = e.clientY;

                hoverTimer = setTimeout(() => {
                    const currentTroubleBtn = tr.querySelector('.trouble-btn');
                    if (currentTroubleBtn && currentTroubleBtn.matches(':hover')) {
                        return;
                    }
                    showErrorPopover(item, rect, clientX, clientY);
                }, 350);
            });

            // 鼠标离开行：取消悬停计时并延时隐藏弹框
            tr.addEventListener('mouseleave', () => {
                if (hoverTimer) {
                    clearTimeout(hoverTimer);
                    hoverTimer = null;
                }
                scheduleHidePopover();
            });

            const troubleBtn = tr.querySelector('.trouble-btn');
            if (troubleBtn) {
                // 鼠标移入“排查”按钮时，禁止弹框并立即关闭已展示的弹框
                troubleBtn.addEventListener('mouseenter', (e) => {
                    e.stopPropagation();
                    if (hoverTimer) {
                        clearTimeout(hoverTimer);
                        hoverTimer = null;
                    }
                    hideErrorPopover();
                });

                // 鼠标离开“排查”按钮但仍在当前行时，恢复悬停弹框计时
                troubleBtn.addEventListener('mouseleave', (e) => {
                    if (tr.matches(':hover')) {
                        const rect = tr.getBoundingClientRect();
                        const clientX = e.clientX;
                        const clientY = e.clientY;
                        hoverTimer = setTimeout(() => {
                            if (troubleBtn.matches(':hover')) return;
                            showErrorPopover(item, rect, clientX, clientY);
                        }, 350);
                    }
                });
            }
        });
    }

    // Modal View Actions
    window.viewExceptionLogContent = async function (key) {
        hideErrorPopover();
        logModal.style.display = 'flex';
        document.body.classList.add('modal-open');
        modalTitle.textContent = '正在拉取文件内容...';
        modalSubtitle.textContent = key;
        modalCodeBlock.textContent = 'Loading log content from Aliyun OSS...';

        if (!ossClient) {
            // Mock content preview
            setTimeout(() => {
                const mockContent = getMockFileContent(key);
                displayModalContent(key, mockContent);
            }, 300);
            return;
        }

        try {
            const res = await ossClient.get(key);
            const content = res.content ? res.content.toString() : '{}';
            displayModalContent(key, content);
        } catch (e) {
            console.error('Failed to get log file content:', e);
            modalTitle.textContent = '读取失败';
            modalCodeBlock.textContent = `Error fetching OSS object:\n${e.message || e}`;
        }
    };

    // JSON Syntax Highlight Helper
    function syntaxHighlightJson(jsonStr) {
        const escaped = jsonStr.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return escaped.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
            let cls = 'json-number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'json-key';
                } else {
                    cls = 'json-string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'json-boolean';
            } else if (/null/.test(match)) {
                cls = 'json-null';
            }
            return '<span class="' + cls + '">' + match + '</span>';
        });
    }

    function displayModalContent(key, content) {
        const parts = key.split('/');
        const fileName = parts[parts.length - 1];
        modalTitle.textContent = fileName;
        modalSubtitle.textContent = key;

        try {
            // Format JSON nicely if valid JSON
            const parsed = JSON.parse(content);
            const formatted = JSON.stringify(parsed, null, 2);
            modalCodeBlock.innerHTML = syntaxHighlightJson(formatted);
        } catch (e) {
            // fallback plain text
            modalCodeBlock.textContent = content;
        }
    }

    // Close Modal Bindings
    function closeModal() {
        logModal.style.display = 'none';
        modalCodeBlock.textContent = '';
        const textSpan = modalCopyBtn.querySelector('.copy-text');
        if (textSpan) textSpan.textContent = '复制日志';
        modalCopyBtn.classList.remove('copied');
        document.body.classList.remove('modal-open');
    }

    modalCloseX.addEventListener('click', closeModal);
    modalCloseBtn.addEventListener('click', closeModal);
    logModal.addEventListener('click', (e) => {
        if (e.target === logModal) closeModal();
    });

    // Copy Content
    modalCopyBtn.addEventListener('click', () => {
        const codeText = modalCodeBlock.textContent;
        navigator.clipboard.writeText(codeText).then(() => {
            const textSpan = modalCopyBtn.querySelector('.copy-text');
            if (textSpan) textSpan.textContent = '已复制！';
            modalCopyBtn.classList.add('copied');
            setTimeout(() => {
                if (textSpan) textSpan.textContent = '复制日志';
                modalCopyBtn.classList.remove('copied');
            }, 1500);
        }).catch(err => {
            console.error('Copy failed: ', err);
        });
    });

    // Troubleshoot link redirection
    window.troubleshootAccount = function (username) {
        hideErrorPopover();
        if (!username) return;
        const dateVal = exceptionDateInput.value;

        activeSelectedAccount = username;
        saveExceptionStateToCache(username);

        sessionStorage.setItem('autoSearchUsername', username);
        if (dateVal) {
            sessionStorage.setItem('autoSearchDate', dateVal);
        }
        sessionStorage.setItem('fromExceptionDetail', 'true');
        sessionStorage.removeItem('fromDauDetail');

        if (window.self !== window.parent) {
            window.parent.postMessage({ action: 'navigate', page: 'singleQuery/singleQuery.html', fromExceptionDetail: true }, '*');
        } else {
            window.location.href = '../singleQuery/singleQuery.html';
        }
    };

    function updateBadgesAndChart() {
        let evalCount = 0;
        let dataCount = 0;
        let platformCount = 0;
        let avCount = 0;
        let avTestCount = 0;
        let otherCount = 0;

        currentLogsList.forEach(item => {
            if (item.category === 'evaluation_error') evalCount++;
            else if (item.category === 'data_error') dataCount++;
            else if (item.category === 'platform_error') platformCount++;
            else if (item.category === 'audio_video_error') avCount++;
            else if (item.category === 'audio_video_test') avTestCount++;
            else if (item.category === 'other_error') otherCount++;
        });

        // Set Tab labels
        badgeAll.textContent = currentLogsList.length;
        badgeEval.textContent = evalCount;
        badgeData.textContent = dataCount;
        badgePlatform.textContent = platformCount;
        badgeAv.textContent = avCount;
        if (badgeAvTest) badgeAvTest.textContent = avTestCount;
        badgeOther.textContent = otherCount;

        // Render Chart
        renderExceptionChart(evalCount, dataCount, platformCount, avCount, avTestCount, otherCount);
    }

    // Load Data Main Routine
    async function loadData(forceRefresh = false) {
        const selectedDate = exceptionDateInput.value;
        sessionStorage.setItem('exceptionReportDate', selectedDate);
        updateQuickDateActive(selectedDate);

        // 只有从单查询排查页面点击“返回异常分类详情”返回，且存在持久化缓存时，才直接恢复现场；常规进入或刷新一律拉取实时最新数据
        const isBackFromSingleQuery = sessionStorage.getItem('fromExceptionDetail_back') === 'true';
        if (isBackFromSingleQuery) {
            sessionStorage.removeItem('fromExceptionDetail_back');
        }

        if (!forceRefresh && isBackFromSingleQuery) {
            const cache = getGlobalCache();
            if (cache && cache.date === selectedDate && cache.list && cache.list.length > 0) {
                currentLogsList = cache.list;

                if (cache.activeSelectedAccount !== undefined) {
                    activeSelectedAccount = cache.activeSelectedAccount;
                }
                if (cache.searchQuery !== undefined && exceptionSearchInput) {
                    exceptionSearchInput.value = cache.searchQuery;
                }
                if (cache.selectedCategory) {
                    selectedCategory = cache.selectedCategory;
                }

                updateBadgesAndChart();
                switchTab(selectedCategory);

                if (cache.scrollY) {
                    setTimeout(() => {
                        window.scrollTo({ top: cache.scrollY, behavior: 'instant' });
                    }, 50);
                }
                return;
            }
        }

        if (pageSubtitle) {
            pageSubtitle.textContent = `正在载入 ${selectedDate} 的异常日志...`;
        }
        exceptionTableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: #409eff;">
                    ⏳ 正在从 OSS 获取异常日志详细数据...
                </td>
            </tr>
        `;

        currentLogsList = await fetchLogs(selectedDate);
        updateBadgesAndChart();

        // Calculate segment counts to find highest category
        let evalCount = 0;
        let dataCount = 0;
        let platformCount = 0;
        let avCount = 0;
        let avTestCount = 0;
        let otherCount = 0;

        currentLogsList.forEach(item => {
            if (item.category === 'evaluation_error') evalCount++;
            else if (item.category === 'data_error') dataCount++;
            else if (item.category === 'platform_error') platformCount++;
            else if (item.category === 'audio_video_error') avCount++;
            else if (item.category === 'audio_video_test') avTestCount++;
            else if (item.category === 'other_error') otherCount++;
        });

        // Find the category with the highest count dynamically
        const categoryCounts = {
            'evaluation_error': evalCount,
            'data_error': dataCount,
            'platform_error': platformCount,
            'audio_video_error': avCount,
            'audio_video_test': avTestCount,
            'other_error': otherCount
        };

        let maxCategory = 'evaluation_error'; // Default fallback
        let maxCount = -1;
        Object.entries(categoryCounts).forEach(([cat, count]) => {
            if (count > maxCount) {
                maxCount = count;
                maxCategory = cat;
            }
        });
        selectedCategory = maxCategory;

        saveExceptionStateToCache();
        switchTab(selectedCategory);
    }

    if (exceptionDateInput) {
        exceptionDateInput.addEventListener('change', () => {
            const selectedDate = exceptionDateInput.value;
            sessionStorage.setItem('exceptionReportDate', selectedDate);
            sessionStorage.setItem('reportDate', selectedDate);
            updateQuickDateActive(selectedDate);
            loadData(false);
        });
    }

    // Quick date button clicks (今日, 昨天, 前天)
    const quickDateBtns = document.querySelectorAll('.quick-date-btn');
    quickDateBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const offset = parseInt(btn.dataset.offset, 10);
            const target = new Date();
            target.setDate(target.getDate() + offset);
            const y = target.getFullYear();
            const m = String(target.getMonth() + 1).padStart(2, '0');
            const d = String(target.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;

            if (exceptionDateInput && exceptionDateInput.value === dateStr) return;

            if (exceptionDateInput) {
                exceptionDateInput.value = dateStr;
            }
            sessionStorage.setItem('exceptionReportDate', dateStr);
            sessionStorage.setItem('reportDate', dateStr);
            updateQuickDateActive(dateStr);
            loadData(false);
        });
    });

    const exceptionRefreshBtn = document.getElementById('exceptionRefreshBtn');
    if (exceptionRefreshBtn) {
        exceptionRefreshBtn.addEventListener('click', () => {
            sessionStorage.removeItem('exception_state_cache');
            loadData(true);
        });
    }

    // Initial Load
    initErrorPopover();
    loadData(needForceRefresh);

    // ----------------------------------------------------
    // MOCK DATA Fallbacks
    // ----------------------------------------------------
    function generateMockLogs(dateStr, isError = false) {
        if (isError) {
            return [];
        }

        // Mock list of logs
        const mockUsers = ['user_102938', 'user_882019', 'user_330192', 'user_550182', 'student_demo', 'teacher_admin', 'test_account'];
        const mockUserInfo = {
            'user_102938': { name: '张明宇', school: '光明实验外国语小学', teacher: '王老师', version: '2.5.4' },
            'user_882019': { name: '王泽轩', school: '博雅外国语实验学校', teacher: '李老师', version: '2.5.4' },
            'user_330192': { name: '李俊熙', school: '育英双语国际学校', teacher: '张老师', version: '2.5.3' },
            'user_550182': { name: '赵梓琪', school: '光明实验外国语小学', teacher: '孙老师', version: '2.5.4' },
            'student_demo': { name: '陈小东', school: '南开实验学校本部', teacher: '赵老师', version: '2.5.2' },
            'teacher_admin': { name: '教师管理员', school: '博雅外国语实验学校', teacher: '刘老师', version: '2.5.4' },
            'test_account': { name: '测试学生', school: '育才实验示范学校', teacher: '周老师', version: '2.5.4' }
        };
        const mockFolders = ['evaluation_error', 'data_error', 'platform_error', 'audio_video_error', 'audio_video_test', 'other_error'];
        const mockLogs = [];

        const dateClean = dateStr.replace(/-/g, '_');

        // Let's seed numbers based on the user's report stats (59, 34, 23, 10, 8, 12)
        const counts = {
            'evaluation_error': 59,
            'data_error': 34,
            'platform_error': 23,
            'audio_video_error': 10,
            'audio_video_test': 8,
            'other_error': 12
        };

        let hours = 9;
        let minutes = 15;
        let seconds = 30;

        Object.entries(counts).forEach(([folder, count]) => {
            for (let i = 0; i < count; i++) {
                const user = mockUsers[Math.floor(Math.random() * mockUsers.length)];
                const uInfo = mockUserInfo[user] || { name: '未知学生', school: '示范学校', teacher: '带班老师', version: '2.5.4' };

                seconds += 14;
                if (seconds >= 60) {
                    seconds = seconds % 60;
                    minutes += 1;
                }
                if (minutes >= 60) {
                    minutes = minutes % 60;
                    hours += 1;
                }
                if (hours >= 24) {
                    hours = hours % 24;
                }

                const hh = String(hours).padStart(2, '0');
                const mm = String(minutes).padStart(2, '0');
                const ss = String(seconds).padStart(2, '0');

                const fileName = `log_${user}_${dateClean}_${hh}${mm}${ss}.json`;
                const size = Math.floor(Math.random() * 25000) + 1200; // 1.2KB to 26KB
                const key = `usertemp/xuelianxitong/${dateClean}/${user}/${folder}/${fileName}`;
                const mockContent = getMockFileContent(key);
                let mockParsed = null;
                try {
                    mockParsed = JSON.parse(mockContent);
                } catch (e) { }

                mockLogs.push({
                    key: key,
                    username: user,
                    studentName: uInfo.name,
                    schoolName: uInfo.school,
                    teacherName: uInfo.teacher,
                    version: uInfo.version,
                    category: folder,
                    fileName: fileName,
                    timeStr: `${hh}:${mm}:${ss}`,
                    lastModified: `${dateStr}T${hh}:${mm}:${ss}Z`,
                    size: size,
                    rawContent: mockContent,
                    parsedData: mockParsed
                });
            }
        });

        // Sort by time newest first
        mockLogs.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
        return mockLogs;
    }

    function getMockFileContent(key) {
        const parts = key.split('/');
        const username = parts[3] || 'unknown';
        const errorType = parts[4] || 'other_error';
        const filename = parts[parts.length - 1] || '';

        const mockPayload = {
            "meta": {
                "client": "XueLianXiTong Client/1.8.5",
                "phoneModel": "iPhone 13 Pro Max",
                "osVersion": "iOS 16.4.1",
                "logTime": new Date().toISOString(),
                "file": filename,
                "username": username
            },
            "errorType": errorType,
            "errorMessage": "",
            "stackTrace": ""
        };

        if (errorType === 'evaluation_error') {
            mockPayload.errorMessage = "Evaluation engine timeout: failed to align speech stream with template";
            mockPayload.stackTrace = "Error: EvaluationEngineException: timeout\n  at SpeechEvaluator.cpp:142\n  at runEngine (eval_core.js:409)\n  at processAudio (audio_processor.js:98)";
            mockPayload.audioInfo = {
                "sampleRate": 16000,
                "channels": 1,
                "format": "pcm_s16le",
                "durationMs": 4200
            };
        } else if (errorType === 'data_error') {
            mockPayload.errorMessage = "JSONParseException: Course config is missing required 'chapterId' field";
            mockPayload.stackTrace = "com.xuelianxi.data.exception.DataValidationException: Invalid config schema\n  at com.xuelianxi.data.Parser.validate(Parser.java:54)\n  at com.xuelianxi.data.Loader.loadAsync(Loader.java:128)";
            mockPayload.payload = {
                "courseId": 29810,
                "courseName": "初中语文朗读精品练习",
                "publisher": "人教版",
                "timestamp": Date.now()
            };
        } else if (errorType === 'platform_error') {
            mockPayload.errorMessage = "Gateway API HTTP 504 Gateway Timeout";
            mockPayload.stackTrace = "NetworkError: Request timed out for GET /api/v2/student/coursework/status after 15000ms\n  at HttpClient.send (http_client.js:32)\n  at ApiService.getCoursework (api_service.js:180)";
            mockPayload.networkState = {
                "online": true,
                "type": "wifi",
                "signalStrength": "weak",
                "pingMs": 1420
            };
        } else if (errorType === 'audio_video_error') {
            mockPayload.errorMessage = "MediaRecorder: Failed to start recording session: microphone resource occupied";
            mockPayload.stackTrace = "DOMException: Could not start video source: Permission denied or resource busy\n  at navigator.mediaDevices.getUserMedia (media_api.js:12)\n  at AudioRecorder.start (recorder.js:72)";
        } else if (errorType === 'audio_video_test') {
            mockPayload.errorMessage = "AudioVideoTest: Video playback test metric completed (fps: 30, dropped: 0)";
            mockPayload.stackTrace = "Benchmark: Test session completed successfully\n  at runAvBenchmark (av_test.js:88)\n  at VideoPlayerTester.onMetrics (tester.js:145)";
            mockPayload.mediaUrl = "https://example.com/test_video.mp4";
        } else {
            mockPayload.errorMessage = "Unexpected runtime crash: OutOfMemoryError in Javascript VM thread";
            mockPayload.stackTrace = "Fatal Error: Heap out of memory\n  at Array.map (<anonymous>)\n  at parseBigLogs (analyzer.js:204)\n  at runScheduleTask (cron.js:42)";
        }

        return JSON.stringify(mockPayload, null, 2);
    }

    // Theme synchronization for errorBarChart
    window.addEventListener('themeChanged', () => {
        if (lastExceptionChartParams) {
            renderExceptionChart(
                lastExceptionChartParams.evalCount,
                lastExceptionChartParams.dataCount,
                lastExceptionChartParams.platformCount,
                lastExceptionChartParams.otherCount,
                lastExceptionChartParams.avCount,
                lastExceptionChartParams.avTestCount
            );
        }
    });

    window.addEventListener('resize', () => {
        if (errorBarChart && !errorBarChart.isDisposed()) {
            errorBarChart.resize();
        }
    });
});

