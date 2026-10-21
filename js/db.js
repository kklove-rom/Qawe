// --- 数据库与全局状态 (js/db.js) ---

// 常量定义
const BLOCKED_API_DOMAINS = [
    'api522.pro',
    'api521.pro',
    'api520.pro'
];

const colorThemes = {
    'white_pink': {
        name: '白/粉',
        received: {bg: 'rgba(255,255,255,0.9)', text: '#6D6D6D'},
        sent: {bg: 'rgba(255,204,204,0.9)', text: '#A56767'}
    },
    'white_blue': {
        name: '白/蓝',
        received: {bg: 'rgba(255,255,255,0.9)', text: '#6D6D6D'},
        sent: {bg: 'rgba(173,216,230,0.9)', text: '#4A6F8A'}
    },
    'white_yellow': {
        name: '白/黄',
        received: {bg: 'rgba(255,255,255,0.9)', text: '#6D6D6D'},
        sent: {bg: 'rgba(249,237,105,0.9)', text: '#8B7E4B'}
    },
    'white_green': {
        name: '白/绿',
        received: {bg: 'rgba(255,255,255,0.9)', text: '#6D6D6D'},
        sent: {bg: 'rgba(188,238,188,0.9)', text: '#4F784F'}
    },
    'white_purple': {
        name: '白/紫',
        received: {bg: 'rgba(255,255,255,0.9)', text: '#6D6D6D'},
        sent: {bg: 'rgba(185,190,240,0.9)', text: '#6C5B7B'}
    },
    'black_red': {
        name: '黑/红',
        received: {bg: 'rgba(30,30,30,0.85)', text: '#E0E0E0'},
        sent: {bg: 'rgb(226,62,87,0.9)', text: '#fff'}
    },
    'black_green': {
        name: '黑/绿',
        received: {bg: 'rgba(30,30,30,0.85)', text: '#E0E0E0'},
        sent: {bg: 'rgba(119,221,119,0.9)', text: '#2E5C2E'}
    },
    'black_white': {
        name: '黑/白',
        received: {bg: 'rgba(30,30,30,0.85)', text: '#E0E0E0'},
        sent: {bg: 'rgba(245,245,245,0.9)', text: '#333'}
    },
    'white_black': {
        name: '白/黑',
        received: {bg: 'rgba(255,255,255,0.9)', text: '#6D6D6D'},
        sent: {bg: 'rgba(50,50,50,0.85)', text: '#F5F5F5'}
    },
    'yellow_purple': {
        name: '黄/紫',
        received: {bg: 'rgba(255,250,205,0.9)', text: '#8B7E4B'},
        sent: {bg: 'rgba(185,190,240,0.9)', text: '#6C5B7B'}
    },
    'pink_blue': {
        name: '粉/蓝',
        received: {bg: 'rgba(255,231,240,0.9)', text: '#7C6770'},
        sent: {bg: 'rgba(173,216,230,0.9)', text: '#4A6F8A'}
    },
};

const defaultWidgetSettings = {
    centralCircleImage: 'https://i.postimg.cc/mD83gR29/avatar-1.jpg',
    topLeft: { emoji: '🎧', text: '𝑀𝑒𝑚𝑜𝑟𝑖𝑒𝑠✞' },
    topRight: { emoji: '🐈‍⬛', text: '𐙚 ♰.𝐾𝑖𝑡𝑡𝑒𝑛.♰' },
    bottomLeft: { emoji: '💿', text: '᪗₊𝔹𝕒𝕓𝕖𝕚𝕤₊' },
    bottomRight: { emoji: '🥛', text: '.☘︎ ˖+×+.' }
};

const DEFAULT_WALLPAPER_URL = 'https://picui.ogmua.cn/s1/2026/10/21/6ad87595d70c3.webp';
const LEGACY_DEFAULT_WALLPAPER_URL = 'https://i.postimg.cc/W4Z9R9x4/ins-1.jpg';

