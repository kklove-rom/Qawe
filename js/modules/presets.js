// --- 预设 App (js/modules/presets.js) ---
// 支持导入 SillyTavern 预设，按栏目开关 / 折叠 / 删除 / 长按改名 / 拖动排序，
// 并可按场景（聊天回复、通话、线下模式、动态与查手机）全局套用到提示词。

const PRESET_POSITIONS = [
    { value: 'before_settings', label: '角色设定之前' },
    { value: 'after_settings', label: '角色设定之后' },
    { value: 'before_reply', label: '角色回复之前' }
];

let currentPresetId = null;
let presetLongPressTimer = null;
let presetLongPressFired = false;
let presetDrag = null;

function getPresetList() {
    if (!Array.isArray(db.presets)) db.presets = [];
    return db.presets;
}

function getCurrentPreset() {
    return getPresetList().find(p => p.id === currentPresetId) || null;
}

function createPresetId() {
    return `preset_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

function createPresetItemId() {
    return `pi_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

function escapePresetText(text) {
    return String(text == null ? '' : text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function presetPositionLabel(value) {
    const found = PRESET_POSITIONS.find(p => p.value === value);
    return (found || PRESET_POSITIONS[2]).label;
}

function normalizePreset(raw, fallbackName) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    // SillyTavern 导出可能是 { preset: {...} } 或 { data: {...} }
    const wrapper = raw.preset || raw.data || raw;
    const promptList = Array.isArray(wrapper.prompts)
        ? wrapper.prompts
        : (Array.isArray(raw.prompts) ? raw.prompts : null);
    if (!promptList) return null;

    // prompt_order 里记录了栏目顺序与开关
    const orderMap = new Map();
    const orders = Array.isArray(wrapper.prompt_order) ? wrapper.prompt_order : [];
    if (orders.length) {
        const last = orders[orders.length - 1];
        (last.order || []).forEach(entry => {
            if (entry && entry.identifier) orderMap.set(entry.identifier, entry.enabled !== false);
        });
    }

    const items = [];
    promptList.forEach((prompt, index) => {
        if (!prompt || typeof prompt !== 'object') return;
        if (prompt.marker) return; // chatHistory 之类的占位标记没有内容
        const content = String(prompt.content || '').trim();
        if (!content) return;

        let position = 'before_reply';
        if (prompt.system_prompt) position = 'before_settings';
        else if (prompt.injection_position === 0) position = 'before_reply';
        else if (prompt.injection_position === 1) position = 'after_settings';

        const identifier = prompt.identifier || `item_${index}`;
        const enabled = orderMap.has(identifier)
            ? orderMap.get(identifier)
            : prompt.enabled !== false;

        items.push({
            id: createPresetItemId() + '_' + index,
            name: String(prompt.name || prompt.identifier || `栏目 ${index + 1}`).trim(),
            content,
            position,
            enabled,
            expanded: false
        });
    });

    const name = String(wrapper.name || raw.name || fallbackName || '导入的预设').trim();
    return {
        id: createPresetId(),
        name,
        enabled: true,
        applyTo: { chat: true, call: false, offline: false, peek: false },
        items,
        source: 'sillytavern',
        createdAt: Date.now()
    };
}

function presetItemHtml(item) {
    const position = item.position || 'before_reply';
    const preview = String(item.content || '').replace(/\s+/g, ' ').trim().slice(0, 46);
    const expanded = !!item.expanded;
    return `
    <div class="preset-item ${expanded ? 'expanded' : ''} ${item.enabled === false ? 'disabled' : ''}" data-item-id="${item.id}">
        <div class="preset-item-head">
            <div class="preset-item-name-wrap" data-item-name-wrap="${item.id}">
                <div class="preset-item-name">${escapePresetText(item.name)}</div>
                <div class="preset-item-preview">${escapePresetText(presetPositionLabel(position))} · ${escapePresetText(preview) || '（空内容）'}</div>
            </div>
            <div class="preset-item-tools">
                <label class="preset-switch" title="开启 / 关闭该栏目">
                    <input type="checkbox" data-item-toggle="${item.id}" ${item.enabled !== false ? 'checked' : ''}>
                    <span class="preset-switch-slider"></span>
                </label>
                <button type="button" class="preset-icon-btn preset-item-grip" data-item-grip="${item.id}" title="拖动排序">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="4" y1="8" x2="20" y2="8"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="16" x2="20" y2="16"></line></svg>
                </button>
                <button type="button" class="preset-icon-btn" data-item-expand="${item.id}" title="展开 / 收起">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${expanded ? '<polyline points="6 15 12 9 18 15"></polyline>' : '<polyline points="6 9 12 15 18 9"></polyline>'}</svg>
                </button>
                <button type="button" class="preset-icon-btn danger" data-item-del="${item.id}" title="删除栏目">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line></svg>
                </button>
            </div>
        </div>
        <div class="preset-item-body">
            <div class="preset-field">
                <label>插入位置</label>
                <select data-item-position="${item.id}">
                    ${PRESET_POSITIONS.map(p => `<option value="${p.value}" ${p.value === position ? 'selected' : ''}>${p.label}</option>`).join('')}
                </select>
            </div>
            <div class="preset-field">
                <label>内容</label>
                <textarea data-item-content="${item.id}" placeholder="输入该栏目的提示词内容...">${escapePresetText(item.content)}</textarea>
            </div>
        </div>
    </div>`;
}

function renderPresetsList() {
    const container = document.getElementById('presets-list-container');
    const placeholder = document.getElementById('no-presets-placeholder');
    if (!container) return;

    const presets = getPresetList();
    if (!presets.length) {
        container.innerHTML = '';
        if (placeholder) placeholder.style.display = 'block';
        return;
    }
    if (placeholder) placeholder.style.display = 'none';

    container.innerHTML = presets.map(preset => {
        const items = Array.isArray(preset.items) ? preset.items : [];
        const enabledCount = items.filter(item => item.enabled !== false).length;
        const apply = preset.applyTo || {};
        const scopes = [];
        if (apply.chat) scopes.push('聊天');
        if (apply.call) scopes.push('通话');
        if (apply.offline) scopes.push('线下');
        if (apply.peek) scopes.push('动态/查手机');
        return `
        <div class="preset-card" data-preset-id="${preset.id}">
            <div class="preset-card-icon">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="14" y2="17"></line></svg>
            </div>
            <div class="preset-card-info">
                <div class="preset-card-name">${escapePresetText(preset.name)}</div>
                <div class="preset-card-meta">${enabledCount}/${items.length} 个栏目开启${scopes.length ? ' · ' + scopes.join(' / ') : ' · 未套用'}</div>
            </div>
            <label class="preset-switch" title="整体开关">
                <input type="checkbox" data-preset-toggle="${preset.id}" ${preset.enabled !== false ? 'checked' : ''}>
                <span class="preset-switch-slider"></span>
            </label>
        </div>`;
    }).join('');
}

function renderPresetDetail() {
    const preset = getCurrentPreset();
    if (!preset) {
        switchScreen('presets-screen');
        renderPresetsList();
        return;
    }

    const title = document.getElementById('preset-detail-title');
    if (title) title.textContent = preset.name;

    if (!preset.applyTo) preset.applyTo = { chat: true, call: false, offline: false, peek: false };
    document.querySelectorAll('#preset-detail-content [data-apply]').forEach(box => {
        box.checked = !!preset.applyTo[box.dataset.apply];
    });

    const container = document.getElementById('preset-items-container');
    if (!container) return;
    const items = Array.isArray(preset.items) ? preset.items : [];
    container.innerHTML = items.length
        ? items.map(presetItemHtml).join('')
        : '<div class="preset-empty" style="padding: 40px 0;">还没有栏目，点击右上角「+」新增</div>';
}

function openPresetDetail(presetId) {
    currentPresetId = presetId;
    renderPresetDetail();
    switchScreen('preset-detail-screen');
}

function findPresetItem(itemId) {
    const preset = getCurrentPreset();
    if (!preset || !Array.isArray(preset.items)) return null;
    return preset.items.find(item => item.id === itemId) || null;
}

function createEmptyPreset(name) {
    return {
        id: createPresetId(),
        name,
        enabled: true,
        applyTo: { chat: true, call: false, offline: false, peek: false },
        items: [],
        source: 'manual',
        createdAt: Date.now()
    };
}

function importPresetFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            let data;
            try {
                data = JSON.parse(String(event.target.result || ''));
            } catch (error) {
                showToast('JSON 解析失败');
                return;
            }
            const fallbackName = file.name.replace(/\.[^.]+$/, '');
            const rawList = Array.isArray(data) ? data : [data];
            let imported = 0;
            for (const raw of rawList) {
                const preset = normalizePreset(raw, fallbackName);
                if (!preset) continue;
                const existing = getPresetList().find(p => p.name === preset.name);
                if (existing) {
                    if (!confirm(`已存在同名预设「${preset.name}」，是否覆盖？`)) continue;
                    preset.id = existing.id;
                    Object.assign(existing, preset);
                } else {
                    getPresetList().push(preset);
                }
                imported += 1;
            }
            if (!imported) {
                showToast('未识别到可导入的预设');
                return;
            }
            await saveData();
            renderPresetsList();
            showToast(`已导入 ${imported} 个预设`);
        };
        reader.onerror = () => showToast('文件读取失败');
        reader.readAsText(file, 'utf-8');
    });
    input.click();
}

