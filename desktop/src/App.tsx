import {
  ClipboardEvent,
  DragEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  IconAdjustmentsHorizontal,
  IconArrowDown,
  IconArrowUp,
  IconBrandGit,
  IconChevronDown,
  IconChevronRight,
  IconCode,
  IconFile,
  IconFolder,
  IconFolderOpen,
  IconGitBranch,
  IconGauge,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarRightCollapse,
  IconLoader2,
  IconMessageCirclePlus,
  IconPaperclip,
  IconPhoto,
  IconPlayerStop,
  IconPlus,
  IconSearch,
  IconSettings,
  IconSparkles,
  IconRefresh,
  IconTerminal2,
  IconTrash,
  IconWaveSine,
  IconX
} from "@tabler/icons-react";
import clsx from "clsx";

type Role = "user" | "assistant" | "system";
type Message = {
  id: string;
  role: Role;
  content: string;
  events?: AgentEvent[];
  attachments?: Attachment[];
  createdAt: number;
};
type Thread = {
  id: string;
  title: string;
  workspace: string;
  sessionId?: string;
  messages: Message[];
  updatedAt: number;
};

const uid = () => crypto.randomUUID();
const STORAGE_KEY = "deepseek-tide.desktop.threads.v1";
const LEGACY_STORAGE_KEY = "whaletide.desktop.threads.v1";

