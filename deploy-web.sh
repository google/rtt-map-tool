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

# deploy-web.sh
# Automates compiling, versioning, releasing, and deploying RTT Map Tool to $USER@<full_server_name>.

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <full_server_name> [index]"
    exit 1
fi

# Username derived from $USER shell parameter; full target server name is required as 1st argument
TARGET_USER="${USER:-$(whoami)}"
TARGET_HOST="$1"
INDEX="${2:-1}"

# Compute today's date and version string (Format: VYYMMDD-INDEX)
DATE_STR=$(date +"%y%m%d")
NEW_VERSION="V${DATE_STR}-${INDEX}"
TARGET_LATEST="rtt-map-tool.html"
TARGET_FILENAME="rtt-map-tool-${DATE_STR}-${INDEX}.html"
TARGET_DEST="${TARGET_USER}@${TARGET_HOST}:~/web/"

echo "=================================================="

echo "    RTT MAP TOOL - AUTOMATED WEB DEPLOYMENT"
echo "=================================================="
echo "New Target Version:  $NEW_VERSION"
echo "Target Latest:       ${TARGET_DEST}${TARGET_LATEST}"
echo "Target Archive:      ${TARGET_DEST}old/${TARGET_FILENAME}"
echo "--------------------------------------------------"

# 1. Dynamically update APP_VERSION in rtt-map-tool.html
echo ">>> Updating APP_VERSION to $NEW_VERSION in rtt-map-tool.html..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # MacOS compatibility for sed -i
    sed -i '' -E "s/const APP_VERSION = 'V[0-9]{6}-[0-9]+';/const APP_VERSION = '${NEW_VERSION}';/" rtt-map-tool.html
else
    sed -i -E "s/const APP_VERSION = 'V[0-9]{6}-[0-9]+';/const APP_VERSION = '${NEW_VERSION}';/" rtt-map-tool.html
fi

# 2. Compile standalone HTML
echo ">>> Compiling Standalone HTML using export.sh..."
./export.sh --inline

# 3. Create the release files (un-dated copy for ~/web/ and dated copy for ~/web/old/)
echo ">>> Creating release files: $TARGET_LATEST and old/$TARGET_FILENAME..."
if [ ! -f "rtt-map-tool-out.html" ]; then
    echo "ERROR: rtt-map-tool-out.html was not generated!"
    exit 1
fi

STAGING_DIR=$(mktemp -d)
mkdir -p "$STAGING_DIR/old"
cp rtt-map-tool-out.html "$STAGING_DIR/$TARGET_LATEST"
cp rtt-map-tool-out.html "$STAGING_DIR/old/$TARGET_FILENAME"

# 4. SCP to the target web server
echo ">>> Transferring to ${TARGET_HOST} via scp..."
echo "    -> ~/web/$TARGET_LATEST"
echo "    -> ~/web/old/$TARGET_FILENAME"
echo "    (Please touch your security key / enter credentials if prompted)"
if scp -r "$STAGING_DIR/$TARGET_LATEST" "$STAGING_DIR/old" "$TARGET_DEST"; then
    echo ">>> Transfer successful!"
else
    echo "ERROR: SCP transfer failed!"
    echo "Cleaning up temporary files..."
    rm -rf "$STAGING_DIR" rtt-map-tool-out.html
    exit 1
fi

# 5. Tidy up temporary .html files
echo ">>> Cleaning up temporary HTML artifacts..."
rm -rf "$STAGING_DIR" rtt-map-tool-out.html

echo "--------------------------------------------------"
echo "    DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo "=================================================="
