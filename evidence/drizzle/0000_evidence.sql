CREATE TABLE captures(id INTEGER PRIMARY KEY AUTOINCREMENT,event_key TEXT NOT NULL,started_at INTEGER NOT NULL,completed_at INTEGER NOT NULL,status TEXT NOT NULL,response_hash TEXT,manifest_hash TEXT NOT NULL,detail TEXT);
--> statement-breakpoint
CREATE INDEX captures_by_event ON captures(event_key,id);
--> statement-breakpoint
CREATE TABLE snapshots(event_key TEXT PRIMARY KEY,manifest_hash TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE capture_locks(event_key TEXT PRIMARY KEY,token TEXT NOT NULL,expires_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE authorizations(hash TEXT PRIMARY KEY,expires_at INTEGER NOT NULL);
