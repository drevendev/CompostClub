import type { Workspace, ImportPreview } from '../src/domain/experiment';
export type DesktopCommand =
  | {
      op:
        | 'snapshot'
        | 'pause'
        | 'resume'
        | 'connect'
        | 'pickExecutable'
        | 'pickModels'
        | 'pickExport'
        | 'chooseImport'
        | 'cancelImport'
        | 'backup'
        | 'restore'
        | 'export'
        | 'openExport'
        | 'openData';
    }
  | { op: 'add'; text: string; title: string; tags: string; participating: boolean }
  | {
      op: 'editSource';
      id: string;
      text: string;
      title: string;
      tags: string;
      participating: boolean;
    }
  | { op: 'participate'; id: string; value: boolean }
  | { op: 'pasteImport'; text: string }
  | { op: 'acceptImport'; id: string; texts: string[]; tags: string; participating: boolean }
  | {
      op: 'settings';
      intervalMinutes: number;
      dailyCalls: number;
      backlog: number;
      language: 'en' | 'ru';
      tag: string;
      exportScope: 'kept' | 'all';
      model: 'gemma3:1b' | 'gemma3:4b';
    }
  | { op: 'review'; id: string; state: 'kept' | 'rejected' | 'later'; note: string }
  | { op: 'editIdea'; id: string; title: string; concept: string }
  | { op: 'run'; parents?: [string, string]; retryId?: string }
  | { op: 'recompost' | 'deleteSource'; id: string }
  | { op: 'tend'; id: string; kind: 'sprout' | 'growth'; direction: string }
  | {
      op: 'growthDecision';
      id: string;
      accept: boolean;
      title: string;
      concept: string;
      experiment: string;
    }
  | { op: 'purgeBackup'; id: number; sha: string }
  | { op: 'purgeOriginal'; id: string }
  | { op: 'cleanupExports' }
  | { op: 'autostart'; enabled: boolean };
export interface DesktopView {
  workspace: Workspace;
  status: 'paused' | 'pausing' | 'running' | 'waiting' | 'attention';
  reason: string;
  busy: boolean;
  model: { connected: boolean; digest: string; pid?: number; checkedAt?: number };
  exportStatus: { generation: string; at: number; count: number } | null;
  preview: ImportPreview | null;
  backups: { id: number; at: number; reason: string; bytes: number; sha: string }[];
  receiptCount: number;
  dataDirectory: string;
  error?: string;
  autostart: boolean;
}
export interface DesktopAPI {
  invoke(command: DesktopCommand): Promise<DesktopView>;
  subscribe(callback: (view: DesktopView) => void): () => void;
}
