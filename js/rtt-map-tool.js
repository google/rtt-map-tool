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
 * @fileoverview Main application controller for RTT Map Tool.
 * @suppress {lintChecks}
 */

let isPointerMode = false;
window.preventMapClick = false;
let activeNudgeMarker = null;

Object.defineProperty(window, 'isEditMode', {
  get: function() {
    const el = document.querySelector('input[name="mapMode"]:checked');
    return el ? (el.value === 'EDIT') : false;
  },
  configurable: true
});

Object.defineProperty(window, 'isAddMode', {
  get: function() {
    const el = document.querySelector('input[name="mapMode"]:checked');
    return el ? (el.value === 'ADD') : false;
  },
  configurable: true
});

Object.defineProperty(window, 'isDelMode', {
  get: function() {
    const el = document.querySelector('input[name="mapMode"]:checked');
    return el ? (el.value === 'DEL') : false;
  },
  configurable: true
});

Object.defineProperty(window, 'isOffMode', {
  get: function() {
    const el = document.querySelector('input[name="mapMode"]:checked');
    return el ? (el.value === 'OFF') : true;
  },
  configurable: true
});


window.undoStack = [];
window.redoStack = [];

window.pushAction = function(groups, undoFn, redoFn) {
  const grps = Array.isArray(groups) ? groups : [groups];
  window.undoStack.push({groups: grps, undo: undoFn, redo: redoFn});
  window.redoStack = [];
};

const sidebar = document.getElementById('sidebar');
const sidebarVersionSpan = document.getElementById('sidebarVersion');
if (sidebarVersionSpan && typeof APP_VERSION !== 'undefined') {
  sidebarVersionSpan.innerText = APP_VERSION;
}



const statusDiv = document.getElementById('status');
if (statusDiv) {
  let messages = ['Ready.'];
  statusDiv.innerHTML = '<div>Ready.</div>';

  Object.defineProperty(statusDiv, 'innerText', {
    get: function() {
      return messages.join('\n');
    },
    set: function(val) {
      if (val === '') {
        messages = [];
        this.innerHTML = '';
        return;
      }
      messages.push(val);
      if (messages.length > 50) messages.shift();
      this.innerHTML = messages.map(m => `<div>${m}</div>`).join('');
      this.scrollTop = this.scrollHeight;
    },
    configurable: true
  });
}

const opacitySlider = document.getElementById('opacitySlider');
if (opacitySlider) {
  opacitySlider.addEventListener('input', function() {
    if (imageOverlayLayer) imageOverlayLayer.setOpacity(this.value);
  });
}

const toggleParamsBtn = document.getElementById('toggleParamsBtn');
const paramsContent = document.getElementById('paramsContent');
if (toggleParamsBtn && paramsContent) {
  toggleParamsBtn.addEventListener('change', function() {
    paramsContent.style.display = this.checked ? 'block' : 'none';
  });
}

const toggleNudgeBtn = document.getElementById('toggleNudgeBtn');
const nudgeControlsContainer = document.getElementById('nudgeControlsContainer');
const showNudgePopupChk = document.getElementById('showNudgePopupChk');

window.shouldShowMarkerPopup = function() {
  const chk = document.getElementById('showNudgePopupChk');
  return chk ? chk.checked : true;
};

if (showNudgePopupChk) {
  showNudgePopupChk.addEventListener('change', function() {
    if (!this.checked && typeof map !== 'undefined' &&
        typeof map.closePopup === 'function') {
      map.closePopup();
    }
  });
}

if (toggleNudgeBtn && nudgeControlsContainer) {
  toggleNudgeBtn.addEventListener('change', function() {
    nudgeControlsContainer.style.display = this.checked ? 'block' : 'none';
    if (!this.checked) {
      const chk = document.getElementById('showNudgePopupChk');
      if (chk) chk.checked = true;
    }
  });
}

const toggleChangelogBtn = document.getElementById('toggleChangelogBtn');
const changelogContainer = document.getElementById('changelogContainer');
if (toggleChangelogBtn && changelogContainer) {
  toggleChangelogBtn.addEventListener('change', function() {
    changelogContainer.style.display = this.checked ? 'block' : 'none';
  });
}

// --- DRAG MODE CONTROLLER ---
window.updateCsvDropZoneLabel = function(filename) {
  const textEl = document.getElementById('csvDropZoneText');
  const name = filename || document.getElementById('csvConfigPath')?.value;
  if (textEl) {
    if (name) {
      textEl.innerHTML = `Loaded CSV: <b>${name}</b><br><span style="font-size:10px; font-weight:normal; color:#555;">(Drag &amp; Drop new .csv file to replace)</span>`;
    } else {
      textEl.innerHTML = `Drag &amp; Drop Configuration (.csv) file here`;
    }
  }
};

window.updateOsmDropZoneLabel = function(filename) {
  const textEl = document.getElementById('osmDropZoneText');
  const name = filename || document.getElementById('osmPath')?.value;
  if (textEl) {
    if (name) {
      textEl.innerHTML = `Loaded OSM: <b>${name}</b><br><span style="font-size:10px; font-weight:normal; color:#555;">(Drag &amp; Drop new .osm file to replace)</span>`;
    } else {
      textEl.innerHTML = `Drag &amp; Drop OSM Walkable Routes (.osm) file here`;
    }
  }
};

const toggleDragModeBtn = document.getElementById('toggleDragModeBtn');
const csvNormalRow = document.getElementById('csvNormalRow');
const csvDropZone = document.getElementById('csvDropZone');
const osmNormalRow = document.getElementById('osmNormalRow');
const osmDropZone = document.getElementById('osmDropZone');
const fileConfigGroup = document.getElementById('fileConfigGroup');
const fileSheetGroup = document.getElementById('fileSheetGroup');

window.updateFileSourceModeUI = function() {
  const modeRadio =
      document.querySelector('input[name="fileSourceMode"]:checked');
  const mode = modeRadio ? modeRadio.value : 'config';
  if (fileConfigGroup) {
    fileConfigGroup.style.display = (mode === 'config') ? 'block' : 'none';
  }
  if (fileSheetGroup) {
    fileSheetGroup.style.display = (mode === 'sheet') ? 'block' : 'none';
  }
};

document.querySelectorAll('input[name="fileSourceMode"]').forEach(radio => {
  radio.addEventListener('change', window.updateFileSourceModeUI);
});
window.updateFileSourceModeUI();

if (toggleDragModeBtn) {
  toggleDragModeBtn.addEventListener('change', function() {
    const isDrag = this.checked;
    if (csvNormalRow && csvDropZone) {
      csvNormalRow.style.display = isDrag ? 'none' : 'flex';
      csvDropZone.style.display = isDrag ? 'flex' : 'none';
      if (isDrag) window.updateCsvDropZoneLabel();
    }
    if (osmNormalRow && osmDropZone) {
      osmNormalRow.style.display = isDrag ? 'none' : 'flex';
      osmDropZone.style.display = isDrag ? 'flex' : 'none';
      if (isDrag) window.updateOsmDropZoneLabel();
    }
  });
}

function setupDropZone(dropZoneId, fileInputId, fileHandler) {
  const dropZone = document.getElementById(dropZoneId);
  if (!dropZone) return;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'dragend', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      fileHandler(dt.files[0]);
    }
  });

  dropZone.addEventListener('click', () => {
    const fileInput = document.getElementById(fileInputId);
    if (fileInput) {
      fileInput.value = '';
      fileInput.click();
    }
  });
}

setupDropZone('csvDropZone', 'csvConfigImportFile', function(file) {
  const csvConfigPathBox = document.getElementById('csvConfigPath');
  if (csvConfigPathBox) csvConfigPathBox.value = file.name;
  localStorage.setItem('lastCsvFile', file.name);
  localStorage.setItem('lastLoadType', 'csv');

  const reader = new FileReader();
  reader.onload = function(ev) {
    window.processCsvConfigContent(ev.target.result, file.name);
    window.updateCsvDropZoneLabel(file.name);
  };
  reader.readAsText(file);
});

setupDropZone('osmDropZone', 'osmImportFile', function(file) {
  const osmPathBox = document.getElementById('osmPath');
  if (osmPathBox) osmPathBox.value = file.name;
  localStorage.setItem('lastOsmFile', file.name);

  const reader = new FileReader();
  reader.onload = function(ev) {
    window.processOsmContent(ev.target.result, file.name);
    window.updateOsmDropZoneLabel(file.name);
  };
  reader.readAsText(file);
});




