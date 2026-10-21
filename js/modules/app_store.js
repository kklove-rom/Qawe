// --- 应用商店模块 (js/modules/app_store.js) ---
// 功能：从 GitHub 备份仓库的 apps/ 目录同步 zip 应用，安装到小手机主屏运行。
// zip 标准格式：app.json(清单) + 入口html + 资源文件。
// 安装的 app 通过 window.UwU 桥接接口调用 AI、读取人设/世界书/聊天记录、向 404 注入消息。

(function () {
    const STORE_APPS_DIR = 'apps'; // 仓库中存放 zip 的目录
    const REMOTE_CACHE_KEY = 'store_remote_apps_cache_v1'; // 远程列表本地缓存，进 store 先秒出
    let remoteApps = [];           // 远程 zip 列表
    let storeLoading = false;
    let currentRunnerAppId = null; // 当前运行的 app id
    let runnerIframe = null;       // 当前运行的 iframe 引用

    // ============ HTML 注入 ============
    function injectAppStoreHtml() {
        if (document.getElementById('app-store-screen')) return;
        const phoneScreen = document.querySelector('.phone-screen');
        if (!phoneScreen) return;

        const storeScreen = document.createElement('div');
        storeScreen.id = 'app-store-screen';
        storeScreen.className = 'screen';
        storeScreen.innerHTML = `
            <header class="app-header">
                <button class="back-btn" data-target="home-screen">‹</button>
                <div class="title-container">
                    <h1 class="title">store</h1>
                </div>
                <div class="action-btn-group">
                    <button class="action-btn" id="app-store-refresh-btn" title="刷新列表">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                    </button>
                </div>
            </header>
            <div class="app-store-body">
                <div class="app-store-repo-card" id="app-store-repo-card"></div>
                <div class="app-store-local-card">
                    <button class="app-store-btn" id="app-store-local-install-btn">＋ 本地 zip 安装</button>
                    <div class="app-store-local-tip">不经过 GitHub：把应用 zip 传到手机，直接选文件安装</div>
                </div>
                <input type="file" id="app-store-local-file" accept=".zip,application/zip,application/x-zip-compressed" style="display:none">
                <div class="app-store-section-title">远程应用 (GitHub)</div>
                <div id="app-store-remote-list" class="app-store-list"></div>
                <div class="app-store-section-title">已安装</div>
                <div id="app-store-installed-list" class="app-store-list"></div>
            </div>
        `;
        phoneScreen.appendChild(storeScreen);

        // 第三方 app 运行容器
        const runnerScreen = document.createElement('div');
        runnerScreen.id = 'store-app-runner-screen';
        runnerScreen.className = 'screen';
        runnerScreen.innerHTML = `
            <header class="app-header" id="store-app-runner-header">
                <button class="back-btn" data-target="home-screen">‹</button>
                <div class="title-container">
                    <h1 class="title" id="store-app-runner-title">应用</h1>
                </div>
            </header>
            <div class="store-app-runner-body">
                <iframe id="store-app-runner-iframe" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups" style="width:100%;height:100%;border:none;background:#fff;"></iframe>
            </div>
        `;
        phoneScreen.appendChild(runnerScreen);

        document.getElementById('app-store-refresh-btn').addEventListener('click', () => {
            fetchRemoteApps(true);
        });

        // 本地 zip 安装
        const localFileInput = document.getElementById('app-store-local-file');
        document.getElementById('app-store-local-install-btn').addEventListener('click', () => {
            localFileInput.click();
        });
        localFileInput.addEventListener('change', () => {
            const f = localFileInput.files && localFileInput.files[0];
            localFileInput.value = '';
            if (f) installLocalZipFile(f);
        });
    }

    // ============ 工具函数 ============
    // 仓库来源优先级：1. GitHub备份配置(带token,支持私有仓库) 2. 当前 GitHub Pages 地址自动推断(公开仓库,无需token)
    function getGhConfig() {
        try {
            const confStr = localStorage.getItem('gh_config');
            if (confStr) {
                const cfg = JSON.parse(confStr);
                if (cfg && cfg.token && cfg.repo) {
                    return { token: cfg.token, repo: cfg.repo, source: 'config', sameOrigin: false };
                }
            }
        } catch (e) { /* ignore */ }

        const m = location.hostname.match(/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\.github\.io$/i);
        if (m) {
            const owner = m[1];
            const seg = location.pathname.split('/').filter(Boolean)[0];
            const repo = seg ? `${owner}/${seg}` : `${owner}/${owner}.github.io`;
            return { token: '', repo, source: 'pages', sameOrigin: true };
        }
        return { token: '', repo: '', source: 'none', sameOrigin: false };
    }

    function ghHeaders(cfg) {
        const h = { 'Accept': 'application/vnd.github.v3+json' };
        if (cfg.token) h['Authorization'] = `token ${cfg.token}`;
        return h;
    }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    }

    function escapeHtml(str) {
        return String(str ?? '').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
    }

    function base64ToUint8Array(base64) {
        const bin = atob(base64);
        const len = bin.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
    }

    function guessMime(path) {
        const ext = (path.split('.').pop() || '').toLowerCase();
        const map = {
            html: 'text/html', htm: 'text/html', js: 'text/javascript', mjs: 'text/javascript',
            css: 'text/css', json: 'application/json', txt: 'text/plain', md: 'text/markdown',
            png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
            webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon',
            mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
            mp4: 'video/mp4', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf'
        };
        return map[ext] || 'application/octet-stream';
    }

    function isTextPath(path) {
        const ext = (path.split('.').pop() || '').toLowerCase();
        return ['html', 'htm', 'js', 'mjs', 'css', 'json', 'txt', 'md', 'svg', 'xml'].includes(ext);
    }

    // 带超时的 fetch（GitHub API 国内可能长时间挂起，防止界面永远卡在"正在拉取"）
    function fetchWithTimeout(url, opts, ms) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), ms || 12000);
        // no-store：避免浏览器把 index.json / zip 缓存 10 分钟，刷新后仍拿旧列表
        return fetch(url, { cache: 'no-store', ...(opts || {}), signal: ctrl.signal }).finally(() => clearTimeout(t));
    }

    function readRemoteCache() {
        try {
            const arr = JSON.parse(localStorage.getItem(REMOTE_CACHE_KEY) || '[]');
            return Array.isArray(arr) ? arr : [];
        } catch (e) { return []; }
    }
    function writeRemoteCache(list) {
        try { localStorage.setItem(REMOTE_CACHE_KEY, JSON.stringify(list || [])); } catch (e) { /* ignore */ }
    }

    // 当前是否运行在 github.io（是则 apps/index.json 可同源直取，走 CDN 最快）
    function onGhPages() {
        return /^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\.github\.io$/i.test(location.hostname);
    }

    // ============ GitHub 同步 ============
    async function fetchRemoteApps(manual = false) {
        const cfg = getGhConfig();
        renderStoreRepoCard();
        if (!cfg.repo) {
            remoteApps = [];
            renderRemoteList();
            if (manual) showToast('未找到仓库：请部署到 GitHub Pages 或在 教程→GitHub备份 中配置');
            return;
        }
        if (storeLoading) return;
        storeLoading = true;
        renderRemoteList();
        try {
            let apps = null;
            let fromIndex = false;
            // 1) 优先同源清单 apps/index.json（走 Pages CDN，速度快，不占 API 限流）
            //    只要运行在 github.io 就先试这条，即使配了 GitHub备份（备份配置可能指向旧仓库）
            if (onGhPages()) {
                try {
                    const r = await fetchWithTimeout(`${STORE_APPS_DIR}/index.json?v=${Date.now()}`, null, 8000);
                    if (r.ok) {
                        const idx = await r.json();
                        if (idx && Array.isArray(idx.apps)) {
                            apps = idx.apps.filter(a => a && a.file).map(a => ({
                                name: a.file,
                                size: a.size || 0,
                                sha: a.sha || '',
                                version: a.version || '',
                                downloadUrl: `${STORE_APPS_DIR}/${a.file}`,
                                path: `${STORE_APPS_DIR}/${a.file}`,
                                sameOrigin: true
                            }));
                            fromIndex = true;
                        }
                    }
                } catch (e) { /* 清单不存在或网络问题时回退 API */ }
            }
            // 2) 回退 GitHub API 列目录（国内访问较慢，仅作兜底）
            if (!apps) {
                const url = `https://api.github.com/repos/${cfg.repo}/contents/${STORE_APPS_DIR}`;
                const res = await fetchWithTimeout(url, { headers: ghHeaders(cfg) }, 8000);
                if (res.status === 404) {
                    remoteApps = [];
                    renderRemoteList('仓库中还没有 apps 文件夹。把 zip 上传到仓库的 apps/ 目录后，点右上角刷新即可看到。');
                    return;
                }
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    if (res.status === 403 && !cfg.token) {
                        throw new Error('GitHub 未认证请求限流(60次/小时)，稍后再试或在 GitHub备份 中配置 Token');
                    }
                    if (res.status === 404 || (err.message || '').match(/Not Found/i)) {
                        throw new Error('仓库不存在或为私有仓库(私有需在 GitHub备份 中配置 Token)');
                    }
                    throw new Error(err.message || `GitHub API ${res.status}`);
                }
                const files = await res.json();
                apps = (Array.isArray(files) ? files : [])
                    .filter(f => f.type === 'file' && /\.zip$/i.test(f.name))
                    .map(f => ({ name: f.name, size: f.size, sha: f.sha, version: '', downloadUrl: f.download_url, path: f.path }));
            }
            remoteApps = apps;
            renderRemoteList();
            writeRemoteCache(remoteApps);
            if (manual) showToast(remoteApps.length ? `发现 ${remoteApps.length} 个应用` : 'apps 目录里还没有 zip');
            // index.json 会被 Pages CDN 缓存（最多约 10 分钟）；后台再用 API 目录补齐刚上传、还没写进清单的 zip
            if (fromIndex) mergeDirectory(cfg);
        } catch (e) {
            console.error('[AppStore] fetch failed:', e);
            renderRemoteList('拉取失败: ' + e.message);
            if (manual) showToast('拉取失败: ' + e.message);
        } finally {
            storeLoading = false;
        }
    }

    // 用 GitHub API 的目录列表补齐 index.json（后台执行，失败不影响快速通道）
    async function mergeDirectory(cfg) {
        try {
            const url = `https://api.github.com/repos/${cfg.repo}/contents/${STORE_APPS_DIR}`;
            const res = await fetchWithTimeout(url, { headers: ghHeaders(cfg) }, 6000);
            if (!res.ok) return;
            const files = await res.json();
            if (!Array.isArray(files)) return;
            const apiApps = files
                .filter(f => f.type === 'file' && /\.zip$/i.test(f.name))
                .map(f => ({ name: f.name, size: f.size, sha: f.sha, downloadUrl: f.download_url, path: f.path }));
            const byName = {};
            (remoteApps || []).forEach(a => { byName[a.name] = a; });
            const apiByName = {};
            apiApps.forEach(a => { apiByName[a.name] = a; });
            // 保留清单里的应用（即使 API 目录暂时还没刷新），再用 API 的最新 sha/size 覆盖，并追加清单里没有的新 zip
            const merged = (remoteApps || []).map(old => Object.assign({}, old, apiByName[old.name] || {}));
            apiApps.forEach(a => { if (!byName[a.name]) merged.push(a); });
            remoteApps = merged;
            renderRemoteList();
            writeRemoteCache(remoteApps);
        } catch (e) { /* 后台补齐失败就保持清单结果 */ }
    }

    // ============ 安装 / 卸载 ============
    async function installRemoteApp(remote) {
        const cfg = getGhConfig();
        showToast('正在下载 ' + remote.name + ' ...');
        let zipBuf = null;
        try {
            // 下载 zip：同源 Pages 直接下(不占API限流) > download_url(公开仓库) > contents API raw(私有仓库)
            if (cfg.sameOrigin || remote.sameOrigin) {
                const r = await fetchWithTimeout(`${STORE_APPS_DIR}/${remote.name}?v=${encodeURIComponent(remote.sha || remote.version || Date.now())}`, null, 30000);
                if (r.ok) zipBuf = await r.arrayBuffer();
            }
            if (!zipBuf && remote.downloadUrl && !cfg.token) {
                const r = await fetchWithTimeout(remote.downloadUrl, null, 30000);
                if (r.ok) zipBuf = await r.arrayBuffer();
            }
            if (!zipBuf) {
                const blobRes = await fetchWithTimeout(`https://api.github.com/repos/${cfg.repo}/contents/${encodeURIComponent(remote.path)}`, {
                    headers: { ...ghHeaders(cfg), 'Accept': 'application/vnd.github.v3.raw' }
                }, 30000);
                if (!blobRes.ok) throw new Error('下载失败: HTTP ' + blobRes.status);
                zipBuf = await blobRes.arrayBuffer();
            }
        } catch (e) {
            console.error('[AppStore] download failed:', e);
            showToast('下载失败: ' + e.message + '（可改用"本地 zip 安装"）');
            return;
        }
        await installFromZipBuffer(zipBuf, remote.name, remote.sha || '');
    }

    // 本地 zip 安装：不经过 GitHub，直接把 zip 文件装进小手机
    async function installLocalZipFile(file) {
        showToast('正在读取 ' + file.name + ' ...');
        try {
            const buf = await file.arrayBuffer();
            await installFromZipBuffer(buf, file.name, '');
        } catch (e) {
            console.error('[AppStore] local install failed:', e);
            showToast('安装失败: ' + e.message);
        }
    }

    // 解压 zip 并安装（远程下载与本地安装共用）
    async function installFromZipBuffer(zipBuf, sourceName, sourceSha) {
        try {
            showToast('正在解压...');
            const zip = await JSZip.loadAsync(zipBuf);

            // 读取清单 app.json (兼容 zip 根目录或单层子目录)
            let manifestFile = zip.file('app.json');
            let prefix = '';
            if (!manifestFile) {
                const candidates = Object.keys(zip.files).filter(p => /(^|\/)app\.json$/i.test(p) && p.split('/').length <= 2);
                if (candidates.length) {
                    manifestFile = zip.file(candidates[0]);
                    prefix = candidates[0].slice(0, candidates[0].length - 'app.json'.length);
                }
            }
            if (!manifestFile) throw new Error('zip 中未找到 app.json 清单文件');

            let manifest;
            try {
                manifest = JSON.parse(await manifestFile.async('string'));
            } catch (e) {
                throw new Error('app.json 解析失败: ' + e.message);
            }
            const entry = manifest.entry || 'index.html';
            if (!zip.file(prefix + entry)) throw new Error(`入口文件 ${entry} 不存在于 zip 中`);

            // 读取所有文件
            const files = {};
            const tasks = [];
            zip.forEach((relativePath, file) => {
                if (file.dir) return;
                if (!relativePath.startsWith(prefix)) return;
                const innerPath = relativePath.slice(prefix.length);
                if (!innerPath) return;
                if (isTextPath(innerPath)) {
                    tasks.push(file.async('string').then(content => {
                        files[innerPath] = { type: 'text', mime: guessMime(innerPath), content };
                    }));
                } else {
                    tasks.push(file.async('base64').then(content => {
                        files[innerPath] = { type: 'base64', mime: guessMime(innerPath), content };
                    }));
                }
            });
            await Promise.all(tasks);

            // 处理图标：URL 直接用；相对路径转 dataURL
            let icon = manifest.icon || '';
            if (icon && !/^https?:\/\//i.test(icon) && !icon.startsWith('data:')) {
                const iconFile = files[icon];
                if (iconFile) {
                    icon = iconFile.type === 'text'
                        ? `data:${iconFile.mime};charset=utf-8,${encodeURIComponent(iconFile.content)}`
                        : `data:${iconFile.mime};base64,${iconFile.content}`;
                } else {
                    icon = defaultIcons['app-store-screen'].url;
                }
            }
            if (!icon) icon = defaultIcons['app-store-screen'].url;

            const appId = 'sa_' + (manifest.id || sourceName.replace(/\.zip$/i, '')).replace(/[^\w\-]/g, '_');
            const record = {
                id: appId,
                zipName: sourceName,
                sha: sourceSha,
                name: manifest.name || sourceName.replace(/\.zip$/i, ''),
                desc: manifest.desc || manifest.description || '',
                version: manifest.version || '1.0.0',
                author: manifest.author || '',
                icon,
                entry,
                files,
                installedAt: Date.now()
            };

            if (!Array.isArray(db.installedStoreApps)) db.installedStoreApps = [];
            const existIdx = db.installedStoreApps.findIndex(a => a.id === appId || a.zipName === sourceName);
            if (existIdx >= 0) db.installedStoreApps[existIdx] = record;
            else db.installedStoreApps.push(record);

            await saveData();
            if (typeof setupHomeScreen === 'function') setupHomeScreen();
            renderRemoteList();
            renderInstalledList();
            showToast(`「${record.name}」安装成功，已添加到主屏`);
        } catch (e) {
            console.error('[AppStore] install failed:', e);
            showToast('安装失败: ' + e.message);
        }
    }

    // 页面内确认弹窗（原生 confirm 在部分手机浏览器/内置 webview 会被屏蔽，导致卸载无反应）
    function showStoreConfirm(message, okText) {
        return new Promise((resolve) => {
            const old = document.getElementById('store-confirm-overlay');
            if (old) old.remove();
            const overlay = document.createElement('div');
            overlay.id = 'store-confirm-overlay';
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);';
            overlay.innerHTML = `
                <div style="width:280px;max-width:85%;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.2);">
                    <div style="padding:24px 20px 18px;text-align:center;">
                        <p style="margin:0;color:#333;font-size:15px;line-height:1.6;">${escapeHtml(message)}</p>
                    </div>
                    <div style="display:flex;border-top:1px solid #f0f0f2;">
                        <button id="store-confirm-cancel" style="flex:1;padding:13px;border:none;background:#fff;color:#666;font-size:15px;cursor:pointer;">取消</button>
                        <button id="store-confirm-ok" style="flex:1;padding:13px;border:none;background:#fff;color:#d32f2f;font-size:15px;font-weight:600;border-left:1px solid #f0f0f2;cursor:pointer;">${escapeHtml(okText || '确定')}</button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);
            const done = (val) => { overlay.remove(); resolve(val); };
            overlay.querySelector('#store-confirm-cancel').addEventListener('click', () => done(false));
            overlay.querySelector('#store-confirm-ok').addEventListener('click', () => done(true));
            overlay.addEventListener('click', (e) => { if (e.target === overlay) done(false); });
        });
    }

    async function uninstallApp(appId) {
        const app = (db.installedStoreApps || []).find(a => a.id === appId);
        if (!app) return;
        if (!(await showStoreConfirm(`确定卸载「${app.name}」吗？主屏图标将一并移除。`, '卸载'))) return;
        db.installedStoreApps = db.installedStoreApps.filter(a => a.id !== appId);
        // 从主屏分页中移除图标
        if (Array.isArray(db.homeLayoutPages)) {
            db.homeLayoutPages = db.homeLayoutPages.map(page => page.filter(id => id !== 'storeapp-' + appId));
        }
        await saveData();
        if (typeof setupHomeScreen === 'function') setupHomeScreen();
        renderRemoteList();
        renderInstalledList();
        showToast(`「${app.name}」已卸载`);
    }

    // ============ store 界面渲染 ============
    function renderStoreRepoCard() {
        const el = document.getElementById('app-store-repo-card');
        if (!el) return;
        const cfg = getGhConfig();
        if (cfg.repo) {
            const sourceLabel = cfg.source === 'pages'
                ? '自动检测 · 无需 Token'
                : 'GitHub备份配置';
            el.innerHTML = `
                <div class="repo-info">
                    <div class="repo-label">同步仓库 · ${sourceLabel}</div>
                    <div class="repo-name">${escapeHtml(cfg.repo)}<span class="repo-dir">/${STORE_APPS_DIR}</span></div>
                </div>
                <div class="repo-ok">已连接</div>
            `;
        } else {
            el.innerHTML = `
                <div class="repo-info">
                    <div class="repo-label">同步仓库</div>
                    <div class="repo-name repo-warn">未检测到仓库</div>
                </div>
                <button class="app-store-btn" id="app-store-goto-gh">去配置</button>
            `;
            const btn = document.getElementById('app-store-goto-gh');
            if (btn) btn.addEventListener('click', () => {
                if (typeof switchScreen === 'function') switchScreen('tutorial-screen');
                showToast('请在 教程 → GitHub备份 中填写 Token 与仓库');
            });
        }
    }

    function renderRemoteList(errorMsg) {
        const el = document.getElementById('app-store-remote-list');
        if (!el) return;
        if (storeLoading && !remoteApps.length) {
            el.innerHTML = '<div class="app-store-empty">正在从 GitHub 拉取...</div>';
            return;
        }
        if (errorMsg && !remoteApps.length) {
            el.innerHTML = `<div class="app-store-empty">${escapeHtml(errorMsg)}</div>`;
            return;
        }
        const cfg = getGhConfig();
        if (!cfg.repo) {
            el.innerHTML = '<div class="app-store-empty">部署到 GitHub Pages 后，仓库 apps/ 目录里的 zip 会自动显示在这里</div>';
            return;
        }
        if (!remoteApps.length) {
            el.innerHTML = '<div class="app-store-empty">未发现 zip 应用。上传 zip 到仓库 apps/ 目录后点刷新。</div>';
            return;
        }
        el.innerHTML = remoteApps.map(r => {
            const installed = (db.installedStoreApps || []).find(a => a.zipName === r.name || a.id === 'sa_' + r.name.replace(/\.zip$/i, '').replace(/[^\w\-]/g, '_'));
            // 有 sha 比 sha；无 sha 时比 version（index.json 清单模式）
            const hasUpdate = installed && (
                (r.sha && installed.sha !== r.sha) ||
                (!r.sha && r.version && installed.version && r.version !== installed.version)
            );
            let actionHtml;
            if (hasUpdate) {
                actionHtml = `<button class="app-store-btn update" data-action="install" data-name="${escapeHtml(r.name)}">更新</button>`;
            } else if (installed) {
                actionHtml = `<span class="app-store-installed-tag">已安装</span>`;
            } else {
                actionHtml = `<button class="app-store-btn" data-action="install" data-name="${escapeHtml(r.name)}">安装</button>`;
            }
            return `
                <div class="app-store-item">
                    <div class="app-store-item-icon zip-icon">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8"></path><path d="M1 3h22v5H1z"></path><path d="M10 12h4"></path></svg>
                    </div>
                    <div class="app-store-item-info">
                        <div class="app-store-item-name">${escapeHtml(r.name)}</div>
                        <div class="app-store-item-meta">${formatSize(r.size)}</div>
                    </div>
                    ${actionHtml}
                </div>
            `;
        }).join('');
    }

    function renderInstalledList() {
        const el = document.getElementById('app-store-installed-list');
        if (!el) return;
        const apps = db.installedStoreApps || [];
        if (!apps.length) {
            el.innerHTML = '<div class="app-store-empty">还没有安装任何应用</div>';
            return;
        }
        el.innerHTML = apps.map(a => `
            <div class="app-store-item">
                <img class="app-store-item-icon" src="${escapeHtml(a.icon)}" alt="">
                <div class="app-store-item-info">
                    <div class="app-store-item-name">${escapeHtml(a.name)}</div>
                    <div class="app-store-item-meta">v${escapeHtml(a.version)}${a.author ? ' · ' + escapeHtml(a.author) : ''}</div>
                    ${a.desc ? `<div class="app-store-item-desc">${escapeHtml(a.desc)}</div>` : ''}
                </div>
                <div class="app-store-item-actions">
                    <button class="app-store-btn" data-action="open" data-id="${escapeHtml(a.id)}">打开</button>
                    <button class="app-store-btn danger" data-action="uninstall" data-id="${escapeHtml(a.id)}">卸载</button>
                </div>
            </div>
        `).join('');
    }

    // store 列表点击委托
    function bindStoreListEvents() {
        const body = document.querySelector('.app-store-body');
        if (!body) return;
        body.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            if (action === 'install') {
                const name = btn.getAttribute('data-name');
                const remote = remoteApps.find(r => r.name === name);
                if (remote) {
                    btn.disabled = true;
                    btn.textContent = '...';
                    installRemoteApp(remote).finally(() => { btn.disabled = false; });
                }
            } else if (action === 'open') {
                openStoreApp(btn.getAttribute('data-id'));
            } else if (action === 'uninstall') {
                uninstallApp(btn.getAttribute('data-id'));
            }
        });
    }

    // ============ 运行第三方 app ============
    // 注入到 app iframe 内的桥接脚本
    const BRIDGE_SCRIPT = `
(function () {
    let callId = 0;
    const pending = {};
    window.addEventListener('message', function (e) {
        const d = e.data;
        if (!d || d.__uwuResp !== true) return;
        const p = pending[d.id];
        if (!p) return;
        delete pending[d.id];
        if (d.error) p.reject(new Error(d.error));
        else p.resolve(d.data);
    });
    function call(method, args) {
        return new Promise(function (resolve, reject) {
            const id = ++callId;
            pending[id] = { resolve: resolve, reject: reject };
            parent.postMessage({ __uwu: true, id: id, method: method, args: args || {} }, '*');
        });
    }
    window.UwU = {
        // 调用宿主已录入的 API 发起 AI 对话。messages: [{role:'system'|'user'|'assistant', content:'...'}]
        callAI: function (messages, opts) { return call('callAI', { messages: messages, opts: opts || {} }); },
        // 读取 404 角色列表（含人设字段，不含聊天记录）
        getCharacters: function () { return call('getCharacters'); },
        // 读取「我的人设」全局预设列表（含每个角色绑定的覆盖设定）
        getUserPersonas: function () { return call('getUserPersonas'); },
        // 读取世界书条目
        getWorldBooks: function () { return call('getWorldBooks'); },
        // 读取某角色聊天记录。limit 可选，取最近 N 条
        getChatHistory: function (charId, limit) { return call('getChatHistory', { charId: charId, limit: limit }); },
        // 向 404 某角色聊天注入消息。role: 'user'(用户/我) 或 'char'(角色)
        injectMessage: function (charId, msg) { return call('injectMessage', { charId: charId, msg: msg }); },
        // 宿主 toast 提示
        toast: function (text) { return call('toast', { text: text }); },
        // 当前 app 的清单信息
        getAppInfo: function () { return call('getAppInfo'); }
    };
})();
`;

    async function openStoreApp(appId) {
        const app = (db.installedStoreApps || []).find(a => a.id === appId);
        if (!app) return showToast('应用不存在');
        currentRunnerAppId = appId;

        const titleEl = document.getElementById('store-app-runner-title');
        if (titleEl) titleEl.textContent = app.name;

        const iframe = document.getElementById('store-app-runner-iframe');
        if (!iframe) return;
        runnerIframe = iframe;

        try {
            const html = buildAppHtml(app);
            iframe.srcdoc = html;
            if (typeof switchScreen === 'function') switchScreen('store-app-runner-screen');
        } catch (e) {
            console.error('[AppStore] launch failed:', e);
            showToast('启动失败: ' + e.message);
        }
    }

    // 将 app 的文件打包成单个 srcdoc HTML
    function buildAppHtml(app) {
        // 1. 为每个非入口文件生成 blob URL
        const urlMap = {}; // path -> blobUrl
        for (const [path, file] of Object.entries(app.files)) {
            if (path === app.entry) continue;
            try {
                let blob;
                if (file.type === 'text') {
                    blob = new Blob([file.content], { type: file.mime });
                } else {
                    blob = new Blob([base64ToUint8Array(file.content)], { type: file.mime });
                }
                urlMap[path] = URL.createObjectURL(blob);
            } catch (e) {
                console.warn('[AppStore] blob create failed for', path, e);
            }
        }

        // 2. 读取入口 HTML
        const entryFile = app.files[app.entry];
        if (!entryFile) throw new Error('入口文件缺失: ' + app.entry);
        let html = entryFile.content;

        // 3. 注入桥接脚本到 <head> 之后（无 head 则插到最前）
        const bridgeTag = '<scr' + 'ipt>' + BRIDGE_SCRIPT + '</scr' + 'ipt>';
        if (/<head[^>]*>/i.test(html)) {
            html = html.replace(/<head[^>]*>/i, m => m + '\n' + bridgeTag);
        } else if (/<html[^>]*>/i.test(html)) {
            html = html.replace(/<html[^>]*>/i, m => m + '\n' + bridgeTag);
        } else {
            html = bridgeTag + html;
        }

        // 4. 重写相对资源引用为 blob URL
        const paths = Object.keys(urlMap).sort((a, b) => b.length - a.length);
        for (const p of paths) {
            const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // src="path" / href="path" / url(path) / url('path') / url("path")
            html = html.replace(new RegExp(`(src|href)=["']${escaped}["']`, 'g'), `$1="${urlMap[p]}"`);
            html = html.replace(new RegExp(`url\\(["']?${escaped}["']?\\)`, 'g'), `url("${urlMap[p]}")`);
        }

        return html;
    }

    // ============ 桥接宿主端 ============
    function setupBridgeHost() {
        window.addEventListener('message', async (e) => {
            const d = e.data;
            if (!d || d.__uwu !== true) return;
            // 只响应当前运行中的 app iframe
            if (!runnerIframe || e.source !== runnerIframe.contentWindow) return;

            const respond = (data, error) => {
                try {
                    runnerIframe.contentWindow.postMessage(
                        error ? { __uwuResp: true, id: d.id, error: String(error) }
                              : { __uwuResp: true, id: d.id, data: data },
                        '*'
                    );
                } catch (err) { /* iframe 已销毁 */ }
            };

            try {
                const result = await handleBridgeCall(d.method, d.args || {});
                respond(result === undefined ? null : result, null);
            } catch (err) {
                console.error('[AppStore] bridge call failed:', d.method, err);
                respond(null, err.message || String(err));
            }
        });
    }

    async function handleBridgeCall(method, args) {
        switch (method) {
            case 'getAppInfo': {
                const app = (db.installedStoreApps || []).find(a => a.id === currentRunnerAppId);
                if (!app) return null;
                const { files, ...info } = app;
                return info;
            }
            case 'callAI':
                return await hostCallAI(args.messages, args.opts || {});
            case 'getCharacters':
                return (db.characters || []).map(c => {
                    const { history, ...rest } = c;
                    return rest;
                });
            case 'getUserPersonas': {
                // 全局「我的人设」预设 + 每个角色的绑定（bindings: charId -> {extraPersona, override}）
                const list = Array.isArray(db.myPersonaPresets) ? db.myPersonaPresets : [];
                const activeId = db.activePersonaId || (list[0] && list[0].id) || null;
                return list.map(p => ({
                    id: p.id,
                    name: p.name || '',
                    persona: p.persona || '',
                    avatar: p.avatar || '',
                    isActive: String(p.id) === String(activeId),
                    bindings: JSON.parse(JSON.stringify(p.bindings || {}))
                }));
            }
            case 'getWorldBooks':
                return JSON.parse(JSON.stringify(db.worldBooks || []));
            case 'getChatHistory': {
                const char = (db.characters || []).find(c => String(c.id) === String(args.charId));
                if (!char) throw new Error('未找到该角色');
                let h = Array.isArray(char.history) ? char.history : [];
                if (args.limit && args.limit > 0) h = h.slice(-args.limit);
                return h.map(m => ({ id: m.id, role: m.role, content: m.content, timestamp: m.timestamp }));
            }
            case 'injectMessage': {
                const char = (db.characters || []).find(c => String(c.id) === String(args.charId));
                if (!char) throw new Error('未找到该角色');
                if (!Array.isArray(char.history)) char.history = [];
                const msg = args.msg || {};
                const m = {
                    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    role: (msg.role === 'char' || msg.role === 'assistant') ? 'char' : 'user',
                    content: String(msg.content ?? ''),
                    timestamp: Date.now()
                };
                char.history.push(m);
                await saveData();
                // 若 404 正打开该角色的聊天，实时刷新
                if (String(currentChatId) === String(char.id) && currentChatType === 'private' && typeof renderMessages === 'function') {
                    renderMessages(false, true);
                }
                return { id: m.id };
            }
            case 'toast':
                showToast(String(args.text ?? ''));
                return null;
            default:
                throw new Error('未知接口: ' + method);
        }
    }

    // 用宿主已录入的 API 设置调 AI（支持 OpenAI 兼容与 Gemini）
    async function hostCallAI(messages, opts) {
        const s = db.apiSettings || {};
        if (!s.url || !s.key) throw new Error('请先在 api 应用中配置 API 地址和密钥');
        if (!Array.isArray(messages) || !messages.length) throw new Error('messages 不能为空');

        const baseUrl = String(s.url).replace(/\/+$/, '');
        const key = typeof getRandomValue === 'function' ? getRandomValue(s.key) : s.key;
        const model = opts.model || s.model;

        if (s.provider === 'gemini') {
            const endpoint = `${baseUrl}/v1beta/models/${model}:generateContent?key=${key}`;
            const systemMsgs = messages.filter(m => m.role === 'system');
            const chatMsgs = messages.filter(m => m.role !== 'system');
            const body = {
                contents: chatMsgs.map(m => ({
                    role: (m.role === 'assistant') ? 'model' : 'user',
                    parts: [{ text: String(m.content) }]
                }))
            };
            if (systemMsgs.length) {
                body.system_instruction = { parts: [{ text: systemMsgs.map(m => String(m.content)).join('\n') }] };
            }
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);
            const json = await res.json();
            return json.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') ?? '';
        }

        const endpoint = `${baseUrl}/v1/chat/completions`;
        const body = {
            model: model,
            messages: messages.map(m => ({ role: m.role, content: String(m.content) })),
            temperature: (typeof opts.temperature === 'number') ? opts.temperature : 1,
            stream: false
        };
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);
        const json = await res.json();
        return json.choices?.[0]?.message?.content ?? '';
    }

    // ============ 主屏第三方 app 图标支持 ============
    function bindHomeIconEvents() {
        document.body.addEventListener('click', (e) => {
            const icon = e.target.closest('.store-app-icon');
            if (!icon) return;
            e.preventDefault();
            e.stopPropagation();
            openStoreApp(icon.getAttribute('data-app-id'));
        }, true);
    }

    // ============ 入口 ============
    window.setupAppStore = function () {
        injectAppStoreHtml();
        bindStoreListEvents();
        bindHomeIconEvents();
        setupBridgeHost();

        // 进入 store 界面时刷新数据
        document.body.addEventListener('click', (e) => {
            if (e.target.closest('[data-target="app-store-screen"]')) {
                renderStoreRepoCard();
                renderRemoteList();
                renderInstalledList();
                fetchRemoteApps(false);
            }
        });

        // 离开 runner 界面时清空 iframe 释放资源
        document.body.addEventListener('click', (e) => {
            const backBtn = e.target.closest('#store-app-runner-header .back-btn');
            if (backBtn && runnerIframe) {
                setTimeout(() => {
                    runnerIframe.srcdoc = '';
                    currentRunnerAppId = null;
                }, 350);
            }
        });

        // 初次渲染：先用上次缓存的远程列表秒出，再后台刷新
        remoteApps = readRemoteCache();
        renderStoreRepoCard();
        renderRemoteList();
        renderInstalledList();
    };

    // 暴露给 ui.js 渲染主屏图标用
    window.getInstalledStoreApps = function () {
        return db.installedStoreApps || [];
    };
})();
