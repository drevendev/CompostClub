import type { ProviderSnapshot } from '../src/domain/coherent/provider';
import type { Workspace } from '../src/domain/coherent/types';
export interface CoherentCommand {
  op: string;
  [key: string]: unknown;
}
export interface ImportPreview {
  id: string;
  garden: string;
  revision: number;
  files: { name: string; bytesBase64: string; text: string; hash: string }[];
  items: {
    title: string;
    text: string;
    file: number;
    duplicate: 'exact' | 'similar title' | 'new';
    existing: string | null;
  }[];
}
export interface CoherentView {
  telemetry?: { enabled: boolean };
  claudeConnection?: {
    state: 'unchecked' | 'checking' | 'ready' | 'failed';
    model: string;
    version: string;
  };
  claudeToken?: { available: boolean; present: boolean };
  provider?: ProviderSnapshot & { credentialAvailable: boolean; credentialPresent: boolean };
  remotePreview?: {
    id: string;
    expires: number;
    garden: string;
    provider: ProviderSnapshot;
    context: string;
    sections: { title: string; text: string }[];
    objective: string;
    draft: import('../src/domain/coherent/types').Draft | null;
    prompt: string;
    calls: number;
    donorGardens: string[];
  } | null;
  eureka: { garden: string; reason: string }[];
  workspace: Workspace;
  busy: boolean;
  status: 'paused' | 'pausing' | 'running' | 'waiting' | 'attention';
  reason: string;
  activeJob: string | null;
  preview: ImportPreview | null;
  backups: { id: number; at: number; reason: string; bytes: number; sha: string }[];
  receiptCount: number;
  dataDirectory: string;
  model: { connected: boolean; digest: string; pid?: number };
  error?: string;
  exportStatus: { generation: string; at: number; count: number } | null;
  autostart: boolean;
}
export interface CoherentAPI {
  invoke(command: CoherentCommand): Promise<CoherentView>;
  subscribe(callback: (view: CoherentView) => void): () => void;
}
