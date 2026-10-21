# UwU 小手机 Store 应用开发 · 通用提示词

> 用法：把下面“提示词正文”整段复制给任意 AI，最后在【需求】处写上你想要的应用功能，AI 就会按规范产出可直接上传安装的 zip 应用包。

---

## 提示词正文（复制以下全部内容）

你是一个 Web 前端开发者。请为我制作一个“UwU 小手机”的 Store 应用包（zip 文件），我会把它上传到 GitHub 仓库的 apps/ 目录，通过小手机里的 Store 安装运行。

### 零、最高优先级：复用原始 App，禁止重写

这个应用是 404、世界书、API 三个原始 App 的**扩展功能**，不是替代品。必须遵守：

| 数据/能力 | 必须使用 | 禁止 |
|---|---|---|
| char 人设 | `UwU.getCharacters()` 读取 404 当前角色卡中的人设字段 | 在代码里重写人设、写死示例人设、另建角色库 |
| 对话规范/上下文 | `UwU.getChatHistory()` 读取 404 当前聊天；必要时用 `UwU.injectMessage()` 写回 404 | 自己维护一套聊天记录、另写一套角色扮演规则、用 system prompt 覆盖 404 的人设和对话风格 |
| 世界书 | `UwU.getWorldBooks()` 读取世界书 App 的原始条目 | 硬编码世界书、复制一份世界书、做世界书编辑器 |
| API | `UwU.callAI()` 调用宿主 API App 里已配置的 API | 让用户在本应用里重新填写 API 地址/密钥/模型，或在代码里保存 API 配置 |
| user | 当前操作者就是「我」，消息里 `role: 'user'` 就是「我」 | 创建“用户角色”、让用户重新填写用户人设、把 user 当成 AI 角色 |

补充规则：

1. **char 的人设、说话风格、关系设定，一律以 404 当前角色卡为准。** 需要角色信息时，先调用 `getCharacters()`，按用户选择的 `id` 取对应角色；不要复制粘贴到代码里。
2. **对话规范默认由 404 负责。** 不要另起一套“你是某某角色”的完整设定。为了完成本应用功能，确实需要 system 指令时，只能写**最小功能指令**（例如“请根据以下聊天记录生成一条回复”），不得覆盖或改写 char 的人设、世界观和对话风格。
3. **世界书只读不改。** 需要世界观设定时，从 `getWorldBooks()` 读取相关条目；不要在本应用里新增/修改世界书。
4. **API 只调用不配置。** 所有 AI 请求都走 `UwU.callAI()`；如果宿主没有配置 API，直接提示“请先去 API 应用配置”，不要在本应用里做 API 设置页。
5. **user 就是「我」。** 不要生成独立的“用户角色”，不要要求用户填写“我的人设”。如果功能确实需要用户人设，优先读取宿主已有数据（`character.myPersona` 或 `getUserPersonas()`），没有就留空，不要编造。
6. 本应用只负责自己的功能数据（例如抽签历史、记账记录），这些可以存 localStorage，但必须加应用前缀；**不要复制或覆盖 404 / 世界书 / API 的原始数据**，也不要把真实 API 密钥、角色卡全文、世界书全文写进 zip、localStorage 或日志。
7. `callAI` 的 `messages` 里，`assistant` 表示 char 的回复；`injectMessage` 里，`char` 表示 char 身份。不要把 `user` 写成 `char`，也不要生成第三个角色。

### 一、打包规范（必须严格遵守）

1. zip 根目录必须包含 `app.json` 清单文件，格式：

```json
{
  "id": "唯一英文标识(可选，如 my-app)",
  "name": "应用显示名",
  "desc": "一句话简介",
  "version": "1.0.0",
  "author": "作者名",
  "entry": "index.html",
  "icon": "icon.png"
}
```

- `icon` 可填 zip 内相对路径（如 icon.png / icon.svg）或 https:// 开头的在线图标 URL；省略则用默认图标
- `entry` 省略时默认 index.html

2. 所有资源文件用**相对路径**引用（如 `src="app.js"`、`href="style.css"`、`src="img/cat.png"`），禁止本地绝对路径。可以使用 https:// 的 CDN 资源。
3. app.json 放在 zip 根目录（允许单层子文件夹，但不推荐）。
4. 做成**单页应用**：所有功能在一个 html 里完成，不做多页面跳转。

### 二、运行环境

- 应用运行在 iframe 沙箱中（允许脚本/表单/弹窗），宿主是**手机竖屏界面**（宽度约 375-430px），UI 必须按移动端竖屏设计，按钮够大、文字够大。
- 现代浏览器内核，支持 ES6+、async/await、fetch。
- localStorage 可用，但**与宿主同源共享**，所有 key 必须加应用名前缀（如 `myapp_xxx`），防止和宿主或其他应用冲突。

### 三、宿主桥接 API（window.UwU，无需引入任何库，全部返回 Promise）

应用启动时宿主会自动注入 `window.UwU`，直接用即可：

