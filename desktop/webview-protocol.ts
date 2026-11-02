import type { CoherentCommand } from './coherent-types';

// The renderer has no access to operator confirmations, shell services or host lifecycle.
const operations = new Set([
  'snapshot',
  'configureProvider',
  'configureClaude',
  'configureClaudeModel',
  'configureLocalModel',
  'configureExecutionMode',
  'checkClaude',
  'setClaudeToken',
  'removeClaudeToken',
  'setGroqCredential',
  'removeGroqCredential',
  'saveSensitiveEmergency',
  'confirmRemote',
  'cancelRemote',
  'pause',
  'resume',
  'clearAttention',
  'requestState',
  'eureka',
  'createGarden',
  'renameGarden',
  'reorderGarden',
  'gardenSettings',
  'background',
  'exchange',
  'add',
  'editSource',
  'participate',
  'preparation',
  'facet',
  'alias',
  'reference',
  'removeReference',
  'preference',
  'settings',
  'pickExecutable',
  'pickModels',
  'connect',
  'configureRuntime',
  'configureExport',
  'run',
  'tend',
  'decode',
  'proposePreferences',
  'revise',
  'checkNode',
  'check',
  'override',
  'review',
  'editIdea',
  'recompost',
  'cancelPlan',
  'localOverride',
  'chooseImport',
  'pasteImport',
  'cancelImport',
  'acceptImport',
  'backup',
  'restore',
  'deleteSource',
  'deleteGarden',
  'purgeBackup',
  'purgeOriginal',
  'purgeLegacy',
  'cleanupLifecycle',
  'purgeJob',
  'pickExport',
  'export',
  'openExport',
  'openData',
  'autostart',
  'cleanupExports',
]);

export function rendererCommand(value: unknown): CoherentCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Invalid renderer command.');
  const command = value as CoherentCommand;
  if (
    typeof command.op !== 'string' ||
    !operations.has(command.op) ||
    Buffer.byteLength(JSON.stringify(command)) > 2 * 1024 * 1024
  )
    throw Error('Unsupported renderer command.');
  return command;
}

export const inferenceOperations = new Set([
  'confirmRemote',
  'run',
  'eureka',
  'tend',
  'decode',
  'proposePreferences',
  'revise',
  'checkNode',
  'check',
  'resume',
]);