function startPresetDrag(event) {
    const card = event.target.closest('.preset-item');
    if (!card) return;
    presetDrag = { el: card, id: card.dataset.itemId };
    card.classList.add('dragging');
    card.style.pointerEvents = 'none';
    document.addEventListener('pointermove', onPresetDragMove);
    document.addEventListener('pointerup', onPresetDragEnd);
    document.addEventListener('pointercancel', onPresetDragEnd);
    event.preventDefault();
}

function onPresetDragMove(event) {
    if (!presetDrag) return;
    const node = document.elementFromPoint(event.clientX, event.clientY);
    const target = node && node.closest ? node.closest('.preset-item') : null;
    if (target && target !== presetDrag.el && target.parentNode === presetDrag.el.parentNode) {
        const rect = target.getBoundingClientRect();
        const insertAfter = event.clientY > rect.top + rect.height / 2;
        target.parentNode.insertBefore(presetDrag.el, insertAfter ? target.nextSibling : target);
    }
    event.preventDefault();
}

async function onPresetDragEnd() {
    if (!presetDrag) return;
    const { el } = presetDrag;
    el.classList.remove('dragging');
    el.style.pointerEvents = '';
    const parent = el.parentNode;
    if (parent) {
        const ids = Array.from(parent.querySelectorAll('.preset-item')).map(node => node.dataset.itemId);
        const preset = getCurrentPreset();
        if (preset && Array.isArray(preset.items)) {
            preset.items.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
            await saveData();
        }
    }
    document.removeEventListener('pointermove', onPresetDragMove);
    document.removeEventListener('pointerup', onPresetDragEnd);
    document.removeEventListener('pointercancel', onPresetDragEnd);
    presetDrag = null;
}

