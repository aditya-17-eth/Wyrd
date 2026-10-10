import fs from 'node:fs/promises';import {createPublicClient,http,encodeAbiParameters,keccak256} from 'viem';
import {abis} from '../evidence/src/generated/abis.mjs';
const d=JSON.parse(await fs.readFile(new URL('../deployments/monad-testnet.json',import.meta.url),'utf8'));
if(d.chainId!==10143||!d.contracts)throw new Error('Actual Monad Testnet deployment required');
const client=createPublicClient({transport:http(d.rpcUrl)});if(await client.getChainId()!==10143)throw new Error('Wrong chain');
const results=[];
for(const[name,role,args]of [['MockUSDC','token',[]],['AegisPolicyManager','manager',[d.contracts.token,d.wallets.A.toLowerCase()]],['DemoWeatherResolver','resolver',[d.contracts.manager,d.wallets.A.toLowerCase()]]]){
  const artifact=JSON.parse(await fs.readFile(new URL(`../contracts/out/${name}.sol/${name}.json`,import.meta.url),'utf8'));
  const address=d.contracts[role],record=d.transactions.find(t=>t.label===name);if(!record)throw new Error('Missing actual creation receipt');
  const [tx,receipt,code]=await Promise.all([client.getTransaction({hash:record.hash}),client.getTransactionReceipt({hash:record.hash}),client.getCode({address})]);
  if(receipt.status!=='success'||receipt.contractAddress?.toLowerCase()!==address.toLowerCase()||!code)throw new Error('Creation receipt or code mismatch');
  const expectedInput=artifact.bytecode.object+(args.length?encodeAbiParameters([{type:'address'},{type:'address'}],args).slice(2):'');
  if(tx.input.toLowerCase()!==expectedInput.toLowerCase())throw new Error(`${name} creation bytecode/constructor args differ`);
  let normalized=code.slice(2);for(const refs of Object.values(artifact.deployedBytecode.immutableReferences||{}))for(const ref of refs)normalized=normalized.slice(0,ref.start*2)+'0'.repeat(ref.length*2)+normalized.slice((ref.start+ref.length)*2);
  if(normalized.toLowerCase()!==artifact.deployedBytecode.object.replace(/^0x/,'').toLowerCase())throw new Error(`${name} runtime bytecode differs`);
  results.push({name,address,creationInputMatch:true,runtimeBytecodeMatch:true,deployedCodeHash:keccak256(code)});
}
const read=(role,name,functionName)=>client.readContract({address:d.contracts[role],abi:abis[name],functionName});
const [asset,administrator,adapter,authority,manager,eventCap,buyerCap]=await Promise.all([read('manager','AegisPolicyManager','asset'),read('manager','AegisPolicyManager','administrator'),read('manager','AegisPolicyManager','adapter'),read('resolver','DemoWeatherResolver','authority'),read('resolver','DemoWeatherResolver','policyManager'),read('manager','AegisPolicyManager','MAX_EVENT_COVERAGE'),read('manager','AegisPolicyManager','MAX_BUYER_COVERAGE')]);
for(const [actual,expected]of [[asset,d.contracts.token],[administrator,d.wallets.A],[adapter,d.contracts.resolver],[authority,d.wallets.A],[manager,d.contracts.manager]])if(actual.toLowerCase()!==expected.toLowerCase())throw new Error('Contract role binding mismatch');
if(eventCap!==1000_000_000n||buyerCap!==200_000_000n)throw new Error('Protocol exposure ceilings differ');
const output={chainId:10143,checkedAt:new Date().toISOString(),contracts:results,roleBindingsVerified:true,eventCeiling:eventCap.toString(),buyerCeiling:buyerCap.toString()};await fs.writeFile(new URL('../deployments/bytecode-check.json',import.meta.url),JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));
