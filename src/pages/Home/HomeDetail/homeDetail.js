const exceptionTypeNames = {
    'dataException': '数据异常',
    'platformException': '平台异常',
    'otherException': '其他异常',
    'evaluationException': '评测异常',
    'audioVideoException': '音视频异常',
    'audioVideoTest': '音视频测试',
    'networkException': '网络异常'
};

const exceptionTypeColors = {
    'dataException': '#e5837a',
    'platformException': '#f5a623',
    'otherException': '#909090',
    'evaluationException': '#48e59e',
    'audioVideoException': '#ab47bc',
    'audioVideoTest': '#2196f3',
    'networkException': '#00bcd4'
};

const typeToClass = {
    'evaluationException': 'eval',
    'dataException': 'data',
    'platformException': 'platform',
    'audioVideoException': 'av',
    'audioVideoTest': 'av-test',
    'networkException': 'network',
    'otherException': 'other',
    'evaluation_error': 'eval',
    'data_error': 'data',
    'platform_error': 'platform',
    'audio_video_error': 'av',
    'audio_video_test': 'av-test',
    'network_error': 'network',
    'other_error': 'other'
};

const reportTypeMapping = {
    0: 'dataException',
    1: 'platformException',
    2: 'otherException',
    3: 'evaluationException',
    4: 'audioVideoException',
    5: 'audioVideoException',
    6: 'audioVideoTest',
    7: 'networkException'
};

const exceptionTypeMapping = {
    'dataException': 'data_error',
    'platformException': 'platform_error',
    'otherException': 'other_error',
    'evaluationException': 'evaluation_error',
    'audioVideoException': 'audio_video_error',
    'audioVideoTest': 'audio_video_test',
    'networkException': 'network_error'
};

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

class DetailApp {
    constructor() {
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadData();
    }

