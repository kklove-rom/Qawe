# 项目速查文档（UwU 章鱼喷墨机 / QA机 4.1.0）

> 目的：下次改功能前先读这一份，不用再全仓库摸索。
> 维护约定：新增功能后，把「文件 → 职责 → 关键函数」补进第 4、5 节，并在第 9 节记下踩过的坑。

---

## 1. 这是什么

纯前端、移动端优先的「角色扮演聊天模拟器」（单页应用）：

- 角色 / 群聊、AI 回复（两套提示词）、语音/视频通话、朋友圈、偷看手机、世界书、记忆日记、商城、小组件、Store 扩展应用等。
- **没有构建步骤**：直接改 `index.html` / `js` / `css`，静态托管即可。
- 数据全部存在浏览器 **IndexedDB（Dexie）** 里，没有后端。
- 入口：`index.html`；部署在 GitHub Pages。

线上地址：<https://kklove-rom.github.io/Qawe/>
仓库：`kklove-rom/Qawe`（分支 `main`）

---

## 2. 本地运行与验证

```powershell
# 在项目根目录
python -m http.server 8765 --bind 127.0.0.1
```

- 主应用：<http://127.0.0.1:8765/index.html>
- X 小应用预览（带 mock 宿主桥）：<http://127.0.0.1:8765/_x_app_src/_preview.html>
- 必须走 http，`file://` 下 IndexedDB 不可用。
- 验证方式：浏览器控制台无报错 + 实际操作一遍（见第 8 节）。
- 环境：**没有 node / git**；有 Python 3.10、PowerShell。

---

## 3. 目录结构

```
index.html                 # 唯一入口：所有 screen 的 HTML + CSS/JS 引用（约 2800 行）
manifest.json / sw.js      # PWA 清单 / 空 Service Worker
js/
  db.js                    # 数据层：Dexie、全局 db 对象、默认值、appVersion、updateLog
  utils.js                 # 通用工具：API 调用、图片压缩、Toast、错误提示
  ui.js                    # 屏幕切换、主屏图标与布局、编辑模式、主题
  main.js                  # 启动入口：init() 里依次 setupXxx()
  chat.js / contacts.js / group_chat.js
  workshop.js / workshop_html.js
  settings.js              # ❗已废弃，index.html 没有引用，别改
  modules/                 # 各功能模块（见第 5 节）
css/
  base.css / layout.css / chat.css / settings.css / workshop.css
  modules/*.css            # 各模块样式
apps/
  index.json               # Store 应用清单（版本 / 大小 / sha）
  x-social.zip             # X 小应用安装包（产物，别手改）
_x_app_src/                # X 小应用源码（被 .gitignore 忽略，不部署）
  app.json / index.html / app.js / style.css / icon.svg
  _preview.html            # 本地预览用，含 mock 桥
store应用开发提示词.md      # 小应用（Store App）开发规范
```

`.gitignore` 里忽略了 `*_src/` 和 `_preview.html`，所以 `_x_app_src` 只存在于本地。

---

## 4. 数据层（js/db.js）

- Dexie 库名：`章鱼喷墨机DB_ee`，当前 schema 版本 8。
- 表：`characters`、`groups`、`worldBooks`、`myStickers`、`globalSettings`、`workshopHistory`、`workshopVibeGroups`、`characterPhotos`、`customFonts`、`reader_books`、`reader_chapters`、`reader_comments`。
- 全局对象 `db`：启动时由 `loadData()` 把表和全局设置读进内存；写操作改完 `db` 后调用 **`saveData()`** 落库。
- 习惯写法：

```js
db.presets = [...];
await saveData();
```

### 新增一个「全局设置」字段的完整步骤

1. 在 `db.js` 的 `db` 默认对象里加默认值（注意：`homeLayoutOrder` 这类默认值在 **初始化** 和 **loadData 兼容段** 各有一份，两处都要改）。
2. 把 key 加进 `globalSettingKeys`（`db.js` 约 160 行）。
3. 用 `db.xxx` 读写，改完 `saveData()`。
4. 如果界面需要，`render...()` 里重新渲染。

