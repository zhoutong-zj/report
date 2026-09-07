/**
 * 异常类型与OSS存储目录名称的映射关系
 */
const exceptionTypeMapping = {
    'dataException': 'data_error',       // 数据异常
    'platformException': 'platform_error', // 平台异常
    'otherException': 'other_error',       // 其他异常
    'evaluationException': 'evaluation_error', // 评测异常
    'audioVideoException': 'audio_video_error' // 音视频异常
};

/**
 * 异常类型对应的中文显示名称
 */
const exceptionTypeNames = {
    'dataException': '数据异常',
    'platformException': '平台异常',
    'otherException': '其他异常',
    'evaluationException': '评测异常',
    'audioVideoException': '音视频异常'
};

/**
 * 异常类型对应的标签背景颜色
 */
const exceptionTypeColors = {
    'dataException': '#e5837a',       // 红色系
    'platformException': '#f5a623',    // 橙色系
    'otherException': '#909090',       // 灰色系
    'evaluationException': '#48e59e',   // 绿色系
    'audioVideoException': '#ab47bc'   // 紫色系
};

/**
 * 报告类型数值与异常类型的映射关系
 */
const reportTypeMapping = {
    0: 'dataException',
    1: 'platformException',
    2: 'otherException',
    3: 'evaluationException',
    4: 'audioVideoException'
};

/**
 * 所有合法的异常类型数组
 */
const allExceptionTypes = ['dataException', 'platformException', 'otherException', 'evaluationException', 'audioVideoException'];

/**
 * 用户列表应用主类，负责页面交互、数据请求、过滤及渲染
 */
class UserListApp {
    constructor() {
        // 当前筛选条件默认值
        this.currentFilters = {
            username: '18800000009', // 默认用户账号
            date: '',                // 默认日期为空，将在init中设置为今天
            exceptionType: 'all'     // 默认过滤类型为“全部”
        };
        this.allData = []; // 存储所有从OSS拉取下来的原始数据
        this.selectedItemKey = null; // 当前点击选中的Item唯一标识
        this.hoverTimer = null;      // 鼠标悬停停顿计时器
        this.popoverHideTimer = null;// 弹框延时关闭计时器
        this.currentPopoverItem = null; // 当前弹框展示的Item数据
        this.init();
    }

    /**
     * 初始化应用入口
     */
    init() {
        this.bindEvents();          // 绑定页面元素事件
        this.initErrorPopover();    // 初始化错误数据浮层弹框事件
        this.setDefaultDate();      // 设置默认查询日期为当天
        this.setDefaultUsername();  // 设置默认查询账号
        this.loadUsernameHistory(); // 加载并渲染历史查询账号
        this.restoreData();         // 从sessionStorage恢复上次查询的数据及条件
        this.checkBackBtnVisibility(); // 检查是否需要显示返回日活详情按钮

        // 检查是否有来自仪表盘的快捷搜索请求
        const autoSearchUser = sessionStorage.getItem('autoSearchUsername');
        const autoSearchDate = sessionStorage.getItem('autoSearchDate');
        if (autoSearchUser) {
            sessionStorage.removeItem('autoSearchUsername');
            this.currentFilters.username = autoSearchUser;
            document.getElementById('username').value = autoSearchUser;

            // 重置异常类型为“全部”，避免沿用之前筛选的单个类型导致查询不全
            this.currentFilters.exceptionType = 'all';
            document.getElementById('exceptionType').value = 'all';

            if (autoSearchDate) {
                sessionStorage.removeItem('autoSearchDate');
                this.currentFilters.date = autoSearchDate;
                document.getElementById('date').value = autoSearchDate;
            }

            this.handleSearch();
        }
    }

