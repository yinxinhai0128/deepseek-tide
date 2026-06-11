# DeepSeek-Tide 产品路线图

> **这是进度的单一事实来源。** 每次开工先看下面「当前进度」,做完一项就在这里勾掉并更新,避免"做着做着乱了、忘了做到哪"。

## 📍 当前进度(2026-06-10)
- ✅ 项目已上线 GitHub:**https://github.com/yinxinhai0128/deepseek-tide**(公开,账号 yinxinhai0128,分支 main)
- ✅ 所有 P1-P4 改动已提交(项目管理、撤销、看钱、蓝主题、新图标、开通向导、卡死/取消/刷新等修复)
- ✅ **首个 Release 已发布:v0.3.0** → https://github.com/yinxinhai0128/deepseek-tide/releases/tag/v0.3.0
- ✅ **v0.3.1 修两个用户反馈 bug**(2026-06-10):
  - 项目删不掉:迁移逻辑用当前工作区把刚删的项目补回。改为持久化「已移除项目」集合,迁移跳过(QA verify-delete.cjs 验证:删→重载→不复活 ✅)
  - 新装非清零:安装版运行时误用开发版 userData(`deepseek-tide-desktop`),泄漏调试数据。打包版改用独立 `DeepSeek-Tide` 命名空间(QA verify-packaged-userdata.cjs 验证:isPackaged 时 userData=...\DeepSeek-Tide ✅)。Key 在 CodeWhale 侧不受影响
  1. ✅ 重新打包(含全部最新修复+新蓝图标)→ Setup/Portable 0.3.0(各 ~115MB)
  2. ✅ README 改成面向小白:顶部大号下载链接(指向 /releases/latest)、三步上手、隐私说明
  3. ✅ 我自己用 Playwright 操作真实界面截了 4 张图(主界面/开通向导/花费/撤销)→ `docs/screenshots/`,已入 README
  4. ✅ 修正了 SHA256SUMS 旧哈希对不上新包的隐患,重算并随 Release 发布
  5. 截撤销图时临时造空快照让按钮显形,截完已删除,未给真实工作区留下危险快照
- ✅ **v0.3.2 加对话搜索**(2026-06-10):补齐同类产品表桌功能(死搜索图标→可用)。调研了 DeepSeek-GUI/Palot/opcode(AGPL,只学不抄)/open-cowork,结论见 [[reference_borrowable_projects]];按"简单、只给 DeepSeek"原则,不做 OpenAI 中转/Base URL
- ✅ **v0.3.3 顶部「新对话」一级入口**(2026-06-10):用户反馈项目内小「+」太小、新用户找不到新对话。对标 Codex,在侧栏最顶加醒目蓝色「新对话」按钮(当前项目下开聊),小「+」保留为次级。QA verify-newchat.cjs 2/2 ✅
  - 打包注意:重新打包前必须先关掉正在运行的 win-unpacked 实例(`Get-Process DeepSeek-Tide | Stop-Process -Force`),否则 EPERM unlink dll 失败
- ✅ **v0.3.4 侧栏两大区 + 讲解模式**(2026-06-10):
  - 侧栏拆「项目」「对话」两可折叠大区,聊天可拖进项目归类(对标 Codex);移除旧迁移逻辑。QA verify-sections.cjs 8/8
  - 讲解模式(北极星"看得懂"):改完用大白话小结"改了啥/为什么",发往引擎的提示追加指令、不污染用户气泡、没改文件不啰嗦。真实端到端 smoke-explain.cjs 通过(AI 实改文件+输出符合预期小结)
- ✅ **README 动态 demo(GIF)**(2026-06-11):Playwright 录真实操作 + ffmpeg 合成(16s/0.36MB),放 README 顶部
- ✅ **v0.4.0 中英双语界面(i18n)**(2026-06-11):为发往国外渠道做准备。轻量方案(模块级 currentLang + t(中,英),App 渲染同步)全界面可切,左下角「中/EN」按钮,localStorage 持久化;讲解模式小结也随语言切。QA verify-i18n.cjs 10/10。英文 README.en.md + 英文 demo-en.gif 已就位
- 🔜 下一步候选:① 任务模板引导 ② diff 语法高亮(借鉴 Palot)③ 健壮性防呆(key失效/断网/崩溃恢复)

