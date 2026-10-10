import {http} from 'viem';import {rpcLane} from './rpc-queue.mjs';
export function pacedHttp(url:string,{local=false}:{local?:boolean}={}){
  const transport=http(url,{timeout:10000,retryCount:0});
  return (config:Parameters<typeof transport>[0])=>{const inner=transport(config);const lane=rpcLane(url,{local});return{...inner,request:((args:Parameters<typeof inner.request>[0])=>lane.request(()=>inner.request(args))) as typeof inner.request};};
}
