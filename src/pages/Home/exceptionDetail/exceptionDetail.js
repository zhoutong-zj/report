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
        'evaluation_error': '#11998e',
        'data_error': '#ff6b6b',
        'platform_error': '#f7971e',
        'audio_video_error': '#8e44ad',
        'audio_video_test': '#2196f3',
        'other_error': '#6a85b6',
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

    // 2. Initialize Date Picker
    const savedDate = sessionStorage.getItem('exceptionReportDate') || sessionStorage.getItem('reportDate') || new Date().toISOString().split('T')[0];
    exceptionDateInput.value = savedDate;

    // 检查是否有强制刷新标记（例如在单查询页面删除了用户数据）
    const needForceRefresh = sessionStorage.getItem('force_refresh_exception') === 'true';
    if (needForceRefresh) {
        sessionStorage.removeItem('force_refresh_exception');
        sessionStorage.removeItem('exception_state_cache');
    }

    // 3. Back Button
    backBtn.addEventListener('click', () => {
        sessionStorage.removeItem('exception_state_cache');
        window.location.href = '../logReport/logReport.html';
    });

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
            const result = await ossClient.list({
                prefix: prefix,
                'max-keys': 1000
            });

            const objects = result.objects || [];
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

            const itemPromises = filteredObjects.map(async (obj) => {
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

                // Asynchronously load student name and content from JSON
                let studentName = '-';
                let rawContent = '';
                let parsedLogData = null;
                try {
                    const fileRes = await ossClient.get(key);
                    const fileContent = fileRes.content ? fileRes.content.toString() : '';
                    if (fileContent && fileContent.trim() !== '') {
                        rawContent = fileContent;
                        const parsed = JSON.parse(fileContent);
                        parsedLogData = parsed;
                        const data = Array.isArray(parsed) ? (parsed[0] || {}) : parsed;
                        const studentInfo = data.studentInfo || {};
                        studentName = data.nickName || studentInfo.nickName || data.userName || studentInfo.userName || '-';
                    }
                } catch (e) {
                    console.warn(`Failed to read content for ${key}:`, e);
                }

                return {
                    key: key,
                    username: username,
                    studentName: studentName,
                    category: folder,
                    fileName: fileName,
                    timeStr: errorTime || '-',
                    lastModified: obj.lastModified || new Date().toISOString(),
                    size: obj.size,
                    rawContent: rawContent,
                    parsedData: parsedLogData
                };
            });

            const parsedLogs = await Promise.all(itemPromises);

            // Sort logs by time (newest first)
            parsedLogs.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
            return parsedLogs;
        } catch (e) {
            console.error('Failed to list files from OSS:', e);
            return generateMockLogs(dateStr, true);
        }
    }

    // Render Statistics Chart
    function renderExceptionChart(evalCount, dataCount, platformCount, avCount, avTestCount = 0, otherCount = 0) {
        const ctx = document.getElementById('errorTypePieChart').getContext('2d');

        if (errorBarChart) {
            errorBarChart.destroy();
        }

        const total = evalCount + dataCount + platformCount + avCount + avTestCount + otherCount;
        const getPercent = (count) => total === 0 ? 0 : ((count / total) * 100).toFixed(1);

        const categoryKeys = ['evaluation_error', 'data_error', 'platform_error', 'audio_video_error', 'audio_video_test', 'other_error'];

        errorBarChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['评测异常', '数据异常', '平台异常', '音视频异常', '音视频测试', '其他异常'],
                datasets: [{
                    label: '异常数量',
                    data: [evalCount, dataCount, platformCount, avCount, avTestCount, otherCount],
                    backgroundColor: function (context) {
                        const chart = context.chart;
                        const { ctx: chartCtx, chartArea } = chart;
                        const dataIndex = context.dataIndex;
                        const datasetIndex = context.datasetIndex;

                        const meta = chart.getDatasetMeta(datasetIndex);
                        const bar = meta && meta.data ? meta.data[dataIndex] : null;

                        const startX = bar && bar.base ? bar.base : (chartArea ? chartArea.left : 0);
                        const endX = bar && bar.x && bar.x > startX ? bar.x : (chartArea ? chartArea.right : 400);

                        // Highlight selected category or show full gradient
                        const isDimmed = selectedCategory !== 'all' && selectedCategory !== categoryKeys[dataIndex];

                        if (isDimmed) {
                            return 'rgba(220, 223, 230, 0.4)'; // Grayed out if another category is selected
                        }

                        if (dataIndex === 0) { // 评测异常
                            const evalGradient = chartCtx.createLinearGradient(startX, 0, endX, 0);
                            evalGradient.addColorStop(0, '#11998e');
                            evalGradient.addColorStop(1, '#38ef7d');
                            return evalGradient;
                        }
                        if (dataIndex === 1) { // 数据异常
                            const dataGradient = chartCtx.createLinearGradient(startX, 0, endX, 0);
                            dataGradient.addColorStop(0, '#ff6b6b');
                            dataGradient.addColorStop(1, '#ff8e53');
                            return dataGradient;
                        }
                        if (dataIndex === 2) { // 平台异常
                            const platformGradient = chartCtx.createLinearGradient(startX, 0, endX, 0);
                            platformGradient.addColorStop(0, '#f7971e');
                            platformGradient.addColorStop(1, '#ffd200');
                            return platformGradient;
                        }
                        if (dataIndex === 3) { // 音视频异常
                            const avGradient = chartCtx.createLinearGradient(startX, 0, endX, 0);
                            avGradient.addColorStop(0, '#8e44ad');
                            avGradient.addColorStop(1, '#bb86fc');
                            return avGradient;
                        }
                        if (dataIndex === 4) { // 音视频测试
                            const testGradient = chartCtx.createLinearGradient(startX, 0, endX, 0);
                            testGradient.addColorStop(0, '#1976d2');
                            testGradient.addColorStop(1, '#42a5f5');
                            return testGradient;
                        }
                        if (dataIndex === 5) { // 其他异常
                            const otherGradient = chartCtx.createLinearGradient(startX, 0, endX, 0);
                            otherGradient.addColorStop(0, '#6a85b6');
                            otherGradient.addColorStop(1, '#bac8e0');
                            return otherGradient;
                        }
                        return '#909090';
                    },
                    borderColor: [
                        '#0e837a',
                        '#e05656',
                        '#d98214',
                        '#732d91',
                        '#1565c0',
                        '#5872a0'
                    ],
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            plugins: [{
                id: 'datalabels',
                afterDatasetsDraw: function (chart) {
                    const chartCtx = chart.ctx;
                    chart.data.datasets.forEach(function (dataset, i) {
                        const meta = chart.getDatasetMeta(i);
                        meta.data.forEach(function (bar, index) {
                            const data = dataset.data[index];
                            if (data > 0) {
                                chartCtx.fillStyle = '#303133';
                                chartCtx.font = 'bold 12px Arial';
                                chartCtx.textAlign = 'left';
                                chartCtx.textBaseline = 'middle';
                                chartCtx.fillText(data + ' 次', bar.x + 8, bar.y);
                            }
                        });
                    });
                }
            }],
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                onClick: (event, elements) => {
                    if (elements && elements.length > 0) {
                        const clickedIndex = elements[0].index;
                        const clickedCategory = categoryKeys[clickedIndex];

                        // Switch active tab and render
                        switchTab(clickedCategory);
                    }
                },
                layout: {
                    padding: {
                        right: 50
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const count = context.raw;
                                const percent = getPercent(count);
                                return `${count} 次 (${percent}%)`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grace: '10%',
                        grid: {
                            color: '#f0f2f5'
                        },
                        ticks: {
                            precision: 0,
                            color: '#909399',
                            font: {
                                size: 11
                            }
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#303133',
                            font: {
                                size: 13,
                                weight: 500
                            }
                        }
                    }
                }
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
        if (errorBarChart) {
            errorBarChart.update();
        }
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
                if (data.studentInfo && (!item.studentName || item.studentName === '-')) {
                    item.studentName = data.nickName || data.studentInfo.nickName || data.userName || data.studentInfo.userName || '-';
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
            typeBadge.style.backgroundColor = color;
        }

        const userIdVal = item.username || item.userId || '-';
        const nickNameVal = item.studentName || item.nickName || '-';
        const timeVal = item.timeStr || item.errorTime || item.lastModified || '-';
        const sizeVal = formatSize(item.size);

        if (metaEl) {
            metaEl.innerHTML = `
                <span><strong>用户:</strong> ${userIdVal} (${nickNameVal})</span>
                <span><strong>时间:</strong> ${timeVal}</span>
                <span><strong>大小:</strong> ${sizeVal}</span>
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

        const text = extractErrorDataText(item);
        if (text) {
            contentEl.textContent = text;
        } else {
            contentEl.textContent = '正在获取错误数据...';
            getLogItemContent(item).then(updatedItem => {
                if (currentPopoverItem === item) {
                    const updatedText = extractErrorDataText(updatedItem);
                    if (updatedText) {
                        contentEl.textContent = updatedText;
                    } else {
                        const summary = {
                            loginName: item.username,
                            studentName: item.studentName,
                            category: categoryName,
                            time: timeVal,
                            fileName: item.fileName,
                            remark: '暂无独立errorData字段，可点击「查看内容」查看完整日志'
                        };
                        contentEl.textContent = JSON.stringify(summary, null, 2);
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

            // Search filter (Match username or filename)
            if (query) {
                const usernameMatch = item.username && item.username.toLowerCase().includes(query);
                const nameMatch = item.studentName && item.studentName.toLowerCase().includes(query);
                return usernameMatch || nameMatch;
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
                    <td colspan="7" style="text-align: center; padding: 40px; color: #909399;">
                        暂无符合条件的异常日志
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        filteredList.forEach((item, index) => {
            const serialNum = index + 1;
            const sizeFormatted = formatSize(item.size);
            const timeFormatted = item.timeStr;
            const categoryName = folderToName[item.category] || item.category;
            const categoryClass = folderToClass[item.category] || 'other';
            const isSelected = !!(activeSelectedAccount && (
                item.username === activeSelectedAccount ||
                item.studentName === activeSelectedAccount
            ));
            const selectedClass = isSelected ? 'exception-row-selected' : '';

            html += `
                <tr class="${selectedClass}">
                    <td style="text-align: center; color: ${isSelected ? '#f5222d' : '#909399'}; font-weight: ${isSelected ? '700' : '500'};">
                        ${isSelected ? '👉 ' + serialNum : serialNum}
                    </td>
                    <td style="font-weight: 600; color: #303133;">${item.username}</td>
                    <td style="font-weight: 600; color: #303133;">${item.studentName}</td>
                    <td>
                        <span class="type-badge ${categoryClass}">
                            <span class="color-dot ${categoryClass}"></span>
                            ${categoryName}
                        </span>
                    </td>
                    <td><span style="font-weight: 500; color: #0050b3;">${timeFormatted}</span></td>
                    <td><span style="color: #909399;">${sizeFormatted}</span></td>
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

    function displayModalContent(key, content) {
        const parts = key.split('/');
        const fileName = parts[parts.length - 1];
        modalTitle.textContent = fileName;
        modalSubtitle.textContent = key;

        try {
            // Format JSON nicely if valid JSON
            const parsed = JSON.parse(content);
            modalCodeBlock.textContent = JSON.stringify(parsed, null, 2);
        } catch (e) {
            // fallback plain text
            modalCodeBlock.textContent = content;
        }
    }

    // Close Modal Bindings
    function closeModal() {
        logModal.style.display = 'none';
        modalCodeBlock.textContent = '';
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
            modalCopyBtn.innerText = '已复制！';
            modalCopyBtn.style.backgroundColor = '#67c23a';
            modalCopyBtn.style.borderColor = '#67c23a';
            setTimeout(() => {
                modalCopyBtn.innerText = '复制日志';
                modalCopyBtn.style.backgroundColor = '#409eff';
                modalCopyBtn.style.borderColor = '#409eff';
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
            setTimeout(() => {
                window.location.href = '../singleQuery/singleQuery.html';
            }, 150);
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

        // 如果不是强制刷新，且已存在当前日期的持久化缓存数据，则直接使用缓存数据
        if (!forceRefresh) {
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

    exceptionDateInput.addEventListener('change', () => loadData(false));

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
        const mockStudentNames = {
            'user_102938': '张明宇',
            'user_882019': '王泽轩',
            'user_330192': '李俊熙',
            'user_550182': '赵梓琪',
            'student_demo': '陈小东',
            'teacher_admin': '教师管理员',
            'test_account': '测试学生'
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
                const studentName = mockStudentNames[user] || '未知学生';

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
                    studentName: studentName,
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
});