const defaultIcons = {
    'chat-list-screen': {name: '404', url: 'https://i.postimg.cc/VvQB8dQT/chan-143.png'},
    'api-settings-screen': {name: 'api', url: 'https://i.postimg.cc/50FqT8GL/chan-125.png'},
    'wallpaper-screen': {name: '壁纸', url: 'https://i.postimg.cc/3wqFttL3/chan-90.png'},
    'world-book-screen': {name: '世界书', url: 'https://i.postimg.cc/prCWkrKT/chan-74.png'},
    'customize-screen': {name: '自定义', url: 'https://i.postimg.cc/vZVdC7gt/chan-133.png'},
    'font-settings-screen': {name: '字体', url: 'https://i.postimg.cc/FzVtC0x4/chan-21.png'},
    'tutorial-screen': {name: '教程', url: 'https://i.postimg.cc/6QgNzCFf/chan-118.png'},
    'day-mode-btn': {name: '白昼模式', url: 'https://i.postimg.cc/Jz0tYqnT/chan-145.png'},
    'night-mode-btn': {name: '夜间模式', url: 'https://i.postimg.cc/htYvkdQK/chan-146.png'},
    'music-screen': {name: '音乐', url: 'https://i.postimg.cc/ydd65txK/1758451018266.png'},
    'storage-analysis-screen': {name: '存储分析', url: 'https://i.postimg.cc/J0F3Lt0T/chan-107.png'},
    'widget-market-screen': {name: '小组件', url: 'https://i.postimg.cc/NG2k67zS/ji-lichan-(138).png'},
    'app-store-screen': {name: 'Store', url: 'https://picui.ogmua.cn/s1/2026/10/21/6ad877ebd97a1.webp'}
};

const peekScreenApps = {
    'messages': { name: '消息', url: 'https://i.postimg.cc/Kvs4tDh5/export202509181826424260.png' },
    'memos': { name: '备忘录', url: 'https://i.postimg.cc/JzD0xH1C/export202509181829064550.png' },
    'cart': { name: '购物车', url: 'https://i.postimg.cc/pLwT6VTh/export202509181830143960.png' },
    'transfer': { name: '中转站', url: 'https://i.postimg.cc/63wQBHCB/export202509181831140230.png' },
    'browser': { name: '浏览器', url: 'https://i.postimg.cc/SKcsF02Z/export202509181830445980.png' },
    'drafts': { name: '草稿箱', url: 'https://i.postimg.cc/ZKqC9D2R/export202509181827225860.png' },
    'album': { name: '相册', url: 'https://i.postimg.cc/qBcdpqNc/export202509221549335970.png' },
    'steps': { name: '步数', url: 'https://i.postimg.cc/5NndFrq6/export202509181824532800.png' },
    'unlock': { name: 'unlock！', url: 'https://i.postimg.cc/28zNyYWs/export202509221542593320.png' },
    'bag': { name: '翻包', url: 'https://i.postimg.cc/kGSN7qSq/ji-lichan-(136).png' }
};

