# UwU 小手机 store 应用开发 · 通用提示词

> 用法：把下面"提示词正文"整段复制给任意 AI，最后在【需求】处写上你想要的应用功能，AI 就会按规范产出可直接上传安装的 zip 应用包。

---

## 提示词正文（复制以下全部内容）

你是一个 Web 前端开发者。请为我制作一个"UwU 小手机"的 store 应用包（zip 文件），我会把它上传到 GitHub 仓库的 apps/ 目录，通过小手机里的 store 安装运行。

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

【在这里写你想要的应用。示例：做一个"每日一签"应用：点按钮抽签，把签文用 callAI 润色后，通过 injectMessage 以角色身份发给 404 里我选定的角色，并在应用里保存历史签文（localStorage 带前缀）】

---

## 常见问题（你自己看，不用复制给 AI）

- **zip 里需要加桥接模块吗？** 不需要。`window.UwU` 桥接脚本由小手机在打开应用时自动注入，zip 里只放 app.json + html + 你的资源。
- **zip 里能用第三方库吗？** 可以，把库文件放进 zip 相对引用，或用 CDN 链接。
- **应用数据存哪？** localStorage（记得加前缀）。卸载应用不会清 localStorage。
- **上传后 store 看不到？** 确认 zip 传在仓库 `apps/` 文件夹内、app.json 在 zip 根目录、JSON 无语法错误。

## 上传新应用的正确姿势（重要）

store 拉取列表有两条通道：
1. **快速通道（推荐）**：仓库 `apps/index.json` 清单。打开 store 秒出列表（走 Pages CDN，国内快）
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
- 更新应用时把 `version` 号改大，store 里会显示"更新"按钮
- 忘了更新 index.json 也没关系：store 会自动回退到 GitHub API 通道，只是慢
- index.json 可以在 GitHub 网页直接编辑：仓库 → apps → index.json → 右上角铅笔图标