## 📣 分发/推广现状(2026-06-11)
- 发帖文案在本地 `docs/launch-posts.md`(已 gitignore,不进仓库)
- ✅ 已给仓库加主题标签(deepseek/coding-agent/ai-agent/electron/desktop-app/llm/developer-tools/code-assistant/ai-tools/gui)
- ⚠️ 新账号被各平台反垃圾拦截:HN Show HN 对新号限制(/showlim)、Reddit r/SideProject 受限、X 免费版仅 280 字(已备短推 219 字)→ 结论:新号需先养几天 karma 再发
- 🔨 **进行中:给 `deepseek-ai/awesome-deepseek-integration` 提 PR**(无门槛、直达 DeepSeek 用户)。放 **Applications** 区,HTML 表格行格式。准备好的条目:
  ```html
  <tr>
      <td><img src="https://raw.githubusercontent.com/yinxinhai0128/deepseek-tide/main/desktop/build/icon.png" alt="Icon" width="64" height="auto" /></td>
      <td><a href="https://github.com/yinxinhai0128/deepseek-tide">DeepSeek-Tide</a></td>
      <td>A zero-config Windows desktop app to use DeepSeek as a coding agent — no terminal; plain-language change summaries, one-click undo, live cost; bilingual (EN/中文).</td>
  </tr>
  ```
  步骤:fork → 在 README Applications 区加上面条目 → push → gh pr create
- 📌 待办(低优先):main.cjs 后端错误提示仍是中文(很少触发),英文用户极端情况下会看到中文报错,可后续 i18n
- ⚠️ 性能面板"CodeWhale 运行时 v未知"仅 dist 跑时显示,打包版正常,低优先
- ⚠️ **环境铁律:只用 PowerShell,禁用 Bash/Linux 命令(head/grep/cat/管道等)**,否则会卡死。git/gh/npm 都用 PowerShell 跑。

## 北极星
**零配置、上手即用、不怕弄坏、看得懂、找得到。**
让任何愿意尝试 DeepSeek 编程智能体的人都能便捷使用。

## 目标用户
**不喜欢配置、喜欢"上手即用"的人** —— 不限身份(白领、家庭主妇、学生、爱好者……),共同点是怕终端/英文/配环境,要的是:打开就能用、AI 帮我做、别让我搞坏、东西找得到、结果看得懂。

## 设计哲学(从 Codex 学到的"为什么")
Codex 的「沙箱 + 审批 + 撤销 + 工作树」本质都是:**让 AI 放手干活,用户不怕搞砸、收得回来**。对我们就是:**安全感 + 掌控感 + 零摩擦**。
不与 Codex 拼功能深度(子 agent / MCP / 多模型 / IDE 集成);只在它盲区做实功能:**中国本土化、零配置、防呆、能撤销、能讲解**。
注:大部分 Codex 功能是引擎能力,CodeWhale 已具备 —— 我们的活是「把引擎能力在图形界面里给非终端用户用好」,不是重造。

---

## 进度看板

### ✅ 已完成
- [x] 桌面端跑通(修 `ELECTRON_RUN_AS_NODE` 启动崩溃)
- [x] 修布局 bug:文件树撑高、侧栏收起列错位、任务切换滚动串扰
- [x] 升级 CodeWhale 引擎 → v0.8.55
- [x] "看钱"替代"看 token":人民币花费估算(顶栏药丸 + 性能面板,按约 90% 缓存命中近似)
- [x] 蓝色品牌化(DeepSeek 蓝鲸)+ 代码颜色分类(行内蓝 / 代码块中性灰)
- [x] 删掉"前缀缓存健康度 / 指纹"等工程黑话(对标 Codex 的克制)
- [x] **一键撤销 AI 改动**(影子 git 快照,自动排除 node_modules 等大目录,不碰用户自己的 .git)

### ✅ P1 项目/文件管理侧栏 —— 已完成(已按 Codex 真实模型重做)
解决用户真实痛点:"AI 生成的东西在哪、我怎么管"。
**模型对齐 Codex(调研自 developers.openai.com/codex/app):项目=文件夹,显式"添加项目",每个对话归属一个项目,对话挂在项目下。**
- [x] **显式项目实体**:持久化项目列表(localStorage),自动把老会话的文件夹/当前工作区迁移进来
- [x] **顶部「添加项目」**:选文件夹 → 进项目列表
- [x] **项目下新建对话**:每个项目头有「+」,在该项目下开聊,对话归属该项目
- [x] **项目级「...」菜单**:在资源管理器中打开 / 重命名(行内) / 置顶 / 移除项目
- [x] **对话级「...」菜单**:重命名 / 置顶 / 归档(可折叠"已归档"区) / 移除
- [x] 项目可折叠、置顶项目与当前项目排最前
- 砍掉:git 工作树、独立聊天(Codex 有,用户用不上/进阶)

### ✅ P2 零配置上手 —— 已完成
- [x] **P2.1 开通向导**:填 key 弹框改成"DeepSeek 4 步图文向导"(一键打开注册/平台/Key 页,限定只开 deepseek.com)+ 安全提示
- [x] **真实连接测试**:保存 key 时调 DeepSeek 余额接口真验证 → ✅连接成功(显余额) / ❌key无效 / ⚠️余额不足。修了"失败错误不清除"的 bug(打开/打字都会清)
  - 注:左下角持久的"已连接"指示仍是"已配置 key"(非实时验证);未来可加定期真实校验