    bindEvents() {
        const backBtn = document.getElementById('backBtn');
        const handleBack = () => {
            sessionStorage.setItem('fromHomeDetail', 'true');
            try {
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage({ action: 'syncMenu', activeMenu: 'singleQuery/singleQuery.html' }, '*');
                }
            } catch (_) { }
            try {
                if (window.parent && window.parent !== window && typeof window.parent.updateActiveMenu === 'function') {
                    window.parent.updateActiveMenu('singleQuery/singleQuery.html');
                }
            } catch (_) { }
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = '../singleQuery/singleQuery.html';
            }
        };
        if (backBtn) {
            backBtn.addEventListener('click', handleBack);
        }

        const viewJsonBtn = document.getElementById('viewJsonBtn') || document.getElementById('downloadJsonBtn');
        if (viewJsonBtn) {
            viewJsonBtn.addEventListener('click', () => {
                this.viewRawJson();
            });
        }

        // 无论用户是点击返回按钮还是点击浏览器返回按钮离开详情页，都自动标记来自详情页以保持单查询列表现场
        window.addEventListener('pagehide', () => {
            sessionStorage.setItem('fromHomeDetail', 'true');
        });

        // 绑定折叠按钮点击事件
        document.querySelectorAll('.collapse-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const section = btn.closest('.info-section');
                if (section) {
                    section.classList.toggle('collapsed');
                }
            });
        });

        // 绑定复制按钮点击事件
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const section = btn.closest('.info-section');
                if (!section) return;

                let copyText = '';

                // 检查是否有场景类型且显示
                const sceneType = section.querySelector('#sceneType');
                if (sceneType && sceneType.style.display !== 'none') {
                    const sceneTypeVal = sceneType.textContent.trim();
                    if (sceneTypeVal) {
                        copyText += `场景类型：${sceneTypeVal}\n`;
                    }
                }

                // 检查是否有教材标签且显示非空
                const studyTextbook = section.querySelector('#studyTextbook');
                if (studyTextbook && studyTextbook.parentElement && studyTextbook.parentElement.style.display !== 'none') {
                    const textBookVal = studyTextbook.textContent.trim();
                    if (textBookVal && textBookVal !== '-') {
                        copyText += `训练教材：${textBookVal}\n`;
                    }
                }

                // 查找pre标签获取核心展示文本
                const pre = section.querySelector('pre');
                if (pre) {
                    copyText += pre.textContent;
                }

                if (copyText) {
                    this.copyToClipboard(copyText, btn);
                }
            });
        });

        // 绑定评测内容点击直接复制事件
        const identityEl = document.getElementById('identity');
        if (identityEl) {
            identityEl.addEventListener('click', (e) => {
                if (e) e.stopPropagation();
                const textToCopy = this.currentIdentity || identityEl.textContent.trim();
                if (!textToCopy || textToCopy === '-') {
                    this.showToast('暂无评测内容可复制');
                    return;
                }
                this.copyToClipboard(textToCopy);
                this.showToast('评测内容已复制到剪贴板');
                identityEl.classList.add('copied-pulse');
                setTimeout(() => identityEl.classList.remove('copied-pulse'), 800);
            });
        }
    }

    showToast(message = '已复制到剪贴板') {
        let toast = document.getElementById('detailToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'detailToast';
            toast.className = 'detail-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.display = 'block';
        void toast.offsetWidth;
        toast.classList.add('show');

        if (this.toastTimeout) {
            clearTimeout(this.toastTimeout);
        }
        this.toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.style.display = 'none';
            }, 250);
        }, 1800);
    }

    copyToClipboard(text, btn) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => {
                if (btn) this.showCopySuccess(btn);
            }).catch(err => {
                this.fallbackCopy(text, btn);
            });
        } else {
            this.fallbackCopy(text, btn);
        }
    }

    fallbackCopy(text, btn) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            if (btn) this.showCopySuccess(btn);
        } catch (err) {
            console.error('复制失败:', err);
        }
        document.body.removeChild(textArea);
    }

    showCopySuccess(btn) {
        if (!btn) return;
        const originalText = btn.textContent;
        btn.textContent = '已复制';
        btn.style.color = '#67c23a';
        btn.style.backgroundColor = '#f0f9eb';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.color = '';
            btn.style.backgroundColor = '';
        }, 1500);
    }

    syntaxHighlightJson(jsonStr) {
        if (!jsonStr) return '';
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

    renderCodeBlock(elementId, rawData) {
        const el = document.getElementById(elementId);
        if (!el) return;
        if (rawData === undefined || rawData === null || rawData === '') {
            el.textContent = '-';
            return;
        }

        if (typeof rawData === 'object') {
            const formatted = JSON.stringify(rawData, null, 2);
            el.innerHTML = this.syntaxHighlightJson(formatted);
            return;
        }

        const str = String(rawData).trim();
        if (!str || str === '-') {
            el.textContent = '-';
            return;
        }

        try {
            const parsed = JSON.parse(str);
            const formatted = JSON.stringify(parsed, null, 2);
            el.innerHTML = this.syntaxHighlightJson(formatted);
        } catch (e) {
            if (/^\s*[\{\[]/.test(str)) {
                el.innerHTML = this.syntaxHighlightJson(str);
            } else {
                el.textContent = str;
            }
        }
    }

    /**
     * 获取 OSS 客户端实例（若用户在系统内配置了凭证）
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

            let region = 'oss-cn-shanghai';
            if (endpoint.includes('.aliyuncs.com')) {
                region = endpoint.split('.aliyuncs.com')[0];
            } else {
                region = endpoint;
            }

            if (typeof OSS === 'undefined') {
                return null;
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

    async loadData() {
        const dataStr = sessionStorage.getItem('detailData');

        if (!dataStr) {
            this.showError('没有传递数据');
            return;
        }

        try {
            const data = JSON.parse(dataStr);
            this.currentData = data;
            sessionStorage.removeItem('detailData');
            await this.renderDetail(data);
        } catch (error) {
            console.error('解析数据失败:', error);
            this.showError('数据解析失败');
        }
    }

    /**
     * 在浏览器新标签页中直接打开 OSS 上的原始 JSON 真实地址（完美支持 JSON-handle 等扩展插件）
     */
    async viewRawJson() {
        if (!this.currentData) {
            this.showToast('暂无数据可查看');
            return;
        }

        try {
            let targetUrl = '';
            const client = this.getOssClient();
            let ossKey = this.currentData.ossKey;

            // 1. 若当前数据对象未直接携带 ossKey，通过业务属性推导
            if (!ossKey) {
                ossKey = await this.resolveOssKey();
            }

            // 2. 根据 ossKey 生成签名或直接链接
            if (ossKey) {
                if (client) {
                    try {
                        targetUrl = client.signatureUrl(ossKey, { expires: 3600 });
                    } catch (e) {
                        console.warn('OSS 签名失败，尝试直链:', e);
                    }
                }
                if (!targetUrl) {
                    const savedConfig = localStorage.getItem('oss_tool_config');
                    let bucket = 'zhongtai-prod';
                    let endpoint = 'oss-cn-shanghai.aliyuncs.com';
                    if (savedConfig) {
                        try {
                            const conf = JSON.parse(savedConfig);
                            if (conf.bucket) bucket = conf.bucket;
                            if (conf.endpoint) {
                                endpoint = conf.endpoint.replace(/^https?:\/\//, '').replace(/\/$/, '');
                            }
                        } catch (_) {}
                    }
                    targetUrl = `https://${bucket}.${endpoint}/${ossKey}`;
                }
            } else if (this.currentData.ossUrl) {
                targetUrl = this.currentData.ossUrl;
            }

            // 3. 打开真实网络地址，浏览器 JSON-handle 插件能自动拦截并美化
            if (targetUrl) {
                const newWindow = window.open(targetUrl, '_blank');
                if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                    const a = document.createElement('a');
                    a.href = targetUrl;
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                }
                this.showToast('已在浏览器打开 OSS 原始 JSON');
                return;
            }

            // 4. 离线/兜底降级：若未找到 OSS 路径则使用 Blob 打开
            const jsonStr = JSON.stringify(this.currentData, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
            const blobUrl = URL.createObjectURL(blob);
            window.open(blobUrl, '_blank');
            setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
            this.showToast('已在新标签页打开原始JSON');
        } catch (e) {
            console.error('打开原始JSON失败:', e);
            this.showToast('打开失败: ' + (e.message || '未知错误'));
        }
    }

    /**
     * 推导当前报告在 OSS 上的文件 key
     */
    async resolveOssKey() {
        const data = this.currentData || {};
        const studentInfo = data.studentInfo || {};
        const userAccount = data.loginName || studentInfo.loginName || data.userId || studentInfo.id || studentInfo.userId || data.searchUsername || '';

        let formattedDate = '';
        const timeStr = data.reportTime || data.report_time || data.errorTime || data.startTime || '';
        if (timeStr) {
            const matchYMD = timeStr.match(/^(\d{4})[_\-](\d{2})[_\-](\d{2})/);
            if (matchYMD) {
                formattedDate = `${matchYMD[1]}_${matchYMD[2]}_${matchYMD[3]}`;
            } else {
                const date = new Date(timeStr.replace(/-/g, '/'));
                if (!isNaN(date.getTime())) {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    formattedDate = `${year}_${month}_${day}`;
                }
            }
        }
        if (!formattedDate && data.searchDate) {
            formattedDate = data.searchDate.replace(/-/g, '_');
        }
        if (!formattedDate) {
            const fallbackDate = sessionStorage.getItem('autoSearchDate') || sessionStorage.getItem('exceptionReportDate') || sessionStorage.getItem('reportDate');
            if (fallbackDate) {
                formattedDate = fallbackDate.replace(/-/g, '_');
            }
        }

        const exceptionType = data.exceptionType || reportTypeMapping[data.reportType] || data.sourceExceptionType || 'dataException';
        const folderName = exceptionTypeMapping[exceptionType] || 'data_error';

        if (formattedDate && userAccount) {
            const prefix = `usertemp/xuelianxitong/${formattedDate}/${userAccount}/${folderName}/`;
            const client = this.getOssClient();
            if (client && data.fileName) {
                try {
                    const listResult = await client.list({
                        prefix: prefix,
                        'max-keys': 50
                    });
                    const objects = listResult.objects || [];
                    const matchedObj = objects.find(obj => obj.name.endsWith(data.fileName));
                    if (matchedObj) {
                        return matchedObj.name;
                    }
                } catch (e) {
                    console.warn('推导检索 OSS Key 失败:', e);
                }
            }
            if (data.fileName) {
                return `${prefix}${data.fileName}`;
            }
            if (data.index !== undefined && data.index !== null) {
                return `${prefix}${data.index}.json`;
            }
        }
        return '';
    }

    /**
     * 格式化时间为中文年月日时分秒 (如：2025年9月3日 9时42分26秒)
     */
    formatDateTime(dateInput) {
        if (!dateInput && dateInput !== 0) return '-';
        const str = String(dateInput).trim();
        if (!str || str === '-') return '-';

        const toCnFormat = (yyyy, mm, dd, hh, mi, ss) => {
            const y = yyyy;
            const m = String(mm).padStart(2, '0');
            const d = String(dd).padStart(2, '0');
            if (hh !== undefined && mi !== undefined && ss !== undefined) {
                const h = String(hh).padStart(2, '0');
                const min = String(mi).padStart(2, '0');
                const s = String(ss).padStart(2, '0');
                return `${y}年${m}月${d}日 ${h}时${min}分${s}秒`;
            }
            return `${y}年${m}月${d}日`;
        };

        // 1. 处理格式: 如 2026_09_03_094226_909 或 2026_09_03_094226 (YYYY_MM_DD_HHmmss 或 YYYY_MM_DD_HHmmss_SSS)
        const matchCompactTime = str.match(/(\d{4})_(\d{2})_(\d{2})_(\d{2})(\d{2})(\d{2})/);
        if (matchCompactTime) {
            return toCnFormat(matchCompactTime[1], matchCompactTime[2], matchCompactTime[3], matchCompactTime[4], matchCompactTime[5], matchCompactTime[6]);
        }

        // 2. 处理格式: 如 2026_09_03_09_42_26 或 2026_09_03_09_42_26_909 (YYYY_MM_DD_HH_mm_ss_...)
        const matchFullUnderscore = str.match(/(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})/);
        if (matchFullUnderscore) {
            return toCnFormat(matchFullUnderscore[1], matchFullUnderscore[2], matchFullUnderscore[3], matchFullUnderscore[4], matchFullUnderscore[5], matchFullUnderscore[6]);
        }

        // 3. 处理格式: 如 2026_09_03 (YYYY_MM_DD)
        const matchDateOnly = str.match(/^(\d{4})_(\d{2})_(\d{2})$/);
        if (matchDateOnly) {
            return toCnFormat(matchDateOnly[1], matchDateOnly[2], matchDateOnly[3]);
        }

        // 4. 处理通用下划线拆分容错
        if (str.includes('_')) {
            const parts = str.split('_');
            if (parts.length >= 4 && parts[0].length === 4) {
                const yyyy = parts[0];
                const mm = parts[1];
                const dd = parts[2];
                if (parts[3].length >= 6) {
                    const hh = parts[3].substring(0, 2);
                    const mi = parts[3].substring(2, 4);
                    const ss = parts[3].substring(4, 6);
                    return toCnFormat(yyyy, mm, dd, hh, mi, ss);
                } else if (parts.length >= 6) {
                    const hh = parts[3];
                    const mi = parts[4];
                    const ss = parts[5];
                    return toCnFormat(yyyy, mm, dd, hh, mi, ss);
                }
            }
        }

        // 5. 处理纯数字: 14位 YYYYMMDDHHmmss 或 17位 YYYYMMDDHHmmssSSS
        const matchDigits = str.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\d{3})?$/);
        if (matchDigits) {
            return toCnFormat(matchDigits[1], matchDigits[2], matchDigits[3], matchDigits[4], matchDigits[5], matchDigits[6]);
        }

        // 6. 处理时间戳 (10位秒级 或 13位毫秒级)
        if (/^\d{10,13}$/.test(str)) {
            let num = parseInt(str, 10);
            if (str.length === 10) num *= 1000;
            const d = new Date(num);
            if (!isNaN(d.getTime())) {
                return toCnFormat(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
            }
        }

        // 7. 处理标准 Date 识别的格式 (如 ISO 字符串、YYYY-MM-DD HH:mm:ss、YYYY/MM/DD 等)
        try {
            let d = new Date(str);
            if (isNaN(d.getTime())) {
                d = new Date(str.replace(/-/g, '/'));
            }
            if (!isNaN(d.getTime())) {
                return toCnFormat(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
            }
        } catch (e) {
            // ignore and fallback
        }

        return str;
    }

    async renderDetail(data) {
        const exceptionType = data.exceptionType || reportTypeMapping[data.reportType] || data.sourceExceptionType || 'dataException';
        const color = exceptionTypeColors[exceptionType] || '#909399';
        const typeName = exceptionTypeNames[exceptionType] || '-';

        const studentInfo = data.studentInfo || {};
        const userAccount = data.loginName || studentInfo.loginName || data.userId || studentInfo.id || studentInfo.userId || data.searchUsername || sessionStorage.getItem('autoSearchUsername') || '';

        document.getElementById('loginName').textContent = data.loginName || studentInfo.loginName || data.userId || userAccount || '-';
        document.getElementById('userId').textContent = data.userId || studentInfo.id || studentInfo.userId || data.loginName || userAccount || '-';
        document.getElementById('nickName').textContent = data.nickName || studentInfo.nickName || '-';
        document.getElementById('schoolName').textContent = studentInfo.shopName || data.shopName || studentInfo.schoolName || data.schoolName || '-';
        document.getElementById('schoolId').textContent = studentInfo.shopId || data.shopId || studentInfo.schoolId || data.schoolId || '-';
        document.getElementById('teacherName').textContent = studentInfo.teacherName || data.teacherName || '-';
        document.getElementById('serviceName').textContent = studentInfo.serviceName || data.serviceName || '-';
        
        const identityEl = document.getElementById('identity');
        const rawIdentity = data.identity || '-';
        this.currentIdentity = rawIdentity;
        if (identityEl) {
            identityEl.innerHTML = `<span class="identity-inner-text" style="color: #f56c6c;">${escapeHtml(rawIdentity)}</span>`;
            if (rawIdentity && rawIdentity !== '-') {
                identityEl.title = `点击直接复制完整评测内容：\n${rawIdentity}`;
            } else {
                identityEl.title = '暂无评测内容';
            }
        }

        const deviceInfo = data.deviceInfo || {};
        const appVersionVal = deviceInfo.versionName || data.versionName || data.version || studentInfo.versionName || '-';
        const deviceNameVal = deviceInfo.deviceName || data.deviceName || studentInfo.deviceName || data.phoneModel || studentInfo.phoneModel || '-';
        const phonePlatformVal = deviceInfo.phonePlatformVersion || data.phonePlatformVersion || studentInfo.phonePlatformVersion || '-';
        const deviceSnVal = deviceInfo.sn || data.sn || studentInfo.sn || '-';

        const isNetworkException = exceptionType === 'networkException' || exceptionType === 'network_error';
        const errorTimeLabelEl = document.getElementById('errorTimeLabel');
        const networkEndTimeItem = document.getElementById('networkEndTimeItem');
        const networkEndTimeEl = document.getElementById('networkEndTime');

        if (isNetworkException) {
            if (errorTimeLabelEl) errorTimeLabelEl.textContent = '网络请求时间';
            const reqTime = data.startTime || data.errorTime || data.reportTime || '-';
            document.getElementById('errorTime').textContent = this.formatDateTime(reqTime);

            if (networkEndTimeItem && networkEndTimeEl) {
                networkEndTimeItem.style.display = 'flex';
                networkEndTimeEl.textContent = this.formatDateTime(data.endTime || '-');
            }
        } else {
            if (errorTimeLabelEl) errorTimeLabelEl.textContent = '错误时间';
            document.getElementById('errorTime').textContent = this.formatDateTime(data.errorTime || data.reportTime || '-');

            if (networkEndTimeItem) {
                networkEndTimeItem.style.display = 'none';
            }
        }
        const typeClass = typeToClass[exceptionType] || 'other';
        document.getElementById('status').innerHTML = `<span class="type-badge ${typeClass}">${escapeHtml(typeName)}</span>`;
        document.getElementById('appVersion').textContent = appVersionVal;
        document.getElementById('deviceName').textContent = deviceNameVal;
        document.getElementById('phonePlatformVersion').textContent = phonePlatformVal;
        const deviceSnEl = document.getElementById('deviceSn');
        if (deviceSnEl) deviceSnEl.textContent = deviceSnVal;
        document.getElementById('reportTime').textContent = this.formatDateTime(data.reportTime || data.report_time);
        this.renderCodeBlock('errorData', data.errorData);
        this.renderCodeBlock('stackTrace', data.stackTrace);

        const mediaContentItem = document.getElementById('mediaContentItem');
        const mediaContentEl = document.getElementById('mediaContent');
        const mediaUrlItem = document.getElementById('mediaUrlItem');
        const mediaUrlEl = document.getElementById('mediaUrl');
        if (exceptionType === 'audioVideoException' || exceptionType === 'audioVideoTest') {
            if (mediaContentItem && mediaContentEl) {
                mediaContentItem.style.display = 'flex';
                let contentVal = data.content !== undefined && data.content !== null ? data.content : (data.studentInfo && data.studentInfo.content);
                if (contentVal !== undefined && contentVal !== null && contentVal !== '') {
                    mediaContentEl.textContent = typeof contentVal === 'object' ? JSON.stringify(contentVal) : contentVal;
                } else {
                    mediaContentEl.textContent = '-';
                }
            }
            if (mediaUrlItem && mediaUrlEl) {
                mediaUrlItem.style.display = 'flex';
                const url = data.mediaUrl || '-';
                if (url && url !== '-') {
                    mediaUrlEl.innerHTML = `<a href="${url}" target="_blank" style="color: #409eff; text-decoration: none; word-break: break-all;">${url}</a>`;
                } else {
                    mediaUrlEl.textContent = '-';
                }
            }
        } else {
            if (mediaContentItem) {
                mediaContentItem.style.display = 'none';
            }
            if (mediaUrlItem) {
                mediaUrlItem.style.display = 'none';
            }
        }

        const sceneTypeEl = document.getElementById('sceneType');
        if (sceneTypeEl) {
            const sceneTypeValue = data.sceneType || (data.studentInfo && data.studentInfo.sceneType);
            if (sceneTypeValue) {
                sceneTypeEl.textContent = sceneTypeValue;
                sceneTypeEl.style.display = 'inline-block';
            } else {
                sceneTypeEl.style.display = 'none';
            }
        }

        let scheduleTaskStr = '-';
        let studyTextbook = '-';

        if (data.scheduleTask) {
            let taskObj = null;
            if (typeof data.scheduleTask === 'object') {
                taskObj = data.scheduleTask;
            } else if (typeof data.scheduleTask === 'string') {
                try {
                    taskObj = JSON.parse(data.scheduleTask);
                } catch (e) {
                    console.error('Failed to parse scheduleTask JSON string:', e);
                }
            }

            if (taskObj) {
                scheduleTaskStr = JSON.stringify(taskObj, null, 2);
                try {
                    if (taskObj.trainingContentSummary && taskObj.trainingContentSummary.studyTextBookList) {
                        const list = taskObj.trainingContentSummary.studyTextBookList;
                        if (Array.isArray(list) && list.length > 0) {
                            studyTextbook = list.map(item => item.groupLabel).filter(Boolean).join(', ');
                        }
                    }
                } catch (e) {
                    console.error('Failed to extract studyTextBookList groupLabel:', e);
                }
            } else {
                scheduleTaskStr = data.scheduleTask;
            }
        }

        this.renderCodeBlock('scheduleTask', scheduleTaskStr);

        const studyTextbookEl = document.getElementById('studyTextbook');
        studyTextbookEl.textContent = studyTextbook || '-';
        const headerEl = studyTextbookEl.parentElement;
        if (studyTextbook && studyTextbook !== '-') {
            headerEl.style.display = 'flex';
        } else {
            headerEl.style.display = 'none';
        }

        let learningDetailStr = '-';
        if (data.learningDetail) {
            if (typeof data.learningDetail === 'object') {
                learningDetailStr = JSON.stringify(data.learningDetail, null, 2);
            } else if (typeof data.learningDetail === 'string') {
                try {
                    learningDetailStr = JSON.stringify(JSON.parse(data.learningDetail), null, 2);
                } catch (e) {
                    learningDetailStr = data.learningDetail;
                }
            }
        }
        this.renderCodeBlock('learningDetail', learningDetailStr);

        let studentInfoStr = '-';
        if (data.studentInfo) {
            if (typeof data.studentInfo === 'object') {
                studentInfoStr = JSON.stringify(data.studentInfo, null, 2);
            } else if (typeof data.studentInfo === 'string') {
                try {
                    studentInfoStr = JSON.stringify(JSON.parse(data.studentInfo), null, 2);
                } catch (e) {
                    studentInfoStr = data.studentInfo;
                }
            }
        }
        this.renderCodeBlock('studentInfoDetail', studentInfoStr);

        if (exceptionType === 'evaluationException') {
            const crashSection = document.getElementById('crashSection');
            const downloadBtn = document.getElementById('downloadCrashBtn');
            const operationItem = downloadBtn.parentElement;

            crashSection.style.display = 'block';
            operationItem.style.display = 'flex';
            downloadBtn.style.display = 'inline-block';

            // 1. 获取账号/用户名 (多重回退，彻底解决 undefined 问题)
            const userAccount = data.loginName || studentInfo.loginName || data.userId || studentInfo.id || studentInfo.userId || data.searchUsername || sessionStorage.getItem('autoSearchUsername') || '';

            // 2. 获取格式化日期 (如 2026_10_16)
            const timeStr = data.reportTime || data.errorTime;
            let formattedDate = '';
            if (timeStr) {
                if (timeStr.includes('_')) {
                    formattedDate = timeStr.split('_').slice(0, 3).join('_');
                } else {
                    const date = new Date(timeStr.replace(/-/g, '/'));
                    if (!isNaN(date.getTime())) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        formattedDate = `${year}_${month}_${day}`;
                    }
                }
            }
            if (!formattedDate && data.searchDate) {
                formattedDate = data.searchDate.replace(/-/g, '_');
            }
            if (!formattedDate) {
                const fallbackDate = sessionStorage.getItem('autoSearchDate') || sessionStorage.getItem('exceptionReportDate') || sessionStorage.getItem('reportDate');
                if (fallbackDate) {
                    formattedDate = fallbackDate.replace(/-/g, '_');
                }
            }

            if (formattedDate && userAccount) {
                let timestamp = '';
                if (data.fileName) {
                    const match = data.fileName.match(/_(\d{4}_\d{2}_\d{2}_\d+)(?:\.json)?$/);
                    if (match) {
                        timestamp = match[1];
                    }
                }
                if (!timestamp && data.reportTime && data.reportTime.includes('_')) {
                    timestamp = data.reportTime;
                }

                let expectedFileName = `crash_${data.index}.txt`;
                if (timestamp) {
                    expectedFileName = `crash_${timestamp}.txt`;
                }

                const crashPrefix = `usertemp/xuelianxitong/${formattedDate}/${userAccount}/evaluation_crash/`;
                let targetKey = `${crashPrefix}${expectedFileName}`;
                let actualFileName = expectedFileName;
                let targetDownloadUrl = `https://zhongtai-prod.oss-cn-shanghai.aliyuncs.com/${targetKey}`;

                const client = this.getOssClient();
                if (client) {
                    try {
                        const listResult = await client.list({
                            prefix: crashPrefix,
                            'max-keys': 50
                        });
                        const objects = listResult.objects || [];
                        if (objects.length > 0) {
                            let matchedObj = objects.find(obj => obj.name.endsWith(expectedFileName));
                            if (!matchedObj && timestamp) {
                                matchedObj = objects.find(obj => obj.name.includes(timestamp));
                            }
                            if (!matchedObj) {
                                matchedObj = objects[0];
                            }
                            if (matchedObj) {
                                targetKey = matchedObj.name;
                                actualFileName = targetKey.split('/').pop() || expectedFileName;
                            }
                        }
                        targetDownloadUrl = client.signatureUrl(targetKey, { expires: 3600 });
                    } catch (listErr) {
                        console.warn('列出 OSS crash 文件异常，尝试直接签名:', listErr);
                        try {
                            targetDownloadUrl = client.signatureUrl(targetKey, { expires: 3600 });
                        } catch (_) {}
                    }
                }

                console.log('crash目标Key:', targetKey, '下载URL:', targetDownloadUrl);

                // 绑定点击下载事件：同时下载一份并在浏览器新窗口打开浏览
                downloadBtn.onclick = () => {
                    const crashData = downloadBtn.dataset.crashData;
                    let previewUrl = targetDownloadUrl;
                    let viewBlobUrl = null;

                    if (!previewUrl && crashData) {
                        viewBlobUrl = URL.createObjectURL(new Blob([crashData], { type: 'text/plain;charset=utf-8' }));
                        previewUrl = viewBlobUrl;
                    }

                    // 1. 在浏览器新标签页中打开浏览
                    if (previewUrl) {
                        window.open(previewUrl, '_blank');
                    }

                    // 2. 同时在本地下载一份文件
                    if (crashData) {
                        const downloadBlob = new Blob([crashData], { type: 'text/plain;charset=utf-8' });
                        const downloadUrl = URL.createObjectURL(downloadBlob);
                        const a = document.createElement('a');
                        a.href = downloadUrl;
                        a.download = actualFileName;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        setTimeout(() => {
                            URL.revokeObjectURL(downloadUrl);
                            if (viewBlobUrl) URL.revokeObjectURL(viewBlobUrl);
                        }, 60000);
                        this.showToast('已在新标签页打开预览，并同时下载: ' + actualFileName);
                    } else if (targetDownloadUrl) {
                        const a = document.createElement('a');
                        a.href = targetDownloadUrl;
                        a.download = actualFileName;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        this.showToast('已在新标签页打开预览，并开始下载: ' + actualFileName);
                    } else {
                        alert('暂无可用的评测 crash 文件地址');
                    }
                };

                // 获取 crash 内容展示
                try {
                    let crashContent = '';
                    if (client) {
                        try {
                            const res = await client.get(targetKey);
                            if (res && res.content) {
                                crashContent = res.content.toString();
                            }
                        } catch (getErr) {
                            console.warn('client.get 获取失败，尝试 fetch:', getErr);
                        }
                    }

                    if (!crashContent && targetDownloadUrl) {
                        const response = await fetch(targetDownloadUrl);
                        if (response.ok) {
                            crashContent = await response.text();
                        }
                    }

                    if (crashContent) {
                        this.renderCodeBlock('crashData', crashContent);
                        downloadBtn.dataset.crashData = crashContent;
                    } else {
                        document.getElementById('crashData').textContent = '未检索到该时间段的评测 crash 数据文件';
                    }
                } catch (error) {
                    console.error('获取crash数据失败:', error);
                    document.getElementById('crashData').textContent = '获取失败: ' + (error.message || error);
                }
            } else {
                document.getElementById('crashData').textContent = '无有效账号或日期信息，无法定位评测crash文件';
                downloadBtn.onclick = () => {
                    alert('缺少账号或日期信息，无法下载评测 crash 文件');
                };
            }
        }
    }

    showError(message) {
        document.body.innerHTML = `
            <div class="container" style="text-align: center; padding: 50px;">
                <h2 style="color: #f56c6c;">${message}</h2>
                <button onclick="sessionStorage.setItem('fromHomeDetail', 'true'); if (window.history.length > 1) { window.history.back(); } else { window.location.href='../singleQuery/singleQuery.html'; }" style="margin-top: 20px; padding: 10px 20px; background: #409eff; color: #fff; border: none; border-radius: 4px; cursor: pointer;">返回</button>
            </div>
        `;
    }
}

function notifySingleQueryMenu() {
    try {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({ action: 'syncMenu', activeMenu: 'singleQuery/singleQuery.html' }, '*');
        }
    } catch (_) { }
    try {
        if (window.parent && window.parent !== window && typeof window.parent.updateActiveMenu === 'function') {
            window.parent.updateActiveMenu('singleQuery/singleQuery.html');
        }
    } catch (_) { }
}

document.addEventListener('DOMContentLoaded', () => {
    notifySingleQueryMenu();
    new DetailApp();
});

window.addEventListener('pageshow', notifySingleQueryMenu);