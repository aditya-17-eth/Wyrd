import fs from 'node:fs/promises';
const names=['MockUSDC','AegisPolicyManager','AegisUnderwritingVault','DemoWeatherResolver'];
const output={}; const deploy={};
for(const name of names){const artifact=JSON.parse(await fs.readFile(new URL(`../contracts/out/${name}.sol/${name}.json`,import.meta.url),'utf8')); output[name]=artifact.abi; deploy[name]={abi:artifact.abi,bytecode:artifact.bytecode.object.startsWith('0x')?artifact.bytecode.object:`0x${artifact.bytecode.object}`};}
await fs.mkdir(new URL('../web/lib/generated/',import.meta.url),{recursive:true}); await fs.mkdir(new URL('../evidence/src/generated/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../web/lib/generated/abis.ts',import.meta.url),`export const abis = ${JSON.stringify(output)} as const;\n`);
await fs.writeFile(new URL('../evidence/src/generated/abis.mjs',import.meta.url),`export const abis = ${JSON.stringify(output)};\n`);
await fs.copyFile(new URL('../evidence/src/core.mjs',import.meta.url),new URL('../web/lib/generated/core.mjs',import.meta.url));
for(const file of ['weather-client.mjs','weather-client.d.mts'])await fs.copyFile(new URL(`../evidence/src/${file}`,import.meta.url),new URL(`../web/lib/generated/${file}`,import.meta.url));
const eventHelper=await fs.readFile(new URL('./event-bundle.mjs',import.meta.url),'utf8');
await fs.writeFile(new URL('../web/lib/generated/event-bundle.mjs',import.meta.url),eventHelper.replace('../evidence/src/core.mjs','./core.mjs'));
await fs.mkdir(new URL('../.local/',import.meta.url),{recursive:true}); await fs.writeFile(new URL('../.local/artifacts.json',import.meta.url),JSON.stringify(deploy));
console.log('ABIs exported; deployment bytecode is kept in .local.');