function nudgeActiveTabs(dLatSign, dLngSign) {
  const statusDiv = document.getElementById('status');
  if (!isEditMode) {
    statusDiv.innerText = 'Must enable \'Edit: ON\' to nudge markers.';
    statusDiv.style.color = 'red';
    return;
  }

  let step = parseFloat(document.getElementById('nudgeStep').value);
  if (isNaN(step)) step = 0.000001;

  const dLat = dLatSign * step;
  const dLng = dLngSign * step;

  const scopeNode = document.querySelector('input[name="nudgeScope"]:checked');
  const nudgeScope = scopeNode ? scopeNode.value : 'single';

  const typeNode = document.querySelector('input[name="addType"]:checked');
  const activeType = typeNode ? typeNode.value : 'AP';

  if (nudgeScope === 'single') {
    if (!activeNudgeMarker) {
      statusDiv.innerText =
          'No marker selected to nudge. Click a GT, AP, WP, or FP Corner marker first.';
      statusDiv.style.color = 'orange';
      return;
    }

    const m = activeNudgeMarker;
    const isCorner =
        (m === window.swCornerMarker || m === window.neCornerMarker ||
         (m.options && m.options.isCorner));

    if (isCorner) {
      if (activeType !== 'CORNERS') {
        statusDiv.innerText =
            `Nudge skipped: Selected marker is FP Corners, but active type is ${
                activeType}.`;
        statusDiv.style.color = 'orange';
        return;
      }
      const isSW =
          (m === window.swCornerMarker ||
           (m.options && m.options.cornerType === 'SW'));
      const cornerLabel = isSW ? 'FP SW' : 'FP NE';
      const oldLL = m.getLatLng();
      const newLL = L.latLng(oldLL.lat + dLat, oldLL.lng + dLng);

      m.setLatLng(newLL);
      if (typeof window.handleCornerDrag === 'function') {
        window.handleCornerDrag();
      }
      if (coordBox) {
        coordBox.value = `${newLL.lat.toFixed(7)}, ${newLL.lng.toFixed(7)}`;
      }

      const cl = document.getElementById('changeLog');
      if (cl) {
        cl.value += `BD ${isSW ? 'SW' : 'NE'} Corner Nudged: ${
            newLL.lat.toFixed(7)},${newLL.lng.toFixed(7)}\n`;
        cl.scrollTop = cl.scrollHeight;
      }

      pushAction(
          overlays['FP Corners'] || L.layerGroup(),
          () => {
            m.setLatLng(oldLL);
            if (typeof window.handleCornerDrag === 'function')
              window.handleCornerDrag();
            if (map.hasLayer(errorLinesLayer)) updateErrorAnalysis();
          },
          () => {
            m.setLatLng(newLL);
            if (typeof window.handleCornerDrag === 'function')
              window.handleCornerDrag();
            if (map.hasLayer(errorLinesLayer)) updateErrorAnalysis();
          });

      if (map.hasLayer(errorLinesLayer)) updateErrorAnalysis();
      statusDiv.innerText = `${cornerLabel} Corner Nudged (${
          newLL.lat.toFixed(7)}, ${newLL.lng.toFixed(7)}).`;
      statusDiv.style.color = 'blue';
      return;
    }

    if (m.options && m.options.originalData) {
      const rType =
          String(m.options.originalData.rectype || 'AP').toUpperCase().trim();
      if (rType !== activeType) {
        const activeTypeLabel =
            activeType === 'CORNERS' ? 'FP Corners' : activeType;
        statusDiv.innerText = `Nudge skipped: Selected marker is ${
            rType}, but active type is ${activeTypeLabel}.`;
        statusDiv.style.color = 'orange';
        return;
      }

      let targetGroup = null;
      if (typeof overlays !== 'undefined') {
        Object.values(overlays).forEach(lyr => {
          if (lyr && typeof lyr.hasLayer === 'function' && lyr.hasLayer(m)) {
            targetGroup = lyr;
          }
        });
      }
      if (!targetGroup && window.activeGroup &&
          typeof window.activeGroup.hasLayer === 'function' &&
          window.activeGroup.hasLayer(m)) {
        targetGroup = window.activeGroup;
      }

      const oldLL = m.getLatLng();
      const oldRowRaw =
          m.options.originalRow ? m.options.originalRow.slice() : [];
      const newLatStr = (oldLL.lat + dLat).toFixed(7);
      const newLngStr = (oldLL.lng + dLng).toFixed(7);
      const newLL = L.latLng(parseFloat(newLatStr), parseFloat(newLngStr));

      m.setLatLng(newLL);
      m.options.originalData.lat = parseFloat(newLatStr);
      m.options.originalData.lng = parseFloat(newLngStr);

      const rArr = m.options.originalRow ? m.options.originalRow.slice() : [];
      if (m.options.latIdx > -1) rArr[m.options.latIdx] = newLatStr;
      if (m.options.lngIdx > -1) rArr[m.options.lngIdx] = newLngStr;
      m.options.originalRow = rArr;

      if (coordBox) {
        coordBox.value = `${newLatStr}, ${newLngStr}`;
      }

      if (targetGroup) {
        if (rType === 'GT' && typeof redrawGtLine === 'function')
          redrawGtLine(targetGroup);
        if (rType === 'WP' && typeof redrawWpLine === 'function')
          redrawWpLine(targetGroup);
      }

      pushAction(
          targetGroup || L.layerGroup(),
          () => {
            m.setLatLng(oldLL);
            m.options.originalRow = oldRowRaw;
            m.options.originalData.lat = oldLL.lat;
            m.options.originalData.lng = oldLL.lng;
            if (targetGroup) {
              if (typeof redrawGtLine === 'function') redrawGtLine(targetGroup);
              if (typeof redrawWpLine === 'function') redrawWpLine(targetGroup);
            }
            if (map.hasLayer(errorLinesLayer)) updateErrorAnalysis();
          },
          () => {
            m.setLatLng(newLL);
            m.options.originalRow = rArr;
            m.options.originalData.lat = newLL.lat;
            m.options.originalData.lng = newLL.lng;
            if (targetGroup) {
              if (typeof redrawGtLine === 'function') redrawGtLine(targetGroup);
              if (typeof redrawWpLine === 'function') redrawWpLine(targetGroup);
            }
            if (map.hasLayer(errorLinesLayer)) updateErrorAnalysis();
          });

      if (map.hasLayer(errorLinesLayer)) updateErrorAnalysis();
      logAndCopy(rArr);
      const markerName =
          m.options.originalData.ap || m.options.originalData.label || rType;
      statusDiv.innerText = `Nudged ${markerName} (${newLatStr}, ${newLngStr})`;
      statusDiv.style.color = 'purple';
      return;
    }
  }

  if (activeType === 'CORNERS') {
    if (window.swCornerMarker && window.neCornerMarker) {
      const oldSW = window.swCornerMarker.getLatLng();
      const oldNE = window.neCornerMarker.getLatLng();

      const newSW = L.latLng((oldSW.lat + dLat), (oldSW.lng + dLng));
      const newNE = L.latLng((oldNE.lat + dLat), (oldNE.lng + dLng));

      const origSWLL = oldSW;
      const origNELL = oldNE;
      const newSWLL = newSW;
      const newNELL = newNE;

      window.swCornerMarker.setLatLng(newSW);
      window.neCornerMarker.setLatLng(newNE);
      if (typeof window.handleCornerDrag === 'function') {
        window.handleCornerDrag();
      } else {
        const bnds = L.latLngBounds(newSW, newNE);
        const swBox = document.getElementById('swCorner');
        const neBox = document.getElementById('neCorner');
        if (swBox) swBox.value = newSW.lat.toFixed(7) + ',' + newSW.lng.toFixed(7);
        if (neBox) neBox.value = newNE.lat.toFixed(7) + ',' + newNE.lng.toFixed(7);
        storedBounds = [[newSW.lat, newSW.lng], [newNE.lat, newNE.lng]];
        if (imageOverlayLayer) imageOverlayLayer.setBounds(bnds);
        if (window.swCornerMarker.getPopup()) window.swCornerMarker.getPopup().setContent('<b>FP SW</b><br>' + newSW.lat.toFixed(7) + ',' + newSW.lng.toFixed(7));
        if (window.neCornerMarker.getPopup()) window.neCornerMarker.getPopup().setContent('<b>FP NE</b><br>' + newNE.lat.toFixed(7) + ',' + newNE.lng.toFixed(7));
      }

      const cl = document.getElementById('changeLog');
      if (cl) {
        cl.value += `--- BATCH NUDGED FP CORNERS (Lat: ${dLat.toFixed(7)}, Lng: ${dLng.toFixed(7)}) ---\n`;
        cl.scrollTop = cl.scrollHeight;
      }

      pushAction(
        overlays['FP Corners'] || L.layerGroup(),
        () => {
          console.log('Undo: Restoring FP Corners to', origSWLL, origNELL);
          window.swCornerMarker.setLatLng(origSWLL);
          window.neCornerMarker.setLatLng(origNELL);
          if (typeof window.handleCornerDrag === 'function') window.handleCornerDrag();
          else {
            const bnds = L.latLngBounds(origSWLL, origNELL);
            const swBox = document.getElementById('swCorner');
            const neBox = document.getElementById('neCorner');
            if (swBox) swBox.value = origSWLL.lat.toFixed(7) + ',' + origSWLL.lng.toFixed(7);
            if (neBox) neBox.value = origNELL.lat.toFixed(7) + ',' + origNELL.lng.toFixed(7);
            storedBounds = [[origSWLL.lat, origSWLL.lng], [origNELL.lat, origNELL.lng]];
            if (imageOverlayLayer) imageOverlayLayer.setBounds(bnds);
            if (window.swCornerMarker.getPopup()) window.swCornerMarker.getPopup().setContent('<b>FP SW</b><br>' + origSWLL.lat.toFixed(7) + ',' + origSWLL.lng.toFixed(7));
            if (window.neCornerMarker.getPopup()) window.neCornerMarker.getPopup().setContent('<b>FP NE</b><br>' + origNELL.lat.toFixed(7) + ',' + origNELL.lng.toFixed(7));
          }
        },
        () => {
          console.log('Redo: Moving FP Corners to', newSWLL, newNELL);
          window.swCornerMarker.setLatLng(newSWLL);
          window.neCornerMarker.setLatLng(newNELL);
          if (typeof window.handleCornerDrag === 'function') window.handleCornerDrag();
          else {
            const bnds = L.latLngBounds(newSWLL, newNELL);
            const swBox = document.getElementById('swCorner');
            const neBox = document.getElementById('neCorner');
            if (swBox) swBox.value = newSWLL.lat.toFixed(7) + ',' + newSWLL.lng.toFixed(7);
            if (neBox) neBox.value = newNE.lat.toFixed(7) + ',' + newNE.lng.toFixed(7);
            storedBounds = [[newSWLL.lat, newSWLL.lng], [newNELL.lat, newNE.lng]];
            if (imageOverlayLayer) imageOverlayLayer.setBounds(bnds);
            if (window.swCornerMarker.getPopup()) window.swCornerMarker.getPopup().setContent('<b>FP SW</b><br>' + newSWLL.lat.toFixed(7) + ',' + newSWLL.lng.toFixed(7));
            if (window.neCornerMarker.getPopup()) window.neCornerMarker.getPopup().setContent('<b>FP NE</b><br>' + newNE.lat.toFixed(7) + ',' + newNE.lng.toFixed(7));
          }
        }
      );


      if (map.hasLayer(errorLinesLayer)) updateErrorAnalysis();
      
      const stat = document.getElementById('status');
      if (stat) {
        stat.innerText = 'FP Corners Nudged.';
        stat.style.color = 'blue';
      }
      return;
    }
  }

  const activeTabs = [];
  Object.keys(overlays).forEach(key => {
    if (key.includes('Tab ID') || key.includes('Imported csv') ||
        key.startsWith('New ')) {
      if (map.hasLayer(overlays[key])) {
        activeTabs.push(overlays[key]);
      }
    }
  });

  if (activeTabs.length === 0) return;

  const batchRows = [];
  const undoMoves = [];

  activeTabs.forEach(tab => {
    let needsLineRedrawGT = false;
    let needsLineRedrawWP = false;

    tab.getLayers().forEach(layer => {
      if (layer instanceof L.Marker && layer.options.originalData) {
        const oldLL = layer.getLatLng();
        const oldRowRaw = layer.options.originalRow.slice();

        const newLatStr = (oldLL.lat + dLat).toFixed(7);
        const newLngStr = (oldLL.lng + dLng).toFixed(7);

        layer.setLatLng([newLatStr, newLngStr]);
        layer.options.originalData.lat = parseFloat(newLatStr);
        layer.options.originalData.lng = parseFloat(newLngStr);

        const rArr = layer.options.originalRow.slice();
        if (layer.options.latIdx > -1) rArr[layer.options.latIdx] = newLatStr;
        if (layer.options.lngIdx > -1) rArr[layer.options.lngIdx] = newLngStr;
        layer.options.originalRow = rArr;

        batchRows.push(rArr);
        undoMoves.push({
          marker: layer,
          oldLatLng: oldLL,
          newLatLng: layer.getLatLng(),
          oldRow: oldRowRaw,
          newRow: rArr,
          group: tab
        });

        const rType = String(layer.options.originalData.rectype || '')
                        .toUpperCase()
                        .trim();
        if (rType === 'GT') needsLineRedrawGT = true;
        if (rType === 'WP') needsLineRedrawWP = true;
      }
    });

    if (needsLineRedrawGT) redrawGtLine(tab);
    if (needsLineRedrawWP) redrawWpLine(tab);
  });

  pushAction(
      activeTabs,
      () => {  // undo
        const grps = new Set();
        undoMoves.forEach(m => {
          m.marker.setLatLng(m.oldLatLng);
          m.marker.options.originalRow = m.oldRow;
          m.marker.options.originalData.lat = m.oldLatLng.lat;
          m.marker.options.originalData.lng = m.oldLatLng.lng;
          grps.add(m.group);
        });
        grps.forEach(g => {
          redrawGtLine(g);
          redrawWpLine(g);
        });
      },
      () => {  // redo
        const grps = new Set();
        undoMoves.forEach(m => {
          m.marker.setLatLng(m.newLatLng);
          m.marker.options.originalRow = m.newRow;
          m.marker.options.originalData.lat = m.newLatLng.lat;
          m.marker.options.originalData.lng = m.newLatLng.lng;
          grps.add(m.group);
        });
        grps.forEach(g => {
          redrawGtLine(g);
          redrawWpLine(g);
        });
      });

  if (map.hasLayer(errorLinesLayer)) updateErrorAnalysis();

  if (batchRows.length > 0) {
    const tsvText =
        batchRows
            .map(
                row =>
                    row.map(
                           cell => (cell === null || cell === undefined) ? '' :
                                                                           cell)
                        .join('\t'))
            .join('\n');
    const changeLog = document.getElementById('changeLog');
    changeLog.value +=
        `--- BATCH NUDGED ${batchRows.length} MARKERS ---\n` + tsvText + '\n';

    if (changeLog.value.length > 50000) {
      changeLog.value =
          changeLog.value.substring(changeLog.value.length - 50000);
    }
    changeLog.scrollTop = changeLog.scrollHeight;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(tsvText).then(
          function() {
            statusDiv.innerText =
                `Nudged & Copied ${batchRows.length} markers!`;
            statusDiv.style.color = 'purple';
          },
          function(err) {
            statusDiv.innerText = 'Error: Auto-copy failed. Use Log box.';
            statusDiv.style.color = 'red';
          });
    }
  }
}

document.getElementById('nudgeUp').onclick = () => nudgeActiveTabs(1, 0);
document.getElementById('nudgeDown').onclick = () => nudgeActiveTabs(-1, 0);
document.getElementById('nudgeLeft').onclick = () => nudgeActiveTabs(0, -1);
document.getElementById('nudgeRight').onclick = () => nudgeActiveTabs(0, 1);

function logAndCopy(rowArr, skipClipboard) {
  const tsvLine =
      rowArr.map(cell => (cell === null || cell === undefined) ? '' : cell)
          .join('\t');
  const changeLog = document.getElementById('changeLog');
  const statusDiv = document.getElementById('status');

  changeLog.value += tsvLine + '\n';
  if (changeLog.value.length > 50000) {
    changeLog.value = changeLog.value.substring(changeLog.value.length - 50000);
  }
  changeLog.scrollTop = changeLog.scrollHeight;

  if (skipClipboard) return;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(tsvLine).then(
        function() {
          statusDiv.innerText = 'Copied to Clipboard!';
          statusDiv.style.color = 'purple';
        },
        function(err) {
          statusDiv.innerText = 'Error: Auto-copy failed. Use Log box.';
          statusDiv.style.color = 'red';
        });
  }
}

const searchBox = document.getElementById('searchBox');
const searchBtn = document.getElementById('searchBtn');
const searchStatus = document.getElementById('searchStatus');
let currentMatches = [];
let currentMatchIndex = 0;
let lastSearchTerm = '';

function performSearch() {
  const term = searchBox.value.trim().toLowerCase();
  if (term === '') {
    searchStatus.innerText = '';
    return;
  }

  if (term !== lastSearchTerm) {
    currentMatches = allMarkers.filter(item => {
      const ap = String(item.id || '').toLowerCase();
      const mac = String(item.bssid || '').toLowerCase();
      return ap.includes(term) || mac.includes(term);
    });
    currentMatchIndex = 0;
    lastSearchTerm = term;
  } else {
    currentMatchIndex++;
    if (currentMatchIndex >= currentMatches.length) currentMatchIndex = 0;
  }

  if (currentMatches.length > 0) {
    const found = currentMatches[currentMatchIndex];
    map.flyTo(found.marker.getLatLng(), 22);
    if (typeof window.shouldShowMarkerPopup !== 'function' ||
        window.shouldShowMarkerPopup()) {
      found.marker.openPopup();
    } else {
      found.marker.closePopup();
    }
    activeNudgeMarker = found.marker;
    updateDeleteBtn();
    searchStatus.innerText =
        `Result ${currentMatchIndex + 1} of ${currentMatches.length}`;
    searchStatus.style.color = 'blue';
  } else {
    searchStatus.innerText = 'Not found.';
    searchStatus.style.color = 'red';
    currentMatches = [];
  }
}
if (searchBtn) {
  searchBtn.addEventListener('click', performSearch);
}
if (searchBox) {
  searchBox.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') performSearch();
  });
}

