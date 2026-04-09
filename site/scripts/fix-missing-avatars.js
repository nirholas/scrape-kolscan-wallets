#!/usr/bin/env node
/**
 * Downloads missing avatars by fetching profile images directly from Twitter.
 * Works with x-profiles.json entries that have local paths but missing files.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const AVATARS_DIR = path.join(ROOT, "public", "avatars");
const X_PROFILES = path.join(ROOT, "data", "x-profiles.json");

async function download(url, dest) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      redirect: "follow",
    });
    
    if (!res.ok) return `skip:${res.status}`;
    
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buffer);
    return "ok";
  } catch (e) {
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    throw e;
  }
}

async function main() {
  if (!fs.existsSync(AVATARS_DIR)) fs.mkdirSync(AVATARS_DIR, { recursive: true });
  
  const profiles = JSON.parse(fs.readFileSync(X_PROFILES, "utf-8"));
  const missing = [];

  for (const [key, profile] of Object.entries(profiles)) {
    if (!profile.avatar) continue;
    
    // Check if it's a local path
    if (profile.avatar.startsWith("/avatars/")) {
      const filename = profile.avatar.replace("/avatars/", "");
      const filepath = path.join(AVATARS_DIR, filename);
      
      if (!fs.existsSync(filepath)) {
        missing.push({ username: profile.username || key, filename, filepath });
      }
    }
  }

  console.log(`Found ${missing.length} missing avatars\n`);
  
  let downloaded = 0, failed = 0;
  
  for (let i = 0; i < missing.length; i++) {
    const { username, filename, filepath } = missing[i];
    const url = `https://unavatar.io/twitter/${encodeURIComponent(username)}`;
    
    try {
      const result = await download(url, filepath);
      if (result === "ok") {
        downloaded++;
        process.stdout.write(`[${i + 1}/${missing.length}] ✓ ${username}\n`);
      } else {
        failed++;
        process.stdout.write(`[${i + 1}/${missing.length}] ✗ ${username} (${result})\n`);
      }
    } catch (e) {
      failed++;
      process.stdout.write(`[${i + 1}/${missing.length}] ✗ ${username} (${e.message})\n`);
    }
    
    // Rate limit: 100ms between requests
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\nDone: ${downloaded} downloaded, ${failed} failed`);
}

main().catch(console.error);
