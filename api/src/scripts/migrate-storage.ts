/**
 * One-time copy of every object in the old Supabase Storage buckets
 * (partner-logos, avatars, student-documents) into the new object storage
 * (local volume or S3, per STORAGE_DRIVER), then rewrites the public URLs
 * saved in ngo_partners.logo_url / school_partners.logo_url / users.avatar_url
 * to the API's /api/v1/files/... paths. student_documents.file_path values
 * are bucket-relative and need no change. Safe to re-run: existing objects
 * are skipped.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MIGRATION_DATABASE_URL
 *      (+ the usual STORAGE_* / S3_* variables)
 */
import { Client } from "pg";
import { contentTypeFor, storage } from "../storage";

const BUCKETS = ["partner-logos", "avatars", "student-documents"];

const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey };

type Entry = { name: string; id: string | null };

async function listAll(bucket: string, prefix = ""): Promise<string[]> {
  const files: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${supabaseUrl}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: "name", order: "asc" } }),
    });
    if (!res.ok) throw new Error(`list ${bucket}/${prefix}: ${res.status} ${await res.text()}`);
    const entries = (await res.json()) as Entry[];
    for (const entry of entries) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) files.push(...(await listAll(bucket, full))); // folder
      else if (entry.name !== ".emptyFolderPlaceholder") files.push(full);
    }
    if (entries.length < 1000) return files;
  }
}

async function main() {
  if (!supabaseUrl || !serviceKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  await storage.init();

  for (const bucket of BUCKETS) {
    const paths = await listAll(bucket);
    console.log(`[storage] ${bucket}: ${paths.length} object(s)`);
    let copied = 0;
    for (const path of paths) {
      const key = `${bucket}/${path}`;
      if (await storage.get(key).then((o) => { o?.body.destroy(); return !!o; }).catch(() => false)) continue;
      const res = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`, { headers });
      if (!res.ok) {
        console.warn(`  ! ${key}: ${res.status}`);
        continue;
      }
      const data = Buffer.from(await res.arrayBuffer());
      await storage.put(key, data, res.headers.get("content-type") ?? contentTypeFor(key));
      copied++;
    }
    console.log(`  copied ${copied}`);
  }

  const dbUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log("[storage] no MIGRATION_DATABASE_URL; skipping URL rewrite");
    return;
  }
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  const oldPrefix = `${supabaseUrl}/storage/v1/object/public/`;
  for (const [table, column] of [
    ["ngo_partners", "logo_url"],
    ["school_partners", "logo_url"],
    ["users", "avatar_url"],
  ]) {
    const result = await client.query(
      `update ${table} set ${column} = '/api/v1/files/' || substr(${column}, length($1) + 1) where ${column} like $1 || '%'`,
      [oldPrefix],
    );
    console.log(`[storage] rewrote ${result.rowCount} ${table}.${column} URL(s)`);
  }
  await client.end();
}

main().catch((error) => {
  console.error("[storage] failed:", error);
  process.exit(1);
});