const pointerBtn = document.getElementById('pointerBtn');
const coordBox = document.getElementById('coordOutput');

window.updateDeleteBtn = function() {
  // Obsolete - DEL mode is managed directly via the segmented radio control pill.
};

window.deleteMarkerFunction = function(markerToDelete, targetGroup) {
  if (!markerToDelete || !targetGroup) return;

  const oldEdges = targetGroup.wpEdges ? [...targetGroup.wpEdges] : [];
  const oldGt = targetGroup.gtMarkers ? [...targetGroup.gtMarkers] : [];
  const oldWpNodes = targetGroup.wpNodesList ? [...targetGroup.wpNodesList] : [];
  const oldFocus = targetGroup.wpFocusNode;

  const rType = String(markerToDelete.options.originalData.rectype || 'AP')
                  .toUpperCase()
                  .trim();
  const m = markerToDelete;
  const mId = m.options.originalData.ap;
  const mBssid = m.options.originalData.bssid;
  const mData = m.options.originalData;

  // Capture GT label states for undo
  const gtUndoLabelSnapshots = [];
  if (rType === 'GT' && targetGroup.gtMarkers) {
    targetGroup.gtMarkers.forEach(mx => {
      gtUndoLabelSnapshots.push({
        marker: mx,
        label: mx.options.originalData.label || '',
        ap: mx.options.originalData.ap || '',
        gtName: mx.gtName || '',
        rowVal: (mx.options.originalRow && mx.options.apIdx > -1) ? mx.options.originalRow[mx.options.apIdx] : null
      });
    });
  }

  targetGroup.removeLayer(m);
  allMarkers = allMarkers.filter(item => item.marker !== m);

  if (rType === 'GT') {
    // Sort all GT markers before deletion to find the position
    const sorted = [...targetGroup.gtMarkers].sort((a, b) => {
      const nameA = String(a.gtName || '');
      const nameB = String(b.gtName || '');
      return nameA.localeCompare(nameB, undefined, {numeric: true, sensitivity: 'base'});
    });
    
    const deletedIdx = sorted.indexOf(m);
    const deletedLabel = m.options.originalData.label || m.gtName || '';
    const match = deletedLabel.match(/^(.*?)(\d+)$/);

    if (deletedIdx !== -1 && match) {
      // Decrement subsequent markers in sorted order
      for (let j = deletedIdx + 1; j < sorted.length; j++) {
        const mToDecrement = sorted[j];
        const oldLabel = mToDecrement.options.originalData.label || mToDecrement.gtName || '';
        const mMatch = oldLabel.match(/^(.*?)(\d+)$/);
        if (mMatch) {
          const mPrefix = mMatch[1];
          const mNum = parseInt(mMatch[2], 10);
          const nextLabel = mPrefix + (mNum - 1);
          mToDecrement.options.originalData.label = nextLabel;
          mToDecrement.options.originalData.ap = nextLabel;
          mToDecrement.gtName = nextLabel;
          if (mToDecrement.options.originalRow && mToDecrement.options.apIdx > -1) {
            mToDecrement.options.originalRow[mToDecrement.options.apIdx] = nextLabel;
          }
        }
      }

      // Force update popups on decremented markers
      for (let j = deletedIdx + 1; j < sorted.length; j++) {
        if (typeof window.getGtPopupContent === 'function') {
          sorted[j].setPopupContent(window.getGtPopupContent);
        }
      }
    }

    targetGroup.gtMarkers = targetGroup.gtMarkers.filter(mx => mx !== m);
    redrawGtLine(targetGroup);
  } else if (rType === 'WP') {
    targetGroup.wpEdges =
        targetGroup.wpEdges.filter(e => e[0] !== m && e[1] !== m);
    if (targetGroup.wpFocusNode === m) targetGroup.wpFocusNode = null;
    targetGroup.wpNodesList = targetGroup.wpNodesList.filter(mx => mx !== m);
    redrawWpLine(targetGroup);
  }

  // Capture GT label states for redo
  const gtRedoLabelSnapshots = [];
  if (rType === 'GT' && targetGroup.gtMarkers) {
    targetGroup.gtMarkers.forEach(mx => {
      gtRedoLabelSnapshots.push({
        marker: mx,
        label: mx.options.originalData.label || '',
        ap: mx.options.originalData.ap || '',
        gtName: mx.gtName || '',
        rowVal: (mx.options.originalRow && mx.options.apIdx > -1) ? mx.options.originalRow[mx.options.apIdx] : null
      });
    });
  }

  const newEdges = targetGroup.wpEdges ? [...targetGroup.wpEdges] : [];
  const newGt = targetGroup.gtMarkers ? [...targetGroup.gtMarkers] : [];
  const newWpNodes = targetGroup.wpNodesList ? [...targetGroup.wpNodesList] : [];
  const newFocus = targetGroup.wpFocusNode;

  pushAction(
      targetGroup,
      () => {  // Undo (Restore)
        targetGroup.addLayer(m);
        allMarkers.push({id: mId, bssid: mBssid, marker: m, data: mData});
        targetGroup.wpEdges = oldEdges;
        targetGroup.gtMarkers = oldGt;
        targetGroup.wpNodesList = oldWpNodes;
        targetGroup.wpFocusNode = oldFocus;

        // Restore Undo labels
        gtUndoLabelSnapshots.forEach(snap => {
          snap.marker.options.originalData.label = snap.label;
          snap.marker.options.originalData.ap = snap.ap;
          snap.marker.gtName = snap.gtName;
          if (snap.rowVal !== null && snap.marker.options.originalRow && snap.marker.options.apIdx > -1) {
            snap.marker.options.originalRow[snap.marker.options.apIdx] = snap.rowVal;
          }
          if (typeof window.getGtPopupContent === 'function') {
            snap.marker.setPopupContent(window.getGtPopupContent);
          }
        });

        redrawGtLine(targetGroup);
        redrawWpLine(targetGroup);
      },
      () => {  // Redo (Delete)
        targetGroup.removeLayer(m);
        allMarkers = allMarkers.filter(item => item.marker !== m);
        targetGroup.wpEdges = newEdges;
        targetGroup.gtMarkers = newGt;
        targetGroup.wpNodesList = newWpNodes;
        targetGroup.wpFocusNode = newFocus;

        // Apply Redo labels
        gtRedoLabelSnapshots.forEach(snap => {
          snap.marker.options.originalData.label = snap.label;
          snap.marker.options.originalData.ap = snap.ap;
          snap.marker.gtName = snap.gtName;
          if (snap.rowVal !== null && snap.marker.options.originalRow && snap.marker.options.apIdx > -1) {
            snap.marker.options.originalRow[snap.marker.options.apIdx] = snap.rowVal;
          }
          if (typeof window.getGtPopupContent === 'function') {
            snap.marker.setPopupContent(window.getGtPopupContent);
          }
        });

        redrawGtLine(targetGroup);
        redrawWpLine(targetGroup);
      });


  if (map.hasLayer(errorLinesLayer)) updateErrorAnalysis();
  activeNudgeMarker = null;

  const name = m.options.originalData.ap || 'Unknown Marker';
  const changeLog = document.getElementById('changeLog');
  if (changeLog) {
    changeLog.value += 'DELETED: ' + name + '\n';
    changeLog.scrollTop = changeLog.scrollHeight;
  }
  const stat = document.getElementById('status');
  if (stat) {
    stat.innerText = 'Deleted ' + name;
    stat.style.color = 'red';
  }
};

document.querySelectorAll('input[name="mapMode"]').forEach(radio => {
  radio.addEventListener('change', function(e) {
    console.log('Map Mode switched to:', this.value);
    
    // Manage Pointer Mode
    if (this.value === 'ADD' || this.value === 'DEL' || this.value === 'EDIT') {
      if (isPointerMode) {
        pointerBtn.click(); // Turn OFF Pointer mode crosshairs when editing/adding/deleting
      }
    }
    
    // Manage Draggable State
    if (this.value === 'EDIT') {
      enableDragging(true);
    } else {
      enableDragging(false);
    }


    
    updateAddPathModeState();
    
    if (typeof updateMapCursorState === 'function') updateMapCursorState();


    const stat = document.getElementById('status');
    if (stat) {
      if (this.value === 'OFF') {
        stat.innerText = 'Mode: Navigation (View Only)';
        stat.style.color = '#555';
      } else if (this.value === 'EDIT') {
        const typeNode = document.querySelector('input[name="addType"]:checked');
        const activeType = typeNode ? typeNode.value : 'AP';
        stat.innerText = 'Mode: Edit ' + activeType + ' (Drag markers to move)';
        stat.style.color = 'green';
      } else if (this.value === 'ADD') {
        stat.innerText = 'Mode: Add Points/Paths';
        stat.style.color = 'blue';
      } else if (this.value === 'DEL') {
        const typeNode = document.querySelector('input[name="addType"]:checked');
        const activeType = typeNode ? typeNode.value : 'AP';
        stat.innerText = 'Mode: Delete ' + activeType + ' (Click to delete)';
        stat.style.color = 'red';
      }
    }
    
    if (typeof allMarkers !== 'undefined') {
      allMarkers.forEach(item => {
        if (item.data) {
          if (item.data.rectype === 'GT') {
            item.marker.bindPopup(window.getGtPopupContent);
          } else if (item.data.rectype === 'AP') {
            item.marker.bindPopup(window.getApPopupContent);
          }
        }
      });
    }

    if (window.swCornerMarker) {
      window.swCornerMarker.bindPopup(function() { return window.getCornerPopupContent(window.swCornerMarker, 'FP SW'); });
    }
    if (window.neCornerMarker) {
      window.neCornerMarker.bindPopup(function() { return window.getCornerPopupContent(window.neCornerMarker, 'FP NE'); });
    }
  });
});

window.addPointOnly = false;
document.querySelectorAll('input[name="addPathMode"]').forEach(radio => {
  radio.addEventListener('change', function(e) {
    window.addPointOnly = (this.value === 'ONLY');
    console.log('addPathMode switched to:', this.value, 'window.addPointOnly =', window.addPointOnly);
  });
});

window.gtDelMode = 'ONLY';

window.setGtDelOption = function(option) {
  window.gtDelMode = option;
  const btnOnly = document.getElementById('delOnlySelectedBtn');
  const btnAll = document.getElementById('delAllBtn');

  if (btnOnly && btnAll) {
    if (option === 'ONLY') {
      btnOnly.classList.add('active');
      btnAll.classList.remove('active');
    } else {
      btnAll.classList.add('active');
      btnOnly.classList.remove('active');
    }
  }
};

function updateGtDelModeState() {
  const mapModeNode = document.querySelector('input[name="mapMode"]:checked');
  const mapMode = mapModeNode ? mapModeNode.value : 'OFF';

  const typeNode = document.querySelector('input[name="addType"]:checked');
  const activeType = typeNode ? typeNode.value : 'AP';

  const gtDelToggleRow = document.getElementById('gtDelToggleRow');
  if (!gtDelToggleRow) return;

  if (mapMode === 'DEL' && activeType === 'GT') {
    gtDelToggleRow.style.display = 'flex';
  } else {
    gtDelToggleRow.style.display = 'none';
    window.setGtDelOption('ONLY');
  }
}