const DEFAULT_COT_PRESETS = [
    {
        id: 'default',
        name: '默认思维链',
        items: [
            {
                id: 'cot_item_1',
                name: '引子',
                content: '[System Directive]:\n你必须严格遵守 [incipere] 协议。在回复前，请先进入 <thinking> 标签进行深度推演。\n请按以下步骤查阅 System Prompt 中的模块并思考：',
                enabled: true
            },
            {
                id: 'cot_item_2',
                name: '准备动脑了吗？',
                content: '---\n## 【前置规则】\n### **必须**读取所有<logic_rules>和<output_formats>：了解**所有**需要遵守的规则，然后进行以下步骤精简准确的思考',
                enabled: true
            },
            {
                id: 'cot_item_3',
                name: '给我读设定！',
                content: '---\n## 【行为校准】\n基于<char_settings>和<角色活人运转>构建角色人格\n### Phase1: person\n1. **自我意识校验 (Ref: <char_settings>和<角色活人运转>)**\n   - 是否塑造鲜活真实人格？\n   - 你（角色）是否具有自己的聊天习惯/风格？\n   - 你想如何回应我？',
                enabled: true
            },
            {
                id: 'cot_item_4',
                name: '当个人吧。',
                content: '### Phase2: Verisimilitude\n2.**真实聊天**\n   - 是否根据以下两点要求采用了真人聊天思路？\n    - 正常人的注意力是有限的，不会每句话都非得逐句回复。\n    - 不对已有信息进行重复反问。\n    - 断点处理：若与上一条消息间隔较久，默认双方只是自然忙碌后重新拿起手机或默认期间以其他方式保持联系，自然接续话题。',
                enabled: true
            },
            {
                id: 'cot_item_5',
                name: '有特殊格式吗？',
                content: '### Phase3: chat role\n3. **逻辑检索 (Ref: <logic_rules>)**\n   - 当前是否为双语对话情境？若无，跳过此条\n   - 是否需要输出状态栏？若无相关要求，则跳过此条',
                enabled: true
            },
            {
                id: 'cot_item_6',
                name: '最后确认一下。',
                content: '## 【最后确认】\n\n4. 整合<Chatting Guidelines>，是否合理自然回复且不偏离人设？回顾<output_formats>，输出消息格式是否正确？',
                enabled: true
            },
            {
                id: 'cot_item_7',
                name: '尾声',
                content: '每轮输出前，必须先严格按照<thinking>…</thinking>内的步骤进行逐条思考，无需重复其中的条目，但思考内容需精简准确、清晰、可执行，不得跳步骤。\n<thinking>中的所有分析必须在输出中完全落实，不得偏离、删减或弱化。\n\n格式：\n<thinking>\n...思考过程...\n</thinking>',
                enabled: true
            }
        ]
    }
];

const globalSettingKeys = [
    'apiSettings', 'wallpaper', 'homeScreenMode', 'fontUrl', 'customIcons',
    'apiPresets', 'bubbleCssPresets', 'myPersonaPresets', 'globalCss',
    'globalCssPresets', 'fontPresets', 'homeSignature', 'insWidgetSettings', 'homeWidgetSettings',
    'chatFolders', 'fontSizeScale', 'activePersonaId', 'moreProfileCardBg', 'statusBarPresets', 'themeSettings', 'themePresets', 'savedKeyboardHeight',
    'globalSendSound', 'globalReceiveSound', 'multiMsgSoundEnabled', 'soundPresets', 'galleryPresets',
    'cotSettings', 'cotPresets', 'hasSeenVideoCallDisclaimer', 'hasSeenVideoCallAvatarHint',
    'workshopSettings', 'workshopLlmPresets', 'workshopPromptPresets', 'homeLayoutOrder',
    'homeLayoutPages', 'widgetTemplates', 'addedWidgets', 'backupReminderSettings',
    'stUnlocked', 'installedStoreApps'
];


const appVersion = "4.0.0";
const updateLog = [
    {
        version: "4.0.0",
        date: "2026-10-21",
        notes: [
            "———— QA机 ————",
            "基于UwU章鱼机1.8.9版本二改，特别鸣谢以下老师:",
            "源代码来源：EE、1900、莫由（论坛功能by莫由）",
            "—————————————",
            "news:",
            "1.增加Store商店",
            "2.修改了默认壁纸",
            "3.更多隐藏玩法待挖掘，可使用《Store应用开发提示词》文档自行游玩(◦˙▽˙◦)★",
        ]
    },
    {
        version: "1.8.9",
        date: "2026-07-28",
        notes: [
            "世界书的插入位置改动：世界书·前拆分为：世界书·破限、世界书·前；世界书后拆分为：世界书·后、世界书·聊天补充。",
            "新增第二套提示词（T.T），聊天、通话都有，通话没测试过。在思维链界面切换，内配置了默认思维链。详细说明见dc",
            "原·存储空间大改，新增：详细可视化，分类导出导入，图片缓存清理。",
            "新增逻辑：user最新一轮发言会被包裹在<user_input>中，思维链撰写可引用此标签。",
            "新增：noval生图解锁vibe组的使用，可以导入官网的vibe组，去wbz跑图论坛找找看也有很多老师分享的vibe组，用之前请先询问是否支持导入小手机。（在此力荐“哇哦哦哦”老师的vibe）",
            "新增：阅读器，增加和char一起……骗你的，就是个普普通通阅读器！但可以文生图（只测试了noval），因为就算为了这点醋包的饺子！生成后在当前章节会插入段评小标识，点击后查看图片。",
        ]
    }
];