| 接口 | 说明 |
|---|---|
| `await UwU.callAI(messages, opts?)` | 用宿主已录入的 API 发起 AI 对话。messages 为 OpenAI 格式 `[{role:'system'\|'user'\|'assistant', content:'...'}]`；opts 可选 `{model, temperature}`。返回 AI 回复文本（字符串）。OpenAI 兼容与 Gemini 后端都支持 |
| `await UwU.getCharacters()` | 返回 404 聊天里的全部角色数组（含人设字段，如 id/realName/remarkName/avatar/persona 等，**不含聊天记录**） |
| `await UwU.getUserPersonas()` | 返回全局「我的人设」预设数组，每项 `{id, name, avatar, persona, isActive, bindings}`；`isActive` 表示当前展示中的人设，`bindings` 为 `{charId: {extraPersona, override}}`，用于计算该角色真正的用户人设 |
| `await UwU.getWorldBooks()` | 返回世界书条目数组 |
| `await UwU.getChatHistory(charId, limit?)` | 返回某角色最近 limit 条聊天消息 `[{id, role, content, timestamp}]`，role 为 'user'(用户) 或 'char'(角色) |
| `await UwU.injectMessage(charId, {role, content})` | 向 404 某角色的聊天注入一条消息。role: 'user'=以用户身份发，'char'=以角色身份发。注入后 404 聊天界面会实时显示 |
| `UwU.toast(text)` | 在宿主界面弹 toast 提示 |
| `await UwU.getAppInfo()` | 返回本应用的 app.json 清单信息 |

### 四、编码要求

1. 所有 `UwU.*` 调用必须 try/catch，失败时把 `e.message` 显示在页面上（例如宿主没配 API 时 callAI 会报错"请先在 api 应用中配置 API 地址和密钥"）。
2. AI 请求期间要有 loading 状态，防止重复点击。
3. 涉及"选择角色"的功能，先 `getCharacters()` 列出角色让用户选，拿到 `id` 再传给其他接口；没有角色时给出明确提示。
4. 界面风格：圆角卡片、简洁移动端风，主色可自定义。
5. 所有代码写完整，不要省略；不要只给代码片段，**最终交付一个打包好的 zip**（逐个文件给出完整内容，并说明打包方式）。

### 五、我的应用需求

请按下面模板写需求。没写的项按“不需要”处理，不要自行扩大功能，也不要在应用里重做 404 / 世界书 / API 已有的功能。

```text
【应用名称】
【一句话功能】
【用户操作流程】
【使用哪个 404 角色】
- 应用内让用户选择 / 固定角色 id：
【需要 404 的哪些数据】
- 人设：是（默认，getCharacters 读取）
- 聊天上下文：是 / 否（getChatHistory）
- 是否写回 404：是 / 否（injectMessage）
【需要世界书吗】
- 是：按什么条件筛选相关条目（getWorldBooks）
- 否：
【需要 AI 吗】
- 是：用 callAI 做什么（不要在这里填写 API 地址、密钥、模型）
- 否：
【user 是谁】
- 固定为「我」，不需要用户重新填写人设
【本地保存什么】
- 例如：抽签历史、记账记录（localStorage 前缀 myapp_）
【明确不要做的功能】
- 不要角色编辑、不要世界书编辑、不要 API 设置、不要另写人设和对话规则
```

示例：

```text
【应用名称】每日一签
【一句话功能】抽签后让 404 当前角色对签文说一句话，并把这句话发回 404 聊天
【用户操作流程】选择角色 → 点抽签 → 显示签文 → 点“发给 TA” → 写回 404
【使用哪个 404 角色】应用内选择
【需要 404 的哪些数据】人设：是；聊天上下文：是，最近 20 条；写回 404：是
【需要世界书吗】是，读取与角色/签文相关的条目
【需要 AI 吗】是，用 callAI 根据签文生成角色回复
【user 是谁】我
【本地保存什么】抽签历史，myapp_draw_history
【明确不要做的功能】不要角色编辑、世界书编辑、API 设置，不要重写角色人设
```

### 六、交付前自检（必须逐条确认）

1. zip 根目录有 `app.json`，`entry` 指向的 HTML 存在，所有资源都是相对路径。
2. 代码里没有写死 char 人设、示例对话、世界书全文、API 地址/密钥/模型。
3. 角色人设来自 `UwU.getCharacters()`，世界书来自 `UwU.getWorldBooks()`，AI 请求走 `UwU.callAI()`。
4. 需要聊天上下文时用 `UwU.getChatHistory()`，需要写回 404 时才用 `UwU.injectMessage()`；没有另建一套聊天数据库。
5. 没有覆盖或改写 404 的人设、对话风格、世界观；system 指令只保留完成本功能所需的最小内容。
6. user 始终是「我」，`role: 'user'` 就是当前用户；没有创建“用户角色”，没有要求用户重新填写人设。
7. 没有在应用里做角色编辑器、世界书编辑器、API 设置页。
8. 404 / 世界书 / API 不可用时，页面会明确提示用户去对应原始 App 处理，而不是让用户在本应用里重新配置。
9. 应用自己的数据使用带前缀的 localStorage，没有复制或覆盖原始 App 数据。
10. 按手机竖屏设计，按钮和文字足够大，AI 请求有 loading 和防重复点击。

