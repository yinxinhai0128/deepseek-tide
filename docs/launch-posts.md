# 发帖文案合集(发国外为主)

> 用法:复制对应平台的文案，按需微调。链接统一用 `/releases/latest`（自动指向最新版）。
> 仓库：https://github.com/yinxinhai0128/deepseek-tide
>
> ⚠️ 诚实原则（发国外最忌夸大，HN/Reddit 会被戳穿）：
> - 是个人免费项目，**包了开源 MIT 引擎 CodeWhale**（不是自研引擎）
> - **自带 key（BYOK）**：要你自己的 DeepSeek API key，按量付费但很便宜
> - 目前**仅 Windows**
> - 未做代码签名（首次打开有 SmartScreen 提示）
> - 别说"比 Claude 便宜 100 倍"这种硬数字，说"a fraction of the cost / a few cents per task"更稳

---

## 1) Hacker News — Show HN

**标题（二选一）：**
- `Show HN: DeepSeek-Tide – A zero-config desktop app to use DeepSeek as a coding agent`
- `Show HN: DeepSeek-Tide – Desktop GUI for a DeepSeek coding agent, no terminal needed`

**正文：**

```
Hi HN,

I built DeepSeek-Tide, a Windows desktop app that lets you use DeepSeek as a coding agent without touching a terminal. You point it at a folder, type what you want in plain language, and it reads/edits your files and verifies the result.

Why I made it: I liked the Codex / Claude Code workflow but wanted it (a) on DeepSeek, whose API is much cheaper — a typical task costs a few cents — and (b) usable by people who are scared of terminals, English jargon, or env setup. So it's deliberately zero-config.

A few things that are a bit different:
- Explain mode: after it changes files, it ends with a plain-language "📝 Summary" of what it changed and why, written for non-programmers.
- One-click Undo: it keeps a separate "shadow git" snapshot, so you can roll back its changes without ever touching your own .git.
- Spend you can read: shows an estimated cost (in ¥, since DeepSeek bills in CNY) instead of raw tokens.
- Bilingual UI (English / 中文), toggle anytime.

Honest disclaimers:
- It's a personal, free (MIT) project. The agent engine is the open-source MIT project CodeWhale; my part is the desktop layer (UI, credential bridging, undo, cost view, i18n).
- Bring your own DeepSeek API key (pay-as-you-go, cheap).
- Windows only for now. Not code-signed yet, so SmartScreen will warn on first run.

Repo + installer: https://github.com/yinxinhai0128/deepseek-tide

Feedback very welcome, especially on whether the "explain mode" actually makes it approachable for non-coders.
```

**发布时机**：美国时间周二~周四上午（US Eastern 8–10am 较好）。发完别狂刷，自然涨。

---

## 2) Reddit

**推荐板块**（先看各板规则，有的要求 flair / 限制自我推广）：
- r/SideProject（最友好，适合"我做了个东西"）
- r/DeepSeek、r/LocalLLaMA（DeepSeek 受众集中，但 LocalLLaMA 偏本地模型，发前确认是否接受 API 工具）
- r/coolgithubprojects、r/opensource

**标题：**
`I built a zero-config Windows desktop app to use DeepSeek as a coding agent (no terminal) — free & open source`

**正文：**

```
I wanted a Codex/Claude-Code-style coding agent but on DeepSeek (way cheaper — a few cents per task) and usable without a terminal, so I built DeepSeek-Tide.

You open a folder, type what you want in plain English, and it edits your code and shows every step. Highlights:
- Explain mode: ends with a plain-language "📝 Summary" of what changed and why (for non-coders)
- One-click Undo (separate shadow-git snapshot, never touches your own .git)
- Estimated cost shown instead of raw tokens
- Bilingual UI (EN / 中文)

It's free & MIT. Under the hood it wraps the open-source MIT engine CodeWhale; my part is the desktop layer. You bring your own DeepSeek API key (pay-as-you-go). Windows only for now, not code-signed yet (SmartScreen will warn).

GitHub (installer in Releases): https://github.com/yinxinhai0128/deepseek-tide

Would love feedback on the UX.
```

---

## 3) Product Hunt

**Name:** DeepSeek-Tide
**Tagline:** `Use DeepSeek as a coding agent — zero config, no terminal`
**Description:**

```
DeepSeek-Tide is a free, open-source Windows desktop app that turns DeepSeek into a hands-on coding agent — no terminal, no setup. Describe a task in plain language and it reads and edits your code, explains what it changed in plain words (📝 Summary), lets you undo with one click, and shows your spend in real time. Bilingual UI (English / 中文). Bring your own DeepSeek API key (pay-as-you-go, very cheap). Wraps the open-source MIT engine CodeWhale.
```

**Topics:** Developer Tools, Artificial Intelligence, Open Source
**First comment（maker comment）:** 用 Show HN 正文的简版，加一句"happy to answer questions".

---

## 4) X / Twitter（配 demo GIF）

```
I built DeepSeek-Tide 🐳 — a zero-config Windows desktop app to use DeepSeek as a coding agent. No terminal.

• Plain-language "📝 Summary" of every change
• One-click undo
• See your spend live
• EN / 中文

Free & open source (MIT). BYO DeepSeek key.
👉 github.com/yinxinhai0128/deepseek-tide
```
（附 docs/demo-en.gif）

---

## 发帖前检查清单
- [ ] 英文 README 顶部 demo-en.gif 正常显示
- [ ] Releases 里有最新安装包，下载链接可点
- [ ] 各板块规则看一遍（self-promo / flair 要求）
- [ ] 准备好回复评论（前几小时的互动对排名最重要）
- [ ] 不夸大：只说 a few cents、wraps CodeWhale、Windows-only、BYOK
