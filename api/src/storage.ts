import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { config } from "./config";

/**
 * Object storage replacing Supabase Storage. Keys look like
 * `<bucket>/<path>`, e.g. `student-documents/<studentId>/<uuid>.jpg`, so the
 * three former Supabase buckets become prefixes of one store:
 *   - local driver: a directory (a Docker volume in docker-compose)
 *   - s3 driver:    one S3 bucket (IAM role credentials on AWS)
 */
export type StoredObject = { body: Readable; contentType: string; size?: number };

export interface ObjectStorage {
  init(): Promise<void>;
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
}

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
};

export function contentTypeFor(key: string) {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/** Rejects anything that isn't a plain relative path (no traversal, no odd characters). */
export function assertSafeKey(key: string) {
  if (!/^[A-Za-z0-9._\-/]+$/.test(key) || key.split("/").some((part) => part === "" || part === "." || part === "..")) {
    throw new Error("Invalid storage key");
  }
}

class LocalStorage implements ObjectStorage {
  constructor(private readonly root: string) {}

  async init() {
    await mkdir(this.root, { recursive: true });
  }

  private resolve(key: string) {
    assertSafeKey(key);
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Invalid storage key");
    return full;
  }

  async put(key: string, data: Buffer) {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data, { flag: "wx" }); // never overwrite: paths are random UUIDs
  }

  async get(key: string) {
    const full = this.resolve(key);
    try {
      const info = await stat(full);
      if (!info.isFile()) return null;
      return { body: createReadStream(full), contentType: contentTypeFor(key), size: info.size };
    } catch {
      return null;
    }
  }
}

class S3Storage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly bucket: string) {
    this.client = new S3Client({
      region: config.storage.s3Region,
      endpoint: config.storage.s3Endpoint,
      forcePathStyle: config.storage.s3ForcePathStyle,
      // Credentials come from the default provider chain: IAM role on EC2/ECS,
      // or AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars.
    });
  }

  async init() {
    if (!this.bucket) throw new Error("S3_BUCKET is required when STORAGE_DRIVER=s3");
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      if (process.env.S3_AUTO_CREATE_BUCKET === "true") {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      } else {
        throw error;
      }
    }
  }

  async put(key: string, data: Buffer, contentType: string) {
    assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType }),
    );
  }

  async get(key: string) {
    assertSafeKey(key);
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!result.Body) return null;
      return {
        body: result.Body as Readable,
        contentType: result.ContentType ?? contentTypeFor(key),
        size: result.ContentLength,
      };
    } catch (error) {
      const name = (error as { name?: string }).name;
      if (name === "NoSuchKey" || name === "NotFound") return null;
      throw error;
    }
  }
}

export const storage: ObjectStorage =
  config.storage.driver === "s3" ? new S3Storage(config.storage.s3Bucket) : new LocalStorage(config.storage.localDir);
