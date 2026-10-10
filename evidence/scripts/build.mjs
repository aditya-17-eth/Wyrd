import {build} from 'esbuild';import fs from 'node:fs/promises';
await fs.mkdir('dist/server',{recursive:true});await fs.mkdir('dist/.openai/migrations',{recursive:true});
await build({entryPoints:['worker/index.mjs'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');await fs.copyFile('migrations/0001_evidence.sql','dist/.openai/migrations/0001_evidence.sql');
await fs.cp('drizzle','dist/.openai/drizzle',{recursive:true});
console.log('Independent evidence Worker built.');