// 全局变量
var db = {
    characters: [],
    groups: [],
    apiSettings: {},
    wallpaper: DEFAULT_WALLPAPER_URL,
    myStickers: [],
    homeScreenMode: 'night',
    worldBooks: [],
    fontUrl: '',
    customIcons: {},
    apiPresets: [],
    bubbleCssPresets: [],
    myPersonaPresets: [],
    fontPresets: [],
    globalCss: '',
    globalCssPresets: [],
    homeSignature: '编辑个性签名...',
    insWidgetSettings: {
        avatar1: 'https://i.postimg.cc/Y96LPskq/o-o-2.jpg',
        bubble1: 'love u.',
        avatar2: 'https://i.postimg.cc/GtbTnxhP/o-o-1.jpg',
        bubble2: 'miss u.'
    },
    chatFolders: [],
    fontSizeScale: 1.0,
    savedKeyboardHeight: null,
    activePersonaId: null,
    moreProfileCardBg: 'https://i.postimg.cc/XvFDdTKY/Smart-Select-20251013-023208.jpg',
    statusBarPresets: [],
    themeSettings: {
        global: {
            iconColor: '#000000',
            textColor: '#2a3032',
            titleColor: '#000000',
            backgroundColor: '#ffffff'
        },
        wallpapers: {
            contacts: '',
            chats: '',
            more: ''
        },
        bottomNav: {
            iconColor: '#999999',
            activeIconColor: '#2a3032',
            items: [
                { defaultIcon: '', activeIcon: '' },
                { defaultIcon: '', activeIcon: '' },
                { defaultIcon: '', activeIcon: '' },
                { defaultIcon: '', activeIcon: '' }
            ]
        },
        chatScreen: {
            bottomBarColor: '#ffffff',
            iconColor: '#000000',
            folderPillColor: '#ffffff'
        }
    },
    themePresets: [],
    globalSendSound: '',
    globalReceiveSound: '',
    multiMsgSoundEnabled: false,
    soundPresets: [],
    galleryPresets: [],
    cotSettings: {
        enabled: false,
        activePresetId: 'default',
        prefillEnabled: true,
        callPrefillEnabled: true
    },
    cotPresets: JSON.parse(JSON.stringify(DEFAULT_COT_PRESETS)),
    workshopSettings: {
        provider: '',
        apiType: 'official',
        apiUrl: '',
        apiKey: '',
        model: '',
        width: 832,
        height: 1216,
        cfgScale: 5.0,
        rateLimit: 45,
        positivePrompt: '',
        characterPrompt: '',
        negativePrompt: '',
        llmIndependentApi: false,
        llmApiPresetId: '',
        gptLlmIndependentApi: false,
        gptLlmApiPresetId: '',
        boundCharacters: []
    },
    workshopLlmPresets: [],
    workshopPromptPresets: [],
    widgetTemplates: [],
    addedWidgets: [],
    backupReminderSettings: {
        enabled: true,
        interval: 3,
        lastReminderTime: 0
    },
    installedStoreApps: []
};


var currentChatId = null;
var currentChatType = null;
var isGenerating = false;
var longPressTimer = null;
var isInMultiSelectMode = false;
var editingMessageId = null;
var currentPage = 1;
var currentTransferMessageId = null;
var currentEditingWorldBookId = null;
var currentStickerActionTarget = null;
var currentJournalDetailId = null;
var currentQuoteInfo = null;
var isDebugMode = false;
var currentFolderId = 'all';
var currentFolderActionTarget = null;
var currentGroupAction = {type: null, recipients: []};
var isRawEditMode = false;
var isStickerManageMode = false;
var selectedStickerIds = new Set();
var isWorldBookMultiSelectMode = false;
var selectedWorldBookIds = new Set();
var generatingPeekApps = new Set();
var selectedMessageIds = new Set();
var currentStickerCategory = 'recent';
const MESSAGES_PER_PAGE = 50;