window.deleteAllGtMarkers = function() {
  const stat = document.getElementById('status');
  const gtItemsToDelete = [];

  allMarkers.forEach(item => {
    const d = item.data;
    const rType = String(d.rectype || 'AP').toUpperCase().trim();
    if (rType === 'GT') {
      gtItemsToDelete.push(item);
    }
  });

  if (gtItemsToDelete.length === 0) {
    if (stat) {
      stat.innerText = 'No GT markers found to delete.';
      stat.style.color = 'orange';
    }
    return;
  }

  const allOverlayGroups = (typeof overlays !== 'undefined') ? Object.values(overlays) : [];
  const affectedGroupsSet = new Set();
  gtItemsToDelete.forEach(item => {
    const m = item.marker;
    allOverlayGroups.forEach(lyr => {
      if (lyr && typeof lyr.hasLayer === 'function' && lyr.hasLayer(m)) {
        affectedGroupsSet.add(lyr);
      }
    });
    if (window.activeGroup && typeof window.activeGroup.hasLayer === 'function' && window.activeGroup.hasLayer(m)) {
      affectedGroupsSet.add(window.activeGroup);
    }
  });

  let groupsArray = Array.from(affectedGroupsSet);
  if (groupsArray.length === 0 && window.activeGroup) {
    groupsArray.push(window.activeGroup);
  }

  const deletedMarkerRecords = gtItemsToDelete.map(item => {
    const m = item.marker;
    let parentGroup = null;
    groupsArray.forEach(g => {
      if (g.hasLayer && g.hasLayer(m)) parentGroup = g;
    });
    return {
      item: item,
      marker: m,
      data: item.data,
      id: item.id,
      bssid: item.bssid,
      parentGroup: parentGroup
    };
  });

  // Execute deletion
  deletedMarkerRecords.forEach(rec => {
    if (rec.parentGroup) {
      rec.parentGroup.removeLayer(rec.marker);
      if (rec.parentGroup.gtMarkers) {
        rec.parentGroup.gtMarkers = rec.parentGroup.gtMarkers.filter(mx => mx !== rec.marker);
      }
    } else {
      map.removeLayer(rec.marker);
    }
  });

  allMarkers = allMarkers.filter(item => {
    const rType = String(item.data.rectype || 'AP').toUpperCase().trim();
    return rType !== 'GT';
  });

  groupsArray.forEach(g => {
    if (typeof redrawGtLine === 'function') redrawGtLine(g);
  });

  if (map.hasLayer(errorLinesLayer)) updateErrorAnalysis();

  // Push Undo action to window.undoStack
  pushAction(
    groupsArray,
    () => { // Undo
      deletedMarkerRecords.forEach(rec => {
        if (rec.parentGroup) {
          rec.parentGroup.addLayer(rec.marker);
          if (!rec.parentGroup.gtMarkers) rec.parentGroup.gtMarkers = [];
          if (!rec.parentGroup.gtMarkers.includes(rec.marker)) {
            rec.parentGroup.gtMarkers.push(rec.marker);
          }
        } else {
          map.addLayer(rec.marker);
        }
        if (!allMarkers.some(i => i.marker === rec.marker)) {
          allMarkers.push(rec.item);
        }
      });

      groupsArray.forEach(g => {
        if (typeof redrawGtLine === 'function') redrawGtLine(g);
      });

      if (map.hasLayer(errorLinesLayer)) updateErrorAnalysis();

      if (stat) {
        stat.innerText = `Undo: Restored ${deletedMarkerRecords.length} GT markers.`;
        stat.style.color = 'blue';
      }
    },
    () => { // Redo
      deletedMarkerRecords.forEach(rec => {
        if (rec.parentGroup) {
          rec.parentGroup.removeLayer(rec.marker);
          if (rec.parentGroup.gtMarkers) {
            rec.parentGroup.gtMarkers = rec.parentGroup.gtMarkers.filter(mx => mx !== rec.marker);
          }
        } else {
          map.removeLayer(rec.marker);
        }
      });

      allMarkers = allMarkers.filter(item => {
        const rType = String(item.data.rectype || 'AP').toUpperCase().trim();
        return rType !== 'GT';
      });

      groupsArray.forEach(g => {
        if (typeof redrawGtLine === 'function') redrawGtLine(g);
      });

      if (map.hasLayer(errorLinesLayer)) updateErrorAnalysis();

      if (stat) {
        stat.innerText = `Redo: Deleted ${deletedMarkerRecords.length} GT markers.`;
        stat.style.color = 'blue';
      }
    }
  );

  if (stat) {
    stat.innerText = `Deleted ALL ${deletedMarkerRecords.length} GT markers. Click 'Undo' to restore.`;
    stat.style.color = 'red';
  }
};

const delOnlySelectedBtn = document.getElementById('delOnlySelectedBtn');
const delAllBtn = document.getElementById('delAllBtn');

if (delOnlySelectedBtn) {
  delOnlySelectedBtn.addEventListener('click', function() {
    window.setGtDelOption('ONLY');
    const stat = document.getElementById('status');
    if (stat) {
      stat.innerText = 'GT Delete Mode: Click GT marker to delete ONLY selected.';
      stat.style.color = 'red';
    }
  });
}

if (delAllBtn) {
  delAllBtn.addEventListener('click', function() {
    window.setGtDelOption('ALL');
    window.deleteAllGtMarkers();
  });
}

function updateAddPathModeState() {
  const mapModeNode = document.querySelector('input[name="mapMode"]:checked');
  const mapMode = mapModeNode ? mapModeNode.value : 'OFF';
  
  const typeNode = document.querySelector('input[name="addType"]:checked');
  const activeType = typeNode ? typeNode.value : 'AP';

  const addPathToggleRow = document.getElementById('addPathToggleRow');
  const radioPATH = document.querySelector('input[name="addPathMode"][value="PATH"]');
  const radioONLY = document.querySelector('input[name="addPathMode"][value="ONLY"]');

  if (addPathToggleRow && radioPATH && radioONLY) {
    if (mapMode === 'ADD' && activeType === 'WP') {
      addPathToggleRow.style.display = 'flex';
    } else {
      addPathToggleRow.style.display = 'none';
    }

    if (activeType !== 'WP') {
      if (!radioONLY.checked) {
        radioONLY.checked = true;
        radioONLY.dispatchEvent(new Event('change'));
      }
    }
  }

  updateGtDelModeState();
}

function updateMapCursorState() {
  const mapDiv = document.getElementById('map');
  if (!mapDiv) return;

  mapDiv.classList.remove('pointer-active', 'add-active-AP', 'add-active-GT', 'add-active-WP', 'add-active-CORNERS');

  const mapModeNode = document.querySelector('input[name="mapMode"]:checked');
  const mapMode = mapModeNode ? mapModeNode.value : 'OFF';

  const typeNode = document.querySelector('input[name="addType"]:checked');
  const activeType = typeNode ? typeNode.value : 'AP';

  if (isPointerMode) {
    mapDiv.classList.add('pointer-active');
  } else if (mapMode === 'ADD') {
    mapDiv.classList.add('add-active-' + activeType);
  }
  
  console.log('Map Cursor reconciled. Mode:', mapMode, 'Type:', activeType, 'Pointer:', isPointerMode);
}
window.updateMapCursorState = updateMapCursorState;

document.querySelectorAll('input[name="addType"]').forEach(radio => {
  radio.addEventListener('change', function(e) {
    console.log('Active Type switched to:', this.value);
    
    if (typeof map !== 'undefined') {
      map.closePopup();
    }

    if (typeof allMarkers !== 'undefined') {
      allMarkers.forEach(item => {
        if (item.data) {
          if (item.data.rectype === 'GT') {
            item.marker.bindPopup(window.getGtPopupContent);
          } else if (item.data.rectype === 'AP') {
            item.marker.bindPopup(window.getApPopupContent);
          }
        }
      });
    }

    if (typeof window.swCornerMarker !== 'undefined' && window.swCornerMarker) {
      window.swCornerMarker.bindPopup(function() { return window.getCornerPopupContent(window.swCornerMarker, 'FP SW'); });
    }
    if (typeof window.neCornerMarker !== 'undefined' && window.neCornerMarker) {
      window.neCornerMarker.bindPopup(function() { return window.getCornerPopupContent(window.neCornerMarker, 'FP NE'); });
    }

    updateAddPathModeState();
    updateMapCursorState();

    const stat = document.getElementById('status');
    if (isEditMode) {
      enableDragging(true);
      if (stat) {
        stat.innerText = 'Mode: Edit ' + this.value + ' (Drag markers to move)';
        stat.style.color = 'green';
      }
    } else if (typeof isDelMode !== 'undefined' && isDelMode) {
      if (stat) {
        stat.innerText = 'Mode: Delete ' + this.value + ' (Click to delete)';
        stat.style.color = 'red';
      }
    }
  });
});

function performUndoRedo(isUndo) {

  const sourceStack = isUndo ? window.undoStack : window.redoStack;
  const targetStack = isUndo ? window.redoStack : window.undoStack;
  const stat = document.getElementById('status');



  if (sourceStack.length === 0) {
    if (stat) {
      stat.innerText = 'Nothing to ' + (isUndo ? 'undo.' : 'redo.');
      stat.style.color = 'red';
    }
    return;
  }

  let actionIndex = -1;
  for (let i = sourceStack.length - 1; i >= 0; i--) {
    const action = sourceStack[i];
    const isVisible = action.groups.some(g => {
      const l = g.layer || g;
      return map.hasLayer(l);
    });
    if (isVisible) {
      actionIndex = i;
      break;
    }
  }

  if (actionIndex === -1) {
    if (stat) {
      stat.innerText =
          'No actions to ' + (isUndo ? 'undo' : 'redo') + ' on visible layers.';
      stat.style.color = 'red';
    }
    return;
  }

  const action = sourceStack.splice(actionIndex, 1)[0];
  console.log('performUndoRedo popped action:', action);
  if (isUndo) {
    action.undo();
  } else {
    action.redo();
  }
  targetStack.push(action);

  if (map.hasLayer(errorLinesLayer)) updateErrorAnalysis();
  activeNudgeMarker = null;
  updateDeleteBtn();
  if (stat) {
    stat.innerText = (isUndo ? 'Undo' : 'Redo') + ' successful.';
    stat.style.color = 'blue';
  }
}

document.getElementById('undoBtn').onclick = () => performUndoRedo(true);
document.getElementById('redoBtn').onclick = () => performUndoRedo(false);

pointerBtn.onclick = function() {
  isPointerMode = !isPointerMode;
  if (isPointerMode) {
    pointerBtn.classList.replace('btn-inactive', 'btn-active');
    const offRadio = document.querySelector('input[name="mapMode"][value="OFF"]');
    if (offRadio && !offRadio.checked) {
      offRadio.checked = true;
      offRadio.dispatchEvent(new Event('change'));
    }
  } else {
    pointerBtn.classList.replace('btn-active', 'btn-inactive');
    if (tempMarker) map.removeLayer(tempMarker);
  }
  
  if (typeof updateMapCursorState === 'function') updateMapCursorState();
};


