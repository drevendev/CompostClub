import net from 'node:net';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
const args = process.argv.slice(2),
  option = (name) => {
    const i = args.indexOf(name);
    return i < 0 ? '' : (args[i + 1] ?? '');
  };
const directory = option('--data-dir') || process.env.COMPOST_DATA_DIR;
if (!directory)
  throw new Error(
    'Provide --data-dir for the already running personal desktop. No database is edited by this client.',
  );
const file = path.join(path.resolve(directory), 'operator-connection.private.json'),
  info = await lstat(file);
if (!info.isFile() || info.isSymbolicLink())
  throw new Error('Invalid owner operator discovery file.');
const connection = JSON.parse(await readFile(file, 'utf8'));
if (
  connection.format !== 'compost-operator-1' ||
  typeof connection.address !== 'string' ||
  typeof connection.token !== 'string'
)
  throw new Error('Unsupported operator protocol.');
if (
  process.platform === 'win32'
    ? !/^\\\\\.\\pipe\\compost-club-[a-f0-9]{24}$/.test(connection.address)
    : path.dirname(connection.address) !== path.resolve(directory)
)
  throw new Error('Operator address escaped the local application pipe.');
const command = option('--command-file')
  ? JSON.parse(await readFile(option('--command-file'), 'utf8'))
  : option('--command')
    ? JSON.parse(option('--command'))
    : {
        op: args.includes('pause')
          ? 'pause'
          : args.includes('resume')
            ? 'resume'
            : args.includes('exit')
              ? 'exit'
              : 'snapshot',
      };
const result = await new Promise((resolve, reject) => {
  const socket = net.createConnection(connection.address),
    chunks = [];
  let size = 0;
  socket.setTimeout(30000, () =>
    socket.destroy(new Error('Operator response timed out; inspect saved state before retrying.')),
  );
  socket.once('error', reject);
  socket.once('connect', () =>
    socket.write(
      JSON.stringify({
        version: 1,
        token: connection.token,
        command,
        confirm: args.includes('--confirm'),
      }) + '\n',
    ),
  );
  socket.on('data', (chunk) => {
    size += chunk.length;
    if (size > 40 * 1024 * 1024)
      socket.destroy(new Error('Operator response exceeds the structured workspace allowance.'));
    else chunks.push(chunk);
  });
  socket.once('end', () => {
    try {
      resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    } catch (e) {
      reject(e);
    }
  });
});
if (args.includes('--json')) console.log(JSON.stringify(result, null, 2));
else if (result.view) {
  const { workspace: w, ...v } = result.view;
  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        status: v.status,
        reason: v.reason,
        busy: v.busy,
        activeJob: v.activeJob,
        error: result.error ?? null,
        gardens: w.gardens.map((g) => ({
          id: g.id,
          name: g.name,
          profile: g.profile,
          background: g.background,
          intervalMinutes: g.interval,
          nextAt: new Date(g.nextAt).toISOString(),
          credits: g.credits.balance,
          creditCap: g.credits.cap ?? 3,
          exchange: g.policy.probability,
          donate: g.policy.donate,
          donors: g.policy.donors,
          sources: w.sources.filter((s) => s.garden === g.id).length,
        })),
        limits: w.settings,
        cards: w.nodes.length,
        receipts: v.receiptCount,
      },
      null,
      2,
    ),
  );
} else console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
