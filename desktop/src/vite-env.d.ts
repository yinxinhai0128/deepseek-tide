/// <reference types="vite/client" />

type AgentEvent = {
  type: string;
  content?: string;
  error?: string;
  id?: string;
  name?: string;
  input?: unknown;
  output?: string;
  status?: string;
  meta?: Record<string, unknown>;
  code?: number;
};

type FileNode = {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
};

type Attachment = {
  id: string;
  name: string;
  path: string;
  relativePath: string;
  size: number;
  mime: string;
  isImage: boolean;
  preview?: string | null;
};

interface Window {
  whale: {
    chooseWorkspace(): Promise<string | null>;
    setWorkspace(workspace: string): Promise<{ ok: boolean; workspace?: string; error?: string }>;
    getWorkspace(): Promise<string>;
    chooseAttachments(): Promise<{
      ok: boolean;
      attachments: Attachment[];
      error?: string;
    }>;
    importAttachments(
      sources: Array<{ path?: string; name: string; type?: string; data?: string }>
    ): Promise<{ ok: boolean; attachments: Attachment[]; error?: string }>;
    getPathForFile(file: File): string;
    getStatus(): Promise<{
      installed: boolean;
      authenticated: boolean;
      authSource: string;
      version: string;
      proxy: string | null;
      workspace: string;
      error?: string | null;
    }>;
    getPerformance(model: string): Promise<{
      usage: {
        totals: {
          input_tokens: number;
          output_tokens: number;
          cached_tokens: number | null;
          reasoning_tokens: number | null;
          cost_usd: number | null;
          turns: number;
        };
      };
      usageError?: string | null;
      cache: { hitRate: number | null; label: string };
      profile: {
        fingerprint: string;
        changed: boolean;
        changes: string[];
      };
    }>;
    checkForUpdates(): Promise<{
      ok: boolean;
      current: string;
      latest: string;
      available: boolean;
      output: string;
      error?: string | null;
    }>;
    applyRuntimeUpdate(): Promise<{
      ok: boolean;
      current: string;
      latest: string;
      available: boolean;
      output: string;
      error?: string | null;
    }>;
    saveApiKey(apiKey: string): Promise<{
      ok: boolean;
      status?: {
        installed: boolean;
        authenticated: boolean;
        authSource: string;
        version: string;
        proxy: string | null;
        workspace: string;
        error?: string | null;
      };
      error?: string | null;
    }>;
    clearApiKey(): Promise<{ ok: boolean }>;
    listFiles(workspace: string): Promise<FileNode[]>;
    gitStatus(workspace: string): Promise<string>;
    gitDiff(workspace: string): Promise<string>;
    startTurn(payload: {
      workspace: string;
      prompt: string;
      model: string;
      mode: string;
      sessionId?: string;
    }): Promise<{ ok: boolean; error?: string }>;
    stopTurn(): Promise<{ ok: boolean }>;
    onAgentEvent(listener: (event: AgentEvent) => void): () => void;
    platform: string;
  };
}