不加入 `globalSettingKeys` 的字段不会被持久化（这是最常见的“改了刷新就丢”原因）。

### 版本与更新日志

- `appVersion` 和 `updateLog` 在 `db.js` 约 173 行。
- ❗ `updateLog` 的内容由用户维护，**不要擅自改文案/格式**，除非明确要求。

---

## 5. UI 与主屏（js/ui.js + index.html）

- 屏幕模型：`index.html` 里每个 `<div id="xxx-screen" class="screen">`，同一时间只有一个带 `.active`。
- 切换：`switchScreen('xxx-screen')`（`js/ui.js` 约 61 行）。
- 主屏：`setupHomeScreen()`（`ui.js` 约 469 行）。
  - 图标集合 `allItems`（约 482 行），每个图标是 `app-*` id + `data-target="xxx-screen"`。
  - 图标图源：`db.customIcons[screenId] || defaultIcons[screenId]`，`defaultIcons` 在 `db.js`。
  - 布局：`db.homeLayoutPages`（二维数组）/ `db.homeLayoutOrder`（扁平数组），可拖动排序。
  - 历史 id 迁移在 `ui.js` 约 556 行（例如旧 `app-wallpaper` → `app-presets`）。**删除/替换主屏图标时记得加迁移，否则老用户布局里会留空洞。**
- 所有按钮统一用事件委托：`data-target` 切屏，`data-act` / id 绑定具体逻辑。

---

## 6. AI 调用链（最重要）

```
用户发消息 → getAiReply()            (js/modules/chat_ai.js)
           → generatePrivateSystemPrompt(character)  (js/modules/chat_ai_prompt.js)
           → resolveAuxiliaryApiConfig(...)          (js/utils.js)
           → buildChatApiRequest(...) / fetchAiResponse(...)
```

- 配置来源：`db.apiSettings`（API 设置页 `settings_api.js`）。
- 通用工具（`js/utils.js`）：
  - `resolveAuxiliaryApiConfig(featureKey, fallbackConfig)`：按功能取 API（不同功能可单独配置）。
  - `buildChatApiRequest(apiConfig, messages, options)`：返回 `{ requestBody, endpoint, headers }`。
  - `fetchAiResponse(apiConfig, requestBody, headers, endpoint)`：发请求并返回文本。
  - `showApiError(error)`：统一报错提示。
- 两套提示词：`promptVersion` 为 `'tt'` / `'uwu'`，在思维链设置里切换；两套都在 `chat_ai_prompt.js` / `chat_ai_call.js` 里分别拼装，**改提示词时两套都要看**。
- 通话：`getCallReply(chat, callType, callContext, onStreamUpdate)`（`chat_ai_call.js`）。
- 流式输出处理：`processStream()` / `handleAiReplyContent()`（`chat_ai.js`）。
- 历史过滤：`filterHistoryForAI(chat, history)`；被禁用上下文的楼层带 `isContextDisabled`。

### 世界书注入位置

`worldBooks[].position` 四种：`limit_break`（破限）、`before`（角色设定之前）、`after`（角色设定之后）、`guidelines`（规则/准则）。
每个角色用 `character.worldBookIds` 关联，按 `depth` 排序后拼接。

### 预设（SillyTavern）注入

- `js/modules/presets.js` 的 `buildPresetPromptSection(scope, character)` 返回：
  `{ beforeSettings, afterSettings, beforeReply, hasContent }`。
- `scope`：`'chat'` / `'call'` / `'peek'`；`applyTo.offline` 当前等价于聊天（项目里没有独立“线下模式”实现）。
- 注入点：`chat_ai_prompt.js`、`chat_ai_call.js`、`peek.js`（偷看/朋友圈）。

---

