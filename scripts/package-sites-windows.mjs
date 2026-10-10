// Windows adapter for the Sites shared artifact preparation step; no source or storage mutation.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
const root=await fs.realpath(fileURLToPath(new URL('../',import.meta.url)));
const [site,helper]=process.argv.slice(2);
if(!['web','evidence'].includes(site)||!helper||!path.isAbsolute(helper))throw new Error('Use web|evidence and the absolute Sites prepare-site-build.cjs path.');
const project=await fs.realpath(path.join(root,'.local',`publish-${site}`));
const stage=path.join(root,'.local','era5-package',String(Date.now()),site),archive=path.join(root,'.local',`era5-${site}.tar`);
for(const target of [project,stage,archive]){const relative=path.relative(root,path.resolve(target));if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Packaging targets must stay inside the checkout.');}
await fs.mkdir(stage,{recursive:true});
const destination=path.join(stage,'dist');
const prepared=spawnSync(process.execPath,[helper,project,destination],{encoding:'utf8',windowsHide:true});
if(prepared.status!==0)throw new Error(prepared.stderr||'Sites artifact preparation failed');
const kind=prepared.stdout.trim();
const source=JSON.parse(await fs.readFile(path.join(project,'.openai','hosting.json'),'utf8'));
let built={};try{built=JSON.parse(await fs.readFile(path.join(project,'dist','.openai','hosting.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
if(source.artifact_metadata!=null&&built.artifact_metadata!=null&&!isDeepStrictEqual(source.artifact_metadata,built.artifact_metadata))throw new Error('Conflicting artifact attribution');
const metadata=path.join(destination,'.openai','hosting.json');
const staged=kind==='worker'?source:JSON.parse(await fs.readFile(metadata,'utf8'));
const attribution=built.artifact_metadata??source.artifact_metadata;if(attribution!=null)staged.artifact_metadata=attribution;
await fs.mkdir(path.dirname(metadata),{recursive:true});await fs.writeFile(metadata,JSON.stringify(staged,null,2));
try{if((await fs.stat(path.join(project,'drizzle'))).isDirectory())await fs.cp(path.join(project,'drizzle'),path.join(destination,'.openai','drizzle'),{recursive:true});}catch(error){if(error.code!=='ENOENT')throw error;}
const packed=spawnSync('tar.exe',['-C',stage,'-czf',archive,'dist'],{encoding:'utf8',windowsHide:true});if(packed.status!==0)throw new Error(packed.stderr||'Native tar packaging failed');
const list=spawnSync('tar.exe',['-tzf',archive],{encoding:'utf8',windowsHide:true});if(list.status!==0||!list.stdout.split(/\r?\n/).includes('dist/.openai/hosting.json'))throw new Error('Archive is missing its Sites manifest');
const bytes=await fs.readFile(archive);console.log(JSON.stringify({archive,kind,project_id:source.project_id,size_bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}));
