#!/usr/bin/env node
// Script to fix Next.js 15 dynamic route params (must be Promise)
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all route.ts files with dynamic params
const output = execSync(
  `grep -rl "params.*: {[^}]* string" /workspaces/kol-quest/site/app/api --include="*.ts"`,
  { encoding: 'utf8' }
).trim().split('\n').filter(Boolean);

let fixedCount = 0;

for (const filePath of output) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Match function signature pattern: { params }: { params: { key1: string; key2: string } }
  // and transform to Promise version
  // Pattern: { params }: { params: { ... } }
  const sigRegex = /(\{\s*params\s*\}\s*:\s*\{\s*params\s*:\s*)\{([^}]+)\}(\s*\})/g;
  
  let match;
  const signatures = [];
  sigRegex.lastIndex = 0;
  while ((match = sigRegex.exec(content)) !== null) {
    const inner = match[2]; // e.g. " address: string " or " chain: string; address: string "
    // Extract param names
    const paramNames = [...inner.matchAll(/(\w+)\s*:/g)].map(m => m[1]);
    if (paramNames.length > 0) {
      signatures.push({ inner, paramNames, fullMatch: match[0], start: match.index, end: match.index + match[0].length });
    }
  }

  if (signatures.length === 0) continue;

  // Replace signature: wrap type in Promise
  content = content.replace(
    /(\{\s*params\s*\}\s*:\s*\{\s*params\s*:\s*)\{([^}]+)\}(\s*\})/g,
    (m, before, inner, after) => {
      // Check if already Promise
      if (inner.trim().startsWith('Promise')) return m;
      return `${before}Promise<{${inner}}>${after}`;
    }
  );

  // For each file, gather all param names and add await at function body start
  // Find all param names from all signatures
  const allParamNames = [...new Set(signatures.flatMap(s => s.paramNames))];
  
  // Add `const { ... } = await params;` after the opening brace of the function body
  // Find the function body opening brace
  // Strategy: after the closing ) of function params, find {, then insert await line
  
  // Replace `params.X` with `X` for each param name
  for (const name of allParamNames) {
    const paramRef = new RegExp(`\\bparams\\.${name}\\b`, 'g');
    content = content.replace(paramRef, name);
  }

  // Now add `const { ... } = await params;` at the start of function body
  // Find the function signature end and the opening brace
  // We need to find where the function body starts
  // Pattern: export async function GET/POST/PUT/DELETE(...) {
  const funcBodyRegex = /export\s+async\s+function\s+(?:GET|POST|PUT|DELETE|PATCH)\s*\([^)]*\)\s*\{/g;
  let bodyMatch;
  let insertions = [];
  funcBodyRegex.lastIndex = 0;
  while ((bodyMatch = funcBodyRegex.exec(content)) !== null) {
    const openBracePos = bodyMatch.index + bodyMatch[0].length;
    insertions.push({ pos: openBracePos, paramNames: allParamNames });
  }
  
  // Insert from end to start to preserve positions
  for (let i = insertions.length - 1; i >= 0; i--) {
    const { pos, paramNames } = insertions[i];
    const destructure = `\n  const { ${paramNames.join(', ')} } = await params;`;
    content = content.slice(0, pos) + destructure + content.slice(pos);
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${filePath.replace('/workspaces/kol-quest/site/', '')}`);
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} files.`);