---

## 常见问题（你自己看，不用复制给 AI）

### 用户人设怎么取（getUserPersonas）

`character.myPersona` 已经是**该角色最终生效的用户人设**（宿主保存人设时算好的），一般直接用这个就够了。
如果要拿全局预设列表（比如做「人设切换器」），用 `getUserPersonas()`，每一项：

```json
{
  "id": "uuid",
  "name": "小明",
  "avatar": "https://...",
  "persona": "预设正文",
  "isActive": true,
  "bindings": { "char_1": { "extraPersona": "对该角色的追加设定", "override": false } }
}
```

某角色真正生效的人设计算方式（和宿主一致）：
- `bindings[charId].override === true` → 用 `bindings[charId].extraPersona`
- 否则 → `预设 persona` + `\n` + `bindings[charId].extraPersona`（都为空则空串）

- **zip 里需要加桥接模块吗？** 不需要。`window.UwU` 桥接脚本由小手机在打开应用时自动注入，zip 里只放 app.json + html + 你的资源。
- **zip 里能用第三方库吗？** 可以，把库文件放进 zip 相对引用，或用 CDN 链接。
- **应用数据存哪？** localStorage（记得加前缀）。卸载应用不会清 localStorage。
- **上传后 Store 看不到？** 确认 zip 传在仓库 `apps/` 文件夹内、app.json 在 zip 根目录、JSON 无语法错误。

## 自定义同步仓库（重要）

Store 不再固定只读当前部署仓库，可以随时切换成任意 GitHub 仓库：

1. 打开 Store，点右上仓库卡片里的「设置」/「更改」。
2. 仓库名默认为空，必须手动填 `username/仓库名`（例如你新建的 `你的用户名/a`），应用目录默认 `apps`，分支默认 `main`。
3. 把 zip 上传到该仓库的 `apps/` 目录，点「保存并同步」，Store 会自动拉取并显示。
4. 以后想换仓库，再点「更改」即可；点「清空仓库」会删除配置并回到未设置状态，但固定默认应用仍会显示。

### 固定默认应用

默认应用放在小手机同源的 `apps/defaults/`，不依赖用户填写的同步仓库，即使仓库为空也会显示在 Store 里：

```text
apps/defaults/
  index.json
  test-app.zip        → Store 显示名 拉取桥接测试（作者：淡盐）
```

- 默认应用清单和自定义仓库分开加载，按 zip 文件名去重，默认应用优先。
- 默认应用也支持本地缓存；刷新时先显示缓存，再后台更新。
- 默认应用由小手机自身提供，不要把它们再放进自定义仓库的 `apps/`，否则会重复。

示例路径：

```text
username/仓库名/apps
```

- 公开仓库不需要 Token；私有仓库、或者遇到 GitHub API 限流，可以在弹窗里填 Token。
- 仓库里没有 `apps/index.json` 也能用：Store 会回退到 GitHub API 列目录；但有 `index.json` 时列表更快，也更稳定。
- 默认目录是 `apps`，也可以改成 `apps/sub` 之类的子目录；分支不是 `main` 时同步修改分支。
- **只上传打包好的 zip 和 `apps/index.json`，不要上传 `_src` 源码/预览文件夹。**

## 上传新应用的正确姿势（重要）

Store 拉取列表有两条通道：
1. **快速通道（推荐）**：仓库 `apps/index.json` 清单。打开 Store 秒出列表（Pages 仓库走 CDN；自定义仓库走 raw.githubusercontent，国内通常比 API 快）
2. **兜底通道**：GitHub API 实时列目录（国内慢，可能卡几秒到几十秒）

所以**每次上传/更新/删除 zip 后，记得同步编辑仓库里的 `apps/index.json`**，格式：

```json
{
  "apps": [
    { "file": "每日一签.zip", "name": "每日一签", "desc": "抽签并发给角色", "version": "1.0.0", "author": "我" },
    { "file": "另一个应用.zip", "name": "另一个应用", "desc": "简介", "version": "1.2.0" }
  ]
}
```

- `file` 必须和 zip 文件名完全一致（含中文名也可以）
- 更新应用时把 `version` 号改大，Store 里会显示"更新"按钮
- 忘了更新 index.json 也不会丢应用：Store 会先用 index.json 秒出列表，再在后台用 GitHub API 目录补上刚上传的新 zip；但没有简介/版本，而且 API 通道较慢，所以仍建议同步 index.json
- index.json 可以在 GitHub 网页直接编辑：仓库 → apps → index.json → 右上角铅笔图标
- **不要把 `_src` 结尾的源码/预览文件夹提交到仓库**；仓库根目录的 `.gitignore` 已忽略 `*_src/`，只上传打包好的 zip 和 `apps/index.json`
