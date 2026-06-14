import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { join } from 'path';
import { app } from 'electron';
import { readFileSync, writeFileSync } from 'fs';

let db: SqlJsDatabase | null = null;
let dbPath: string | null = null;
let initPromise: Promise<void> | null = null;

function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const SQL = await initSqlJs();
      dbPath = join(app.getPath('userData'), 'videoforge.db');

      let buffer: Buffer | undefined;
      try {
        buffer = readFileSync(dbPath);
      } catch {
        buffer = undefined;
      }

      db = buffer ? new SQL.Database(buffer) : new SQL.Database();
      db.run('PRAGMA journal_mode = WAL');
      initTables(db);
      persist();
    })();
  }

  return initPromise;
}

function persist(): void {
  if (!db || !dbPath) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(dbPath, buffer);
}

function getSqlValue(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }
  if (value && typeof value === 'object' && 'toJSON' in (value as Record<string, unknown>)) {
    return (value as { toJSON: () => unknown }).toJSON();
  }
  return value;
}

export async function initDatabase(): Promise<void> {
  await ensureInit();
}

export async function getDb(): Promise<SqlJsDatabase> {
  await ensureInit();
  return db!;
}

export async function insertTask(task: Record<string, unknown>): Promise<void> {
  const sqlite = await getDb();
  const stmt = sqlite.prepare(`
    INSERT INTO tasks (id, mode, status, scriptText, avatarPath, audioPath,
      talkingPhotoProviderId, ttsProviderId, asrProviderId,
      talkingPhotoConfig, ttsConfig, asrConfig, createdAt, updatedAt, logFilePath)
    VALUES ($id, $mode, $status, $scriptText, $avatarPath, $audioPath,
      $talkingPhotoProviderId, $ttsProviderId, $asrProviderId,
      $talkingPhotoConfig, $ttsConfig, $asrConfig, $createdAt, $updatedAt, $logFilePath)
  `);

  stmt.bind({
    $id: task.id,
    $mode: task.mode,
    $status: task.status,
    $scriptText: getSqlValue(task.scriptText),
    $avatarPath: getSqlValue(task.avatarPath),
    $audioPath: getSqlValue(task.audioPath),
    $talkingPhotoProviderId: getSqlValue(task.talkingPhotoProviderId),
    $ttsProviderId: getSqlValue(task.ttsProviderId),
    $asrProviderId: getSqlValue(task.asrProviderId),
    $talkingPhotoConfig: getSqlValue(task.talkingPhotoConfig),
    $ttsConfig: getSqlValue(task.ttsConfig),
    $asrConfig: getSqlValue(task.asrConfig),
    $createdAt: task.createdAt,
    $updatedAt: task.updatedAt,
    $logFilePath: getSqlValue(task.logFilePath)
  });

  stmt.step();
  stmt.free();
  persist();
}

export async function updateTask(id: string, updates: Record<string, unknown>): Promise<void> {
  const sqlite = await getDb();
  const updatedAt = Date.now();
  const keys = Object.keys(updates);
  const assignments = keys.map((key) => `${key} = $${key}`).join(', ');
  const parameters: Record<string, unknown> = {};

  for (const key of keys) {
    parameters[`$${key}`] = getSqlValue(updates[key]);
  }

  parameters['$id'] = id;
  parameters['$updatedAt'] = updatedAt;

  const stmt = sqlite.prepare(`UPDATE tasks SET ${assignments}, updatedAt = $updatedAt WHERE id = $id`);
  stmt.bind(parameters);
  stmt.step();
  stmt.free();
  persist();
}

export async function getTask(id: string): Promise<Record<string, unknown> | undefined> {
  const sqlite = await getDb();
  const stmt = sqlite.prepare('SELECT * FROM tasks WHERE id = $id');
  stmt.bind({ $id: id });

  let result: Record<string, unknown> | undefined;
  if (stmt.step()) {
    result = stmt.getAsObject() as Record<string, unknown>;
  }

  stmt.free();
  return result;
}

