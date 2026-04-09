#!/usr/bin/env node
/**
 * Downloads all KOL/wallet avatars to site/public/avatars/
 * and rewrites the local data JSON files to use the local paths.
 *
 * Usage: node site/scripts/download-avatars.js
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const PUBLIC_AVATARS = path.join(ROOT, "public", "avatars");
const DATA_DIR = path.join(ROOT, "data");

const DATA_FILES = [
  "x-profiles.json",
  "solwallets.json",
  "bscwallets.json",
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function md5(str) {
  return crypto.createHash("md5").update(str).digest("hex");
}

/** Derive a stable local filename from a URL */
function localName(url, hint) {
  if (!url) return null;
  if (hint) return `${hint.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}.jpg`;
  const parsed = new URL(url);
  const basename = path.basename(parsed.pathname);
  // keep gmgn.ai hash filenames as-is
  if (/^[a-f0-9]{32}\.jpg$/i.test(basename)) return basename;
  // pbs.twimg.com/profile_images/... – use the folder+file
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length >= 2) return `${parts[parts.length - 2]}_${parts[parts.length - 1]}`;
  return `${md5(url)}.jpg`;
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) return resolve("exists");
    const proto = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(dest);
    const req = proto.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; avatar-downloader/1.0)",
          Referer: "https://gmgn.ai/",
        },
        timeout: 15000,
      },
      (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          fs.unlinkSync(dest);
          return download(res.headers.location, dest).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          return resolve(`skip:${res.statusCode}`);
        }
        res.pipe(file);
        file.on("finish", () => { file.close(); resolve("ok"); });
        file.on("error", (e) => { fs.unlinkSync(dest); reject(e); });
      }
    );
    req.on("error", (e) => { if (fs.existsSync(dest)) fs.unlinkSync(dest); reject(e); });
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

async function downloadBatch(tasks, concurrency = 8) {
  let i = 0;
  let done = 0;
  const total = tasks.length;
  async function worker() {
    while (i < tasks.length) {
      const task = tasks[i++];
      try {
        const result = await download(task.url, task.dest);
        task.result = result;
      } catch (e) {
        task.result = `error:${e.message}`;
      }
      done++;
      if (done % 20 === 0 || done === total) {
        process.stdout.write(`  ${done}/${total}\r`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  console.log(`  ${total}/${total} done`);
}

// ─── collectors ───────────────────────────────────────────────────────────────

/**
 * Global URL→localName registry shared across all files.
 * Prevents duplicate downloads and resolves filename collisions.
 */
const globalUrlMap = new Map();   // url → localName
const globalNameMap = new Map();  // localName → url (detect collisions)

function registerUrl(url, hint) {
  if (!url || !url.startsWith("http")) return null;
  if (globalUrlMap.has(url)) return globalUrlMap.get(url);

  let name = localName(url, hint);

  // Handle filename collisions: two different URLs mapping to the same name
  if (globalNameMap.has(name) && globalNameMap.get(name) !== url) {
    const ext = path.extname(name);
    const base = name.slice(0, -ext.length);
    name = `${base}_${md5(url).slice(0, 8)}${ext}`;
  }

  globalUrlMap.set(url, name);
  globalNameMap.set(name, url);
  return name;
}

/**
 * Collect all unique avatar URLs across every data file first,
 * then download once, then rewrite all files.
 */
function collectAllUrls(dataMap) {
  for (const [file, data] of Object.entries(dataMap)) {
    if (file === "x-profiles.json") {
      for (const profile of Object.values(data)) {
        if (profile.avatar && profile.avatar.startsWith("http")) {
          registerUrl(profile.avatar, profile.username);
        }
      }
    } else {
      walkCollect(data);
    }
  }
}

function walkCollect(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { node.forEach(walkCollect); return; }
  if (node.avatar && typeof node.avatar === "string" && node.avatar.startsWith("http")) {
    // Prefer twitter_username > name > twitter_name > nickname as the display name hint
    const hint = node.twitter_username || node.name || node.twitter_name || node.nickname || null;
    registerUrl(node.avatar, hint || undefined);
  }
  for (const v of Object.values(node)) walkCollect(v);
}

function rewriteAll(data, file) {
  if (file === "x-profiles.json") {
    for (const profile of Object.values(data)) {
      if (profile.avatar && globalUrlMap.has(profile.avatar)) {
        profile.avatar = `/avatars/${globalUrlMap.get(profile.avatar)}`;
      }
    }
  } else {
    walkRewrite(data);
  }
}

function walkRewrite(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { node.forEach(walkRewrite); return; }
  if (node.avatar && typeof node.avatar === "string" && globalUrlMap.has(node.avatar)) {
    node.avatar = `/avatars/${globalUrlMap.get(node.avatar)}`;
  }
  for (const v of Object.values(node)) walkRewrite(v);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(PUBLIC_AVATARS, { recursive: true });

  // 1. Load all data files
  const dataMap = {};
  for (const file of DATA_FILES) {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) { console.log(`  skip (not found): ${file}`); continue; }
    dataMap[file] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    console.log(`Loaded ${file}`);
  }

  // 2. Collect all unique URLs across every file (dedup globally)
  collectAllUrls(dataMap);
  console.log(`\nFound ${globalUrlMap.size} unique avatar URLs across all files`);

  // 3. Build download tasks (one per unique URL)
  const tasks = [];
  for (const [url, name] of globalUrlMap) {
    tasks.push({ url, dest: path.join(PUBLIC_AVATARS, name), name });
  }

  // 4. Download all at once
  await downloadBatch(tasks);

  const ok = tasks.filter(t => t.result === "ok").length;
  const exist = tasks.filter(t => t.result === "exists").length;
  const skipped = tasks.filter(t => t.result?.startsWith("skip")).length;
  const errors = tasks.filter(t => t.result?.startsWith("error")).length;
  console.log(`  downloaded: ${ok}  already existed: ${exist}  skipped (4xx): ${skipped}  errors: ${errors}`);

  // Remove failed URLs from the map so we don't rewrite those
  for (const t of tasks) {
    if (t.result !== "ok" && t.result !== "exists") {
      globalUrlMap.delete(t.url);
    }
  }

  // 5. Rewrite all data files
  for (const [file, data] of Object.entries(dataMap)) {
    rewriteAll(data, file);
    const filePath = path.join(DATA_DIR, file);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Saved ${file}`);
  }

  console.log("\nDone. All data files updated.");
  console.log(`Avatars saved to: ${PUBLIC_AVATARS}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
