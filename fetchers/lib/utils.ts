/**
 * Shared utilities for all fetchers:
 * - Archive saving (date-partitioned)
 * - Rate-limited fetch with retries
 * - Logging
 */

import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const ARCHIVE_ROOT = join(import.meta.dir, "..", "..", "archive");

/** Returns today as YYYY-MM-DD */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Save JSON data to archive/YYYY-MM-DD/source/filename.json */
export function saveArchive(source: string, filename: string, data: unknown): string {
  const dir = join(ARCHIVE_ROOT, today(), source);
  mkdirSync(dir, { recursive: true });
  const fpath = join(dir, filename.endsWith(".json") ? filename : `${filename}.json`);
  const envelope = {
    _meta: {
      fetchedAt: new Date().toISOString(),
      source,
      file: filename,
    },
    data,
  };
  writeFileSync(fpath, JSON.stringify(envelope, null, 2));
  return fpath;
}

/** Save raw text to archive */
export function saveArchiveRaw(source: string, filename: string, content: string): string {
  const dir = join(ARCHIVE_ROOT, today(), source);
  mkdirSync(dir, { recursive: true });
  const fpath = join(dir, filename);
  writeFileSync(fpath, content);
  return fpath;
}

/** Console log with source prefix */
export function log(source: string, msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [${source}] ${msg}`);
}

/** Sleep ms */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Fetch with retries, rate-limit delay, and error handling */
export async function fetchJSON(
  url: string,
  opts: {
    headers?: Record<string, string>;
    method?: string;
    body?: string;
    delayMs?: number;
    retries?: number;
    source?: string;
  } = {}
): Promise<any> {
  const { headers, method = "GET", body, delayMs = 0, retries = 2, source = "" } = opts;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (delayMs > 0) await sleep(delayMs);

      const res = await fetch(url, {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...headers,
        },
        ...(body ? { body } : {}),
      });

      if (res.status === 429) {
        const wait = Math.min(60000, (attempt + 1) * 10000);
        log(source, `Rate limited on ${url}, waiting ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }

      if (!res.ok) {
        log(source, `HTTP ${res.status} on ${url}`);
        if (attempt < retries) {
          await sleep(2000 * (attempt + 1));
          continue;
        }
        return null;
      }

      return await res.json();
    } catch (err: any) {
      log(source, `Error fetching ${url}: ${err.message}`);
      if (attempt < retries) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      return null;
    }
  }
  return null;
}

/** Batch array into chunks */
export function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/** Get env var or return undefined */
export function env(key: string): string | undefined {
  return process.env[key];
}

/** Get env var or throw */
export function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

/** Check if API key is available */
export function hasKey(key: string): boolean {
  return !!process.env[key];
}