## 7. 功能地图（按用户可见功能找代码）

| 功能 | 文件 | 关键函数 / 位置 |
|---|---|---|
| 主屏图标 / 布局 / 编辑模式 | `js/ui.js` | `setupHomeScreen`、`allItems`、`homeLayoutPages` |
| 聊天列表 / 角色卡 | `js/modules/chat_list.js`、`contacts.js` | — |
| 聊天室渲染 / 消息操作 | `js/modules/chat_render.js`、`chat_ops.js`、`chat_features.js` | — |
| AI 回复 | `js/modules/chat_ai.js`、`chat_ai_prompt.js` | `getAiReply`、`generatePrivateSystemPrompt` |
| 通话（语音/视频） | `js/modules/chat_ai_call.js`、`video_call.js` | `getCallReply` |
| 世界书 | `js/modules/worldbook.js` | `setupWorldBookApp`、`parseWorldBookDocument`、`importWorldBookDocument` |
| 预设 App（SillyTavern） | `js/modules/presets.js` + `css/modules/presets.css` | `setupPresetsApp`、`normalizePreset`、`buildPresetPromptSection` |
| 提示词预设（气泡/人设/字体/CSS） | `js/modules/settings_presets.js` | ⚠️ 和「预设 App」不是一个东西 |
| 朋友圈 / 偷看手机 | `js/modules/peek.js` | `setupMomentsFeature`、`renderMomentsScreen`、`generateMomentsPosts`、`generatePeekContentPrompt` |
| 自定义（字体/壁纸/全局 CSS） | `js/modules/settings_customize.js` | `setupCustomizeApp`、`renderCustomizeForm` |
| 记忆日记 | `js/modules/journal.js` | `setupMemoryJournalScreen` |
| 商城 / 背包 | `js/modules/shop.js`、`shop_html.js` | — |
| 小组件 | `js/modules/widgets.js`、`widget_market.js` | — |
| Store 应用商店 | `js/modules/app_store.js` | `setupAppStore`、`installFromZipBuffer`、`window.UwU` 桥 |
| X 小应用 | `_x_app_src/*`（源码）+ `apps/x-social.zip`（产物） | 见第 10 节 |
| 更新日志 / 教程页 | `js/modules/tutorial.js` + `db.js:updateLog` | — |

### 聊天页「朋友圈」入口

聊天页右上角按钮 → `#peek-actionsheet`（两个选项：偷看手机 / 朋友圈）。
点「朋友圈」→ `renderMomentsScreen()` + `switchScreen('moments-screen')`；若该角色 `moments` 为空会自动调用 `generateMomentsPosts()`。
刷新按钮 = 重新调用 API 生成，不再只是重渲染。

### 偷看手机

`#peek-actionsheet` → `peek-screen`，子应用：messages / memos / cart / transfer / browser / drafts / album / steps / unlock / bag。
生成入口 `generatePeekContentPrompt(char, appType, mainChatContext)`，批量版 `generateBatchPeekContentPrompt`。

---

## 8. 改动流程（推荐）

1. **先读本文档 + 目标文件顶部注释**，用 `grep` 找函数名，不要通读大文件。
2. 改代码（保持现有写法：全局函数、事件委托、`showToast`、`saveData`）。
3. 如果改了被浏览器缓存的 `js/css`，在 `index.html` 里把对应的 `?v=YYYYMMDDx` 版本号 +1。
4. 本地起 `python -m http.server 8765`，浏览器验证：
   - 控制台无 error；
   - 新功能实际操作一遍；
   - 刷新一次确认持久化（IndexedDB）。
5. X 应用改动：改 `_x_app_src` → 重新打包 zip → 更新 `apps/index.json`（见第 10 节）。
6. 部署（见第 11 节）。

### 常见坑

