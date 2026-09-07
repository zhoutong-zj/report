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
});
