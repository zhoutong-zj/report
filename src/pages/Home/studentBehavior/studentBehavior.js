document.addEventListener('DOMContentLoaded', () => {
    // 1. Game Hierarchy Configuration
    const GAME_CONFIGS = {
        'fruit_cutting': {
            code: 'fruit_cutting',
            name: '切水果',
            systemCode: 'fruit',
            systemName: '水果商店系统',
            isSub: true,
            parentName: '水果商店',
            color: '#f97316',
            tagClass: 'fruit-cutting'
        },
        'fruit_store': {
            code: 'fruit_store',
            name: '水果商店',
            systemCode: 'fruit',
            systemName: '水果商店系统',
            isSub: false,
            parentName: '',
            color: '#ea580c',
            tagClass: 'fruit-store'
        },
        'card_gacha': {
            code: 'card_gacha',
            name: '抽卡',
            systemCode: 'card',
            systemName: '卡册系统',
            isSub: true,
            parentName: '卡册',
            color: '#ec4899',
            tagClass: 'card-gacha'
        },
        'card_album': {
            code: 'card_album',
            name: '卡册',
            systemCode: 'card',
            systemName: '卡册系统',
            isSub: false,
            parentName: '',
            color: '#8b5cf6',
            tagClass: 'card-album'
        },
        'e_bao': {
            code: 'e_bao',
            name: 'E宝游戏',
            systemCode: 'ebao',
            systemName: 'E宝游戏',
            isSub: false,
            parentName: '',
            color: '#06b6d4',
            tagClass: 'e-bao'
        }
    };

    // DOM Elements
    const reportDateInput = document.getElementById('reportDate');
    const quickDateBtns = document.querySelectorAll('.quick-date-btn');
    const refreshBtn = document.getElementById('refreshBtn');
    const noConfigAlert = document.getElementById('noConfigAlert');

    // Stat Cards Elements
    const activePlayersCountEl = document.getElementById('activePlayersCount');
    const totalGamesCountEl = document.getElementById('totalGamesCount');
    const fruitSystemCountEl = document.getElementById('fruitSystemCount');
    const fruitStoreCountEl = document.getElementById('fruitStoreCount');
    const fruitCuttingCountEl = document.getElementById('fruitCuttingCount');
    const cardSystemCountEl = document.getElementById('cardSystemCount');
    const cardAlbumCountEl = document.getElementById('cardAlbumCount');
    const cardGachaCountEl = document.getElementById('cardGachaCount');
    const eBaoCountEl = document.getElementById('eBaoCount');

    // Chart & Schedule Elements
    const distributionCanvas = document.getElementById('timeSlotDistributionChart') || document.getElementById('gameDistributionChart');
    const hourlyTrendCanvas = document.getElementById('hourlyTrendChart');
    const topStudentsCanvas = document.getElementById('topStudentsChart');
    const timeSlotTableContainer = document.getElementById('timeSlotTableContainer');
    const timeSlotChartContainer = document.getElementById('timeSlotChartContainer');
    const timeSlotMiniTableBody = document.getElementById('timeSlotMiniTableBody');
    const slotTableViewBtn = document.getElementById('slotTableViewBtn');
    const slotChartViewBtn = document.getElementById('slotChartViewBtn');
    const peakSlotBadge = document.getElementById('peakSlotBadge');

    // Table & Filter Elements
    const tabBtns = document.querySelectorAll('.tab-btn');
    const summaryTableView = document.getElementById('summaryTableView');
    const logsTableView = document.getElementById('logsTableView');
    const dauTimeSlotTableView = document.getElementById('dauTimeSlotTableView');
    const summaryTableBody = document.getElementById('summaryTableBody');
    const logsTableBody = document.getElementById('logsTableBody');
    const dauTimeSlotTableBody = document.getElementById('dauTimeSlotTableBody');
    const searchInput = document.getElementById('searchInput');
    const gameFilter = document.getElementById('gameFilter');
    const timeSlotFilter = document.getElementById('timeSlotFilter');
    const dauSortBtn = document.getElementById('dauSortBtn');
    const dauSortBtnText = document.getElementById('dauSortBtnText');
    const sortDauTimeTh = document.getElementById('sortDauTimeTh');
    const dauSortArrow = document.getElementById('dauSortArrow');
    const timeSlotSummaryBar = document.getElementById('timeSlotSummaryBar');
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    const tableInfo = document.getElementById('tableInfo');

    // Time Slot Classification Definitions
    const TIME_SLOT_DEFS = [
        { key: 'morning_early', name: '早晨时段', range: '06:00 - 09:00', icon: '🌅', color: '#1d4ed8', cssClass: 'slot-early', startHour: 6, endHour: 9 },
        { key: 'morning', name: '上午时段', range: '09:00 - 12:00', icon: '☀️', color: '#15803d', cssClass: 'slot-morning', startHour: 9, endHour: 12 },
        { key: 'noon', name: '中午时段', range: '12:00 - 14:00', icon: '🍱', color: '#a16207', cssClass: 'slot-noon', startHour: 12, endHour: 14 },
        { key: 'afternoon', name: '下午时段', range: '14:00 - 18:00', icon: '☕', color: '#c2410c', cssClass: 'slot-afternoon', startHour: 14, endHour: 18 },
        { key: 'evening', name: '晚间高峰', range: '18:00 - 22:00', icon: '🌙', color: '#7e22ce', cssClass: 'slot-evening', startHour: 18, endHour: 22 },
        { key: 'night', name: '深夜时段', range: '22:00 - 06:00', icon: '🌌', color: '#475569', cssClass: 'slot-night', startHour: 22, endHour: 6 }
    ];

    function getTimeSlotInfo(dateInput) {
        let h = 12;
        if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
            h = dateInput.getHours();
        } else if (typeof dateInput === 'number') {
            h = dateInput;
        } else if (typeof dateInput === 'string') {
            const d = new Date(dateInput);
            if (!isNaN(d.getTime())) h = d.getHours();
        }

        if (h >= 6 && h < 9) return TIME_SLOT_DEFS[0];
        if (h >= 9 && h < 12) return TIME_SLOT_DEFS[1];
        if (h >= 12 && h < 14) return TIME_SLOT_DEFS[2];
        if (h >= 14 && h < 18) return TIME_SLOT_DEFS[3];
        if (h >= 18 && h < 22) return TIME_SLOT_DEFS[4];
        return TIME_SLOT_DEFS[5];
    }

    function formatFullDateTime(d) {
        if (!d) return '-';
        const date = new Date(d);
        if (isNaN(date.getTime())) return String(d);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        const ss = String(date.getSeconds()).padStart(2, '0');
        return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
    }

    function getRelativeTimeDesc(d) {
        if (!d) return { text: '-', isFresh: false };
        const date = new Date(d);
        const now = new Date();
        const diffSec = Math.floor((now - date) / 1000);
        if (diffSec < 0 || diffSec < 300) return { text: '刚刚活跃', isFresh: true };
        if (diffSec < 3600) return { text: `${Math.floor(diffSec / 60)}分钟前`, isFresh: true };
        if (diffSec < 86400 && date.getDate() === now.getDate()) {
            return { text: `${Math.floor(diffSec / 3600)}小时前`, isFresh: false };
        }
        return { text: '当日使用', isFresh: false };
    }

    // User Detail & Flowchart View Elements
    const dashboardContainer = document.getElementById('dashboardContainer');
    const userDetailContainer = document.getElementById('userDetailContainer');
    const backToListBtn = document.getElementById('backToListBtn');
    const detailCurrentDate = document.getElementById('detailCurrentDate');
    const detailAvatar = document.getElementById('detailAvatar');
    const detailStudentName = document.getElementById('detailStudentName');
    const detailUsername = document.getElementById('detailUsername');
    const detailSchoolName = document.getElementById('detailSchoolName');
    const detailTeacherName = document.getElementById('detailTeacherName');
    const detailTotalCount = document.getElementById('detailTotalCount');
    const detailFruitCount = document.getElementById('detailFruitCount');
    const detailCardCount = document.getElementById('detailCardCount');
    const detailEbaoCount = document.getElementById('detailEbaoCount');
    const flowchartTracks = document.getElementById('flowchartTracks');
    const userLogsTableBody = document.getElementById('userLogsTableBody');
    const userLogsCountText = document.getElementById('userLogsCountText');

    // Modal Elements
    const detailModal = document.getElementById('detailModal');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalGameBadge = document.getElementById('modalGameBadge');
    const modalMetaGrid = document.getElementById('modalMetaGrid');
    const modalJsonPre = document.getElementById('modalJsonPre');
    const modalCopyBtn = document.getElementById('modalCopyBtn');

    // State
    let ossClient = null;
    let rawObjectsList = []; // Parsed file items
    let studentSummaryList = []; // Aggregated by student
    let dauUsersList = []; // Parsed DAU users with last active time & time slot
    let selectedTimeSlot = 'all'; // 'all' | 'morning_early' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night'
    let dauTimeSortOrder = 'desc'; // 'desc' = latest first, 'asc' = earliest first
    let currentView = 'summary'; // 'summary' | 'logs' | 'dauTimeSlot'
    let currentModalItem = null;
    let userToInfoCache = {}; // username -> { studentName, schoolName, teacherName }
    let selectedSummaryUsername = null; // Currently selected student in summary table
    let selectedLogKey = null; // Currently selected row key in logs table
    let selectedUserLogKey = null; // Currently selected step / row key in user detail view

    // Charts instances
    let distributionChart = null;
    let hourlyTrendChart = null;
    let topStudentsChart = null;

    // 2. Initialize Date
    function initDate() {
        const storedDate = sessionStorage.getItem('reportDate');
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        const initialDate = storedDate || todayStr;
        reportDateInput.value = initialDate;
        updateQuickDateActive(initialDate, todayStr);
    }

    function updateQuickDateActive(currentDate, todayStr) {
        const today = new Date(todayStr);
        const curr = new Date(currentDate);
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

    // Date change listeners
    reportDateInput.addEventListener('change', (e) => {
        sessionStorage.setItem('reportDate', e.target.value);
        const today = new Date().toISOString().split('T')[0];
        updateQuickDateActive(e.target.value, today);
        loadDataForDate(e.target.value);
    });

    quickDateBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const offset = parseInt(btn.dataset.offset, 10);
            const target = new Date();
            target.setDate(target.getDate() + offset);
            const yyyy = target.getFullYear();
            const mm = String(target.getMonth() + 1).padStart(2, '0');
            const dd = String(target.getDate()).padStart(2, '0');
            const dateStr = `${yyyy}-${mm}-${dd}`;
            reportDateInput.value = dateStr;
            sessionStorage.setItem('reportDate', dateStr);
            quickDateBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadDataForDate(dateStr);
        });
    });

    refreshBtn.addEventListener('click', () => {
        loadDataForDate(reportDateInput.value);
    });

    // Tab Switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = btn.dataset.view;

            if (currentView === 'summary') {
                // 点击切回学生聚合统计时，清空搜索过滤，始终显示所有学生
                searchInput.value = '';
                summaryTableView.style.display = 'block';
                logsTableView.style.display = 'none';
                if (dauTimeSlotTableView) dauTimeSlotTableView.style.display = 'none';
                if (timeSlotSummaryBar) timeSlotSummaryBar.style.display = 'none';
                gameFilter.style.display = 'inline-block';
                if (timeSlotFilter) timeSlotFilter.style.display = 'none';
                if (dauSortBtn) dauSortBtn.style.display = 'none';
            } else if (currentView === 'logs') {
                summaryTableView.style.display = 'none';
                logsTableView.style.display = 'block';
                if (dauTimeSlotTableView) dauTimeSlotTableView.style.display = 'none';
                if (timeSlotSummaryBar) timeSlotSummaryBar.style.display = 'none';
                gameFilter.style.display = 'inline-block';
                if (timeSlotFilter) timeSlotFilter.style.display = 'none';
                if (dauSortBtn) dauSortBtn.style.display = 'none';
            } else if (currentView === 'dauTimeSlot') {
                summaryTableView.style.display = 'none';
                logsTableView.style.display = 'none';
                if (dauTimeSlotTableView) dauTimeSlotTableView.style.display = 'block';
                if (timeSlotSummaryBar) timeSlotSummaryBar.style.display = 'grid';
                gameFilter.style.display = 'none';
                if (timeSlotFilter) timeSlotFilter.style.display = 'inline-block';
                if (dauSortBtn) dauSortBtn.style.display = 'inline-flex';
                renderTimeSlotSummaryBar();
            }
            applyFiltersAndRender();
        });
    });

    // Filter listeners
    searchInput.addEventListener('input', () => applyFiltersAndRender());
    gameFilter.addEventListener('change', () => applyFiltersAndRender());

    if (timeSlotFilter) {
        timeSlotFilter.addEventListener('change', (e) => {
            selectedTimeSlot = e.target.value;
            renderTimeSlotSummaryBar();
            applyFiltersAndRender();
        });
    }

    function toggleDauSort() {
        dauTimeSortOrder = (dauTimeSortOrder === 'desc') ? 'asc' : 'desc';
        if (dauSortBtnText) dauSortBtnText.textContent = `最后使用时间 ${dauTimeSortOrder === 'desc' ? '↓' : '↑'}`;
        if (dauSortArrow) dauSortArrow.textContent = dauTimeSortOrder === 'desc' ? '↓' : '↑';
        applyFiltersAndRender();
    }

    if (dauSortBtn) dauSortBtn.addEventListener('click', toggleDauSort);
    if (sortDauTimeTh) sortDauTimeTh.addEventListener('click', toggleDauSort);

    // 3. Initialize OSS Client
    function initOssClient() {
        const savedConfig = localStorage.getItem('oss_tool_config');
        if (!savedConfig) {
            noConfigAlert.style.display = 'flex';
            useStaticMockData();
            return false;
        }

        try {
            const config = JSON.parse(savedConfig);
            const { accessKeyId, accessKeySecret, endpoint, bucket } = config;

            if (!accessKeyId || !accessKeySecret || !endpoint || !bucket) {
                noConfigAlert.style.display = 'flex';
                useStaticMockData();
                return false;
            }

            let region = 'oss-cn-shanghai';
            if (endpoint.includes('.aliyuncs.com')) {
                region = endpoint.split('.aliyuncs.com')[0];
            } else {
                region = endpoint;
            }

            ossClient = new OSS({
                region: region,
                accessKeyId: accessKeyId,
                accessKeySecret: accessKeySecret,
                bucket: bucket,
                secure: true
            });
            noConfigAlert.style.display = 'none';
            return true;
        } catch (e) {
            console.error('Failed to initialize OSS client in studentBehavior:', e);
            noConfigAlert.style.display = 'flex';
            useStaticMockData();
            return false;
        }
    }

    // 4. Fetch Game Data from OSS
    async function loadDataForDate(dateStr) {
        if (!ossClient) {
            if (!initOssClient()) return;
        }

        const formattedDate = dateStr.replace(/-/g, '_');
        const prefix = `usertemp/xuelianxitong/${formattedDate}/game/`;

        renderLoadingState();

        try {
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

            if (objects.length === 0) {
                // If OSS returns no data for this date, show empty state or fallback
                rawObjectsList = [];
                studentSummaryList = [];
                renderEmptyState();
                return;
            }

            // Parse raw objects list
            parseAndAnalyzeObjects(objects, dateStr);

            // Fetch DAU users and last activity time slots concurrently
            fetchDauActivityForDate(dateStr);
        } catch (e) {
            console.error('Failed to list game files from OSS:', e);
            // On network error or empty, fallback
            useStaticMockData();
        }
    }

    /**
     * 将 2026_09_17_144933 或各类格式转换为标准年月日时分秒
     * 例如：2026年09月17日 14时49分33秒
     */
    function parseReportTime(raw) {
        if (!raw || raw === '-') {
            return {
                fullCnTime: '-',
                shortCnTime: '-',
                timeStr: '-',
                hour: 12,
                sortKey: ''
            };
        }
        const str = String(raw).trim();

        // 1. 处理 2026_09_17_144933 或 2026_09_17_144933.json 或 2026_09_17_144933_xxx
        const mCompact = str.match(/(\d{4})_(\d{2})_(\d{2})_(\d{2})(\d{2})(\d{2})/);
        if (mCompact) {
            const [_, y, m, d, hh, mm, ss] = mCompact;
            return {
                fullCnTime: `${y}年${m}月${d}日 ${hh}时${mm}分${ss}秒`,
                shortCnTime: `${hh}时${mm}分${ss}秒`,
                timeStr: `${hh}:${mm}:${ss}`,
                hour: parseInt(hh, 10) || 0,
                sortKey: `${y}${m}${d}${hh}${mm}${ss}`
            };
        }

        // 2. 处理 2026_09_17_14_49_33
        const mFull = str.match(/(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})/);
        if (mFull) {
            const [_, y, m, d, hh, mm, ss] = mFull;
            return {
                fullCnTime: `${y}年${m}月${d}日 ${hh}时${mm}分${ss}秒`,
                shortCnTime: `${hh}时${mm}分${ss}秒`,
                timeStr: `${hh}:${mm}:${ss}`,
                hour: parseInt(hh, 10) || 0,
                sortKey: `${y}${m}${d}${hh}${mm}${ss}`
            };
        }

        // 3. Fallback: ISO 日期字符串或标准 Date 解析
        try {
            const dt = new Date(str);
            if (!isNaN(dt.getTime())) {
                const y = dt.getFullYear();
                const m = String(dt.getMonth() + 1).padStart(2, '0');
                const d = String(dt.getDate()).padStart(2, '0');
                const hh = String(dt.getHours()).padStart(2, '0');
                const mm = String(dt.getMinutes()).padStart(2, '0');
                const ss = String(dt.getSeconds()).padStart(2, '0');
                return {
                    fullCnTime: `${y}年${m}月${d}日 ${hh}时${mm}分${ss}秒`,
                    shortCnTime: `${hh}时${mm}分${ss}秒`,
                    timeStr: `${hh}:${mm}:${ss}`,
                    hour: dt.getHours(),
                    sortKey: `${y}${m}${d}${hh}${mm}${ss}`
                };
            }
        } catch (e) { }

        return {
            fullCnTime: str,
            shortCnTime: str,
            timeStr: str,
            hour: 12,
            sortKey: str
        };
    }

    // 5. Parse Object Keys into structured game items
    function parseAndAnalyzeObjects(objects, dateStr) {
        rawObjectsList = [];

        objects.forEach(obj => {
            const key = obj.name;
            if (!key.endsWith('.json')) return;

            // Pattern: usertemp/xuelianxitong/{date}/game/{username}/{gameType}/{file}.json
            const parts = key.split('/');
            const gameIdx = parts.indexOf('game');
            if (gameIdx === -1 || parts.length < gameIdx + 3) return;

            const username = parts[gameIdx + 1] || 'unknown';
            const gameCode = parts[gameIdx + 2] || 'unknown';
            const fileName = parts[gameIdx + 3] || '';

            // Extract time: parse filename (e.g. 2026_09_17_144933.json) or lastModified
            const timeInfo = parseReportTime(fileName || obj.lastModified);

            const gameCfg = GAME_CONFIGS[gameCode] || {
                code: gameCode,
                name: gameCode,
                systemCode: 'other',
                systemName: '其他游戏',
                isSub: false,
                parentName: '',
                color: '#9ca3af',
                tagClass: 'other'
            };

            const item = {
                key: key,
                username: username,
                studentName: userToInfoCache[username]?.studentName || '-',
                schoolName: userToInfoCache[username]?.schoolName || '-',
                teacherName: userToInfoCache[username]?.teacherName || '-',
                gameCode: gameCode,
                gameCfg: gameCfg,
                fullCnTime: timeInfo.fullCnTime,
                shortCnTime: timeInfo.shortCnTime,
                timeStr: timeInfo.timeStr,
                hour: timeInfo.hour,
                sortKey: timeInfo.sortKey,
                reportTime: timeInfo.fullCnTime,
                size: obj.size,
                lastModified: obj.lastModified,
                parsedData: null
            };

            rawObjectsList.push(item);
        });

        // Aggregate summary by student
        aggregateStudentSummary();

        // Render stats & charts immediately
        renderStats();
        renderCharts();
        applyFiltersAndRender();

        // Async resolve student info from file contents (limit 15 workers)
        resolveStudentDetailsAsync();
    }

    // 6. Aggregate Student Summary
    function aggregateStudentSummary() {
        const studentMap = {};

        rawObjectsList.forEach(item => {
            const u = item.username;
            if (!studentMap[u]) {
                studentMap[u] = {
                    username: u,
                    studentName: item.studentName,
                    schoolName: item.schoolName,
                    teacherName: item.teacherName,
                    totalCount: 0,
                    lastTime: item.fullCnTime || item.timeStr,
                    lastSortKey: item.sortKey || item.timeStr,
                    gameCounts: {
                        fruit_cutting: 0,
                        fruit_store: 0,
                        card_gacha: 0,
                        card_album: 0,
                        e_bao: 0
                    }
                };
            }

            studentMap[u].totalCount++;
            if (studentMap[u].gameCounts[item.gameCode] !== undefined) {
                studentMap[u].gameCounts[item.gameCode]++;
            }
            // Keep latest time based on sortKey
            if ((item.sortKey || item.timeStr) > (studentMap[u].lastSortKey || '')) {
                studentMap[u].lastTime = item.fullCnTime || item.timeStr;
                studentMap[u].lastSortKey = item.sortKey || item.timeStr;
            }
        });

        studentSummaryList = Object.values(studentMap).sort((a, b) => b.totalCount - a.totalCount);
    }

    // 7. Render Core Stats Cards
    function renderStats() {
        const activePlayers = studentSummaryList.length;
        const totalGames = rawObjectsList.length;

        let fruitCutting = 0;
        let fruitStore = 0;
        let cardGacha = 0;
        let cardAlbum = 0;
        let eBao = 0;

        rawObjectsList.forEach(it => {
            if (it.gameCode === 'fruit_cutting') fruitCutting++;
            else if (it.gameCode === 'fruit_store') fruitStore++;
            else if (it.gameCode === 'card_gacha') cardGacha++;
            else if (it.gameCode === 'card_album') cardAlbum++;
            else if (it.gameCode === 'e_bao') eBao++;
        });

        const fruitSystem = fruitCutting + fruitStore;
        const cardSystem = cardGacha + cardAlbum;

        activePlayersCountEl.textContent = activePlayers.toLocaleString();
        totalGamesCountEl.textContent = totalGames.toLocaleString();

        fruitSystemCountEl.textContent = fruitSystem.toLocaleString();
        fruitStoreCountEl.textContent = `${fruitStore}次`;
        fruitCuttingCountEl.textContent = `${fruitCutting}次`;

        cardSystemCountEl.textContent = cardSystem.toLocaleString();
        cardAlbumCountEl.textContent = `${cardAlbum}次`;
        cardGachaCountEl.textContent = `${cardGacha}次`;

        eBaoCountEl.textContent = eBao.toLocaleString();
    }

    // 8. Render Visual Charts & Time Slot Schedule
    function renderCharts() {
        renderTimeSlotReportTable();
        renderDistributionDonut();
        renderHourlyTrendChart();
        renderTopStudentsBar();
    }

    // Bind Time Slot Card View Switcher (Schedule Table vs Donut Chart)
    if (slotTableViewBtn && slotChartViewBtn) {
        slotTableViewBtn.addEventListener('click', () => {
            slotTableViewBtn.classList.add('active');
            slotChartViewBtn.classList.remove('active');
            if (timeSlotTableContainer) timeSlotTableContainer.style.display = 'block';
            if (timeSlotChartContainer) timeSlotChartContainer.style.display = 'none';
        });

        slotChartViewBtn.addEventListener('click', () => {
            slotChartViewBtn.classList.add('active');
            slotTableViewBtn.classList.remove('active');
            if (timeSlotTableContainer) timeSlotTableContainer.style.display = 'none';
            if (timeSlotChartContainer) timeSlotChartContainer.style.display = 'block';
            renderDistributionDonut();
        });
    }

    // Render Time Slot Schedule Mini Table (With explicit time ranges)
    function renderTimeSlotReportTable() {
        if (!timeSlotMiniTableBody) return;

        // Calculate count for each time slot
        const slotCounts = {
            morning_early: 0,
            morning: 0,
            noon: 0,
            afternoon: 0,
            evening: 0,
            night: 0
        };

        let totalUsers = 0;
        if (dauUsersList && dauUsersList.length > 0) {
            totalUsers = dauUsersList.length;
            dauUsersList.forEach(u => {
                if (u.timeSlot && slotCounts[u.timeSlot.key] !== undefined) {
                    slotCounts[u.timeSlot.key]++;
                }
            });
        } else if (rawObjectsList && rawObjectsList.length > 0) {
            totalUsers = rawObjectsList.length;
            rawObjectsList.forEach(it => {
                const slot = getTimeSlotInfo(it.hour);
                if (slot && slotCounts[slot.key] !== undefined) {
                    slotCounts[slot.key]++;
                }
            });
        }

        const safeTotal = totalUsers > 0 ? totalUsers : 1;

        // Find peak slot
        let peakSlot = TIME_SLOT_DEFS[0];
        let maxCount = -1;
        TIME_SLOT_DEFS.forEach(s => {
            const c = slotCounts[s.key] || 0;
            if (c > maxCount) {
                maxCount = c;
                peakSlot = s;
            }
        });

        if (peakSlotBadge) {
            if (maxCount > 0) {
                peakSlotBadge.style.display = 'inline-flex';
                peakSlotBadge.innerHTML = `🔥 峰值时段: ${peakSlot.icon} ${peakSlot.name} (${peakSlot.range})`;
            } else {
                peakSlotBadge.style.display = 'none';
            }
        }

        timeSlotMiniTableBody.innerHTML = TIME_SLOT_DEFS.map(slot => {
            const count = slotCounts[slot.key] || 0;
            const pct = Math.round((count / safeTotal) * 100);
            const isPeak = (count === maxCount && maxCount > 0);
            const isActive = (selectedTimeSlot === slot.key);

            return `
                <tr data-slot="${slot.key}" class="${isActive ? 'active-slot-row' : ''}">
                    <td>
                        <span class="slot-range-mono">${slot.range}</span>
                    </td>
                    <td>
                        <span class="slot-badge ${slot.cssClass}">
                            ${slot.icon} ${slot.name}
                        </span>
                        ${isPeak ? '<span style="color:#ef4444; font-size:10.5px; font-weight:700; margin-left:2px;">TOP</span>' : ''}
                    </td>
                    <td>
                        <div class="slot-bar-cell">
                            <div class="slot-bar-text">
                                <span class="slot-row-count-val">${count}<span class="slot-unit-text">人</span></span>
                                <span class="slot-row-pct">${pct}%</span>
                            </div>
                            <div class="time-slot-bar-wrap">
                                <div class="time-slot-bar-fill" style="width: ${count > 0 ? Math.max(pct, 6) : 0}%; background: ${slot.color};"></div>
                            </div>
                        </div>
                    </td>
                    <td style="text-align: center;">
                        <button type="button" class="slot-mini-action-btn" data-slot="${slot.key}" title="筛选查看该时间段学生">
                            查看
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Bind click events on table rows & action buttons
        timeSlotMiniTableBody.querySelectorAll('tr[data-slot]').forEach(tr => {
            tr.addEventListener('click', () => {
                const slotKey = tr.dataset.slot;
                activateTimeSlotFilter(slotKey);
            });
        });
    }

    // Activate specific time slot filter and navigate to DAU table
    function activateTimeSlotFilter(slotKey) {
        const dauTabBtn = document.querySelector('.tab-btn[data-view="dauTimeSlot"]');
        if (dauTabBtn) dauTabBtn.click();

        selectedTimeSlot = slotKey;
        if (timeSlotFilter) timeSlotFilter.value = slotKey;
        renderTimeSlotSummaryBar();
        renderTimeSlotReportTable();
        applyFiltersAndRender();

        const tableSec = document.querySelector('.table-section');
        if (tableSec) {
            tableSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // Donut Chart: Time Slot Distribution Report
    function renderDistributionDonut() {
        if (!distributionCanvas) return;

        // Calculate count for each time slot
        const slotCounts = {
            morning_early: 0,
            morning: 0,
            noon: 0,
            afternoon: 0,
            evening: 0,
            night: 0
        };

        // Prefer DAU user activity list
        if (dauUsersList && dauUsersList.length > 0) {
            dauUsersList.forEach(u => {
                if (u.timeSlot && slotCounts[u.timeSlot.key] !== undefined) {
                    slotCounts[u.timeSlot.key]++;
                }
            });
        } else if (rawObjectsList && rawObjectsList.length > 0) {
            // Fallback to game objects hourly slots if DAU is loading
            rawObjectsList.forEach(it => {
                const slot = getTimeSlotInfo(it.hour);
                if (slot && slotCounts[slot.key] !== undefined) {
                    slotCounts[slot.key]++;
                }
            });
        }

        const labels = TIME_SLOT_DEFS.map(s => `${s.icon} ${s.name} (${s.range})`);
        const data = TIME_SLOT_DEFS.map(s => slotCounts[s.key] || 0);
        const bgColors = TIME_SLOT_DEFS.map(s => s.color);

        if (distributionChart) distributionChart.destroy();

        distributionChart = new Chart(distributionCanvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: bgColors,
                    borderWidth: 2,
                    borderColor: '#ffffff',
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 8,
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                const val = ctx.raw || 0;
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                                const slotDef = TIME_SLOT_DEFS[ctx.dataIndex];
                                const rangeText = slotDef ? ` [${slotDef.range}]` : '';
                                return ` ${slotDef ? slotDef.icon + ' ' + slotDef.name : ctx.label}${rangeText}: ${val} 人 (${pct}%)`;
                            }
                        }
                    }
                },
                cutout: '62%',
                onClick: (evt, elements) => {
                    if (elements && elements.length > 0) {
                        const index = elements[0].index;
                        const slotDef = TIME_SLOT_DEFS[index];
                        if (slotDef) {
                            activateTimeSlotFilter(slotDef.key);
                        }
                    }
                }
            }
        });
    }

    // Line Chart: 24h Hourly Trend
    function renderHourlyTrendChart() {
        if (!hourlyTrendCanvas) return;

        const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
        const hourCounts = new Array(24).fill(0);

        rawObjectsList.forEach(it => {
            if (it.hour >= 0 && it.hour < 24) {
                hourCounts[it.hour]++;
            }
        });

        if (hourlyTrendChart) hourlyTrendChart.destroy();

        const ctx = hourlyTrendCanvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 220);
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

        hourlyTrendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: hours,
                datasets: [{
                    label: '游戏游玩次数',
                    data: hourCounts,
                    borderColor: '#10b981',
                    backgroundColor: gradient,
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: '#10b981',
                    pointRadius: 3,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` 活跃次数: ${ctx.raw} 次`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 11 }, maxRotation: 0 }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0, font: { size: 11 } },
                        grid: { color: '#f3f4f6' }
                    }
                }
            }
        });
    }

    // Bar Chart: Top Students
    function renderTopStudentsBar() {
        if (!topStudentsCanvas) return;

        const top8 = studentSummaryList.slice(0, 8);
        const labels = top8.map(s => s.studentName !== '-' ? s.studentName : s.username);
        const data = top8.map(s => s.totalCount);

        if (topStudentsChart) topStudentsChart.destroy();

        topStudentsChart = new Chart(topStudentsCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '玩游戏总次数',
                    data: data,
                    backgroundColor: '#3b82f6',
                    hoverBackgroundColor: '#2563eb',
                    borderRadius: 4,
                    barThickness: 16
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                onHover: (event, chartElement) => {
                    if (event && event.native && event.native.target) {
                        event.native.target.style.cursor = (chartElement && chartElement.length) ? 'pointer' : 'default';
                    }
                },
                onClick: (evt, elements) => {
                    let clickedIndex = -1;
                    if (elements && elements.length > 0) {
                        clickedIndex = elements[0].index;
                    } else if (topStudentsChart) {
                        const nearest = topStudentsChart.getElementsAtEventForMode(evt.native || evt, 'y', { intersect: false }, false);
                        if (nearest && nearest.length > 0) {
                            clickedIndex = nearest[0].index;
                        }
                    }
                    if (clickedIndex >= 0 && clickedIndex < top8.length) {
                        const student = top8[clickedIndex];
                        if (student && student.username) {
                            showUserGameDetail(student.username);
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` 游玩 ${ctx.raw} 次 (点击查看详情)`
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { precision: 0, font: { size: 10 } },
                        grid: { color: '#f3f4f6' }
                    },
                    y: {
                        ticks: { font: { size: 11 } },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    // 9. Filter and Render Tables
    function applyFiltersAndRender() {
        const query = (searchInput.value || '').trim().toLowerCase();
        const selectedGame = gameFilter.value;

        if (currentView === 'dauTimeSlot') {
            // Filter DAU Time Slot Report
            const filteredDau = dauUsersList.filter(u => {
                const matchQuery = !query ||
                    u.username.toLowerCase().includes(query) ||
                    (u.studentName && u.studentName.toLowerCase().includes(query)) ||
                    (u.schoolName && u.schoolName.toLowerCase().includes(query));

                const matchSlot = (selectedTimeSlot === 'all') || (u.timeSlot && u.timeSlot.key === selectedTimeSlot);
                return matchQuery && matchSlot;
            });

            // Sort by last active time
            filteredDau.sort((a, b) => {
                const tA = a.lastTimeDate ? a.lastTimeDate.getTime() : 0;
                const tB = b.lastTimeDate ? b.lastTimeDate.getTime() : 0;
                return (dauTimeSortOrder === 'desc') ? (tB - tA) : (tA - tB);
            });

            renderDauTimeSlotTable(filteredDau);
            tableInfo.textContent = `共 ${filteredDau.length} 位日活用户最后使用记录`;
            return;
        }

        if (currentView === 'summary') {
            // Filter student summary
            const filteredSummary = studentSummaryList.filter(s => {
                const matchQuery = !query ||
                    s.username.toLowerCase().includes(query) ||
                    (s.studentName && s.studentName.toLowerCase().includes(query)) ||
                    (s.schoolName && s.schoolName.toLowerCase().includes(query));

                let matchGame = true;
                if (selectedGame === 'group_fruit') {
                    matchGame = (s.gameCounts.fruit_cutting + s.gameCounts.fruit_store) > 0;
                } else if (selectedGame === 'group_card') {
                    matchGame = (s.gameCounts.card_gacha + s.gameCounts.card_album) > 0;
                } else if (selectedGame !== 'all') {
                    matchGame = (s.gameCounts[selectedGame] || 0) > 0;
                }

                return matchQuery && matchGame;
            });

            renderSummaryTable(filteredSummary);
            tableInfo.textContent = `共 ${filteredSummary.length} 位学生参与游戏`;
        } else {
            // Filter event logs
            const filteredLogs = rawObjectsList.filter(it => {
                const matchQuery = !query ||
                    it.username.toLowerCase().includes(query) ||
                    (it.studentName && it.studentName.toLowerCase().includes(query)) ||
                    (it.schoolName && it.schoolName.toLowerCase().includes(query));

                let matchGame = true;
                if (selectedGame === 'group_fruit') {
                    matchGame = it.gameCfg.systemCode === 'fruit';
                } else if (selectedGame === 'group_card') {
                    matchGame = it.gameCfg.systemCode === 'card';
                } else if (selectedGame !== 'all') {
                    matchGame = it.gameCode === selectedGame;
                }

                return matchQuery && matchGame;
            });

            renderLogsTable(filteredLogs);
            tableInfo.textContent = `共 ${filteredLogs.length} 条游戏行为流水记录`;
        }
    }

    // Render Summary Table
    function renderSummaryTable(list) {
        if (!summaryTableBody) return;

        if (list.length === 0) {
            summaryTableBody.innerHTML = `<tr><td colspan="9" class="loading-cell">暂无符合条件的学生游戏数据</td></tr>`;
            return;
        }

        summaryTableBody.innerHTML = list.map((s, idx) => {
            const fruitCount = (s.gameCounts.fruit_cutting || 0) + (s.gameCounts.fruit_store || 0);
            const cardCount = (s.gameCounts.card_gacha || 0) + (s.gameCounts.card_album || 0);
            const ebaoCount = s.gameCounts.e_bao || 0;

            let pillsHtml = '';
            if (s.gameCounts.fruit_cutting > 0) pillsHtml += `<span class="pill fruit">切水果: ${s.gameCounts.fruit_cutting}</span>`;
            if (s.gameCounts.fruit_store > 0) pillsHtml += `<span class="pill fruit">水果商店: ${s.gameCounts.fruit_store}</span>`;
            if (s.gameCounts.card_gacha > 0) pillsHtml += `<span class="pill card">抽卡: ${s.gameCounts.card_gacha}</span>`;
            if (s.gameCounts.card_album > 0) pillsHtml += `<span class="pill card">卡册: ${s.gameCounts.card_album}</span>`;
            if (ebaoCount > 0) pillsHtml += `<span class="pill ebao">E宝: ${ebaoCount}</span>`;

            const isSelected = (selectedSummaryUsername && s.username === selectedSummaryUsername);

            return `
                <tr data-username="${s.username}" class="${isSelected ? 'selected-row' : ''}">
                    <td style="color: #9ca3af; font-weight: 500;">${idx + 1}</td>
                    <td><strong>${s.username}</strong></td>
                    <td class="student-name-val">${s.studentName || '-'}</td>
                    <td class="school-name-val">${s.schoolName || '-'}</td>
                    <td class="teacher-name-val">${s.teacherName || '-'}</td>
                    <td style="text-align: center;"><span class="count-badge">${s.totalCount} 次</span></td>
                    <td><div class="game-distribution-pills">${pillsHtml}</div></td>
                    <td style="color: #6b7280;">${s.lastTime || '-'}</td>
                    <td style="text-align: center;">
                        <button class="action-link view-student-logs-btn" data-username="${s.username}">查看明细</button>
                    </td>
                </tr>
            `;
        }).join('');

        // Bind row click for selection highlighting
        summaryTableBody.querySelectorAll('tr[data-username]').forEach(tr => {
            tr.addEventListener('click', () => {
                summaryTableBody.querySelectorAll('tr.selected-row').forEach(r => r.classList.remove('selected-row'));
                tr.classList.add('selected-row');
                selectedSummaryUsername = tr.dataset.username;
            });
        });

        // Bind view student detail and flowchart
        summaryTableBody.querySelectorAll('.view-student-logs-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tr = btn.closest('tr');
                if (tr) {
                    summaryTableBody.querySelectorAll('tr.selected-row').forEach(r => r.classList.remove('selected-row'));
                    tr.classList.add('selected-row');
                    selectedSummaryUsername = tr.dataset.username;
                }
                const u = btn.dataset.username;
                showUserGameDetail(u);
            });
        });
    }

    // Render Logs Table
    function renderLogsTable(list) {
        if (!logsTableBody) return;

        if (list.length === 0) {
            logsTableBody.innerHTML = `<tr><td colspan="9" class="loading-cell">暂无符合条件的游戏流水记录</td></tr>`;
            return;
        }

        // Render first 200 items for high performance
        const displayList = list.slice(0, 200);

        logsTableBody.innerHTML = displayList.map(it => {
            const subLabel = it.gameCfg.isSub ? ` (${it.gameCfg.name})` : '';
            const isSelected = (selectedLogKey && it.key === selectedLogKey);

            return `
                <tr data-key="${it.key}" class="${isSelected ? 'selected-row' : ''}">
                    <td style="color: #4b5563; font-weight: 500; font-family: monospace; white-space: nowrap;">${it.fullCnTime || it.timeStr}</td>
                    <td><strong>${it.username}</strong></td>
                    <td class="student-name-val">${it.studentName || '-'}</td>
                    <td class="school-name-val">${it.schoolName || '-'}</td>
                    <td><span class="system-label">${it.gameCfg.systemName}</span></td>
                    <td>
                        <span class="game-tag ${it.gameCfg.tagClass}">
                            ${it.gameCfg.name} ${it.gameCfg.isSub ? '· 子页面' : ''}
                        </span>
                    </td>
                    <td class="device-val">${it.deviceName || '-'}</td>
                    <td class="platform-val">${it.platformVersion || '-'}</td>
                    <td style="text-align: center;">
                        <button class="action-link open-detail-btn" data-key="${it.key}">查看详情</button>
                    </td>
                </tr>
            `;
        }).join('');

        // Bind row click for selection highlighting
        logsTableBody.querySelectorAll('tr[data-key]').forEach(tr => {
            tr.addEventListener('click', () => {
                logsTableBody.querySelectorAll('tr.selected-row').forEach(r => r.classList.remove('selected-row'));
                tr.classList.add('selected-row');
                selectedLogKey = tr.dataset.key;
            });
        });

        // Bind open detail modal
        logsTableBody.querySelectorAll('.open-detail-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tr = btn.closest('tr');
                if (tr) {
                    logsTableBody.querySelectorAll('tr.selected-row').forEach(r => r.classList.remove('selected-row'));
                    tr.classList.add('selected-row');
                    selectedLogKey = tr.dataset.key;
                }
                const k = btn.dataset.key;
                const item = rawObjectsList.find(x => x.key === k);
                if (item) showDetailModal(item);
            });
        });
    }

    // Render Time Slot Summary Capsules Bar
    function renderTimeSlotSummaryBar() {
        if (!timeSlotSummaryBar) return;

        // Calculate count for each time slot
        const slotCounts = {
            all: dauUsersList.length,
            morning_early: 0,
            morning: 0,
            noon: 0,
            afternoon: 0,
            evening: 0,
            night: 0
        };

        dauUsersList.forEach(u => {
            if (u.timeSlot && slotCounts[u.timeSlot.key] !== undefined) {
                slotCounts[u.timeSlot.key]++;
            }
        });

        const total = dauUsersList.length || 1;

        let cardsHtml = `
            <div class="slot-summary-card ${selectedTimeSlot === 'all' ? 'active' : ''}" data-slot="all">
                <div class="slot-card-header">
                    <span class="slot-card-name">👥 全部日活用户</span>
                    <span class="slot-card-range">全天汇总</span>
                </div>
                <div class="slot-card-body">
                    <span class="slot-card-count">${slotCounts.all} <small style="font-size: 11px; font-weight: normal; color: #64748b;">人</small></span>
                    <span class="slot-card-percent">100%</span>
                </div>
            </div>
        `;

        TIME_SLOT_DEFS.forEach(slot => {
            const count = slotCounts[slot.key] || 0;
            const pct = Math.round((count / total) * 100);
            const isActive = selectedTimeSlot === slot.key;

            cardsHtml += `
                <div class="slot-summary-card ${isActive ? 'active' : ''}" data-slot="${slot.key}">
                    <div class="slot-card-header">
                        <span class="slot-card-name">${slot.icon} ${slot.name}</span>
                        <span class="slot-card-range">${slot.range}</span>
                    </div>
                    <div class="slot-card-body">
                        <span class="slot-card-count">${count} <small style="font-size: 11px; font-weight: normal; color: #64748b;">人</small></span>
                        <span class="slot-card-percent">${pct}%</span>
                    </div>
                </div>
            `;
        });

        timeSlotSummaryBar.innerHTML = cardsHtml;

        // Bind click on cards
        timeSlotSummaryBar.querySelectorAll('.slot-summary-card').forEach(card => {
            card.addEventListener('click', () => {
                const slot = card.dataset.slot;
                selectedTimeSlot = slot;
                if (timeSlotFilter) timeSlotFilter.value = slot;
                renderTimeSlotSummaryBar();
                applyFiltersAndRender();
            });
        });
    }

    // Render DAU Time Slot Table
    function renderDauTimeSlotTable(list) {
        if (!dauTimeSlotTableBody) return;

        if (list.length === 0) {
            dauTimeSlotTableBody.innerHTML = `<tr><td colspan="10" class="loading-cell">所选时段暂无活跃用户记录</td></tr>`;
            return;
        }

        dauTimeSlotTableBody.innerHTML = list.map((item, idx) => {
            const isSelected = (selectedSummaryUsername && item.username === selectedSummaryUsername);
            const gameBadge = (item.gameSummary && item.gameSummary.totalCount > 0)
                ? `<span class="game-participate-pill played" title="点击查看该学生游戏详情" data-username="${item.username}">🎮 玩过 ${item.gameSummary.totalCount} 次</span>`
                : `<span class="game-participate-pill none">仅日活未玩游戏</span>`;

            const deviceText = (item.deviceName && item.deviceName !== '-')
                ? `${item.deviceName} · ${item.platformVersion || ''}`
                : (item.platformVersion && item.platformVersion !== '-' ? item.platformVersion : '-');

            return `
                <tr data-username="${item.username}" class="${isSelected ? 'selected-row' : ''}">
                    <td style="color: #9ca3af; font-weight: 500;">${idx + 1}</td>
                    <td><strong>${item.username}</strong></td>
                    <td class="student-name-val">${item.studentName || '-'}</td>
                    <td class="school-name-val">${item.schoolName || '-'}</td>
                    <td>
                        <div class="slot-badge-group">
                            <span class="slot-badge ${item.timeSlot ? item.timeSlot.cssClass : 'slot-afternoon'}">
                                ${item.timeSlot ? item.timeSlot.icon : '⏰'} ${item.timeSlot ? item.timeSlot.name : '时段'}
                            </span>
                            <span class="slot-range-label">${item.timeSlot ? item.timeSlot.range : ''}</span>
                        </div>
                    </td>
                    <td style="font-family: monospace; font-weight: 600; color: #1e293b;">
                        ${item.lastTimeStr || '-'}
                    </td>
                    <td>
                        <span class="activity-status-pill ${item.relativeTime && item.relativeTime.isFresh ? 'fresh' : 'normal'}">
                            ${item.relativeTime ? item.relativeTime.text : '-'}
                        </span>
                    </td>
                    <td>${gameBadge}</td>
                    <td style="color: #64748b; font-size: 12px;">${deviceText}</td>
                    <td style="text-align: center;">
                        <button class="action-link view-student-detail-btn" data-username="${item.username}">查看详情</button>
                    </td>
                </tr>
            `;
        }).join('');

        // Bind row click for selection highlighting
        dauTimeSlotTableBody.querySelectorAll('tr[data-username]').forEach(tr => {
            tr.addEventListener('click', () => {
                dauTimeSlotTableBody.querySelectorAll('tr.selected-row').forEach(r => r.classList.remove('selected-row'));
                tr.classList.add('selected-row');
                selectedSummaryUsername = tr.dataset.username;
            });
        });

        // Bind view detail
        dauTimeSlotTableBody.querySelectorAll('.view-student-detail-btn, .game-participate-pill.played').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const u = btn.dataset.username || btn.closest('tr')?.dataset?.username;
                if (u) showUserGameDetail(u);
            });
        });
    }

    // 10. Async Student Details Resolution from OSS File Content
    async function resolveStudentDetailsAsync() {
        if (!ossClient || rawObjectsList.length === 0) return;

        // Group objects by username to minimize OSS GET requests
        const userFirstObjectMap = {};
        rawObjectsList.forEach(it => {
            if (!userFirstObjectMap[it.username]) {
                userFirstObjectMap[it.username] = it;
            }
        });

        const usersToFetch = Object.keys(userFirstObjectMap).filter(u => !userToInfoCache[u]);
        if (usersToFetch.length === 0) return;

        const concurrency = 10;
        let index = 0;

        async function worker() {
            while (index < usersToFetch.length) {
                const u = usersToFetch[index++];
                const sampleItem = userFirstObjectMap[u];
                try {
                    const res = await ossClient.get(sampleItem.key);
                    const contentStr = res.content ? res.content.toString() : '';
                    if (contentStr) {
                        const parsed = JSON.parse(contentStr);
                        sampleItem.parsedData = parsed;
                        const data = Array.isArray(parsed) ? (parsed[0] || {}) : parsed;

                        // Parse reportTime if available inside json
                        if (data.reportTime) {
                            const tInfo = parseReportTime(data.reportTime);
                            sampleItem.fullCnTime = tInfo.fullCnTime;
                            sampleItem.shortCnTime = tInfo.shortCnTime;
                            sampleItem.timeStr = tInfo.timeStr;
                            sampleItem.hour = tInfo.hour;
                            sampleItem.sortKey = tInfo.sortKey;
                            sampleItem.reportTime = tInfo.fullCnTime;
                        }

                        const studentInfo = data.studentInfo || {};

                        const name = studentInfo.nickName || data.nickName || studentInfo.name || data.userName || studentInfo.userName || '';
                        const school = studentInfo.shopName || data.shopName || studentInfo.schoolName || data.schoolName || '';
                        const teacher = studentInfo.teacherName || data.teacherName || '';

                        if (name || school || teacher) {
                            userToInfoCache[u] = {
                                studentName: name || '-',
                                schoolName: school || '-',
                                teacherName: teacher || '-'
                            };
                            updateUserCells(u, userToInfoCache[u]);
                        }
                    }
                } catch (e) {
                    // Ignore single read errors
                }
            }
        }

        const workers = [];
        for (let i = 0; i < Math.min(concurrency, usersToFetch.length); i++) {
            workers.push(worker());
        }
        await Promise.all(workers);

        // Update charts top students with parsed names
        renderTopStudentsBar();
    }

    function updateUserCells(username, info) {
        // Update rawObjectsList
        rawObjectsList.forEach(it => {
            if (it.username === username) {
                it.studentName = info.studentName;
                it.schoolName = info.schoolName;
                it.teacherName = info.teacherName;
            }
        });

        // Update studentSummaryList
        studentSummaryList.forEach(s => {
            if (s.username === username) {
                s.studentName = info.studentName;
                s.schoolName = info.schoolName;
                s.teacherName = info.teacherName;
            }
        });

        // Update dauUsersList
        dauUsersList.forEach(u => {
            if (u.username === username) {
                u.studentName = info.studentName;
                u.schoolName = info.schoolName;
            }
        });

        // Live update DOM cells
        const summaryRows = summaryTableBody.querySelectorAll(`tr[data-username="${username}"]`);
        summaryRows.forEach(row => {
            const nameCell = row.querySelector('.student-name-val');
            const schoolCell = row.querySelector('.school-name-val');
            const teacherCell = row.querySelector('.teacher-name-val');
            if (nameCell && info.studentName) nameCell.textContent = info.studentName;
            if (schoolCell && info.schoolName) schoolCell.textContent = info.schoolName;
            if (teacherCell && info.teacherName) teacherCell.textContent = info.teacherName;
        });

        const logRows = logsTableBody.querySelectorAll('tr');
        logRows.forEach(row => {
            const k = row.dataset.key;
            if (k && k.includes(`/${username}/`)) {
                const nameCell = row.querySelector('.student-name-val');
                const schoolCell = row.querySelector('.school-name-val');
                if (nameCell && info.studentName) nameCell.textContent = info.studentName;
                if (schoolCell && info.schoolName) schoolCell.textContent = info.schoolName;
            }
        });

        if (dauTimeSlotTableBody) {
            const dauRows = dauTimeSlotTableBody.querySelectorAll(`tr[data-username="${username}"]`);
            dauRows.forEach(row => {
                const nameCell = row.querySelector('.student-name-val');
                const schoolCell = row.querySelector('.school-name-val');
                if (nameCell && info.studentName) nameCell.textContent = info.studentName;
                if (schoolCell && info.schoolName) schoolCell.textContent = info.schoolName;
            });
        }
    }

    // 10.2 Fetch DAU User Activity and Last Active Time Slots from OSS
    async function fetchDauActivityForDate(dateStr) {
        if (!ossClient) return;

        const formattedDate = (dateStr || '').replace(/-/g, '_');
        const dauPrefix = `usertemp/xuelianxitong/${formattedDate}/user_activity/`;

        try {
            let objs = [];
            let marker = null;
            do {
                const listParams = { prefix: dauPrefix, 'max-keys': 1000 };
                if (marker) listParams.marker = marker;
                const res = await ossClient.list(listParams);
                objs = objs.concat(res.objects || []);
                marker = res.isTruncated ? res.nextMarker : null;
            } while (marker);

            objs = objs.filter(o => o.name && !o.name.endsWith('/'));

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
                dauUsersList = [];
                if (currentView === 'dauTimeSlot') {
                    renderTimeSlotSummaryBar();
                    applyFiltersAndRender();
                }
                return;
            }

            dauUsersList = objs.map(obj => {
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
                    fallbackUsername = parts[parts.length - 1].replace(/\.(json|txt)$/, '');
                }

                const lastDate = obj.lastModified ? new Date(obj.lastModified) : new Date();
                const slotInfo = getTimeSlotInfo(lastDate);
                const fullStr = formatFullDateTime(lastDate);
                const relInfo = getRelativeTimeDesc(lastDate);

                // Cross-reference with game behavior records
                const gameSummary = studentSummaryList.find(s => s.username === fallbackUsername);

                return {
                    key: key,
                    username: fallbackUsername,
                    studentName: userToInfoCache[fallbackUsername]?.studentName || '-',
                    schoolName: userToInfoCache[fallbackUsername]?.schoolName || '-',
                    deviceName: '-',
                    platformVersion: '-',
                    lastModified: obj.lastModified,
                    lastTimeDate: lastDate,
                    lastTimeStr: fullStr,
                    hour: lastDate.getHours(),
                    sortKey: fullStr,
                    timeSlot: slotInfo,
                    relativeTime: relInfo,
                    gameSummary: gameSummary || null
                };
            });

            // Initial sort: latest first
            dauUsersList.sort((a, b) => {
                const tA = a.lastTimeDate ? a.lastTimeDate.getTime() : 0;
                const tB = b.lastTimeDate ? b.lastTimeDate.getTime() : 0;
                return tB - tA;
            });

            renderTimeSlotSummaryBar();
            renderTimeSlotReportTable();
            renderDistributionDonut();
            if (currentView === 'dauTimeSlot') {
                applyFiltersAndRender();
            }

            // Async read DAU file content for user details
            resolveDauUserDetailsAsync();
        } catch (e) {
            console.warn('Failed to fetch DAU activity from OSS:', e);
        }
    }

    // Async resolve student info from DAU file contents
    async function resolveDauUserDetailsAsync() {
        if (!ossClient || dauUsersList.length === 0) return;

        const usersToFetch = dauUsersList.filter(u => !userToInfoCache[u.username] || u.deviceName === '-');
        if (usersToFetch.length === 0) return;

        const concurrency = 12;
        let index = 0;

        async function worker() {
            while (index < usersToFetch.length) {
                const item = usersToFetch[index++];
                try {
                    const res = await ossClient.get(item.key);
                    const contentStr = res.content ? res.content.toString() : '';
                    if (contentStr) {
                        const parsed = JSON.parse(contentStr);
                        const fileData = Array.isArray(parsed) ? (parsed[0] || {}) : parsed;
                        const studentInfo = fileData.studentInfo || {};

                        const name = fileData.nickName || studentInfo.nickName || fileData.userName || studentInfo.userName || '';
                        const school = studentInfo.shopName || fileData.shopName || studentInfo.schoolName || fileData.schoolName || '';
                        const device = fileData.deviceName || studentInfo.deviceName || '-';
                        const platform = fileData.phonePlatformVersion || studentInfo.phonePlatformVersion || fileData.appVersion || '-';

                        item.deviceName = device;
                        item.platformVersion = platform;

                        if (name || school) {
                            userToInfoCache[item.username] = {
                                studentName: name || userToInfoCache[item.username]?.studentName || '-',
                                schoolName: school || userToInfoCache[item.username]?.schoolName || '-',
                                teacherName: userToInfoCache[item.username]?.teacherName || '-'
                            };
                            updateUserCells(item.username, userToInfoCache[item.username]);
                        }
                    }
                } catch (e) {
                    // Ignore individual read error
                }
            }
        }

        const workers = [];
        for (let i = 0; i < Math.min(concurrency, usersToFetch.length); i++) {
            workers.push(worker());
        }
        await Promise.all(workers);

        if (currentView === 'dauTimeSlot') {
            applyFiltersAndRender();
        }
    }

    // 11. Student Game Detail & Flowchart View Logic
    if (backToListBtn) {
        backToListBtn.addEventListener('click', () => {
            if (userDetailContainer && dashboardContainer) {
                userDetailContainer.style.display = 'none';
                dashboardContainer.style.display = 'flex';
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    function showUserGameDetail(username) {
        if (!userDetailContainer || !dashboardContainer) return;

        // Switch container views
        dashboardContainer.style.display = 'none';
        userDetailContainer.style.display = 'flex';
        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (detailCurrentDate) {
            detailCurrentDate.textContent = `报表日期：${reportDateInput.value}`;
        }

        selectedUserLogKey = null;

        // Filter all game objects for this user
        const userItems = rawObjectsList.filter(it => it.username === username);
        const userSummary = studentSummaryList.find(s => s.username === username) || {
            username: username,
            studentName: userToInfoCache[username]?.studentName || '-',
            schoolName: userToInfoCache[username]?.schoolName || '-',
            teacherName: userToInfoCache[username]?.teacherName || '-',
            totalCount: userItems.length,
            gameCounts: { fruit_cutting: 0, fruit_store: 0, card_gacha: 0, card_album: 0, e_bao: 0 }
        };

        const info = userToInfoCache[username] || {};
        const displayName = info.studentName || userSummary.studentName || username;
        if (detailStudentName) detailStudentName.textContent = displayName;
        if (detailUsername) detailUsername.textContent = `@${username}`;
        if (detailAvatar) detailAvatar.textContent = displayName !== '-' ? displayName.slice(0, 1) : '学';
        if (detailSchoolName) detailSchoolName.textContent = info.schoolName || userSummary.schoolName || '-';
        if (detailTeacherName) detailTeacherName.textContent = info.teacherName || userSummary.teacherName || '-';

        // Count totals
        const fruitTotal = (userSummary.gameCounts.fruit_cutting || 0) + (userSummary.gameCounts.fruit_store || 0);
        const cardTotal = (userSummary.gameCounts.card_gacha || 0) + (userSummary.gameCounts.card_album || 0);
        const ebaoTotal = userSummary.gameCounts.e_bao || 0;

        if (detailTotalCount) detailTotalCount.textContent = userSummary.totalCount || userItems.length;
        if (detailFruitCount) detailFruitCount.textContent = `${fruitTotal}次 (切水果:${userSummary.gameCounts.fruit_cutting || 0} / 商店:${userSummary.gameCounts.fruit_store || 0})`;
        if (detailCardCount) detailCardCount.textContent = `${cardTotal}次 (抽卡:${userSummary.gameCounts.card_gacha || 0} / 卡册:${userSummary.gameCounts.card_album || 0})`;
        if (detailEbaoCount) detailEbaoCount.textContent = `${ebaoTotal}次`;

        // 1. Render Flowchart (sorted ascending: earliest to latest)
        const sortedItems = [...userItems].sort((a, b) => (a.sortKey || a.timeStr || '').localeCompare(b.sortKey || b.timeStr || ''));
        renderFlowchart(sortedItems);

        // 2. Render Single User Game Logs Table (sorted descending: latest first)
        const descItems = [...userItems].sort((a, b) => (b.sortKey || b.timeStr || '').localeCompare(a.sortKey || a.timeStr || ''));
        renderUserLogsTable(descItems);
    }

    function renderFlowchart(items) {
        if (!flowchartTracks) return;

        if (items.length === 0) {
            flowchartTracks.innerHTML = `<div style="padding: 30px; text-align: center; color: #9ca3af; font-size: 13px; background: #fafafa; border-radius: 8px;">该学生在所选日期暂无游戏行为记录</div>`;
            return;
        }

        // 分组为三大独立游戏线路：
        // 1. 水果商店系统 (含水果商店主页及切水果子玩法)
        const fruitItems = items.filter(it => it.gameCfg.systemCode === 'fruit');
        // 2. 卡册系统 (含卡册主页及抽卡子玩法)
        const cardItems = items.filter(it => it.gameCfg.systemCode === 'card');
        // 3. E宝游戏 (独立游戏)
        const ebaoItems = items.filter(it => it.gameCfg.systemCode === 'ebao');

        const trackConfigs = [
            {
                code: 'fruit',
                title: '🍎 线路一：水果商店系统',
                subtag: '包含：水果商店主页、切水果 (子玩法)',
                cssClass: 'fruit-track',
                items: fruitItems
            },
            {
                code: 'card',
                title: '🎴 线路二：卡册系统',
                subtag: '包含：卡册主页、抽卡 (子玩法)',
                cssClass: 'card-track',
                items: cardItems
            },
            {
                code: 'ebao',
                title: '🤖 线路三：E宝游戏',
                subtag: '独立关卡互动与答题',
                cssClass: 'ebao-track',
                items: ebaoItems
            }
        ];

        // 核心规则：三个游戏按照三条线路，没有就不显示，有就显示
        const visibleTracks = trackConfigs.filter(t => t.items.length > 0);

        if (visibleTracks.length === 0) {
            flowchartTracks.innerHTML = `<div style="padding: 30px; text-align: center; color: #9ca3af; font-size: 13px; background: #fafafa; border-radius: 8px;">该学生在所选日期暂无任何游戏行为记录</div>`;
            return;
        }

        let tracksHtml = '';

        visibleTracks.forEach(track => {
            const lastTime = track.items[track.items.length - 1]?.fullCnTime || track.items[track.items.length - 1]?.timeStr || '-';
            let nodesHtml = '';

            track.items.forEach((it, idx) => {
                let connectorHtml = '';
                if (idx > 0) {
                    const prev = track.items[idx - 1];
                    const gapText = calculateTimeGap(prev.timeStr, it.timeStr);
                    connectorHtml = `
                        <div class="flow-connector">
                            <span class="flow-time-gap" title="相隔时间">${gapText}</span>
                            <div class="flow-arrow-icon">
                                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                                    <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
                                </svg>
                            </div>
                        </div>
                    `;
                }

                let actionIcon = '';
                if (it.gameCode === 'fruit_cutting') actionIcon = '🍉';
                else if (it.gameCode === 'fruit_store') actionIcon = '🍎';
                else if (it.gameCode === 'card_gacha') actionIcon = '✨';
                else if (it.gameCode === 'card_album') actionIcon = '📖';
                else if (it.gameCode === 'e_bao') actionIcon = '🤖';
                else actionIcon = '🎮';

                const subBadge = it.gameCfg.isSub ? `<span style="font-size: 11px; background: rgba(0,0,0,0.06); padding: 2px 6px; border-radius: 4px; margin-left: 6px; font-weight: normal;">子页面</span>` : '';

                const isSelected = (selectedUserLogKey && it.key === selectedUserLogKey);
                nodesHtml += `
                    ${connectorHtml}
                    <div class="flow-step-card ${it.gameCfg.tagClass} ${isSelected ? 'selected-step-card' : ''}" data-key="${it.key}" title="点击查看此步骤数据">
                        <div class="step-card-top">
                            <span class="step-num-badge">Step ${idx + 1}</span>
                            <span class="step-time-val" title="${it.fullCnTime}">${it.shortCnTime || it.timeStr}</span>
                        </div>
                        <div class="step-game-badge" style="color: ${it.gameCfg.color};">
                            <span>${actionIcon} ${it.gameCfg.name}</span>
                            ${subBadge}
                        </div>
                        <div class="step-card-footer">
                            <span>归属: ${it.gameCfg.systemName}</span>
                            <span class="step-view-hint">详情 &gt;</span>
                        </div>
                    </div>
                `;
            });

            tracksHtml += `
                <div class="game-track ${track.cssClass}">
                    <div class="track-header">
                        <div class="track-title-wrap">
                            <span class="track-title">${track.title}</span>
                            <span class="track-subtag">${track.subtag}</span>
                        </div>
                        <div class="track-meta">
                            <span>该线路累计: <strong>${track.items.length} 次</strong></span>
                            <span>最新: <strong>${lastTime}</strong></span>
                        </div>
                    </div>
                    <div class="track-pipeline-scroll">
                        <div class="track-pipeline">
                            ${nodesHtml}
                        </div>
                    </div>
                </div>
            `;
        });

        flowchartTracks.innerHTML = tracksHtml;

        // Bind click on flow cards to select card + select matching table row + open JSON modal
        flowchartTracks.querySelectorAll('.flow-step-card').forEach(card => {
            card.addEventListener('click', () => {
                flowchartTracks.querySelectorAll('.flow-step-card.selected-step-card').forEach(c => c.classList.remove('selected-step-card'));
                card.classList.add('selected-step-card');

                const k = card.dataset.key;
                selectedUserLogKey = k;

                // Sync highlight with user logs table row
                if (userLogsTableBody) {
                    userLogsTableBody.querySelectorAll('tr.selected-row').forEach(r => r.classList.remove('selected-row'));
                    const matchingTr = userLogsTableBody.querySelector(`tr[data-key="${k}"]`);
                    if (matchingTr) {
                        matchingTr.classList.add('selected-row');
                        matchingTr.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                }

                const item = items.find(x => x.key === k) || rawObjectsList.find(x => x.key === k);
                if (item) showDetailModal(item);
            });
        });
    }

    function calculateTimeGap(timeA, timeB) {
        if (!timeA || !timeB || timeA === '-' || timeB === '-') return '➔';
        const parseSec = (t) => {
            const parts = t.split(':').map(x => parseInt(x, 10) || 0);
            if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
            if (parts.length === 2) return parts[0] * 60 + parts[1];
            return 0;
        };
        const diff = Math.abs(parseSec(timeB) - parseSec(timeA));
        if (diff === 0) return '连续操作';
        if (diff < 60) return `+${diff}秒`;
        const mins = Math.floor(diff / 60);
        const secs = diff % 60;
        if (mins < 60) return `+${mins}分${secs > 0 ? secs + '秒' : ''}`;
        const hours = Math.floor(mins / 60);
        const remMins = mins % 60;
        return `+${hours}小时${remMins > 0 ? remMins + '分' : ''}`;
    }

    function renderUserLogsTable(items) {
        if (!userLogsTableBody) return;

        if (userLogsCountText) {
            userLogsCountText.textContent = `共 ${items.length} 条记录`;
        }

        if (items.length === 0) {
            userLogsTableBody.innerHTML = `<tr><td colspan="8" class="loading-cell">暂无记录</td></tr>`;
            return;
        }

        userLogsTableBody.innerHTML = items.map((it, idx) => {
            const subNote = it.gameCfg.isSub ? `属于【${it.gameCfg.parentName}】子页面` : '系统主入口';
            const isSelected = (selectedUserLogKey && it.key === selectedUserLogKey);
            return `
                <tr data-key="${it.key}" class="${isSelected ? 'selected-row' : ''}">
                    <td style="color: #9ca3af; font-weight: 500;">${idx + 1}</td>
                    <td style="color: #1f2937; font-weight: 600; font-family: monospace; white-space: nowrap;">${it.fullCnTime || it.timeStr}</td>
                    <td><span class="system-label">${it.gameCfg.systemName}</span></td>
                    <td>
                        <span class="game-tag ${it.gameCfg.tagClass}">
                            ${it.gameCfg.name}
                        </span>
                    </td>
                    <td style="color: #6b7280; font-size: 12px;">${subNote}</td>
                    <td>${it.deviceName || '-'}</td>
                    <td>${it.platformVersion || '-'}</td>
                    <td style="text-align: center;">
                        <button class="action-link user-log-detail-btn" data-key="${it.key}">查看详情</button>
                    </td>
                </tr>
            `;
        }).join('');

        // Bind row click for selection highlighting
        userLogsTableBody.querySelectorAll('tr[data-key]').forEach(tr => {
            tr.addEventListener('click', () => {
                userLogsTableBody.querySelectorAll('tr.selected-row').forEach(r => r.classList.remove('selected-row'));
                tr.classList.add('selected-row');

                const k = tr.dataset.key;
                selectedUserLogKey = k;

                // Sync with flowchart step card
                if (flowchartTracks) {
                    flowchartTracks.querySelectorAll('.flow-step-card.selected-step-card').forEach(c => c.classList.remove('selected-step-card'));
                    const matchingCard = flowchartTracks.querySelector(`.flow-step-card[data-key="${k}"]`);
                    if (matchingCard) {
                        matchingCard.classList.add('selected-step-card');
                        matchingCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    }
                }
            });
        });

        userLogsTableBody.querySelectorAll('.user-log-detail-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tr = btn.closest('tr');
                if (tr) {
                    userLogsTableBody.querySelectorAll('tr.selected-row').forEach(r => r.classList.remove('selected-row'));
                    tr.classList.add('selected-row');
                    selectedUserLogKey = tr.dataset.key;

                    if (flowchartTracks) {
                        flowchartTracks.querySelectorAll('.flow-step-card.selected-step-card').forEach(c => c.classList.remove('selected-step-card'));
                        const matchingCard = flowchartTracks.querySelector(`.flow-step-card[data-key="${selectedUserLogKey}"]`);
                        if (matchingCard) {
                            matchingCard.classList.add('selected-step-card');
                            matchingCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                        }
                    }
                }
                const k = btn.dataset.key;
                const item = items.find(x => x.key === k) || rawObjectsList.find(x => x.key === k);
                if (item) showDetailModal(item);
            });
        });
    }

    // 12. Modal Detail Viewer
    async function showDetailModal(item) {
        currentModalItem = item;

        modalGameBadge.textContent = `${item.gameCfg.name}${item.gameCfg.isSub ? ' (子页面)' : ''}`;
        modalGameBadge.className = `modal-game-badge ${item.gameCfg.tagClass}`;

        modalMetaGrid.innerHTML = `
            <div class="meta-item"><span class="meta-label">学生账号</span><span class="meta-val">${item.username}</span></div>
            <div class="meta-item"><span class="meta-label">学生姓名</span><span class="meta-val">${item.studentName || '-'}</span></div>
            <div class="meta-item"><span class="meta-label">所属学校</span><span class="meta-val">${item.schoolName || '-'}</span></div>
            <div class="meta-item"><span class="meta-label">归属系统</span><span class="meta-val">${item.gameCfg.systemName}</span></div>
            <div class="meta-item"><span class="meta-label">发生时间</span><span class="meta-val">${item.fullCnTime || item.timeStr}</span></div>
            <div class="meta-item"><span class="meta-label">文件路径</span><span class="meta-val" style="word-break: break-all; font-size: 11px;">${item.key}</span></div>
        `;

        modalJsonPre.textContent = '⏳ 正在加载原始上报文件内容...';
        detailModal.style.display = 'flex';

        if (item.parsedData) {
            modalJsonPre.textContent = JSON.stringify(item.parsedData, null, 2);
            return;
        }

        if (ossClient) {
            try {
                const res = await ossClient.get(item.key);
                const str = res.content ? res.content.toString() : '';
                item.parsedData = JSON.parse(str);
                modalJsonPre.textContent = JSON.stringify(item.parsedData, null, 2);
            } catch (e) {
                modalJsonPre.textContent = `读取失败: ${e.message}`;
            }
        } else {
            modalJsonPre.textContent = JSON.stringify(item, null, 2);
        }
    }

    modalCloseBtn.addEventListener('click', () => {
        detailModal.style.display = 'none';
    });

    detailModal.addEventListener('click', (e) => {
        if (e.target === detailModal) detailModal.style.display = 'none';
    });

    modalCopyBtn.addEventListener('click', () => {
        if (!modalJsonPre.textContent) return;
        navigator.clipboard.writeText(modalJsonPre.textContent).then(() => {
            const originalText = modalCopyBtn.textContent;
            modalCopyBtn.textContent = '已复制！';
            setTimeout(() => modalCopyBtn.textContent = originalText, 1500);
        });
    });

    // 12. Export to Excel
    exportExcelBtn.addEventListener('click', () => {
        if (typeof XLSX === 'undefined') {
            alert('Excel 导出组件加载中，请稍后重试');
            return;
        }

        const dateStr = reportDateInput.value;

        if (currentView === 'dauTimeSlot') {
            const dataToExport = dauUsersList.map((u, idx) => ({
                '序号': idx + 1,
                '学生账号': u.username,
                '学生姓名': u.studentName,
                '所属学校': u.schoolName,
                '最后使用时段': `${u.timeSlot ? u.timeSlot.name : ''} (${u.timeSlot ? u.timeSlot.range : ''})`,
                '最后使用时间': u.lastTimeStr,
                '今日游戏参与': u.gameSummary ? `已玩游戏 (${u.gameSummary.totalCount}次)` : '未玩游戏 (仅日活)',
                '设备型号': u.deviceName || '-',
                '系统版本': u.platformVersion || '-'
            }));

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, '日活用户最后使用时段报表');
            XLSX.writeFile(wb, `用户使用时段报表_${dateStr}.xlsx`);
            return;
        }

        if (currentView === 'summary') {
            const dataToExport = studentSummaryList.map((s, idx) => ({
                '序号': idx + 1,
                '学生账号': s.username,
                '学生姓名': s.studentName,
                '学校': s.schoolName,
                '老师': s.teacherName,
                '总游玩次数': s.totalCount,
                '切水果次数': s.gameCounts.fruit_cutting,
                '水果商店次数': s.gameCounts.fruit_store,
                '抽卡次数': s.gameCounts.card_gacha,
                '卡册次数': s.gameCounts.card_album,
                'E宝游戏次数': s.gameCounts.e_bao,
                '最后活动时间': s.lastTime
            }));

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, '学生游戏行为汇总');
            XLSX.writeFile(wb, `学生游戏汇总_${dateStr}.xlsx`);
        } else {
            const dataToExport = rawObjectsList.map(it => ({
                '发生时间': it.fullCnTime || it.timeStr,
                '学生账号': it.username,
                '学生姓名': it.studentName,
                '学校': it.schoolName,
                '游戏主系统': it.gameCfg.systemName,
                '具体游戏': it.gameCfg.name,
                '是否子页面': it.gameCfg.isSub ? '是' : '否',
                '设备型号': it.deviceName || '-',
                '系统版本': it.platformVersion || '-'
            }));

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, '游戏行为流水明细');
            XLSX.writeFile(wb, `游戏行为流水_${dateStr}.xlsx`);
        }
    });

    // 13. High-Quality Static Mock Data
    function useStaticMockData() {
        const mockUsers = [
            { username: '13812345678', name: '李明轩', school: '光明实验外国语小学', teacher: '王老师' },
            { username: '13987654321', name: '张子萱', school: '汇文第一寄宿学校', teacher: '张老师' },
            { username: '13700112233', name: '陈梓涵', school: '育才实验示范学校', teacher: '刘老师' },
            { username: '13611223344', name: '王子涵', school: '南开实验学校本部', teacher: '赵老师' },
            { username: '13599887766', name: '赵俊熙', school: '朝阳外国语小学分校', teacher: '王老师' },
            { username: '13455667788', name: '孙语桐', school: '光明实验外国语小学', teacher: '孙老师' },
            { username: '13311224455', name: '杨皓轩', school: '汇文第一寄宿学校', teacher: '李老师' },
            { username: '13122334455', name: '周雨诺', school: '育才实验示范学校', teacher: '周老师' }
        ];

        mockUsers.forEach(u => {
            userToInfoCache[u.username] = {
                studentName: u.name,
                schoolName: u.school,
                teacherName: u.teacher
            };
        });

        const gameKeys = ['fruit_cutting', 'fruit_store', 'card_gacha', 'card_album', 'e_bao'];
        const mockObjects = [];
        const dateStr = reportDateInput.value || '2026-09-17';
        const formattedDate = dateStr.replace(/-/g, '_');

        // Generate ~86 realistic game events
        for (let i = 0; i < 86; i++) {
            const user = mockUsers[Math.floor(Math.random() * mockUsers.length)];
            // Weighted game choice (fruit cutting and gacha are more popular)
            const rand = Math.random();
            let g = 'fruit_cutting';
            if (rand < 0.35) g = 'fruit_cutting';
            else if (rand < 0.50) g = 'fruit_store';
            else if (rand < 0.75) g = 'card_gacha';
            else if (rand < 0.88) g = 'card_album';
            else g = 'e_bao';

            const hour = Math.floor(Math.random() * 14) + 8; // 08:00 - 22:00
            const min = Math.floor(Math.random() * 60);
            const sec = Math.floor(Math.random() * 60);
            const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
            const timeSuffix = `${String(hour).padStart(2, '0')}${String(min).padStart(2, '0')}${String(sec).padStart(2, '0')}`;
            const key = `usertemp/xuelianxitong/${formattedDate}/game/${user.username}/${g}/${formattedDate}_${timeSuffix}.json`;

            mockObjects.push({
                name: key,
                size: Math.floor(Math.random() * 2048) + 1024,
                lastModified: new Date(`${dateStr}T${timeStr}Z`).toISOString()
            });
        }

        // Sort descending
        mockObjects.sort((a, b) => b.name.localeCompare(a.name));

        parseAndAnalyzeObjects(mockObjects, dateStr);

        // Generate comprehensive Mock DAU records covering all 6 time slots
        const allMockDauUsers = [
            ...mockUsers,
            { username: '13866554433', name: '黄子涵', school: '光明实验外国语小学', teacher: '王老师' },
            { username: '13799881122', name: '林浩宇', school: '育才实验示范学校', teacher: '刘老师' },
            { username: '13677889900', name: '徐佳欣', school: '南开实验学校本部', teacher: '赵老师' },
            { username: '13566778899', name: '刘梓萱', school: '朝阳外国语小学分校', teacher: '王老师' },
            { username: '13411223344', name: '郭雨泽', school: '光明实验外国语小学', teacher: '孙老师' },
            { username: '13388990011', name: '马博文', school: '汇文第一寄宿学校', teacher: '李老师' },
            { username: '13244556677', name: '宋嘉怡', school: '育才实验示范学校', teacher: '周老师' },
            { username: '13199001122', name: '郑宇航', school: '南开实验学校本部', teacher: '刘老师' },
            { username: '13022334455', name: '谢依晨', school: '朝阳外国语小学分校', teacher: '张老师' },
            { username: '13911335577', name: '潘梓航', school: '光明实验外国语小学', teacher: '王老师' },
            { username: '13822446688', name: '蔡欣怡', school: '汇文第一寄宿学校', teacher: '李老师' },
            { username: '13733557799', name: '金博睿', school: '育才实验示范学校', teacher: '赵老师' }
        ];

        allMockDauUsers.forEach(u => {
            if (!userToInfoCache[u.username]) {
                userToInfoCache[u.username] = {
                    studentName: u.name,
                    schoolName: u.school,
                    teacherName: u.teacher
                };
            }
        });

        // Specific hours across slots: early (7, 8), morning (9, 10, 11), noon (12, 13), afternoon (14, 15, 16, 17), evening (18, 19, 20, 21), night (22, 23)
        const mockHours = [
            7, 8,
            9, 9, 10, 10, 11, 11,
            12, 12, 13,
            14, 14, 15, 15, 16, 16, 17,
            18, 19, 20, 20, 21,
            22, 23
        ];

        const mockDevices = [
            { dev: 'iPad (第9代)', ver: 'iPadOS 16.6' },
            { dev: '华为 MatePad 11', ver: 'HarmonyOS 3.1' },
            { dev: '小米平板 6 Pro', ver: 'Android 13' },
            { dev: 'iPad Air 5', ver: 'iPadOS 17.2' },
            { dev: '联想小新 Pad Pro', ver: 'Android 12' },
            { dev: '荣耀平板 V8', ver: 'MagicOS 7.0' }
        ];

        dauUsersList = allMockDauUsers.map((u, i) => {
            const h = mockHours[i % mockHours.length];
            const m = Math.floor(Math.random() * 60);
            const s = Math.floor(Math.random() * 60);
            const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            const fullDateStr = `${dateStr} ${timeStr}`;
            const mockDate = new Date(`${dateStr}T${timeStr}`);
            const slotInfo = getTimeSlotInfo(mockDate);
            const relInfo = getRelativeTimeDesc(mockDate);
            const devInfo = mockDevices[i % mockDevices.length];
            const gameSummary = studentSummaryList.find(s => s.username === u.username);

            return {
                key: `usertemp/xuelianxitong/${formattedDate}/user_activity/${u.username}.json`,
                username: u.username,
                studentName: u.name,
                schoolName: u.school,
                deviceName: devInfo.dev,
                platformVersion: devInfo.ver,
                lastModified: mockDate.toISOString(),
                lastTimeDate: mockDate,
                lastTimeStr: fullDateStr,
                hour: h,
                sortKey: fullDateStr,
                timeSlot: slotInfo,
                relativeTime: relInfo,
                gameSummary: gameSummary || null
            };
        });

        dauUsersList.sort((a, b) => b.lastTimeDate.getTime() - a.lastTimeDate.getTime());
        renderTimeSlotSummaryBar();
        renderTimeSlotReportTable();
        renderDistributionDonut();
    }

    function renderLoadingState() {
        if (summaryTableBody) {
            summaryTableBody.innerHTML = `<tr><td colspan="9" class="loading-cell">⏳ 正在从 OSS 检索游戏日志数据并汇总分析...</td></tr>`;
        }
        if (logsTableBody) {
            logsTableBody.innerHTML = `<tr><td colspan="9" class="loading-cell">⏳ 正在从 OSS 检索游戏流水记录...</td></tr>`;
        }
        if (dauTimeSlotTableBody) {
            dauTimeSlotTableBody.innerHTML = `<tr><td colspan="10" class="loading-cell">⏳ 正在从 OSS 检索日活数据并生成时间段报表...</td></tr>`;
        }
    }

    function renderEmptyState() {
        activePlayersCountEl.textContent = '0';
        totalGamesCountEl.textContent = '0';
        fruitSystemCountEl.textContent = '0';
        fruitStoreCountEl.textContent = '0次';
        fruitCuttingCountEl.textContent = '0次';
        cardSystemCountEl.textContent = '0';
        cardAlbumCountEl.textContent = '0次';
        cardGachaCountEl.textContent = '0次';
        eBaoCountEl.textContent = '0';

        if (summaryTableBody) {
            summaryTableBody.innerHTML = `<tr><td colspan="9" class="loading-cell">所选日期暂无任何学生游戏行为记录</td></tr>`;
        }
        if (logsTableBody) {
            logsTableBody.innerHTML = `<tr><td colspan="9" class="loading-cell">所选日期暂无任何学生游戏行为记录</td></tr>`;
        }
        if (dauTimeSlotTableBody) {
            dauTimeSlotTableBody.innerHTML = `<tr><td colspan="10" class="loading-cell">所选日期暂无日活活跃记录</td></tr>`;
        }

        renderCharts();
    }

    // Run on startup
    initDate();
    initOssClient();
    loadDataForDate(reportDateInput.value);
});
