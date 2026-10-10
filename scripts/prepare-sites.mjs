import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));const site=process.argv[2];if(!['web','evidence'].includes(site))throw new Error('Choose web or evidence');
const source=path.join(root,site),target=path.join(root,'.local',`publish-${site}`);await fs.mkdir(target,{recursive:true});
const excluded=new Set(['node_modules','.next','out','dist','.git','.wrangler','test','next-env.d.ts']);
async function copy(from,to){for(const entry of await fs.readdir(from,{withFileTypes:true})){if(excluded.has(entry.name)||entry.name.startsWith('.env')||entry.name.endsWith('.tsbuildinfo'))continue;const file=path.join(from,entry.name),destination=path.join(to,entry.name);if(entry.isSymbolicLink())throw new Error('No symlinks in publication source');if(entry.isDirectory()){await fs.mkdir(destination,{recursive:true});await copy(file,destination);}else await fs.copyFile(file,destination);}}
await copy(source,target);await fs.writeFile(path.join(target,'.gitignore'),'node_modules/\n.next/\nout/\ndist/\n.env*\n*.tsbuildinfo\n.sites-runtime/\n');console.log(target);
