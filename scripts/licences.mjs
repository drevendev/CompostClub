import { readFile, writeFile } from 'node:fs/promises';
const entries = [
  ['React and React DOM (MIT)', 'node_modules/react/LICENSE'],
  ['Transformers.js (Apache-2.0)', 'node_modules/@huggingface/transformers/LICENSE'],
  ['ONNX Runtime (MIT)', 'public/ONNX-RUNTIME-LICENSE.txt'],
];
const content = [];
for (const [name, file] of entries)
  content.push(name + '\n' + '='.repeat(name.length) + '\n\n' + (await readFile(file, 'utf8')));
await writeFile('public/THIRD_PARTY_LICENSES.txt', content.join('\n\n') + '\n');