function handleMapClick(lat, lng, isShiftPressed = false, forcedLabel = null) {
  if (coordBox) {
    coordBox.value = `${lat}, ${lng}`;
    coordBox.select();
  }

  if (isPointerMode) {
    if (tempMarker) map.removeLayer(tempMarker);
    const redCrosshairIcon = L.divIcon({
      className: '',
      html: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
               <path d="M16 0 L16 32 M0 16 L32 16" stroke="white" stroke-width="3"/>
               <circle cx="16" cy="16" r="6" stroke="white" stroke-width="3" fill="none"/>
               <path d="M16 2 L16 30 M2 16 L30 16" stroke="red" stroke-width="1.5"/>
               <circle cx="16" cy="16" r="6" stroke="red" stroke-width="1.5" fill="none"/>
               <circle cx="16" cy="16" r="1.2" fill="red"/>
             </svg>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    tempMarker = L.marker([lat, lng], {icon: redCrosshairIcon}).addTo(map);
    return;
  }

  if (isAddMode) {
    const addType = document.querySelector('input[name="addType"]:checked').value;

    if (addType === 'CORNERS') {
      if (!window.swCornerMarker || !window.neCornerMarker) {
        const nLat = parseFloat(lat);
        const nLng = parseFloat(lng);
        const sw = [nLat - 0.0002, nLng - 0.0002];
        const ne = [nLat + 0.0002, nLng + 0.0002];
        storedBounds = [sw, ne];
        createOrUpdateCorners(sw, ne);
        document.getElementById('swCorner').value =
            sw[0].toFixed(7) + ',' + sw[1].toFixed(7);
        document.getElementById('neCorner').value =
            ne[0].toFixed(7) + ',' + ne[1].toFixed(7);
        updateLegend();
        alert(
            "FP Corners created! Turn ON 'Edit' and drag them to set the map bounds.");
      } else {
        alert(
            "FP Corners already exist. Please turn ON 'Edit' and drag the black markers to adjust them.");
      }

      return;
    }

    let activeGroup = null;

    // Check if an "Imported csv" layer for this type exists ANYWHERE in overlays (even if unchecked)
    const importedLayerName = 'Imported csv ' + addType + 's';
    let targetImportedGroup = overlays[importedLayerName];

    
    // For AP, check the standard "Imported APs"
    if (addType === 'AP' && !targetImportedGroup) {
      targetImportedGroup = overlays['Imported APs'];
    }

    if (targetImportedGroup) {
      activeGroup = targetImportedGroup;
      if (!map.hasLayer(activeGroup)) {
        activeGroup.addTo(map);
        updateLegend();
      }
    } else {
      const activeTabs = [];
      Object.keys(overlays).forEach(key => {
        if (key.includes('Tab ID') || key.startsWith('New ')) {
          if (map.hasLayer(overlays[key]))
            activeTabs.push({key: key, layer: overlays[key]});
        }
      });

      const validTabs = activeTabs.filter(
          t => t.key.includes(addType) || t.key.includes('Tab ID'));

      if (validTabs.length === 0) {
        const newLayerName = 'New ' + addType + ' Layer';
        let newGroup = overlays[newLayerName];
        if (!newGroup) {
          newGroup = L.layerGroup();
          newGroup.gtMarkers = [];
          newGroup.wpNodesList = [];
          newGroup.wpEdges = [];
          newGroup.wpFocusNode = null;
          newGroup.tabTemplate = {
            latIdx: 2,
            lngIdx: 3,
            apIdx: 4,
            bssidIdx: 1,
            rectypeIdx: 0,
            areaIdx: 8,
            errorIdx: 5,
            originalRow: new Array(10).fill(''),
            originalData: {rectype: addType, color: 'blue', shape: 'circle'}
          };
          overlays[newLayerName] = newGroup;
        }
        if (!map.hasLayer(newGroup)) newGroup.addTo(map);
        updateLegend();
        activeGroup = newGroup;
        const stat = document.getElementById('status');
        if (stat) {
          stat.innerText = 'Auto-created ' + newLayerName;
          stat.style.color = 'blue';
        }
      } else if (validTabs.length === 1) {
        activeGroup = validTabs[0].layer || validTabs[0];
      } else {
        const exactMatch = validTabs.find(
            t => t.key.startsWith('New ' + addType));
        if (exactMatch) {
          activeGroup = exactMatch.layer || exactMatch;
        } else {
          activeGroup = validTabs[0].layer || validTabs[0];
        }
      }
    }


    if (activeGroup.layer) activeGroup = activeGroup.layer;

    const allGroupMarkers = activeGroup.getLayers().filter(
        l => l instanceof L.Marker && l.options.originalRow);

    let tplOpts;
    if (allGroupMarkers.length === 0) {
      if (!activeGroup.tabTemplate) {
        activeGroup.tabTemplate = {
          latIdx: 2,
          lngIdx: 3,
          apIdx: 4,
          bssidIdx: 1,
          rectypeIdx: 0,
          areaIdx: 8,
          errorIdx: 5,
          originalRow: new Array(10).fill(''),
          originalData: {
            rectype: addType,
            color: (addType === 'AP' ? '#FF9800' : 'blue'),
            shape: 'circle'
          }
        };
      }
      tplOpts = activeGroup.tabTemplate;
    } else {
      tplOpts = allGroupMarkers[0].options;
    }

    const oldEdges = activeGroup.wpEdges ? [...activeGroup.wpEdges] : [];
    const oldGt = activeGroup.gtMarkers ? [...activeGroup.gtMarkers] : [];
    const oldWpNodes =
        activeGroup.wpNodesList ? [...activeGroup.wpNodesList] : [];
    const oldFocus = activeGroup.wpFocusNode;

    let edgeToSplit = null;
    if (addType === 'WP' && activeGroup.wpInsertEdgeIndex !== undefined &&
        activeGroup.wpInsertEdgeIndex !== -1) {
      if (activeGroup.wpEdges &&
          activeGroup.wpEdges.length > activeGroup.wpInsertEdgeIndex) {
        edgeToSplit = activeGroup.wpEdges[activeGroup.wpInsertEdgeIndex];
      }
    }

    let maxNum = -1;
    let prefix = addType + '-';
    let padding = 2;

    allGroupMarkers.forEach(layer => {
      const rType =
          String(layer.options.originalData.rectype || '').toUpperCase().trim();
      if (rType === addType) {
        const existingName = String(layer.options.originalData.ap).trim();
        const match = existingName.match(/^(.*?)(\d+)$/);
        if (match) {
          prefix = match[1];
          const numStr = match[2];
          padding = Math.max(padding, numStr.length);
          const num = parseInt(numStr, 10);
          if (num > maxNum) maxNum = num;
        }
      }
    });

    let newApName = 'NEW_' + addType;
    if (forcedLabel) {
      newApName = forcedLabel;
    } else if (maxNum > -1) {
      const nextNumStr = String(maxNum + 1).padStart(padding, '0');
      newApName = prefix + nextNumStr;
    } else {
      newApName = prefix + '01';
    }

    const newRow = tplOpts.originalRow.slice();

    const newOriginalData = {
      ...tplOpts.originalData,
      ap: newApName,
      bssid: (addType === 'GT') ? '' : ((addType === 'AP') ? (document.getElementById('apDefaultBssid')?.value.trim() || '60:B7:6E:xx:xx:xx') : 'NEW_BSSID'),
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      rectype: addType,
      area: (addType === 'GT') ? '' : ((addType === 'AP') ? (document.getElementById('apDefaultArea')?.value.trim() || 'office') : 'NEW_AREA'),
      label: (addType === 'GT') ? newApName : '', 
      isNewGT: (addType === 'GT'),
      color: (addType === 'AP' ? '#FF9800' : (tplOpts.originalData.color || 'blue')),
      shape: (addType === 'AP' ? 'circle' : (tplOpts.originalData.shape || 'circle'))
    };

    if (addType === 'AP') {
      newOriginalData.height = document.getElementById('apDefaultHeight')?.value.trim() || '2.8';
      newOriginalData.floor = document.getElementById('apDefaultFloor')?.value.trim() || '1';
      
      let defaultMap = document.getElementById('apDefaultFloorplan')?.value.trim();
      if (!defaultMap) {
        let fName = document.getElementById('target-filename').innerText.replace(/\.[^/.]+$/, '');
        if (fName !== 'file') defaultMap = fName;
        else defaultMap = 'UNKNOWN_MAP';
      }
      newOriginalData.map = defaultMap;
      newOriginalData.freq = document.getElementById('apDefaultFreq')?.value.trim() || '-1';
    }

    newRow[tplOpts.latIdx] = lat;
    newRow[tplOpts.lngIdx] = lng;
    if (tplOpts.apIdx > -1) newRow[tplOpts.apIdx] = newApName;
    if (tplOpts.bssidIdx > -1) newRow[tplOpts.bssidIdx] = newOriginalData.bssid;
    if (tplOpts.rectypeIdx > -1) newRow[tplOpts.rectypeIdx] = addType;
    if (tplOpts.areaIdx > -1) newRow[tplOpts.areaIdx] = newOriginalData.area;

    if (addType === 'AP') {
      newRow[5] = newOriginalData.height;
      newRow[6] = newOriginalData.floor;
      newRow[7] = newOriginalData.map;
      if (newOriginalData.freq !== '-1' && newOriginalData.freq !== '') {
        newRow[9] = newOriginalData.freq;
      }
    }


    let myIcon;
    if (addType === 'GT') {
      newOriginalData.height = document.getElementById('gtDefaultHeight')?.value.trim() || '1.0';
      newOriginalData.error = document.getElementById('gtDefaultError')?.value.trim() || '0.1';
      newRow[5] = newOriginalData.height;
      if (tplOpts.errorIdx > -1) newRow[tplOpts.errorIdx] = newOriginalData.error;
      myIcon = L.divIcon({


        className: '',
        html:
            `<div class="custom-marker-css shape-circle" style="background:green;"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
        popupAnchor: [0, -6]
      });
    } else if (addType === 'WP') {
      myIcon = L.divIcon({
        className: '',
        html:
            `<div class="custom-marker-css shape-circle" style="background:yellow;"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
        popupAnchor: [0, -6]
      });
    } else if (addType === 'AP') {
      myIcon = L.divIcon({
        className: '',
        html:
            `<div class="custom-marker-css shape-circle" style="background:purple;"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
        popupAnchor: [0, -6]
      });
    } else {

      const apTpl = allGroupMarkers.find(
          l => String(l.options.originalData.rectype).toUpperCase().trim() ===
              addType);
      const tplData = apTpl ? apTpl.options.originalData : tplOpts.originalData;
      const shapeRaw = String(tplData.shape || 'circle').toLowerCase().trim();
      const color = tplData.color || 'blue';
      if (shapeRaw === 'teardrop' || shapeRaw === 'pin' ||
          shapeRaw === 'marker') {
        myIcon = createTeardropIcon(color);
      } else {
        const sClass = 'shape-' + shapeRaw;
        myIcon = L.divIcon({
          className: '',
          html: `<div class="custom-marker-css ${sClass}" style="background:${
              color};"></div>`,
          iconSize: [10, 10],
          iconAnchor: [5, 5],
          popupAnchor: [0, -6]
        });
      }
    }


    const m = L.marker([lat, lng], {
      icon: myIcon,
      zIndexOffset: 1000,
      draggable: true,
      originalRow: newRow,
      latIdx: tplOpts.latIdx,
      lngIdx: tplOpts.lngIdx,
      apIdx: tplOpts.apIdx,
      bssidIdx: tplOpts.bssidIdx,
      rectypeIdx: tplOpts.rectypeIdx,
      areaIdx: tplOpts.areaIdx,
      errorIdx: tplOpts.errorIdx,
      originalData: newOriginalData
    });

    attachMarkerEvents(m, activeGroup);
    activeNudgeMarker = m;
    updateDeleteBtn();

    if (addType === 'GT') {
      m.gtName = newApName;
      if (!activeGroup.gtMarkers) activeGroup.gtMarkers = [];
      activeGroup.gtMarkers.push(m);
    }

    if (addType === 'WP') {
      if (!activeGroup.wpEdges) activeGroup.wpEdges = [];

      const pathTag = document.getElementById('wpPathTag') ?
          document.getElementById('wpPathTag').value.trim() || 'aisle' :
          'aisle';

      if (edgeToSplit) {
        const oldM1 = edgeToSplit[0];
        const oldM2 = edgeToSplit[1];
        const inheritedTag = edgeToSplit[2] || pathTag;

        activeGroup.wpEdges.splice(activeGroup.wpInsertEdgeIndex, 1);
        activeGroup.wpEdges.push([oldM1, m, inheritedTag]);
        activeGroup.wpEdges.push([m, oldM2, inheritedTag]);

        if (activeGroup.wpFocusNode && activeGroup.wpFocusNode !== m && !window.addPointOnly) {
          console.log('Connecting focus node to newly created WP-on-edge point.');
          activeGroup.wpEdges.push([activeGroup.wpFocusNode, m, pathTag]);
        }

        activeGroup.wpFocusNode = m;
        activeGroup.wpInsertEdgeIndex = -1;
      } else {
        if (activeGroup.wpFocusNode && !isShiftPressed && !window.addPointOnly) {
          console.log('Connecting focus node to new WP point.');
          activeGroup.wpEdges.push([activeGroup.wpFocusNode, m, pathTag]);
        } else {
          console.log('Skipping WP Edge Creation due to Shift key or Point-ONLY mode.');
        }
        activeGroup.wpFocusNode = m;
      }
      if (!activeGroup.wpNodesList) activeGroup.wpNodesList = [];
      activeGroup.wpNodesList.push(m);
      redrawWpLine(activeGroup);
    }


    if (addType === 'GT') {
      if (typeof window.getGtPopupContent === 'function') {
        m.bindPopup(window.getGtPopupContent);
      } else {
        const defaultHeight = document.getElementById('gtDefaultHeight')?.value.trim() || '1.0';
        const defaultError  = document.getElementById('gtDefaultError')?.value.trim()  || '0.1';
        const defaultLabelPrefix = 'GT-';
        m.bindPopup(`<div style="font-size:13px;"><b>Label:</b> ${defaultLabelPrefix}<br><b>Height(M):</b> ${defaultHeight}<br><b>Error(M):</b> ${defaultError}<br><i style="color:red">Ready to drag/paste</i></div>`);
      }
    } else if (addType === 'AP') {
      if (typeof window.getApPopupContent === 'function') {
        m.bindPopup(window.getApPopupContent);
      } else {
        const defaultBssid = document.getElementById('apDefaultBssid')?.value.trim() || '60:B7:6E:xx:xx:xx';
        m.bindPopup(`<div style="font-size:13px;"><b>AP#:</b> ${newApName}<br><b>BSSID:</b> ${defaultBssid}<br><i style="color:red">Ready to drag/paste</i></div>`);
      }
    } else if (addType === 'WP') {
      m.bindPopup(`<div style="font-size:13px;"><b>Label:</b> ${newApName}<br><i style="color:red">Ready to drag/paste</i></div>`);
    } else {
      m.bindPopup(`<div style="font-size:13px;"><b>${addType}#:</b> ${
          newApName}<br><b>BSSID:</b> NEW_BSSID<br><i style="color:red">Ready to drag/paste</i></div>`);
    }

    activeGroup.addLayer(m);


    if (addType === 'GT') redrawGtLine(activeGroup);

    m.openPopup();

    allMarkers.push({
      id: newApName,
      bssid: 'NEW_BSSID',
      marker: m,
      data: m.options.originalData
    });

    const newEdges = activeGroup.wpEdges ? [...activeGroup.wpEdges] : [];
    const newGt = activeGroup.gtMarkers ? [...activeGroup.gtMarkers] : [];
    const newWpNodes =
        activeGroup.wpNodesList ? [...activeGroup.wpNodesList] : [];
    const newFocus = activeGroup.wpFocusNode;

    pushAction(
        activeGroup,
        () => {
          activeGroup.removeLayer(m);
          allMarkers = allMarkers.filter(item => item.marker !== m);
          activeGroup.wpEdges = oldEdges;
          activeGroup.gtMarkers = oldGt;
          activeGroup.wpNodesList = oldWpNodes;
          activeGroup.wpFocusNode = oldFocus;
          redrawGtLine(activeGroup);
          redrawWpLine(activeGroup);
        },
        () => {
          activeGroup.addLayer(m);
          allMarkers.push({
            id: newApName,
            bssid: (addType === 'GT') ? '' : 'NEW_BSSID',
            marker: m,
            data: m.options.originalData
          });
          activeGroup.wpEdges = newEdges;
          activeGroup.gtMarkers = newGt;
          activeGroup.wpNodesList = newWpNodes;
          activeGroup.wpFocusNode = newFocus;
          redrawGtLine(activeGroup);
          redrawWpLine(activeGroup);
        });

    logAndCopy(newRow);
  }
}

map.on('click', function(e) {
  if (window.preventMapClick) return;
  handleMapClick(
      e.latlng.lat.toFixed(7), e.latlng.lng.toFixed(7),
      e.originalEvent.shiftKey);
});

