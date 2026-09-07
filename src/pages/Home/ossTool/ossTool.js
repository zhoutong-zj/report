document.addEventListener('DOMContentLoaded', () => {
    // === 1. Tab Switching Logic ===
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });

    // === 2. Credentials Configuration Management ===
    const accessKeyIdInput = document.getElementById('accessKeyId');
    const accessKeySecretInput = document.getElementById('accessKeySecret');
    const endpointInput = document.getElementById('endpoint');
    const bucketInput = document.getElementById('bucket');
    const saveConfigBtn = document.getElementById('saveConfigBtn');
    const clearConfigBtn = document.getElementById('clearConfigBtn');

    // Load saved configuration from localStorage
    function loadSavedConfig() {
        const savedConfig = localStorage.getItem('oss_tool_config');
        if (savedConfig) {
            try {
                const config = JSON.parse(savedConfig);
                accessKeyIdInput.value = config.accessKeyId || '';
                accessKeySecretInput.value = config.accessKeySecret || '';
                endpointInput.value = config.endpoint || 'oss-cn-shanghai.aliyuncs.com';
                bucketInput.value = config.bucket || 'zhongtai-prod';
            } catch (e) {
                console.error('Failed to parse saved config:', e);
            }
        }
    }

    loadSavedConfig();

    // Save config
    saveConfigBtn.addEventListener('click', () => {
        const config = {
            accessKeyId: accessKeyIdInput.value.trim(),
            accessKeySecret: accessKeySecretInput.value.trim(),
            endpoint: endpointInput.value.trim(),
            bucket: bucketInput.value.trim()
        };

        if (!config.accessKeyId || !config.accessKeySecret || !config.endpoint || !config.bucket) {
            alert('请完整填写所有 OSS 凭证配置！');
            return;
        }

        localStorage.setItem('oss_tool_config', JSON.stringify(config));
        alert('配置保存成功！');
    });

    // Clear config
    clearConfigBtn.addEventListener('click', () => {
        if (confirm('确定要清除保存的凭证配置吗？')) {
            localStorage.removeItem('oss_tool_config');
            accessKeyIdInput.value = '';
            accessKeySecretInput.value = '';
            endpointInput.value = 'oss-cn-shanghai.aliyuncs.com';
            bucketInput.value = 'zhongtai-prod';
            alert('配置已清除！');
        }
    });

    // Get OSS Client instance
    function getOssClient() {
        const accessKeyId = accessKeyIdInput.value.trim();
        const accessKeySecret = accessKeySecretInput.value.trim();
        const endpoint = endpointInput.value.trim();
        const bucket = bucketInput.value.trim();

        if (!accessKeyId || !accessKeySecret || !endpoint || !bucket) {
            alert('请先在左侧配置并保存 OSS 凭证！');
            return null;
        }

        // 动态提取 region (例如 "oss-cn-shanghai.aliyuncs.com" -> "oss-cn-shanghai")
        let region = 'oss-cn-shanghai';
        if (endpoint.includes('.aliyuncs.com')) {
            region = endpoint.split('.aliyuncs.com')[0];
        } else {
            region = endpoint;
        }

        // Initialize Aliyun OSS Client from the CDN library
        try {
            return new OSS({
                region: region,
                accessKeyId: accessKeyId,
                accessKeySecret: accessKeySecret,
                bucket: bucket,
                secure: true // Always use https
            });
        } catch (error) {
            alert('创建 OSS 客户端失败，请检查配置参数。错误: ' + error.message);
            return null;
        }
    }

    // === 3. Query & Manage Logic ===
    const queryPrefixInput = document.getElementById('queryPrefix');
    const uploadPrefixInput = document.getElementById('uploadPrefix');
    const queryDateInput = document.getElementById('queryDate');
    const queryBtn = document.getElementById('queryBtn');
    const ossFileList = document.getElementById('ossFileList');

    // Initialize Date Input with Today's Date
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    queryDateInput.value = todayStr;

    // Helper to update query and upload prefixes based on selected date
    function updatePrefixesWithDate(dateStr) {
        const formattedDate = dateStr.replace(/-/g, '_');
        queryPrefixInput.value = `usertemp/xuelianxitong/${formattedDate}/`;
        if (uploadPrefixInput) {
            uploadPrefixInput.value = `usertemp/xuelianxitong/${formattedDate}/`;
        }
    }

    // Set initial prefix values on load
    updatePrefixesWithDate(todayStr);

    // Update prefixes dynamically when date changes
    queryDateInput.addEventListener('change', (e) => {
        updatePrefixesWithDate(e.target.value);
    });

    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function formatDate(dateStr) {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleString('zh-CN', { hour12: false });
    }

    // List files under prefix
    async function listOssFiles() {
        const client = getOssClient();
        if (!client) return;

        let prefix = queryPrefixInput.value.trim();
        // Ensure prefix doesn't start with /
        if (prefix.startsWith('/')) {
            prefix = prefix.substring(1);
            queryPrefixInput.value = prefix;
        }

        ossFileList.innerHTML = '<tr><td colspan="5" class="empty-row" style="color: #409eff;">正在拉取文件列表，请稍候...</td></tr>';

        try {
            const result = await client.list({
                prefix: prefix,
                'max-keys': 1000
            });

            ossFileList.innerHTML = '';
            const objects = result.objects || [];

            if (objects.length === 0) {
                ossFileList.innerHTML = '<tr><td colspan="5" class="empty-row">该前缀目录下没有找到任何文件</td></tr>';
                return;
            }

            objects.forEach((obj, idx) => {
                const tr = document.createElement('tr');
                
                // Get sign URL for download
                const downloadUrl = client.signatureUrl(obj.name, { expires: 3600 });

                tr.innerHTML = `
                    <td>${idx + 1}</td>
                    <td style="font-family: monospace; font-size: 12px; max-width: 400px; word-break: break-all;">${obj.name}</td>
                    <td>${formatBytes(obj.size)}</td>
                    <td>${formatDate(obj.lastModified)}</td>
                    <td style="text-align: center;">
                        <a href="${downloadUrl}" target="_blank" download class="action-link">下载</a>
                        <span class="action-link delete" data-key="${obj.name}">删除</span>
                    </td>
                `;

                // Bind delete event
                tr.querySelector('.delete').addEventListener('click', async (e) => {
                    const fileKey = e.target.getAttribute('data-key');
                    if (confirm(`您确定要永久删除此文件吗？\n路径: ${fileKey}`)) {
                        try {
                            await client.delete(fileKey);
                            alert('文件删除成功！');
                            listOssFiles(); // Refresh
                        } catch (err) {
                            alert('删除失败，错误: ' + err.message);
                        }
                    }
                });

                ossFileList.appendChild(tr);
            });

        } catch (error) {
            console.error('List objects error:', error);
            ossFileList.innerHTML = `<tr><td colspan="5" class="empty-row" style="color: #f56c6c;">获取文件列表失败，请检查密钥权限、跨域(CORS)配置及网络环境。<br><small>${error.message}</small></td></tr>`;
        }
    }

    queryBtn.addEventListener('click', listOssFiles);

    // === 4. Folder Selection & Upload Queue Logic ===
    const folderInput = document.getElementById('folderInput');
    const selectFolderBtn = document.getElementById('selectFolderBtn');
    const dropZone = document.getElementById('dropZone');
    const progressPanel = document.getElementById('progressPanel');
    const progressCount = document.getElementById('progressCount');
    const progressPercent = document.getElementById('progressPercent');
    const progressBarFill = document.getElementById('progressBarFill');
    const startUploadBtn = document.getElementById('startUploadBtn');
    const clearQueueBtn = document.getElementById('clearQueueBtn');
    const queueList = document.getElementById('queueList');
    const queueCountEl = document.getElementById('queueCount');

    let uploadQueue = [];
    let isUploading = false;

    // Trigger input file click
    selectFolderBtn.addEventListener('click', () => {
        folderInput.click();
    });

    // Input change handler (Folder select)
    folderInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            addFilesToQueue(files);
        }
        folderInput.value = ''; // Reset
    });

    // Drag and Drop Handlers
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');

        const items = e.dataTransfer.items;
        if (!items) return;

        const files = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i].webkitGetAsEntry();
            if (item) {
                const entryFiles = await traverseFileTree(item);
                files.push(...entryFiles);
            }
        }

        if (files.length > 0) {
            addFilesToQueue(files);
        }
    });

    // Traverse directory tree recursively in browser drag-and-drop
    async function traverseFileTree(item, path = '') {
        return new Promise((resolve) => {
            if (item.isFile) {
                item.file((file) => {
                    // Set relativePath compatible with input.files webkitRelativePath
                    file.relativePath = path + file.name;
                    resolve([file]);
                });
            } else if (item.isDirectory) {
                const dirReader = item.createReader();
                const allFiles = [];
                
                // Read all entries recursively
                const readEntries = () => {
                    dirReader.readEntries(async (entries) => {
                        if (entries.length === 0) {
                            resolve(allFiles);
                        } else {
                            for (let i = 0; i < entries.length; i++) {
                                const files = await traverseFileTree(entries[i], path + item.name + '/');
                                allFiles.push(...files);
                            }
                            readEntries(); // Continue reading in case of pagination
                        }
                    });
                };
                readEntries();
            }
        });
    }

    // Add selected files to queue
    function addFilesToQueue(files) {
        if (isUploading) {
            alert('当前正在上传，请等待完成后再添加！');
            return;
        }

        let uploadPrefix = uploadPrefixInput.value.trim();
        // Ensure prefix ends with / if not empty
        if (uploadPrefix && !uploadPrefix.endsWith('/')) {
            uploadPrefix += '/';
            uploadPrefixInput.value = uploadPrefix;
        }

        files.forEach(file => {
            // Get path relative to the selected root directory
            const relativePath = file.relativePath || file.webkitRelativePath || file.name;
            const fileKey = uploadPrefix + relativePath;

            // Avoid duplicate additions
            if (uploadQueue.some(item => item.key === fileKey)) {
                return;
            }

            uploadQueue.push({
                file: file,
                key: fileKey,
                name: file.name,
                relativePath: relativePath,
                size: file.size,
                status: 'pending',
                error: ''
            });
        });

        renderQueue();
    }

    // Render Queue in UI
    function renderQueue() {
        queueCountEl.textContent = uploadQueue.length;
        
        if (uploadQueue.length === 0) {
            queueList.innerHTML = '<div class="empty-queue">暂无待上传文件，请先选择文件夹</div>';
            progressPanel.style.display = 'none';
            return;
        }

        progressPanel.style.display = 'block';
        // Reset progress fill values visually if not uploading
        if (!isUploading) {
            progressCount.textContent = `已添加 ${uploadQueue.length} 个文件，准备就绪`;
            progressPercent.textContent = '0%';
            progressBarFill.style.width = '0%';
        }

        queueList.innerHTML = '';
        uploadQueue.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'queue-item';

            let statusLabel = '排队中';
            let statusClass = 'pending';
            if (item.status === 'uploading') {
                statusLabel = '上传中...';
                statusClass = 'uploading';
            } else if (item.status === 'success') {
                statusLabel = '已完成';
                statusClass = 'success';
            } else if (item.status === 'error') {
                statusLabel = '失败: ' + item.error;
                statusClass = 'error';
            }

            div.innerHTML = `
                <div class="queue-item-left">
                    <span class="queue-filename">${item.name} (${formatBytes(item.size)})</span>
                    <span class="queue-filepath">目标OSS: ${item.key}</span>
                </div>
                <span class="queue-status ${statusClass}">${statusLabel}</span>
            `;
            queueList.appendChild(div);
        });
    }

    // Clear Upload Queue
    clearQueueBtn.addEventListener('click', () => {
        if (isUploading) {
            alert('上传进行中，请先等待上传结束！');
            return;
        }
        uploadQueue = [];
        renderQueue();
    });

    // Start Sequential Upload Queue
    startUploadBtn.addEventListener('click', async () => {
        if (isUploading) return;
        
        const client = getOssClient();
        if (!client) return;

        const pendingItems = uploadQueue.filter(item => item.status === 'pending' || item.status === 'error');
        if (pendingItems.length === 0) {
            alert('队列中没有等待上传的文件！');
            return;
        }

        isUploading = true;
        startUploadBtn.disabled = true;
        clearQueueBtn.disabled = true;

        let successCount = uploadQueue.filter(item => item.status === 'success').length;
        const totalCount = uploadQueue.length;

        // Function to update status in UI
        const updateOverallProgress = () => {
            const percent = Math.round((successCount / totalCount) * 100);
            progressPercent.textContent = `${percent}%`;
            progressBarFill.style.width = `${percent}%`;
            progressCount.textContent = `已上传 ${successCount} / ${totalCount} 个文件`;
        };

        updateOverallProgress();

        // Sequential Upload Loop
        for (let i = 0; i < uploadQueue.length; i++) {
            const item = uploadQueue[i];
            if (item.status === 'success') continue;

            item.status = 'uploading';
            renderQueue();

            try {
                // Upload directly using PUT api of ali-oss SDK
                await client.put(item.key, item.file);
                item.status = 'success';
                successCount++;
            } catch (err) {
                console.error('Upload failed for key:', item.key, err);
                item.status = 'error';
                item.error = err.message || '上传异常';
            }

            updateOverallProgress();
            renderQueue();
        }

        isUploading = false;
        startUploadBtn.disabled = false;
        clearQueueBtn.disabled = false;

        alert(`上传结束！成功: ${successCount}，失败: ${totalCount - successCount}`);
        
        // Sync search panel default view in case they uploaded to active view
        const currentQueryPrefix = queryPrefixInput.value.trim();
        const currentUploadPrefix = uploadPrefixInput.value.trim();
        if (currentUploadPrefix.startsWith(currentQueryPrefix)) {
            listOssFiles(); // Automatically refresh list if paths overlap
        }
    });
});