// Dexie 数据库初始化
var dexieDB; // 声明全局变量，但不初始化

function initDatabase() {
    dexieDB = new Dexie('章鱼喷墨机DB_ee');
    dexieDB.version(1).stores({
        storage: 'key, value'
    });
    dexieDB.version(8).stores({
        characters: '&id',
        groups: '&id',
        worldBooks: '&id',
        myStickers: '&id',
        globalSettings: 'key',
        workshopHistory: '++id, timestamp',
        workshopVibeGroups: '++id',
        characterPhotos: '++id, charId, timestamp',
        customFonts: '&id',
        reader_books: '&id, lastReadTime',
        reader_chapters: '&id, bookId',
        reader_comments: '++id, bookId, [bookId+chapterIndex+paragraphIndex]'
    });
    dexieDB.version(7).stores({
        characters: '&id',
        groups: '&id',
        worldBooks: '&id',
        myStickers: '&id',
        globalSettings: 'key',
        workshopHistory: '++id, timestamp',
        workshopVibeGroups: '++id',
        characterPhotos: '++id, charId, timestamp',
        customFonts: '&id',
        reader_books: '&id, lastReadTime',
        reader_chapters: '&id, bookId'
    });
    dexieDB.version(6).stores({
        characters: '&id',
        groups: '&id',
        worldBooks: '&id',
        myStickers: '&id',
        globalSettings: 'key',
        workshopHistory: '++id, timestamp',
        workshopVibeGroups: '++id',
        characterPhotos: '++id, charId, timestamp',
        customFonts: '&id',
        reader_books: '&id',
        reader_chapters: '&id, bookId'
    });
    dexieDB.version(5).stores({
        characters: '&id',
        groups: '&id',
        worldBooks: '&id',
        myStickers: '&id',
        globalSettings: 'key',
        workshopHistory: '++id, timestamp',
        workshopVibeGroups: '++id',
        characterPhotos: '++id, charId, timestamp',
        customFonts: '&id'
    });
    dexieDB.version(4).stores({
        characters: '&id',
        groups: '&id',
        worldBooks: '&id',
        myStickers: '&id',
        globalSettings: 'key',
        workshopHistory: '++id, timestamp',
        workshopVibeGroups: '++id',
        characterPhotos: '++id, charId, timestamp'
    }).upgrade(async tx => {
        console.log("Upgrading database to version 2...");
        const oldData = await tx.table('storage').get('章鱼喷墨机');
        if (oldData && oldData.value) {
            console.log("Old data found, starting migration.");
            const data = JSON.parse(oldData.value);
            if (data.characters) await tx.table('characters').bulkPut(data.characters);
            if (data.groups) await tx.table('groups').bulkPut(data.groups);
            if (data.worldBooks) await tx.table('worldBooks').bulkPut(data.worldBooks);
            if (data.myStickers) await tx.table('myStickers').bulkPut(data.myStickers);
            
            const settingsToMigrate = {
                apiSettings: data.apiSettings || {},
                wallpaper: data.wallpaper || DEFAULT_WALLPAPER_URL,
                homeScreenMode: data.homeScreenMode || 'night',
                fontUrl: data.fontUrl || '',
                customIcons: data.customIcons || {},
                apiPresets: data.apiPresets || [],
                bubbleCssPresets: data.bubbleCssPresets || [],
                myPersonaPresets: data.myPersonaPresets || [],
                globalCss: data.globalCss || '',
                globalCssPresets: data.globalCssPresets || [],
                homeSignature: data.homeSignature || '编辑个性签名...',
                insWidgetSettings: data.insWidgetSettings || { avatar1: 'https://i.postimg.cc/Y96LPskq/o-o-2.jpg', bubble1: 'love u.', avatar2: 'https://i.postimg.cc/GtbTnxhP/o-o-1.jpg', bubble2: 'miss u.' },
                homeWidgetSettings: data.homeWidgetSettings || defaultWidgetSettings,
            moreProfileCardBg: data.moreProfileCardBg || 'https://i.postimg.cc/XvFDdTKY/Smart-Select-20251013-023208.jpg',
            cotSettings: data.cotSettings || { enabled: false, activePresetId: 'default' },
            cotPresets: data.cotPresets || JSON.parse(JSON.stringify(DEFAULT_COT_PRESETS)),
            workshopSettings: {
                provider: '', apiType: 'official', apiUrl: '', apiKey: '', model: '',
                width: 832, height: 1216, cfgScale: 5.0, rateLimit: 45,
                positivePrompt: '', characterPrompt: '', negativePrompt: '', llmIndependentApi: false, llmApiPresetId: '', gptLlmIndependentApi: false, gptLlmApiPresetId: '', boundCharacters: []
            },
            workshopLlmPresets: [],
            workshopPromptPresets: [],
            homeLayoutOrder: ['widget-top', 'widget-ins', 'app-chat', 'app-api', 'app-wallpaper', 'app-worldbook', 'app-customize', 'app-tutorial', 'widget-heart'],
            widgetTemplates: [],
            addedWidgets: []
        };


            const settingsPromises = Object.entries(settingsToMigrate).map(([key, value]) =>
                tx.table('globalSettings').put({ key, value })
            );
            await Promise.all(settingsPromises);
            
            await tx.table('storage').delete('章鱼喷墨机');
            console.log("Migration complete. Old data removed.");
        } else {
            console.log("No old data found to migrate.");
        }
    });
}