function setupPresetsApp() {
    const addBtn = document.getElementById('add-preset-btn');
    const menu = document.getElementById('presets-new-menu');
    const listContainer = document.getElementById('presets-list-container');
    const detailContent = document.getElementById('preset-detail-content');
    const itemsContainer = document.getElementById('preset-items-container');

    // 顶部「+」菜单
    if (addBtn && menu) {
        addBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        });
        document.addEventListener('click', () => {
            menu.style.display = 'none';
        });
    }

    const newPresetMenuItem = document.getElementById('preset-menu-new');
    if (newPresetMenuItem) {
        newPresetMenuItem.addEventListener('click', async () => {
            const name = prompt('请输入预设名称：');
            if (!name || !name.trim()) return;
            const preset = createEmptyPreset(name.trim());
            getPresetList().push(preset);
            await saveData();
            renderPresetsList();
            openPresetDetail(preset.id);
        });
    }

    const importMenuItem = document.getElementById('preset-menu-import');
    if (importMenuItem) {
        importMenuItem.addEventListener('click', () => importPresetFile());
    }

    // 列表：打开预设 / 整体开关 / 长按删除
    if (listContainer) {
        let listLongPressTimer = null;
        let listLongPressFired = false;

        listContainer.addEventListener('pointerdown', (event) => {
            const card = event.target.closest('.preset-card');
            if (!card || event.target.closest('.preset-switch')) return;
            listLongPressFired = false;
            clearTimeout(listLongPressTimer);
            listLongPressTimer = setTimeout(async () => {
                listLongPressFired = true;
                const preset = getPresetList().find(p => p.id === card.dataset.presetId);
                if (!preset) return;
                if (!confirm(`删除预设「${preset.name}」？`)) return;
                db.presets = getPresetList().filter(p => p.id !== preset.id);
                await saveData();
                renderPresetsList();
                showToast('预设已删除');
            }, 800);
        });
        listContainer.addEventListener('pointerup', () => clearTimeout(listLongPressTimer));
        listContainer.addEventListener('pointercancel', () => clearTimeout(listLongPressTimer));
        listContainer.addEventListener('pointermove', () => clearTimeout(listLongPressTimer));

        listContainer.addEventListener('click', (event) => {
            if (event.target.closest('.preset-switch')) return;
            if (listLongPressFired) {
                listLongPressFired = false;
                return;
            }
            const card = event.target.closest('.preset-card');
            if (card) openPresetDetail(card.dataset.presetId);
        });

        listContainer.addEventListener('change', async (event) => {
            const toggle = event.target.closest('[data-preset-toggle]');
            if (!toggle) return;
            const preset = getPresetList().find(p => p.id === toggle.dataset.presetToggle);
            if (!preset) return;
            preset.enabled = toggle.checked;
            await saveData();
        });
    }

    // 详情页顶部按钮
    const backBtn = document.getElementById('preset-detail-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            renderPresetsList();
            switchScreen('presets-screen');
        });
    }

    const addItemBtn = document.getElementById('add-preset-item-btn');
    if (addItemBtn) {
        addItemBtn.addEventListener('click', async () => {
            const preset = getCurrentPreset();
            if (!preset) return;
            const name = prompt('请输入栏目名称：');
            if (!name || !name.trim()) return;
            if (!Array.isArray(preset.items)) preset.items = [];
            const item = {
                id: createPresetItemId(),
                name: name.trim(),
                content: '',
                position: 'before_reply',
                enabled: true,
                expanded: true
            };
            preset.items.push(item);
            await saveData();
            renderPresetDetail();
        });
    }

    const deletePresetBtn = document.getElementById('delete-preset-btn');
    if (deletePresetBtn) {
        deletePresetBtn.addEventListener('click', async () => {
            const preset = getCurrentPreset();
            if (!preset) return;
            if (!confirm(`删除预设「${preset.name}」？此操作不可撤销。`)) return;
            db.presets = getPresetList().filter(p => p.id !== preset.id);
            currentPresetId = null;
            await saveData();
            renderPresetsList();
            switchScreen('presets-screen');
            showToast('预设已删除');
        });
    }

    // 详情页全局套用（可多选）
    if (detailContent) {
        detailContent.addEventListener('change', async (event) => {
            const box = event.target.closest('[data-apply]');
            if (!box) return;
            const preset = getCurrentPreset();
            if (!preset) return;
            if (!preset.applyTo) preset.applyTo = {};
            preset.applyTo[box.dataset.apply] = box.checked;
            await saveData();
        });
    }

    if (itemsContainer) {
        // 展开 / 删除 / 拖动
        itemsContainer.addEventListener('click', async (event) => {
            const expandBtn = event.target.closest('[data-item-expand]');
            if (expandBtn) {
                const item = findPresetItem(expandBtn.dataset.itemExpand);
                if (!item) return;
                item.expanded = !item.expanded;
                renderPresetDetail();
                return;
            }

            const delBtn = event.target.closest('[data-item-del]');
            if (delBtn) {
                const preset = getCurrentPreset();
                const item = findPresetItem(delBtn.dataset.itemDel);
                if (!preset || !item) return;
                if (!confirm(`删除栏目「${item.name}」？`)) return;
                preset.items = preset.items.filter(i => i.id !== item.id);
                await saveData();
                renderPresetDetail();
                return;
            }

            if (presetLongPressFired) {
                presetLongPressFired = false;
                return;
            }

            const nameWrap = event.target.closest('.preset-item-name-wrap');
            if (nameWrap && !event.target.closest('.preset-item-tools')) {
                const item = findPresetItem(nameWrap.dataset.itemNameWrap);
                if (!item) return;
                item.expanded = !item.expanded;
                renderPresetDetail();
            }
        });

        // 开关 / 插入位置 / 内容失焦保存
        itemsContainer.addEventListener('change', async (event) => {
            const toggle = event.target.closest('[data-item-toggle]');
            if (toggle) {
                const item = findPresetItem(toggle.dataset.itemToggle);
                if (!item) return;
                item.enabled = toggle.checked;
                item.expanded = item.expanded === true;
                await saveData();
                renderPresetDetail();
                return;
            }

            const select = event.target.closest('[data-item-position]');
            if (select) {
                const item = findPresetItem(select.dataset.itemPosition);
                if (!item) return;
                item.position = select.value;
                await saveData();
                renderPresetDetail();
                return;
            }

            const textarea = event.target.closest('[data-item-content]');
            if (textarea) {
                const item = findPresetItem(textarea.dataset.itemContent);
                if (!item) return;
                item.content = textarea.value;
                await saveData();
            }
        });

        itemsContainer.addEventListener('input', (event) => {
            const textarea = event.target.closest('[data-item-content]');
            if (!textarea) return;
            const item = findPresetItem(textarea.dataset.itemContent);
            if (item) item.content = textarea.value;
        });

        // 长按 3 秒栏目名改名
        itemsContainer.addEventListener('pointerdown', (event) => {
            const grip = event.target.closest('.preset-item-grip');
            if (grip) {
                startPresetDrag(event);
                return;
            }

            const nameWrap = event.target.closest('.preset-item-name-wrap');
            if (!nameWrap) return;
            presetLongPressFired = false;
            clearTimeout(presetLongPressTimer);
            presetLongPressTimer = setTimeout(async () => {
                presetLongPressFired = true;
                const item = findPresetItem(nameWrap.dataset.itemNameWrap);
                if (!item) return;
                const name = prompt('修改栏目名称：', item.name);
                if (!name || !name.trim()) return;
                item.name = name.trim();
                await saveData();
                renderPresetDetail();
                showToast('栏目名称已更新');
            }, 3000);
        });
        ['pointerup', 'pointercancel', 'pointermove'].forEach(type => {
            itemsContainer.addEventListener(type, () => clearTimeout(presetLongPressTimer));
        });
    }
}

// 供其他模块组装提示词使用
function buildPresetPromptSection(scope, character) {
    const buckets = { before_settings: [], after_settings: [], before_reply: [] };
    getPresetList().forEach(preset => {
        if (preset.enabled === false) return;
        const apply = preset.applyTo || {};
        // 「线下模式」目前与聊天回复共用同一套提示词，勾选后也会在聊天中生效
        if (!apply[scope] && !(scope === 'chat' && apply.offline)) return;
        (preset.items || []).forEach(item => {
            if (item.enabled === false) return;
            const content = String(item.content || '').trim();
            if (!content) return;
            const key = buckets[item.position] ? item.position : 'before_reply';
            buckets[key].push(content);
        });
    });
    const join = list => list.join('\n');
    const result = {
        beforeSettings: join(buckets.before_settings),
        afterSettings: join(buckets.after_settings),
        beforeReply: join(buckets.before_reply)
    };
    result.hasContent = !!(result.beforeSettings || result.afterSettings || result.beforeReply);
    return result;
}

window.PresetPrompts = {
    build: buildPresetPromptSection,
    renderList: renderPresetsList
};
