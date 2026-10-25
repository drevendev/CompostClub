// External, read-only process-tree observer for a real background acceptance.
// RSS is host memory, not GPU VRAM. This does not establish a no-slowdown claim.
import { readFile, appendFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
const dir = process.argv[2];
if (!dir) throw new Error('Provide an explicitly selected background observation directory.');
const input = path.join(dir, 'acceptance.json'),
  output = path.join(dir, 'process-tree.jsonl');
const script = `
$taskProcesses=@(Get-CimInstance Win32_Process)
$taskIds=[System.Collections.Generic.HashSet[int]]::new()
[void]$taskIds.Add([int]$env:COMPOST_OBSERVE_PID)
do { $taskChanged=$false; foreach($taskProcess in $taskProcesses) { if($taskIds.Contains([int]$taskProcess.ParentProcessId) -and $taskIds.Add([int]$taskProcess.ProcessId)) { $taskChanged=$true } } } while($taskChanged)
@(Get-Process -Id @($taskIds) -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,WorkingSet64,PeakWorkingSet64,CPU) | ConvertTo-Json -Compress
`;
const started = Date.now(),
  seen = new Set<number>();
let last = 0;
while (Date.now() - started < 65 * 60000) {
  let state: { status: string; buildSha256: string; resources: { busy: boolean; pid?: number }[] };
  try {
    state = JSON.parse(await readFile(input, 'utf8'));
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
    continue;
  }
  const sample = state.resources.at(-1);
  if (sample?.pid && sample.busy && Date.now() - last >= 5000) {
    last = Date.now();
    const result = await promisify(execFile)(
      path.join(process.env.SystemRoot!, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
      [
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        Buffer.from(script, 'utf16le').toString('base64'),
      ],
      {
        windowsHide: true,
        env: { ...process.env, COMPOST_OBSERVE_PID: String(sample.pid) },
        timeout: 15000,
      },
    );
    const value = result.stdout.trim() ? JSON.parse(result.stdout) : [];
    const processes = Array.isArray(value) ? value : [value];
    for (const p of processes) seen.add(p.Id);
    await appendFile(
      output,
      JSON.stringify({
        at: Date.now(),
        buildSha256: state.buildSha256,
        root: sample.pid,
        processes,
        label: 'Observed process-tree host RSS; GPU VRAM not measured',
      }) + '\n',
    );
  }
  if (state.status !== 'running') {
    const stillAlive = [...seen].filter((pid) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch (e) {
        return (e as NodeJS.ErrnoException).code !== 'ESRCH';
      }
    });
    await appendFile(
      output,
      JSON.stringify({
        at: Date.now(),
        finalStatus: state.status,
        observedPids: [...seen],
        stillAlive,
      }) + '\n',
    );
    break;
  }
  await new Promise((r) => setTimeout(r, 1000));
}
