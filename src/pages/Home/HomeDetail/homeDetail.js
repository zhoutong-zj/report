const exceptionTypeNames = {
    'dataException': '数据异常',
    'platformException': '平台异常',
    'otherException': '其他异常',
    'evaluationException': '评测异常',
    'audioVideoException': '音视频异常'
};

const exceptionTypeColors = {
    'dataException': '#e5837a',
    'platformException': '#f5a623',
    'otherException': '#909090',
    'evaluationException': '#48e59e',
    'audioVideoException': '#ab47bc'
};

const reportTypeMapping = {
    0: 'dataException',
    1: 'platformException',
    2: 'otherException',
    3: 'evaluationException',
    4: 'audioVideoException'
};

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
        backBtn.addEventListener('click', () => {
            window.location.href = '../singleQuery/singleQuery.html';
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
    }

    copyToClipboard(text, btn) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => {
                this.showCopySuccess(btn);
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
            this.showCopySuccess(btn);
        } catch (err) {
            console.error('复制失败:', err);
        }
        document.body.removeChild(textArea);
    }

    showCopySuccess(btn) {
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

    async loadData() {
        const dataStr = sessionStorage.getItem('detailData');

        if (!dataStr) {
            this.showError('没有传递数据');
            return;
        }

        try {
            const data = JSON.parse(dataStr);
            sessionStorage.removeItem('detailData');
            await this.renderDetail(data);
        } catch (error) {
            console.error('解析数据失败:', error);
            this.showError('数据解析失败');
        }
    }

    /**
     * 格式化时间为中文年月日时分秒 (如：2025年9月3日 9时42分26秒)
     */
    formatDateTime(dateInput) {
        if (!dateInput && dateInput !== 0) return '-';
        const str = String(dateInput).trim();
        if (!str || str === '-') return '-';

        const toCnFormat = (yyyy, mm, dd, hh, mi, ss) => {
            const y = parseInt(yyyy, 10);
            const m = parseInt(mm, 10);
            const d = parseInt(dd, 10);
            if (hh !== undefined && mi !== undefined && ss !== undefined) {
                const h = parseInt(hh, 10);
                const min = parseInt(mi, 10);
                const s = parseInt(ss, 10);
                return `${y}年${m}月${d}日 ${h}时${min}分${s}秒`;
            }
            return `${y}年${m}月${d}日`;
        };

        // 1. 处理格式: 如 2026_09_03_094226_909 或 2026_09_03_094226 (YYYY_MM_DD_HHmmss 或 YYYY_MM_DD_HHmmss_SSS)
        const matchCompactTime = str.match(/^(\d{4})_(\d{2})_(\d{2})_(\d{2})(\d{2})(\d{2})(?:_\d+)?$/);
        if (matchCompactTime) {
            return toCnFormat(matchCompactTime[1], matchCompactTime[2], matchCompactTime[3], matchCompactTime[4], matchCompactTime[5], matchCompactTime[6]);
        }

        // 2. 处理格式: 如 2026_09_03_09_42_26 或 2026_09_03_09_42_26_909 (YYYY_MM_DD_HH_mm_ss_...)
        const matchFullUnderscore = str.match(/^(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})(?:_\d+)?$/);
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

        document.getElementById('loginName').textContent = data.loginName || studentInfo.loginName || '-';
        document.getElementById('userId').textContent = data.userId || studentInfo.id || studentInfo.userId || '-';
        document.getElementById('nickName').textContent = data.nickName || studentInfo.nickName || '-';
        document.getElementById('schoolName').textContent = studentInfo.schoolName || data.schoolName || '-';
        document.getElementById('schoolId').textContent = studentInfo.schoolId || data.schoolId || '-';
        document.getElementById('teacherName').textContent = studentInfo.teacherName || data.teacherName || '-';
        document.getElementById('serviceName').textContent = studentInfo.serviceName || data.serviceName || '-';
        document.getElementById('identity').innerHTML = `<span style="color: #f56c6c;">${data.identity || '-'}</span>`;
        document.getElementById('errorTime').textContent = data.errorTime || '-';
        document.getElementById('status').innerHTML = `<span style="background-color: ${color}; color: #fff; padding: 4px 8px; border-radius: 4px;">${typeName}</span>`;
        document.getElementById('appVersion').textContent = data.versionName || data.version || '-';
        document.getElementById('deviceName').textContent = data.deviceName || studentInfo.deviceName || '-';
        document.getElementById('phonePlatformVersion').textContent = data.phonePlatformVersion || studentInfo.phonePlatformVersion || '-';
        document.getElementById('reportTime').textContent = this.formatDateTime(data.reportTime || data.report_time);
        document.getElementById('errorData').textContent = data.errorData || '-';
        document.getElementById('stackTrace').textContent = data.stackTrace || '-';

        const mediaContentItem = document.getElementById('mediaContentItem');
        const mediaContentEl = document.getElementById('mediaContent');
        const mediaUrlItem = document.getElementById('mediaUrlItem');
        const mediaUrlEl = document.getElementById('mediaUrl');
        if (exceptionType === 'audioVideoException') {
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

        document.getElementById('scheduleTask').textContent = scheduleTaskStr;

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
        document.getElementById('learningDetail').textContent = learningDetailStr;

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
        document.getElementById('studentInfoDetail').textContent = studentInfoStr;

        if (exceptionType === 'evaluationException') {
            const crashSection = document.getElementById('crashSection');
            const downloadBtn = document.getElementById('downloadCrashBtn');
            const operationItem = downloadBtn.parentElement;

            crashSection.style.display = 'block';
            operationItem.style.display = 'flex';
            downloadBtn.style.display = 'inline-block';

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

            if (formattedDate) {
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

                let crashFileName = `crash_${data.index}.txt`;
                if (timestamp) {
                    crashFileName = `crash_${timestamp}.txt`;
                }
                const crashUrl = `https://zhongtai-prod.oss-cn-shanghai.aliyuncs.com/usertemp/xuelianxitong/${formattedDate}/${data.loginName}/evaluation_crash/${crashFileName}`;
                console.log('crash请求URL:', crashUrl);

                // Set up event listener immediately so that it works as a fallback even if fetch fails/CORS blocks
                downloadBtn.addEventListener('click', () => {
                    if (downloadBtn.dataset.crashData) {
                        const blob = new Blob([downloadBtn.dataset.crashData], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = crashFileName;
                        a.click();
                        URL.revokeObjectURL(url);
                    } else {
                        const a = document.createElement('a');
                        a.href = crashUrl;
                        a.target = '_blank';
                        a.download = crashFileName;
                        a.click();
                    }
                });

                try {
                    const response = await fetch(crashUrl);
                    if (response.ok) {
                        const crashData = await response.text();
                        document.getElementById('crashData').textContent = crashData;
                        downloadBtn.dataset.crashData = crashData;
                    } else {
                        document.getElementById('crashData').textContent = '无数据';
                    }
                } catch (error) {
                    console.error('获取crash数据失败:', error);
                    document.getElementById('crashData').textContent = '获取失败';
                }
            } else {
                document.getElementById('crashData').textContent = '无有效时间数据';
            }
        }
    }

    showError(message) {
        document.body.innerHTML = `
            <div class="container" style="text-align: center; padding: 50px;">
                <h2 style="color: #f56c6c;">${message}</h2>
                <button onclick="window.location.href='../singleQuery/singleQuery.html'" style="margin-top: 20px; padding: 10px 20px; background: #409eff; color: #fff; border: none; border-radius: 4px; cursor: pointer;">返回</button>
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DetailApp();
});