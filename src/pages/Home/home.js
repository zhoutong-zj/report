document.addEventListener('DOMContentLoaded', () => {
    const menuItems = document.querySelectorAll('.menu-item');
    const contentFrame = document.getElementById('contentFrame');

    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            // If already active, do nothing
            if (item.classList.contains('active')) return;

            // Update active state in UI
            menuItems.forEach(el => el.classList.remove('active'));
            item.classList.add('active');

            // Switch iframe source
            const pageSrc = item.getAttribute('data-page');
            if (pageSrc) {
                // 点击左侧菜单直接进入时，清除从日活详情或异常分类详情跳转的标记
                sessionStorage.removeItem('fromDauDetail');
                sessionStorage.removeItem('fromExceptionDetail');
                contentFrame.src = pageSrc;
            }
        });
    });

    // Support listening to hash or search parameters to select subpage if needed
    const urlParams = new URLSearchParams(window.location.search);
    const targetPage = urlParams.get('page');
    if (targetPage) {
        const targetMenu = Array.from(menuItems).find(item => item.getAttribute('data-page') === targetPage);
        if (targetMenu) {
            targetMenu.click();
        }
    }

    // 监听来自子 iframe 的跨域/本地文件协议导航请求
    window.addEventListener('message', (event) => {
        if (event.data && event.data.action === 'navigate') {
            const page = event.data.page;
            const menuPage = event.data.activeMenu || page;
            const targetMenu = Array.from(menuItems).find(item => {
                const dp = item.getAttribute('data-page');
                return dp === menuPage || dp.endsWith(menuPage) ||
                    (menuPage.includes('dauDetail') && dp.includes('logReport')) ||
                    (menuPage.includes('exceptionDetail') && dp.includes('logReport'));
            });
            if (targetMenu) {
                menuItems.forEach(el => el.classList.remove('active'));
                targetMenu.classList.add('active');
            }
            if (page) {
                contentFrame.src = page;
            }
        }
    });

    // ================= 主题切换逻辑 =================
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const themeIcon = document.getElementById('themeIcon');
    const themeText = document.getElementById('themeText');
    const themeThumb = document.getElementById('themeToggleThumb');

    const sunSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
    </svg>`;

    const moonSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M12.3 2a10 10 0 0 0-.19 14 9.92 9.92 0 0 0 11.23 2.5 1 1 0 0 0 .5-1.3 1 1 0 0 0-1-.6 8 8 0 0 1-5.74-7.6 8 8 0 0 1 2.39-5.69 1 1 0 0 0-.25-1.61A10.05 10.05 0 0 0 12.3 2z"/>
    </svg>`;

    const thumbSunSvg = `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`;

    const thumbMoonSvg = `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>`;

    function updateThemeUI(theme) {
        const isDark = theme === 'dark';
        if (themeText) {
            themeText.textContent = isDark ? '夜间模式' : '日间模式';
        }
        if (themeIcon) {
            themeIcon.innerHTML = isDark ? moonSvg : sunSvg;
            themeIcon.style.color = isDark ? '#38bdf8' : '#f59e0b';
        }
        if (themeThumb) {
            themeThumb.innerHTML = isDark ? thumbMoonSvg : thumbSunSvg;
        }
    }

    if (window.ThemeManager) {
        updateThemeUI(window.ThemeManager.getTheme());

        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => {
                const nextTheme = window.ThemeManager.toggleTheme();
                updateThemeUI(nextTheme);
            });
        }

        window.addEventListener('themeChanged', (e) => {
            if (e.detail && e.detail.theme) {
                updateThemeUI(e.detail.theme);
            }
        });
    }
});
