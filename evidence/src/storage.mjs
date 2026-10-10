import {hashBytes} from './core.mjs';
export class EvidenceStore {
  constructor(bucket,db){this.bucket=bucket;this.db=db;}
  async put(hash,body,type='application/json') {
    if(hashBytes(body)!==hash) throw new Error('Object hash mismatch');
    const existing=await this.bucket.get(hash);
    if(existing) { const old=new Uint8Array(await existing.arrayBuffer()); if(hashBytes(old)!==hash) throw new Error('Stored object failed integrity verification'); return; }
    await this.bucket.put(hash,body,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:type}});
  }
  async get(hash){ return this.bucket.get(hash); }
  async snapshot(key){return this.db.prepare('SELECT manifest_hash FROM snapshots WHERE event_key = ?').bind(key).first();}
  async acquire(key,token,now){
    return this.db.prepare('INSERT INTO capture_locks(event_key, token, expires_at) VALUES (?, ?, ?) ON CONFLICT(event_key) DO UPDATE SET token=excluded.token, expires_at=excluded.expires_at WHERE capture_locks.expires_at < ? RETURNING token').bind(key,token,now+120,now).first();
  }
  async release(key,token){await this.db.prepare('DELETE FROM capture_locks WHERE event_key = ? AND token = ?').bind(key,token).run();}
  async record(key,attempt,manifestHash){
    const statements=[this.db.prepare('INSERT INTO captures(event_key, started_at, completed_at, status, response_hash, manifest_hash, detail) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(key,attempt.startedAt,attempt.completedAt,attempt.status,attempt.responseHash||null,manifestHash,attempt.detail||null)];
    if(attempt.status==='valid') statements.push(this.db.prepare('INSERT INTO snapshots(event_key, manifest_hash) VALUES (?, ?) ON CONFLICT(event_key) DO NOTHING').bind(key,manifestHash));
    await this.db.batch(statements);
  }
  async history(key){const result=await this.db.prepare('SELECT * FROM captures WHERE event_key = ? ORDER BY id').bind(key).all(); return result.results;}
  async consumeAuthorization(hash,expiresAt){const result=await this.db.prepare('INSERT INTO authorizations(hash, expires_at) VALUES (?, ?) ON CONFLICT(hash) DO NOTHING').bind(hash,expiresAt).run();return result.meta.changes===1;}
}
