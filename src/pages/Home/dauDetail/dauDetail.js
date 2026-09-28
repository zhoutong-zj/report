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

    // User Profile Modal Elements
    const userInfoModal = document.getElementById('userInfoModal');
    const uModalCloseX = document.getElementById('uModalCloseX');
    const uModalCloseBtn = document.getElementById('uModalCloseBtn');
    const uInvestigateFromModalBtn = document.getElementById('uInvestigateFromModalBtn');
    const uCopyAllSummaryBtn = document.getElementById('uCopyAllSummaryBtn');
    const uModalCopyAccountBtn = document.getElementById('uModalCopyAccountBtn');
    const copyLoginNameBtn = document.getElementById('copyLoginNameBtn');
    const copyUserIdBtn = document.getElementById('copyUserIdBtn');
    const copySchoolIdBtn = document.getElementById('copySchoolIdBtn');
    const uCopyJsonBtn = document.getElementById('uCopyJsonBtn');
    const uFoldableSection = document.getElementById('uFoldableSection');
    const uFoldHeader = document.getElementById('uFoldHeader');
    const dauToast = document.getElementById('dauToast');

    // State Variables
    let ossClient = null;
    let currentDauList = [];
    let dauSortOrder = 'desc'; // 'desc' = 最新在前 (最后活跃时间 ↓), 'asc' = 最早在前
    let activeSelectedAccount = ''; // 当前选中的排查用户账号
    let currentModalUser = null; // 当前弹窗展示的用户数据对象
    let toastTimeout = null;

    // Safe storage access helpers to prevent browser SecurityError under file:// protocol
    function safeGetSession(key, fallback = '') {
        try {
            return sessionStorage.getItem(key) || fallback;
        } catch (e) {
            return fallback;
        }
    }
    function safeSetSession(key, value) {
        try {
            sessionStorage.setItem(key, value);
        } catch (e) { }
    }
    function safeRemoveSession(key) {
        try {
            sessionStorage.removeItem(key);
        } catch (e) { }
    }
    function safeGetLocal(key, fallback = '') {
        try {
            return localStorage.getItem(key) || fallback;
        } catch (e) {
            return fallback;
        }
    }

    // 2. Initialize Date Picker
    const savedDate = safeGetSession('dauReportDate') || safeGetSession('reportDate') || new Date().toISOString().split('T')[0];
    if (dauDateInput) {
        dauDateInput.value = savedDate;
    }

    // 检查是否有强制刷新标记（例如在单查询页面删除了用户数据）
    const needForceRefreshDau = safeGetSession('force_refresh_dau') === 'true';
    if (needForceRefreshDau) {
        safeRemoveSession('force_refresh_dau');
        safeRemoveSession('dau_state_cache');
    }

    // 3. Back Button Event
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            // 返回日志报表后，同步当前选中的日期，清除日活详情页的暂存数据
            const selectedDate = dauDateInput ? dauDateInput.value : '';
            if (selectedDate) {
                safeSetSession('reportDate', selectedDate);
            }
            safeRemoveSession('dau_state_cache');
            window.location.href = '../logReport/logReport.html';
        });
    }

    // 4. Initialize OSS Client
    function initOssClient() {
        const savedConfig = safeGetLocal('oss_tool_config');
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
            return generateMockDauList(dateStr);
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
                return generateMockDauList(dateStr);
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
                let grade = '-';
                let appVersion = '-';
                let deviceName = '-';
                let phonePlatformVersion = '-';
                let userId = '-';
                let teacherName = '-';
                let serviceName = '-';
                let identity = '普通学员';
                let studentInfoObj = {};
                let rawDataObj = null;

                try {
                    const fileRes = await ossClient.get(key);
                    const fileContent = fileRes.content ? fileRes.content.toString() : '';
                    if (fileContent && fileContent.trim() !== '') {
                        const parsedData = JSON.parse(fileContent);
                        const fileData = Array.isArray(parsedData) ? (parsedData[0] || {}) : parsedData;
                        const studentInfo = fileData.studentInfo || {};
                        studentInfoObj = studentInfo;
                        rawDataObj = fileData;

                        loginName = fileData.loginName || studentInfo.loginName || fallbackUsername;
                        username = fileData.nickName || studentInfo.nickName || loginName || fileData.userName || studentInfo.userName || fallbackUsername;
                        // 优先使用 shopName/shopId，同时兼容历史 schoolName/schoolId
                        schoolName = studentInfo.shopName || fileData.shopName || studentInfo.schoolName || fileData.schoolName || '-';
                        schoolId = studentInfo.shopId || fileData.shopId || studentInfo.schoolId || fileData.schoolId || '-';
                        const rawGrade = studentInfo.gradeName || fileData.gradeName || studentInfo.grade || fileData.grade || studentInfo.className || fileData.className || '';
                        grade = formatGrade(rawGrade);
                        appVersion = fileData.versionName || studentInfo.versionName || fileData.appVersion || fileData.version || fileData.clientVersion || studentInfo.appVersion || studentInfo.version || '-';
                        deviceName = fileData.deviceName || studentInfo.deviceName || '-';
                        phonePlatformVersion = fileData.phonePlatformVersion || studentInfo.phonePlatformVersion || '-';
                        userId = fileData.userId || studentInfo.id || studentInfo.userId || ('U' + String(Math.abs(hashString(loginName))).slice(0, 8));
                        teacherName = studentInfo.teacherName || fileData.teacherName || '-';
                        serviceName = studentInfo.serviceName || fileData.serviceName || '-';
                        identity = fileData.identity || studentInfo.identity || '普通学员';
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
                    grade: grade,
                    appVersion: appVersion,
                    deviceName: deviceName,
                    phonePlatformVersion: phonePlatformVersion,
                    userId: userId,
                    teacherName: teacherName,
                    serviceName: serviceName,
                    identity: identity,
                    studentInfo: studentInfoObj,
                    rawData: rawDataObj
                };
            });

            return await Promise.all(itemPromises);
        } catch (err) {
            console.warn('OSS list failed for DAU details:', err);
            return generateMockDauList(dateStr);
        }
    }

    // Hash helper for mock user ID generation
    function hashString(str) {
        let hash = 0;
        if (!str || str.length === 0) return hash;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return hash;
    }

    // Mock DAU Generator for static demonstration
    function generateMockDauList(dateStr) {
        const mockSchools = [
            { shopId: 'SHOP_1001', shopName: '阳光第一实验小学' },
            { shopId: 'SHOP_1002', shopName: '博雅外国语实验学校' },
            { shopId: 'SHOP_1003', shopName: '育英双语国际学校' },
            { shopId: 'SHOP_1004', shopName: '金陵高级附属小学' },
            { shopId: 'SHOP_1005', shopName: '枫林大道中心小学' }
        ];

        const mockPresets = [
            {
                loginName: 'user_102938',
                nickName: '张明宇',
                userId: 'U1002938',
                grade: '四年级',
                teacher: '王晓华',
                service: 'VIP全科训练年卡',
                identity: '正式学员',
                device: 'iPad Air 5',
                os: 'iOS 17.2',
                version: '2.5.4',
                schoolIndex: 0,
                timeOffset: 12
            },
            {
                loginName: 'user_882019',
                nickName: '王泽轩',
                userId: 'U8820191',
                grade: '五年级',
                teacher: '李雪琴',
                service: '智学体验课卡',
                identity: '试听学员',
                device: 'Xiaomi Pad 6 Pro',
                os: 'Android 14',
                version: '2.5.4',
                schoolIndex: 1,
                timeOffset: 25
            },
            {
                loginName: 'user_330192',
                nickName: '李俊熙',
                userId: 'U3301922',
                grade: '三年级',
                teacher: '陈丽娜',
                service: 'VIP全科训练年卡',
                identity: '正式学员',
                device: 'HUAWEI MatePad 11',
                os: 'HarmonyOS 4.0',
                version: '2.5.3',
                schoolIndex: 0,
                timeOffset: 48
            },
            {
                loginName: 'user_550182',
                nickName: '赵梓琪',
                userId: 'U5501825',
                grade: '四年级',
                teacher: '王晓华',
                service: '学练测评专项卡',
                identity: '专项班学员',
                device: 'iPad Pro 11-inch',
                os: 'iOS 16.5',
                version: '2.5.4',
                schoolIndex: 2,
                timeOffset: 70
            },
            {
                loginName: 'student_demo',
                nickName: '陈小东',
                userId: 'U9900118',
                grade: '二年级',
                teacher: '张立民',
                service: 'VIP全科训练季卡',
                identity: '正式学员',
                device: 'Samsung Galaxy Tab S9',
                os: 'Android 13',
                version: '2.5.4',
                schoolIndex: 3,
                timeOffset: 95
            },
            {
                loginName: 'stu_guangming',
                nickName: '刘雨涵',
                userId: 'U7728190',
                grade: '六年级',
                teacher: '周建国',
                service: '寒假培优训练卡',
                identity: '培优学员',
                device: 'iPad 10',
                os: 'iOS 17.1',
                version: '2.5.2',
                schoolIndex: 4,
                timeOffset: 120
            },
            {
                loginName: 'test_account_01',
                nickName: '孙一鸣',
                userId: 'U6619024',
                grade: '五年级',
                teacher: '李雪琴',
                service: 'VIP全科训练年卡',
                identity: '正式学员',
                device: 'Lenovo Legion Y700',
                os: 'Android 13',
                version: '2.5.4',
                schoolIndex: 1,
                timeOffset: 140
            },
            {
                loginName: 'stu_haidian_09',
                nickName: '黄子涵',
                userId: 'U5521908',
                grade: '三年级',
                teacher: '陈丽娜',
                service: '智学体验课卡',
                identity: '体验学员',
                device: 'HUAWEI MatePad Pro',
                os: 'HarmonyOS 4.2',
                version: '2.5.4',
                schoolIndex: 2,
                timeOffset: 165
            },
            {
                loginName: 'student_chen_88',
                nickName: '陈浩宇',
                userId: 'U3319082',
                grade: '四年级',
                teacher: '王晓华',
                service: 'VIP全科训练年卡',
                identity: '正式学员',
                device: 'iPad Air 4',
                os: 'iOS 16.6',
                version: '2.5.4',
                schoolIndex: 0,
                timeOffset: 190
            },
            {
                loginName: 'user_xuexi_77',
                nickName: '林夕若',
                userId: 'U4419208',
                grade: '五年级',
                teacher: '张立民',
                service: '学练测评专项卡',
                identity: '专项班学员',
                device: 'vivo Pad Air',
                os: 'OriginOS 3.0',
                version: '2.5.3',
                schoolIndex: 3,
                timeOffset: 215
            }
        ];

        const baseTime = new Date(`${dateStr}T18:30:00`).getTime() || Date.now();

        return mockPresets.map((preset) => {
            const school = mockSchools[preset.schoolIndex] || mockSchools[0];
            const eventTime = new Date(baseTime - preset.timeOffset * 60 * 1000).toISOString();
            const studentInfoObj = {
                id: preset.userId,
                userId: preset.userId,
                loginName: preset.loginName,
                nickName: preset.nickName,
                name: preset.nickName,
                userName: preset.nickName,
                grade: preset.grade,
                gradeName: preset.grade,
                shopId: school.shopId,
                shopName: school.shopName,
                schoolId: school.shopId,
                schoolName: school.shopName,
                teacherName: preset.teacher,
                serviceName: preset.service,
                identity: preset.identity,
                appVersion: preset.version,
                versionName: preset.version,
                deviceName: preset.device,
                phonePlatformVersion: preset.os,
                lastActiveTime: eventTime
            };

            return {
                key: `usertemp/xuelianxitong/${dateStr.replace(/-/g, '_')}/${preset.loginName}/user_activity/activity_${preset.loginName}.json`,
                lastModified: eventTime,
                etag: '"7F3B90AE5C5FADB3F643415A827C8888"',
                size: 8420 + Math.floor(Math.random() * 2000),
                type: 'Normal',
                ownerId: '1995174256355793',
                username: preset.nickName,
                loginName: preset.loginName,
                account: preset.loginName,
                schoolName: school.shopName,
                schoolId: school.shopId,
                shopName: school.shopName,
                shopId: school.shopId,
                grade: preset.grade,
                appVersion: preset.version,
                deviceName: preset.device,
                phonePlatformVersion: preset.os,
                userId: preset.userId,
                teacherName: preset.teacher,
                serviceName: preset.service,
                identity: preset.identity,
                studentInfo: studentInfoObj,
                rawData: {
                    loginName: preset.loginName,
                    nickName: preset.nickName,
                    userId: preset.userId,
                    grade: preset.grade,
                    studentInfo: studentInfoObj
                }
            };
        });
    }

    // Helper to format student grade
    function formatGrade(gradeInput) {
        if (!gradeInput && gradeInput !== 0) return '-';
        const str = String(gradeInput).trim();
        if (!str || str === '-') return '-';
        const gradeMap = {
            'onegrade': '一年级',
            'twograde': '二年级',
            'threegrade': '三年级',
            'fourgrade': '四年级',
            'fivegrade': '五年级',
            'sixgrade': '六年级',
            'sevengrade': '七年级',
            'eightgrade': '八年级',
            'ninegrade': '九年级',
            'grade1': '一年级',
            'grade2': '二年级',
            'grade3': '三年级',
            'grade4': '四年级',
            'grade5': '五年级',
            'grade6': '六年级',
            'grade7': '七年级',
            'grade8': '八年级',
            'grade9': '九年级',
            '1': '一年级',
            '2': '二年级',
            '3': '三年级',
            '4': '四年级',
            '5': '五年级',
            '6': '六年级',
            '7': '七年级',
            '8': '八年级',
            '9': '九年级'
        };
        return gradeMap[str.toLowerCase()] || str;
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
                (item.grade && item.grade.toLowerCase().includes(query)) ||
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
                        <td style="text-align: center;">
                            ${item.grade && item.grade !== '-' ? `<span class="dau-grade-badge">${escapeHtml(item.grade)}</span>` : '<span style="color: #909399;">-</span>'}
                        </td>
                        <td style="text-align: center;"><span class="dau-version-badge">${escapeHtml(item.appVersion || '-')}</span></td>
                        <td style="color: #303133;" title="${escapeHtml(item.deviceName || '')}">${escapeHtml(item.deviceName || '-')}</td>
                        <td style="text-align: center;"><span class="dau-os-badge">${escapeHtml(item.phonePlatformVersion || '-')}</span></td>
                        <td style="text-align: center;"><span class="dau-time-badge">${escapeHtml(timeFormatted)}</span></td>
                        <td style="text-align: center;">
                            <div class="dau-actions-cell">
                                <button class="dau-detail-btn" data-index="${index}" data-action="viewDetail" title="点击查看用户详细档案">
                                    详情
                                </button>
                                <button class="dau-action-btn ${isSelected ? 'selected' : ''}" data-index="${index}" data-action="investigate" title="前往排查单用户日志">
                                    ${isSelected ? '排查中' : '排查 →'}
                                </button>
                            </div>
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
    // 8.2 Render ECharts Bar Chart for School DAU Distribution
    let schoolChart = null;
    let lastSchoolChartParams = null;

    function renderSchoolDauChart(schoolData, totalStudentCount) {
        lastSchoolChartParams = { schoolData, totalStudentCount };
        const dom = document.getElementById('schoolDauLineChart');
        if (!dom || typeof echarts === 'undefined') return;

        const totalStudents = totalStudentCount !== undefined ? totalStudentCount : (schoolData ? schoolData.reduce((acc, cur) => acc + (cur.dauCount || 0), 0) : 0);
        if (studentTotalCount) {
            studentTotalCount.textContent = totalStudents;
        }
        if (schoolTotalCount) {
            schoolTotalCount.textContent = (schoolData && schoolData.length) ? schoolData.length : 0;
        }

        if (!schoolData || schoolData.length === 0) {
            if (schoolChart && !schoolChart.isDisposed()) {
                schoolChart.clear();
            }
            return;
        }

        const theme = window.ThemeManager ? window.ThemeManager.getTheme() : 'light';
        const colors = window.ThemeManager ? window.ThemeManager.getChartTheme(theme) : {};

        if (schoolChart && !schoolChart.isDisposed()) {
            schoolChart.dispose();
        }
        schoolChart = echarts.init(dom, theme === 'dark' ? 'dark' : null);
        schoolChart._schoolData = schoolData;

        schoolChart.on('click', (params) => {
            if (params.dataIndex !== undefined) {
                const currentList = schoolChart._schoolData || [];
                const clickedItem = currentList[params.dataIndex];
                if (clickedItem && dauSchoolSelect) {
                    const targetId = clickedItem.shopId || clickedItem.schoolId || clickedItem.shopName || clickedItem.schoolName;
                    const curVal = dauSchoolSelect.value;
                    if (curVal === clickedItem.schoolId || curVal === clickedItem.schoolName || curVal === clickedItem.shopId || curVal === clickedItem.shopName) {
                        dauSchoolSelect.value = 'all';
                    } else {
                        dauSchoolSelect.value = targetId;
                    }
                    saveCurrentStateToCache();
                    renderDauTable();
                }
            }
        });

        const selectedSchool = (dauSchoolSelect ? dauSchoolSelect.value : 'all');
        const labels = schoolData.map(item => item.schoolName);

        const seriesData = schoolData.map(item => {
            const isSelected = (selectedSchool !== 'all') && (
                item.schoolId === selectedSchool || item.schoolName === selectedSchool ||
                item.shopId === selectedSchool || item.shopName === selectedSchool
            );
            const isDimmed = (selectedSchool !== 'all') && !isSelected;

            let color;
            if (isSelected) {
                color = new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: '#ff9900' },
                    { offset: 1, color: '#ffdd6b' }
                ]);
            } else if (isDimmed) {
                color = 'rgba(0, 180, 219, 0.2)';
            } else {
                color = new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: '#00b4db' },
                    { offset: 1, color: '#0083b0' }
                ]);
            }

            return {
                value: item.dauCount,
                schoolItem: item,
                itemStyle: {
                    color: color,
                    borderRadius: [4, 4, 0, 0]
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
                    const item = p.data ? p.data.schoolItem : null;
                    const sTitle = item ? `${item.schoolName} (${item.schoolId || item.shopId || '-'})` : p.name;
                    return `<div style="font-weight: 600; margin-bottom: 4px;">${sTitle}</div>
                            <div>日活人数: <span style="font-weight: bold; color: #00b4db;">${p.value}</span> 人</div>
                            <div style="font-size: 11px; color: #909399; margin-top: 2px;">(点击柱条可快速筛选该学校)</div>`;
                }
            },
            grid: {
                top: 35,
                left: 50,
                right: 25,
                bottom: labels.length > 8 ? 45 : 28
            },
            xAxis: {
                type: 'category',
                data: labels,
                axisLine: { lineStyle: { color: colors.borderColor || '#e2e8f0' } },
                axisLabel: {
                    color: colors.textColor || '#606266',
                    interval: 0,
                    rotate: labels.length > 8 ? 25 : 0,
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
                name: '日活人数',
                type: 'bar',
                barMaxWidth: 42,
                label: {
                    show: true,
                    position: 'top',
                    formatter: '{c} 人',
                    color: colors.textColor || '#0083b0',
                    fontWeight: 'bold',
                    fontSize: 11
                },
                data: seriesData
            }]
        };

        schoolChart.setOption(option);
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

        safeSetSession('autoSearchUsername', username);
        if (dateVal) {
            safeSetSession('autoSearchDate', dateVal);
        }
        safeSetSession('fromDauDetail', 'true');

        if (window.self !== window.parent) {
            window.parent.postMessage({ action: 'navigate', page: 'singleQuery/singleQuery.html', fromDauDetail: true }, '*');
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
        safeSetSession('dauReportDate', selectedDate);

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

    // 10.1 User Profile Modal Controller
    function openUserInfoModal(item) {
        if (!item || !userInfoModal) return;
        currentModalUser = item;

        // 提取姓名首字符作为头像 Badge
        const nameStr = (item.username && item.username !== '-') ? item.username : (item.loginName || '学');
        const firstChar = nameStr.trim().charAt(0) || '学';
        const uModalAvatar = document.getElementById('uModalAvatar');
        if (uModalAvatar) {
            uModalAvatar.textContent = firstChar;
        }

        // Header
        const uModalNickName = document.getElementById('uModalNickName');
        const uModalIdentity = document.getElementById('uModalIdentity');
        const uModalAccount = document.getElementById('uModalAccount');
        const uModalHeaderSchool = document.getElementById('uModalHeaderSchool');

        if (uModalNickName) uModalNickName.textContent = item.username || item.loginName || '未命名用户';
        if (uModalIdentity) uModalIdentity.textContent = item.identity || '普通学员';
        if (uModalAccount) uModalAccount.textContent = item.loginName || item.account || '-';
        if (uModalHeaderSchool) uModalHeaderSchool.textContent = item.schoolName || item.shopName || '-';

        // Grid Cards
        const uGridLoginName = document.getElementById('uGridLoginName');
        const uGridUserId = document.getElementById('uGridUserId');
        const uGridNickName = document.getElementById('uGridNickName');
        const uGridIdentity = document.getElementById('uGridIdentity');
        const uGridSchoolName = document.getElementById('uGridSchoolName');
        const uGridSchoolId = document.getElementById('uGridSchoolId');
        const uGridGradeName = document.getElementById('uGridGradeName');
        const uGridTeacherName = document.getElementById('uGridTeacherName');
        const uGridServiceName = document.getElementById('uGridServiceName');
        const uGridAppVersion = document.getElementById('uGridAppVersion');
        const uGridDeviceName = document.getElementById('uGridDeviceName');
        const uGridPhonePlatform = document.getElementById('uGridPhonePlatform');
        const uGridLastActiveTime = document.getElementById('uGridLastActiveTime');

        if (uGridLoginName) uGridLoginName.textContent = item.loginName || item.account || '-';
        if (uGridUserId) uGridUserId.textContent = item.userId || '-';
        if (uGridNickName) uGridNickName.textContent = item.username || '-';
        if (uGridIdentity) uGridIdentity.textContent = item.identity || '普通学员';
        if (uGridSchoolName) uGridSchoolName.textContent = item.schoolName || item.shopName || '-';
        if (uGridSchoolId) uGridSchoolId.textContent = item.schoolId || item.shopId || '-';
        if (uGridGradeName) uGridGradeName.textContent = item.grade || '-';
        if (uGridTeacherName) uGridTeacherName.textContent = item.teacherName || '-';
        if (uGridServiceName) uGridServiceName.textContent = item.serviceName || '-';
        if (uGridAppVersion) uGridAppVersion.textContent = item.appVersion || '-';
        if (uGridDeviceName) uGridDeviceName.textContent = item.deviceName || '-';
        if (uGridPhonePlatform) uGridPhonePlatform.textContent = item.phonePlatformVersion || '-';
        if (uGridLastActiveTime) uGridLastActiveTime.textContent = formatLastModifiedDate(item.lastModified);

        // JSON block
        const uJsonContentBlock = document.getElementById('uJsonContentBlock');
        if (uJsonContentBlock) {
            let jsonObj = null;
            if (item.studentInfo && Object.keys(item.studentInfo).length > 0) {
                jsonObj = item.studentInfo;
            } else if (item.rawData) {
                jsonObj = item.rawData;
            } else {
                jsonObj = {
                    loginName: item.loginName || item.account,
                    nickName: item.username,
                    userId: item.userId,
                    schoolName: item.schoolName,
                    schoolId: item.schoolId,
                    teacherName: item.teacherName,
                    serviceName: item.serviceName,
                    identity: item.identity,
                    appVersion: item.appVersion,
                    deviceName: item.deviceName,
                    phonePlatformVersion: item.phonePlatformVersion,
                    lastModified: item.lastModified
                };
            }
            try {
                uJsonContentBlock.textContent = JSON.stringify(jsonObj, null, 2);
            } catch (err) {
                uJsonContentBlock.textContent = String(jsonObj);
            }
        }

        // 默认收起 JSON 面板
        if (uFoldableSection) {
            uFoldableSection.classList.remove('open');
        }

        userInfoModal.style.display = 'flex';
        document.body.classList.add('modal-open');
    }

    function closeUserInfoModal() {
        if (!userInfoModal) return;
        userInfoModal.style.display = 'none';
        document.body.classList.remove('modal-open');
        currentModalUser = null;
    }

    // Toast Notice Helper
    function showDauToast(text) {
        if (!dauToast) return;
        dauToast.textContent = text || '操作成功';
        dauToast.style.display = 'block';
        setTimeout(() => {
            dauToast.classList.add('show');
        }, 10);

        if (toastTimeout) {
            clearTimeout(toastTimeout);
        }
        toastTimeout = setTimeout(() => {
            dauToast.classList.remove('show');
            setTimeout(() => {
                dauToast.style.display = 'none';
            }, 250);
        }, 2000);
    }

    // Clipboard Copy Helper
    async function copyToClipboard(text, successMsg = '已复制到剪贴板') {
        if (!text || text === '-') {
            showDauToast('暂无有效内容可复制');
            return;
        }
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            showDauToast(successMsg);
        } catch (err) {
            showDauToast('复制失败，请手动选择复制');
        }
    }

    // 11. Event Listeners
    if (dauTableBody) {
        dauTableBody.addEventListener('click', (e) => {
            // 点击排查按钮
            const investigateBtn = e.target.closest('button[data-action="investigate"]');
            if (investigateBtn) {
                e.stopPropagation();
                const index = investigateBtn.getAttribute('data-index');
                const item = lastFilteredList[index];
                if (item) {
                    window.navigateToSingleQueryFromDau(item.loginName || item.account || item.username);
                }
                return;
            }

            // 点击详情按钮
            const detailBtn = e.target.closest('button[data-action="viewDetail"]');
            if (detailBtn) {
                e.stopPropagation();
                const index = detailBtn.getAttribute('data-index');
                const item = lastFilteredList[index];
                if (item) {
                    window.selectDauRow(item.loginName || item.account || item.username);
                    openUserInfoModal(item);
                }
                return;
            }

            // 点击整行 Item
            const tr = e.target.closest('tr');
            if (tr && tr.hasAttribute('data-index')) {
                const index = tr.getAttribute('data-index');
                const item = lastFilteredList[index];
                if (item) {
                    window.selectDauRow(item.loginName || item.account || item.username);
                    openUserInfoModal(item);
                }
            }
        });
    }

    // Modal Close Events
    if (uModalCloseX) {
        uModalCloseX.addEventListener('click', () => {
            closeUserInfoModal();
        });
    }

    if (uModalCloseBtn) {
        uModalCloseBtn.addEventListener('click', () => {
            closeUserInfoModal();
        });
    }

    if (userInfoModal) {
        userInfoModal.addEventListener('click', (e) => {
            if (e.target === userInfoModal) {
                closeUserInfoModal();
            }
        });
    }

    // Modal Investigate Jump Button
    if (uInvestigateFromModalBtn) {
        uInvestigateFromModalBtn.addEventListener('click', () => {
            if (currentModalUser) {
                const targetAccount = currentModalUser.loginName || currentModalUser.account || currentModalUser.username;
                closeUserInfoModal();
                window.navigateToSingleQueryFromDau(targetAccount);
            }
        });
    }

    // Instant visual micro-feedback on copy button
    function flashButtonCopied(btn, successText = '已复制') {
        if (!btn) return;
        const origHtml = btn.innerHTML;
        btn.classList.add('copied');
        if (btn.classList.contains('mini-copy-btn')) {
            btn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        } else if (btn.classList.contains('card-copy-btn') || btn.classList.contains('u-mini-btn')) {
            btn.innerHTML = `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>${successText}</span>`;
        } else if (btn.classList.contains('u-footer-btn')) {
            btn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>已复制全部</span>`;
        }
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = origHtml;
        }, 1200);
    }

    // Copy Events in Modal
    if (uModalCopyAccountBtn) {
        uModalCopyAccountBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentModalUser) {
                copyToClipboard(currentModalUser.loginName || currentModalUser.account, '账号已复制');
                flashButtonCopied(uModalCopyAccountBtn);
            }
        });
    }

    if (copyLoginNameBtn) {
        copyLoginNameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentModalUser) {
                copyToClipboard(currentModalUser.loginName || currentModalUser.account, '登录名已复制');
                flashButtonCopied(copyLoginNameBtn);
            }
        });
    }

    if (copyUserIdBtn) {
        copyUserIdBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentModalUser) {
                copyToClipboard(currentModalUser.userId, '用户ID已复制');
                flashButtonCopied(copyUserIdBtn);
            }
        });
    }

    if (copySchoolIdBtn) {
        copySchoolIdBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentModalUser) {
                copyToClipboard(currentModalUser.schoolId || currentModalUser.shopId, '学校ID已复制');
                flashButtonCopied(copySchoolIdBtn);
            }
        });
    }

    if (uCopyJsonBtn) {
        uCopyJsonBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const uJsonContentBlock = document.getElementById('uJsonContentBlock');
            if (uJsonContentBlock) {
                copyToClipboard(uJsonContentBlock.textContent, 'JSON结构数据已复制');
                flashButtonCopied(uCopyJsonBtn, '已复制');
            }
        });
    }

    // Copy All Summary
    if (uCopyAllSummaryBtn) {
        uCopyAllSummaryBtn.addEventListener('click', () => {
            if (!currentModalUser) return;
            const item = currentModalUser;
            const summaryText = [
                `【日活用户信息档案】`,
                `学生姓名: ${item.username || '-'}`,
                `学生年级: ${item.grade || '-'}`,
                `登录名/账号: ${item.loginName || item.account || '-'}`,
                `用户 ID: ${item.userId || '-'}`,
                `评测身份: ${item.identity || '-'}`,
                `学校名称: ${item.schoolName || item.shopName || '-'}`,
                `学校 ID: ${item.schoolId || item.shopId || '-'}`,
                `教学老师: ${item.teacherName || '-'}`,
                `卡类型/服务: ${item.serviceName || '-'}`,
                `设备型号: ${item.deviceName || '-'}`,
                `系统版本: ${item.phonePlatformVersion || '-'}`,
                `客户端版本: ${item.appVersion || '-'}`,
                `最后活跃时间: ${formatLastModifiedDate(item.lastModified)}`
            ].join('\n');

            copyToClipboard(summaryText, '已复制该用户的完整档案');
            flashButtonCopied(uCopyAllSummaryBtn);
        });
    }

    // Toggle Foldable JSON Section
    if (uFoldHeader) {
        uFoldHeader.addEventListener('click', () => {
            if (uFoldableSection) {
                uFoldableSection.classList.toggle('open');
            }
        });
    }

    // Keyboard Esc listener for modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && userInfoModal && userInfoModal.style.display !== 'none') {
            closeUserInfoModal();
        }
    });

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

    // Theme synchronization for schoolChart
    window.addEventListener('themeChanged', () => {
        if (lastSchoolChartParams) {
            renderSchoolDauChart(lastSchoolChartParams.schoolData, lastSchoolChartParams.totalStudentCount);
        }
    });

    window.addEventListener('resize', () => {
        if (schoolChart && !schoolChart.isDisposed()) {
            schoolChart.resize();
        }
    });
});

