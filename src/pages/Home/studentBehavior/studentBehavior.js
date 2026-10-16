document.addEventListener('DOMContentLoaded', () => {
    // 1. Game & Page Hierarchy Configuration
    const GAME_CONFIGS = {
        'game_center_page': {
            code: 'game_center_page',
            name: '游戏中心',
            systemCode: 'game_center',
            systemName: '游戏中心',
            isSub: false,
            parentName: '',
            color: '#0284c7',
            tagClass: 'game-center',
            icon: '🕹️'
        },
        'fruit_store_page': {
            code: 'fruit_store_page',
            name: '水果商店',
            systemCode: 'fruit',
            systemName: '水果商店系统',
            isSub: false,
            parentName: '',
            color: '#ea580c',
            tagClass: 'fruit-store',
            icon: '🏪'
        },
        'fruit_cutting_page': {
            code: 'fruit_cutting_page',
            name: '切水果',
            systemCode: 'fruit',
            systemName: '水果商店系统',
            isSub: true,
            parentName: '水果商店',
            color: '#f97316',
            tagClass: 'fruit-cutting',
            icon: '🍉'
        },
        'card_album_page': {
            code: 'card_album_page',
            name: '卡册中心',
            systemCode: 'card',
            systemName: '卡册系统',
            isSub: false,
            parentName: '',
            color: '#8b5cf6',
            tagClass: 'card-album',
            icon: '📖'
        },
        'gacha_page': {
            code: 'gacha_page',
            name: '抽卡页面',
            systemCode: 'card',
            systemName: '卡册系统',
            isSub: true,
            parentName: '卡册中心',
            color: '#ec4899',
            tagClass: 'gacha-page',
            icon: '🎴'
        },
        'e_bao_page': {
            code: 'e_bao_page',
            name: 'E宝游戏',
            systemCode: 'ebao',
            systemName: 'E宝游戏',
            isSub: false,
            parentName: '',
            color: '#06b6d4',
            tagClass: 'e-bao',
            icon: '🤖'
        }
    };

    /**
     * 将页面文件名前缀（如 game_center_page, fruit_cutting_page, gacha_page 等）规范化为对应模块 code
     */
    function resolveGameCode(rawCode) {
        if (!rawCode) return 'other';
        const clean = String(rawCode).toLowerCase().trim();

        // 1. 直接匹配已知页面 code
        if (clean === 'game_center_page' || clean === 'game_center') return 'game_center_page';
        if (clean === 'fruit_cutting_page' || clean === 'fruit_cutting') return 'fruit_cutting_page';
        if (clean === 'fruit_store_page' || clean === 'fruit_store') return 'fruit_store_page';
        if (clean === 'gacha_page' || clean === 'gacha' || clean === 'card_gacha' || clean === 'card_gacha_page') return 'gacha_page';
        if (clean === 'card_album_page' || clean === 'card_album') return 'card_album_page';
        if (clean === 'e_bao_page' || clean === 'e_bao' || clean === 'ebao' || clean === 'ebao_page') return 'e_bao_page';

        if (GAME_CONFIGS[clean]) return clean;
        const withPage = clean.endsWith('_page') ? clean : `${clean}_page`;
        if (GAME_CONFIGS[withPage]) return withPage;

        // 2. 常见关键字与别名智能匹配
        if (clean.includes('game') && clean.includes('center')) return 'game_center_page';
        if (clean.includes('fruit') && (clean.includes('cut') || clean.includes('slice'))) return 'fruit_cutting_page';
        if (clean.includes('fruit') && (clean.includes('store') || clean.includes('shop') || clean.includes('market'))) return 'fruit_store_page';
        if (clean.includes('gacha') || (clean.includes('card') && (clean.includes('draw') || clean.includes('lottery')))) return 'gacha_page';
        if (clean.includes('card') && (clean.includes('album') || clean.includes('book'))) return 'card_album_page';
        if (clean.includes('ebao') || clean.includes('e_bao')) return 'e_bao_page';

        return withPage || clean;
    }

    /**
     * 获取模块/游戏对应的配置信息，未预设模块自动生成友好名称与标签
     */
    function getGameConfig(gameCode, rawName) {
        if (GAME_CONFIGS[gameCode]) return GAME_CONFIGS[gameCode];

        const raw = rawName || gameCode || 'other';
        const isSub = raw.endsWith('_page') || raw.includes('sub');
        // 将 snake_case 转换为易读名称
        const formattedName = raw.replace(/_page$/, '')
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

        return {
            code: gameCode,
            name: formattedName || '页面行为',
            systemCode: 'other',
            systemName: '其他页面行为',
            isSub: isSub,
            parentName: '通用页面',
            color: '#6366f1',
            tagClass: 'page-track',
            icon: '📄'
        };
    }

    /**
     * 格式化停留时长 (秒 -> 优雅易读格式)
     */
    function formatDuration(sec) {
        if (sec === undefined || sec === null || sec < 0) return '-';
        const s = Math.round(Number(sec));
        if (s < 60) return `${s}秒`;
        const m = Math.floor(s / 60);
        const rem = s % 60;
        if (m < 60) return rem > 0 ? `${m}分${rem}秒` : `${m}分钟`;
        const hours = Math.floor(s / 3600);
        const remMins = Math.floor((s % 3600) / 60);
        return remMins > 0 ? `${hours}小时${remMins}分` : `${hours}小时`;
    }

    // HTML 转义工具函数
    function escapeHtml(str) {
        if (!str && str !== 0) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    window.escapeHtml = escapeHtml;

    /**
     * 规范化年级显示名称
     */
    function formatGradeName(g) {
        if (!g || g === '-') return '-';
        const map = {
            'oneGrade': '一年级',
            'twoGrade': '二年级',
            'threeGrade': '三年级',
            'fourGrade': '四年级',
            'fiveGrade': '五年级',
            'sixGrade': '六年级',
            'sevenGrade': '初一',
            'eightGrade': '初二',
            'nineGrade': '初三'
        };
        return map[g] || g;
    }

    // DOM Elements
    const reportDateInput = document.getElementById('reportDate');
    const quickDateBtns = document.querySelectorAll('.quick-date-btn');
    const refreshBtn = document.getElementById('refreshBtn');
    const noConfigAlert = document.getElementById('noConfigAlert');

    // Stat Cards Elements
    const activePlayersCountEl = document.getElementById('activePlayersCount');
    const totalGamesCountEl = document.getElementById('totalGamesCount');
    const totalDurationValEl = document.getElementById('totalDurationVal');
    const gameCenterCountEl = document.getElementById('gameCenterCount');
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

    // 4. Fetch Game and Behavior Track Data from OSS
    async function loadDataForDate(dateStr) {
        if (!ossClient) {
            if (!initOssClient()) return;
        }

        const formattedDate = dateStr.replace(/-/g, '_');
        const prefix = `usertemp/xuelianxitong/${formattedDate}/page_track/`;

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

            objects = objects.filter(o => {
                if (!o.name || !o.name.endsWith('.json')) return false;
                const lowerName = o.name.toLowerCase();
                // 排除 anonymous 行为数据 (例如: usertemp/xuelianxitong/{date}/page_track/anonymous/...)
                if (lowerName.includes('/page_track/anonymous/') || lowerName.includes('/anonymous/')) {
                    return false;
                }
                return true;
            });

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
            console.error('Failed to list files from OSS:', e);
            // On network error or empty, fallback
            useStaticMockData();
        }
    }

    /**
     * 将 2026_10_10_163323_288 或 card_album_page_2026_10_08_160346.json 等各类格式转换为标准年月日时分秒
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

        // 1. 处理如 2026_10_10_163323_288 或 2026_10_08_160346
        const mCompact = str.match(/(\d{4})_(\d{2})_(\d{2})_(\d{2})(\d{2})(\d{2})(?:_(\d+))?/);
        if (mCompact) {
            const [_, y, m, d, hh, mm, ss, ms] = mCompact;
            return {
                fullCnTime: `${y}年${m}月${d}日 ${hh}时${mm}分${ss}秒`,
                shortCnTime: `${hh}时${mm}分${ss}秒`,
                timeStr: `${hh}:${mm}:${ss}`,
                hour: parseInt(hh, 10) || 0,
                sortKey: `${y}${m}${d}${hh}${mm}${ss}${ms ? String(ms).padStart(3, '0') : '000'}`
            };
        }

        // 2. 处理 ISO 日期字符串如 2026-10-10T16:33:07.713489
        const mIso = str.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
        if (mIso) {
            const [_, y, m, d, hh, mm, ss] = mIso;
            return {
                fullCnTime: `${y}年${m}月${d}日 ${hh}时${mm}分${ss}秒`,
                shortCnTime: `${hh}时${mm}分${ss}秒`,
                timeStr: `${hh}:${mm}:${ss}`,
                hour: parseInt(hh, 10) || 0,
                sortKey: `${y}${m}${d}${hh}${mm}${ss}000`
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
                    sortKey: `${y}${m}${d}${hh}${mm}${ss}000`
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

    /**
     * 直接从文件名解析页面代码、发生时间与停留时长
     * 新文件名规范: usertemp/xuelianxitong/{date}/page_track/{username}/{pageName}_{YYYY_MM_DD_HHmmss}_{ms}_{durationSec}.json
     * 例如: game_center_page_2026_10_14_145658_472_32.json (时长为 32 秒)
     * 历史文件名规范: gacha_page_2026_10_10_163323_288.json
     */
    function extractPageAndReportTimeFromFileName(fileName, lastModified) {
        if (!fileName) return { rawGameCode: 'page_track', timeInfo: parseReportTime(lastModified), durationSec: 0 };
        const clean = fileName.replace(/\.json$/i, '');

        // 1. 新格式带停留时长: {pageName}_{YYYY}_{MM}_{DD}_{HHmmss}_{ms}_{durationSec}
        // 例如: game_center_page_2026_10_14_145658_472_32.json -> 提取最后数字 32 为 durationSec
        const mWithDuration = clean.match(/^(.*?)_(\d{4}_\d{2}_\d{2}(?:_\d{6}|\d{2}_\d{2}_\d{2}))_(\d+)_(\d+)$/);
        if (mWithDuration) {
            return {
                rawGameCode: mWithDuration[1],
                timeInfo: parseReportTime(`${mWithDuration[2]}_${mWithDuration[3]}`),
                durationSec: parseInt(mWithDuration[4], 10) || 0
            };
        }

        // 2. 原格式: {pageName}_{YYYY}_{MM}_{DD}_{HHmmss}_{ms} 或无毫秒
        const m = clean.match(/^(.*?)_(\d{4}_\d{2}_\d{2}(?:_\d{6}|\d{2}_\d{2}_\d{2})?(?:_\d+)?)$/);
        if (m) {
            return {
                rawGameCode: m[1],
                timeInfo: parseReportTime(m[2]),
                durationSec: 0
            };
        }

        // 3. Fallback: 尝试提取末尾数字作为时长
        let durationSec = 0;
        const lastNumMatch = clean.match(/_(\d+)$/);
        if (lastNumMatch) {
            durationSec = parseInt(lastNumMatch[1], 10) || 0;
        }
        const base = clean.replace(/_\d{4}_\d{2}_\d{2}.*$/, '');
        return {
            rawGameCode: base || 'page_track',
            timeInfo: parseReportTime(clean || lastModified),
            durationSec: durationSec
        };
    }

    // 5. Parse Object Keys into structured game and behavior items
    function parseAndAnalyzeObjects(objects, dateStr) {
        rawObjectsList = [];

        objects.forEach(obj => {
            const key = obj.name;
            if (!key.endsWith('.json')) return;

            const parts = key.split('/');
            const trackIdx = parts.indexOf('page_track');
            if (trackIdx === -1 || parts.length < trackIdx + 3) return;

            // Pattern: usertemp/xuelianxitong/{date}/page_track/{username}/{fileName}.json
            // 例如: usertemp/xuelianxitong/2026_10_10/page_track/13755188999/gacha_page_2026_10_10_163323_288.json
            const username = parts[trackIdx + 1] || 'unknown';
            // 排除 anonymous 匿名行为数据 (例如: .../page_track/anonymous/...)
            if (!username || username.toLowerCase() === 'anonymous') return;
            const fileName = parts[trackIdx + 2] || '';

            // 直接通过文件名识别具体页面、时间及停留时长
            const { rawGameCode, timeInfo, durationSec } = extractPageAndReportTimeFromFileName(fileName, obj.lastModified);
            const gameCode = resolveGameCode(rawGameCode);
            const gameCfg = getGameConfig(gameCode, rawGameCode);
            const userInfo = userToInfoCache[username] || {};

            const item = {
                key: key,
                username: username,
                studentName: userInfo.studentName || '-',
                schoolName: userInfo.schoolName || '-',
                teacherName: userInfo.teacherName || '-',
                grade: userInfo.grade || '-',
                userNo: userInfo.userNo || '-',
                coin: userInfo.coin || null,
                diamondNum: userInfo.diamondNum || null,
                serviceName: userInfo.serviceName || '-',
                deviceName: userInfo.deviceName || '-',
                platformVersion: userInfo.platformVersion || '-',
                gameCode: gameCode,
                gameCfg: gameCfg,
                fileName: fileName,
                fullCnTime: timeInfo.fullCnTime,
                shortCnTime: timeInfo.shortCnTime,
                timeStr: timeInfo.timeStr,
                hour: timeInfo.hour,
                sortKey: timeInfo.sortKey,
                reportTime: timeInfo.fullCnTime,
                durationSec: durationSec || 0,
                durationText: (durationSec && durationSec > 0) ? formatDuration(durationSec) : '-',
                enterTime: null,
                leaveTime: null,
                action: 'page_view',
                pageTitle: gameCfg.name,
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
                    grade: item.grade,
                    userNo: item.userNo,
                    coin: item.coin,
                    diamondNum: item.diamondNum,
                    serviceName: item.serviceName,
                    totalCount: 0,
                    totalDurationSec: 0,
                    gameCenterDurationSec: 0,
                    lastTime: item.fullCnTime || item.timeStr,
                    lastSortKey: item.sortKey || item.timeStr,
                    gameCounts: {
                        game_center_page: 0,
                        fruit_store_page: 0,
                        fruit_cutting_page: 0,
                        card_album_page: 0,
                        gacha_page: 0,
                        e_bao_page: 0
                    }
                };
            }

            studentMap[u].totalCount++;
            studentMap[u].totalDurationSec += (item.durationSec || 0);
            if (item.gameCode === 'game_center_page') {
                studentMap[u].gameCenterDurationSec = (studentMap[u].gameCenterDurationSec || 0) + (item.durationSec || 0);
            }

            if (studentMap[u].gameCounts[item.gameCode] !== undefined) {
                studentMap[u].gameCounts[item.gameCode]++;
            } else {
                studentMap[u].gameCounts[item.gameCode] = (studentMap[u].gameCounts[item.gameCode] || 0) + 1;
            }
            // Keep latest time based on sortKey
            if ((item.sortKey || item.timeStr) > (studentMap[u].lastSortKey || '')) {
                studentMap[u].lastTime = item.fullCnTime || item.timeStr;
                studentMap[u].lastSortKey = item.sortKey || item.timeStr;
            }
        });

        studentSummaryList = Object.values(studentMap).sort((a, b) => {
            const durDiff = (b.gameCenterDurationSec || 0) - (a.gameCenterDurationSec || 0);
            if (durDiff !== 0) return durDiff;
            return (b.totalCount || 0) - (a.totalCount || 0);
        });
    }

    // 7. Render Core Stats Cards
    function renderStats() {
        const activePlayers = studentSummaryList.length;
        const totalGames = rawObjectsList.length;

        let gameCenter = 0;
        let fruitCutting = 0;
        let fruitStore = 0;
        let cardGacha = 0;
        let cardAlbum = 0;
        let eBao = 0;
        let totalDuration = 0;

        rawObjectsList.forEach(it => {
            totalDuration += (it.durationSec || 0);
            if (it.gameCode === 'game_center_page') gameCenter++;
            else if (it.gameCode === 'fruit_cutting_page') fruitCutting++;
            else if (it.gameCode === 'fruit_store_page') fruitStore++;
            else if (it.gameCode === 'gacha_page') cardGacha++;
            else if (it.gameCode === 'card_album_page') cardAlbum++;
            else if (it.gameCode === 'e_bao_page') eBao++;
        });

        const fruitSystem = fruitCutting + fruitStore;
        const cardSystem = cardGacha + cardAlbum;

        if (activePlayersCountEl) activePlayersCountEl.textContent = activePlayers.toLocaleString();
        if (totalGamesCountEl) totalGamesCountEl.textContent = totalGames.toLocaleString();

        const totalDurationEl = document.getElementById('totalDurationVal');
        if (totalDurationEl) {
            totalDurationEl.textContent = totalDuration > 0 ? formatDuration(totalDuration) : '-';
        }

        const gameCenterCountEl = document.getElementById('gameCenterCount');
        if (gameCenterCountEl) gameCenterCountEl.textContent = `${gameCenter}次`;

        if (fruitSystemCountEl) fruitSystemCountEl.textContent = fruitSystem.toLocaleString();
        if (fruitStoreCountEl) fruitStoreCountEl.textContent = `${fruitStore}次`;
        if (fruitCuttingCountEl) fruitCuttingCountEl.textContent = `${fruitCutting}次`;

        if (cardSystemCountEl) cardSystemCountEl.textContent = cardSystem.toLocaleString();
        if (cardAlbumCountEl) cardAlbumCountEl.textContent = `${cardAlbum}次`;
        if (cardGachaCountEl) cardGachaCountEl.textContent = `${cardGacha}次`;

        if (eBaoCountEl) eBaoCountEl.textContent = eBao.toLocaleString();
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

        const chartData = TIME_SLOT_DEFS.map(s => ({
            name: `${s.icon} ${s.name}`,
            value: slotCounts[s.key] || 0,
            slotKey: s.key,
            range: s.range,
            itemStyle: { color: s.color }
        }));

        if (distributionChart && !distributionChart.isDisposed()) {
            distributionChart.dispose();
        }

        const theme = window.ThemeManager ? window.ThemeManager.getTheme() : 'light';
        const colors = window.ThemeManager ? window.ThemeManager.getChartTheme(theme) : {};

        distributionChart = echarts.init(distributionCanvas, theme === 'dark' ? 'dark' : null);

        const totalSlots = chartData.reduce((acc, cur) => acc + cur.value, 0);

        const option = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'item',
                formatter: function (p) {
                    const pct = totalSlots > 0 ? ((p.value / totalSlots) * 100).toFixed(1) : 0;
                    const d = p.data;
                    return `<div style="font-weight: 600; margin-bottom: 4px;">${p.name} [${d.range}]</div>
                            <div>活跃人数: <span style="font-weight: bold;">${p.value}</span> 人 (${pct}%)</div>`;
                }
            },
            legend: {
                bottom: 5,
                icon: 'circle',
                itemWidth: 10,
                itemHeight: 10,
                textStyle: {
                    color: colors.textColor || '#606266',
                    fontSize: 11
                }
            },
            series: [{
                name: '时段分布',
                type: 'pie',
                radius: ['45%', '70%'],
                center: ['50%', '45%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 4,
                    borderColor: theme === 'dark' ? '#131c2e' : '#ffffff',
                    borderWidth: 2
                },
                label: { show: false },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 12,
                        fontWeight: 'bold',
                        color: colors.textColor || '#303133'
                    }
                },
                data: chartData
            }]
        };

        distributionChart.setOption(option);
        distributionChart.on('click', (params) => {
            if (params.data && params.data.slotKey) {
                activateTimeSlotFilter(params.data.slotKey);
            }
        });
    }

    // Line Chart: 24h Hourly Trend with ECharts
    function renderHourlyTrendChart() {
        if (!hourlyTrendCanvas || typeof echarts === 'undefined') return;

        const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
        const hourCounts = new Array(24).fill(0);

        rawObjectsList.forEach(it => {
            if (it.hour >= 0 && it.hour < 24) {
                hourCounts[it.hour]++;
            }
        });

        if (hourlyTrendChart && !hourlyTrendChart.isDisposed()) {
            hourlyTrendChart.dispose();
        }

        const theme = window.ThemeManager ? window.ThemeManager.getTheme() : 'light';
        const colors = window.ThemeManager ? window.ThemeManager.getChartTheme(theme) : {};

        hourlyTrendChart = echarts.init(hourlyTrendCanvas, theme === 'dark' ? 'dark' : null);

        const option = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                formatter: (p) => {
                    const item = p[0];
                    return `<div style="font-weight: 600; margin-bottom: 4px;">${item.name}</div>
                            <div>活跃次数: <span style="font-weight: bold; color: #10b981;">${item.value}</span> 次</div>`;
                }
            },
            grid: {
                top: 25,
                left: 45,
                right: 25,
                bottom: 30
            },
            xAxis: {
                type: 'category',
                data: hours,
                boundaryGap: false,
                axisLine: { lineStyle: { color: colors.borderColor || '#e2e8f0' } },
                axisLabel: { color: colors.textColor || '#909399', fontSize: 11 }
            },
            yAxis: {
                type: 'value',
                minInterval: 1,
                splitLine: { lineStyle: { color: colors.gridColor || '#f3f4f6' } },
                axisLabel: { color: colors.textColor || '#909399', fontSize: 11 }
            },
            series: [{
                name: '游戏游玩次数',
                type: 'line',
                smooth: 0.35,
                symbol: 'circle',
                symbolSize: 6,
                itemStyle: { color: '#10b981' },
                lineStyle: { width: 2.5, color: '#10b981' },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(16, 185, 129, 0.4)' },
                        { offset: 1, color: 'rgba(16, 185, 129, 0.01)' }
                    ])
                },
                data: hourCounts
            }]
        };

        hourlyTrendChart.setOption(option);
    }

    // Bar Chart: Top Students by Game Center Duration with ECharts
    function renderTopStudentsBar() {
        if (!topStudentsCanvas || typeof echarts === 'undefined') return;

        // 按游戏中心累计时长降序取 Top 15
        const top15 = [...studentSummaryList]
            .sort((a, b) => {
                const durDiff = (b.gameCenterDurationSec || 0) - (a.gameCenterDurationSec || 0);
                if (durDiff !== 0) return durDiff;
                return (b.totalCount || 0) - (a.totalCount || 0);
            })
            .slice(0, 15);

        const labels = top15.map(s => s.studentName !== '-' ? s.studentName : s.username);
        // 时长显示成分钟 (秒 / 60，保留1位小数)
        const data = top15.map(s => {
            const sec = s.gameCenterDurationSec || 0;
            return Math.round((sec / 60) * 10) / 10;
        });

        if (topStudentsChart && !topStudentsChart.isDisposed()) {
            topStudentsChart.dispose();
        }

        const theme = window.ThemeManager ? window.ThemeManager.getTheme() : 'light';
        const colors = window.ThemeManager ? window.ThemeManager.getChartTheme(theme) : {};

        topStudentsChart = echarts.init(topStudentsCanvas, theme === 'dark' ? 'dark' : null);

        const option = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: (p) => {
                    const item = p[0];
                    const student = top15[item.dataIndex];
                    const sec = student ? (student.gameCenterDurationSec || 0) : 0;
                    const count = student && student.gameCounts ? (student.gameCounts.game_center_page || 0) : 0;
                    return `<div style="font-weight: 600; margin-bottom: 4px;">${item.name}</div>
                            <div>游戏中心时长: <span style="font-weight: bold; color: #10b981;">${item.value}</span> 分钟 <span style="color:#9ca3af; font-size:11px;">(${sec}秒)</span></div>
                            <div style="font-size: 11px; color: #9ca3af; margin-top: 3px;">游戏中心频次: ${count} 次 (点击查看详情)</div>`;
                }
            },
            grid: {
                top: 15,
                left: 70,
                right: 70,
                bottom: 20
            },
            xAxis: {
                type: 'value',
                name: '分钟',
                nameTextStyle: { color: colors.textColor || '#909399', fontSize: 10 },
                splitLine: { lineStyle: { color: colors.gridColor || '#f3f4f6' } },
                axisLabel: { 
                    color: colors.textColor || '#909399', 
                    fontSize: 10,
                    formatter: '{value} 分'
                }
            },
            yAxis: {
                type: 'category',
                data: labels,
                inverse: true,
                axisLine: { lineStyle: { color: colors.borderColor || '#e2e8f0' } },
                axisLabel: { 
                    color: colors.textColor || '#606266', 
                    fontSize: 10.5,
                    interval: 0
                }
            },
            series: [{
                name: '游戏时长(分钟)',
                type: 'bar',
                barWidth: 12,
                itemStyle: {
                    borderRadius: [0, 4, 4, 0],
                    color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                        { offset: 0, color: '#34d399' },
                        { offset: 1, color: '#10b981' }
                    ])
                },
                emphasis: {
                    itemStyle: { color: '#059669' }
                },
                label: {
                    show: true,
                    position: 'right',
                    formatter: (p) => `${p.value} 分`,
                    color: colors.textColor || '#606266',
                    fontSize: 10.5
                },
                data: data
            }]
        };

        topStudentsChart.setOption(option);
        topStudentsChart.on('click', (params) => {
            if (params.dataIndex >= 0 && params.dataIndex < top15.length) {
                const student = top15[params.dataIndex];
                if (student && student.username) {
                    showUserGameDetail(student.username);
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
                    (s.schoolName && s.schoolName.toLowerCase().includes(query)) ||
                    (s.teacherName && s.teacherName.toLowerCase().includes(query)) ||
                    (s.userNo && s.userNo.toLowerCase().includes(query));

                let matchGame = true;
                if (selectedGame === 'group_fruit') {
                    matchGame = ((s.gameCounts.fruit_cutting_page || 0) + (s.gameCounts.fruit_store_page || 0)) > 0;
                } else if (selectedGame === 'group_card') {
                    matchGame = ((s.gameCounts.gacha_page || 0) + (s.gameCounts.card_album_page || 0)) > 0;
                } else if (selectedGame !== 'all') {
                    matchGame = (s.gameCounts[selectedGame] || 0) > 0;
                }

                return matchQuery && matchGame;
            });

            renderSummaryTable(filteredSummary);
            tableInfo.textContent = `共 ${filteredSummary.length} 位学生参与游戏与页面访问`;
        } else {
            // Filter event logs
            const filteredLogs = rawObjectsList.filter(it => {
                const matchQuery = !query ||
                    it.username.toLowerCase().includes(query) ||
                    (it.studentName && it.studentName.toLowerCase().includes(query)) ||
                    (it.schoolName && it.schoolName.toLowerCase().includes(query)) ||
                    (it.teacherName && it.teacherName.toLowerCase().includes(query)) ||
                    (it.pageTitle && it.pageTitle.toLowerCase().includes(query));

                let matchGame = true;
                if (selectedGame === 'group_fruit') {
                    matchGame = it.gameCfg.systemCode === 'fruit' || it.gameCode === 'fruit_store_page' || it.gameCode === 'fruit_cutting_page';
                } else if (selectedGame === 'group_card') {
                    matchGame = it.gameCfg.systemCode === 'card' || it.gameCode === 'gacha_page' || it.gameCode === 'card_album_page';
                } else if (selectedGame !== 'all') {
                    matchGame = it.gameCode === selectedGame;
                }

                return matchQuery && matchGame;
            });

            renderLogsTable(filteredLogs);
            tableInfo.textContent = `共 ${filteredLogs.length} 条页面行为流水记录`;
        }
    }

    // Render Summary Table (Table 1: 11 Columns)
    function renderSummaryTable(list) {
        if (!summaryTableBody) return;

        if (list.length === 0) {
            summaryTableBody.innerHTML = `<tr><td colspan="11" class="loading-cell">暂无符合条件的学生行为数据</td></tr>`;
            return;
        }

        summaryTableBody.innerHTML = list.map((s, idx) => {
            let pillsHtml = '';
            if (s.gameCounts.game_center_page > 0) {
                pillsHtml += `<span class="pill game-center">🕹️ 游戏中心: ${s.gameCounts.game_center_page}</span>`;
            }
            if (s.gameCounts.fruit_store_page > 0) {
                pillsHtml += `<span class="pill fruit">🏪 水果商店: ${s.gameCounts.fruit_store_page}</span>`;
            }
            if (s.gameCounts.fruit_cutting_page > 0) {
                pillsHtml += `<span class="pill fruit">🍉 切水果: ${s.gameCounts.fruit_cutting_page}</span>`;
            }
            if (s.gameCounts.card_album_page > 0) {
                pillsHtml += `<span class="pill card">📖 卡册: ${s.gameCounts.card_album_page}</span>`;
            }
            if (s.gameCounts.gacha_page > 0) {
                pillsHtml += `<span class="pill card">🎴 抽卡: ${s.gameCounts.gacha_page}</span>`;
            }
            if (s.gameCounts.e_bao_page > 0) {
                pillsHtml += `<span class="pill ebao">🤖 E宝: ${s.gameCounts.e_bao_page}</span>`;
            }

            // 其他页面扩展标签
            Object.keys(s.gameCounts || {}).forEach(k => {
                if (!['game_center_page', 'fruit_store_page', 'fruit_cutting_page', 'card_album_page', 'gacha_page', 'e_bao_page'].includes(k) && s.gameCounts[k] > 0) {
                    const cfg = getGameConfig(k);
                    pillsHtml += `<span class="pill other">${cfg.name}: ${s.gameCounts[k]}</span>`;
                }
            });

            const isSelected = (selectedSummaryUsername && s.username === selectedSummaryUsername);
            const gradeName = formatGradeName(s.grade);
            const gradeHtml = gradeName !== '-' ? `<span class="grade-tag">${escapeHtml(gradeName)}</span>` : '';
            const userNoHtml = s.userNo && s.userNo !== '-' ? `<span class="user-no-tag">No.${escapeHtml(s.userNo)}</span>` : '';

            // 资产与会员
            let assetHtml = [];
            if (s.coin !== null && s.coin !== undefined) assetHtml.push(`<span class="asset-chip coin">🪙 ${s.coin}</span>`);
            if (s.diamondNum !== null && s.diamondNum !== undefined) assetHtml.push(`<span class="asset-chip diamond">💎 ${s.diamondNum}</span>`);
            if (s.serviceName && s.serviceName !== '-') assetHtml.push(`<span class="asset-chip card-type">💳 ${escapeHtml(s.serviceName)}</span>`);
            const assetContent = assetHtml.length > 0 ? assetHtml.join(' ') : '<span style="color:#9ca3af;">-</span>';

            const durationText = s.totalDurationSec > 0 ? `<div style="font-size:11px; color:#10b981; margin-top:2px; white-space:nowrap;">⏱️ ${formatDuration(s.totalDurationSec)}</div>` : '';

            return `
                <tr data-username="${s.username}" class="${isSelected ? 'selected-row' : ''}">
                    <td style="color: #9ca3af; font-weight: 500;">${idx + 1}</td>
                    <td><strong class="mono-font">${s.username}</strong></td>
                    <td class="student-name-val">${s.studentName !== '-' ? escapeHtml(s.studentName) : '<span style="color:#9ca3af;">-</span>'}</td>
                    <td class="school-name-val">${s.schoolName !== '-' ? escapeHtml(s.schoolName) : '<span style="color:#9ca3af;">-</span>'}</td>
                    <td class="teacher-name-val">${s.teacherName !== '-' ? escapeHtml(s.teacherName) : '<span style="color:#9ca3af;">-</span>'}</td>
                    <td class="grade-cell">${gradeHtml} ${userNoHtml}</td>
                    <td class="assets-cell">${assetContent}</td>
                    <td style="text-align: center;">
                        <span class="count-badge">${s.totalCount} 次</span>
                        ${durationText}
                    </td>
                    <td><div class="game-distribution-pills">${pillsHtml}</div></td>
                    <td style="color: #6b7280; font-family: monospace; font-size: 12px;">${s.lastTime || '-'}</td>
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
                e.stopPropagation();
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

    // Render Logs Table (Table 2: 10 Columns)
    function renderLogsTable(list) {
        if (!logsTableBody) return;

        if (list.length === 0) {
            logsTableBody.innerHTML = `<tr><td colspan="10" class="loading-cell">暂无符合条件的行为流水记录</td></tr>`;
            return;
        }

        // Render first 200 items for high performance
        const displayList = list.slice(0, 200);

        if (window.updateVersionColorMapping) {
            window.updateVersionColorMapping(displayList);
        }

        logsTableBody.innerHTML = displayList.map(it => {
            const isSelected = (selectedLogKey && it.key === selectedLogKey);
            const verHtml = window.createVersionBadgeHtml ? window.createVersionBadgeHtml(it.platformVersion) : (it.platformVersion || '-');
            const durationBadge = (it.durationSec > 0)
                ? `<span class="duration-badge ${it.durationSec >= 60 ? 'high' : ''}">⏱️ ${formatDuration(it.durationSec)}</span>`
                : (it.durationText && it.durationText !== '-' ? `<span class="duration-badge">${it.durationText}</span>` : '<span style="color:#9ca3af;">-</span>');

            const subNote = it.gameCfg.isSub ? `<span style="font-size:11px; color:#6b7280; margin-left:4px;">(子页面)</span>` : '';

            return `
                <tr data-key="${it.key}" class="${isSelected ? 'selected-row' : ''}">
                    <td style="color: #4b5563; font-weight: 500; font-family: monospace; white-space: nowrap;">${it.fullCnTime || it.timeStr}</td>
                    <td style="text-align: center; white-space: nowrap;">${durationBadge}</td>
                    <td><strong class="mono-font">${it.username}</strong></td>
                    <td class="student-name-val">${it.studentName !== '-' ? escapeHtml(it.studentName) : '<span style="color:#9ca3af;">-</span>'}</td>
                    <td class="school-name-val">${it.schoolName !== '-' ? escapeHtml(it.schoolName) : '<span style="color:#9ca3af;">-</span>'}</td>
                    <td><span class="system-label">${it.gameCfg.systemName}</span></td>
                    <td>
                        <span class="game-tag ${it.gameCfg.tagClass}">
                            ${it.gameCfg.name}
                        </span>
                        ${subNote}
                    </td>
                    <td class="device-val">${it.deviceName || '-'}</td>
                    <td class="platform-val" style="text-align: center;">${verHtml}</td>
                    <td style="text-align: center;">
                        <button class="action-link open-detail-btn" data-key="${it.key}">详情</button>
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
                e.stopPropagation();
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

        if (window.updateVersionColorMapping) {
            window.updateVersionColorMapping(list);
        }

        dauTimeSlotTableBody.innerHTML = list.map((item, idx) => {
            const isSelected = (selectedSummaryUsername && item.username === selectedSummaryUsername);
            const gameBadge = (item.gameSummary && item.gameSummary.totalCount > 0)
                ? `<span class="game-participate-pill played" title="点击查看该学生游戏详情" data-username="${item.username}">🎮 玩过 ${item.gameSummary.totalCount} 次</span>`
                : `<span class="game-participate-pill none">仅日活未玩游戏</span>`;

            const verBadge = (item.platformVersion && item.platformVersion !== '-')
                ? (window.createVersionBadgeHtml ? window.createVersionBadgeHtml(item.platformVersion) : `<span class="version-badge">${escapeHtml(item.platformVersion)}</span>`)
                : '';
            const devicePart = (item.deviceName && item.deviceName !== '-') ? escapeHtml(item.deviceName) : '';
            const deviceText = (devicePart && verBadge)
                ? `${devicePart} · ${verBadge}`
                : (verBadge || devicePart || '-');

            return `
                <tr data-username="${item.username}" class="${isSelected ? 'selected-row' : ''}">
                    <td style="color: #9ca3af; font-weight: 500;">${idx + 1}</td>
                    <td><strong class="mono-font">${item.username}</strong></td>
                    <td class="student-name-val">${item.studentName !== '-' ? escapeHtml(item.studentName) : '<span style="color:#9ca3af;">-</span>'}</td>
                    <td class="school-name-val">${item.schoolName !== '-' ? escapeHtml(item.schoolName) : '<span style="color:#9ca3af;">-</span>'}</td>
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

        dauTimeSlotTableBody.querySelectorAll('tr[data-username]').forEach(tr => {
            tr.addEventListener('click', () => {
                dauTimeSlotTableBody.querySelectorAll('tr.selected-row').forEach(r => r.classList.remove('selected-row'));
                tr.classList.add('selected-row');
                selectedSummaryUsername = tr.dataset.username;
            });
        });

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

        const usersToFetch = Object.keys(userFirstObjectMap).filter(u => !userToInfoCache[u] || !userToInfoCache[u].grade);
        if (usersToFetch.length === 0) return;

        const concurrency = 12;
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

                        // 提取学生上报内容中的具体行为与学生信息
                        const studentInfo = data.studentInfo || {};
                        const pageTrack = data.pageTrack || {};

                        // 更新 sampleItem 自身字段
                        if (pageTrack.durationSec !== undefined) {
                            sampleItem.durationSec = Number(pageTrack.durationSec) || 0;
                            sampleItem.durationText = formatDuration(sampleItem.durationSec);
                        }
                        if (pageTrack.pageTitle) sampleItem.pageTitle = pageTrack.pageTitle;
                        if (pageTrack.action) sampleItem.action = pageTrack.action;
                        if (pageTrack.enterTime) sampleItem.enterTime = pageTrack.enterTime;
                        if (pageTrack.leaveTime) sampleItem.leaveTime = pageTrack.leaveTime;

                        const name = studentInfo.nickName || data.nickName || studentInfo.name || data.userName || studentInfo.userName || '';
                        const school = studentInfo.shopName || data.shopName || studentInfo.schoolName || data.schoolName || '';
                        const teacher = studentInfo.teacherName || data.teacherName || '';
                        const grade = studentInfo.grade || data.grade || '';
                        const userNo = studentInfo.userNo || data.userNo || '';
                        const coin = studentInfo.coin !== undefined ? studentInfo.coin : (data.coin !== undefined ? data.coin : null);
                        const diamondNum = studentInfo.diamondNum !== undefined ? studentInfo.diamondNum : (data.diamondNum !== undefined ? data.diamondNum : null);
                        const serviceName = studentInfo.serviceName || data.serviceName || '';
                        const deviceName = data.deviceName || studentInfo.deviceName || '-';
                        const platformVersion = data.phonePlatformVersion || data.versionName || studentInfo.phonePlatformVersion || '-';

                        const info = {
                            studentName: name || '-',
                            schoolName: school || '-',
                            teacherName: teacher || '-',
                            grade: grade || '-',
                            userNo: userNo || '-',
                            coin: coin,
                            diamondNum: diamondNum,
                            serviceName: serviceName || '-',
                            deviceName: deviceName,
                            platformVersion: platformVersion
                        };

                        userToInfoCache[u] = info;
                        updateUserCells(u, info);
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
        renderStats();
    }

    function updateUserCells(username, info) {
        // Update rawObjectsList
        rawObjectsList.forEach(it => {
            if (it.username === username) {
                if (info.studentName && info.studentName !== '-') it.studentName = info.studentName;
                if (info.schoolName && info.schoolName !== '-') it.schoolName = info.schoolName;
                if (info.teacherName && info.teacherName !== '-') it.teacherName = info.teacherName;
                if (info.grade && info.grade !== '-') it.grade = info.grade;
                if (info.userNo && info.userNo !== '-') it.userNo = info.userNo;
                if (info.coin !== null && info.coin !== undefined) it.coin = info.coin;
                if (info.diamondNum !== null && info.diamondNum !== undefined) it.diamondNum = info.diamondNum;
                if (info.serviceName && info.serviceName !== '-') it.serviceName = info.serviceName;
                if (info.deviceName && info.deviceName !== '-') it.deviceName = info.deviceName;
                if (info.platformVersion && info.platformVersion !== '-') it.platformVersion = info.platformVersion;
            }
        });

        // Update studentSummaryList
        studentSummaryList.forEach(s => {
            if (s.username === username) {
                if (info.studentName && info.studentName !== '-') s.studentName = info.studentName;
                if (info.schoolName && info.schoolName !== '-') s.schoolName = info.schoolName;
                if (info.teacherName && info.teacherName !== '-') s.teacherName = info.teacherName;
                if (info.grade && info.grade !== '-') s.grade = info.grade;
                if (info.userNo && info.userNo !== '-') s.userNo = info.userNo;
                if (info.coin !== null && info.coin !== undefined) s.coin = info.coin;
                if (info.diamondNum !== null && info.diamondNum !== undefined) s.diamondNum = info.diamondNum;
                if (info.serviceName && info.serviceName !== '-') s.serviceName = info.serviceName;
            }
        });

        // Update dauUsersList
        dauUsersList.forEach(u => {
            if (u.username === username) {
                if (info.studentName && info.studentName !== '-') u.studentName = info.studentName;
                if (info.schoolName && info.schoolName !== '-') u.schoolName = info.schoolName;
                if (info.deviceName && info.deviceName !== '-') u.deviceName = info.deviceName;
                if (info.platformVersion && info.platformVersion !== '-') u.platformVersion = info.platformVersion;
            }
        });

        // Live update DOM cells in Summary Table
        const summaryRows = summaryTableBody.querySelectorAll(`tr[data-username="${username}"]`);
        summaryRows.forEach(row => {
            const nameCell = row.querySelector('.student-name-val');
            const schoolCell = row.querySelector('.school-name-val');
            const teacherCell = row.querySelector('.teacher-name-val');
            const gradeCell = row.querySelector('.grade-cell');
            const assetsCell = row.querySelector('.assets-cell');

            if (nameCell && info.studentName && info.studentName !== '-') nameCell.textContent = info.studentName;
            if (schoolCell && info.schoolName && info.schoolName !== '-') schoolCell.textContent = info.schoolName;
            if (teacherCell && info.teacherName && info.teacherName !== '-') teacherCell.textContent = info.teacherName;

            if (gradeCell) {
                const gradeName = formatGradeName(info.grade);
                const gTag = gradeName !== '-' ? `<span class="grade-tag">${escapeHtml(gradeName)}</span>` : '';
                const uTag = info.userNo && info.userNo !== '-' ? `<span class="user-no-tag">No.${escapeHtml(info.userNo)}</span>` : '';
                gradeCell.innerHTML = `${gTag} ${uTag}`;
            }

            if (assetsCell) {
                let assetHtml = [];
                if (info.coin !== null && info.coin !== undefined) assetHtml.push(`<span class="asset-chip coin">🪙 ${info.coin}</span>`);
                if (info.diamondNum !== null && info.diamondNum !== undefined) assetHtml.push(`<span class="asset-chip diamond">💎 ${info.diamondNum}</span>`);
                if (info.serviceName && info.serviceName !== '-') assetHtml.push(`<span class="asset-chip card-type">💳 ${escapeHtml(info.serviceName)}</span>`);
                assetsCell.innerHTML = assetHtml.length > 0 ? assetHtml.join(' ') : '<span style="color:#9ca3af;">-</span>';
            }
        });

        // Live update DOM cells in Logs Table
        const logRows = logsTableBody.querySelectorAll('tr');
        logRows.forEach(row => {
            const k = row.dataset.key;
            if (k && k.includes(`/${username}/`)) {
                const nameCell = row.querySelector('.student-name-val');
                const schoolCell = row.querySelector('.school-name-val');
                const deviceCell = row.querySelector('.device-val');
                if (nameCell && info.studentName && info.studentName !== '-') nameCell.textContent = info.studentName;
                if (schoolCell && info.schoolName && info.schoolName !== '-') schoolCell.textContent = info.schoolName;
                if (deviceCell && info.deviceName && info.deviceName !== '-') deviceCell.textContent = info.deviceName;
            }
        });

        // Live update DOM cells in DAU Table
        if (dauTimeSlotTableBody) {
            const dauRows = dauTimeSlotTableBody.querySelectorAll(`tr[data-username="${username}"]`);
            dauRows.forEach(row => {
                const nameCell = row.querySelector('.student-name-val');
                const schoolCell = row.querySelector('.school-name-val');
                if (nameCell && info.studentName && info.studentName !== '-') nameCell.textContent = info.studentName;
                if (schoolCell && info.schoolName && info.schoolName !== '-') schoolCell.textContent = info.schoolName;
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

            objs = objs.filter(o => {
                if (!o.name || o.name.endsWith('/')) return false;
                const lower = o.name.toLowerCase();
                // 排除 anonymous
                return !lower.includes('/anonymous/') && !lower.endsWith('/anonymous.json');
            });

            // Fallback scan if subfolder structure is used
            if (objs.length === 0) {
                const fullRes = await ossClient.list({
                    prefix: `usertemp/xuelianxitong/${formattedDate}/`,
                    'max-keys': 1000
                });
                const fullObjs = fullRes.objects || [];
                objs = fullObjs.filter(obj => {
                    if (!obj.name || !obj.name.includes('/user_activity/') || obj.name.endsWith('/')) return false;
                    const lower = obj.name.toLowerCase();
                    return !lower.includes('/anonymous/') && !lower.endsWith('/anonymous.json');
                });
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

                // 关联当前学生的行为统计
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
            }).filter(u => u && u.username && u.username.toLowerCase() !== 'anonymous');

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
    function hideUserGameDetailView() {
        if (userDetailContainer && dashboardContainer) {
            userDetailContainer.style.display = 'none';
            dashboardContainer.style.display = 'flex';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    if (backToListBtn) {
        backToListBtn.addEventListener('click', () => {
            if (history.state && history.state.studentBehaviorView === 'detail') {
                history.back();
            } else {
                hideUserGameDetailView();
            }
        });
    }

    // 监听浏览器后退/前进按钮，实现学生详情与列表视图无缝切换
    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.studentBehaviorView === 'detail' && e.state.username) {
            showUserGameDetail(e.state.username, true);
        } else {
            hideUserGameDetailView();
        }
    });

    async function showUserGameDetail(username, skipPushState = false) {
        if (!userDetailContainer || !dashboardContainer) return;

        if (!skipPushState) {
            try {
                history.pushState(
                    { studentBehaviorView: 'detail', username: username },
                    '',
                    '#student=' + encodeURIComponent(username)
                );
            } catch (_) { }
        }

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
            grade: userToInfoCache[username]?.grade || '-',
            userNo: userToInfoCache[username]?.userNo || '-',
            coin: userToInfoCache[username]?.coin || null,
            diamondNum: userToInfoCache[username]?.diamondNum || null,
            serviceName: userToInfoCache[username]?.serviceName || '-',
            totalCount: userItems.length,
            totalDurationSec: 0,
            gameCounts: {
                game_center_page: 0,
                fruit_store_page: 0,
                fruit_cutting_page: 0,
                card_album_page: 0,
                gacha_page: 0,
                e_bao_page: 0
            }
        };

        const info = userToInfoCache[username] || {};
        const displayName = info.studentName || userSummary.studentName || username;
        if (detailStudentName) detailStudentName.textContent = displayName !== '-' ? displayName : username;
        if (detailUsername) detailUsername.textContent = `@${username}`;
        if (detailAvatar) detailAvatar.textContent = (displayName !== '-' && displayName.length > 0) ? displayName.slice(0, 1) : '学';

        const detailUserNo = document.getElementById('detailUserNo');
        if (detailUserNo) {
            detailUserNo.textContent = info.userNo && info.userNo !== '-' ? `No.${info.userNo}` : 'No.-';
        }

        const detailGrade = document.getElementById('detailGrade');
        if (detailGrade) {
            detailGrade.textContent = formatGradeName(info.grade || userSummary.grade);
        }

        if (detailSchoolName) detailSchoolName.textContent = info.schoolName || userSummary.schoolName || '-';
        if (detailTeacherName) detailTeacherName.textContent = info.teacherName || userSummary.teacherName || '-';

        const detailServiceName = document.getElementById('detailServiceName');
        if (detailServiceName) {
            detailServiceName.textContent = info.serviceName || userSummary.serviceName || '普通学员';
        }

        const detailCoin = document.getElementById('detailCoin');
        if (detailCoin) {
            detailCoin.textContent = (info.coin !== null && info.coin !== undefined) ? info.coin : (userSummary.coin !== null && userSummary.coin !== undefined ? userSummary.coin : '-');
        }

        const detailDiamond = document.getElementById('detailDiamond');
        if (detailDiamond) {
            detailDiamond.textContent = (info.diamondNum !== null && info.diamondNum !== undefined) ? info.diamondNum : (userSummary.diamondNum !== null && userSummary.diamondNum !== undefined ? userSummary.diamondNum : '-');
        }

        // Count totals
        const gameCenterTotal = userSummary.gameCounts.game_center_page || 0;
        const fruitTotal = (userSummary.gameCounts.fruit_store_page || 0) + (userSummary.gameCounts.fruit_cutting_page || 0);
        const cardTotal = (userSummary.gameCounts.card_album_page || 0) + (userSummary.gameCounts.gacha_page || 0);
        const ebaoTotal = userSummary.gameCounts.e_bao_page || 0;

        if (detailTotalCount) detailTotalCount.textContent = userSummary.totalCount || userItems.length;

        // 核心规则：学生行为详情页面中时长通过计算各模块数据中 durationSec 这个值来统计
        let gameCenterDuration = 0;
        let fruitStoreDuration = 0;
        let cardAlbumDuration = 0;
        let ebaoDuration = 0;

        userItems.forEach(it => {
            if (it.gameCode === 'game_center_page') {
                gameCenterDuration += (it.durationSec || 0);
            } else if (it.gameCode === 'fruit_store_page') {
                fruitStoreDuration += (it.durationSec || 0);
            } else if (it.gameCode === 'card_album_page') {
                cardAlbumDuration += (it.durationSec || 0);
            } else if (it.gameCode === 'e_bao_page') {
                ebaoDuration += (it.durationSec || 0);
            }
        });

        const detailTotalDuration = document.getElementById('detailTotalDuration');
        if (detailTotalDuration) {
            detailTotalDuration.textContent = gameCenterDuration > 0 ? formatDuration(gameCenterDuration) : '0秒';
        }

        const detailGameCenterCount = document.getElementById('detailGameCenterCount');
        if (detailGameCenterCount) detailGameCenterCount.textContent = `${gameCenterTotal}次`;

        if (detailFruitCount) {
            const fruitDurText = fruitStoreDuration > 0 ? ` · ⏱️${formatDuration(fruitStoreDuration)}` : '';
            detailFruitCount.innerHTML = `${fruitTotal}次 <span style="font-size:12px; font-weight:normal; color:#6b7280;">(商店:${userSummary.gameCounts.fruit_store_page || 0} / 切水果:${userSummary.gameCounts.fruit_cutting_page || 0}${fruitDurText})</span>`;
        }
        if (detailCardCount) {
            const cardDurText = cardAlbumDuration > 0 ? ` · ⏱️${formatDuration(cardAlbumDuration)}` : '';
            detailCardCount.innerHTML = `${cardTotal}次 <span style="font-size:12px; font-weight:normal; color:#6b7280;">(卡册:${userSummary.gameCounts.card_album_page || 0} / 抽卡:${userSummary.gameCounts.gacha_page || 0}${cardDurText})</span>`;
        }
        if (detailEbaoCount) {
            const ebaoDurText = ebaoDuration > 0 ? ` · ⏱️${formatDuration(ebaoDuration)}` : '';
            detailEbaoCount.innerHTML = `${ebaoTotal}次 <span style="font-size:12px; font-weight:normal; color:#6b7280;">${ebaoDurText}</span>`;
        }

        // 1. Render Flowchart (sorted ascending: earliest to latest)
        const sortedItems = [...userItems].sort((a, b) => (a.sortKey || a.timeStr || '').localeCompare(b.sortKey || b.timeStr || ''));
        renderFlowchart(sortedItems);

        // 2. Render Single User Game Logs Table (sorted descending: latest first)
        const descItems = [...userItems].sort((a, b) => (b.sortKey || b.timeStr || '').localeCompare(a.sortKey || a.timeStr || ''));
        renderUserLogsTable(descItems);

        // 3. 异步补充拉取该学生所有的未解析详情文件，以补齐停留时长与具体上报信息
        resolveUserSpecificLogsAsync(username, userItems);
    }

    // 为单学生详情异步拉取剩余文件内容
    async function resolveUserSpecificLogsAsync(username, userItems) {
        if (!ossClient) return;
        const pendingItems = userItems.filter(it => !it.parsedData);

        if (pendingItems.length > 0) {
            // 优先并发读取游戏中心(game_center_page)的文件
            pendingItems.sort((a, b) => (b.gameCode === 'game_center_page' ? 1 : 0) - (a.gameCode === 'game_center_page' ? 1 : 0));

            const concurrency = 8;
            let index = 0;

            async function worker() {
                while (index < pendingItems.length) {
                    const item = pendingItems[index++];
                    try {
                        const res = await ossClient.get(item.key);
                        const contentStr = res.content ? res.content.toString() : '';
                        if (contentStr) {
                            const parsed = JSON.parse(contentStr);
                            item.parsedData = parsed;
                            const data = Array.isArray(parsed) ? (parsed[0] || {}) : parsed;
                            const pageTrack = data.pageTrack || {};
                            if (pageTrack.durationSec !== undefined) {
                                item.durationSec = Number(pageTrack.durationSec) || 0;
                                item.durationText = formatDuration(item.durationSec);
                            }
                            if (pageTrack.pageTitle) item.pageTitle = pageTrack.pageTitle;
                            if (pageTrack.action) item.action = pageTrack.action;
                            if (pageTrack.enterTime) item.enterTime = pageTrack.enterTime;
                            if (pageTrack.leaveTime) item.leaveTime = pageTrack.leaveTime;

                            const studentInfo = data.studentInfo || {};
                            if (studentInfo.coin !== undefined) item.coin = studentInfo.coin;
                            if (studentInfo.diamondNum !== undefined) item.diamondNum = studentInfo.diamondNum;
                            if (studentInfo.serviceName) item.serviceName = studentInfo.serviceName;
                            if (studentInfo.grade) item.grade = studentInfo.grade;
                            if (studentInfo.userNo) item.userNo = studentInfo.userNo;
                            if (data.deviceName) item.deviceName = data.deviceName;
                            if (data.phonePlatformVersion) item.platformVersion = data.phonePlatformVersion;
                        }
                    } catch (e) {
                        // Ignore single item error
                    }
                }
            }

            const workers = [];
            for (let i = 0; i < Math.min(concurrency, pendingItems.length); i++) {
                workers.push(worker());
            }
            await Promise.all(workers);
        }

        // 核心规则：学生行为详情页面中时长统计更新
        let gameCenterDuration = 0;
        let fruitStoreDuration = 0;
        let cardAlbumDuration = 0;
        let ebaoDuration = 0;
        let totalDuration = 0;

        userItems.forEach(it => {
            totalDuration += (it.durationSec || 0);
            if (it.gameCode === 'game_center_page') {
                gameCenterDuration += (it.durationSec || 0);
            } else if (it.gameCode === 'fruit_store_page') {
                fruitStoreDuration += (it.durationSec || 0);
            } else if (it.gameCode === 'card_album_page') {
                cardAlbumDuration += (it.durationSec || 0);
            } else if (it.gameCode === 'e_bao_page') {
                ebaoDuration += (it.durationSec || 0);
            }
        });

        const userSummary = studentSummaryList.find(s => s.username === username);
        if (userSummary) {
            userSummary.totalDurationSec = totalDuration;
            userSummary.gameCenterDurationSec = gameCenterDuration;
        }

        const detailTotalDuration = document.getElementById('detailTotalDuration');
        if (detailTotalDuration) {
            detailTotalDuration.textContent = gameCenterDuration > 0 ? formatDuration(gameCenterDuration) : '0秒';
        }

        if (detailFruitCount && userSummary) {
            const fruitDurText = fruitStoreDuration > 0 ? ` · ⏱️${formatDuration(fruitStoreDuration)}` : '';
            detailFruitCount.innerHTML = `${(userSummary.gameCounts.fruit_store_page || 0) + (userSummary.gameCounts.fruit_cutting_page || 0)}次 <span style="font-size:12px; font-weight:normal; color:#6b7280;">(商店:${userSummary.gameCounts.fruit_store_page || 0} / 切水果:${userSummary.gameCounts.fruit_cutting_page || 0}${fruitDurText})</span>`;
        }
        if (detailCardCount && userSummary) {
            const cardDurText = cardAlbumDuration > 0 ? ` · ⏱️${formatDuration(cardAlbumDuration)}` : '';
            detailCardCount.innerHTML = `${(userSummary.gameCounts.card_album_page || 0) + (userSummary.gameCounts.gacha_page || 0)}次 <span style="font-size:12px; font-weight:normal; color:#6b7280;">(卡册:${userSummary.gameCounts.card_album_page || 0} / 抽卡:${userSummary.gameCounts.gacha_page || 0}${cardDurText})</span>`;
        }
        if (detailEbaoCount && userSummary) {
            const ebaoDurText = ebaoDuration > 0 ? ` · ⏱️${formatDuration(ebaoDuration)}` : '';
            detailEbaoCount.innerHTML = `${userSummary.gameCounts.e_bao_page || 0}次 <span style="font-size:12px; font-weight:normal; color:#6b7280;">${ebaoDurText}</span>`;
        }

        const sortedItems = [...userItems].sort((a, b) => (a.sortKey || a.timeStr || '').localeCompare(b.sortKey || b.timeStr || ''));
        renderFlowchart(sortedItems);
        const descItems = [...userItems].sort((a, b) => (b.sortKey || b.timeStr || '').localeCompare(a.sortKey || a.timeStr || ''));
        renderUserLogsTable(descItems);
    }

    // 渲染时序流程图 (4条线路：游戏中心、水果商店、卡册系统、E宝/其他)
    function renderFlowchart(items) {
        if (!flowchartTracks) return;

        if (items.length === 0) {
            flowchartTracks.innerHTML = `<div style="padding: 30px; text-align: center; color: #9ca3af; font-size: 13px; background: #fafafa; border-radius: 8px;">该学生在所选日期暂无行为记录</div>`;
            return;
        }

        // 分组为四大独立业务线路：
        // 0. 游戏中心主入口
        const gameCenterItems = items.filter(it => it.gameCode === 'game_center_page' || it.gameCfg.systemCode === 'game_center');
        // 1. 水果商店系统 (含水果商店主页及切水果核心玩法)
        const fruitItems = items.filter(it => it.gameCfg.systemCode === 'fruit' || it.gameCode === 'fruit_store_page' || it.gameCode === 'fruit_cutting_page');
        // 2. 卡册系统 (含卡册主页及抽卡玩法)
        const cardItems = items.filter(it => it.gameCfg.systemCode === 'card' || it.gameCode === 'card_album_page' || it.gameCode === 'gacha_page');
        // 3. E宝与其他游戏
        const otherItems = items.filter(it =>
            it.gameCode !== 'game_center_page' &&
            it.gameCfg.systemCode !== 'fruit' && it.gameCode !== 'fruit_store_page' && it.gameCode !== 'fruit_cutting_page' &&
            it.gameCfg.systemCode !== 'card' && it.gameCode !== 'card_album_page' && it.gameCode !== 'gacha_page'
        );

        // 各线路时长统计规则：
        // 0. 游戏中心主入口：累加所有 game_center_page 文件的时长
        let gameCenterDuration = 0;
        gameCenterItems.forEach(it => {
            if (it.gameCode === 'game_center_page') {
                gameCenterDuration += (it.durationSec || 0);
            }
        });

        // 1. 水果商店系统：统计水果商店 (fruit_store_page) 文件的时长加起来
        let fruitStoreDuration = 0;
        fruitItems.forEach(it => {
            if (it.gameCode === 'fruit_store_page') {
                fruitStoreDuration += (it.durationSec || 0);
            }
        });

        // 2. 卡册系统：统计卡册中心 (card_album_page) 文件的时长加起来
        let cardAlbumDuration = 0;
        cardItems.forEach(it => {
            if (it.gameCode === 'card_album_page') {
                cardAlbumDuration += (it.durationSec || 0);
            }
        });

        // 3. E宝与其它游戏：直接统计该线路下所有页面的时长
        let otherDuration = 0;
        otherItems.forEach(it => {
            otherDuration += (it.durationSec || 0);
        });

        const trackConfigs = [
            {
                code: 'game_center',
                title: '🕹️ 线路一：游戏中心入口',
                subtag: '包含：游戏中心主页导航与模块选择',
                cssClass: 'game-center-track',
                items: gameCenterItems,
                durationSec: gameCenterDuration,
                durationLabel: '游戏中心时长'
            },
            {
                code: 'fruit',
                title: '🍎 线路二：水果商店系统',
                subtag: '包含：水果商店主页、切水果 (核心玩法)',
                cssClass: 'fruit-track',
                items: fruitItems,
                durationSec: fruitStoreDuration,
                durationLabel: '水果商店时长'
            },
            {
                code: 'card',
                title: '🎴 线路三：卡册系统',
                subtag: '包含：卡册中心主页、抽卡页面 (抽卡玩法)',
                cssClass: 'card-track',
                items: cardItems,
                durationSec: cardAlbumDuration,
                durationLabel: '卡册中心时长'
            },
            {
                code: 'other',
                title: '🤖 线路四：E宝与其它游戏',
                subtag: '包含：E宝独立答题与拓展页面',
                cssClass: 'ebao-track',
                items: otherItems,
                durationSec: otherDuration,
                durationLabel: 'E宝游戏时长'
            }
        ];

        // 核心规则：有记录才显示，无记录不显示
        const visibleTracks = trackConfigs.filter(t => t.items.length > 0);

        if (visibleTracks.length === 0) {
            flowchartTracks.innerHTML = `<div style="padding: 30px; text-align: center; color: #9ca3af; font-size: 13px; background: #fafafa; border-radius: 8px;">该学生在所选日期暂无任何行为记录</div>`;
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

                let actionIcon = '🎮';
                if (it.gameCode === 'game_center_page') actionIcon = '🕹️';
                else if (it.gameCode === 'fruit_cutting_page') actionIcon = '🍉';
                else if (it.gameCode === 'fruit_store_page') actionIcon = '🏪';
                else if (it.gameCode === 'gacha_page') actionIcon = '🎴';
                else if (it.gameCode === 'card_album_page') actionIcon = '📖';
                else if (it.gameCode === 'e_bao_page') actionIcon = '🤖';

                const subBadge = it.gameCfg.isSub ? `<span style="font-size: 11px; background: rgba(0,0,0,0.06); padding: 2px 6px; border-radius: 4px; margin-left: 6px; font-weight: normal;">子页面</span>` : '';
                const durationPill = (it.durationSec > 0)
                    ? `<div style="font-size:11px; font-weight:600; color:#10b981; margin-top:2px;">⏱️ 停留: ${formatDuration(it.durationSec)}</div>`
                    : '';

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
                        ${durationPill}
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
                            <span class="track-duration-pill" title="${track.durationLabel}">⏱️ ${track.durationLabel}: <strong>${formatDuration(track.durationSec)}</strong></span>
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

    // Render User Logs Table (Table in Profile View: 9 Columns)
    function renderUserLogsTable(items) {
        if (!userLogsTableBody) return;

        if (userLogsCountText) {
            userLogsCountText.textContent = `共 ${items.length} 条记录`;
        }

        if (items.length === 0) {
            userLogsTableBody.innerHTML = `<tr><td colspan="9" class="loading-cell">暂无记录</td></tr>`;
            return;
        }

        if (window.updateVersionColorMapping) {
            window.updateVersionColorMapping(items);
        }

        userLogsTableBody.innerHTML = items.map((it, idx) => {
            const subNote = it.gameCfg.isSub ? `属于【${it.gameCfg.parentName}】子页面` : '系统主入口';
            const isSelected = (selectedUserLogKey && it.key === selectedUserLogKey);
            const verHtml = window.createVersionBadgeHtml ? window.createVersionBadgeHtml(it.platformVersion) : (it.platformVersion || '-');
            const durationBadge = (it.durationSec > 0)
                ? `<span class="duration-badge ${it.durationSec >= 60 ? 'high' : ''}">⏱️ ${formatDuration(it.durationSec)}</span>`
                : (it.durationText && it.durationText !== '-' ? `<span class="duration-badge">${it.durationText}</span>` : '<span style="color:#9ca3af;">-</span>');

            return `
                <tr data-key="${it.key}" class="${isSelected ? 'selected-row' : ''}">
                    <td style="color: #9ca3af; font-weight: 500;">${idx + 1}</td>
                    <td style="color: #1f2937; font-weight: 600; font-family: monospace; white-space: nowrap;">${it.fullCnTime || it.timeStr}</td>
                    <td style="text-align: center; white-space: nowrap;">${durationBadge}</td>
                    <td><span class="system-label">${it.gameCfg.systemName}</span></td>
                    <td>
                        <span class="game-tag ${it.gameCfg.tagClass}">
                            ${it.gameCfg.name}
                        </span>
                    </td>
                    <td style="color: #6b7280; font-size: 12px;">${subNote}</td>
                    <td>${it.deviceName || '-'}</td>
                    <td style="text-align: center;">${verHtml}</td>
                    <td style="text-align: center;">
                        <button class="action-link user-log-detail-btn" data-key="${it.key}">详情</button>
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
                e.stopPropagation();
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

        const enterStr = item.enterTime ? item.enterTime.replace('T', ' ') : '-';
        const leaveStr = item.leaveTime ? item.leaveTime.replace('T', ' ') : '-';

        modalMetaGrid.innerHTML = `
            <div class="meta-item"><span class="meta-label">学生账号</span><span class="meta-val mono-font">${item.username}</span></div>
            <div class="meta-item"><span class="meta-label">学生姓名</span><span class="meta-val">${item.studentName || '-'}</span></div>
            <div class="meta-item"><span class="meta-label">所属学校</span><span class="meta-val">${item.schoolName || '-'}</span></div>
            <div class="meta-item"><span class="meta-label">所属年级</span><span class="meta-val">${formatGradeName(item.grade)}</span></div>
            <div class="meta-item"><span class="meta-label">学员编号</span><span class="meta-val">${item.userNo !== '-' ? item.userNo : '-'}</span></div>
            <div class="meta-item"><span class="meta-label">指导老师</span><span class="meta-val">${item.teacherName || '-'}</span></div>
            <div class="meta-item"><span class="meta-label">归属系统</span><span class="meta-val">${item.gameCfg.systemName}</span></div>
            <div class="meta-item"><span class="meta-label">页面名称</span><span class="meta-val">${item.pageTitle || item.gameCfg.name}</span></div>
            <div class="meta-item"><span class="meta-label">停留时长</span><span class="meta-val" style="color: #10b981; font-weight: bold;">${item.durationSec > 0 ? formatDuration(item.durationSec) : (item.durationText || '-')}</span></div>
            <div class="meta-item"><span class="meta-label">进入时间</span><span class="meta-val" style="font-size: 11px;">${enterStr}</span></div>
            <div class="meta-item"><span class="meta-label">离开时间</span><span class="meta-val" style="font-size: 11px;">${leaveStr}</span></div>
            <div class="meta-item"><span class="meta-label">设备/版本</span><span class="meta-val">${item.deviceName || '-'} (${item.platformVersion || '-'})</span></div>
            <div class="meta-item" style="grid-column: 1 / -1;"><span class="meta-label">文件路径</span><span class="meta-val mono-font" style="word-break: break-all; font-size: 11px;">${item.key}</span></div>
        `;

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

        function renderJsonContent(data) {
            if (!data) {
                modalJsonPre.textContent = '-';
                return;
            }
            try {
                const str = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
                modalJsonPre.innerHTML = syntaxHighlightJson(str);
            } catch (e) {
                modalJsonPre.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
            }
        }

        modalJsonPre.textContent = '⏳ 正在加载原始上报文件内容...';
        detailModal.style.display = 'flex';

        if (item.parsedData) {
            renderJsonContent(item.parsedData);
            return;
        }

        if (ossClient) {
            try {
                const res = await ossClient.get(item.key);
                const str = res.content ? res.content.toString() : '';
                item.parsedData = JSON.parse(str);
                const data = Array.isArray(item.parsedData) ? (item.parsedData[0] || {}) : item.parsedData;
                const pageTrack = data.pageTrack || {};
                if (pageTrack.durationSec !== undefined) {
                    item.durationSec = Number(pageTrack.durationSec) || 0;
                    item.durationText = formatDuration(item.durationSec);
                }
                if (pageTrack.enterTime) item.enterTime = pageTrack.enterTime;
                if (pageTrack.leaveTime) item.leaveTime = pageTrack.leaveTime;
                renderJsonContent(item.parsedData);
            } catch (e) {
                modalJsonPre.textContent = `读取失败: ${e.message}`;
            }
        } else {
            renderJsonContent(item);
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
                '年级': formatGradeName(s.grade),
                '学员编号': s.userNo,
                '学校/校区': s.schoolName,
                '教学老师': s.teacherName,
                '会员卡类型': s.serviceName,
                '金币': s.coin !== null && s.coin !== undefined ? s.coin : '-',
                '钻石': s.diamondNum !== null && s.diamondNum !== undefined ? s.diamondNum : '-',
                '总行为次数': s.totalCount,
                '累计停留时长': s.totalDurationSec > 0 ? formatDuration(s.totalDurationSec) : '0秒',
                '游戏中心次数': s.gameCounts.game_center_page || 0,
                '水果商店次数': s.gameCounts.fruit_store_page || 0,
                '切水果次数': s.gameCounts.fruit_cutting_page || 0,
                '卡册中心次数': s.gameCounts.card_album_page || 0,
                '抽卡次数': s.gameCounts.gacha_page || 0,
                'E宝游戏次数': s.gameCounts.e_bao_page || 0,
                '最后活动时间': s.lastTime
            }));

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, '学生行为汇总');
            XLSX.writeFile(wb, `学生行为汇总_${dateStr}.xlsx`);
        } else {
            const dataToExport = rawObjectsList.map(it => ({
                '发生时间': it.fullCnTime || it.timeStr,
                '停留时长': it.durationSec > 0 ? formatDuration(it.durationSec) : (it.durationText || '-'),
                '学生账号': it.username,
                '学生姓名': it.studentName,
                '所属学校': it.schoolName,
                '归属系统': it.gameCfg.systemName,
                '具体页面': it.gameCfg.name,
                '动作': it.action || 'page_view',
                '设备型号': it.deviceName || '-',
                '系统版本': it.platformVersion || '-'
            }));

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, '页面行为流水明细');
            XLSX.writeFile(wb, `页面行为流水_${dateStr}.xlsx`);
        }
    });

    // 13. High-Quality Static Mock Data
    function useStaticMockData() {
        const mockUsers = [
            { username: '13755188999', name: '刘俊熙', school: '青园梓枫小学', teacher: '徐老师', grade: 'fourGrade', userNo: 'S20260401', coin: 120, diamondNum: 15, serviceName: '会员年卡' },
            { username: '13107342492', name: '李明轩', school: '光明实验外国语小学', teacher: '王老师', grade: 'threeGrade', userNo: 'S20260312', coin: 85, diamondNum: 6, serviceName: '会员半年卡' },
            { username: '13987654321', name: '张子萱', school: '汇文第一寄宿学校', teacher: '张老师', grade: 'fiveGrade', userNo: 'S20260588', coin: 240, diamondNum: 30, serviceName: '会员年卡' },
            { username: '13700112233', name: '陈梓涵', school: '育才实验示范学校', teacher: '刘老师', grade: 'twoGrade', userNo: 'S20260210', coin: 50, diamondNum: 2, serviceName: '月卡会员' },
            { username: '13611223344', name: '王子涵', school: '南开实验学校本部', teacher: '赵老师', grade: 'sixGrade', userNo: 'S20260677', coin: 310, diamondNum: 45, serviceName: '尊享年卡' },
            { username: '13599887766', name: '赵俊熙', school: '朝阳外国语小学分校', teacher: '王老师', grade: 'fourGrade', userNo: 'S20260419', coin: 110, diamondNum: 10, serviceName: '会员年卡' },
            { username: '13455667788', name: '孙语桐', school: '光明实验外国语小学', teacher: '孙老师', grade: 'threeGrade', userNo: 'S20260345', coin: 75, diamondNum: 5, serviceName: '普通学员' },
            { username: '13311224455', name: '杨皓轩', school: '汇文第一寄宿学校', teacher: '李老师', grade: 'fiveGrade', userNo: 'S20260533', coin: 195, diamondNum: 20, serviceName: '会员年卡' },
            { username: '13866554433', name: '黄子涵', school: '光明实验外国语小学', teacher: '王老师', grade: 'fourGrade', userNo: 'S20260422', coin: 160, diamondNum: 18, serviceName: '会员年卡' },
            { username: '13799881122', name: '林浩宇', school: '育才实验示范学校', teacher: '刘老师', grade: 'threeGrade', userNo: 'S20260366', coin: 95, diamondNum: 8, serviceName: '会员半年卡' },
            { username: '13677889900', name: '徐佳欣', school: '南开实验学校本部', teacher: '赵老师', grade: 'fiveGrade', userNo: 'S20260512', coin: 220, diamondNum: 25, serviceName: '尊享年卡' },
            { username: '13566778899', name: '刘梓萱', school: '朝阳外国语小学分校', teacher: '王老师', grade: 'twoGrade', userNo: 'S20260288', coin: 60, diamondNum: 4, serviceName: '月卡会员' },
            { username: '13411223344', name: '郭雨泽', school: '光明实验外国语小学', teacher: '孙老师', grade: 'sixGrade', userNo: 'S20260630', coin: 280, diamondNum: 35, serviceName: '会员年卡' },
            { username: '13388990011', name: '马博文', school: '汇文第一寄宿学校', teacher: '李老师', grade: 'threeGrade', userNo: 'S20260399', coin: 105, diamondNum: 12, serviceName: '会员半年卡' },
            { username: '13244556677', name: '宋嘉怡', school: '育才实验示范学校', teacher: '周老师', grade: 'fourGrade', userNo: 'S20260477', coin: 140, diamondNum: 16, serviceName: '会员年卡' }
        ];

        mockUsers.forEach(u => {
            userToInfoCache[u.username] = {
                studentName: u.name,
                schoolName: u.school,
                teacherName: u.teacher,
                grade: u.grade,
                userNo: u.userNo,
                coin: u.coin,
                diamondNum: u.diamondNum,
                serviceName: u.serviceName,
                deviceName: 'vivo-PA2511',
                platformVersion: '15'
            };
        });

        // 覆盖用户指定的5大核心页面 + E宝页面
        const gamePages = [
            'game_center_page',
            'fruit_store_page',
            'fruit_cutting_page',
            'card_album_page',
            'gacha_page',
            'e_bao_page'
        ];

        const mockObjects = [];
        const dateStr = reportDateInput.value || '2026-10-10';
        const formattedDate = dateStr.replace(/-/g, '_');

        // 保证全部15个学生都有明确的游戏中心游玩记录，并呈现自然的阶梯时长排行 (从约52分钟递减至约9分钟)
        mockUsers.forEach((user, idx) => {
            const baseMinutes = Math.max(9, Math.round(52 - idx * 2.8));
            const totalSec = baseMinutes * 60;
            const segments = Math.floor(Math.random() * 2) + 2; // 分2-3次进入游戏中心
            let remSec = totalSec;

            for (let s = 0; s < segments; s++) {
                const segDur = (s === segments - 1) ? remSec : Math.floor(remSec / (segments - s));
                remSec -= segDur;
                const hour = 8 + ((idx * 2 + s * 3) % 14);
                const min = (idx * 4 + s * 17) % 60;
                const sec = (idx * 6 + s * 19) % 60;
                const ms = 100 + idx * 20 + s * 30;
                const timeSuffix = `${String(hour).padStart(2, '0')}${String(min).padStart(2, '0')}${String(sec).padStart(2, '0')}_${ms}_${segDur}`;
                const key = `usertemp/xuelianxitong/${formattedDate}/page_track/${user.username}/game_center_page_${formattedDate}_${timeSuffix}.json`;
                mockObjects.push({
                    name: key,
                    size: 2048,
                    lastModified: new Date(`${dateStr}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${ms}Z`).toISOString()
                });
            }
        });

        // 随机生成更多交互记录，丰富统计数据
        for (let i = 0; i < 120; i++) {
            const user = mockUsers[Math.floor(Math.random() * mockUsers.length)];
            const rand = Math.random();
            let pageName = 'game_center_page';
            if (rand < 0.20) pageName = 'game_center_page';
            else if (rand < 0.38) pageName = 'fruit_store_page';
            else if (rand < 0.58) pageName = 'fruit_cutting_page';
            else if (rand < 0.75) pageName = 'card_album_page';
            else if (rand < 0.90) pageName = 'gacha_page';
            else pageName = 'e_bao_page';

            const hour = Math.floor(Math.random() * 14) + 8; // 08:00 - 22:00
            const min = Math.floor(Math.random() * 60);
            const sec = Math.floor(Math.random() * 60);
            const ms = Math.floor(Math.random() * 900) + 100;
            const dur = Math.floor(Math.random() * 180) + 15;
            const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
            const timeSuffix = `${String(hour).padStart(2, '0')}${String(min).padStart(2, '0')}${String(sec).padStart(2, '0')}_${ms}_${dur}`;

            // 符合规范文件名: usertemp/xuelianxitong/{date}/page_track/{username}/{pageName}_{date}_{timeSuffix}.json
            const key = `usertemp/xuelianxitong/${formattedDate}/page_track/${user.username}/${pageName}_${formattedDate}_${timeSuffix}.json`;

            mockObjects.push({
                name: key,
                size: Math.floor(Math.random() * 2048) + 1024,
                lastModified: new Date(`${dateStr}T${timeStr}.${ms}Z`).toISOString()
            });
        }

        // Sort descending
        mockObjects.sort((a, b) => b.name.localeCompare(a.name));

        parseAndAnalyzeObjects(mockObjects, dateStr);

        // 为 mock 的对象注入合理的停留时长 (保留已设置的游玩时长)
        rawObjectsList.forEach(item => {
            if (!item.durationSec || item.durationSec <= 0) {
                const dur = Math.floor(Math.random() * 120) + 5;
                item.durationSec = dur;
                item.durationText = formatDuration(dur);
            }
            const uInfo = userToInfoCache[item.username];
            if (uInfo) {
                item.studentName = uInfo.studentName;
                item.schoolName = uInfo.schoolName;
                item.teacherName = uInfo.teacherName;
                item.grade = uInfo.grade;
                item.userNo = uInfo.userNo;
                item.coin = uInfo.coin;
                item.diamondNum = uInfo.diamondNum;
                item.serviceName = uInfo.serviceName;
                item.deviceName = uInfo.deviceName;
                item.platformVersion = uInfo.platformVersion;
            }
        });

        // 重新聚合汇总中的总时长
        aggregateStudentSummary();
        renderStats();
        applyFiltersAndRender();

        // 生成 Mock DAU
        const allMockDauUsers = [
            ...mockUsers,
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

        const mockHours = [
            7, 8,
            9, 9, 10, 10, 11, 11,
            12, 12, 13,
            14, 14, 15, 15, 16, 16, 17,
            18, 19, 20, 20, 21,
            22, 23
        ];

        const mockDevices = [
            { dev: 'vivo-PA2511', ver: '15' },
            { dev: 'iPad (第9代)', ver: 'iPadOS 16.6' },
            { dev: '华为 MatePad 11', ver: 'HarmonyOS 3.1' },
            { dev: '小米平板 6 Pro', ver: 'Android 13' },
            { dev: 'iPad Air 5', ver: 'iPadOS 17.2' },
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
            summaryTableBody.innerHTML = `<tr><td colspan="11" class="loading-cell">⏳ 正在从 OSS 检索页面行为日志并汇总分析...</td></tr>`;
        }
        if (logsTableBody) {
            logsTableBody.innerHTML = `<tr><td colspan="10" class="loading-cell">⏳ 正在从 OSS 检索行为流水记录...</td></tr>`;
        }
        if (dauTimeSlotTableBody) {
            dauTimeSlotTableBody.innerHTML = `<tr><td colspan="10" class="loading-cell">⏳ 正在从 OSS 检索日活数据并生成时间段报表...</td></tr>`;
        }
    }

    function renderEmptyState() {
        activePlayersCountEl.textContent = '0';
        totalGamesCountEl.textContent = '0';
        if (totalDurationValEl) totalDurationValEl.textContent = '-';
        if (gameCenterCountEl) gameCenterCountEl.textContent = '0次';
        if (fruitSystemCountEl) fruitSystemCountEl.textContent = '0';
        if (fruitStoreCountEl) fruitStoreCountEl.textContent = '0次';
        if (fruitCuttingCountEl) fruitCuttingCountEl.textContent = '0次';
        if (cardSystemCountEl) cardSystemCountEl.textContent = '0';
        if (cardAlbumCountEl) cardAlbumCountEl.textContent = '0次';
        if (cardGachaCountEl) cardGachaCountEl.textContent = '0次';
        if (eBaoCountEl) eBaoCountEl.textContent = '0';

        if (summaryTableBody) {
            summaryTableBody.innerHTML = `<tr><td colspan="11" class="loading-cell">所选日期暂无任何学生行为记录</td></tr>`;
        }
        if (logsTableBody) {
            logsTableBody.innerHTML = `<tr><td colspan="10" class="loading-cell">所选日期暂无任何学生行为记录</td></tr>`;
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

    // Theme synchronization for charts
    function syncBehaviorChartsTheme() {
        renderCharts();
    }

    window.addEventListener('themeChanged', () => {
        syncBehaviorChartsTheme();
    });

    window.addEventListener('resize', () => {
        if (topStudentsChart && !topStudentsChart.isDisposed()) topStudentsChart.resize();
        if (hourlyTrendChart && !hourlyTrendChart.isDisposed()) hourlyTrendChart.resize();
        if (distributionChart && !distributionChart.isDisposed()) distributionChart.resize();
    });

    // 同步父级框架菜单为“学生行为”
    function notifyParentMenu() {
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({ action: 'syncMenu', activeMenu: 'studentBehavior/studentBehavior.html' }, '*');
            }
        } catch (_) { }
        try {
            if (window.parent && window.parent !== window && typeof window.parent.updateActiveMenu === 'function') {
                window.parent.updateActiveMenu('studentBehavior/studentBehavior.html');
            }
        } catch (_) { }
    }
    notifyParentMenu();
    window.addEventListener('pageshow', notifyParentMenu);
});