- [x] **P2.2 模式讲人话**:Plan/Agent/YOLO → 🔒只看不改 / ✋改前问我 / ⚡放手干(下拉框+悬停说明+输入框底部同步显示)

### 🧪 P4 发布前打磨(用户要求:第一版要"用起来舒服")
目标:发 GitHub 第一版前,清掉绝大部分 bug + 把界面做"丰满/专业"。
- [x] **P4.1 装 QA 能力**:Playwright-Electron 已装(`desktop/qa/*.cjs`),AI 能自主启动+操作+截图 App。截图存 `desktop/qa/shots/`(已 gitignore)
- [x] **P4.2 自主 QA**:逐屏操作验证。结论:**功能扎实**(收起布局/开通向导/三面板/项目菜单/重命名都正常),"很多 bug"主要是视觉单薄,非功能损坏
- [x] **P4.3 视觉包装(v1 够用)**:① 空状态加"最近的任务"+垂直居中,填掉中间黑洞 ② 模式下拉去 emoji 改"纯文字+风险色圆点"(绿/黄/红) ③ 又修一处遗留绿(logo 阴影)。右面板空态本就有图标+提示,无需改
- 用户会自截 4 张 App 图给 README(主界面/开通向导/花费/撤销)
- 小记:右侧"累计花费/用量"是 `desktop-usage.json` 跨次历史总账(非 bug);可加"清零"按钮(待办)

### 🔨 P3 信任 & 分发 —— 进行中
- [x] **重新打包安装包**:`desktop/release/DeepSeek-Tide-Setup-0.3.0-x64.exe`(115.6MB,含 CodeWhale 0.8.55 + 全部 P1/P2 改进)+ 便携版 + `SHA256SUMS-0.3.0.txt`
- [ ] **代码签名(押后)**:SignPath 免费签名需"公开到 GitHub + CI 流水线 + 申请审核(数周)";现阶段(自用/小范围)未签名 + SHA-256 即可。等公开发布、有用户了再做。前提:先把项目公开推到 GitHub。
  - 备选:买 OV/EV 证书(约 ¥1500-3000/年,立等可签)

### 🎀 丝滑打磨 backlog(用户觉得 P1 "没 Codex 丝滑";评估后决定:先 P2,有用户后再回头打磨)
对照 Codex 官方文档(codex/app, codex/app/commands, codex/changelog)拆出的"丝滑"来源,我们缺:
- [ ] **键盘优先**:Codex 几乎全键盘可达(Ctrl+G 搜历史对话、Ctrl+F 文内查找、可自定义快捷键、Ctrl+Tab 切对话)。我们几乎纯鼠标。
- [ ] **输入框内斜杠命令**:Codex 在 composer 里打 `/review` `/side` `/fork` 等直接操作,不离开输入框。我们没有。
- [x] **对话搜索**(v0.3.2):侧栏搜索图标原是死的,现已实现。点它或 Ctrl/Cmd+F 展开,按项目名/对话标题/消息内容实时过滤,搜索时自动展开项目、无匹配给空状态、Esc 关。QA verify-search.cjs 8/8 ✅
- [ ] **更顺的 diff/审查**:Codex 语法高亮 diff + 暂存/提交/推送。我们 diff 是纯文本。
- [ ] **微交互**:过渡动画、焦点管理、菜单/重命名"即时感"。
- [ ] `/side` 侧边对话(不丢主线探索另一思路)。
- 结论:这些是"精修"不是"卡点"。没有用户之前打磨它没意义,先做 P2(上手)。

### ⏳ 排队中(优先级我定,可随时调)
- [ ] P2 零配置上手:DeepSeek 开通 + 充值 + 填 key 的图文向导(北极星,但部分依赖外部流程)
- [ ] P2 把 plan / agent / yolo 三个模式讲成人话(安全等级)
- [ ] P3 信任 & 分发:代码签名(SignPath 免费证书)+ 公开 SHA-256 + 重新打包安装包
- [ ] P4 讲解模式:AI 用大白话说"我改了啥、这段代码干嘛用"
- [ ] P4 任务模板:用户不知道问什么 → 引导
- [ ] 健壮性:错误态 / 断网 / 引擎崩溃恢复 / key 失效提示
- [ ] 清理:删 `src/whaletide` Python 玩具、仓库里提交的缓存垃圾(`.npm-cache` 等)

### 🧊 暂不做(明确说 NO,防止贪多做乱)
- Codex 的子 agent / MCP 生态 / 多模型协同 / IDE 集成 / git 工作树 / 云任务
- 理由:solo + AI 追不上,目标用户也不需要

---

## 协作约定
- 一次只做一件,做完更新本文件再开下一件。
- 每次新对话,先读本文件的「下一个做这个」就能接上,不丢线。