// 数据保存与加载
const saveData = async () => {
    if (!dexieDB) return;
    if (typeof syncAllActiveArchives === 'function') {
        syncAllActiveArchives();
    }
    await dexieDB.transaction('rw', dexieDB.tables, async () => {
        await dexieDB.characters.bulkPut(db.characters);
        await dexieDB.groups.bulkPut(db.groups);
        await dexieDB.worldBooks.bulkPut(db.worldBooks);
        await dexieDB.myStickers.bulkPut(db.myStickers);

        const settingsPromises = globalSettingKeys.map(key => {
            if (db[key] !== undefined) {
                return dexieDB.globalSettings.put({ key: key, value: db[key] });
            }
            return null;
        }).filter(p => p);
        await Promise.all(settingsPromises);
    });
};

const loadData = async () => {
    const [characters, groups, worldBooks, myStickers, settingsArray] = await Promise.all([
        dexieDB.characters.toArray(),
        dexieDB.groups.toArray(),
        dexieDB.worldBooks.toArray(),
        dexieDB.myStickers.toArray(),
        dexieDB.globalSettings.toArray()
    ]);

    db.characters = characters;
    db.groups = groups;
    db.worldBooks = worldBooks;
    db.myStickers = myStickers;

    // 兼容旧数据：为没有 type 的世界书条目默认设置为 'entry'
    db.worldBooks.forEach(item => {
        if (!item.type) {
            item.type = 'entry';
        }
    });

    const settings = settingsArray.reduce((acc, { key, value }) => {
        acc[key] = value;
        return acc;
    }, {});

    globalSettingKeys.forEach(key => {
        const defaultValue = {
            apiSettings: {},
            wallpaper: DEFAULT_WALLPAPER_URL,
            homeScreenMode: 'night',
            fontUrl: '',
            customIcons: {},
            apiPresets: [],
            bubbleCssPresets: [],
            myPersonaPresets: [],
            fontPresets: [],
            globalCss: '',
            globalCssPresets: [],
            homeSignature: '编辑个性签名...',
            insWidgetSettings: { avatar1: 'https://i.postimg.cc/Y96LPskq/o-o-2.jpg', bubble1: 'love u.', avatar2: 'https://i.postimg.cc/GtbTnxhP/o-o-1.jpg', bubble2: 'miss u.' },
            homeWidgetSettings: defaultWidgetSettings,
            activePersonaId: null,
            moreProfileCardBg: 'https://i.postimg.cc/XvFDdTKY/Smart-Select-20251013-023208.jpg',
            globalSendSound: '',
            globalReceiveSound: '',
            multiMsgSoundEnabled: false,
            soundPresets: [],
            galleryPresets: [],
            cotSettings: { enabled: false, activePresetId: 'default', prefillEnabled: true, callPrefillEnabled: true },
            cotPresets: JSON.parse(JSON.stringify(DEFAULT_COT_PRESETS)),
            hasSeenVideoCallDisclaimer: false,
            hasSeenVideoCallAvatarHint: false,
            workshopSettings: {
                provider: '', apiType: 'official', apiUrl: '', apiKey: '', model: '',
                width: 832, height: 1216, cfgScale: 5.0, rateLimit: 45,
                positivePrompt: '', characterPrompt: '', negativePrompt: '', llmIndependentApi: false, llmApiPresetId: '', gptLlmIndependentApi: false, gptLlmApiPresetId: '', boundCharacters: []
            },
            workshopLlmPresets: [],
            workshopPromptPresets: [],
            homeLayoutOrder: ['widget-top', 'widget-ins', 'app-chat', 'app-api', 'app-wallpaper', 'app-worldbook', 'app-customize', 'app-tutorial', 'widget-heart'],
            homeLayoutPages: null,
            backupReminderSettings: { enabled: true, interval: 3, lastReminderTime: 0 },
            stUnlocked: false,
            installedStoreApps: []
        };
        db[key] = settings[key] !== undefined ? settings[key] : (defaultValue[key] !== undefined ? JSON.parse(JSON.stringify(defaultValue[key])) : undefined);
    });

    // 旧版默认壁纸自动迁移到新版；用户自己上传/选择的壁纸不受影响
    if (db.wallpaper === LEGACY_DEFAULT_WALLPAPER_URL) {
        db.wallpaper = DEFAULT_WALLPAPER_URL;
    }

    // Data integrity checks
    db.characters.forEach(c => {
        if (!c.peekData) c.peekData = {}; 
        if (c.isPinned === undefined) c.isPinned = false;
        if (c.status === undefined) c.status = '在线';
        if (!c.worldBookIds) c.worldBookIds = [];
        if (c.customBubbleCss === undefined) c.customBubbleCss = '';
        if (c.useCustomBubbleCss === undefined) c.useCustomBubbleCss = false;
        if (c.showTimestamp === undefined) c.showTimestamp = false;
        if (c.timestampPosition === undefined) c.timestampPosition = 'below_avatar';
        if (!c.statusPanel) {
            c.statusPanel = {
                enabled: false,
                promptSuffix: '',
                regexPattern: '',
                replacePattern: '',
                historyLimit: 3,
                currentStatusRaw: '',
                currentStatusHtml: '',
                history: []
            };
        }
        if (!c.autoReply) {
            c.autoReply = {
                enabled: false,
                interval: 60,
                lastTriggerTime: 0
            };
        }
        if (!c.gallery) c.gallery = [];
        if (c.useRealGallery === undefined) c.useRealGallery = false;
        if (!c.callHistory) c.callHistory = [];
    });
    db.groups.forEach(g => {
        if (g.isPinned === undefined) g.isPinned = false;
        if (!g.worldBookIds) g.worldBookIds = [];
        if (g.customBubbleCss === undefined) g.customBubbleCss = '';
        if (g.useCustomBubbleCss === undefined) g.useCustomBubbleCss = false;
        if (g.showTimestamp === undefined) g.showTimestamp = false;
        if (g.timestampPosition === undefined) g.timestampPosition = 'below_avatar';
        if (!g.callHistory) g.callHistory = [];
    });
    
    // Handle old localStorage data if it exists
    const oldLocalStorageData = localStorage.getItem('gemini-chat-app-db');
    if(oldLocalStorageData) {
        console.log("Found old localStorage data, migrating...");
        const data = JSON.parse(oldLocalStorageData);
        await dexieDB.transaction('rw', dexieDB.tables, async () => {
            if (data.characters) await dexieDB.characters.bulkPut(data.characters);
            if (data.groups) await dexieDB.groups.bulkPut(data.groups);
        });
        localStorage.removeItem('gemini-chat-app-db');
        await loadData();
    }
};

