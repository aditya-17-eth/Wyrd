export function isRateLimitError(error){
  let current=error;for(let depth=0;current&&depth<8;++depth){if(current.code===429||current.status===429||/429|requests limited|rate.?limit|too many requests/i.test(String(current.message||current.details||'')))return true;current=current.cause;}return false;
}
export class RpcLane{
  constructor({intervalMs=250,retries=2,clock=()=>Date.now(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){this.intervalMs=intervalMs;this.retries=retries;this.clock=clock;this.sleep=sleep;this.nextStart=0;this.cooldownUntil=0;this.queue=[];this.draining=false;}
  async request(operation){for(let attempt=0;;++attempt){try{return await this.enqueue(operation);}catch(error){if(!isRateLimitError(error)||attempt>=this.retries)throw error;this.cooldownUntil=Math.max(this.cooldownUntil,this.clock()+2000*2**attempt);}}}
  enqueue(operation){return new Promise((resolve,reject)=>{this.queue.push({operation,resolve,reject});void this.drain();});}
  async drain(){if(this.draining)return;this.draining=true;try{while(this.queue.length){while(this.clock()<Math.max(this.nextStart,this.cooldownUntil))await this.sleep(Math.max(this.nextStart,this.cooldownUntil)-this.clock());const task=this.queue.shift();this.nextStart=this.clock()+this.intervalMs;try{Promise.resolve(task.operation()).then(task.resolve,task.reject);}catch(error){task.reject(error);}}}finally{this.draining=false;if(this.queue.length)void this.drain();}}
}
const lanes=new Map();
export function rpcLane(url,{local=false}={}){const parsed=new URL(url);const loopback=local&&['127.0.0.1','localhost','[::1]'].includes(parsed.hostname);const key=parsed.href;if(!lanes.has(key))lanes.set(key,new RpcLane({intervalMs:loopback?0:250}));return lanes.get(key);}
