#!/bin/bash
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Change to the directory where the script is located
cd "$(dirname "$0")"

HTML_FILE="rtt-map-tool.html"
OUT_FILE="rtt-map-tool-out.html"

if [ ! -f "$HTML_FILE" ]; then
    echo "Error: $HTML_FILE not found!"
    exit 1
fi

# Parse arguments
INLINE=false
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --inline) INLINE=true ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

python3 - "$HTML_FILE" "$OUT_FILE" "$INLINE" << 'EOF'
import sys
import re
import os

html_file = sys.argv[1]
out_file = sys.argv[2]
inline = sys.argv[3].lower() == 'true'

if not os.path.exists(html_file):
    print(f"Error: {html_file} not found!")
    sys.exit(1)

with open(html_file, 'r', encoding='utf-8') as f:
    content = f.read()

if inline:
    print("Generating Standalone HTML (Inlined mode)...")
    
    # Inline CSS
    def repl_css(match):
        css_path = match.group(1)
        if os.path.exists(css_path):
            with open(css_path, 'r', encoding='utf-8') as f_css:
                css_code = f_css.read()
            return f'    <style>\n{css_code}\n    </style>'
        else:
            print(f"Warning: {css_path} not found!")
            return match.group(0)

    content = re.sub(r'[ \t]*<link\s+rel="stylesheet"\s+href="(rtt-map-tool\.css)(?:\?[^"]*)?"\s*/?>', repl_css, content, flags=re.IGNORECASE)

    # Inline JS
    def repl_js(match):
        js_path = match.group(1)
        if os.path.exists(js_path):
            with open(js_path, 'r', encoding='utf-8') as f_js:
                js_code = f_js.read()
            return f'    <script>\n{js_code}\n    </script>'
        else:
            print(f"Warning: {js_path} not found!")
            return match.group(0)

    content = re.sub(r'[ \t]*<script\s+src="(js/[^"?]+\.js)(?:\?[^"]*)?"><\s*/\s*script>', repl_js, content, flags=re.IGNORECASE)



else:
    print("Generating HTML (Dynamic mode)...")
    # Pass through untouched (equivalent to copying, but maintains export script structure)
    pass

with open(out_file, 'w', encoding='utf-8') as f:
    f.write(content)

if inline:
    print(f"Standalone HTML successfully generated at {out_file} (Inlined mode)")
else:
    print(f"HTML successfully generated at {out_file} (Dynamic mode)")
EOF
