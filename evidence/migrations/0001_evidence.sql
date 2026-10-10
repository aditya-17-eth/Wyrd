CREATE TABLE captures(id INTEGER PRIMARY KEY AUTOINCREMENT,event_key TEXT NOT NULL,started_at INTEGER NOT NULL,completed_at INTEGER NOT NULL,status TEXT NOT NULL,response_hash TEXT,manifest_hash TEXT NOT NULL,detail TEXT);
CREATE INDEX captures_by_event ON captures(event_key,id);
CREATE TABLE snapshots(event_key TEXT PRIMARY KEY,manifest_hash TEXT NOT NULL);
CREATE TABLE capture_locks(event_key TEXT PRIMARY KEY,token TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE authorizations(hash TEXT PRIMARY KEY,expires_at INTEGER NOT NULL);
