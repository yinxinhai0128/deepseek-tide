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
  IconFolderPlus,
  IconExternalLink,
  IconHistory,
  IconDots,
  IconPin,
  IconArchive,
  IconArchiveOff,
  IconPencil,
  IconGitBranch,
  IconArrowBackUp,
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
  pinned?: boolean;
  archived?: boolean;
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

type Project = {
  path: string;
  name: string;
  pinned?: boolean;
  addedAt: number;
};

const STORAGE_KEY_PROJECTS = "deepseek-tide.desktop.projects.v1";

function projectName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

function loadProjects(): Project[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY_PROJECTS) || "[]");
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

function ChatMessage({ message, isStreaming }: { message: Message; isStreaming?: boolean }) {
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
        ) : isStreaming ? (
          <div className="thinking-line">
            <span />
            <span />
            <span />
          </div>
        ) : message.events?.length ? null : (
          <div className="assistant-empty">（本轮没有文本回复）</div>
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
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setError("");
      setSuccess("");
      setKey("");
    }
  }, [open]);

  if (!open) return null;

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await window.whale.saveApiKey(key);
      if (!result.ok || !result.status?.authenticated) {
        setError(result.error || "保存失败，请重试");
        return;
      }
      const check = result.check;
      if (check?.valid === false) {
        setError(check.error || "这个 API key 无效，请检查后重新粘贴。");
        return;
      }
      onSaved(result.status);
      if (check?.valid === true && check.available === false) {
        setError(
          `key 有效，但账户余额不足（${check.balance ?? 0} ${check.currency ?? ""}）。请先到 DeepSeek 充值，再发任务。`
        );
        return;
      }
      const balanceText =
        check?.valid && check.balance != null
          ? `，余额 ${check.balance} ${check.currency ?? ""}`
          : "";
      setSuccess(`✅ 连接成功${balanceText}`);
      setKey("");
      window.setTimeout(onClose, 1400);
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
        <p className="onboard-intro">
          DeepSeek-Tide 需要一个 DeepSeek 的 <strong>API Key</strong> 才能干活。还没有的话，照下面 4
          步几分钟就能搞定 👇
        </p>
        <ol className="onboard-steps">
          <li>
            <div className="onboard-step-text">
              <strong>① 注册 / 登录 DeepSeek</strong>
              <span>用手机号注册一个账号</span>
            </div>
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                void window.whale.openExternal("https://platform.deepseek.com/sign_in")
              }
            >
              打开
              <IconExternalLink size={14} />
            </button>
          </li>
          <li>
            <div className="onboard-step-text">
              <strong>② 实名认证 + 充值</strong>
              <span>登录后在平台完成实名，左侧菜单充值（新账号必须充值才能用，最低 1 元）</span>
            </div>
            <button
              type="button"
              className="button secondary"
              onClick={() => void window.whale.openExternal("https://platform.deepseek.com")}
            >
              打开
              <IconExternalLink size={14} />
            </button>
          </li>
          <li>
            <div className="onboard-step-text">
              <strong>③ 创建 API Key</strong>
              <span>点“创建”，复制生成的 key（只显示一次，务必复制好）</span>
            </div>
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                void window.whale.openExternal("https://platform.deepseek.com/api_keys")
              }
            >
              打开
              <IconExternalLink size={14} />
            </button>
          </li>
          <li>
            <div className="onboard-step-text">
              <strong>④ 粘贴到下面 → 保存</strong>
              <span>把复制的 key 粘进输入框，点“保存并连接”</span>
            </div>
          </li>
        </ol>
        <p className="onboard-security">
          🔒 你的 key 只存在这台电脑（交给 CodeWhale 的本地凭证库），DeepSeek-Tide 绝不上传，也不写进项目或浏览器。
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
          onChange={(event) => {
            setKey(event.target.value);
            if (error) setError("");
            if (success) setSuccess("");
          }}
          placeholder="sk-..."
        />
        {error ? <div className="form-error">{error}</div> : null}
        {success ? <div className="form-success">{success}</div> : null}
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
  const scrollPositionsRef = useRef<Map<string, number>>(new Map());
  const prevActiveIdRef = useRef(activeId);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [menuThreadId, setMenuThreadId] = useState<string | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [projectMenuPath, setProjectMenuPath] = useState<string | null>(null);
  const [projectRenamingPath, setProjectRenamingPath] = useState<string | null>(null);
  const [projectRenameValue, setProjectRenameValue] = useState("");
  const activeThread = threads.find((thread) => thread.id === activeId);

  const groupedThreads = useMemo(
    () =>
      threads
        .filter((thread) => !thread.archived)
        .sort((a, b) => {
          if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
          return b.updatedAt - a.updatedAt;
        }),
    [threads]
  );

  const archivedThreads = useMemo(
    () => threads.filter((thread) => thread.archived).sort((a, b) => b.updatedAt - a.updatedAt),
    [threads]
  );

  const recentThreads = useMemo(
    () =>
      threads
        .filter((thread) => !thread.archived && thread.messages.length > 0 && thread.id !== activeId)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 5),
    [threads, activeId]
  );

  function openThread(thread: Thread) {
    void window.whale.setWorkspace(thread.workspace).then((result) => {
      if (result.ok && result.workspace) {
        setActiveId(thread.id);
        setWorkspace(result.workspace);
      }
    });
  }

  const threadsByProject = useMemo(() => {
    const map = new Map<string, Thread[]>();
    for (const thread of groupedThreads) {
      const list = map.get(thread.workspace);
      if (list) list.push(thread);
      else map.set(thread.workspace, [thread]);
    }
    return map;
  }, [groupedThreads]);

  const visibleProjects = useMemo(() => {
    const latestOf = (path: string) => {
      const list = threadsByProject.get(path);
      return list && list.length ? Math.max(...list.map((thread) => thread.updatedAt)) : 0;
    };
    return [...projects].sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      if ((a.path === workspace) !== (b.path === workspace)) return a.path === workspace ? -1 : 1;
      return latestOf(b.path) - latestOf(a.path);
    });
  }, [projects, threadsByProject, workspace]);

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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects.slice(0, 60)));
    } catch {
      /* 配额不足时忽略，不影响使用 */
    }
  }, [projects]);

  // 迁移/补齐：把已有会话所属的文件夹、以及当前工作区,自动补进项目列表。
  useEffect(() => {
    setProjects((current) => {
      const known = new Set(current.map((project) => project.path));
      const additions: Project[] = [];
      const consider = (path: string) => {
        if (path && !known.has(path)) {
          known.add(path);
          additions.push({ path, name: projectName(path), addedAt: Date.now() });
        }
      };
      for (const thread of threads) consider(thread.workspace);
      if (workspace) consider(workspace);
      return additions.length ? [...current, ...additions] : current;
    });
  }, [threads, workspace]);

  async function refreshPerformance() {
    // 用量本地读取、很快,立即刷新;检查更新走 GitHub 网络可能很慢,放后台,
    // 不让它拖住刷新(否则刷新看着像"点不动")。
    const nextPerformance = await window.whale.getPerformance(modelRef.current);
    setPerformance(nextPerformance);
    void window.whale
      .checkForUpdates()
      .then(setUpdateState)
      .catch(() => {});
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
      window.whale.gitDiff(workspace),
      window.whale.canUndo()
    ]).then(([nextFiles, status, diff, undo]) => {
      setFiles(nextFiles);
      setGitStatus(status);
      setGitDiff(diff);
      setCanUndo(undo.canUndo);
    });
  }, [workspace, running]);

  async function undoLastChange() {
    const confirmed = window.confirm(
      "撤销 AI 上一次的改动？\n\n会把工作区文件还原到上一轮任务开始前的状态（不影响 node_modules 等大目录）。"
    );
    if (!confirmed) return;
    const result = await window.whale.undoLastChange();
    if (!result.ok) {
      setAttachmentError(result.error || "撤销失败");
      return;
    }
    const [nextFiles, status, diff, undo] = await Promise.all([
      window.whale.listFiles(workspace),
      window.whale.gitStatus(workspace),
      window.whale.gitDiff(workspace),
      window.whale.canUndo()
    ]);
    setFiles(nextFiles);
    setGitStatus(status);
    setGitDiff(diff);
    setCanUndo(undo.canUndo);
  }

  useEffect(() => {
    const switched = prevActiveIdRef.current !== activeId;
    prevActiveIdRef.current = activeId;
    if (switched) {
      // 切换任务：恢复该任务自己记住的滚动位置；从未看过的任务才落到底部。
      const saved = scrollPositionsRef.current.get(activeId);
      requestAnimationFrame(() => {
        const element = scrollRef.current;
        if (!element) return;
        element.scrollTop = saved ?? element.scrollHeight;
        handleConversationScroll();
      });
      return;
    }
    if (!stickToBottomRef.current) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: running ? "auto" : "smooth"
      });
    });
  }, [activeThread?.messages, activeId, running]);

  function handleConversationScroll() {
    const element = scrollRef.current;
    if (!element) return;
    scrollPositionsRef.current.set(activeId, element.scrollTop);
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
      // 以"进程真正结束"为唯一准绳:进程还活着就保持"运行中",停止按钮一直可用,
      // 避免中途的 done/error 事件提前关掉运行状态导致无法取消。
      if (event.type === "process_end") {
        setRunning(false);
        activeRunThreadIdRef.current = null;
        window.setTimeout(() => void refreshPerformance(), 500);
      }
    });
  }, []);

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
    setMenuThreadId(null);
  }

  function renameThread(id: string) {
    const current = threads.find((thread) => thread.id === id);
    setRenamingId(id);
    setRenameValue(current?.title || "");
    setMenuThreadId(null);
  }

  function commitRename() {
    const id = renamingId;
    setRenamingId(null);
    if (!id) return;
    const next = renameValue.trim();
    if (!next) return;
    setThreads((value) => value.map((thread) => (thread.id === id ? { ...thread, title: next } : thread)));
  }

  function togglePin(id: string) {
    setThreads((value) =>
      value.map((thread) => (thread.id === id ? { ...thread, pinned: !thread.pinned } : thread))
    );
    setMenuThreadId(null);
  }

  function toggleArchive(id: string) {
    const target = threads.find((thread) => thread.id === id);
    const willArchive = !target?.archived;
    setThreads((value) =>
      value.map((thread) => (thread.id === id ? { ...thread, archived: willArchive } : thread))
    );
    if (willArchive && activeId === id) {
      setActiveId(threads.find((thread) => thread.id !== id && !thread.archived)?.id || "");
    }
    setMenuThreadId(null);
  }

  useEffect(() => {
    if (!menuThreadId) return;
    const close = () => setMenuThreadId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuThreadId]);

  useEffect(() => {
    if (!projectMenuPath) return;
    const close = () => setProjectMenuPath(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [projectMenuPath]);

  async function addProject() {
    const selected = await window.whale.chooseWorkspace();
    if (!selected) return;
    setProjects((current) =>
      current.some((project) => project.path === selected)
        ? current
        : [...current, { path: selected, name: projectName(selected), addedAt: Date.now() }]
    );
    setWorkspace(selected);
  }

  async function newChatInProject(path: string) {
    const result = await window.whale.setWorkspace(path);
    if (!result.ok || !result.workspace) return;
    setWorkspace(result.workspace);
    createThread(result.workspace);
  }

  function openProjectFolder(path: string) {
    void window.whale.openFolder(path);
    setProjectMenuPath(null);
  }

  function startProjectRename(path: string) {
    const project = projects.find((item) => item.path === path);
    setProjectRenamingPath(path);
    setProjectRenameValue(project?.name || projectName(path));
    setProjectMenuPath(null);
  }

  function commitProjectRename() {
    const path = projectRenamingPath;
    setProjectRenamingPath(null);
    if (!path) return;
    const next = projectRenameValue.trim();
    if (!next) return;
    setProjects((current) =>
      current.map((project) => (project.path === path ? { ...project, name: next } : project))
    );
  }

  function togglePinProject(path: string) {
    setProjects((current) =>
      current.map((project) =>
        project.path === path ? { ...project, pinned: !project.pinned } : project
      )
    );
    setProjectMenuPath(null);
  }

  function removeProject(path: string) {
    setProjectMenuPath(null);
    const confirmed = window.confirm(
      "从列表移除这个项目？\n\n会一并移除它下面的所有对话记录（不会删除磁盘上的文件夹）。"
    );
    if (!confirmed) return;
    setProjects((current) => current.filter((project) => project.path !== path));
    setThreads((current) => current.filter((thread) => thread.workspace !== path));
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

  function renderThreadRow(thread: Thread) {
    return (
      <div
        key={thread.id}
        role="button"
        tabIndex={0}
        className={clsx("thread-row", activeId === thread.id && "active")}
        onClick={() => {
          if (renamingId === thread.id) return;
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
          {renamingId === thread.id ? (
            <input
              className="thread-rename-input"
              autoFocus
              value={renameValue}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => setRenameValue(event.target.value)}
              onBlur={commitRename}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") commitRename();
                if (event.key === "Escape") setRenamingId(null);
              }}
            />
          ) : (
            <strong>
              {thread.pinned ? <IconPin size={12} className="pin-badge" /> : null}
              {thread.title}
            </strong>
          )}
          <small>{shortPath(thread.workspace)}</small>
        </span>
        <span
          className="thread-menu-trigger"
          role="button"
          onClick={(event) => {
            event.stopPropagation();
            setMenuThreadId(menuThreadId === thread.id ? null : thread.id);
          }}
        >
          <IconDots size={16} />
        </span>
        {menuThreadId === thread.id ? (
          <div className="thread-menu" onClick={(event) => event.stopPropagation()}>
            <span
              role="button"
              onClick={(event) => {
                event.stopPropagation();
                renameThread(thread.id);
              }}
            >
              <IconPencil size={14} />
              重命名
            </span>
            <span
              role="button"
              onClick={(event) => {
                event.stopPropagation();
                togglePin(thread.id);
              }}
            >
              <IconPin size={14} />
              {thread.pinned ? "取消置顶" : "置顶"}
            </span>
            <span
              role="button"
              onClick={(event) => {
                event.stopPropagation();
                toggleArchive(thread.id);
              }}
            >
              <IconArchive size={14} />
              归档
            </span>
            <span
              className="danger"
              role="button"
              onClick={(event) => {
                event.stopPropagation();
                deleteThread(thread.id);
              }}
            >
              <IconTrash size={14} />
              移除
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={clsx("app-shell", !leftOpen && "no-left", !rightOpen && "no-right")}>
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
        <button className="new-thread-button" onClick={() => void addProject()}>
          <IconFolderPlus size={17} />
          添加项目
        </button>
        <div className="sidebar-section-title">
          <span>项目</span>
          <IconSearch size={14} />
        </div>
        <div className="thread-list">
          {visibleProjects.map((project) => {
            const collapsed = collapsedProjects.has(project.path);
            const projectThreads = threadsByProject.get(project.path) || [];
            return (
              <div className="project-group" key={project.path}>
                <div
                  className={clsx("project-header", project.path === workspace && "active")}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (projectRenamingPath === project.path) return;
                    setCollapsedProjects((prev) => {
                      const next = new Set(prev);
                      if (next.has(project.path)) next.delete(project.path);
                      else next.add(project.path);
                      return next;
                    });
                  }}
                >
                  <IconChevronDown
                    size={13}
                    className={clsx("project-chevron", collapsed && "collapsed")}
                  />
                  <IconFolder size={14} />
                  {projectRenamingPath === project.path ? (
                    <input
                      className="thread-rename-input"
                      autoFocus
                      value={projectRenameValue}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => setProjectRenameValue(event.target.value)}
                      onBlur={commitProjectRename}
                      onKeyDown={(event) => {
                        event.stopPropagation();
                        if (event.key === "Enter") commitProjectRename();
                        if (event.key === "Escape") setProjectRenamingPath(null);
                      }}
                    />
                  ) : (
                    <span className="project-name">
                      {project.pinned ? <IconPin size={11} className="pin-badge" /> : null}
                      {project.name}
                    </span>
                  )}
                  <span className="project-count">{projectThreads.length}</span>
                  <span
                    className="thread-menu-trigger"
                    role="button"
                    title="在此项目下新建对话"
                    onClick={(event) => {
                      event.stopPropagation();
                      void newChatInProject(project.path);
                    }}
                  >
                    <IconMessageCirclePlus size={15} />
                  </span>
                  <span
                    className="thread-menu-trigger"
                    role="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setProjectMenuPath(projectMenuPath === project.path ? null : project.path);
                    }}
                  >
                    <IconDots size={16} />
                  </span>
                  {projectMenuPath === project.path ? (
                    <div
                      className="thread-menu project-menu"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <span
                        role="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openProjectFolder(project.path);
                        }}
                      >
                        <IconFolderOpen size={14} />
                        在资源管理器中打开
                      </span>
                      <span
                        role="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          startProjectRename(project.path);
                        }}
                      >
                        <IconPencil size={14} />
                        重命名
                      </span>
                      <span
                        role="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          togglePinProject(project.path);
                        }}
                      >
                        <IconPin size={14} />
                        {project.pinned ? "取消置顶" : "置顶"}
                      </span>
                      <span
                        className="danger"
                        role="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeProject(project.path);
                        }}
                      >
                        <IconTrash size={14} />
                        移除项目
                      </span>
                    </div>
                  ) : null}
                </div>
                {collapsed ? null : projectThreads.map((thread) => renderThreadRow(thread))}
              </div>
            );
          })}
          {archivedThreads.length ? (
            <div className="archived-section">
              <button
                className="archived-toggle"
                onClick={() => setArchivedOpen((open) => !open)}
              >
                <IconArchive size={13} />
                已归档（{archivedThreads.length}）
                <IconChevronDown
                  size={13}
                  className={clsx("archived-chevron", archivedOpen && "open")}
                />
              </button>
              {archivedOpen
                ? archivedThreads.map((thread) => (
                    <div className="archived-row" key={thread.id}>
                      <span className="thread-copy">
                        <strong>{thread.title}</strong>
                      </span>
                      <span
                        role="button"
                        title="取消归档"
                        onClick={() => toggleArchive(thread.id)}
                      >
                        <IconArchiveOff size={14} />
                      </span>
                      <span
                        role="button"
                        title="移除"
                        onClick={() => deleteThread(thread.id)}
                      >
                        <IconTrash size={14} />
                      </span>
                    </div>
                  ))
                : null}
            </div>
          ) : null}
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
              title="查看累计花费与用量"
            >
              <span>累计</span>
              <strong>¥{(performance?.usage.totals.cost_cny ?? 0).toFixed(2)}</strong>
            </button>
            <span className={clsx("mode-dot", mode)} title="安全等级:绿=只看不改 · 黄=改前问我 · 红=放手干" />
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value)}
              title="只看不改：只分析、绝不动你的文件；改前问我（推荐）：每次改文件或跑命令前征求你同意；放手干：在项目内自己动手、不打扰你"
            >
              <option value="plan">只看不改</option>
              <option value="agent">改前问我</option>
              <option value="yolo">放手干</option>
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
              {recentThreads.length > 0 ? (
                <div className="empty-recent">
                  <div className="empty-recent-head">
                    <IconHistory size={13} />
                    最近的任务
                  </div>
                  <div className="empty-recent-list">
                    {recentThreads.map((thread) => (
                      <button
                        key={thread.id}
                        className="empty-recent-item"
                        onClick={() => openThread(thread)}
                      >
                        <strong>{thread.title}</strong>
                        <small>{shortPath(thread.workspace)}</small>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="message-stack">
              {activeThread.messages.map((message, index) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isStreaming={
                    running &&
                    message.role === "assistant" &&
                    index === activeThread.messages.length - 1
                  }
                />
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
                <span title="改这个用顶部的模式下拉框">
                  <IconCode size={14} />
                  {mode === "plan"
                    ? "只看不改"
                    : mode === "yolo"
                      ? "放手干 · 不问你"
                      : "改动前会问你"}
                </span>
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
            {canUndo ? (
              <button
                className="undo-button"
                onClick={() => void undoLastChange()}
                title="把工作区还原到上一轮 AI 改动之前"
              >
                <IconArrowBackUp size={15} />
                撤销 AI 上次改动
              </button>
            ) : null}
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
                <span className="panel-caption">USAGE</span>
                <strong>花费与用量</strong>
              </div>
              <button className="icon-button" onClick={() => void refreshPerformance()}>
                <IconRefresh size={16} />
              </button>
            </div>
            <div className="cost-score">
              <span>累计花费 · 估算</span>
              <strong>¥{(performance?.usage.totals.cost_cny ?? 0).toFixed(4)}</strong>
              <small>按典型缓存命中（约 90%）估算，近似真实花费，非账单</small>
              <button
                className="reset-usage"
                onClick={async () => {
                  const ok = window.confirm(
                    "把累计花费和用量清零吗？\n\n只清这个统计数字，不影响你的对话、项目或账户余额。"
                  );
                  if (!ok) return;
                  await window.whale.resetUsage();
                  await refreshPerformance();
                }}
              >
                清零累计
              </button>
            </div>
            <div className="metric-grid">
              <div>
                <span>完成轮次</span>
                <strong>{performance?.usage.totals.turns || 0}</strong>
              </div>
              <div>
                <span>Token 用量（输入 / 输出）</span>
                <strong>
                  {(performance?.usage.totals.input_tokens || 0).toLocaleString()} /{" "}
                  {(performance?.usage.totals.output_tokens || 0).toLocaleString()}
                </strong>
              </div>
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
              {updateState?.error ? (
                <p className="update-note">暂时无法联网检查更新（网络受限），当前版本可正常使用。</p>
              ) : null}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
