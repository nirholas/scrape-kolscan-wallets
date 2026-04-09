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
 * x-profiles.json: { [key]: { username, avatar, header, ... } }
 * Rewrite avatar to /avatars/{username}.jpg
 */
function collectXProfiles(data) {
  const tasks = [];
  for (const [key, profile] of Object.entries(data)) {
    if (!profile.avatar || profile.avatar.startsWith("/avatars/")) continue;
    const name = localName(profile.avatar, profile.username);
    tasks.push({ url: profile.avatar, dest: path.join(PUBLIC_AVATARS, name), key, name });
  }
  return tasks;
}

function rewriteXProfiles(data, tasks) {
  for (const t of tasks) {
    if (t.result === "ok" || t.result === "exists") {
      data[t.key].avatar = `/avatars/${t.name}`;
    }
  }
}

/**
 * Walk a nested structure looking for objects with an `avatar` field.
 * Returns { urlToLocalName } map and collects tasks.
 */
function collectWallets(data) {
  const tasks = [];
  const seen = new Set();

  function walk(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node.avatar && typeof node.avatar === "string" && node.avatar.startsWith("http")) {
      const name = localName(node.avatar);
      if (!seen.has(node.avatar)) {
        seen.add(node.avatar);
        tasks.push({ url: node.avatar, dest: path.join(PUBLIC_AVATARS, name), name });
      }
    }
    for (const v of Object.values(node)) walk(v);
  }

  walk(data);
  return tasks;
}

function rewriteWallets(data, urlToName) {
  function walk(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node.avatar && typeof node.avatar === "string" && node.avatar.startsWith("http")) {
      const name = urlToName[node.avatar];
      if (name) node.avatar = `/avatars/${name}`;
    }
    for (const v of Object.values(node)) walk(v);
  }
  walk(data);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(PUBLIC_AVATARS, { recursive: true });

  for (const file of DATA_FILES) {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) { console.log(`  skip (not found): ${file}`); continue; }

    console.log(`\nProcessing ${file}...`);
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    let tasks;
    if (file === "x-profiles.json") {
      tasks = collectXProfiles(data);
      console.log(`  ${tasks.length} avatars to download`);
      await downloadBatch(tasks);
      rewriteXProfiles(data, tasks);
    } else {
      tasks = collectWallets(data);
      console.log(`  ${tasks.length} unique avatars to download`);
      await downloadBatch(tasks);
      const urlToName = Object.fromEntries(
        tasks.filter(t => t.result === "ok" || t.result === "exists").map(t => [t.url, t.name])
      );
      rewriteWallets(data, urlToName);
    }

    const ok = tasks.filter(t => t.result === "ok").length;
    const exist = tasks.filter(t => t.result === "exists").length;
    const skipped = tasks.filter(t => t.result?.startsWith("skip")).length;
    const errors = tasks.filter(t => t.result?.startsWith("error")).length;
    console.log(`  downloaded: ${ok}  already existed: ${exist}  skipped (4xx): ${skipped}  errors: ${errors}`);

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`  Saved ${file}`);
  }

  console.log("\nDone. All data files updated.");
  console.log(`Avatars saved to: ${PUBLIC_AVATARS}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
