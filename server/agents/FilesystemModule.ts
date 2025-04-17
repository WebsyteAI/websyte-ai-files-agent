// websyte-ai-files-agent/server/agents/FilesystemModule.ts
import type { AgentState, FileRecord } from "../types";

export class FilesystemModule {
  state: AgentState;

  constructor(state: AgentState) {
    this.state = state;
  }

  getFileSystem(): Record<string, FileRecord> {
    return this.state.files || {};
  }

  setFiles(files: Record<string, FileRecord>) {
    this.state.files = files;
  }

  createOrUpdateFile(path: string, content: string) {
    const files = { ...(this.state.files || {}) };
    const now = new Date().toISOString();
    const fileExists = path in files;
    if (fileExists) {
      files[path] = {
        ...files[path],
        content,
        modified: now,
      };
    } else {
      files[path] = {
        content,
        created: now,
        modified: now,
      };
    }
    this.state.files = files;
    return fileExists ? "updated" : "created";
  }

  deleteFile(path: string): boolean {
    const files = { ...(this.state.files || {}) };
    if (!files[path]) {
      return false;
    }
    delete files[path];
    this.state.files = files;
    return true;
  }
}