- **改了不生效**：先看 `index.html` 的 `?v=` 是否更新；再看文件是否真的被引用（`js/settings.js` 就是没被引用的死代码）。
- **刷新后数据丢失**：新字段没加进 `globalSettingKeys`，或没调 `saveData()`。
- **主屏图标错位/空洞**：`homeLayoutPages` 里残留旧 id，需要迁移逻辑。
- **`css/modules/moments.css` 是 UTF-16LE**：普通文本编辑容易把文件写坏；能不改就不改，必须改时用能指定编码的方式读写。
- **行号会漂移**：文档只给函数名，定位用 `grep -n "function xxx"`。

---

## 9. Store 与小应用机制

- 清单：`apps/index.json`，字段：`file`、`name`、`desc`、`version`、`author`、`size`、`sha`（sha 是 zip 的 SHA-256）。
- 安装：Store 下载 zip → `JSZip` 解压 → 读 `app.json` → 存进 `db.installedStoreApps` → 用 iframe 运行。
- 应用 id 规则：`sa_` + `app.json.id`，例如 `sa_x-social`。
- 小应用通过 `window.UwU` 与宿主通信（`app_store.js` 约 869 行）：

```js
UwU.callAI(messages, opts)
UwU.getCharacters()
UwU.getUserPersonas()
UwU.getWorldBooks()
UwU.getPresets()               // 主屏预设（SillyTavern，chat scope）
UwU.getChatHistory(charId, limit)
UwU.injectMessage(charId, msg)   // role: 'user' | 'char'
UwU.toast(text)
UwU.getAppInfo()
```

- 开发规范详见根目录 `store应用开发提示词.md`。
- Store 列表有 CDN / 本地缓存，刷新逻辑用 `cache: 'no-store'`。

---

## 10. X 小应用（_x_app_src + zip）

### 代码结构

- `app.js`：单文件 IIFE，无框架。
  - `state`（持久化到 localStorage `xapp_state_v1`）、`host`（角色/世界书/人设/预设缓存）。
  - `render()` 按 `ui.view` 分发：home / thread / profile / dm / notifs / messages / settings / chars / avatars。
  - 事件委托：所有按钮用 `data-act`，在 `document` 的 click 里 switch。
  - 图标：`var I = { home, bell, mail, user, ... }`（`app.js` 约 72 行）。
  - 底栏：`function botnav()`，四项 = 首页 / 通知 / 私信 / 我的。
    - 首页：原版内联 SVG `I.home`（24×24，`navBtn('home', I.home, 0)`）。
    - 通知：内联 SVG `I.bell`，带未读数角标。
    - 私信：FontAwesome `regular/envelope.svg`，用 CSS mask 渲染（`class="nav-icon-envelope"`），24×24、跟随底栏配色。
    - 我的：原版内联 SVG `I.user`（24×24，`navBtn('profile', I.user, 0)`）。
  - 首页顶栏（1.1.0 起）：左侧返回箭头（单击退出 X）→ 中间 X logo → 右侧刷新 → 设置齿轮（`SETTINGS_ICON`，24×24，Feather settings.svg）。
  - 1.1.0 起不再有侧边抽屉和内置「默认分身」：每个 char 只有 404 同步来的大号 + 用户手动创建的小号（`MAX_ALT = 2`）。
  - 设置页不再提供「默认世界书」「NPC 档案」入口；角色生成统一使用：404 的 char 人设 + 主屏世界书（按 `worldBookIds` 绑定）+ 主屏预设（`UwU.getPresets()`）+ 主屏 API（`UwU.callAI`）。
  - **旧版代码保留在注释里**：`botnav()` 上方按项列出了上一版写法（首页 / 我的的 FontAwesome 图片写法），
    旧的 `I.home` / `I.user` 内联 SVG 也仍保留在 `I` 图标表里，回退时直接换回即可。
  - 图标变更记录：1.0.1 之前私信用 `I.mail`；1.0.1 用 `IMG_DM` 图片；1.0.3 起改 FontAwesome 信封；1.0.4 首页/我的曾改 FontAwesome 图片；1.0.5 首页恢复；1.0.6 我的恢复；1.1.0 通知移入底栏、设置入口移到刷新右侧（当前状态：首页 / 通知 / 我的为内联 SVG，私信为 FontAwesome 信封，均 24×24）。