document.querySelectorAll('input[name="addType"]').forEach(radio => {
  radio.addEventListener('change', function(e) {
    const addType = e.target.value;
    if (addType === 'CORNERS') return;

    const importedCsvName = 'Imported csv ' + addType + 's';
    const importedApName = 'Imported APs';
    
    const hasTypeSpecificLayer = Object.keys(overlays).some(k => 
      k === importedCsvName ||
      k === importedApName ||
      k.includes('Imported csv ' + addType) ||
      k.includes('New ' + addType + ' Layer')
    );
    const hasGenericLayer = Object.keys(overlays).some(k => k.includes('Tab ID'));

    if (!hasTypeSpecificLayer && !hasGenericLayer) {
      const newLayerName = 'New ' + addType + ' Layer';
      const newGroup = L.layerGroup();
      newGroup.gtMarkers = [];
      newGroup.wpNodesList = [];
      newGroup.wpEdges = [];
      newGroup.wpFocusNode = null;
      newGroup.tabTemplate = {
        latIdx: 2,
        lngIdx: 3,
        apIdx: 4,
        bssidIdx: 1,
        rectypeIdx: 0,
        areaIdx: 8,
        errorIdx: 5,
        originalRow: new Array(10).fill(''),
        originalData: {rectype: addType, color: 'blue', shape: 'circle'}
      };
      overlays[newLayerName] = newGroup;
      newGroup.addTo(map);
      updateLegend();

      const stat = document.getElementById('status');
      if (stat) {
        stat.innerText = 'Auto-created ' + newLayerName;
        stat.style.color = 'blue';
      }
    }
  });
});


window.resetAllToolData = function() {
  document.getElementById('error-box').style.display = 'none';
  document.getElementById('fallback-container').style.display = 'none';
  document.getElementById('changeLog').value = '';

  if (layerControl) {
    map.removeControl(layerControl);
    layerControl = null;
  }
  overlays = {};
  allMarkers = [];
  currentMatches = [];
  lastSearchTerm = '';
  const searchStatusNode = document.getElementById('searchStatus');
  if (searchStatusNode) searchStatusNode.innerText = '';
  
  window.undoStack = [];
  window.redoStack = [];
  activeNudgeMarker = null;
  if (typeof updateDeleteBtn === 'function') updateDeleteBtn();

  if (imageOverlayLayer && map.hasLayer(imageOverlayLayer)) {
    map.removeLayer(imageOverlayLayer);
    imageOverlayLayer = null;
  }

  map.eachLayer((layer) => {
    if (!layer._url && layer !== tempMarker && layer !== osmLayer && layer !== googleLayer && layer !== googleEarthLayer) {
      map.removeLayer(layer);
    }
  });

  if (errorLinesLayer && typeof errorLinesLayer.clearLayers === 'function') {
    errorLinesLayer.clearLayers();
  }

  window.importedParams = [];
  window.importedBdFloor = '1';
  window.swCornerMarker = null;
  window.neCornerMarker = null;
  storedBounds = null;

  // Reset Status
  if (statusDiv) {
    statusDiv.innerText = '';
  }

  // Reset AP Defaults
  const apDefaultBssid = document.getElementById('apDefaultBssid');
  if (apDefaultBssid) apDefaultBssid.value = '60:B7:6E:xx:xx:xx';
  const apDefaultHeight = document.getElementById('apDefaultHeight');
  if (apDefaultHeight) apDefaultHeight.value = '2.8';
  const apDefaultFloor = document.getElementById('apDefaultFloor');
  if (apDefaultFloor) apDefaultFloor.value = '1';
  const apDefaultFloorplan = document.getElementById('apDefaultFloorplan');
  if (apDefaultFloorplan) apDefaultFloorplan.value = '';
  const apDefaultArea = document.getElementById('apDefaultArea');
  if (apDefaultArea) apDefaultArea.value = 'office';
  const apDefaultFreq = document.getElementById('apDefaultFreq');
  if (apDefaultFreq) apDefaultFreq.value = '-1';

  // Reset GT Defaults
  const gtDefaultHeight = document.getElementById('gtDefaultHeight');
  if (gtDefaultHeight) gtDefaultHeight.value = '1.0';
  const gtDefaultError = document.getElementById('gtDefaultError');
  if (gtDefaultError) gtDefaultError.value = '0.1';

  // Reset WP Defaults
  const wpPathTag = document.getElementById('wpPathTag');
  if (wpPathTag) wpPathTag.value = 'aisle';

  // Reset Show checkboxes
  const toggleParamsBtn = document.getElementById('toggleParamsBtn');
  if (toggleParamsBtn) {
    toggleParamsBtn.checked = false;
    toggleParamsBtn.dispatchEvent(new Event('change'));
  }
  const toggleNudgeBtn = document.getElementById('toggleNudgeBtn');
  if (toggleNudgeBtn) {
    toggleNudgeBtn.checked = false;
    toggleNudgeBtn.dispatchEvent(new Event('change'));
  }
  const toggleChangelogBtn = document.getElementById('toggleChangelogBtn');
  if (toggleChangelogBtn) {
    toggleChangelogBtn.checked = false;
    toggleChangelogBtn.dispatchEvent(new Event('change'));
  }
};

window.loadSheetUrl = async function(url) {
  const statusDiv = document.getElementById('status');
  statusDiv.innerText = 'Step 1: Reading Config...';
  statusDiv.style.color = 'blue';

  window.resetAllToolData();

  const idMatch = url.match(new RegExp('/d/([a-zA-Z0-9-_]+)'));
  if (!idMatch) {
    statusDiv.innerText = 'Invalid Sheet URL';
    statusDiv.style.color = 'red';
    return;
  }
  const sheetId = idMatch[1];
  const keyMatch = url.match(/[?&]resourcekey=([a-zA-Z0-9-_]+)/);
  const resourceKey = keyMatch ? keyMatch[1] : '';
  const userPathMatch = url.match(/\/u\/(\d+)\//);
  const authUserParamMatch = url.match(/[?&]authuser=(\d+)/);
  const userIdx = userPathMatch ?
      userPathMatch[1] :
      (authUserParamMatch ? authUserParamMatch[1] : null);
  window.currentSheetUserPrefix = userIdx !== null ? `u/${userIdx}/` : '';
  window.workingSheetUserPrefix = '';

  try {
    const configRows = await fetchTab(sheetId, '0', resourceKey);

    if (!configRows || configRows.length === 0) {
      const isNonHttps = window.location.protocol !== 'https:';
      statusDiv.innerText =
          'Error: Failed to read from Google Sheets. Check link sharing permissions.' +
          (isNonHttps ?
               '\nNote: Authenticated Google Workspace sheets require login cookies, which browsers block on ' +
                   window.location.protocol +
                   '// pages. Open this tool via https:// (or use a public sheet / CSV export).' :
               '');
      statusDiv.style.color = 'red';
      return;
    }

    const config = parseConfig(configRows);

    document.getElementById('sheetGids').value = config.gids || '';
    document.getElementById('swCorner').value = config.sw || '';
    document.getElementById('neCorner').value = config.ne || '';

    loadedConfigGkey = config.gkey;

    let fileName = (config.map1 || '').trim();
    if (fileName && !fileName.toLowerCase().endsWith('.png') && 
        !fileName.toLowerCase().endsWith('.jpg') && 
        !fileName.toLowerCase().endsWith('.jpeg') && 
        !fileName.toLowerCase().endsWith('.webp')) {
      fileName += '.png';
    }

    let path = (config.path || '').trim();
    if (path === './') path = '';
    if (path && !path.endsWith('/') && !path.endsWith('\\')) path += '/';

    const fullPath = path + fileName;

    document.getElementById('fullMapPath').value = fullPath;
    document.getElementById('target-filename').innerText = fileName;
    if (typeof window.saveRecentSheetUrl === 'function') {
      window.saveRecentSheetUrl(url, config.map1 || fileName || sheetId);
    }

    // BASE MAP
    const baseVal = document.querySelector('input[name="baseMap"]:checked').value;
    const wantsGoogle = (baseVal === 'google' || baseVal === 'google-earth');
    const googleType = (baseVal === 'google-earth') ? 'hybrid' : 'roadmap';

    if (wantsGoogle && loadedConfigGkey) {
      try {
        statusDiv.innerText = 'Loading Google Maps...';
        await loadGoogleMapsApi(loadedConfigGkey);

        [baseLayers.osm, baseLayers.roadmap, baseLayers.hybrid].forEach(l => {
          if (l && map.hasLayer(l)) map.removeLayer(l);
        });

        const typeKey = googleType === 'hybrid' ? 'hybrid' : 'roadmap';
        setTimeout(() => {
          if (!baseLayers[typeKey]) {
            baseLayers[typeKey] =
                L.gridLayer.googleMutant({type: googleType, maxZoom: 22});
          }
          baseLayers[typeKey].addTo(map);
          statusDiv.innerText = (baseVal === 'google-earth') ?
              'Google Earth Loaded.' :
              'Google Maps Loaded.';
          statusDiv.style.color = 'green';
        }, 50);

      } catch (e) {
        console.error(e);
        statusDiv.innerText = 'Warning: Failed to load Google Maps. Using OSM.';
        document.getElementById('mapOsm').checked = true;
        if (!map.hasLayer(baseLayers.osm)) baseLayers.osm.addTo(map);
      }
    } else if (wantsGoogle && !loadedConfigGkey) {
      statusDiv.innerText =
          'Warning: Google Maps selected but MAP-GKEY missing. Using OSM.';
      document.getElementById('mapOsm').checked = true;
      if (!map.hasLayer(baseLayers.osm)) baseLayers.osm.addTo(map);
    } else {
      [baseLayers.roadmap, baseLayers.hybrid].forEach(l => {
        if (l && map.hasLayer(l)) map.removeLayer(l);
      });
      if (!map.hasLayer(baseLayers.osm)) baseLayers.osm.addTo(map);
    }

    const bounds = L.latLngBounds();
    let hasBounds = false;

    // CORNERS
    if (config.sw && config.ne) {
      const sw = String(config.sw).split(',').map(Number);
      const ne = String(config.ne).split(',').map(Number);
      if (!isNaN(sw[0]) && !isNaN(ne[0])) {
        storedBounds = [sw, ne];
        createOrUpdateCorners(sw, ne);
        bounds.extend(sw);
        bounds.extend(ne);
        hasBounds = true;
      }
    }

    // IMAGE
    if (fileName && storedBounds) {
      if (!window.isReloadingPreviousFiles) {
        try {
          if (typeof window.promptForFloorplan === 'function') {
            window.promptForFloorplan(fileName);
          } else {
            console.error('window.promptForFloorplan is NOT a function! Launching fallback UI.');
            const fallbackContainer = document.getElementById('fallback-container');
            if (fallbackContainer) {
              fallbackContainer.style.display = 'block';
              fallbackContainer.style.background = '#fff3cd';
              fallbackContainer.style.border = '2px solid #ffc107';
              fallbackContainer.scrollIntoView({behavior: 'smooth', block: 'center'});
            }
            if (statusDiv) {
              statusDiv.innerHTML = `<span style='color:#856404; font-weight:bold;'>Action Required:</span> Click 'Choose File' below to load Floorplan Image ('${fileName}').`;
            }
          }
        } catch (e) {
          console.error('Exception invoking promptForFloorplan:', e);
          const fallbackContainer = document.getElementById('fallback-container');
          if (fallbackContainer) {
            fallbackContainer.style.display = 'block';
            fallbackContainer.style.background = '#fff3cd';
            fallbackContainer.style.border = '2px solid #ffc107';
            fallbackContainer.scrollIntoView({behavior: 'smooth', block: 'center'});
          }
          if (statusDiv) {
            statusDiv.innerHTML = `<span style='color:#856404; font-weight:bold;'>Action Required:</span> Click 'Choose File' below to load Floorplan Image ('${fileName}').`;
          }
        }
      }
    }



    // MARKERS
    if (!config.gids) {
      statusDiv.innerText = 'Config Loaded. GIDS empty or missing.';
      updateLegend();
      return;
    }

    const gids = String(config.gids).split(',').map(s => s.trim());
    let hasData = false;
    let markerCount = 0;

    statusDiv.innerText = `Step 2: Loading Markers...`;

    for (let i = 0; i < gids.length; i++) {
      const gid = gids[i];
      const result = await fetchTab(sheetId, gid, resourceKey, true);
      const data = result.markers || [];

      const tabLayer = L.layerGroup();
      tabLayer.gtMarkers = [];
      tabLayer.wpNodesList = [];
      tabLayer.wpEdges = [];
      tabLayer.wpFocusNode = null;

      const latI = result.latIdx > -1 ? result.latIdx : 2;
      const lngI = result.lngIdx > -1 ? result.lngIdx : 3;
      const apI = result.apIdx > -1 ? result.apIdx : 4;
      const bssidI = result.bssidIdx > -1 ? result.bssidIdx : 1;
      const recI = result.rectypeIdx > -1 ? result.rectypeIdx : 0;
      const areaI = result.areaIdx > -1 ? result.areaIdx : 8;
      const errI = result.errorIdx > -1 ? result.errorIdx : 5;
      const maxI = Math.max(latI, lngI, apI, bssidI, recI, areaI, errI, 10);

      tabLayer.tabTemplate = {
        latIdx: latI,
        lngIdx: lngI,
        apIdx: apI,
        bssidIdx: bssidI,
        rectypeIdx: recI,
        areaIdx: areaI,
        errorIdx: errI,
        originalRow: new Array(maxI + 1).fill(''),
        originalData: {rectype: 'AP', color: 'purple', shape: 'circle'}
      };

      const validMarkers = data.filter(r => {

        const t = String(r.rectype).toUpperCase().trim();
        const isTargetType = (t === 'AP' || t === 'GT' || t === 'WP');
        const hasValidCoords =
            (r.lat !== undefined && r.lng !== undefined && !isNaN(r.lat) &&
             !isNaN(r.lng));
        return isTargetType && hasValidCoords;
      });

      if (validMarkers.length > 0) {
        hasData = true;

        validMarkers.forEach(d => {
          const rType = String(d.rectype).toUpperCase().trim();
          let myIcon;

          if (rType === 'GT') {
            myIcon = L.divIcon({
              className: '',
              html:
                  `<div class="custom-marker-css shape-circle" style="background:green;"></div>`,
              iconSize: [10, 10],
              iconAnchor: [5, 5],
              popupAnchor: [0, -6]
            });
          } else if (rType === 'WP') {
            myIcon = L.divIcon({
              className: '',
              html:
                  `<div class="custom-marker-css shape-circle" style="background:yellow;"></div>`,
              iconSize: [10, 10],
              iconAnchor: [5, 5],
              popupAnchor: [0, -6]
            });
          } else {
            const shapeRaw = String(d.shape).toLowerCase().trim();
            const color = d.color;
            if (shapeRaw === 'teardrop' || shapeRaw === 'pin' ||
                shapeRaw === 'marker') {
              myIcon = createTeardropIcon(color);
            } else {
              const sClass = 'shape-' + shapeRaw;
              myIcon = L.divIcon({
                className: '',
                html: `<div class="custom-marker-css ${
                    sClass}" style="background:${color};"></div>`,
                iconSize: [10, 10],
                iconAnchor: [5, 5],
                popupAnchor: [0, -6]
              });
            }
          }

          const m = L.marker([d.lat, d.lng], {
            icon: myIcon,
            zIndexOffset: 1000,
            draggable: false,
            originalRow: d.fullRow,
            latIdx: result.latIdx,
            lngIdx: result.lngIdx,
            apIdx: result.apIdx,
            bssidIdx: result.bssidIdx,
            rectypeIdx: result.rectypeIdx,
            areaIdx: result.areaIdx,
            errorIdx: result.errorIdx,
            originalData: d
          });

          attachMarkerEvents(m, tabLayer);

          if (rType === 'GT') {
            m.gtName = d.ap;
            tabLayer.gtMarkers.push(m);
          }

          if (rType === 'WP') {
            tabLayer.wpNodesList.push(m);
          }

          if (rType === 'GT') {
            if (typeof window.getGtPopupContent === 'function') {
              m.bindPopup(window.getGtPopupContent);
            } else {
              const defaultHeight = document.getElementById('gtDefaultHeight')?.value.trim() || '1.0';
              const defaultError  = document.getElementById('gtDefaultError')?.value.trim()  || '0.1';
              const defaultLabelPrefix = 'GT-';
              const finalGTLabel = d.label || (defaultLabelPrefix + markerCount);
              m.bindPopup(`<div style="font-size:13px;"><b>Label:</b> ${finalGTLabel}<br><b>Height(M):</b> ${defaultHeight}<br><b>Error(M):</b> ${defaultError}</div>`);
            }
          } else if (rType === 'AP') {
            if (typeof window.getApPopupContent === 'function') {
              m.bindPopup(window.getApPopupContent);
            } else {
              const basePopup = `<div style="font-size:13px;"><b>AP#:</b> ${
                  d.ap || 'N/A'}<br><b>BSSID:</b> ${d.bssid || 'N/A'}</div>`;
              m.bindPopup(basePopup);
            }
          } else {
            const basePopup = `<div style="font-size:13px;"><b>Label:</b> ${
                d.ap || 'N/A'}</div>`;
            m.bindPopup(basePopup);
          }
          tabLayer.addLayer(m);



          allMarkers.push({id: d.ap, bssid: d.bssid, marker: m, data: d});
          bounds.extend([d.lat, d.lng]);
          markerCount++;
        });

        if (tabLayer.wpNodesList && tabLayer.wpNodesList.length > 0) {
          tabLayer.wpNodesList.sort(
              (a, b) =>
                  String(a.options.originalData.ap || '')
                      .localeCompare(
                          String(b.options.originalData.ap || ''), undefined,
                          {numeric: true, sensitivity: 'base'}));
          tabLayer.wpEdges = [];
          const pathTag = document.getElementById('wpPathTag') ?
              document.getElementById('wpPathTag').value.trim() || 'aisle' :
              'aisle';
          for (let k = 0; k < tabLayer.wpNodesList.length - 1; k++) {
            tabLayer.wpEdges.push([
              tabLayer.wpNodesList[k], tabLayer.wpNodesList[k + 1], pathTag
            ]);
          }
          tabLayer.wpFocusNode =
              tabLayer.wpNodesList[tabLayer.wpNodesList.length - 1];
        }

        redrawGtLine(tabLayer);
        redrawWpLine(tabLayer);
      }

      tabLayer.addTo(map);
      overlays['Tab ID: ' + gid] = tabLayer;
    }

    overlays['Show Error Lines'] = errorLinesLayer;
    updateLegend();

    if (hasData || hasBounds) {
      window.floorplanResetBounds = bounds;
      map.fitBounds(bounds, {padding: [20, 20]});
      if (document.getElementById('fallback-container').style.display !==
          'block') {

        statusDiv.innerText = `Success! ${markerCount} features plotted.`;
        statusDiv.style.color = 'green';
      }
    } else {
      statusDiv.innerText = 'Loaded Empty Tabs successfully.';
      statusDiv.style.color = 'purple';
    }

    const offRadio = document.querySelector('input[name="mapMode"][value="OFF"]');
    if (offRadio && !offRadio.checked) {
      offRadio.checked = true;
      offRadio.dispatchEvent(new Event('change'));
    }
    if (isPointerMode && typeof pointerBtn !== 'undefined') pointerBtn.click();

  } catch (e) {
    console.error(e);
    statusDiv.innerText = 'Error: ' + e.message;
    statusDiv.style.color = 'red';
  }
};

// --- GOOGLE SHEETS PICKER / BROWSE & AUTO-FILL (OPTION 2) ---
window.awaitingSheetSelection = false;

window.extractSpreadsheetUrl = function(text) {
  if (!text || typeof text !== 'string') return null;
  const match = text.trim().match(
      /https:\/\/docs\.google\.com\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9-_]+)[^\s"']*/);
  return match ? match[0] : null;
};

window.getRecentSheetUrls = function() {
  let list = [];
  try {
    const raw = localStorage.getItem('recentSheetUrls');
    if (raw) list = JSON.parse(raw);
    if (!Array.isArray(list)) list = [];
  } catch (e) {
    list = [];
  }
  const lastUrl = localStorage.getItem('lastSheetUrl');
  const validLast = window.extractSpreadsheetUrl(lastUrl);
  if (validLast && !list.some(item => item.url === validLast)) {
    list.unshift({url: validLast, label: 'Previous Sheet'});
  }
  return list;
};

window.renderRecentSheetsDatalist = function() {
  const datalist = document.getElementById('recentSheetsList');
  if (!datalist) return;
  const list = window.getRecentSheetUrls();
  datalist.innerHTML = '';
  list.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.url;
    if (item.label) opt.label = item.label;
    datalist.appendChild(opt);
  });
};