function loadThreads(): Thread[] {
  try {
    const serialized =
      localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || "[]";
    const value = JSON.parse(serialized);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function threadsForStorage(threads: Thread[]): Thread[] {
  return threads.slice(0, 40).map((thread) => ({
    ...thread,
    messages: thread.messages.slice(-120).map((message) => ({
      ...message,
      content: message.content.slice(0, 200_000),
      attachments: message.attachments?.map((attachment) => ({
        ...attachment,
        preview: null
      })),
      events: message.events?.slice(-100).map((event) => ({
        ...event,
        content: event.content?.slice(0, 8_000),
        error: event.error?.slice(0, 8_000),
        output: event.output?.slice(0, 8_000)
      }))
    }))
  }));
}

function shortPath(value: string) {
  const parts = value.split(/[\\/]/).filter(Boolean);
  return parts.slice(-2).join(" / ") || "选择工作区";
}

function FileTree({
  nodes,
  level = 0
}: {
  nodes: FileNode[];
  level?: number;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <>
      {nodes.map((node) => {
        const expanded = open[node.path] ?? level < 1;
        return (
          <div key={node.path}>
            <button
              className="tree-row"
              style={{ paddingLeft: 12 + level * 14 }}
              onClick={() =>
                node.type === "directory" &&
                setOpen((value) => ({ ...value, [node.path]: !expanded }))
              }
              title={node.path}
            >
              {node.type === "directory" ? (
                <>
                  {expanded ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}
                  {expanded ? <IconFolderOpen size={15} /> : <IconFolder size={15} />}
                </>
              ) : (
                <>
                  <span className="tree-spacer" />
                  <IconFile size={14} />
                </>
              )}
              <span>{node.name}</span>
            </button>
            {node.type === "directory" && expanded && node.children ? (
              <FileTree nodes={node.children} level={level + 1} />
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function toolLabel(name?: string) {
  const labels: Record<string, string> = {
    list_dir: "查看目录",
    read_file: "读取文件",
    search_files: "搜索文件",
    write_file: "写入文件",
    edit_file: "编辑文件",
    apply_patch: "应用补丁",
    exec_shell: "运行命令",
    run_command: "运行命令"
  };
  return labels[name || ""] || name?.replaceAll("_", " ") || "工具操作";
}

function ToolActivity({ events }: { events: AgentEvent[] }) {
  const tools: AgentEvent[] = [];
  const byId = new Map<string, AgentEvent>();
  const logs: AgentEvent[] = [];
  for (const event of events) {
    if (event.type === "tool_use") {
      const entry = { ...event };
      tools.push(entry);
      if (event.id) byId.set(event.id, entry);
    } else if (event.type === "tool_result") {
      const tool = event.id ? byId.get(event.id) : undefined;
      if (tool) {
        tool.output = event.output;
        tool.status = event.status;
      } else if (event.output?.trim()) {
        tools.push(event);
      }
    } else if ((event.content || event.error)?.trim()) {
      logs.push(event);
    }
  }
  const visible = [...tools, ...logs];
  if (!visible.length) return null;
  return (
    <details className="activity-card">
      <summary>
        <IconTerminal2 size={14} />
        <span>执行过程</span>
        <small>{visible.length} 项操作</small>
        <IconChevronRight className="details-chevron" size={14} />
      </summary>
      <div className="activity-list">
        {visible.map((event, index) => {
          const detail =
            event.output ||
            event.content ||
            event.error ||
            (event.input ? JSON.stringify(event.input, null, 2) : "");
          return (
            <details className="activity-item" key={`${event.id || event.type}-${index}`}>
              <summary>
                <span className={clsx("activity-status", event.status === "error" && "failed")} />
                <strong>
                  {event.type === "tool_use" || event.type === "tool_result"
                    ? toolLabel(event.name)
                    : event.type === "stderr"
                      ? "运行日志"
                      : "系统消息"}
                </strong>
                {event.input && typeof event.input === "object" && "path" in event.input ? (
                  <code>{String((event.input as { path?: unknown }).path || "")}</code>
                ) : null}
                {detail ? <IconChevronRight className="details-chevron" size={13} /> : null}
              </summary>
              {detail ? <pre>{detail}</pre> : null}
            </details>
          );
        })}
      </div>
    </details>
  );
}

function ChatMessage({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <article className="message message-user">
        <div className="message-user-content">
          {message.attachments?.length ? (
            <div className="message-attachments">
              {message.attachments.map((attachment) => (
                <div className="message-attachment" key={attachment.id}>
                  {attachment.isImage && attachment.preview ? (
                    <img src={attachment.preview} alt={attachment.name} />
                  ) : (
                    <IconFile size={17} />
                  )}
                  <span>{attachment.name}</span>
                </div>
              ))}
            </div>
          ) : null}
          <div className="message-user-bubble">{message.content}</div>
        </div>
      </article>
    );
  }
  return (
    <article className="message message-assistant">
      <div className="assistant-mark">
        <IconWaveSine size={17} />
      </div>
      <div className="assistant-body">
        {message.events?.length ? <ToolActivity events={message.events} /> : null}
        {message.content ? (
          <div className="markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        ) : (
          <div className="thinking-line">
            <span />
            <span />
            <span />
          </div>
        )}
      </div>
    </article>
  );
}

function ApiKeyDialog({
  open,
  onClose,
  onSaved
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (status: Awaited<ReturnType<typeof window.whale.getStatus>>) => void;
}) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  if (!open) return null;

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await window.whale.saveApiKey(key);
      if (!result.ok || !result.status?.authenticated) {
        setError(result.error || "保存失败，请重试");
        return;
      }
      setKey("");
      onSaved(result.status);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal-card" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <div>
            <span className="eyebrow">DEEPSEEK CONNECTION</span>
            <h2>连接你的 DeepSeek 账户</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            <IconX size={18} />
          </button>
        </div>
        <p>
          密钥通过标准输入交给 CodeWhale，并保存到用户级凭证存储。DeepSeek-Tide
          不会把它写进项目或浏览器存储。
        </p>
        <label className="field-label" htmlFor="api-key">
          API Key
        </label>
        <input
          id="api-key"
          autoFocus
          className="text-field"
          type="password"
          value={key}
          onChange={(event) => setKey(event.target.value)}
          placeholder="sk-..."
        />
        {error ? <div className="form-error">{error}</div> : null}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            取消
          </button>
          <button className="button primary" disabled={!key.trim() || saving}>
            {saving ? <IconLoader2 className="spin" size={16} /> : null}
            保存并连接
          </button>
        </div>
      </form>
    </div>
  );
}

export default function App() {
  const [threads, setThreads] = useState<Thread[]>(loadThreads);
  const [activeId, setActiveId] = useState(() => loadThreads()[0]?.id || "");
  const [workspace, setWorkspace] = useState("");
  const [files, setFiles] = useState<FileNode[]>([]);
  const [gitStatus, setGitStatus] = useState("");
  const [gitDiff, setGitDiff] = useState("");
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [model, setModel] = useState("deepseek-v4-flash");
  const [mode, setMode] = useState("agent");
  const [running, setRunning] = useState(false);
  const [runtime, setRuntime] = useState<Awaited<ReturnType<typeof window.whale.getStatus>> | null>(
    null
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [rightTab, setRightTab] = useState<"files" | "changes" | "performance">("changes");
  const [performance, setPerformance] = useState<
    Awaited<ReturnType<typeof window.whale.getPerformance>> | null
  >(null);
  const [updateState, setUpdateState] = useState<
    Awaited<ReturnType<typeof window.whale.checkForUpdates>> | null
  >(null);
  const [updating, setUpdating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRunThreadIdRef = useRef<string | null>(null);
  const modelRef = useRef(model);
  modelRef.current = model;
  const stickToBottomRef = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const activeThread = threads.find((thread) => thread.id === activeId);

  const groupedThreads = useMemo(
    () => [...threads].sort((a, b) => b.updatedAt - a.updatedAt),
    [threads]
  );

  useEffect(() => {
    Promise.all([window.whale.getWorkspace(), window.whale.getStatus()]).then(
      ([currentWorkspace, status]) => {
        setWorkspace(currentWorkspace);
        setRuntime(status);
        if (!status.authenticated) setSettingsOpen(true);
      }
    );
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(threadsForStorage(threads)));
    } catch {
      setAttachmentError("本地会话存储空间不足；当前任务仍可继续，但部分历史无法持久化。");
    }
  }, [threads]);

  async function refreshPerformance() {
    const [nextPerformance, nextUpdate] = await Promise.all([
      window.whale.getPerformance(modelRef.current),
      window.whale.checkForUpdates()
    ]);
    setPerformance(nextPerformance);
    setUpdateState(nextUpdate);
  }

  useEffect(() => {
    void refreshPerformance();
    const timer = window.setInterval(() => {
      void window.whale.getPerformance(model).then(setPerformance);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [model]);

  useEffect(() => {
    if (!workspace) return;
    Promise.all([
      window.whale.listFiles(workspace),
      window.whale.gitStatus(workspace),
      window.whale.gitDiff(workspace)
    ]).then(([nextFiles, status, diff]) => {
      setFiles(nextFiles);
      setGitStatus(status);
      setGitDiff(diff);
    });
  }, [workspace, running]);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: running ? "auto" : "smooth"
      });
    });
  }, [activeThread?.messages, running]);

  function handleConversationScroll() {
    const element = scrollRef.current;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    const atBottom = distance < 80;
    stickToBottomRef.current = atBottom;
    setShowScrollButton(!atBottom);
  }

  function scrollToBottom() {
    stickToBottomRef.current = true;
    setShowScrollButton(false);
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth"
    });
  }

  function addAttachments(next: Attachment[]) {
    setAttachments((current) => {
      const known = new Set(current.map((item) => item.path.toLowerCase()));
      return [...current, ...next.filter((item) => !known.has(item.path.toLowerCase()))].slice(0, 8);
    });
    setAttachmentError("");
  }

  async function chooseAttachments() {
    const result = await window.whale.chooseAttachments();
    if (!result.ok) {
      setAttachmentError(result.error || "无法添加附件");
      return;
    }
    addAttachments(result.attachments);
  }

  async function importFiles(files: File[]) {
    if (!files.length) return;
    const sources = await Promise.all(
      files.slice(0, 8).map(async (file) => {
        const filePath = window.whale.getPathForFile(file);
        if (filePath) return { path: filePath, name: file.name, type: file.type };
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        for (const byte of bytes) binary += String.fromCharCode(byte);
        return { name: file.name || "pasted-image.png", type: file.type, data: btoa(binary) };
      })
    );
    const result = await window.whale.importAttachments(sources);
    if (!result.ok) {
      setAttachmentError(result.error || "无法添加附件");
      return;
    }
    addAttachments(result.attachments);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDraggingFiles(false);
    void importFiles(Array.from(event.dataTransfer.files));
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files);
    if (!files.length) return;
    event.preventDefault();
    void importFiles(files);
  }

  useEffect(() => {
    return window.whale.onAgentEvent((event) => {
      const eventMessage = event.content || event.error || "";
      if (event.type === "error" && /API key not found/i.test(eventMessage)) {
        setRuntime((current) =>
          current ? { ...current, authenticated: false, authSource: "missing" } : current
        );
        setSettingsOpen(true);
      }
      setThreads((current) =>
        current.map((thread) => {
          if (thread.id !== activeRunThreadIdRef.current) return thread;
          const messages = [...thread.messages];
          const last = messages.at(-1);
          if (!last || last.role !== "assistant") return thread;
          const updated = { ...last, events: [...(last.events || [])] };
          if (event.type === "content") updated.content += event.content || "";
          else if (event.type === "session_capture") {
            return { ...thread, sessionId: event.content, updatedAt: Date.now() };
          } else if (!["metadata", "done", "process_start", "process_end"].includes(event.type)) {
            updated.events!.push(event);
          }
          messages[messages.length - 1] = updated;
          return { ...thread, messages, updatedAt: Date.now() };
        })
      );
      if (event.type === "process_end" || event.type === "done" || event.type === "error") {
        setRunning(false);
        activeRunThreadIdRef.current = null;
        window.setTimeout(() => void refreshPerformance(), 500);
      }
    });
  }, []);

  async function pickWorkspace() {
    const selected = await window.whale.chooseWorkspace();
    if (!selected) return;
    setWorkspace(selected);
    createThread(selected);
  }

  function createThread(target = workspace) {
    const thread: Thread = {
      id: uid(),
      title: "新任务",
      workspace: target,
      messages: [],
      updatedAt: Date.now()
    };
    setThreads((value) => [thread, ...value]);
    setActiveId(thread.id);
  }

  function deleteThread(id: string) {
    setThreads((value) => value.filter((thread) => thread.id !== id));
    if (activeId === id) {
      setActiveId(threads.find((thread) => thread.id !== id)?.id || "");
    }
  }

  async function submit() {
    const content = prompt.trim();
    if ((!content && !attachments.length) || running || !workspace) return;
    if (!runtime?.authenticated) {
      setSettingsOpen(true);
      return;
    }
    let thread = activeThread;
    if (!thread) {
      const id = uid();
      thread = {
        id,
        title: content.slice(0, 38) || attachments[0]?.name || "附件任务",
        workspace,
        messages: [],
        updatedAt: Date.now()
      };
      setActiveId(id);
    }
    const userMessage: Message = {
      id: uid(),
      role: "user",
      content: content || "请查看附件。",
      attachments,
      createdAt: Date.now()
    };
    const assistantMessage: Message = {
      id: uid(),
      role: "assistant",
      content: "",
      events: [],
      createdAt: Date.now()
    };
    const nextThread = {
      ...thread,
      title:
        thread.messages.length
          ? thread.title
          : content.slice(0, 38) || attachments[0]?.name || "附件任务",
      messages: [...thread.messages, userMessage, assistantMessage],
      updatedAt: Date.now()
    };
    setThreads((value) => [nextThread!, ...value.filter((item) => item.id !== nextThread!.id)]);
    setPrompt("");
    setAttachments([]);
    setAttachmentError("");
    stickToBottomRef.current = true;
    setShowScrollButton(false);
    setRunning(true);
    activeRunThreadIdRef.current = thread.id;
    const attachmentContext = attachments.length
      ? `\n\n附件：\n${attachments
          .map(
            (attachment) =>
              attachment.isImage
                ? `[Attached image: ${attachment.path}]`
                : `- @${attachment.relativePath} (${attachment.mime}, ${attachment.name})`
          )
          .join("\n")}\n请读取并结合这些附件完成任务。`
      : "";
    const result = await window.whale.startTurn({
      workspace,
      prompt: `${content || "请查看并分析附件。"}${attachmentContext}`,
      model,
      mode,
      sessionId: thread.sessionId
    });
    if (!result.ok) {
      setRunning(false);
      activeRunThreadIdRef.current = null;
      setThreads((value) =>
        value.map((item) =>
          item.id === thread!.id
            ? {
                ...item,
                messages: item.messages.map((message, index) =>
                  index === item.messages.length - 1
                    ? { ...message, content: result.error || "启动失败" }
                    : message
                )
              }
            : item
        )
      );
    }
  }

  function handleComposerKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  const changedFiles = gitStatus
    .split(/\r?\n/)
    .filter((line) => /^[ MADRCU?!]{2}\s/.test(line));

  return (
    <div className="app-shell">
      <ApiKeyDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={setRuntime}
      />

      <aside className={clsx("left-sidebar", !leftOpen && "collapsed")}>
        <div className="brand">
          <div className="brand-mark">
            <IconWaveSine size={19} />
          </div>
          <strong>DeepSeek-Tide</strong>
          <button className="icon-button push-right" onClick={() => setLeftOpen(false)}>
            <IconLayoutSidebarLeftCollapse size={17} />
          </button>
        </div>
        <button className="new-thread-button" onClick={() => createThread()}>
          <IconMessageCirclePlus size={17} />
          新任务
          <span>Ctrl N</span>
        </button>
        <button className="workspace-card" onClick={pickWorkspace}>
          <IconFolder size={17} />
          <span>
            <small>当前工作区</small>
            <strong>{shortPath(workspace)}</strong>
          </span>
          <IconChevronDown size={15} />
        </button>
        <div className="sidebar-section-title">
          <span>任务</span>
          <IconSearch size={14} />
        </div>
        <div className="thread-list">
          {groupedThreads.map((thread) => (
            <button
              key={thread.id}
              className={clsx("thread-row", activeId === thread.id && "active")}
              onClick={() => {
                void window.whale.setWorkspace(thread.workspace).then((result) => {
                  if (result.ok && result.workspace) {
                    setActiveId(thread.id);
                    setWorkspace(result.workspace);
                  }
                });
              }}
            >
              <span className="thread-status" />
              <span className="thread-copy">
                <strong>{thread.title}</strong>
                <small>{shortPath(thread.workspace)}</small>
              </span>
              <span
                className="thread-delete"
                role="button"
                onClick={(event) => {
                  event.stopPropagation();
                  deleteThread(thread.id);
                }}
              >
                <IconTrash size={14} />
              </span>
            </button>
          ))}
        </div>
        <div className="sidebar-footer">
          <button onClick={() => setSettingsOpen(true)}>
            <IconSettings size={17} />
            设置
          </button>
          <div className={clsx("connection-dot", runtime?.authenticated && "online")} />
          <span>{runtime?.authenticated ? "DeepSeek 已连接" : "需要登录"}</span>
        </div>
      </aside>

      <main className="workspace-main">
        <header className="topbar">
          {!leftOpen ? (
            <button className="icon-button" onClick={() => setLeftOpen(true)}>
              <IconLayoutSidebarLeftCollapse size={18} />
            </button>
          ) : null}
          <div className="topbar-title">
            <strong>{activeThread?.title || "新的编码任务"}</strong>
            <span>{shortPath(workspace)}</span>
          </div>
          <div className="topbar-actions">
            <button
              className="cache-pill"
              onClick={() => {
                setRightOpen(true);
                setRightTab("performance");
              }}
              title="查看前缀缓存与用量"
            >
              <span>前缀</span>
              <strong>{performance?.cache.label || "检查中"}</strong>
            </button>
            <select value={mode} onChange={(event) => setMode(event.target.value)}>
              <option value="plan">Plan</option>
              <option value="agent">Agent</option>
              <option value="yolo">YOLO</option>
            </select>
            <select value={model} onChange={(event) => setModel(event.target.value)}>
              <option value="deepseek-v4-flash">V4 Flash</option>
              <option value="deepseek-v4-pro">V4 Pro</option>
              <option value="auto">Auto</option>
            </select>
            <button className="icon-button" onClick={() => setSettingsOpen(true)}>
              <IconAdjustmentsHorizontal size={17} />
            </button>
            {!rightOpen ? (
              <button className="icon-button" onClick={() => setRightOpen(true)}>
                <IconLayoutSidebarRightCollapse size={18} />
              </button>
            ) : null}
          </div>
        </header>

        <div
          className="conversation"
          ref={scrollRef}
          onScroll={handleConversationScroll}
        >
          {!activeThread?.messages.length ? (
            <div className="empty-state">
              <div className="empty-orbit">
                <div className="empty-logo">
                  <IconWaveSine size={28} />
                </div>
              </div>
              <h1>让 DeepSeek 开始工作</h1>
              <p>描述一个任务，DeepSeek-Tide 会读取项目、修改代码并验证结果。</p>
              <div className="suggestion-grid">
                {[
                  ["检查并修复", "运行测试，定位失败并完成修复"],
                  ["理解代码库", "总结架构、关键模块与数据流"],
                  ["实现新功能", "根据需求完成开发并添加测试"],
                  ["代码审查", "检查当前变更中的风险和回归"]
                ].map(([title, text]) => (
                  <button key={title} onClick={() => setPrompt(text)}>
                    <IconSparkles size={15} />
                    <span>
                      <strong>{title}</strong>
                      <small>{text}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-stack">
              {activeThread.messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
            </div>
          )}
        </div>
        {showScrollButton ? (
          <button className="scroll-bottom-button" onClick={scrollToBottom} title="回到底部">
            <IconArrowDown size={17} />
          </button>
        ) : null}

        <div className="composer-wrap">
          <div
            className={clsx("composer", running && "running", draggingFiles && "dragging")}
            onDragEnter={(event) => {
              event.preventDefault();
              setDraggingFiles(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setDraggingFiles(false);
              }
            }}
            onDrop={handleDrop}
          >
            {attachments.length ? (
              <div className="attachment-strip">
                {attachments.map((attachment) => (
                  <div className="attachment-chip" key={attachment.id}>
                    {attachment.isImage && attachment.preview ? (
                      <img src={attachment.preview} alt="" />
                    ) : attachment.isImage ? (
                      <IconPhoto size={16} />
                    ) : (
                      <IconFile size={16} />
                    )}
                    <span title={attachment.name}>{attachment.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((current) =>
                          current.filter((item) => item.id !== attachment.id)
                        )
                      }
                      title="移除附件"
                    >
                      <IconX size={13} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={handleComposerKey}
              onPaste={handlePaste}
              placeholder={running ? "任务正在执行…" : "描述任务，或输入 / 查看命令"}
              disabled={running}
              rows={1}
            />
            <div className="composer-footer">
              <div className="composer-meta">
                <button
                  type="button"
                  className="attach-button"
                  onClick={chooseAttachments}
                  disabled={running}
                  title="添加文件或图片"
                >
                  <IconPaperclip size={15} />
                  添加附件
                </button>
                <span>
                  <IconCode size={14} />
                  {mode === "plan" ? "只读规划" : mode === "yolo" ? "完全放行" : "自动工具"}
                </span>
                {activeThread?.sessionId ? <span>会话已持续</span> : null}
              </div>
              {running ? (
                <button className="send-button stop" onClick={() => window.whale.stopTurn()}>
                  <IconPlayerStop size={15} />
                </button>
              ) : (
                <button
                  className="send-button"
                  onClick={submit}
                  disabled={!prompt.trim() && !attachments.length}
                >
                  <IconArrowUp size={17} />
                </button>
              )}
            </div>
          </div>
          {attachmentError ? <div className="attachment-error">{attachmentError}</div> : null}
          <div className="composer-hint">Enter 发送 · Shift Enter 换行</div>
        </div>
      </main>

      <aside className={clsx("right-panel", !rightOpen && "collapsed")}>
        <div className="right-tabs">
          <button
            className={rightTab === "changes" ? "active" : ""}
            onClick={() => setRightTab("changes")}
          >
            <IconBrandGit size={15} />
            变更
            {changedFiles.length ? <span>{changedFiles.length}</span> : null}
          </button>
          <button
            className={rightTab === "files" ? "active" : ""}
            onClick={() => setRightTab("files")}
          >
            <IconFolder size={15} />
            文件
          </button>
          <button
            className={rightTab === "performance" ? "active" : ""}
            onClick={() => setRightTab("performance")}
          >
            <IconGauge size={15} />
            性能
          </button>
          <button className="icon-button push-right" onClick={() => setRightOpen(false)}>
            <IconLayoutSidebarRightCollapse size={17} />
          </button>
        </div>
        {rightTab === "files" ? (
          <div className="file-tree">
            <div className="panel-caption">{shortPath(workspace)}</div>
            <FileTree nodes={files} />
          </div>
        ) : rightTab === "changes" ? (
          <div className="changes-panel">
            <div className="branch-row">
              <IconGitBranch size={15} />
              <span>{gitStatus.split(/\r?\n/)[0]?.replace(/^##\s*/, "") || "未检测到 Git"}</span>
            </div>
            {!changedFiles.length ? (
              <div className="panel-empty">
                <IconBrandGit size={28} />
                <strong>工作区没有变更</strong>
                <span>代理修改的文件会显示在这里。</span>
              </div>
            ) : (
              <>
                <div className="changed-files">
                  {changedFiles.map((line) => (
                    <div key={line}>
                      <span className="change-badge">{line.slice(0, 2).trim() || "M"}</span>
                      <span>{line.slice(3)}</span>
                    </div>
                  ))}
                </div>
                {gitDiff ? <pre className="diff-preview">{gitDiff}</pre> : null}
              </>
            )}
          </div>
        ) : (
          <div className="performance-panel">
            <div className="performance-heading">
              <div>
                <span className="panel-caption">PREFIX CACHE</span>
                <strong>前缀缓存健康度</strong>
              </div>
              <button className="icon-button" onClick={() => void refreshPerformance()}>
                <IconRefresh size={16} />
              </button>
            </div>
            <div className="cache-score">
              <strong>{performance?.profile.changed ? "已变化" : "稳定"}</strong>
              <span>模型、项目指令与 MCP 工具结构</span>
            </div>
            <div className="metric-grid">
              <div>
                <span>输出 Token</span>
                <strong>{(performance?.usage.totals.output_tokens || 0).toLocaleString()}</strong>
              </div>
              <div>
                <span>输入 Token</span>
                <strong>{(performance?.usage.totals.input_tokens || 0).toLocaleString()}</strong>
              </div>
              <div>
                <span>完成轮次</span>
                <strong>{performance?.usage.totals.turns || 0}</strong>
              </div>
              <div>
                <span>缓存命中率</span>
                <strong>运行时未暴露</strong>
              </div>
            </div>
            <div className="profile-card">
              <span>稳定前缀画像</span>
              <code>{performance?.profile.fingerprint || "等待运行时"}</code>
              {performance?.profile.changed ? (
                <p>{performance.profile.changes.join("、") || "前缀结构已变化"}</p>
              ) : (
                <p>指令、模型和工具结构保持稳定。</p>
              )}
            </div>
            <div className="runtime-update">
              <div>
                <span>CodeWhale 运行时</span>
                <strong>
                  v{updateState?.current || "未知"}
                  {updateState?.available ? ` → v${updateState.latest}` : ""}
                </strong>
              </div>
              <button
                className="button secondary"
                disabled={!updateState?.available || updating || running}
                onClick={async () => {
                  setUpdating(true);
                  const result = await window.whale.applyRuntimeUpdate();
                  setUpdateState(result);
                  setUpdating(false);
                  await refreshPerformance();
                }}
              >
                {updating ? <IconLoader2 className="spin" size={15} /> : <IconRefresh size={15} />}
                {updateState?.available ? "立即更新" : "已是最新"}
              </button>
              {updateState?.error ? <p className="form-error">{updateState.error}</p> : null}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