- `style.css`：纯 CSS，主题变量在 `:root[data-theme]`。
- `app.json`：清单（id/name/version/entry/icon）。
- `_preview.html`：本地预览，注入 `window.__mockBridge` 假宿主。

### 打包 / 发版（必须按顺序）

1. 改 `_x_app_src` 里的源码。
2. 同步升版本号，三处：
   - `_x_app_src/app.json` 的 `version`
   - `_x_app_src/app.js` 顶部的 `var VERSION`
   - `apps/index.json` 的 `version`
3. 重新打包（zip **根目录** 只放这 5 个文件，不要带 `_preview.html`、不要多一层文件夹）：

```powershell
$src   = "...\_x_app_src"
$stage = "$env:TEMP\xzip"
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory $stage | Out-Null
Copy-Item "$src\app.json","$src\index.html","$src\app.js","$src\style.css","$src\icon.svg" $stage
Compress-Archive -Path "$stage\*" -DestinationPath "...\apps\x-social.zip" -Force
```

4. 更新 `apps/index.json` 的 `size` 和 `sha`：

```powershell
(Get-Item "...\apps\x-social.zip").Length
(Get-FileHash "...\apps\x-social.zip" -Algorithm SHA256).Hash.ToLower()
```

5. 发布 `apps/x-social.zip` + `apps/index.json`。
6. 验证：`https://raw.githubusercontent.com/kklove-rom/Qawe/main/apps/index.json` 里的版本 / size / sha 是否为新值（Pages 有 CDN 延迟，raw 是准的）。

> ❗ 只上传 zip 而不更新清单，用户会看到旧版本或更新提示异常；清单不校验 zip 完整性，但版本判断依赖它。

---

## 11. 部署（无 git，用 GitHub API）

仓库：`kklove-rom/Qawe`，分支 `main`，Pages 自动发布。
Token **不要写进仓库或提交信息**，用环境变量传入（例如 `$env:GH_TOKEN`）。

上传流程（Git Data API，支持二进制）：

1. `GET /repos/{repo}/git/ref/heads/main` 取当前 commit。
2. `GET /repos/{repo}/git/commits/{sha}` 取 `base_tree`。
3. 每个文件 `POST /git/blobs`（`encoding: "base64"`）。
4. `POST /git/trees`（带 `base_tree`）。
5. `POST /git/commits`（`parents: [head]`）。
6. `PATCH /git/refs/heads/main`（`sha`，`force: false`）。

要点：

- 只上传改动过的文件；先用 git blob SHA（`sha1("blob " + 长度 + "\0" + 内容)`）和远端 tree 对比，避免覆盖无关文件。
- 二进制（zip）必须用 base64 blob，不要用 contents API 的文本方式。
- 发布后检查 `https://raw.githubusercontent.com/kklove-rom/Qawe/main/<file>`。
- GitHub Pages 的 HTML/JSON 有几分钟 CDN 缓存，属正常现象。
- 不要把 `_x_app_src/`、`_preview.html` 上传（已被 .gitignore 忽略）。

---

## 12. 下次开工建议

- 用户说“改某功能”时，先在本文件第 7 节找到对应文件，`grep -n "function 关键词"` 定位，再读该函数前后 50 行。
- 涉及提示词时，确认 `tt` / `uwu` 两套是否都要改。
- 涉及新 App 图标时，同时检查：`allItems`、`defaultIcons`、`homeLayoutOrder` 默认值（两处）、旧 id 迁移。
- 涉及 Store 应用时，永远记得“源码在 `_x_app_src`，发布的是 zip”。
- 每次发布后，把新增的坑补到第 8 节。