window.saveRecentSheetUrl = function(url, label) {
  const cleanUrl = window.extractSpreadsheetUrl(url);
  if (!cleanUrl) return;
  let list = window.getRecentSheetUrls();
  const existingIdx = list.findIndex(item => item.url === cleanUrl);
  const existingLabel = existingIdx >= 0 ? list[existingIdx].label : '';
  if (existingIdx >= 0) {
    list.splice(existingIdx, 1);
  }
  list.unshift(
      {url: cleanUrl, label: label || existingLabel || 'Google Sheet'});
  if (list.length > 15) list = list.slice(0, 15);
  try {
    localStorage.setItem('recentSheetUrls', JSON.stringify(list));
  } catch (e) {
  }
  window.renderRecentSheetsDatalist();
};

window.setAwaitingSheetState = function(active) {
  window.awaitingSheetSelection = active;
  const sheetBox = document.getElementById('sheetUrl');
  if (sheetBox) {
    sheetBox.style.outline = active ? '2px solid #FF9800' : '';
    sheetBox.style.backgroundColor = active ? '#fff8e1' : '';
  }
};

window.applySelectedSheetUrl = async function(rawText) {
  const matchedUrl = window.extractSpreadsheetUrl(rawText);
  if (!matchedUrl) return false;

  window.setAwaitingSheetState(false);
  const sheetBox = document.getElementById('sheetUrl');
  if (sheetBox) {
    sheetBox.value = matchedUrl;
  }
  localStorage.setItem('lastSheetUrl', matchedUrl);
  localStorage.setItem('lastLoadType', 'sheet');
  window.saveRecentSheetUrl(matchedUrl);
  await window.loadSheetUrl(matchedUrl);
  return true;
};

window.openSheetsBrowser = function() {
  window.setAwaitingSheetState(true);
  const statusDiv = document.getElementById('status');
  if (statusDiv) {
    statusDiv.innerText = 'Opened Google Sheets.\n' +
        '1. Open your spreadsheet and copy its URL (Ctrl+L, Ctrl+C).\n' +
        '2. Return to this window (or press Ctrl+V) to auto-fill & load.';
    statusDiv.style.color = '#1976D2';
  }
  const sheetBox = document.getElementById('sheetUrl');
  if (sheetBox) {
    sheetBox.focus();
    sheetBox.select();
  }
  window.open(
      'https://sheets.google.com', 'GoogleSheetsPicker',
      'width=1100,height=780,resizable=yes,scrollbars=yes');
};

window.tryAutoReadSheetClipboard = async function() {
  if (!window.awaitingSheetSelection) return;
  const sheetBox = document.getElementById('sheetUrl');
  if (sheetBox) {
    sheetBox.focus();
    sheetBox.select();
  }
  if (navigator.clipboard &&
      typeof navigator.clipboard.readText === 'function') {
    try {
      const clipText = await navigator.clipboard.readText();
      const matchedUrl = window.extractSpreadsheetUrl(clipText);
      if (matchedUrl) {
        await window.applySelectedSheetUrl(matchedUrl);
      }
    } catch (err) {
      // Clipboard read may require Ctrl+V on non-HTTPS origins; input is
      // already focused & selected.
    }
  }
};

window.addEventListener('focus', () => {
  if (window.awaitingSheetSelection) {
    window.tryAutoReadSheetClipboard();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && window.awaitingSheetSelection) {
    window.tryAutoReadSheetClipboard();
  }
});

document.addEventListener('paste', e => {
  if (!window.awaitingSheetSelection &&
      document.activeElement !== document.getElementById('sheetUrl')) {
    return;
  }
  const pastedText =
      (e.clipboardData || window.clipboardData)?.getData('text') || '';
  const matchedUrl = window.extractSpreadsheetUrl(pastedText);
  if (matchedUrl) {
    e.preventDefault();
    window.applySelectedSheetUrl(matchedUrl);
  }
});

const sheetUrlInputNode = document.getElementById('sheetUrl');
if (sheetUrlInputNode) {
  window.renderRecentSheetsDatalist();
  sheetUrlInputNode.addEventListener('input', function() {
    const val = this.value.trim();
    localStorage.setItem('lastSheetUrl', val);
    const matchedUrl = window.extractSpreadsheetUrl(val);
    if (matchedUrl &&
        window.getRecentSheetUrls().some(item => item.url === matchedUrl)) {
      window.applySelectedSheetUrl(matchedUrl);
    }
  });
}

const browseSheetsBtn = document.getElementById('browseSheetsBtn');
if (browseSheetsBtn) {
  browseSheetsBtn.onclick = function() {
    window.openSheetsBrowser();
  };
}

document.getElementById('plotBtn').onclick = async function() {
  const url = document.getElementById('sheetUrl').value.trim();
  const matchedUrl = window.extractSpreadsheetUrl(url);
  if (!matchedUrl) {
    window.openSheetsBrowser();
    return;
  }
  window.setAwaitingSheetState(false);
  localStorage.setItem('lastSheetUrl', matchedUrl);
  localStorage.setItem('lastLoadType', 'sheet');
  window.saveRecentSheetUrl(matchedUrl);
  await window.loadSheetUrl(matchedUrl);
};

