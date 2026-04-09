#!/usr/bin/env python3
"""Fix Next.js 16 params Promise requirement in route handlers and pages."""
import re
import subprocess

def fix_route_file(path):
    with open(path, 'r') as f:
        content = f.read()
    
    original = content
    
    # Step 1: Replace `{ params }: { params: { <fields> } }` with `context: { params: Promise<{ <fields> }> }`
    content = re.sub(
        r'\{ params \}: \{ params: \{([^}]+)\} \}',
        lambda m: f'context: {{ params: Promise<{{{m.group(1)}}}> }}',
        content
    )
    
    if content == original:
        return False  # no change
    
    # Step 2: Insert `const params = await context.params;` as first line of each changed function body
    lines = content.split('\n')
    result = []
    i = 0
    needs_await = False
    
    while i < len(lines):
        line = lines[i]
        
        # Detect the new pattern we just inserted
        if 'context: { params: Promise<' in line:
            needs_await = True
        
        result.append(line)
        
        # When we need to insert, look for the function body opening brace
        if needs_await:
            stripped = line.rstrip()
            # Line ends with `) {` - this is the function body opening
            if stripped.endswith(') {'):
                # Get indentation from the next line
                next_line = lines[i+1] if i+1 < len(lines) else ''
                indent_match = re.match(r'^(\s+)', next_line)
                indent = indent_match.group(1) if indent_match else '  '
                result.append(f'{indent}const params = await context.params;')
                needs_await = False
        
        i += 1
    
    return '\n'.join(result)


def fix_page_file(path):
    """Fix page.tsx files - params must be Promise and awaited."""
    with open(path, 'r') as f:
        content = f.read()
    
    original = content
    
    # For pages, the pattern is different - we need to change the type and then await
    # Pattern: `params: { address: string }` in function arg
    # Replace with: `params: Promise<{ address: string }>`
    # Then after the function opens, add `const { ... } = await params;`
    
    # This is trickier - handle each page individually below
    return False


# Find all affected route files
result = subprocess.run(
    ['grep', '-rl', '{ params }: { params: {', '/workspaces/kol-quest/site/app'],
    capture_output=True, text=True
)
files = [f.strip() for f in result.stdout.strip().split('\n') if f.strip()]

print(f"Found {len(files)} files to fix:")
for f in files:
    print(f"  {f}")

fixed = []
no_change = []
for filepath in files:
    new_content = fix_route_file(filepath)
    if new_content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        fixed.append(filepath)
    else:
        no_change.append(filepath)

print(f"\nFixed {len(fixed)} files:")
for f in fixed:
    print(f"  ✓ {f}")
if no_change:
    print(f"\nNo changes in:")
    for f in no_change:
        print(f"  - {f}")
