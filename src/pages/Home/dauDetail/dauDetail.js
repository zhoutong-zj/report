document.addEventListener('DOMContentLoaded', () => {
    // 1. DOM Elements
    const backBtn = document.getElementById('backBtn');
    const dauRefreshBtn = document.getElementById('dauRefreshBtn');
    const resetSchoolFilterBtn = document.getElementById('resetSchoolFilterBtn');
    const resetSchoolFilterText = document.getElementById('resetSchoolFilterText');
    const dauDateInput = document.getElementById('dauDateInput');
    const dauSearchInput = document.getElementById('dauSearchInput');
    const dauSchoolSelect = document.getElementById('dauSchoolSelect');
    const dauSortBtn = document.getElementById('dauSortBtn');
    const dauSortText = document.getElementById('dauSortText');
    const dauTableBody = document.getElementById('dauTableBody');
    const dauPageSubtitle = document.getElementById('dauPageSubtitle');
    const noConfigAlert = document.getElementById('noConfigAlert');
    const studentTotalCount = document.getElementById('studentTotalCount');
    const schoolTotalCount = document.getElementById('schoolTotalCount');

    // State Variables
    let ossClient = null;
    let currentDauList = [];
    let dauSortOrder = 'desc'; // 'desc' = 最新在前 (最后活跃时间 ↓), 'asc' = 最早在前
    let activeSelectedAccount = ''; // 当前选中的排查用户账号

    // 2. Initialize Date Picker
    const savedDate = sessionStorage.getItem('dauReportDate') || sessionStorage.getItem('reportDate') || new Date().toISOString().split('T')[0];
    dauDateInput.value = savedDate;

    // 检查是否有强制刷新标记（例如在单查询页面删除了用户数据）
    const needForceRefreshDau = sessionStorage.getItem('force_refresh_dau') === 'true';
    if (needForceRefreshDau) {
        sessionStorage.removeItem('force_refresh_dau');
        sessionStorage.removeItem('dau_state_cache');
    }

    // 3. Back Button Event
    backBtn.addEventListener('click', () => {
        // 返回日志报表后，清除日活详情页的暂存数据
        sessionStorage.removeItem('dau_state_cache');
        window.location.href = '../logReport/logReport.html';
    });

    // 4. Initialize OSS Client
    function initOssClient() {
        const savedConfig = localStorage.getItem('oss_tool_config');
        if (!savedConfig) {
            noConfigAlert.style.display = 'block';
            return null;
        }

        try {
            const config = JSON.parse(savedConfig);
            const { accessKeyId, accessKeySecret, endpoint, bucket } = config;

            if (!accessKeyId || !accessKeySecret || !endpoint || !bucket) {
                noConfigAlert.style.display = 'block';
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
            noConfigAlert.style.display = 'block';
            return null;
        }
    }

    ossClient = initOssClient();

    // 5. Date formatting helpers
    function formatLastModifiedDate(dateInput) {
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

    // 6. Fetch DAU details from OSS (always fetch live real-time data)
    async function fetchDauDetails(dateStr) {
        const formattedDate = (dateStr || '').replace(/-/g, '_');
        if (!ossClient) {
            return [];
        }

        try {
            const dauPrefix = `usertemp/xuelianxitong/${formattedDate}/user_activity/`;
            const res = await ossClient.list({
                prefix: dauPrefix,
                'max-keys': 1000
            });
            let objs = res.objects || [];
            objs = objs.filter(obj => obj.name && !obj.name.endsWith('/'));

            // Fallback scan if subfolder structure is used
            if (objs.length === 0) {
                const fullRes = await ossClient.list({
                    prefix: `usertemp/xuelianxitong/${formattedDate}/`,
                    'max-keys': 1000
                });
                const fullObjs = fullRes.objects || [];
                objs = fullObjs.filter(obj => obj.name && obj.name.includes('/user_activity/') && !obj.name.endsWith('/'));
            }

            if (objs.length === 0) {
                return [];
            }

            const itemPromises = objs.map(async (obj) => {
                const key = obj.name;
                const parts = key.split('/');
                let fallbackUsername = '未知账号';

                for (let i = 0; i < parts.length; i++) {
                    if (parts[i] === 'user_activity') {
                        if (i > 0 && parts[i - 1] !== formattedDate && parts[i - 1] !== 'xuelianxitong') {
                            fallbackUsername = parts[i - 1];
                        } else if (i < parts.length - 1) {
                            fallbackUsername = parts[i + 1].replace(/\.(json|txt)$/, '');
                        }
                        break;
                    }
                }
                if (fallbackUsername === '未知账号' && parts.length >= 4) {
                    fallbackUsername = parts[3];
                }

                let loginName = fallbackUsername;
                let username = fallbackUsername;
                let schoolName = '-';
                let schoolId = '-';
                let appVersion = '-';
                let deviceName = '-';
                let phonePlatformVersion = '-';

                try {
                    const fileRes = await ossClient.get(key);
                    const fileContent = fileRes.content ? fileRes.content.toString() : '';
                    if (fileContent && fileContent.trim() !== '') {
                        const parsedData = JSON.parse(fileContent);
                        const fileData = Array.isArray(parsedData) ? (parsedData[0] || {}) : parsedData;
                        const studentInfo = fileData.studentInfo || {};

                        loginName = fileData.loginName || studentInfo.loginName || fallbackUsername;
                        username = fileData.nickName || studentInfo.nickName || loginName || fileData.userName || studentInfo.userName || fallbackUsername;
                        // 优先使用 shopName/shopId，同时兼容历史 schoolName/schoolId
                        schoolName = studentInfo.shopName || fileData.shopName || studentInfo.schoolName || fileData.schoolName || '-';
                        schoolId = studentInfo.shopId || fileData.shopId || studentInfo.schoolId || fileData.schoolId || '-';
                        appVersion = fileData.versionName || studentInfo.versionName || fileData.appVersion || fileData.version || fileData.clientVersion || studentInfo.appVersion || studentInfo.version || '-';
                        deviceName = fileData.deviceName || studentInfo.deviceName || '-';
                        phonePlatformVersion = fileData.phonePlatformVersion || studentInfo.phonePlatformVersion || '-';
                    }
                } catch (e) {
                    console.warn(`Failed to read/parse file content for ${key}:`, e);
                }

                return {
                    key: obj.name,
                    lastModified: obj.lastModified || new Date().toISOString(),
                    etag: obj.etag || obj.ETag || '"6EE23EF45C5FADB3F643415A827C5504"',
                    size: obj.size !== undefined ? obj.size : 9256,
                    type: obj.type || 'Normal',
                    ownerId: (obj.owner && obj.owner.id) ? obj.owner.id : '1995174256355793',
                    username: username,
                    loginName: loginName,
                    account: loginName || fallbackUsername,
                    schoolName: schoolName,
                    schoolId: schoolId,
                    shopName: schoolName,
                    shopId: schoolId,
                    appVersion: appVersion,
                    deviceName: deviceName,
                    phonePlatformVersion: phonePlatformVersion
                };
            });

            return await Promise.all(itemPromises);
        } catch (err) {
            console.warn('OSS list failed for DAU details:', err);
            return [];
        }
    }

    // Helper to escape HTML characters
    function escapeHtml(str) {
        if (!str && str !== 0) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    let lastFilteredList = [];

    // 8. Render Table
    function renderDauTable() {
        if (!dauTableBody) return;

        const query = (dauSearchInput ? dauSearchInput.value.trim().toLowerCase() : '');
        const selectedSchool = (dauSchoolSelect ? dauSchoolSelect.value : 'all');

        let filteredList = currentDauList.filter(item => {
            if (selectedSchool !== 'all') {
                if (item.schoolId !== selectedSchool && item.schoolName !== selectedSchool && item.shopId !== selectedSchool && item.shopName !== selectedSchool) {
                    return false;
                }
            }
            if (!query) return true;
            return (item.username && item.username.toLowerCase().includes(query)) ||
                (item.loginName && item.loginName.toLowerCase().includes(query)) ||
                (item.account && item.account.toLowerCase().includes(query)) ||
                (item.shopName && item.shopName.toLowerCase().includes(query)) ||
                (item.shopId && item.shopId.toLowerCase().includes(query)) ||
                (item.schoolName && item.schoolName.toLowerCase().includes(query)) ||
                (item.schoolId && item.schoolId.toLowerCase().includes(query)) ||
                (item.appVersion && item.appVersion.toLowerCase().includes(query)) ||
                (item.deviceName && item.deviceName.toLowerCase().includes(query)) ||
                (item.phonePlatformVersion && item.phonePlatformVersion.toLowerCase().includes(query)) ||
                (item.key && item.key.toLowerCase().includes(query));
        });

        // Sort by LastModified (desc: newest first / 越靠近当前在上面; asc: oldest first)
        filteredList.sort((a, b) => {
            const timeA = new Date(a.lastModified).getTime();
            const timeB = new Date(b.lastModified).getTime();
            if (dauSortOrder === 'desc') {
                return timeB - timeA;
            } else {
                return timeA - timeB;
            }
        });

        lastFilteredList = filteredList;

        const currentDate = dauDateInput ? dauDateInput.value : '';
        const uniqueUsers = new Set(filteredList.map(item => item.loginName || item.account || item.key)).size;
        if (dauPageSubtitle) {
            dauPageSubtitle.textContent = `报表日期：${currentDate} · 活跃用户：${uniqueUsers} 人 · 共 ${filteredList.length} 条记录`;
        }

        // 更新“取消选中学校”按钮状态
        if (resetSchoolFilterBtn) {
            if (selectedSchool !== 'all') {
                resetSchoolFilterBtn.style.display = 'inline-flex';
                const matched = currentDauList.find(i => i.schoolId === selectedSchool || i.schoolName === selectedSchool);
                const schoolLabel = (matched && matched.schoolName && matched.schoolName !== '-') ? matched.schoolName : selectedSchool;
                if (resetSchoolFilterText) {
                    resetSchoolFilterText.textContent = `取消选中学校 (${schoolLabel})`;
                }
            } else {
                resetSchoolFilterBtn.style.display = 'none';
            }
        }

        if (filteredList.length === 0) {
            dauTableBody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; padding: 40px; color: #909399;">
                        暂无相关日活数据
                    </td>
                </tr>
            `;
        } else {
            let html = '';
            filteredList.forEach((item, index) => {
                const serialNum = index + 1;
                const timeFormatted = formatLastModifiedDate(item.lastModified);
                const itemAccount = item.loginName || item.account || '';
                const isSelected = !!(activeSelectedAccount && (
                    itemAccount === activeSelectedAccount ||
                    item.username === activeSelectedAccount ||
                    item.key === activeSelectedAccount ||
                    (item.key && item.key.includes('/' + activeSelectedAccount + '/'))
                ));
                const selectedClass = isSelected ? 'dau-row-selected' : '';

                html += `
                    <tr class="${selectedClass}" data-index="${index}">
                        <td style="text-align: center; color: ${isSelected ? '#1890ff' : '#909399'}; font-weight: ${isSelected ? '700' : '500'};">
                            ${isSelected ? '👉 ' + serialNum : serialNum}
                        </td>
                        <td style="font-weight: 600; color: #409eff;">${escapeHtml(item.loginName || item.account || '-')}</td>
                        <td style="font-weight: 600; color: #303133;">${escapeHtml(item.username || '-')}</td>
                        <td style="color: #606266;" title="${escapeHtml(item.schoolName || '')}">${escapeHtml(item.schoolName || '-')}</td>
                        <td><span class="dau-school-id">${escapeHtml(item.schoolId || '-')}</span></td>
                        <td><span class="dau-version-badge">${escapeHtml(item.appVersion || '-')}</span></td>
                        <td style="color: #303133;" title="${escapeHtml(item.deviceName || '')}">${escapeHtml(item.deviceName || '-')}</td>
                        <td><span class="dau-os-badge">${escapeHtml(item.phonePlatformVersion || '-')}</span></td>
                        <td><span class="dau-time-badge">${escapeHtml(timeFormatted)}</span></td>
                        <td style="text-align: center;">
                            <button class="dau-action-btn ${isSelected ? 'selected' : ''}" data-index="${index}" data-action="investigate">
                                ${isSelected ? '排查中 →' : '排查 →'}
                            </button>
                        </td>
                    </tr>
                `;
            });
            dauTableBody.innerHTML = html;
        }

        // 核心修复：图表始终基于全量日活学校数据（或仅搜索框过滤的数据，而非下拉框过滤的数据）来汇总
        // 这样可以确保切换学校下拉框时，所有的学校柱子依然完整展示，仅仅是选中的柱子高亮/放大，其他柱子淡化
        let chartList = currentDauList;
        if (query) {
            chartList = currentDauList.filter(item => {
                return item.username.toLowerCase().includes(query) ||
                    (item.loginName && item.loginName.toLowerCase().includes(query)) ||
                    (item.account && item.account.toLowerCase().includes(query)) ||
                    (item.shopName && item.shopName.toLowerCase().includes(query)) ||
                    (item.shopId && item.shopId.toLowerCase().includes(query)) ||
                    (item.schoolName && item.schoolName.toLowerCase().includes(query)) ||
                    (item.schoolId && item.schoolId.toLowerCase().includes(query)) ||
                    item.appVersion.toLowerCase().includes(query) ||
                    item.deviceName.toLowerCase().includes(query) ||
                    item.phonePlatformVersion.toLowerCase().includes(query) ||
                    item.key.toLowerCase().includes(query);
            });
        }
        const totalStudents = new Set(chartList.map(item => item.loginName || item.account || item.key)).size;
        const schoolData = aggregateDauBySchool(chartList);
        renderSchoolDauChart(schoolData, totalStudents);
    }

    // 8.1 Aggregate DAU List by School / Shop (using shopId/schoolId & shopName/schoolName, deduplicated by loginName)
    function aggregateDauBySchool(dauList) {
        const schoolMap = {};

        dauList.forEach(item => {
            const sId = item.shopId || item.schoolId || '未知学校';
            const nameCandidate = item.shopName || item.schoolName;
            const sName = (nameCandidate && nameCandidate !== '-') ? nameCandidate : sId;
            // 严格根据 loginName（用户登录名/账号）进行去重
            const userLoginName = item.loginName || item.account || item.key;

            if (!schoolMap[sId]) {
                schoolMap[sId] = {
                    schoolId: sId,
                    schoolName: sName,
                    shopId: sId,
                    shopName: sName,
                    users: new Set()
                };
            }
            if (userLoginName) {
                schoolMap[sId].users.add(userLoginName);
            }
        });

        const result = Object.values(schoolMap).map(item => ({
            schoolId: item.schoolId,
            schoolName: item.schoolName,
            shopId: item.shopId,
            shopName: item.shopName,
            dauCount: item.users.size
        }));

        result.sort((a, b) => b.dauCount - a.dauCount);
        return result;
    }

    // 8.2 Render Chart.js Line Chart for School DAU Distribution
    let schoolChart = null;
    function renderSchoolDauChart(schoolData, totalStudentCount) {
        const canvasEl = document.getElementById('schoolDauLineChart');
        if (!canvasEl) return;

        const totalStudents = totalStudentCount !== undefined ? totalStudentCount : (schoolData ? schoolData.reduce((acc, cur) => acc + (cur.dauCount || 0), 0) : 0);
        if (studentTotalCount) {
            studentTotalCount.textContent = totalStudents;
        }
        if (schoolTotalCount) {
            schoolTotalCount.textContent = (schoolData && schoolData.length) ? schoolData.length : 0;
        }

        if (!schoolData || schoolData.length === 0) {
            if (schoolChart) {
                schoolChart.data.labels = [];
                schoolChart.data.datasets[0].data = [];
                schoolChart.update();
            }
            return;
        }

        const ctx = canvasEl.getContext('2d');
        const labels = schoolData.map(item => item.schoolName);
        const counts = schoolData.map(item => item.dauCount);

        const selectedSchool = (dauSchoolSelect ? dauSchoolSelect.value : 'all');

        const bgColors = [];
        const borderColors = [];
        const labelColors = [];
        const borderWidths = [];

        const defaultGradient = ctx.createLinearGradient(0, 0, 0, 250);
        defaultGradient.addColorStop(0, '#00b4db'); // 默认顶端：优雅湖蓝色
        defaultGradient.addColorStop(1, '#0083b0'); // 默认底端：深海蓝色

        schoolData.forEach(item => {
            if (selectedSchool === 'all') {
                bgColors.push(defaultGradient);
                borderColors.push('#0083b0');
                labelColors.push('#0083b0');
                borderWidths.push(1);
            } else if (item.schoolId === selectedSchool || item.schoolName === selectedSchool || item.shopId === selectedSchool || item.shopName === selectedSchool) {
                const highlightGradient = ctx.createLinearGradient(0, 0, 0, 250);
                highlightGradient.addColorStop(0, '#ff9900'); // 选中顶端：温暖活力橙
                highlightGradient.addColorStop(1, '#ffdd6b'); // 选中底端：明亮暖阳黄
                bgColors.push(highlightGradient);
                borderColors.push('#ff9900');
                labelColors.push('#ff9900');
                borderWidths.push(3); // 选中时边框加粗，视觉上稍微放大
            } else {
                bgColors.push('rgba(0, 180, 219, 0.15)'); // 未选中：半透明湖蓝
                borderColors.push('rgba(0, 180, 219, 0.3)');
                labelColors.push('#909399');
                borderWidths.push(1);
            }
        });

        // 核心优化：如果图表已存在，则直接就地更新数据与样式，不销毁重建，避免柱状图从底部重新动画弹起
        if (schoolChart) {
            schoolChart.data.labels = labels;
            schoolChart.data.datasets[0].data = counts;
            schoolChart.data.datasets[0].backgroundColor = bgColors;
            schoolChart.data.datasets[0].borderColor = borderColors;
            schoolChart.data.datasets[0].borderWidth = borderWidths;
            schoolChart.labelColors = labelColors;
            schoolChart.selectedSchool = selectedSchool;
            schoolChart.schoolData = schoolData;
            schoolChart.update();
            return;
        }

        schoolChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '日活人数',
                    data: counts,
                    backgroundColor: bgColors,
                    borderColor: borderColors,
                    borderWidth: borderWidths,
                    borderRadius: 6,
                    maxBarThickness: 48
                }]
            },
            plugins: [{
                id: 'schoolDataLabels',
                afterDatasetsDraw: function (chart) {
                    const chartCtx = chart.ctx;
                    chart.data.datasets.forEach(function (dataset, i) {
                        const meta = chart.getDatasetMeta(i);
                        meta.data.forEach(function (point, index) {
                            const val = dataset.data[index];
                            if (val !== undefined && val !== null) {
                                chartCtx.fillStyle = labelColors[index] || '#409eff';
                                const isHighlighted = selectedSchool !== 'all' && (
                                    schoolData[index].schoolId === selectedSchool ||
                                    schoolData[index].schoolName === selectedSchool ||
                                    schoolData[index].shopId === selectedSchool ||
                                    schoolData[index].shopName === selectedSchool
                                );
                                chartCtx.font = isHighlighted ? 'bold 12px Arial' : 'bold 11px Arial';
                                chartCtx.textAlign = 'center';
                                chartCtx.textBaseline = 'bottom';
                                chartCtx.fillText(val + ' 人', point.x, point.y - 6);
                            }
                        });
                    });
                }
            }],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (event, elements) => {
                    if (elements && elements.length > 0) {
                        const idx = elements[0].index;
                        const clickedItem = schoolData[idx];
                        if (dauSchoolSelect) {
                            const targetId = clickedItem.shopId || clickedItem.schoolId;
                            // 如果已选中当前柱子，再次点击则取消选中
                            if (dauSchoolSelect.value === clickedItem.schoolId || dauSchoolSelect.value === clickedItem.schoolName || dauSchoolSelect.value === clickedItem.shopId || dauSchoolSelect.value === clickedItem.shopName) {
                                dauSchoolSelect.value = 'all';
                            } else {
                                dauSchoolSelect.value = targetId;
                            }
                            saveCurrentStateToCache();
                            renderDauTable();
                        }
                    }
                },
                layout: {
                    padding: {
                        top: 25 // 预留顶部空间，防止柱状图上方数字被裁剪/遮挡
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            title: function (context) {
                                const idx = context[0].dataIndex;
                                const item = schoolData[idx];
                                return `${item.schoolName} (${item.schoolId})`;
                            },
                            label: function (context) {
                                return ` 日活人数: ${context.raw} 人`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#606266',
                            font: {
                                size: 12
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grace: '15%', // 自动增加Y轴顶部15%的弹性间距，确保最大值标签完整展示
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
                    }
                }
            }
        });
    }

    // 8.3 缓存获取与保存逻辑（使用 sessionStorage 跨子页面持久化）
    function getGlobalCache() {
        try {
            const str = sessionStorage.getItem('dau_state_cache');
            if (str) return JSON.parse(str);
        } catch (e) { }
        return null;
    }

    function saveCurrentStateToCache() {
        const selectedDate = dauDateInput ? dauDateInput.value : '';
        const selectedSchool = dauSchoolSelect ? dauSchoolSelect.value : 'all';
        const searchQuery = dauSearchInput ? dauSearchInput.value : '';
        const scrollY = window.scrollY || document.documentElement.scrollTop || 0;

        const cacheObj = {
            date: selectedDate,
            list: currentDauList,
            selectedSchool: selectedSchool,
            searchQuery: searchQuery,
            sortOrder: dauSortOrder,
            activeSelectedAccount: activeSelectedAccount,
            scrollY: scrollY
        };

        try {
            sessionStorage.setItem('dau_state_cache', JSON.stringify(cacheObj));
        } catch (e) {
            try {
                // 如果完整数据超过存储限制，仅存储筛选状态
                const compactObj = { ...cacheObj, list: [] };
                sessionStorage.setItem('dau_state_cache', JSON.stringify(compactObj));
            } catch (err) { }
        }
    }

    // 8.4 单击行选中状态切换
    window.selectDauRow = function (username) {
        if (!username) return;
        activeSelectedAccount = username;
        saveCurrentStateToCache();
        renderDauTable();
    };

    // 9. Jump to Single Query page for account investigation
    window.navigateToSingleQueryFromDau = function (username) {
        if (!username) return;
        const dateVal = dauDateInput ? dauDateInput.value : '';

        // 记录选中的排查行账号
        activeSelectedAccount = username;

        // 跳转前保存当前所有状态（包括选中的学校、搜索词、列表数据、选中行、滚动位置）
        saveCurrentStateToCache();

        sessionStorage.setItem('autoSearchUsername', username);
        if (dateVal) {
            sessionStorage.setItem('autoSearchDate', dateVal);
        }
        sessionStorage.setItem('fromDauDetail', 'true');

        if (window.self !== window.parent) {
            window.parent.postMessage({ action: 'navigate', page: 'singleQuery/singleQuery.html', fromDauDetail: true }, '*');
            setTimeout(() => {
                window.location.href = '../singleQuery/singleQuery.html';
            }, 150);
        } else {
            window.location.href = '../singleQuery/singleQuery.html';
        }
    };

    // 9.1 Dynamic update of School Select Dropdown Options
    function updateSchoolSelectOptions(list, explicitVal) {
        if (!dauSchoolSelect) return;
        const currentVal = explicitVal !== undefined ? explicitVal : (dauSchoolSelect.value || 'all');

        const schoolMap = {};
        (list || []).forEach(item => {
            const sId = item.shopId || item.schoolId || item.shopName || item.schoolName || 'other';
            const nameCandidate = item.shopName || item.schoolName;
            const sName = (nameCandidate && nameCandidate !== '-') ? nameCandidate : sId;
            if (!schoolMap[sId]) {
                schoolMap[sId] = { schoolId: sId, schoolName: sName, shopId: sId, shopName: sName };
            }
        });

        let html = '<option value="all">全部学校</option>';
        Object.values(schoolMap).forEach(s => {
            const targetId = s.shopId || s.schoolId;
            const targetName = s.shopName || s.schoolName;
            html += `<option value="${targetId}">${targetName} (${targetId})</option>`;
        });

        dauSchoolSelect.innerHTML = html;

        if (schoolMap[currentVal] || currentVal === 'all') {
            dauSchoolSelect.value = currentVal;
        } else {
            dauSchoolSelect.value = 'all';
        }
    }

    // 10. Load and refresh data
    async function loadData(forceRefresh = false) {
        const selectedDate = dauDateInput ? dauDateInput.value : '';
        sessionStorage.setItem('dauReportDate', selectedDate);

        // 如果不是强制刷新，且已存在当前日期的内存/持久化缓存数据，则直接使用缓存数据，不重新请求
        if (!forceRefresh) {
            const cache = getGlobalCache();
            if (cache && cache.date === selectedDate && cache.list && cache.list.length > 0) {
                currentDauList = cache.list;

                // 恢复之前的搜索/过滤/排序/选中行状态
                if (cache.activeSelectedAccount !== undefined) {
                    activeSelectedAccount = cache.activeSelectedAccount;
                }
                if (cache.searchQuery !== undefined && dauSearchInput) {
                    dauSearchInput.value = cache.searchQuery;
                }
                if (cache.sortOrder) {
                    dauSortOrder = cache.sortOrder;
                    if (dauSortText) {
                        dauSortText.textContent = dauSortOrder === 'desc'
                            ? '最新在前 (最后活跃时间 ↓)'
                            : '最早在前 (最后活跃时间 ↑)';
                    }
                }

                updateSchoolSelectOptions(currentDauList, cache.selectedSchool);
                if (cache.selectedSchool && dauSchoolSelect) {
                    dauSchoolSelect.value = cache.selectedSchool;
                }

                renderDauTable();

                if (cache.scrollY) {
                    setTimeout(() => {
                        window.scrollTo({ top: cache.scrollY, behavior: 'instant' });
                    }, 50);
                }
                return;
            }
        }

        if (dauPageSubtitle) {
            dauPageSubtitle.textContent = `正在载入 ${selectedDate} 的日活数据...`;
        }
        if (dauTableBody) {
            dauTableBody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; padding: 40px; color: #409eff;">
                        ⏳ 正在获取 OSS 日活详细数据...
                    </td>
                </tr>
            `;
        }

        currentDauList = await fetchDauDetails(selectedDate);
        updateSchoolSelectOptions(currentDauList);
        saveCurrentStateToCache();
        renderDauTable();
    }

    // 11. Event Listeners
    if (dauTableBody) {
        dauTableBody.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('.dau-action-btn');
            if (actionBtn) {
                e.stopPropagation();
                const index = actionBtn.getAttribute('data-index');
                const item = lastFilteredList[index];
                if (item) {
                    window.navigateToSingleQueryFromDau(item.loginName || item.account || item.username);
                }
                return;
            }
            const tr = e.target.closest('tr');
            if (tr && tr.hasAttribute('data-index')) {
                const index = tr.getAttribute('data-index');
                const item = lastFilteredList[index];
                if (item) {
                    window.selectDauRow(item.loginName || item.account || item.username);
                }
            }
        });
    }

    if (dauRefreshBtn) {
        dauRefreshBtn.addEventListener('click', () => {
            loadData(true); // 按钮主动刷新时强制从 OSS 重新拉取
        });
    }

    if (resetSchoolFilterBtn) {
        resetSchoolFilterBtn.addEventListener('click', () => {
            if (dauSchoolSelect) {
                dauSchoolSelect.value = 'all';
            }
            saveCurrentStateToCache();
            renderDauTable();
        });
    }

    dauDateInput.addEventListener('change', () => {
        loadData(false);
    });

    if (dauSchoolSelect) {
        dauSchoolSelect.addEventListener('change', () => {
            saveCurrentStateToCache();
            renderDauTable();
        });
    }

    if (dauSortBtn) {
        dauSortBtn.addEventListener('click', () => {
            dauSortOrder = (dauSortOrder === 'desc') ? 'asc' : 'desc';
            if (dauSortText) {
                dauSortText.textContent = dauSortOrder === 'desc'
                    ? '最新在前 (最后活跃时间 ↓)'
                    : '最早在前 (最后活跃时间 ↑)';
            }
            saveCurrentStateToCache();
            renderDauTable();
        });
    }

    if (dauSearchInput) {
        dauSearchInput.addEventListener('input', () => {
            saveCurrentStateToCache();
            renderDauTable();
        });
    }

    // Initial load
    loadData(needForceRefreshDau);
});
