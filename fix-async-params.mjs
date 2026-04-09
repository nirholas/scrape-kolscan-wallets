#!/usr/bin/env node
/**
 * Migrates Next.js 15 route handlers from sync `params` to async `params`.
 *
 * Strategy: replace `{ params }` destructure in handler signature with `context`,
 * wrap the type with Promise<>, and add `const params = await context.params;`
 * as the first line of the function body. This avoids touching any usage of params.X.
 */

import fs from "fs";
import path from "path";

const API_DIR = "/workspaces/kol-quest/site/app/api";

function findFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findFiles(full));
    else if (entry.isFile() && entry.name === "route.ts") results.push(full);
  }
  return results;
}

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  const original = content;

  // Pattern: { params }: { params: { ... } }
  // where inner type does NOT already have Promise<
  const hasOldPattern = /\{\s*params\s*\}\s*:\s*\{\s*params\s*:\s*(?!Promise)[^}]+\}/s.test(content);
  if (!hasOldPattern) return false;

  // Step 1: Replace `{ params }: { params: { ... } }` with `context: { params: Promise<{ ... }> }`
  content = content.replace(
    /\{\s*params\s*\}\s*:\s*\{\s*params\s*:\s*(\{[^}]+\})\s*\}/gs,
    (match, innerType) => {
      if (innerType.startsWith("Promise<")) return match;
      return `context: { params: Promise<${innerType}> }`;
    }
  );

  // Step 2: After each function signature ending with `) {`, insert `const params = await context.params;`
  const lines = content.split("\n");
  const result = [];
  let pendingInsert = false;
  
  for (let i = 0; i < lines.length; i++) {
    result.push(lines[i]);
    
    // Mark that we saw a `context: { params: Promise<` in recent lines
    if (lines[i].includes("context: { params: Promise<")) {
      pendingInsert = true;
    }
    
    // Check if this line ends the function signature (ends with `) {`)
    const trimmed = lines[i].trimEnd();
    if (pendingInsert && trimmed.endsWith(") {")) {
      const indent = lines[i].match(/^(\s*)/)[1] + "  ";
      result.push(`${indent}const params = await context.params;`);
      pendingInsert = false;
    }
  }
  
  content = result.join("\n");

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    return true;
  }
  return false;
}

const files = findFiles(API_DIR);
let fixed = 0;
const fixedFiles = [];

for (const file of files) {
  try {
    if (fixFile(file)) {
      fixed++;
      fixedFiles.push(file.replace("/workspaces/kol-quest/site/", ""));
    }
  } catch (e) {
    console.error(`Error processing ${file}:`, e.message);
  }
}

console.log(`Fixed ${fixed} files:`);
fixedFiles.forEach(f => console.log(" -", f));
