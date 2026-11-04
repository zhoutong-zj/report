/**
 * mapHelper.js - 地图通用工具与弹窗组件
 * 采用 Leaflet + 高德官方免鉴权高清切片瓦片（彻底解决无Key/安全密钥报错导致的底图空白无图问题）
 * 支持全国道路、建筑物、学校中文地标完整显示，毫秒级极速渲染
 */

(function (window) {
    'use strict';

    const MapHelper = {
        _leafletLoadedPromise: null,

        /**
         * 动态异步加载 Leaflet 引擎库与样式
         */
        loadLeaflet() {
            if (window.L) {
                return Promise.resolve(window.L);
            }
            if (this._leafletLoadedPromise) {
                return this._leafletLoadedPromise;
            }

            this._leafletLoadedPromise = new Promise((resolve, reject) => {
                // 加载 CSS
                if (!document.getElementById('leaflet-css')) {
                    const link = document.createElement('link');
                    link.id = 'leaflet-css';
                    link.rel = 'stylesheet';
                    link.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
                    document.head.appendChild(link);
                }

                // 加载 JS
                const script = document.createElement('script');
                script.type = 'text/javascript';
                script.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
                script.onload = () => {
                    if (window.L) {
                        resolve(window.L);
                    } else {
                        reject(new Error('Leaflet 初始化失败'));
                    }
                };
                script.onerror = () => {
                    // 降级 CDN 尝试
                    const fallbackScript = document.createElement('script');
                    fallbackScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                    fallbackScript.onload = () => {
                        if (window.L) resolve(window.L);
                        else reject(new Error('Leaflet 降级加载失败'));
                    };
                    fallbackScript.onerror = (e) => reject(e);
                    document.head.appendChild(fallbackScript);
                };
                document.head.appendChild(script);
            });

            return this._leafletLoadedPromise;
        },

        /**
         * 创建高德官方高清标准路网切片图层（免 Key、绝不白板）
         */
        createAmapTileLayer(L) {
            return L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
                subdomains: ['1', '2', '3', '4'],
                minZoom: 3,
                maxZoom: 18,
                attribution: '© 高德地图 AutoNavi'
            });
        },

        /**
         * 计算两点间的大致球面距离（单位：米）
         */
        getDistance(lat1, lng1, lat2, lng2) {
            const radLat1 = (lat1 * Math.PI) / 180;
            const radLat2 = (lat2 * Math.PI) / 180;
            const a = radLat1 - radLat2;
            const b = ((lng1 - lng2) * Math.PI) / 180;
            const s = 2 * Math.asin(Math.sqrt(Math.pow(Math.sin(a / 2), 2) +
                Math.cos(radLat1) * Math.cos(radLat2) * Math.pow(Math.sin(b / 2), 2)));
            return s * 6378137;
        },

        /**
         * 需求一核心算法：将同学校由于学生GPS微小漂移/不同教学楼上报的偏差经纬度合并为一个学校中心点
         */
        aggregateSchoolLocations(records) {
            const schoolMap = {};

            (records || []).forEach(item => {
                const schoolKey = (item.schoolId && item.schoolId !== '-') ? item.schoolId : (item.schoolName || item.shopName || '未知学校');
                const schoolName = (item.schoolName && item.schoolName !== '-') ? item.schoolName : (item.shopName || schoolKey);

                if (!schoolMap[schoolKey]) {
                    schoolMap[schoolKey] = {
                        schoolId: item.schoolId || schoolKey,
                        schoolName: schoolName,
                        totalStudents: new Set(),
                        validPoints: []
                    };
                }

                const studentKey = item.loginName || item.account || item.userId || item.username;
                if (studentKey) {
                    schoolMap[schoolKey].totalStudents.add(studentKey);
                }

                // 提取第一层或子层中的 locationInfo
                const loc = item.locationInfo ||
                    (item.rawData && item.rawData.locationInfo) ||
                    (item.studentInfo && item.studentInfo.locationInfo);

                if (loc && typeof loc.latitude !== 'undefined' && typeof loc.longitude !== 'undefined') {
                    const lat = parseFloat(loc.latitude);
                    const lng = parseFloat(loc.longitude);

                    // 简单合法性验证（中国范围纬度约 3~54，经度 73~136）
                    if (!isNaN(lat) && !isNaN(lng) && lat > 0 && lat < 90 && lng > 0 && lng < 180) {
                        schoolMap[schoolKey].validPoints.push({
                            lat: lat,
                            lng: lng,
                            updateTime: loc.updateTime || '',
                            studentName: item.username || item.nickName || studentKey || '学员',
                            loginName: item.loginName || item.account || studentKey || '-'
                        });
                    }
                }
            });

            const aggregatedList = [];

            Object.values(schoolMap).forEach(school => {
                const studentCount = school.totalStudents.size || school.validPoints.length;
                const pts = school.validPoints;

                if (pts.length === 0) {
                    aggregatedList.push({
                        schoolId: school.schoolId,
                        schoolName: school.schoolName,
                        studentCount: studentCount,
                        locationCount: 0,
                        hasLocation: false,
                        center: null,
                        points: []
                    });
                    return;
                }

                if (pts.length === 1) {
                    aggregatedList.push({
                        schoolId: school.schoolId,
                        schoolName: school.schoolName,
                        studentCount: studentCount,
                        locationCount: 1,
                        hasLocation: true,
                        center: { lat: pts[0].lat, lng: pts[0].lng },
                        points: pts
                    });
                    return;
                }

                // 多个坐标时先计算均值
                const meanLat = pts.reduce((sum, p) => sum + p.lat, 0) / pts.length;
                const meanLng = pts.reduce((sum, p) => sum + p.lng, 0) / pts.length;

                // 剔除远离均值3公里以上的离群噪点
                const inliers = pts.filter(p => {
                    const dist = MapHelper.getDistance(meanLat, meanLng, p.lat, p.lng);
                    return dist <= 3000;
                });

                const effectivePts = inliers.length > 0 ? inliers : pts;

                // 精准加权质心
                const finalLat = effectivePts.reduce((sum, p) => sum + p.lat, 0) / effectivePts.length;
                const finalLng = effectivePts.reduce((sum, p) => sum + p.lng, 0) / effectivePts.length;

                aggregatedList.push({
                    schoolId: school.schoolId,
                    schoolName: school.schoolName,
                    studentCount: studentCount,
                    locationCount: pts.length,
                    hasLocation: true,
                    center: {
                        lat: Number(finalLat.toFixed(6)),
                        lng: Number(finalLng.toFixed(6))
                    },
                    points: pts
                });
            });

            return aggregatedList;
        },

        /**
         * 需求二：针对单个学生传入经纬度并在地图上定位展示
         */
        openSingleStudentMap(options = {}) {
            const {
                studentName = '学生',
                loginName = '-',
                schoolName = '-',
                latitude,
                longitude,
                updateTime = '-'
            } = options;

            const lat = parseFloat(latitude);
            const lng = parseFloat(longitude);

            if (isNaN(lat) || isNaN(lng)) {
                alert('未检测到有效的经纬度信息');
                return;
            }

            const oldModal = document.getElementById('mapSingleStudentModal');
            if (oldModal) oldModal.remove();

            const coordText = `${lng.toFixed(6)}, ${lat.toFixed(6)}`;
            const externalAmapUrl = `https://uri.amap.com/marker?position=${lng},${lat}&name=${encodeURIComponent(studentName + '打卡位置')}`;

            const modalHtml = `
                <div id="mapSingleStudentModal" class="map-modal-backdrop">
                    <div class="map-modal-dialog map-modal-single">
                        <div class="map-modal-header">
                            <div class="map-header-title">
                                <div class="map-header-icon">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                                    </svg>
                                </div>
                                <div>
                                    <h3>${studentName} - 位置定位</h3>
                                </div>
                                <span class="map-header-badge">${schoolName}</span>
                            </div>
                            <div class="map-header-actions">
                                <a href="${externalAmapUrl}" target="_blank" class="map-btn-secondary" title="在高德官网新标签打开查看详细街景导航">
                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                                        <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
                                    </svg>
                                    高德查看
                                </a>
                                <button class="map-close-btn" id="closeSingleMapBtn" title="关闭 (Esc)">✕</button>
                            </div>
                        </div>
                        <div class="map-modal-body">
                            <div class="map-canvas-container">
                                <div id="singleMapCanvas" class="map-canvas"></div>
                                <div id="singleMapLoading" class="map-status-overlay">
                                    <div class="map-spinner"></div>
                                    <span>正在加载高德高清地图底图...</span>
                                </div>
                                <div class="map-floating-bar">
                                    <span><strong>坐标：</strong>${coordText}</span>
                                    <span><strong>上报时间：</strong>${updateTime}</span>
                                    <span><strong>账号：</strong>${loginName}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modalEl = document.getElementById('mapSingleStudentModal');
            const closeBtn = document.getElementById('closeSingleMapBtn');
            const loadingEl = document.getElementById('singleMapLoading');

            const closeModal = () => {
                if (modalEl) modalEl.remove();
                document.removeEventListener('keydown', handleKey);
            };

            const handleKey = (e) => {
                if (e.key === 'Escape') closeModal();
            };

            closeBtn.addEventListener('click', closeModal);
            modalEl.addEventListener('click', (e) => {
                if (e.target === modalEl) closeModal();
            });
            document.addEventListener('keydown', handleKey);

            // 加载 Leaflet 并接入高德高清官方切片底图
            this.loadLeaflet().then(L => {
                if (loadingEl) loadingEl.style.display = 'none';

                const map = L.map('singleMapCanvas', {
                    center: [lat, lng],
                    zoom: 16,
                    zoomControl: true
                });

                // 添加高德官方免Key切片图层
                MapHelper.createAmapTileLayer(L).addTo(map);

                // 纯正“倒水滴”定位 Marker (顶部正圆饱满，底部自然顺滑收束成尖角)
                const pinHtml = `
                    <div class="teardrop-marker-wrapper single-teardrop-marker">
                        <div class="single-pin-pulse"></div>
                        <svg viewBox="0 0 36 46" width="36" height="46" class="teardrop-svg">
                            <defs>
                                <filter id="td-shadow-single" x="-20%" y="-10%" width="140%" height="140%">
                                    <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#dc2626" flood-opacity="0.5"/>
                                </filter>
                            </defs>
                            <path d="M18 2 C9.16 2, 2 9.16, 2 18 C2 28.5, 18 44, 18 44 C18 44, 34 28.5, 34 18 C34 9.16, 26.84 2, 18 2 Z" 
                                  fill="#ef4444" stroke="#ffffff" stroke-width="2" filter="url(#td-shadow-single)"/>
                            <circle cx="18" cy="18" r="6" fill="#ffffff"/>
                            <circle cx="18" cy="18" r="3" fill="#ef4444"/>
                        </svg>
                    </div>
                `;
                const customIcon = L.divIcon({
                    html: pinHtml,
                    className: 'custom-single-marker',
                    iconSize: [0, 0]
                });

                const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

                // Popup 信息气泡
                const popupContent = `
                    <div class="amap-info-custom" style="padding: 4px 6px;">
                        <div class="amap-info-title">📍 ${studentName} (${loginName})</div>
                        <div class="amap-info-row"><span class="amap-info-label">所属学校：</span><span class="amap-info-val">${schoolName}</span></div>
                        <div class="amap-info-row"><span class="amap-info-label">经纬度：</span><span class="amap-info-val">${coordText}</span></div>
                        <div class="amap-info-row"><span class="amap-info-label">定位时间：</span><span class="amap-info-val">${updateTime}</span></div>
                    </div>
                `;
                marker.bindPopup(popupContent).openPopup();

                // 强制刷新一次尺寸以防渲染截断
                setTimeout(() => map.invalidateSize(), 200);
            }).catch(err => {
                console.error('地图加载异常:', err);
                if (loadingEl) {
                    loadingEl.innerHTML = `
                        <div style="text-align:center; padding: 20px;">
                            <p style="font-size: 14px; color: #dc2626; font-weight: 600;">地图底图加载受限</p>
                            <p style="font-size: 12px; color: #64748b; margin-top: 6px;">经纬度：${coordText} | 时间：${updateTime}</p>
                            <div style="margin-top: 14px;">
                                <a href="${externalAmapUrl}" target="_blank" style="display:inline-block; padding: 8px 16px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-size: 13px;">在高德地图官网新标签打开查看</a>
                            </div>
                        </div>
                    `;
                }
            });
        },

        /**
         * 需求一：日活详情中查看所有门店/学校的地图位置，展示聚合后的学校中心点
         */
        openSchoolDauMap(records = [], options = {}) {
            const { dateStr = '当日' } = options;

            const aggregatedSchools = this.aggregateSchoolLocations(records);
            const schoolsWithLocation = aggregatedSchools.filter(s => s.hasLocation && s.center);

            const oldModal = document.getElementById('mapSchoolDauModal');
            if (oldModal) oldModal.remove();

            const modalHtml = `
                <div id="mapSchoolDauModal" class="map-modal-backdrop">
                    <div class="map-modal-dialog map-modal-full">
                        <div class="map-modal-header">
                            <div class="map-header-title">
                                <div class="map-header-icon">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                        <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
                                    </svg>
                                </div>
                                <div>
                                    <h3>各门店/学校地图分布与日活聚合</h3>
                                </div>
                                <span class="map-header-badge">${dateStr} · 共 ${aggregatedSchools.length} 所学校 (${schoolsWithLocation.length} 所已定位)</span>
                            </div>
                            <div class="map-header-actions">
                                <button class="map-close-btn" id="closeFullMapBtn" title="关闭 (Esc)">✕</button>
                            </div>
                        </div>
                        <div class="map-modal-body">
                            <!-- 左侧学校列表面板 -->
                            <div class="map-side-panel">
                                <div class="map-side-search">
                                    <input type="text" id="mapSchoolSearchInput" class="map-search-input" placeholder="输入学校名称快速定位..." />
                                </div>
                                <ul class="map-school-list" id="mapSchoolUl">
                                    <!-- 动态渲染学校列表项 -->
                                </ul>
                            </div>
                            <!-- 右侧地图主体 -->
                            <div class="map-canvas-container">
                                <div id="fullMapCanvas" class="map-canvas"></div>
                                <div id="fullMapLoading" class="map-status-overlay">
                                    <div class="map-spinner"></div>
                                    <span>正在加载高德高清底图与各校定位数据...</span>
                                </div>
                                <div class="map-floating-bar">
                                    <span>💡 <strong>算法保障：</strong>同一学校多个学生打卡点的偏差经纬度已由系统计算加权质心合并为一个标准点位。</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modalEl = document.getElementById('mapSchoolDauModal');
            const closeBtn = document.getElementById('closeFullMapBtn');
            const loadingEl = document.getElementById('fullMapLoading');
            const schoolUl = document.getElementById('mapSchoolUl');
            const searchInput = document.getElementById('mapSchoolSearchInput');

            const closeModal = () => {
                if (modalEl) modalEl.remove();
                document.removeEventListener('keydown', handleKey);
            };

            const handleKey = (e) => {
                if (e.key === 'Escape') closeModal();
            };

            closeBtn.addEventListener('click', closeModal);
            modalEl.addEventListener('click', (e) => {
                if (e.target === modalEl) closeModal();
            });
            document.addEventListener('keydown', handleKey);

            let mapInstance = null;
            const markersMap = new Map();
            let currentSubMarkers = [];

            // 渲染左侧学校列表
            const renderSchoolList = (filterText = '') => {
                const keyword = filterText.trim().toLowerCase();
                const filtered = aggregatedSchools.filter(s => !keyword || s.schoolName.toLowerCase().includes(keyword));

                if (filtered.length === 0) {
                    schoolUl.innerHTML = '<li style="padding: 20px; text-align: center; color: #94a3b8; font-size: 12px;">未匹配到相关学校</li>';
                    return;
                }

                schoolUl.innerHTML = filtered.map(s => {
                    const hasLoc = s.hasLocation && s.center;
                    return `
                        <li class="map-school-item" data-id="${s.schoolId}">
                            <div class="map-school-item-title">
                                <span>${s.schoolName}</span>
                                <span class="map-school-item-badge">${s.studentCount} 人活跃</span>
                            </div>
                            <div class="map-school-item-desc">
                                ${hasLoc
                                    ? `<span style="color:#10b981;">📍 已定位 (上报坐标: ${s.locationCount} 个已合并)</span>`
                                    : `<span style="color:#94a3b8;">⚠️ 暂无经纬度上报</span>`
                                }
                            </div>
                        </li>
                    `;
                }).join('');

                schoolUl.querySelectorAll('.map-school-item').forEach(li => {
                    li.addEventListener('click', () => {
                        const sId = li.dataset.id;
                        const target = aggregatedSchools.find(x => x.schoolId === sId);
                        if (!target || !target.center) {
                            alert('该学校今日尚未上报有效的 GPS/经纬度定位数据');
                            return;
                        }

                        schoolUl.querySelectorAll('.map-school-item').forEach(el => el.classList.remove('active'));
                        li.classList.add('active');

                        if (mapInstance) {
                            mapInstance.setView([target.center.lat, target.center.lng], 15);
                            const m = markersMap.get(sId);
                            if (m) m.openPopup();
                        }
                    });
                });
            };

            renderSchoolList('');
            searchInput.addEventListener('input', (e) => {
                renderSchoolList(e.target.value);
            });

            // 加载 Leaflet + 高德切片底图
            this.loadLeaflet().then(L => {
                if (loadingEl) loadingEl.style.display = 'none';

                let initCenter = [28.233865, 112.929979]; // 默认长沙
                if (schoolsWithLocation.length > 0) {
                    initCenter = [schoolsWithLocation[0].center.lat, schoolsWithLocation[0].center.lng];
                }

                mapInstance = L.map('fullMapCanvas', {
                    center: initCenter,
                    zoom: schoolsWithLocation.length > 1 ? 12 : 14,
                    zoomControl: true
                });

                // 添加高德官方切片底图（无Key、带街道商铺全高清中文标注）
                MapHelper.createAmapTileLayer(L).addTo(mapInstance);

                const boundsGroup = [];

                schoolsWithLocation.forEach(school => {
                    const latLng = [school.center.lat, school.center.lng];
                    boundsGroup.push(latLng);

                    const markerHtml = `
                        <div class="teardrop-marker-wrapper school-teardrop-marker">
                            <div class="school-teardrop-label">🏫 ${school.schoolName}</div>
                            <svg viewBox="0 0 42 54" width="42" height="54" class="teardrop-svg">
                                <defs>
                                    <filter id="td-shadow-school_${school.schoolId}" x="-20%" y="-10%" width="140%" height="140%">
                                        <feDropShadow dx="0" dy="4" stdDeviation="3.5" flood-color="#dc2626" flood-opacity="0.55"/>
                                    </filter>
                                </defs>
                                <path d="M21 2 C10.5 2, 2 10.5, 2 21 C2 33.5, 21 52, 21 52 C21 52, 40 33.5, 40 21 C40 10.5, 31.5 2, 21 2 Z" 
                                      fill="#ef4444" stroke="#ffffff" stroke-width="2.5" filter="url(#td-shadow-school_${school.schoolId})"/>
                                <circle cx="21" cy="21" r="10" fill="#ffffff"/>
                                <text x="21" y="25" text-anchor="middle" font-size="11" font-weight="bold" fill="#ef4444">${school.studentCount}</text>
                            </svg>
                        </div>
                    `;

                    const schoolIcon = L.divIcon({
                        html: markerHtml,
                        className: 'custom-school-marker',
                        iconSize: [0, 0]
                    });

                    const marker = L.marker(latLng, { icon: schoolIcon }).addTo(mapInstance);

                    // 弹出气泡
                    const infoContent = `
                        <div class="amap-info-custom">
                            <div class="amap-info-title">🏫 ${school.schoolName}</div>
                            <div class="amap-info-row"><span class="amap-info-label">日活学生：</span><span class="amap-info-val">${school.studentCount} 人</span></div>
                            <div class="amap-info-row"><span class="amap-info-label">上报坐标：</span><span class="amap-info-val">${school.locationCount} 个打卡点已聚合成中心</span></div>
                            <div class="amap-info-row"><span class="amap-info-label">合并坐标：</span><span class="amap-info-val">${school.center.lng.toFixed(5)}, ${school.center.lat.toFixed(5)}</span></div>
                            <div style="margin-top: 8px; border-top: 1px dashed #e2e8f0; padding-top: 6px;">
                                <button id="toggleScatterBtn_${school.schoolId}" style="border: 1px solid #3b82f6; background: #eff6ff; color: #2563eb; border-radius: 4px; padding: 4px 10px; font-size: 11px; cursor: pointer; width: 100%;">
                                    🔍 展开校内学生打卡分布 (${school.points.length}人)
                                </button>
                            </div>
                        </div>
                    `;

                    marker.bindPopup(infoContent);

                    marker.on('popupopen', () => {
                        setTimeout(() => {
                            const btn = document.getElementById(`toggleScatterBtn_${school.schoolId}`);
                            if (btn) {
                                btn.onclick = () => {
                                    // 清除已有散点
                                    currentSubMarkers.forEach(sm => mapInstance.removeLayer(sm));
                                    currentSubMarkers = [];

                                    school.points.forEach((p, pIdx) => {
                                        const subHtml = `
                                            <div class="teardrop-marker-wrapper student-teardrop-marker" title="${p.studentName} (${p.loginName})\n上报时间：${p.updateTime}">
                                                <svg viewBox="0 0 28 36" width="28" height="36" class="teardrop-svg">
                                                    <defs>
                                                        <filter id="td-shadow-student_${school.schoolId}_${pIdx}" x="-20%" y="-10%" width="140%" height="140%">
                                                            <feDropShadow dx="0" dy="2.5" stdDeviation="2.5" flood-color="#b91c1c" flood-opacity="0.45"/>
                                                        </filter>
                                                    </defs>
                                                    <path d="M14 2 C7 2, 2 7, 2 14 C2 22, 14 34, 14 34 C14 34, 26 22, 26 14 C26 7, 21 2, 14 2 Z" 
                                                          fill="#dc2626" stroke="#ffffff" stroke-width="1.8" filter="url(#td-shadow-student_${school.schoolId}_${pIdx})"/>
                                                    <circle cx="14" cy="14" r="4.2" fill="#ffffff"/>
                                                </svg>
                                            </div>
                                        `;
                                        const subIcon = L.divIcon({
                                            html: subHtml,
                                            className: 'custom-sub-pin',
                                            iconSize: [0, 0]
                                        });
                                        const subM = L.marker([p.lat, p.lng], { icon: subIcon }).addTo(mapInstance);
                                        subM.bindTooltip(`<b>${p.studentName}</b><br>${p.updateTime}`, { direction: 'top', offset: [0, -36] });
                                        currentSubMarkers.push(subM);
                                    });

                                    mapInstance.setView([school.center.lat, school.center.lng], 16);
                                };
                            }
                        }, 50);
                    });

                    markersMap.set(school.schoolId, marker);
                });

                // 自适应所有学校点位
                if (boundsGroup.length > 1) {
                    mapInstance.fitBounds(boundsGroup, { padding: [50, 50] });
                }

                setTimeout(() => mapInstance.invalidateSize(), 200);
            }).catch(err => {
                console.error('全览地图加载异常:', err);
                if (loadingEl) {
                    loadingEl.innerHTML = `
                        <div style="text-align:center; padding: 30px;">
                            <p style="font-size: 14px; color: #dc2626; font-weight: 600;">地图底图未能加载</p>
                            <p style="font-size: 12px; color: #64748b; margin-top: 8px;">共成功计算 ${schoolsWithLocation.length} 所学校的聚合坐标，可在左侧查看各学校合并数据。</p>
                        </div>
                    `;
                }
            });
        }
    };

    window.MapHelper = MapHelper;
})(window);
