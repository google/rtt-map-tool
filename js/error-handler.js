/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @fileoverview Error handler for RTT Map Tool.
 * @suppress {lintChecks}
 */

window.onerror = function(msg, url, line) {
  const msgStr = String(msg).toLowerCase();
  // Suppress harmless background frame/security errors thrown by Map APIs or
  // Chrome extensions on local paths
  if (msgStr.includes('unsafe attempt to load url') ||
      msgStr.includes('cross-origin') || msgStr.includes('script error') ||
      msgStr.includes('security')) {
    console.warn('Suppressed background security warning: ' + msg);
    return true;
  }

  const box = document.getElementById('error-box');
  if (box) {
    box.style.display = 'block';
    box.innerHTML += '<b>System Error:</b> ' + msg + '<br>';
  }
};