// 存储分析工具
const dataStorage = {
    getStorageInfo: async function() {
        const stringify = (obj) => {
            try {
                return JSON.stringify(obj).length;
            } catch (e) {
                console.warn("Could not stringify object for size calculation:", obj, e);
                return 0;
            }
        };

        let categorizedSizes = {
            messages: 0,
            charactersAndGroups: 0,
            worldAndForum: 0,
            personalization: 0,
            apiAndCore: 0,
            other: 0
        };

        if (!db || !db.characters) {
            await loadData();
        }

        // 1. Messages (History)
        (db.characters || []).forEach(char => {
            categorizedSizes.messages += stringify(char.history);
        });
        (db.groups || []).forEach(group => {
            categorizedSizes.messages += stringify(group.history);
        });

        // 2. Characters and Groups (metadata)
        (db.characters || []).forEach(char => {
            const charWithoutHistory = { ...char, history: undefined };
            categorizedSizes.charactersAndGroups += stringify(charWithoutHistory);
        });
        (db.groups || []).forEach(group => {
            const groupWithoutHistory = { ...group, history: undefined };
            categorizedSizes.charactersAndGroups += stringify(groupWithoutHistory);
        });

        // 3. World and Forum
        categorizedSizes.worldAndForum += stringify(db.worldBooks);

        // 4. Personalization
        categorizedSizes.personalization += stringify(db.myStickers);
        categorizedSizes.personalization += stringify(db.wallpaper);
        categorizedSizes.personalization += stringify(db.homeScreenMode);
        categorizedSizes.personalization += stringify(db.fontUrl);
        categorizedSizes.personalization += stringify(db.customIcons);
        categorizedSizes.personalization += stringify(db.bubbleCssPresets);
        categorizedSizes.personalization += stringify(db.myPersonaPresets);
        categorizedSizes.personalization += stringify(db.globalCss);
        categorizedSizes.personalization += stringify(db.globalCssPresets);
        categorizedSizes.personalization += stringify(db.homeSignature);
        categorizedSizes.personalization += stringify(db.insWidgetSettings);
        categorizedSizes.personalization += stringify(db.homeWidgetSettings);
        categorizedSizes.personalization += stringify(db.moreProfileCardBg);
        categorizedSizes.personalization += stringify(db.soundPresets);

        // 5. API and Core
        categorizedSizes.apiAndCore += stringify(db.apiSettings);
        categorizedSizes.apiAndCore += stringify(db.apiPresets);
        categorizedSizes.apiAndCore += stringify(db.cotSettings);
        categorizedSizes.apiAndCore += stringify(db.cotPresets);
        categorizedSizes.apiAndCore += stringify(db.workshopSettings);
        categorizedSizes.apiAndCore += stringify(db.workshopLlmPresets);

        // 6. Workshop Data (from Dexie directly as it might be large)
        try {
            const historyCount = await dexieDB.workshopHistory.count();
            // Rough estimation: assume each history item is ~500KB (base64 image + metadata)
            categorizedSizes.other += historyCount * 500 * 1024; 
            
            const vibeCount = await dexieDB.workshopVibeGroups.count();
            // Rough estimation: assume each vibe group is ~200KB
            categorizedSizes.other += vibeCount * 200 * 1024;
        } catch (e) {
            console.warn("Could not calculate workshop data size:", e);
        }

        const totalSize = Object.values(categorizedSizes).reduce((sum, size) => sum + size, 0);

        return {
            totalSize,
            categorizedSizes
        };
    }
};
