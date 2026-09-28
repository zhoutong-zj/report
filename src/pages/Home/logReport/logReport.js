document.addEventListener('DOMContentLoaded', () => {
    // 1. DOM Elements
    const reportDateInput = document.getElementById('reportDate');
    const quickDateBtns = document.querySelectorAll('.quick-date-btn');
    const currentDateEl = document.getElementById('currentDate');
    const noConfigAlert = document.getElementById('noConfigAlert');

    // Stats Grid elements
    const todayErrorCountEl = document.getElementById('todayErrorCount');
    const todayErrorTrendEl = document.getElementById('todayErrorTrend');
    const mainErrorTypeEl = document.getElementById('mainErrorType');
    const mainErrorTypePercentEl = document.getElementById('mainErrorTypePercent');
    const activeUserCountEl = document.getElementById('activeUserCount');
    const monitorStatusEl = document.getElementById('monitorStatus');
    const monitorStatusLabelEl = document.getElementById('monitorStatusLabel');

    // Analysis list
    const suggestionList = document.getElementById('suggestionList');

    function formatDate(d) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    function updateQuickDateActive(dateStr) {
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

    // 2. Initialize Date Picker (using sessionStorage to preserve chosen date)
    const today = new Date();
    const todayStr = formatDate(today);
    const savedDate = sessionStorage.getItem('reportDate') || todayStr;
    reportDateInput.value = savedDate;
    updateDateDisplay(savedDate);
    updateQuickDateActive(savedDate);

    function updateDateDisplay(dateStr) {
        const d = new Date(dateStr);
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        currentDateEl.textContent = d.toLocaleDateString('zh-CN', options);
    }

    // Initialize Sort Selector from sessionStorage
    const sortSelector = document.getElementById('sortSelector');
    if (sortSelector) {
        sortSelector.value = sessionStorage.getItem('currentSortType') || 'count';
    }

    // Navigation helper to jump to singleQuery page for a specified account
    function navigateToUserSingleQuery(username) {
        if (!username || username === '-' || username === '正在载入...' || username === '无报错账号' || username === '无数据' || username === '无异常上报' || username.includes('...')) {
            return;
        }

        const dateVal = reportDateInput ? reportDateInput.value : '';

        sessionStorage.setItem('autoSearchUsername', username);
        if (dateVal) {
            sessionStorage.setItem('autoSearchDate', dateVal);
        }
        sessionStorage.setItem('lastClickedAccount', username);

        const existingHistory = JSON.parse(sessionStorage.getItem('clickedAccountsHistory') || '[]');
        const updatedHistory = Array.from(new Set([...existingHistory, username]));
        sessionStorage.setItem('clickedAccountsHistory', JSON.stringify(updatedHistory));

        if (window.self !== window.parent) {
            window.parent.postMessage({ action: 'navigate', page: 'singleQuery/singleQuery.html' }, '*');
        } else {
            window.location.href = '../singleQuery/singleQuery.html';
        }
    }

    const topAccountCard = document.getElementById('topAccountCard');
    if (topAccountCard) {
        topAccountCard.addEventListener('click', () => {
            const username = mainErrorTypeEl ? mainErrorTypeEl.textContent.trim() : '';
            navigateToUserSingleQuery(username);
        });
    }

    // 4. Check credentials and load OSS data
    let ossClient = null;
    let errorLineChart = null;
    let currentAccountsList = [];

    // Delegated event listener for sorting dropdown to ensure robustness
    document.addEventListener('change', (e) => {
        if (e.target && e.target.id === 'sortSelector') {
            console.log('sortSelector changed, new value:', e.target.value);
            sessionStorage.setItem('currentSortType', e.target.value);
            sortAndRenderAccounts();
        }
    });

    function timeToSeconds(timeStr) {
        if (!timeStr) return 0;
        const cleanStr = timeStr.trim();
        if (cleanStr === '-' || cleanStr === '') return 0;
        const parts = cleanStr.split(':');
        if (parts.length !== 3) return 0;
        return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
    }

    function sortAndRenderAccounts() {
        const sortSelector = document.getElementById('sortSelector');
        const sortType = sortSelector ? sortSelector.value : 'count';
        const sortedList = [...currentAccountsList];

        console.log('Sorting accounts list by:', sortType, 'Original count:', sortedList.length);

        if (sortType === 'time') {
            sortedList.sort((a, b) => {
                const timeA = a.lastTime || '';
                const timeB = b.lastTime || '';

                const isAEmpty = (timeA === '-' || !timeA);
                const isBEmpty = (timeB === '-' || !timeB);

                if (isAEmpty && isBEmpty) return 0;
                if (isAEmpty) return 1;
                if (isBEmpty) return -1;

                const secA = timeToSeconds(timeA);
                const secB = timeToSeconds(timeB);
                if (secB === secA) return 0;
                return secB > secA ? 1 : -1;
            });
        } else if (sortType === 'count') {
            sortedList.sort((a, b) => b.count - a.count);
        }

        console.log('Sorted list mapped output:', sortedList.map(item => `${item.username} (count: ${item.count}, time: ${item.lastTime})`));
        renderExceptionAccounts(sortedList);

        const historyList = document.getElementById('historyList');
        if (historyList) {
            console.log('historyList connection state: isConnected=' + historyList.isConnected + ', inBody=' + document.body.contains(historyList) + ', location=' + document.location.href + ', childCount=' + historyList.children.length);
            const names = Array.from(historyList.querySelectorAll('.history-name')).map(el => el.textContent);
            console.log('DOM list order after rendering:', names.join(', '));
        }
    }

    // Cache last chart parameters for theme re-rendering
    let lastLineChartParams = null;
    let lastPieChartParams = null;
    let lastDauChartParams = null;

    // Helper to render ECharts line chart of user error distribution
    function renderLineChart(labels, data) {
        lastLineChartParams = { labels, data };
        const dom = document.getElementById('userErrorLineChart');
        if (!dom || typeof echarts === 'undefined') return;

        const theme = window.ThemeManager ? window.ThemeManager.getTheme() : 'light';
        const colors = window.ThemeManager ? window.ThemeManager.getChartTheme(theme) : {};

        if (errorLineChart && !errorLineChart.isDisposed()) {
            errorLineChart.dispose();
        }
        errorLineChart = echarts.init(dom, theme === 'dark' ? 'dark' : null);

        const option = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                formatter: function (params) {
                    const p = params[0];
                    return `<div style="font-weight: 600; margin-bottom: 4px;">${p.name}</div>
                            <div>报错日志总数: <span style="font-weight: bold; color: #f56c6c;">${p.value}</span> 个</div>`;
                }
            },
            grid: {
                top: 25,
                left: 55,
                right: 35,
                bottom: labels && labels.length > 8 ? 45 : 28
            },
            xAxis: {
                type: 'category',
                data: labels,
                boundaryGap: false,
                axisLine: { lineStyle: { color: colors.borderColor || '#e2e8f0' } },
                axisLabel: {
                    color: colors.textColor || '#909399',
                    interval: 0,
                    rotate: labels && labels.length > 8 ? 25 : 0,
                    fontSize: 11
                }
            },
            yAxis: {
                type: 'value',
                minInterval: 1,
                splitLine: { lineStyle: { color: colors.gridColor || '#f0f2f5' } },
                axisLabel: { color: colors.textColor || '#909399', fontSize: 11 }
            },
            series: [{
                name: '报错日志总数',
                type: 'line',
                smooth: 0.3,
                symbol: 'circle',
                symbolSize: 6,
                itemStyle: { color: '#409eff' },
                lineStyle: { width: 2.5, color: '#409eff' },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(64, 158, 255, 0.35)' },
                        { offset: 1, color: 'rgba(64, 158, 255, 0.02)' }
                    ])
                },
                data: data
            }]
        };
        errorLineChart.setOption(option);
    }

    // Render horizontal bar chart for exception type distribution with ECharts
    let errorBarChart = null;
    function renderPieChart(evalCount, dataCount, platformCount, otherCount, audioVideoCount = 0, audioVideoTestCount = 0) {
        lastPieChartParams = { evalCount, dataCount, platformCount, otherCount, audioVideoCount, audioVideoTestCount };
        const dom = document.getElementById('errorTypePieChart');
        if (!dom || typeof echarts === 'undefined') return;

        const theme = window.ThemeManager ? window.ThemeManager.getTheme() : 'light';
        const colors = window.ThemeManager ? window.ThemeManager.getChartTheme(theme) : {};

        if (errorBarChart && !errorBarChart.isDisposed()) {
            errorBarChart.dispose();
        }
        errorBarChart = echarts.init(dom, theme === 'dark' ? 'dark' : null);

        const total = evalCount + dataCount + platformCount + otherCount + audioVideoCount + audioVideoTestCount;
        const categories = ['其他异常', '音视频测试', '音视频异常', '平台异常', '数据异常', '评测异常'];
        const values = [otherCount, audioVideoTestCount, audioVideoCount, platformCount, dataCount, evalCount];

        const colorGradients = [
            new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#6a85b6' }, { offset: 1, color: '#bac8e0' }]),
            new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#1976d2' }, { offset: 1, color: '#42a5f5' }]),
            new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#8e44ad' }, { offset: 1, color: '#bb86fc' }]),
            new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#f7971e' }, { offset: 1, color: '#ffd200' }]),
            new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#ff6b6b' }, { offset: 1, color: '#ff8e53' }]),
            new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#11998e' }, { offset: 1, color: '#38ef7d' }])
        ];

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
                            <div>异常频次: <span style="font-weight: bold;">${val}</span> 次 (${pct}%)</div>`;
                }
            },
            grid: {
                top: 15,
                left: 85,
                right: 55,
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
                itemStyle: {
                    borderRadius: [0, 4, 4, 0],
                    color: function (params) {
                        return colorGradients[params.dataIndex] || '#409eff';
                    }
                },
                label: {
                    show: true,
                    position: 'right',
                    formatter: '{c} 次',
                    color: colors.textColor || '#303133',
                    fontWeight: 600,
                    fontSize: 11
                },
                data: values
            }]
        };
        errorBarChart.setOption(option);
    }

    // Helper to calculate 10 dates ending on selectedDateStr (inclusive)
    function getRecent10Dates(selectedDateStr) {
        const list = [];
        if (!selectedDateStr) {
            selectedDateStr = new Date().toISOString().split('T')[0];
        }
        const parts = selectedDateStr.split('-');
        const endDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));

        for (let i = 9; i >= 0; i--) {
            const d = new Date(endDate);
            d.setDate(d.getDate() - i);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');

            list.push({
                dateStr: `${yyyy}-${mm}-${dd}`,
                ossFolder: `${yyyy}_${mm}_${dd}`,
                label: `${mm}-${dd}`
            });
        }
        return list;
    }

    // Render 10-day Daily Active Users (DAU) line chart with ECharts
    let dauLineChart = null;
    function renderDauChart(labels, data) {
        lastDauChartParams = { labels, data };
        const dom = document.getElementById('dauLineChart');
        if (!dom || typeof echarts === 'undefined') return;

        const todayDauEl = document.getElementById('todayDauCount');
        if (todayDauEl && data && data.length > 0) {
            todayDauEl.textContent = data[data.length - 1];
        }

        const theme = window.ThemeManager ? window.ThemeManager.getTheme() : 'light';
        const colors = window.ThemeManager ? window.ThemeManager.getChartTheme(theme) : {};

        if (dauLineChart && !dauLineChart.isDisposed()) {
            dauLineChart.dispose();
        }
        dauLineChart = echarts.init(dom, theme === 'dark' ? 'dark' : null);

        const option = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                formatter: function (params) {
                    const p = params[0];
                    return `<div style="font-weight: 600; margin-bottom: 4px;">${p.name}</div>
                            <div>日活数量: <span style="font-weight: bold; color: #409eff;">${p.value}</span> 个</div>`;
                }
            },
            grid: {
                top: 25,
                left: 45,
                right: 30,
                bottom: 25
            },
            xAxis: {
                type: 'category',
                data: labels,
                boundaryGap: false,
                axisLine: { lineStyle: { color: colors.borderColor || '#e2e8f0' } },
                axisLabel: { color: colors.textColor || '#909399', fontSize: 11 }
            },
            yAxis: {
                type: 'value',
                minInterval: 1,
                splitLine: { lineStyle: { color: colors.gridColor || '#f0f2f5' } },
                axisLabel: { color: colors.textColor || '#909399', fontSize: 11 }
            },
            series: [{
                name: '日活数量',
                type: 'line',
                smooth: 0.35,
                symbol: 'circle',
                symbolSize: 6,
                itemStyle: { color: '#409eff' },
                lineStyle: { width: 2.5, color: '#409eff' },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(64, 158, 255, 0.35)' },
                        { offset: 1, color: 'rgba(64, 158, 255, 0.02)' }
                    ])
                },
                label: {
                    show: true,
                    position: 'top',
                    formatter: '{c} 个',
                    color: '#409eff',
                    fontWeight: 'bold',
                    fontSize: 11
                },
                data: data
            }]
        };
        dauLineChart.setOption(option);
    }

    function initAndLoadReport() {
        const savedConfig = localStorage.getItem('oss_tool_config');
        if (!savedConfig) {
            // Show warning alert and keep static mock data
            noConfigAlert.style.display = 'flex';
            useStaticMockData();
            return;
        }

        noConfigAlert.style.display = 'none';

        try {
            const config = JSON.parse(savedConfig);
            const { accessKeyId, accessKeySecret, endpoint, bucket } = config;

            if (!accessKeyId || !accessKeySecret || !endpoint || !bucket) {
                noConfigAlert.style.display = 'flex';
                useStaticMockData();
                return;
            }

            // Extract region dynamically
            let region = 'oss-cn-shanghai';
            if (endpoint.includes('.aliyuncs.com')) {
                region = endpoint.split('.aliyuncs.com')[0];
            } else {
                region = endpoint;
            }

            // Initialize SDK OSS client
            ossClient = new OSS({
                region: region,
                accessKeyId: accessKeyId,
                accessKeySecret: accessKeySecret,
                bucket: bucket,
                secure: true
            });

            // Fetch dynamic report data from OSS
            loadDynamicReport(reportDateInput.value);

        } catch (e) {
            console.error('Failed to initialize OSS client in report page:', e);
            noConfigAlert.style.display = 'flex';
            useStaticMockData();
        }
    }

    initAndLoadReport();

    // Listen to date changes
    reportDateInput.addEventListener('change', (e) => {
        const selectedDate = e.target.value;
        sessionStorage.setItem('reportDate', selectedDate);
        updateDateDisplay(selectedDate);
        updateQuickDateActive(selectedDate);
        if (ossClient) {
            loadDynamicReport(selectedDate);
        } else {
            useStaticMockData();
        }
    });

    // Quick date button clicks (今日, 昨天, 前天)
    quickDateBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const offset = parseInt(btn.dataset.offset, 10);
            const target = new Date();
            target.setDate(target.getDate() + offset);
            const dateStr = formatDate(target);
            reportDateInput.value = dateStr;
            sessionStorage.setItem('reportDate', dateStr);
            quickDateBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateDateDisplay(dateStr);
            if (ossClient) {
                loadDynamicReport(dateStr);
            } else {
                useStaticMockData();
            }
        });
    });

    // 5. Fetch and analyze OSS directory files
    async function loadDynamicReport(dateStr) {
        if (!ossClient) return;

        const formattedDate = dateStr.replace(/-/g, '_');
        const prefix = `usertemp/xuelianxitong/${formattedDate}/`;

        setLoadingState();

        try {
            // Fetch objects under prefix (supports pagination if > 1000 files)
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

            analyzeAndRenderData(objects);

            // Fetch recent 10 days of DAU user_activity file counts from OSS concurrently
            const recent10Dates = getRecent10Dates(dateStr);
            const dauPromises = recent10Dates.map(item => {
                const dauPrefix = `usertemp/xuelianxitong/${item.ossFolder}/user_activity/`;
                return ossClient.list({
                    prefix: dauPrefix,
                    'max-keys': 1000
                }).then(res => {
                    const objs = res.objects || [];
                    return objs.filter(obj => obj.name && !obj.name.endsWith('/')).length;
                }).catch(err => {
                    console.warn(`DAU fetch failed for ${dauPrefix}:`, err);
                    return 0;
                });
            });

            const dauCounts = await Promise.all(dauPromises);
            const dauLabels = recent10Dates.map(item => item.label);
            renderDauChart(dauLabels, dauCounts);

            monitorStatusEl.textContent = '正常运行';
            monitorStatusEl.style.color = '#67c23a';
            monitorStatusLabelEl.textContent = 'OSS 日志获取成功';

        } catch (error) {
            console.error('Failed to list files for dashboard report:', error);
            monitorStatusEl.textContent = '通信失败';
            monitorStatusEl.style.color = '#f56c6c';
            monitorStatusLabelEl.textContent = '获取失败: 请检查网络/CORS/权限';
            useStaticMockData(true); // Fallback to zeroes to represent empty state upon error
        }
    }

    function setLoadingState() {
        todayErrorCountEl.textContent = '...';
        mainErrorTypeEl.textContent = '正在载入...';
        mainErrorTypePercentEl.textContent = '报错 - 次 · 最后时间 -';
        activeUserCountEl.textContent = '...';
        const todayDauEl = document.getElementById('todayDauCount');
        if (todayDauEl) {
            todayDauEl.textContent = '...';
        }
    }

    // 6. Aggregate data and render charts
    function analyzeAndRenderData(objects) {
        let evalCount = 0;
        let dataCount = 0;
        let platformCount = 0;
        let otherCount = 0;
        let audioVideoCount = 0;
        let audioVideoTestCount = 0;
        const uniqueUsers = new Set();
        const userErrorCounts = {};
        const userLastTime = {}; // username -> latest time string

        // Only count files within the designated error folders
        const validFolders = new Set(['data_error', 'platform_error', 'other_error', 'evaluation_error', 'audio_video_error', 'audio_video_test']);

        objects.forEach(obj => {
            const key = obj.name;
            const parts = key.split('/');
            // Expected format: usertemp/xuelianxitong/YYYY_MM_DD/username/error_folder/filename
            if (parts.length >= 5) {
                const username = parts[3];
                const folder = parts[4];

                // Skip directory placeholder objects
                const fileName = parts[parts.length - 1];
                if (!fileName || fileName.trim() === '') {
                    return;
                }

                if (validFolders.has(folder)) {
                    uniqueUsers.add(username);
                    userErrorCounts[username] = (userErrorCounts[username] || 0) + 1;

                    // Get the time of this error
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

                    if (errorTime) {
                        if (!userLastTime[username] || errorTime.localeCompare(userLastTime[username]) > 0) {
                            userLastTime[username] = errorTime;
                        }
                    }

                    if (folder === 'evaluation_error') {
                        evalCount++;
                    } else if (folder === 'data_error') {
                        dataCount++;
                    } else if (folder === 'platform_error') {
                        platformCount++;
                    } else if (folder === 'audio_video_error') {
                        audioVideoCount++;
                    } else if (folder === 'audio_video_test') {
                        audioVideoTestCount++;
                    } else if (folder === 'other_error') {
                        otherCount++;
                    }
                }
            }
        });

        const total = evalCount + dataCount + platformCount + otherCount + audioVideoCount + audioVideoTestCount;

        // Set metrics card
        todayErrorCountEl.textContent = total;
        todayErrorTrendEl.textContent = '实时上传日志文件计数';
        activeUserCountEl.textContent = uniqueUsers.size;

        // Calculate percentages
        const getPercent = (count) => total === 0 ? 0 : parseFloat(((count / total) * 100).toFixed(1));

        // Update charts UI (Render Pie Chart)
        renderPieChart(evalCount, dataCount, platformCount, otherCount, audioVideoCount, audioVideoTestCount);

        // Aggregate error counts per user
        const sortedUserEntries = Object.entries(userErrorCounts).sort((a, b) => b[1] - a[1]);
        const userListWithCounts = sortedUserEntries.map(entry => {
            return {
                username: entry[0],
                count: entry[1],
                lastTime: userLastTime[entry[0]] || '-'
            };
        });

        // Display account with the most errors on this day
        if (userListWithCounts.length === 0) {
            mainErrorTypeEl.textContent = '无报错账号';
            mainErrorTypePercentEl.textContent = '报错 0 次 · 最后时间 -';
        } else {
            const topAccount = userListWithCounts[0];
            mainErrorTypeEl.textContent = topAccount.username;
            mainErrorTypePercentEl.textContent = `报错 ${topAccount.count} 次 · 最后时间 ${topAccount.lastTime}`;
        }

        // Render health suggestion dynamic list if element exists
        if (suggestionList) {
            if (total === 0) {
                suggestionList.innerHTML = `
                    <li><strong>系统运行状态极佳！</strong> 本日该时间段无任何异常日志上报，客户端工作正常。</li>
                `;
            } else {
                let suggestionsHTML = '';
                if (evalCount > 0) {
                    suggestionsHTML += `<li><strong>评测模块报告 (${evalCount} 次)</strong>：占整体比重较明显。建议结合详情列表检查是否发生阿里评测报错或 Crash 堆栈，排查移动端评测超时。</li>`;
                }
                if (dataCount > 0) {
                    suggestionsHTML += `<li><strong>网络数据分析 (${dataCount} 次)</strong>：异常包含教材课程参数不完整，可通过单查询查看任务 JSON 详细配置是否有脏数据。</li>`;
                }
                if (platformCount > 0) {
                    suggestionsHTML += `<li><strong>平台系统异常 (${platformCount} 次)</strong>：这通常代表 API 服务响应错误或网络请求超时，请检查后端网关运行日志。</li>`;
                }
                if (audioVideoCount > 0) {
                    suggestionsHTML += `<li><strong>音视频异常报告 (${audioVideoCount} 次)</strong>：这通常代表音视频录制、播放或流媒体传输错误，请检查设备媒体权限及播放通道。</li>`;
                }
                if (audioVideoTestCount > 0) {
                    suggestionsHTML += `<li><strong>音视频测试报告 (${audioVideoTestCount} 次)</strong>：记录音视频播放或录制专项测试日志，可排查专项测试参数与指标。</li>`;
                }
                if (suggestionsHTML === '') {
                    suggestionsHTML = `<li>当前系统异常主要由其他偶发性错误组成，错误频率在合理区间，无需立即处理。</li>`;
                }
                suggestionList.innerHTML = suggestionsHTML;
            }
        }

        // Render line chart
        const chartLabels = sortedUserEntries.map(entry => entry[0]);
        const chartData = sortedUserEntries.map(entry => entry[1]);
        renderLineChart(chartLabels, chartData);

        // Render exception accounts sidebar list
        currentAccountsList = userListWithCounts;
        sortAndRenderAccounts();
    }

    // 7. Static Mock Data Fallback
    function useStaticMockData(isError = false) {
        const dateStr = reportDateInput ? reportDateInput.value : new Date().toISOString().split('T')[0];
        const recent10Dates = getRecent10Dates(dateStr);
        const mockDauLabels = recent10Dates.map(item => item.label);

        if (isError) {
            todayErrorCountEl.textContent = '0';
            activeUserCountEl.textContent = '0';
            mainErrorTypeEl.textContent = '无数据';
            mainErrorTypePercentEl.textContent = '报错 0 次 · 最后时间 -';

            renderPieChart(0, 0, 0, 0, 0, 0);
            if (suggestionList) {
                suggestionList.innerHTML = `<li>⚠️ 无法获取实时 data。请检查密钥跨域 CORS 设置及网络链接。</li>`;
            }

            renderLineChart([], []);
            renderDauChart(mockDauLabels, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
            return;
        }

        // Default mock data when no configuration exists yet
        todayErrorCountEl.textContent = '138';
        todayErrorTrendEl.textContent = '↑ 18.4% 较昨日';
        activeUserCountEl.textContent = '8';

        renderPieChart(59, 34, 23, 12, 10, 8);

        // Render mock 10-day DAU line chart
        const mockDauCounts = [18, 25, 32, 28, 42, 50, 46, 62, 75, 88];
        renderDauChart(mockDauLabels, mockDauCounts);

        if (suggestionList) {
            suggestionList.innerHTML = `
                <li><strong>评测引擎模块</strong> 占本日异常总量的 <strong>46.2%</strong>，主要由部分设备上评测数据解析中断引起，建议近期排查 OSS 上的 crash 数据。</li>
                <li><strong>数据异常</strong> 大多发生于教材学习任务上报时格式不完整，可通过单查询的“任务详情”查看完整 JSON 字段。</li>
            `;
        }

        // Default static exception accounts list with counts
        const mockUsersWithCounts = [
            { username: 'user_102938', count: 34, lastTime: '17:42:15' },
            { username: 'user_882019', count: 26, lastTime: '16:30:40' },
            { username: 'user_330192', count: 18, lastTime: '15:12:00' },
            { username: 'user_550182', count: 14, lastTime: '14:05:33' }
        ];

        mainErrorTypeEl.textContent = mockUsersWithCounts[0].username;
        mainErrorTypePercentEl.textContent = `报错 ${mockUsersWithCounts[0].count} 次 · 最后时间 ${mockUsersWithCounts[0].lastTime}`;

        currentAccountsList = mockUsersWithCounts;
        sortAndRenderAccounts();

        // Render mock user error distribution line chart
        const mockLabels = mockUsersWithCounts.map(item => item.username);
        const mockData = mockUsersWithCounts.map(item => item.count);
        renderLineChart(mockLabels, mockData);
    }

    // 8. Render exception accounts sidebar list
    function renderExceptionAccounts(accountsList) {
        console.log('Inside renderExceptionAccounts - accountsList first 3:', accountsList.slice(0, 3).map(x => `${x.username} (time: ${x.lastTime})`));

        const historyList = document.getElementById('historyList');
        const historyBadge = document.getElementById('historyBadge');

        if (!historyList) return;

        // Reset badge count
        if (historyBadge) {
            historyBadge.textContent = accountsList.length;
        }

        if (accountsList.length === 0) {
            historyList.innerHTML = `
                <div class="empty-history" id="emptyHistory" style="display: flex;">
                    <svg viewBox="0 0 24 24" width="40" height="40" style="color: #c0c4cc; margin-bottom: 10px;">
                        <path fill="currentColor" d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
                    </svg>
                    <p>暂无历史查询账号</p>
                    <p style="font-size: 12px; margin-top: 4px;">在「单个查询」搜索后，账号将显示在这里</p>
                </div>
            `;
            return;
        }

        // 从 sessionStorage 读取已访问/已选中的账号列表
        const lastClicked = sessionStorage.getItem('lastClickedAccount');
        const clickedHistory = JSON.parse(sessionStorage.getItem('clickedAccountsHistory') || '[]');

        console.log('Building HTML string inside renderExceptionAccounts...');
        let listHTML = '';
        accountsList.forEach((accountInfo, idx) => {
            const username = accountInfo.username;
            const count = accountInfo.count;
            const lastTime = accountInfo.lastTime || '-';
            const serialNum = idx + 1;

            const isSelected = (username === lastClicked) ? 'selected' : '';
            const isVisited = clickedHistory.includes(username) ? 'visited' : '';

            listHTML += `
                <div class="history-item ${isSelected} ${isVisited}" data-username="${username}">
                    <div class="history-item-left">
                        <div class="history-avatar">${serialNum}</div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <span class="history-name">${username}</span>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span class="account-error-badge">${count} 次报错</span>
                                <span class="account-time-badge">最后: ${lastTime}</span>
                            </div>
                        </div>
                    </div>
                    <div class="history-arrow">排查 →</div>
                </div>
            `;
        });

        historyList.innerHTML = listHTML;

        // Force browser layout repaint/reflow to bypass file:// CORS and cached iframe render locks
        historyList.style.display = 'none';
        historyList.offsetHeight; // force reflow
        historyList.style.display = 'flex';

        // Binds event listeners to dynamically rendered history list elements
        historyList.querySelectorAll('.history-item').forEach(item => {
            const username = item.getAttribute('data-username');
            item.addEventListener('click', () => {
                // 保存带搜索的用户名与对应日期到 sessionStorage 中
                sessionStorage.setItem('autoSearchUsername', username);
                sessionStorage.setItem('autoSearchDate', reportDateInput.value);

                // 保存选中及访问历史状态
                sessionStorage.setItem('lastClickedAccount', username);
                const updatedHistory = Array.from(new Set([...clickedHistory, username]));
                sessionStorage.setItem('clickedAccountsHistory', JSON.stringify(updatedHistory));

                // 局部更新类名，获得即时反馈
                document.querySelectorAll('.history-item').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                item.classList.add('visited');

                // 解决本地文件协议/跨域导致的 window.parent 权限拒绝问题：使用 postMessage 通信
                if (window.self !== window.parent) {
                    window.parent.postMessage({ action: 'navigate', page: 'singleQuery/singleQuery.html' }, '*');
                } else {
                    window.location.href = '../singleQuery/singleQuery.html';
                }
            });
        });

        // 渲染完所有节点后，自动将选中项滚动定位至可视区域中部靠上位置
        if (lastClicked) {
            const selectedItem = historyList.querySelector('.history-item.selected');
            if (selectedItem) {
                setTimeout(() => {
                    const containerHeight = historyList.clientHeight;
                    const itemTop = selectedItem.getBoundingClientRect().top - historyList.getBoundingClientRect().top + historyList.scrollTop;
                    const itemHeight = selectedItem.clientHeight;

                    // 计算出将元素放置在滚动容器高度的 25% 处的 targetScrollTop
                    const targetScrollTop = itemTop - (containerHeight * 0.25) + (itemHeight / 2);

                    historyList.scrollTo({
                        top: targetScrollTop,
                        behavior: 'auto'
                    });
                }, 80);
            }
        }
    }

    // 9. View DAU Detail Page Navigation
    const viewDauBtn = document.getElementById('viewDauBtn');
    if (viewDauBtn) {
        viewDauBtn.addEventListener('click', () => {
            const dateVal = reportDateInput ? reportDateInput.value : '';
            sessionStorage.setItem('dauReportDate', dateVal);
            sessionStorage.removeItem('dau_state_cache');
            window.location.href = '../dauDetail/dauDetail.html';
        });
    }

    // 9.1 View Exception Detail Page Navigation
    const viewExceptionDetailBtn = document.getElementById('viewExceptionDetailBtn');
    if (viewExceptionDetailBtn) {
        viewExceptionDetailBtn.addEventListener('click', () => {
            const dateVal = reportDateInput ? reportDateInput.value : '';
            sessionStorage.setItem('exceptionReportDate', dateVal);
            sessionStorage.removeItem('exception_state_cache');
            sessionStorage.setItem('force_refresh_exception', 'true');
            window.location.href = '../exceptionDetail/exceptionDetail.html';
        });
    }

    // 10. Theme Change Adaptations for Charts
    function syncAllChartsTheme(theme) {
        if (lastLineChartParams) renderLineChart(lastLineChartParams.labels, lastLineChartParams.data);
        if (lastPieChartParams) renderPieChart(lastPieChartParams.evalCount, lastPieChartParams.dataCount, lastPieChartParams.platformCount, lastPieChartParams.otherCount, lastPieChartParams.audioVideoCount, lastPieChartParams.audioVideoTestCount);
        if (lastDauChartParams) renderDauChart(lastDauChartParams.labels, lastDauChartParams.data);
    }

    window.addEventListener('themeChanged', (e) => {
        syncAllChartsTheme(e.detail ? e.detail.theme : null);
    });

    window.addEventListener('resize', () => {
        if (errorLineChart && !errorLineChart.isDisposed()) errorLineChart.resize();
        if (errorBarChart && !errorBarChart.isDisposed()) errorBarChart.resize();
        if (dauLineChart && !dauLineChart.isDisposed()) dauLineChart.resize();
    });
});