export async function getAllTasks(): Promise<Record<string, unknown>[]> {
  const sqlite = await getDb();
  const stmt = sqlite.prepare('SELECT * FROM tasks ORDER BY createdAt DESC');
  stmt.bind();

  const results: Record<string, unknown>[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as Record<string, unknown>);
  }

  stmt.free();
  return results;
}

export async function getSetting(key: string): Promise<string | null> {
  const sqlite = await getDb();
  const stmt = sqlite.prepare('SELECT value FROM settings WHERE key = $key');
  stmt.bind({ $key: key });

  let value: string | null = null;
  if (stmt.step()) {
    const row = stmt.getAsObject() as { value?: string };
    value = row.value ?? null;
  }

  stmt.free();
  return value;
}

export async function saveSetting(key: string, value: string): Promise<void> {
  const sqlite = await getDb();
  const stmt = sqlite.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ($key, $value)');
  stmt.bind({ $key: key, $value: value });
  stmt.step();
  stmt.free();
  persist();
}

function initTables(sqlite: SqlJsDatabase): void {
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      mode TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      scriptText TEXT,
      avatarPath TEXT,
      audioPath TEXT,
      outputVideoPath TEXT,
      didVideoPath TEXT,
      subtitleSrtPath TEXT,
      talkingPhotoProviderId TEXT,
      ttsProviderId TEXT,
      asrProviderId TEXT,
      talkingPhotoConfig TEXT,
      ttsConfig TEXT,
      asrConfig TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      errorMessage TEXT,
      logFilePath TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS ai_services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      api_key TEXT,
      endpoint TEXT,
      model TEXT,
      models_list TEXT,
      is_default INTEGER DEFAULT 0,
      protocol TEXT DEFAULT 'chat_completions',
      user_agent TEXT DEFAULT 'VideoForge/1.0',
      enabled INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Migrate: add new columns to existing ai_services table
  const alterStatements = [
    `ALTER TABLE ai_services ADD COLUMN protocol TEXT DEFAULT 'chat_completions'`,
    `ALTER TABLE ai_services ADD COLUMN user_agent TEXT DEFAULT 'VideoForge/1.0'`,
    `ALTER TABLE ai_services ADD COLUMN enabled INTEGER DEFAULT 1`
  ];
  for (const sql of alterStatements) {
    try { sqlite.run(sql); } catch {}
  }
}

export async function getAllAiServices(): Promise<any[]> {
  const sqlite = await getDb();
  const stmt = sqlite.prepare('SELECT * FROM ai_services ORDER BY created_at DESC');
  stmt.bind();
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export async function upsertAiService(service: any): Promise<void> {
  const sqlite = await getDb();
  const stmt = sqlite.prepare(`
    INSERT INTO ai_services (id, name, type, api_key, endpoint, model, models_list, is_default, protocol, user_agent, enabled, created_at, updated_at)
    VALUES ($id, $name, $type, $apiKey, $endpoint, $model, $modelsList, $isDefault, $protocol, $userAgent, $enabled, $createdAt, $updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      name=$name, type=$type, api_key=$apiKey, endpoint=$endpoint, model=$model,
      models_list=$modelsList, is_default=$isDefault, protocol=$protocol, user_agent=$userAgent,
      enabled=$enabled, updated_at=$updatedAt
  `);
  stmt.bind({
    $id: service.id,
    $name: service.name,
    $type: service.type,
    $apiKey: service.apiKey || '',
    $endpoint: service.endpoint || '',
    $model: service.model || '',
    $modelsList: service.modelsList || '[]',
    $isDefault: service.isDefault ? 1 : 0,
    $protocol: service.protocol || 'chat_completions',
    $userAgent: service.userAgent || 'VideoForge/1.0',
    $enabled: service.enabled !== false ? 1 : 0,
    $createdAt: service.createdAt,
    $updatedAt: service.updatedAt
  });
  stmt.step();
  stmt.free();
  persist();
}

export async function deleteAiService(id: string): Promise<void> {
  const sqlite = await getDb();
  const stmt = sqlite.prepare('DELETE FROM ai_services WHERE id = $id');
  stmt.bind({ $id: id });
  stmt.step();
  stmt.free();
  persist();
}

