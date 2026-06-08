# DeepSeek-Tide

DeepSeek-Tide 是面向 Windows 的 DeepSeek 桌面编码智能体。它采用独立实现的
Electron/React 桌面层，并托管官方 MIT 许可的
[CodeWhale](https://github.com/Hmbown/CodeWhale) 运行时。当前锁定版本：
**CodeWhale v0.8.53**。

DeepSeek-Tide 不是 DeepSeek 官方产品，也不是 CodeWhale、Claude Code 或其他产品的
改名版本。

## 主要能力

- Codex 风格的任务列表、流式对话、工作区文件树、Git 状态与 diff
- Plan、Agent、YOLO 三种权限模式
- 文件、图片选择，拖放上传和粘贴截图
- 可独立滚动的聊天区与回到底部按钮
- 将连续工具调用折叠为紧凑的“执行过程”，避免大量空白事件框
- DeepSeek 凭证通过标准输入写入 CodeWhale 用户级凭证存储
- 实际桌面任务的输入/输出 Token 与轮次统计
- 稳定前缀画像，提示模型、项目指令或 MCP 工具结构变化
- 在桌面端检查并应用 CodeWhale 官方更新

缓存画像只持久化 SHA-256 哈希及变化类别，不保存 API key、提示词或会话内容。
桌面端不启动额外的本地 HTTP 控制服务。附件、Git 与代理 IPC 只能访问用户通过系统
目录选择器批准的工作区。安装版默认使用
`Documents\DeepSeek-Tide Workspace`，不会默认授予整个文档目录。

CodeWhale v0.8.53 的 `exec --output-format stream-json` 尚未暴露缓存命中 Token，
因此界面明确显示“运行时未暴露”，不会用推测值冒充真实命中率或成本。

## 桌面开发

```powershell
cd desktop
npm install
npm run dev
```

构建 Windows 安装版与便携版：

```powershell
cd desktop
npm run build
```

产物位于 `desktop/release/`：

- `DeepSeek-Tide-Setup-0.2.0-x64.exe`
- `DeepSeek-Tide-Portable-0.2.0-x64.exe`

当前本地 0.2.0 产物是**未签名预览构建**，Windows SmartScreen 可能显示未知发布者。
面向公众发布二进制前，应配置 Authenticode 代码签名证书并公开 SHA-256 校验值。
源码、测试和构建流程不依赖签名证书。

## 命令行运行时

安装或刷新官方 CodeWhale 运行时：

```cmd
install.cmd
```

启动：

```cmd
deepseek-tide.cmd
```

旧的 `whaletide.cmd` 和 `codetide.cmd` 暂时保留为兼容入口。

单次任务：

```cmd
deepseek-tide.cmd -p "检查这个仓库，运行测试并修复失败"
```

凭证配置：

```cmd
deepseek-tide.cmd auth set --provider deepseek
```

不要把 API key 写入仓库、提示词、截图或命令历史。发送到聊天中的旧 key 应视为已
泄露，并在 DeepSeek 控制台撤销。

## 代理与网络

```powershell
$env:DEEPSEEK_TIDE_PROXY = "http://127.0.0.1:7890"
.\install.cmd
```

未设置时，安装器与桌面端会探测 `7897`、`7890`、`10809`、`1080`。
`WHALETIDE_PROXY` 和 `CODETIDE_PROXY` 仍兼容读取。

安装器从 CodeWhale 官方 GitHub Release 下载 Windows 便携包及 SHA-256 清单，
校验成功后才安装二进制。

## 架构与来源

默认代理循环、工具执行、会话、MCP 与上下文压缩由 CodeWhale 提供。桌面层专注于
交互、凭证桥接、工作区可视化、缓存可观测性与发行更新。

本项目研究了 [DeepSeek-Reasonix](https://github.com/esengine/DeepSeek-Reasonix)
公开 MIT 代码中的稳定前缀、低频压缩、配置指纹与插件延迟启动思想，但未复制或发布
Reasonix 源码。设计记录见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

`src/whaletide` 是早期 clean-room Python 后备实现，保留内部包名以兼容已有脚本；
它不是默认入口，也不等价于完整 CodeWhale。

## 测试

```powershell
python -m compileall -q src whaletide tests
python -m unittest discover -s tests -v
python -m whaletide --help
python -m whaletide --version
cd desktop
npm test
npm run build:renderer
```

## 许可

DeepSeek-Tide 自有代码使用 MIT License。第三方版权与许可见
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
