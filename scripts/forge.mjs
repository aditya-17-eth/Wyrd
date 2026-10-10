import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const executable = process.env.FORGE_BIN || path.join(root, '.tools/foundry', process.platform === 'win32' ? 'forge.exe' : 'forge');
const result = spawnSync(executable, process.argv.slice(2), {cwd:path.join(root,'contracts'), stdio:'inherit'});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