window.resetParams = function() {
  const sheetBox = document.getElementById('sheetUrl');
  if (sheetBox) sheetBox.value = 'https://sheets.google.com';

  document.getElementById('opacitySlider').value = 0.8;
  const opacityEvent = new Event('input');
  document.getElementById('opacitySlider').dispatchEvent(opacityEvent);

  document.getElementById('fullMapPath').value = '';
  document.getElementById('swCorner').value = '';
  document.getElementById('neCorner').value = '';
  document.getElementById('sheetGids').value = '';
  document.getElementById('searchBox').value = '';
  const searchStatusNode = document.getElementById('searchStatus');
  if (searchStatusNode) searchStatusNode.innerText = '';
  document.getElementById('coordOutput').value = '';
  document.getElementById('nudgeStep').value = '0.000001';
  document.getElementById('changeLog').value = '';
  
  ['statCount', 'statRmse', 'stat50', 'stat90', 'statMax'].forEach(id => {
    const node = document.getElementById(id);
    if (node) node.innerText = '-';
  });

  // Reset AP Defaults
  const apDefaultBssid = document.getElementById('apDefaultBssid');
  if (apDefaultBssid) apDefaultBssid.value = '60:B7:6E:xx:xx:xx';
  const apDefaultHeight = document.getElementById('apDefaultHeight');
  if (apDefaultHeight) apDefaultHeight.value = '2.8';
  const apDefaultFloor = document.getElementById('apDefaultFloor');
  if (apDefaultFloor) apDefaultFloor.value = '1';
  const apDefaultFloorplan = document.getElementById('apDefaultFloorplan');
  if (apDefaultFloorplan) apDefaultFloorplan.value = '';
  const apDefaultArea = document.getElementById('apDefaultArea');
  if (apDefaultArea) apDefaultArea.value = 'office';
  const apDefaultFreq = document.getElementById('apDefaultFreq');
  if (apDefaultFreq) apDefaultFreq.value = '-1';

  // Reset GT Defaults
  const gtDefaultHeight = document.getElementById('gtDefaultHeight');
  if (gtDefaultHeight) gtDefaultHeight.value = '1.0';
  const gtDefaultError = document.getElementById('gtDefaultError');
  if (gtDefaultError) gtDefaultError.value = '0.1';

  // Reset WP Defaults
  const wpPathTag = document.getElementById('wpPathTag');
  if (wpPathTag) wpPathTag.value = 'aisle';

  // Reset Show checkboxes
  const toggleParamsBtn = document.getElementById('toggleParamsBtn');
  if (toggleParamsBtn) {
    toggleParamsBtn.checked = false;
    toggleParamsBtn.dispatchEvent(new Event('change'));
  }
  const toggleNudgeBtn = document.getElementById('toggleNudgeBtn');
  if (toggleNudgeBtn) {
    toggleNudgeBtn.checked = false;
    toggleNudgeBtn.dispatchEvent(new Event('change'));
  }
  const toggleChangelogBtn = document.getElementById('toggleChangelogBtn');
  if (toggleChangelogBtn) {
    toggleChangelogBtn.checked = false;
    toggleChangelogBtn.dispatchEvent(new Event('change'));
  }

  const fallback = document.getElementById('fallback-container');
  if (fallback) fallback.style.display = 'none';
  const manualFile = document.getElementById('manualFile');
  if (manualFile) manualFile.value = '';

  document.getElementById('mapOsm').checked = true;
  const baseEvent = new Event('change');
  document.getElementById('mapOsm').dispatchEvent(baseEvent);

  const addTypeAP = document.querySelector('input[name="addType"][value="AP"]');
  if (addTypeAP) addTypeAP.checked = true;

  const pathModePATH = document.querySelector('input[name="addPathMode"][value="PATH"]');
  if (pathModePATH) {
    pathModePATH.checked = true;
    pathModePATH.dispatchEvent(new Event('change'));
  }

  const offRadio = document.querySelector('input[name="mapMode"][value="OFF"]');
  if (offRadio && !offRadio.checked) {
    offRadio.checked = true;
    offRadio.dispatchEvent(new Event('change'));
  }
  if (isPointerMode && typeof pointerBtn !== 'undefined') pointerBtn.click();


  const statusDiv = document.getElementById('status');
  if (statusDiv) {
    statusDiv.innerText = 'Params Reset to Defaults.';
    statusDiv.style.color = 'purple';
  }
};

document.getElementById('resetParamsBtn').onclick = window.resetParams;

document.getElementById('reloadPrevBtn').onclick = async function() {
  const loadType = localStorage.getItem('lastLoadType');
  const sheetUrl = localStorage.getItem('lastSheetUrl');
  const csvHandle = await getHandle('csvHandle');
  const csvFile = localStorage.getItem('lastCsvFile');
  const osmHandle = await getHandle('osmHandle');
  const osmFile = localStorage.getItem('lastOsmFile');
  const pngHandle = await getHandle('pngHandle');
  const pngFile = localStorage.getItem('lastPngFile');

  if (!sheetUrl && !csvHandle && !csvFile && !osmHandle && !osmFile && !pngHandle && !pngFile) {
    alert('No previously loaded files or Sheet URLs found.');
    return;
  }

  const statusDiv = document.getElementById('status');
  if (statusDiv) {
    statusDiv.innerText = 'Reloading Previous Files...';
    statusDiv.style.color = 'blue';
  }

  window.isReloadingPreviousFiles = true;

  let csvText = null;
  let csvName = null;
  if (loadType === 'csv' && (csvHandle || csvFile)) {
    if (csvHandle) {
      try {
        let granted = await csvHandle.queryPermission({ mode: 'read' }) === 'granted';
        if (!granted) {
          granted = await csvHandle.requestPermission({ mode: 'read' }) === 'granted';
        }
        if (granted) {
          const file = await csvHandle.getFile();
          csvText = await file.text();
          csvName = file.name;
        } else {
          alert('Permission denied for CSV file.');
          window.isReloadingPreviousFiles = false;
          return;
        }
      } catch (err) {
        console.error('Error synchronously accessing CSV handle:', err);
        alert('Error reading CSV handle: ' + err.message);
      }
    } else if (csvFile) {
      csvName = csvFile;
      try {
        const response = await fetch(csvFile);
        if (response.ok) {
          csvText = await response.text();
        } else {
          console.warn('Fallback fetch for CSV file failed with 404.');
        }
      } catch (err) {
        console.warn('Fallback fetch for CSV file error:', err);
      }
    }
  }

  let osmText = null;
  let osmName = null;
  if (osmHandle || osmFile) {
    if (osmHandle) {
      try {
        let granted = await osmHandle.queryPermission({ mode: 'read' }) === 'granted';
        if (!granted) {
          granted = await osmHandle.requestPermission({ mode: 'read' }) === 'granted';
        }
        if (granted) {
          const file = await osmHandle.getFile();
          osmText = await file.text();
          osmName = file.name;
        } else {
          alert('Permission denied for OSM file.');
          window.isReloadingPreviousFiles = false;
          return;
        }
      } catch (err) {
        console.error('Error synchronously accessing OSM handle:', err);
        alert('Error reading OSM handle: ' + err.message);
      }
    } else if (osmFile) {
      osmName = osmFile;
      try {
        const response = await fetch(osmFile);
        if (response.ok) {
          osmText = await response.text();
        } else {
          console.warn('Fallback fetch for OSM file failed with 404.');
        }
      } catch (err) {
        console.warn('Fallback fetch for OSM file error:', err);
      }
    }
  }

  let pngResult = null;
  let pngName = null;
  if (pngHandle || pngFile) {
    if (pngHandle) {
      try {
        let granted = await pngHandle.queryPermission({ mode: 'read' }) === 'granted';
        if (!granted) {
          granted = await pngHandle.requestPermission({ mode: 'read' }) === 'granted';
        }
        if (granted) {
          const file = await pngHandle.getFile();
          pngName = file.name;
          pngResult = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
          });
        } else {
          console.warn('Permission denied for persistent Floorplan Image handle.');
        }
      } catch (err) {
        console.warn('Error accessing Floorplan PNG handle:', err);
      }
    } else if (pngFile) {
      pngName = pngFile;
      try {
        const response = await fetch(pngFile);
        if (response.ok) {
          const blob = await response.blob();
          pngResult = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        } else {
          console.warn('Fallback fetch for Floorplan PNG failed with 404.');
        }
      } catch (err) {
        console.warn('Fallback fetch for Floorplan PNG error:', err);
      }
    }
  }

  const sheetBox = document.getElementById('sheetUrl');
  if (sheetBox && sheetUrl) {
    sheetBox.value = sheetUrl;
  }

  if (loadType === 'sheet' && sheetUrl) {
    const sheetRadio = document.getElementById('fileModeSheet');
    if (sheetRadio) {
      sheetRadio.checked = true;
      if (typeof window.updateFileSourceModeUI === 'function')
        window.updateFileSourceModeUI();
    }
    await window.loadSheetUrl(sheetUrl);
  } else if (loadType === 'csv' && (csvText || csvName)) {
    const configRadio = document.getElementById('fileModeConfig');
    if (configRadio) {
      configRadio.checked = true;
      if (typeof window.updateFileSourceModeUI === 'function')
        window.updateFileSourceModeUI();
    }
    if (csvText) {
      const csvBox = document.getElementById('csvConfigPath');
      if (csvBox) csvBox.value = csvName;
      window.processCsvConfigContent(csvText, csvName);
    } else if (csvName && statusDiv) {
      statusDiv.innerText = `Warning: Could not reload local CSV file '${csvName}' automatically. Please use the blue 'Load' button to re-select it.`;
      statusDiv.style.color = 'orange';
    }
  }

  if (osmText || osmName) {
    setTimeout(() => {
      if (statusDiv) {
        const currentStatus = statusDiv.innerText;
        if (osmText) {
          statusDiv.innerText = currentStatus + '\nLoading OSM Routes...';
          const osmBox = document.getElementById('osmPath');
          if (osmBox) osmBox.value = osmName;
          window.processOsmContent(osmText, osmName);
        } else if (osmName) {
          statusDiv.innerText = currentStatus + `\nWarning: Could not reload local OSM file '${osmName}' automatically. Please use the blue 'Load' button to re-select it.`;
          statusDiv.style.color = 'orange';
        }
      }
    }, 700);
  }

  if (pngResult || pngName) {
    setTimeout(() => {
      if (pngResult && storedBounds) {
        if (imageOverlayLayer && map.hasLayer(imageOverlayLayer)) {
          map.removeLayer(imageOverlayLayer);
        }
        const opacitySlider = document.getElementById('opacitySlider');
        imageOverlayLayer = L.imageOverlay(pngResult, storedBounds, {
                               opacity: parseFloat(opacitySlider ? opacitySlider.value : 0.8),
                               zIndex: 1
                             }).addTo(map);
        overlays['FP Layer'] = imageOverlayLayer;
        updateLegend();

        if (storedBounds && storedBounds.length === 2) {
          try {
            const swBox = document.getElementById('swCorner');
            const neBox = document.getElementById('neCorner');
            if (storedBounds && storedBounds.length === 2 && storedBounds[0] && storedBounds[1]) {
              const swObj = (typeof storedBounds[0].lat === 'number') ? storedBounds[0] : [storedBounds[0][0], storedBounds[0][1]];
              const neObj = (typeof storedBounds[1].lat === 'number') ? storedBounds[1] : [storedBounds[1][0], storedBounds[1][1]];
              const bnds = L.latLngBounds(swObj, neObj);
              window.floorplanResetBounds = bnds;
              map.fitBounds(bnds, {padding: [20, 20]});
            }
            if (typeof createOrUpdateCorners === 'function') {
              createOrUpdateCorners(storedBounds[0], storedBounds[1]);
            } else if (swBox && neBox) {
              const swLat = (storedBounds[0] && typeof storedBounds[0].lat === 'number') ? storedBounds[0].lat : (storedBounds[0][0] || 0);
              const swLng = (storedBounds[0] && typeof storedBounds[0].lng === 'number') ? storedBounds[0].lng : (storedBounds[0][1] || 0);
              const neLat = (storedBounds[1] && typeof storedBounds[1].lat === 'number') ? storedBounds[1].lat : (storedBounds[1][0] || 0);
              const neLng = (storedBounds[1] && typeof storedBounds[1].lng === 'number') ? storedBounds[1].lng : (storedBounds[1][1] || 0);
              swBox.value = parseFloat(swLat).toFixed(7) + ',' + parseFloat(swLng).toFixed(7);
              neBox.value = parseFloat(neLat).toFixed(7) + ',' + parseFloat(neLng).toFixed(7);
            }
          } catch (cornerErr) {
            console.warn('Failsafe corner update exception:', cornerErr);
          }
        }
        
        const fallbackContainer = document.getElementById('fallback-container');

        if (fallbackContainer) fallbackContainer.style.display = 'none';


        if (statusDiv) {
          const currentStatus = statusDiv.innerText;
          statusDiv.innerText = currentStatus + `\nFloorplan Image Loaded: ${pngName}`;
          statusDiv.style.color = 'green';
        }
      } else if (pngName) {
        const fallbackContainer = document.getElementById('fallback-container');
        if (fallbackContainer) {
          fallbackContainer.style.display = 'block';
          fallbackContainer.style.background = '#fff3cd';
          fallbackContainer.style.border = '2px solid #ffc107';
          fallbackContainer.scrollIntoView({behavior: 'smooth', block: 'center'});
        }
        if (statusDiv) {
          const currentStatus = statusDiv.innerText;
          statusDiv.innerHTML = currentStatus + `<br><span style='color:#856404; font-weight:bold;'>Action Required:</span> Click 'Choose File' below to load Floorplan Image ('${pngName}').`;
          statusDiv.style.color = 'orange';
        }
      }
      
      // Cleanup the reloading flag!
      window.isReloadingPreviousFiles = false;
    }, 1400);
  } else {
    // Cleanup reloading flag instantly if no image
    setTimeout(() => {
      window.isReloadingPreviousFiles = false;
    }, 1400);
  }
};

const sidebarObj = document.getElementById('sidebar');
const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');

if (sidebarToggleBtn && sidebarObj) {
  sidebarToggleBtn.onclick = function(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
    console.log('Sidebar Toggle Button Clicked. isCollapsed:', isCollapsed);
    if (isCollapsed) {
      this.innerText = '>';
      this.title = 'Expand Left Panel';
    } else {
      this.innerText = '<';
      this.title = 'Minimize Left Panel';
    }
    if (typeof map !== 'undefined' && map && typeof map.invalidateSize === 'function') {
      setTimeout(() => {
        console.log('Invoking map.invalidateSize() post-sidebar-toggle.');
        map.invalidateSize();
      }, 250);
    }
  };
}