    /**
     * 初始化悬停错误数据弹框相关的事件与DOM引用
     */
    initErrorPopover() {
        const popover = document.getElementById('errorDataPopover');
        const closeBtn = document.getElementById('popoverCloseBtn');
        const copyBtn = document.getElementById('popoverCopyBtn');

        if (!popover) return;

        // 鼠标移入弹框本身时，取消关闭计时器，保持显示以便复制或查看
        popover.addEventListener('mouseenter', () => {
            if (this.popoverHideTimer) {
                clearTimeout(this.popoverHideTimer);
                this.popoverHideTimer = null;
            }
        });

        // 鼠标离开弹框时，延时关闭
        popover.addEventListener('mouseleave', () => {
            this.scheduleHidePopover();
        });

        // 关闭按钮
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideErrorPopover();
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
                        copyBtn.style.color = '#fff';
                        setTimeout(() => {
                            copyBtn.textContent = originalText;
                            copyBtn.style.backgroundColor = '';
                            copyBtn.style.color = '';
                        }, 1500);
                    }).catch(err => {
                        console.error('复制失败:', err);
                    });
                }
            });
        }
    }

    /**
     * 格式化文件大小 (B, KB, MB)
     * @param {number|string} bytes - 字节数
     * @returns {string} 格式化后的文件大小
     */
    formatFileSize(bytes) {
        if (bytes === undefined || bytes === null || bytes === '' || isNaN(bytes)) {
            return '-';
        }
        const num = Number(bytes);
        if (num <= 0) return '0 B';
        if (num < 1024) return `${num} B`;
        if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
        return `${(num / (1024 * 1024)).toFixed(2)} MB`;
    }

    /**
     * 从 localStorage 加载历史查询用户名并渲染到 datalist 自动完成列表中
     */
    loadUsernameHistory() {
        const history = JSON.parse(localStorage.getItem('usernameHistory') || '[]');
        const datalist = document.getElementById('usernameList');
        datalist.innerHTML = '';
        history.forEach(username => {
            const option = document.createElement('option');
            option.value = username;
            datalist.appendChild(option);
        });
    }

    /**
     * 将本次成功查询的用户名保存到历史记录中（去重、限制最多存储10条）
     * @param {string} username - 查询的用户名
     */
    saveUsernameToHistory(username) {
        if (!username) return;
        let history = JSON.parse(localStorage.getItem('usernameHistory') || '[]');
        // 去除已存在的相同用户名，并将最新查询的置顶
        history = history.filter(item => item !== username);
        history.unshift(username);
        // 只保留最近的 10 条记录
        history = history.slice(0, 10);
        localStorage.setItem('usernameHistory', JSON.stringify(history));
        this.loadUsernameHistory();
    }

    /**
     * 恢复会话中保存的数据和过滤状态，避免刷新页面后数据丢失
     */
    restoreData() {
        const savedData = sessionStorage.getItem('listData');
        const savedFilters = sessionStorage.getItem('listFilters');

        if (savedData && savedFilters) {
            try {
                this.allData = JSON.parse(savedData);
                const filters = JSON.parse(savedFilters);
                this.currentFilters = filters;

                // 同步更新页面输入框和下拉框的显示值
                document.getElementById('username').value = filters.username || '';
                document.getElementById('date').value = filters.date || '';
                document.getElementById('exceptionType').value = filters.exceptionType || 'all';

                // 应用当前筛选过滤并重新渲染
                this.applyFilter();
            } catch (error) {
                console.error('恢复数据失败:', error);
            }
        }
    }

    /**
     * 将当前拉取到的数据和过滤条件保存至 sessionStorage
     */
    saveData() {
        sessionStorage.setItem('listData', JSON.stringify(this.allData));
        sessionStorage.setItem('listFilters', JSON.stringify(this.currentFilters));
    }

    /**
     * 设置账号输入框的默认值
     */
    setDefaultUsername() {
        const usernameInput = document.getElementById('username');
        usernameInput.value = '18800000009';
    }

    /**
     * 设置日期选择器的默认值为今天（格式：YYYY-MM-DD）
     */
    setDefaultDate() {
        const dateInput = document.getElementById('date');
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        dateInput.value = `${year}-${month}-${day}`;
        this.currentFilters.date = dateInput.value;
    }

    /**
     * 绑定页面交互组件的事件监听器
     */
    bindEvents() {
        const usernameInput = document.getElementById('username');
        const dateInput = document.getElementById('date');
        const exceptionTypeSelect = document.getElementById('exceptionType');
        const searchBtn = document.getElementById('searchBtn');

        // 绑定搜索按钮点击事件
        searchBtn.addEventListener('click', () => this.handleSearch());

        // 绑定导出数据表格按钮点击事件
        const exportExcelBtn = document.getElementById('exportExcelBtn');
        if (exportExcelBtn) {
            exportExcelBtn.addEventListener('click', () => this.exportToExcel());
        }

        // 绑定删除个人数据按钮点击事件
        const deleteUserDataBtn = document.getElementById('deleteUserDataBtn');
        if (deleteUserDataBtn) {
            deleteUserDataBtn.addEventListener('click', () => this.handleDeleteUserData());
        }

        // 监听账号输入框变动，实时更新过滤条件
        usernameInput.addEventListener('input', (e) => {
            this.currentFilters.username = e.target.value;
        });

        // 监听日期选择器变动，实时更新过滤条件
        dateInput.addEventListener('change', (e) => {
            this.currentFilters.date = e.target.value;
        });

        // 监听异常类型下拉框变动，实时更新过滤条件并立即本地应用过滤
        exceptionTypeSelect.addEventListener('change', (e) => {
            this.currentFilters.exceptionType = e.target.value;
            this.applyFilter();
            this.saveData();
        });

        // 绑定返回日活详情页按钮事件
        const backToDauBtn = document.getElementById('backToDauBtn');
        if (backToDauBtn) {
            backToDauBtn.addEventListener('click', () => this.handleBackToDau());
        }

        // 绑定返回异常分类详情页按钮事件
        const backToExceptionBtn = document.getElementById('backToExceptionBtn');
        if (backToExceptionBtn) {
            backToExceptionBtn.addEventListener('click', () => this.handleBackToException());
        }
    }

    /**
     * 根据是否从日活详情页或异常分类详情页排查跳转而来，控制返回按钮的显隐
     */
    checkBackBtnVisibility() {
        const backToDauBtn = document.getElementById('backToDauBtn');
        const backToExceptionBtn = document.getElementById('backToExceptionBtn');

        const fromDau = sessionStorage.getItem('fromDauDetail');
        const fromException = sessionStorage.getItem('fromExceptionDetail');

        if (backToDauBtn) {
            backToDauBtn.style.display = (fromDau === 'true') ? 'inline-flex' : 'none';
        }
        if (backToExceptionBtn) {
            backToExceptionBtn.style.display = (fromException === 'true') ? 'inline-flex' : 'none';
        }
    }

    /**
     * 返回日活详情页处理逻辑
     */
    handleBackToDau() {
        sessionStorage.removeItem('fromDauDetail');
        if (window.self !== window.parent) {
            window.parent.postMessage({
                action: 'navigate',
                page: 'dauDetail/dauDetail.html',
                activeMenu: 'logReport/logReport.html'
            }, '*');
            setTimeout(() => {
                window.location.href = '../dauDetail/dauDetail.html';
            }, 150);
        } else {
            window.location.href = '../dauDetail/dauDetail.html';
        }
    }

    /**
     * 返回异常分类详情页处理逻辑
     */
    handleBackToException() {
        sessionStorage.removeItem('fromExceptionDetail');
        if (window.self !== window.parent) {
            window.parent.postMessage({
                action: 'navigate',
                page: 'exceptionDetail/exceptionDetail.html',
                activeMenu: 'logReport/logReport.html'
            }, '*');
            setTimeout(() => {
                window.location.href = '../exceptionDetail/exceptionDetail.html';
            }, 150);
        } else {
            window.location.href = '../exceptionDetail/exceptionDetail.html';
        }
    }

    /**
     * 转换日期格式，从 YYYY-MM-DD 转换为 YYYY_MM_DD 以适配OSS存储路径
     * @param {string} dateStr - 原始日期字符串 (如 '2026-07-23')
     * @returns {string} 格式化后的日期字符串 (如 '2026_07_23')
     */
    formatDateForUrl(dateStr) {
        if (!dateStr) return '';
        return dateStr.replace(/-/g, '_');
    }

    /**
     * 初始化并获取 OSS 客户端实例
     */
    getOssClient() {
        const savedConfig = localStorage.getItem('oss_tool_config');
        if (!savedConfig) {
            return null;
        }
        try {
            const config = JSON.parse(savedConfig);
            const { accessKeyId, accessKeySecret, endpoint, bucket } = config;
            if (!accessKeyId || !accessKeySecret || !endpoint || !bucket) {
                return null;
            }

            // 动态提取 region (例如 "oss-cn-shanghai.aliyuncs.com" -> "oss-cn-shanghai")
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
            console.error('初始化 OSS 客户端失败:', e);
            return null;
        }
    }

    /**
     * 执行数据搜索的主入口函数
     */
    async handleSearch() {
        const { username, date, exceptionType } = this.currentFilters;

        // 表单校验
        if (!username) {
            alert('请输入用户ID');
            return;
        }

        if (!date) {
            alert('请选择日期');
            return;
        }

        const formattedDate = this.formatDateForUrl(date);

        // 初始化/清空已有数据并展示加载状态
        this.allData = [];
        this.renderLoading();
        this.saveUsernameToHistory(username);

        // 始终获取该用户该日期的所有异常类型文件夹数据，保证本地数据的完整性以支持切换筛选
        const typesToFetch = Object.keys(exceptionTypeMapping);

        const client = this.getOssClient();

        // 并发发起所有类型文件夹的数据请求
        const promises = typesToFetch.map(type => {
            const folderName = exceptionTypeMapping[type];
            if (!folderName) return Promise.resolve();

            const prefix = `usertemp/xuelianxitong/${formattedDate}/${username}/${folderName}/`;

            if (client) {
                console.log(`正在使用 OSS 客户端安全请求类型: ${folderName}`);
                return this.fetchDataWithOss(client, prefix, type);
            } else {
                console.log(`未找到 OSS 凭证，降级为公共链接并发请求类型: ${folderName}`);
                return this.fetchDataWithPublicFallback(prefix, type);
            }
        });
        await Promise.all(promises);

        // 去重逻辑：如果同时存在 JSON 和 TXT，以 JSON 为准；若只有 TXT，则保留并展示
        const uniqueData = [];
        const seen = new Set();
        this.allData.forEach(item => {
            if (!item.isTxtOnly) {
                uniqueData.push(item);
                seen.add(`${item.loginName || item.userId}_${item.reportTime}`);
                seen.add(`${item.loginName || item.userId}_index_${item.index}`);
            }
        });
        this.allData.forEach(item => {
            if (item.isTxtOnly) {
                const key1 = `${item.loginName || item.userId}_${item.reportTime}`;
                const key2 = `${item.loginName || item.userId}_index_${item.index}`;
                if (!seen.has(key1) && !seen.has(key2)) {
                    uniqueData.push(item);
                    seen.add(key1);
                    seen.add(key2);
                }
            }
        });
        this.allData = uniqueData;

        console.log(`获取并去重到 ${this.allData.length} 条数据:`, this.allData);

        // 数据拉取完成后，保存并展示过滤后的结果
        this.saveData();
        this.applyFilter();
    }

    /**
     * 使用 OSS 客户端安全列出并并发读取文件，完美解决私有 Bucket 的 403 权限问题
     */
    async fetchDataWithOss(client, prefix, exceptionType) {
        try {
            const result = await client.list({
                prefix: prefix,
                'max-keys': 100
            });
            const objects = result.objects || [];

            // 并发获取所有对象内容并解析
            const fetchPromises = objects.map(async (obj) => {
                try {
                    const fileName = obj.name.split('/').pop(); // 提取文件名如 "1.json" 或 "crash_1.txt"
                    const isTxtFile = fileName.endsWith('.txt');
                    const isJsonFile = fileName.endsWith('.json');
                    const fileSize = obj.size !== undefined ? obj.size : 0;

                    if (isTxtFile) {
                        const parts = obj.name.split('/');
                        const userName = parts[3] || '';

                        let index = 0;
                        let reportTime = '';
                        if (fileName.startsWith('crash_')) {
                            const timePart = fileName.replace('crash_', '').replace('.txt', '');
                            reportTime = timePart;
                            index = parseInt(timePart) || 0;
                        }

                        let errorTime = '-';
                        if (reportTime && reportTime.includes('_')) {
                            const timeSegments = reportTime.split('_');
                            if (timeSegments.length >= 4 && timeSegments[3].length >= 6) {
                                errorTime = `${timeSegments[3].substring(0, 2)}时${timeSegments[3].substring(2, 4)}分${timeSegments[3].substring(4, 6)}秒`;
                            } else if (timeSegments.length >= 6) {
                                errorTime = `${timeSegments[3]}时${timeSegments[4]}分${timeSegments[5]}秒`;
                            }
                        }

                        this.allData.push({
                            userId: userName,
                            nickName: '-',
                            loginName: userName,
                            errorTime: errorTime,
                            reportTime: reportTime,
                            sourceExceptionType: exceptionType,
                            index: index,
                            isTxtOnly: true,
                            fileSize: fileSize,
                            size: fileSize
                        });
                        return;
                    }

                    // 提取索引号
                    let index = 0;
                    if (isJsonFile) {
                        index = parseInt(fileName.replace('.json', '')) || 0;
                    }

                    const res = await client.get(obj.name);
                    const text = res.content ? res.content.toString() : '';

                    // 检查内容是否为空
                    if (!text || text.trim() === '') {
                        console.log('文件内容为空，跳过:', obj.name);
                        return;
                    }

                    // .txt 和 .json 文件都使用 JSON 解析
                    const data = JSON.parse(text);
                    if (data && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0)) {
                        const items = Array.isArray(data) ? data : [data];
                        items.forEach(item => {
                            this.allData.push({
                                ...item,
                                sourceExceptionType: exceptionType,
                                index: index,
                                fileSize: fileSize || text.length,
                                size: fileSize || text.length,
                                errorTime: item.errorTime || item.happenTime || item.time || ''
                            });
                        });
                    }
                } catch (e) {
                    console.error('获取或解析 OSS 文件失败:', obj.name, e);
                }
            });

            await Promise.all(fetchPromises);
        } catch (error) {
            console.error('OSS client listObjects 错误，降级回退至公共链接拉取:', error);
            await this.fetchDataWithPublicFallback(prefix, exceptionType);
        }
    }

    /**
     * 公共链接的并发拉取降级方案（直接向公共读的 Bucket 发起 prefix 列举请求，解析 XML 获得真实文件键列表）
     */
    async fetchDataWithPublicFallback(prefix, exceptionType) {
        try {
            const listUrl = `https://zhongtai-prod.oss-cn-shanghai.aliyuncs.com/?prefix=${encodeURIComponent(prefix)}`;
            const response = await fetch(listUrl);
            if (!response.ok) {
                console.error(`列出公共 OSS 目录失败: ${listUrl}`);
                return;
            }
            const text = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, 'text/xml');
            const contents = xmlDoc.getElementsByTagName('Contents');

            const jsonFiles = [];
            const txtFiles = [];
            for (let i = 0; i < contents.length; i++) {
                const keyEl = contents[i].getElementsByTagName('Key')[0];
                const sizeEl = contents[i].getElementsByTagName('Size')[0];
                const sizeVal = sizeEl ? (parseInt(sizeEl.textContent) || 0) : 0;

                if (keyEl) {
                    const key = keyEl.textContent;
                    if (key.endsWith('.json')) {
                        jsonFiles.push({ key, size: sizeVal });
                    } else if (key.endsWith('.txt')) {
                        txtFiles.push({ key, size: sizeVal });
                    }
                }
            }

            console.log(`公共目录列举到 ${jsonFiles.length} 个 JSON 文件, ${txtFiles.length} 个 TXT 文件`);

            // 处理独立 TXT 文件
            txtFiles.forEach(fileObj => {
                const parts = fileObj.key.split('/');
                const userName = parts[3] || '';
                const fileName = parts.pop();

                let index = 0;
                let reportTime = '';
                if (fileName.startsWith('crash_')) {
                    const timePart = fileName.replace('crash_', '').replace('.txt', '');
                    reportTime = timePart;
                    index = parseInt(timePart) || 0;
                }

                let errorTime = '-';
                if (reportTime && reportTime.includes('_')) {
                    const timeSegments = reportTime.split('_');
                    if (timeSegments.length >= 4 && timeSegments[3].length >= 6) {
                        errorTime = `${timeSegments[3].substring(0, 2)}时${timeSegments[3].substring(2, 4)}分${timeSegments[3].substring(4, 6)}秒`;
                    } else if (timeSegments.length >= 6) {
                        errorTime = `${timeSegments[3]}时${timeSegments[4]}分${timeSegments[5]}秒`;
                    }
                }

                this.allData.push({
                    userId: userName,
                    nickName: '-',
                    loginName: userName,
                    errorTime: errorTime,
                    reportTime: reportTime,
                    sourceExceptionType: exceptionType,
                    index: index,
                    isTxtOnly: true,
                    fileSize: fileObj.size,
                    size: fileObj.size
                });
            });

            // 处理 JSON 文件
            const fetchPromises = jsonFiles.map(async (fileObj) => {
                const fileUrl = `https://zhongtai-prod.oss-cn-shanghai.aliyuncs.com/${fileObj.key}`;
                const fileName = fileObj.key.split('/').pop();
                const index = parseInt(fileName.replace('.json', '')) || 0;

                try {
                    const fileRes = await fetch(fileUrl);
                    if (!fileRes.ok) return;
                    const fileText = await fileRes.text();
                    if (!fileText || fileText.trim() === '') return;

                    const data = JSON.parse(fileText);
                    const calcSize = fileObj.size || fileText.length;
                    if (data && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0)) {
                        const items = Array.isArray(data) ? data : [data];
                        items.forEach(item => {
                            this.allData.push({
                                ...item,
                                sourceExceptionType: exceptionType,
                                index: index,
                                fileSize: calcSize,
                                size: calcSize,
                                errorTime: item.errorTime || item.happenTime || item.time || ''
                            });
                        });
                    }
                } catch (e) {
                    console.error('获取或解析公共 OSS 文件失败:', fileObj.key, e);
                }
            });

            await Promise.all(fetchPromises);
        } catch (error) {
            console.error('公共 OSS 目录拉取失败:', error);
        }
    }

    /**
     * 渲染列表的“加载中...”提示
     */
    renderLoading() {
        const tbody = document.getElementById('userList');
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #409eff; padding: 24px;">加载中...</td></tr>';
    }

    /**
     * 渲染错误或失败信息提示
     * @param {string} message - 错误信息内容
     */
    renderError(message) {
        const tbody = document.getElementById('userList');
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #f56c6c; padding: 24px;">加载失败: ${message}</td></tr>`;
    }

    /**
     * 鼠标悬停停顿展示错误数据弹框
     * @param {Object} item - 行数据对象
     * @param {DOMRect} rowRect - 触发行的坐标位置
     * @param {number} mouseX - 鼠标当前X坐标
     * @param {number} mouseY - 鼠标当前Y坐标
     */
    showErrorPopover(item, rowRect, mouseX, mouseY) {
        const popover = document.getElementById('errorDataPopover');
        const typeBadge = document.getElementById('popoverTypeBadge');
        const metaEl = document.getElementById('popoverMeta');
        const contentEl = document.getElementById('popoverContent');

        if (!popover || !contentEl) return;

        this.currentPopoverItem = item;

        // 计算异常类型与标签
        const exceptionType = item.exceptionType || reportTypeMapping[item.reportType] || item.sourceExceptionType || 'otherException';
        const color = exceptionTypeColors[exceptionType] || '#909399';
        const typeName = exceptionTypeNames[exceptionType] || '未知异常';

        if (typeBadge) {
            typeBadge.textContent = typeName;
            typeBadge.style.backgroundColor = color;
        }

        const studentInfo = item.studentInfo || {};
        const userIdVal = item.userId || studentInfo.id || studentInfo.userId || item.loginName || '-';
        const nickNameVal = item.nickName || studentInfo.nickName || '-';
        const timeVal = item.errorTime || item.reportTime || '-';
        const sizeVal = this.formatFileSize(item.fileSize !== undefined ? item.fileSize : item.size);

        if (metaEl) {
            metaEl.innerHTML = `
                <span><strong>用户:</strong> ${userIdVal} (${nickNameVal})</span>
                <span><strong>时间:</strong> ${timeVal}</span>
                <span><strong>大小:</strong> ${sizeVal}</span>
            `;
        }

        // 解析并格式化错误数据
        let errorDataText = '';
        if (item.errorData) {
            if (typeof item.errorData === 'object') {
                errorDataText = JSON.stringify(item.errorData, null, 2);
            } else if (typeof item.errorData === 'string') {
                try {
                    const parsed = JSON.parse(item.errorData);
                    errorDataText = JSON.stringify(parsed, null, 2);
                } catch (e) {
                    errorDataText = item.errorData;
                }
            }
        } else if (item.stackTrace) {
            errorDataText = item.stackTrace;
        } else if (item.isTxtOnly) {
            errorDataText = `【TXT崩溃日志】\n文件标识: crash_${item.reportTime || item.index}.txt\n发生时间: ${timeVal}\n可点击「查看详情」下载或查阅完整Crash日志。`;
        } else {
            // 构造简要摘要数据
            const summary = {
                loginName: item.loginName || item.userId,
                errorTime: item.errorTime,
                exceptionType: typeName,
                appVersion: item.versionName || item.version || '-',
                deviceName: item.deviceName || (item.studentInfo && item.studentInfo.deviceName) || '-',
                remark: '暂无独立errorData字段，可进入详情页查看完整信息'
            };
            errorDataText = JSON.stringify(summary, null, 2);
        }

        contentEl.textContent = errorDataText;

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
    scheduleHidePopover() {
        if (this.popoverHideTimer) {
            clearTimeout(this.popoverHideTimer);
        }
        this.popoverHideTimer = setTimeout(() => {
            this.hideErrorPopover();
        }, 200);
    }

    /**
     * 立即隐藏错误数据弹框
     */
    hideErrorPopover() {
        const popover = document.getElementById('errorDataPopover');
        if (popover) {
            popover.style.display = 'none';
        }
        if (this.hoverTimer) {
            clearTimeout(this.hoverTimer);
            this.hoverTimer = null;
        }
        if (this.popoverHideTimer) {
            clearTimeout(this.popoverHideTimer);
            this.popoverHideTimer = null;
        }
    }

    /**
     * 渲染用户列表表格数据
     * @param {Array} data - 需要渲染的数据数组
     */
    renderUserList(data) {
        const tbody = document.getElementById('userList');
        tbody.innerHTML = '';
        this.hideErrorPopover();

        // 无数据时的缺省页渲染
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #909399; padding: 24px;">暂无数据</td></tr>';
            return;
        }

        // 根据发生时间（errorTime）进行降序排序
        const sortedData = [...data].sort((a, b) => {
            const timeA = a.errorTime || '';
            const timeB = b.errorTime || '';
            if (!timeA) return 1;
            if (!timeB) return -1;
            return timeB.localeCompare(timeA);
        });

        // 循环遍历渲染数据行
        sortedData.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';

            // 生成唯一的Item标识
            const itemKey = `${item.loginName || item.userId}_${item.reportTime || item.errorTime || ''}_${item.index || index}`;
            tr.dataset.itemKey = itemKey;

            // 如果该项之前已被选中，恢复其高亮背景
            if (this.selectedItemKey === itemKey) {
                tr.classList.add('selected-row');
            }

            // 单击行：更换背景颜色（选中当前Item，取消其他Item的选中状态）
            tr.addEventListener('click', () => {
                // 移除所有已选行的选中样式
                tbody.querySelectorAll('tr.selected-row').forEach(row => {
                    row.classList.remove('selected-row');
                });
                // 为当前点击的行添加选中样式
                tr.classList.add('selected-row');
                this.selectedItemKey = itemKey;
            });

            // 鼠标悬停停顿逻辑：悬停超过350ms时弹出错误数据弹框
            tr.addEventListener('mouseenter', (e) => {
                if (this.popoverHideTimer) {
                    clearTimeout(this.popoverHideTimer);
                    this.popoverHideTimer = null;
                }
                if (this.hoverTimer) {
                    clearTimeout(this.hoverTimer);
                    this.hoverTimer = null;
                }

                // 如果鼠标当前已经在“查看详情”按钮上，不触发弹框
                const detailBtn = tr.querySelector('.view-detail-btn');
                if (detailBtn && (detailBtn === e.target || detailBtn.contains(e.target) || detailBtn.matches(':hover'))) {
                    return;
                }

                const rect = tr.getBoundingClientRect();
                const clientX = e.clientX;
                const clientY = e.clientY;

                this.hoverTimer = setTimeout(() => {
                    const currentDetailBtn = tr.querySelector('.view-detail-btn');
                    if (currentDetailBtn && currentDetailBtn.matches(':hover')) {
                        return;
                    }
                    this.showErrorPopover(item, rect, clientX, clientY);
                }, 350);
            });

            // 鼠标离开行：取消悬停计时并延时隐藏弹框
            tr.addEventListener('mouseleave', () => {
                if (this.hoverTimer) {
                    clearTimeout(this.hoverTimer);
                    this.hoverTimer = null;
                }
                this.scheduleHidePopover();
            });

            // 页面滚动时隐藏弹框
            window.addEventListener('scroll', () => {
                this.hideErrorPopover();
            }, { passive: true });

            // 计算当前行数据的异常类型（依次取 exceptionType、reportType映射值、sourceExceptionType，缺省为 otherException）
            const exceptionType = item.exceptionType || reportTypeMapping[item.reportType] || item.sourceExceptionType || 'otherException';
            const color = exceptionTypeColors[exceptionType] || '#909399';

            const studentInfo = item.studentInfo || {};
            const userIdVal = item.userId || studentInfo.id || studentInfo.userId || '-';
            const nickNameVal = item.nickName || studentInfo.nickName || '-';
            const fileSizeDisplay = this.formatFileSize(item.fileSize !== undefined ? item.fileSize : item.size);

            tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${userIdVal}</td>
                <td>${nickNameVal}</td>
                <td>${item.errorTime || '-'}</td>
                <td><span class="file-size-badge">${fileSizeDisplay}</span></td>
                <td><span style="background-color: ${color}; color: #fff; padding: 4px 8px; border-radius: 4px;">${exceptionTypeNames[exceptionType] || '-'}</span></td>
                <td>
                    <button class="view-detail-btn" title="查看完整详情">
                        <span>查看详情</span>
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                        </svg>
                    </button>
                </td>
            `;

            // 双击行 或 点击“查看详情”按钮：跳转至详情页
            const navigateToDetail = (e) => {
                if (e) e.stopPropagation();
                // 保持该行选中状态
                tbody.querySelectorAll('tr.selected-row').forEach(row => {
                    row.classList.remove('selected-row');
                });
                tr.classList.add('selected-row');
                this.selectedItemKey = itemKey;
                this.hideErrorPopover();

                const itemWithIndex = { ...item, index: index + 1 };
                sessionStorage.setItem('detailData', JSON.stringify(itemWithIndex));
                window.location.href = `../HomeDetail/homeDetail.html`;
            };

            tr.addEventListener('dblclick', navigateToDetail);

            const detailBtn = tr.querySelector('.view-detail-btn');
            if (detailBtn) {
                detailBtn.addEventListener('click', navigateToDetail);

                // 鼠标移入“查看详情”按钮时，禁止弹框并立即关闭已展示的弹框
                detailBtn.addEventListener('mouseenter', (e) => {
                    e.stopPropagation();
                    if (this.hoverTimer) {
                        clearTimeout(this.hoverTimer);
                        this.hoverTimer = null;
                    }
                    this.hideErrorPopover();
                });

                // 鼠标离开“查看详情”按钮但仍在当前行时，恢复悬停弹框计时
                detailBtn.addEventListener('mouseleave', (e) => {
                    if (tr.matches(':hover')) {
                        const rect = tr.getBoundingClientRect();
                        const clientX = e.clientX;
                        const clientY = e.clientY;
                        this.hoverTimer = setTimeout(() => {
                            if (detailBtn.matches(':hover')) return;
                            this.showErrorPopover(item, rect, clientX, clientY);
                        }, 350);
                    }
                });
            }

            tbody.appendChild(tr);
        });
    }

    /**
     * 按照用户选择的异常类型对本地已拉取的数据进行过滤并调用渲染
     */
    applyFilter() {
        const { exceptionType } = this.currentFilters;
        if (exceptionType === 'all' || !exceptionType) {
            // 显示全部数据
            this.renderUserList(this.allData);
        } else {
            // 过滤匹配对应异常类型的数据
            const filteredData = this.allData.filter(item => {
                const itemType = item.exceptionType || reportTypeMapping[item.reportType] || item.sourceExceptionType;
                return itemType === exceptionType;
            });
            this.renderUserList(filteredData);
        }
    }

    /**
     * 格式化报告时间 (例如：2026_09_03_094226 -> 2026年9月3日 9时42分26秒)
     */
    formatReportTime(dateInput) {
        if (!dateInput && dateInput !== 0) return '-';
        const str = String(dateInput).trim();
        if (!str || str === '-') return '-';

        const matchCompactTime = str.match(/^(\d{4})_(\d{2})_(\d{2})_(\d{2})(\d{2})(\d{2})(?:_\d+)?$/);
        if (matchCompactTime) {
            return `${parseInt(matchCompactTime[1])}年${parseInt(matchCompactTime[2])}月${parseInt(matchCompactTime[3])}日 ${parseInt(matchCompactTime[4])}时${parseInt(matchCompactTime[5])}分${parseInt(matchCompactTime[6])}秒`;
        }
        return str;
    }

    /**
     * 导出当前数据为 Excel 表格
     * 前五列：学生姓名、错误时间、评测类型、音视频内容、音视频地址
     * 后续列：基本信息其余字段（登录名、用户ID、学校、学校ID、教学老师、卡类型、评测内容、报告时间、版本、设备型号、系统版本）
     * 最后一列：错误数据
     */
    exportToExcel() {
        const { exceptionType, username, date } = this.currentFilters;
        let exportList = this.allData;
        if (exceptionType && exceptionType !== 'all') {
            exportList = this.allData.filter(item => {
                const itemType = item.exceptionType || reportTypeMapping[item.reportType] || item.sourceExceptionType;
                return itemType === exceptionType;
            });
        }

        if (!exportList || exportList.length === 0) {
            alert('当前没有可导出的数据，请先搜索数据！');
            return;
        }

        // 表头：前五列为指定字段，其后加载基本信息其余列，最后再添加一列错误数据
        const headers = [
            '学生姓名',
            '错误时间',
            '评测类型',
            '音视频内容',
            '音视频地址',
            '登录名',
            '用户ID',
            '学校',
            '学校ID',
            '教学老师',
            '卡类型',
            '评测内容',
            '报告时间',
            '版本',
            '设备型号',
            '系统版本',
            '错误数据'
        ];

        const rows = exportList.map(item => {
            const studentInfo = item.studentInfo || {};

            // 1. 学生姓名
            const studentName = item.nickName || studentInfo.nickName || studentInfo.name || item.studentName || item.name || '-';

            // 2. 错误时间
            const errorTime = item.errorTime || item.happenTime || item.reportTime || item.time || '-';

            // 3. 评测类型
            const type = item.exceptionType || reportTypeMapping[item.reportType] || item.sourceExceptionType || 'otherException';
            const typeName = exceptionTypeNames[type] || item.exceptionType || '-';

            // 4. 音视频内容
            let contentVal = item.content !== undefined && item.content !== null ? item.content : studentInfo.content;
            let contentStr = '-';
            if (contentVal !== undefined && contentVal !== null && contentVal !== '') {
                contentStr = typeof contentVal === 'object' ? JSON.stringify(contentVal) : String(contentVal);
            }

            // 5. 音视频地址
            const mediaUrl = item.mediaUrl || studentInfo.mediaUrl || '-';

            // 6. 登录名
            const loginName = item.loginName || studentInfo.loginName || item.userId || '-';

            // 7. 用户ID
            const userId = item.userId || studentInfo.id || studentInfo.userId || '-';

            // 8. 学校
            const schoolName = studentInfo.schoolName || item.schoolName || '-';

            // 9. 学校ID
            const schoolId = studentInfo.schoolId || item.schoolId || '-';

            // 10. 教学老师
            const teacherName = studentInfo.teacherName || item.teacherName || '-';

            // 11. 卡类型
            const serviceName = studentInfo.serviceName || item.serviceName || '-';

            // 12. 评测内容
            const identity = item.identity || studentInfo.identity || '-';

            // 13. 报告时间
            const rawReportTime = item.reportTime || item.report_time || '-';
            const reportTime = this.formatReportTime(rawReportTime);

            // 14. 版本
            const appVersion = item.versionName || item.version || item.appVersion || '-';

            // 15. 设备型号
            const deviceName = item.deviceName || studentInfo.deviceName || '-';

            // 16. 系统版本
            const phonePlatformVersion = item.phonePlatformVersion || studentInfo.phonePlatformVersion || '-';

            // 17. 错误数据
            let errorDataVal = item.errorData !== undefined && item.errorData !== null ? item.errorData : '-';
            let errorDataStr = '-';
            if (errorDataVal !== undefined && errorDataVal !== null && errorDataVal !== '') {
                errorDataStr = typeof errorDataVal === 'object' ? JSON.stringify(errorDataVal) : String(errorDataVal);
            }

            return [
                studentName,
                errorTime,
                typeName,
                contentStr,
                mediaUrl,
                loginName,
                userId,
                schoolName,
                schoolId,
                teacherName,
                serviceName,
                identity,
                reportTime,
                appVersion,
                deviceName,
                phonePlatformVersion,
                errorDataStr
            ];
        });

        const dateStr = date || new Date().toISOString().split('T')[0];
        const userStr = username ? `_${username}` : '';
        const filename = `异常数据报表_${dateStr}${userStr}.xlsx`;

        // 优先使用 SheetJS 导出原生 .xlsx 格式文件
        if (typeof XLSX !== 'undefined') {
            const data = [headers, ...rows];
            const ws = XLSX.utils.aoa_to_sheet(data);

            // 自定义各列列宽
            ws['!cols'] = [
                { wch: 18 }, // 学生姓名
                { wch: 22 }, // 错误时间
                { wch: 16 }, // 评测类型
                { wch: 40 }, // 音视频内容
                { wch: 50 }, // 音视频地址
                { wch: 18 }, // 登录名
                { wch: 16 }, // 用户ID
                { wch: 20 }, // 学校
                { wch: 14 }, // 学校ID
                { wch: 16 }, // 教学老师
                { wch: 16 }, // 卡类型
                { wch: 30 }, // 评测内容
                { wch: 26 }, // 报告时间
                { wch: 14 }, // 版本
                { wch: 20 }, // 设备型号
                { wch: 16 }, // 系统版本
                { wch: 60 }  // 错误数据
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, '数据列表');
            XLSX.writeFile(wb, filename);
        } else {
            // 降级方案：导出带 UTF-8 BOM 的 CSV 文件（Excel 双击直接打开不乱码）
            this.exportToCsvFallback(headers, rows, filename.replace('.xlsx', '.csv'));
        }
    }

    /**
     * 降级方案：导出带 UTF-8 BOM 的 CSV 文件
     */
    exportToCsvFallback(headers, rows, filename) {
        const formatCell = (val) => {
            const str = String(val === undefined || val === null ? '' : val);
            if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const csvContent = '\uFEFF' + [headers, ...rows].map(row => row.map(formatCell).join(',')).join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * 删除该用户的个人数据
     * 支持删除指定日期下的所有异常数据与文件，若未选日期则扫描所有日期历史文件夹
     */
    async handleDeleteUserData() {
        const usernameInput = document.getElementById('username');
        const dateInput = document.getElementById('date');
        const username = (usernameInput ? usernameInput.value : this.currentFilters.username || '').trim();
        const date = (dateInput ? dateInput.value : this.currentFilters.date || '').trim();

        if (!username) {
            alert('请先输入要删除的用户名/账号！');
            if (usernameInput) usernameInput.focus();
            return;
        }

        const client = this.getOssClient();
        if (!client) {
            alert('尚未配置 OSS 凭证，无法执行删除操作！请前往「OSS 工具」页面配置 AccessKey 凭证。');
            return;
        }

        const deleteBtn = document.getElementById('deleteUserDataBtn');
        const setBtnState = (loading, text) => {
            if (!deleteBtn) return;
            deleteBtn.disabled = loading;
            if (loading) {
                deleteBtn.innerHTML = `
                    <svg class="spin-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M12 4V2C6.48 2 2 6.48 2 12h2c0-4.41 3.59-8 8-8z"/>
                    </svg>
                    <span>${text || '正在处理...'}</span>
                `;
            } else {
                deleteBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                    <span>删除个人数据</span>
                `;
            }
        };

        setBtnState(true, '正在检索数据...');

        try {
            const formattedDate = date ? this.formatDateForUrl(date) : '';
            let targetPrefixes = [];
            let scopeDesc = '';

            if (formattedDate) {
                targetPrefixes.push(`usertemp/xuelianxitong/${formattedDate}/${username}/`);
                scopeDesc = `【${date}】日期`;
            } else {
                // 如果没有日期，扫描所有日期文件夹中的该用户数据
                const dateListRes = await client.list({
                    prefix: 'usertemp/xuelianxitong/',
                    delimiter: '/'
                });
                const prefixes = dateListRes.prefixes || [];
                targetPrefixes = prefixes.map(p => `${p}${username}/`);
                scopeDesc = '所有日期历史记录';
            }

            // 递归扫描目标前缀下的所有对象 Key
            const allKeys = [];
            for (const prefix of targetPrefixes) {
                let marker = null;
                do {
                    const listParams = {
                        prefix: prefix,
                        'max-keys': 1000
                    };
                    if (marker) listParams.marker = marker;
                    const res = await client.list(listParams);
                    const objs = res.objects || [];
                    objs.forEach(obj => {
                        if (obj.name && !obj.name.endsWith('/')) {
                            allKeys.push(obj.name);
                        }
                    });
                    marker = res.isTruncated ? res.nextMarker : null;
                } while (marker);
            }

            if (allKeys.length === 0) {
                setBtnState(false);
                alert(`未检索到用户【${username}】在${scopeDesc}下的任何数据文件。`);
                return;
            }

            setBtnState(false);

            // 弹出强提醒确认框
            const confirmed = confirm(
                `⚠️ 高危操作确认：\n\n确定要永久删除用户【${username}】在${scopeDesc}的全部数据吗？\n\n共检索到 ${allKeys.length} 个文件（包括各类异常日志、音视频及 crash 文件）。\n\n此操作为物理删除且无法恢复，是否确认删除？`
            );

            if (!confirmed) {
                return;
            }

            setBtnState(true, `正在删除(${allKeys.length})...`);

            // 分批调用 deleteMulti 删除
            const batchSize = 1000;
            for (let i = 0; i < allKeys.length; i += batchSize) {
                const batch = allKeys.slice(i, i + batchSize);
                if (typeof client.deleteMulti === 'function') {
                    await client.deleteMulti(batch, { quiet: true });
                } else {
                    for (const key of batch) {
                        await client.delete(key);
                    }
                }
            }

            alert(`✅ 成功删除用户【${username}】共 ${allKeys.length} 个数据文件！`);

            // 清理当前页面数据及缓存
            this.allData = [];
            sessionStorage.removeItem('listData');
            this.renderUserList([]);
            this.hideErrorPopover();

            // 清理异常分类详情与日活详情页的本地状态缓存，并标记强制刷新
            sessionStorage.removeItem('exception_state_cache');
            sessionStorage.removeItem('dau_state_cache');
            sessionStorage.setItem('force_refresh_exception', 'true');
            sessionStorage.setItem('force_refresh_dau', 'true');

            // 如果访问历史列表中包含该用户，同步清理
            try {
                const clickedHistory = JSON.parse(sessionStorage.getItem('clickedAccountsHistory') || '[]');
                const updatedHistory = clickedHistory.filter(acc => acc !== username);
                sessionStorage.setItem('clickedAccountsHistory', JSON.stringify(updatedHistory));
                if (sessionStorage.getItem('lastClickedAccount') === username) {
                    sessionStorage.removeItem('lastClickedAccount');
                }
            } catch (e) { }

        } catch (err) {
            console.error('删除个人数据失败:', err);
            alert('删除个人数据失败：' + (err.message || err));
        } finally {
            setBtnState(false);
        }
    }
}

// 页面 DOM 加载完毕后，实例化用户列表应用
document.addEventListener('DOMContentLoaded', () => {
    new UserListApp();
});