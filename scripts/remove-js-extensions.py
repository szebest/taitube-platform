import glob
import re
import os

ts_files = glob.glob('**/*.ts', recursive=True)
count = 0
modified_files = []

# Matches: from './something.js' or from "../something.js"
pattern1 = re.compile(r'(from\s+[\'\"]\.[^\'\"]*?)\.js([\'\"])')
# Matches: import './something.js' or import "../something.js"
pattern2 = re.compile(r'(import\s+[\'\"]\.[^\'\"]*?)\.js([\'\"])')
# Matches: import('./something.js')
pattern3 = re.compile(r'(import\(\s*[\'\"]\.[^\'\"]*?)\.js([\'\"])')
# Matches: export * from './something.js'
pattern4 = re.compile(r'(export\s+\*\s+from\s+[\'\"]\.[^\'\"]*?)\.js([\'\"])')
# Matches: export { x } from './something.js'
pattern5 = re.compile(r'(export\s+\{[^\}]*\}\s+from\s+[\'\"]\.[^\'\"]*?)\.js([\'\"])')

for f in ts_files:
    if 'node_modules' in f or 'dist' in f or '.turbo' in f:
        continue
    content = open(f, 'r', encoding='utf-8').read()
    new_content = pattern1.sub(r'\1\2', content)
    new_content = pattern2.sub(r'\1\2', new_content)
    new_content = pattern3.sub(r'\1\2', new_content)
    new_content = pattern4.sub(r'\1\2', new_content)
    new_content = pattern5.sub(r'\1\2', new_content)
    
    if new_content != content:
        open(f, 'w', encoding='utf-8').write(new_content)
        count += 1
        modified_files.append(f)

print(f"Updated {count} TypeScript files to standard extensionless imports.")
