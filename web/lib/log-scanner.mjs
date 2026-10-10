// Monad's public endpoint allows at most 100 blocks per eth_getLogs request.
// Keep each successful page, so a transient failure resumes rather than restarting.
export class LogScanner {
  constructor(fromBlock){this.nextBlock=fromBlock;this.logs=[];this.running=null;}
  async scan(toBlock,request){
    while(this.running)await this.running;
    const work=(async()=>{while(this.nextBlock<=toBlock){const fromBlock=this.nextBlock;const end=fromBlock+99n;const pageEnd=end>toBlock?toBlock:end;
      const page=await request({fromBlock,toBlock:pageEnd});this.logs.push(...page);this.nextBlock=pageEnd+1n;
    }return [...this.logs];})();this.running=work;
    try{return await work;}finally{if(this.running===work)this.running=null;}
  }
}
