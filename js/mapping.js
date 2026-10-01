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
 * @fileoverview Leaflet mapping and marker management for RTT Map Tool.
 * @suppress {lintChecks}
 */

const dbName = 'RttMapToolDB';
const storeName = 'handles';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = function(e) {
      const db = e.target.result;
      db.createObjectStore(storeName);
    };
    request.onsuccess = function(e) {
      resolve(e.target.result);
    };
    request.onerror = function(e) {
      reject(e.target.error);
    };
  });
}

async function saveHandle(key, handle) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(handle, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to save handle to IndexedDB:', err);
  }
}

async function getHandle(key) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to get handle from IndexedDB:', err);
    return null;
  }
}

const mapContainer = document.getElementById('map');
if (mapContainer != null && mapContainer._leaflet_id !== undefined) {
  mapContainer._leaflet_id = null;
}

const baseLayers = {
  osm: L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 22,
        maxNativeZoom: 19,
        attribution: 'OpenStreetMap'
      }),
  roadmap: null,
  hybrid: null
};

window.swCornerMarker = null;
window.neCornerMarker = null;

const map = L.map('map', {
  maxZoom: 22
}).setView([0, 0], 2);
baseLayers.osm.addTo(map);

map.on('popupopen', function(e) {
  if (typeof window.shouldShowMarkerPopup === 'function' &&
      !window.shouldShowMarkerPopup()) {
    map.closePopup(e.popup);
  }
});

window.floorplanResetBounds = null;

if (map.zoomControl && map.zoomControl.getContainer()) {
  const zoomContainer = map.zoomControl.getContainer();
  const resetBtn = L.DomUtil.create('a', '', zoomContainer);
  resetBtn.innerHTML = '&#x21bb;';
  resetBtn.href = '#';
  resetBtn.title = 'Reset Floorplan Zoom';
  resetBtn.setAttribute('role', 'button');
  resetBtn.setAttribute('aria-label', 'Reset Floorplan Zoom');
  resetBtn.style.fontSize = '16px';
  resetBtn.style.fontWeight = 'bold';
  resetBtn.style.color = '#333';

  L.DomEvent.on(resetBtn, 'click', function (e) {
    L.DomEvent.preventDefault(e);
    L.DomEvent.stopPropagation(e);
    const stat = document.getElementById('status');
    
    if (window.floorplanResetBounds) {
      map.fitBounds(window.floorplanResetBounds, {padding: [20, 20]});
      if (stat) {
        stat.innerText = 'Zoom Reset to Floorplan bounds.';
        stat.style.color = 'green';
      }
    } else if (storedBounds && storedBounds.length === 2 && storedBounds[0] && storedBounds[1]) {
      try {
        const swObj = (typeof storedBounds[0].lat === 'number') ? storedBounds[0] : [storedBounds[0][0], storedBounds[0][1]];
        const neObj = (typeof storedBounds[1].lat === 'number') ? storedBounds[1] : [storedBounds[1][0], storedBounds[1][1]];
        const bnds = L.latLngBounds(swObj, neObj);
        map.fitBounds(bnds, {padding: [20, 20]});
        if (stat) {
          stat.innerText = 'Zoom Reset to Active Floorplan bounds.';
          stat.style.color = 'green';
        }
      } catch (err) {
        console.warn('Reset Zoom fallback execution failed:', err);
        if (stat) {
          stat.innerText = 'Error resetting zoom.';
          stat.style.color = 'red';
        }
      }
    } else {
      if (stat) {
        stat.innerText = 'No Floorplan Loaded to Reset Zoom.';
        stat.style.color = 'orange';
      }
    }
  });
}



let layerControl = null;

let overlays = {};
let imageOverlayLayer = null;
const errorLinesLayer = L.layerGroup();

let tempMarker = null;
let storedBounds = null;

let allMarkers = [];
const addedSessionMarkers = [];

function createTeardropIcon(color) {
  const svgString =
      `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36" class="svg-marker-filter"><path fill="${
          color}" stroke="white" stroke-width="1" d="M12 0C5.373 0 0 5.373 0 12c0 8 12 24 12 24s12-16 12-24c0-6.627-5.373-12-12-12z"/><circle fill="white" cx="12" cy="12" r="4"/></svg>`;
  return L.divIcon({
    className: '',
    html: svgString,
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36]
  });
}

function createOrUpdateCorners(sw, ne) {
  let cornerLayer = overlays['FP Corners'];

  const swLat = (sw && typeof sw.lat === 'number') ? sw.lat : ((sw && typeof sw[0] === 'number') ? sw[0] : 0);
  const swLng = (sw && typeof sw.lng === 'number') ? sw.lng : ((sw && typeof sw[1] === 'number') ? sw[1] : 0);
  const neLat = (ne && typeof ne.lat === 'number') ? ne.lat : ((ne && typeof ne[0] === 'number') ? ne[0] : 0);
  const neLng = (ne && typeof ne.lng === 'number') ? ne.lng : ((ne && typeof ne[1] === 'number') ? ne[1] : 0);

  const swBox = document.getElementById('swCorner');
  const neBox = document.getElementById('neCorner');
  if (swBox && swLat !== 0) swBox.value = parseFloat(swLat).toFixed(7) + ',' + parseFloat(swLng).toFixed(7);
  if (neBox && neLat !== 0) neBox.value = parseFloat(neLat).toFixed(7) + ',' + parseFloat(neLng).toFixed(7);

  if (cornerLayer) {
    if (map.hasLayer(cornerLayer)) map.removeLayer(cornerLayer);
    cornerLayer.clearLayers();
  } else {
    cornerLayer = L.layerGroup();
  }

  overlays['FP Corners'] = cornerLayer;

  window.swCornerMarker = L.marker(sw, {
    icon: createTeardropIcon('black'),
    zIndexOffset: 2000,
    draggable: isEditMode,
    isCorner: true,
    cornerType: 'SW'
  });
  window.neCornerMarker = L.marker(ne, {
    icon: createTeardropIcon('black'),
    zIndexOffset: 2000,
    draggable: isEditMode,
    isCorner: true,
    cornerType: 'NE'
  });

  window.handleCornerDrag = function() {
    if (!window.swCornerMarker || !window.neCornerMarker) return;
    const newSW = window.swCornerMarker.getLatLng();
    const newNE = window.neCornerMarker.getLatLng();
    const bnds = L.latLngBounds(newSW, newNE);

    const swBox = document.getElementById('swCorner');
    const neBox = document.getElementById('neCorner');
    if (swBox) swBox.value = newSW.lat.toFixed(7) + ',' + newSW.lng.toFixed(7);
    if (neBox) neBox.value = newNE.lat.toFixed(7) + ',' + newNE.lng.toFixed(7);
    
    storedBounds = [[newSW.lat, newSW.lng], [newNE.lat, newNE.lng]];

    if (imageOverlayLayer) {
      imageOverlayLayer.setBounds(bnds);
    }

    if (window.swCornerMarker.getPopup()) {
      window.swCornerMarker.getPopup().setContent(window.getCornerPopupContent(window.swCornerMarker, 'FP SW'));
    }
    if (window.neCornerMarker.getPopup()) {
      window.neCornerMarker.getPopup().setContent(window.getCornerPopupContent(window.neCornerMarker, 'FP NE'));
    }
  };

  const handleCornerDrag = window.handleCornerDrag;


  window.swCornerMarker.on('drag', handleCornerDrag);
  window.neCornerMarker.on('drag', handleCornerDrag);

  window.swCornerMarker.on('click', function(ev) {
    activeNudgeMarker = this;
    const ll = this.getLatLng();
    const coordBox = document.getElementById('coordOutput');
    if (coordBox) {
      coordBox.value = `${ll.lat.toFixed(7)}, ${ll.lng.toFixed(7)}`;
    }
    if (typeof window.shouldShowMarkerPopup === 'function' &&
        !window.shouldShowMarkerPopup()) {
      this.closePopup();
      const stat = document.getElementById('status');
      if (stat) {
        stat.innerText = `Selected FP SW Corner (${ll.lat.toFixed(7)}, ${
            ll.lng.toFixed(7)})`;
        stat.style.color = 'blue';
      }
    }
  });
  window.neCornerMarker.on('click', function(ev) {
    activeNudgeMarker = this;
    const ll = this.getLatLng();
    const coordBox = document.getElementById('coordOutput');
    if (coordBox) {
      coordBox.value = `${ll.lat.toFixed(7)}, ${ll.lng.toFixed(7)}`;
    }
    if (typeof window.shouldShowMarkerPopup === 'function' &&
        !window.shouldShowMarkerPopup()) {
      this.closePopup();
      const stat = document.getElementById('status');
      if (stat) {
        stat.innerText = `Selected FP NE Corner (${ll.lat.toFixed(7)}, ${
            ll.lng.toFixed(7)})`;
        stat.style.color = 'blue';
      }
    }
  });

  window.swCornerMarker.on('dragstart', function(ev) {
    activeNudgeMarker = this;
    this._origLatLng = this.getLatLng();
  });
  window.neCornerMarker.on('dragstart', function(ev) {
    activeNudgeMarker = this;
    this._origLatLng = this.getLatLng();
  });

  window.swCornerMarker.on('dragend', function(ev) {
    activeNudgeMarker = this;
    const origLL = this._origLatLng;
    const newLL = this.getLatLng();
    const cl = document.getElementById('changeLog');
    
    if (cl) {
      cl.value += 'BD SW Corner Moved: ' + document.getElementById('swCorner').value + '\n';
      cl.scrollTop = cl.scrollHeight;
    }

    pushAction(
      cornerLayer,
      () => {
        console.log('Undo: Restoring SW Corner to', origLL);
        window.swCornerMarker.setLatLng(origLL);
        if (typeof window.handleCornerDrag === 'function') window.handleCornerDrag();
      },
      () => {
        console.log('Redo: Moving SW Corner to', newLL);
        window.swCornerMarker.setLatLng(newLL);
        if (typeof window.handleCornerDrag === 'function') window.handleCornerDrag();
      }
    );
  });

  window.neCornerMarker.on('dragend', function(ev) {
    activeNudgeMarker = this;
    const origLL = this._origLatLng;
    const newLL = this.getLatLng();
    const cl = document.getElementById('changeLog');
    
    if (cl) {
      cl.value += 'BD NE Corner Moved: ' + document.getElementById('neCorner').value + '\n';
      cl.scrollTop = cl.scrollHeight;
    }

    pushAction(
      cornerLayer,
      () => {
        console.log('Undo: Restoring NE Corner to', origLL);
        window.neCornerMarker.setLatLng(origLL);
        if (typeof window.handleCornerDrag === 'function') window.handleCornerDrag();
      },
      () => {
        console.log('Redo: Moving NE Corner to', newLL);
        window.neCornerMarker.setLatLng(newLL);
        if (typeof window.handleCornerDrag === 'function') window.handleCornerDrag();
      }
    );
  });



  window.swCornerMarker
      .bindPopup(function() { return window.getCornerPopupContent(window.swCornerMarker, 'FP SW'); })
      .addTo(cornerLayer);
  window.neCornerMarker
      .bindPopup(function() { return window.getCornerPopupContent(window.neCornerMarker, 'FP NE'); })
      .addTo(cornerLayer);

  attachCornerPopupEvents(window.swCornerMarker, 'FP SW', cornerLayer);
  attachCornerPopupEvents(window.neCornerMarker, 'FP NE', cornerLayer);

  if (!map.hasLayer(cornerLayer)) cornerLayer.addTo(map);
  updateLegend();
}

function attachMarkerEvents(m, targetGroup) {
  m.on('dragstart', function(ev) {
    activeNudgeMarker = this;
    this._origLatLng = this.getLatLng();
    this._origRow = this.options.originalRow.slice();
  });

  m.on('popupopen', function(e) {
    activeNudgeMarker = this;
    const rType = m.options.originalData?.rectype;
    if (!rType) return;

    const popupContainer = e.popup.getElement();
    if (!popupContainer) return;

    if (rType === 'GT') {
      const editBtn = popupContainer.querySelector('.gt-edit-popup-btn');
      if (editBtn) {
        editBtn.addEventListener('click', function(clickEv) {
          L.DomEvent.stopPropagation(clickEv);
          const data = m.options.originalData || {};
          const currentLabel = window.getGtMarkerLabel(m);
          const currentHeight = data.height || '';
          const currentError = data.error || '';

          const editFormHtml = `
            <div style="font-size:13px; min-width: 140px;">
              <b>Label:</b> ${currentLabel}<br>
              <label style="display:block; margin-top:5px; font-weight:bold;">Height(M):</label>
              <input type="text" id="gtPopupHeightVal" value="${currentHeight}" style="width:100%; box-sizing:border-box; margin-top:2px; padding:3px; font-size:12px;">
              <label style="display:block; margin-top:5px; font-weight:bold;">Error(M):</label>
              <input type="text" id="gtPopupErrorVal" value="${currentError}" style="width:100%; box-sizing:border-box; margin-top:2px; padding:3px; font-size:12px;">
              <div style="display:flex; justify-content:space-between; margin-top:8px; gap:5px;">
                <button class="gt-save-popup-btn" style="background:#4CAF50; color:white; border:none; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:11px;">Save</button>
                <button class="gt-cancel-popup-btn" style="background:#f44336; color:white; border:none; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:11px;">Cancel</button>
              </div>
            </div>
          `;
          e.popup.setContent(editFormHtml);

          const newPopupContainer = e.popup.getElement();
          const saveBtn = newPopupContainer.querySelector('.gt-save-popup-btn');
          const cancelBtn = newPopupContainer.querySelector('.gt-cancel-popup-btn');

          saveBtn.addEventListener('click', function(saveEv) {
            L.DomEvent.stopPropagation(saveEv);
            const newHeight = newPopupContainer.querySelector('#gtPopupHeightVal').value.trim();
            const newError = newPopupContainer.querySelector('#gtPopupErrorVal').value.trim();

            const oldHeight = m.options.originalData.height;
            const oldError = m.options.originalData.error;

            m.options.originalData.height = newHeight;
            m.options.originalData.error = newError;
            if (m.options.originalRow) {
              m.options.originalRow[5] = newHeight;
              if (m.options.errorIdx > -1) {
                m.options.originalRow[m.options.errorIdx] = newError;
              }
            }

            if (typeof pushAction === 'function') {
              console.log('GT Edit Save: Pushing to stack. Old:', {oldHeight, oldError}, 'New:', {newHeight, newError});
              pushAction(
                targetGroup,
                () => {
                  console.log('GT Edit Undo: Restoring:', {oldHeight, oldError});
                  m.options.originalData.height = oldHeight;
                  m.options.originalData.error = oldError;
                  if (m.options.originalRow) {
                    m.options.originalRow[5] = oldHeight;
                    if (m.options.errorIdx > -1) m.options.originalRow[m.options.errorIdx] = oldError;
                  }
                  m.closePopup();
                },
                () => {
                  console.log('GT Edit Redo: Applying:', {newHeight, newError});
                  m.options.originalData.height = newHeight;
                  m.options.originalData.error = newError;
                  if (m.options.originalRow) {
                    m.options.originalRow[5] = newHeight;
                    if (m.options.errorIdx > -1) m.options.originalRow[m.options.errorIdx] = newError;
                  }
                  m.closePopup();
                }
              );
            }

            e.popup.setContent(window.getGtPopupContent(m));
            m.bindPopup(window.getGtPopupContent);
          });

          cancelBtn.addEventListener('click', function(cancelEv) {
            L.DomEvent.stopPropagation(cancelEv);
            e.popup.setContent(window.getGtPopupContent(m));
            m.bindPopup(window.getGtPopupContent);
          });
        });
      }
    } else if (rType === 'AP') {
      const editBtn = popupContainer.querySelector('.ap-edit-popup-btn');
      if (editBtn) {
        editBtn.addEventListener('click', function(clickEv) {
          L.DomEvent.stopPropagation(clickEv);
          const data = m.options.originalData || {};
          
          const currentName = data.ap || '';
          const currentBssid = data.bssid || '';
          const currentHeight = data.height || '';
          const currentFloor = data.floor || '';
          const currentMap = data.map || '';
          const currentArea = data.area || '';
          const currentFreq = data.freq || '';

          const editFormHtml = `
            <div style="font-size:13px; min-width: 160px; max-height: 250px; overflow-y: auto; padding-right: 5px;">
              <b>Edit AP Parameters</b><hr style="margin:4px 0;">
              <label style="display:block; margin-top:4px; font-weight:bold;">Label:</label>
              <input type="text" id="apPopupNameVal" value="${currentName}" style="width:100%; box-sizing:border-box; margin-top:2px; padding:2px; font-size:12px;">
              
              <label style="display:block; margin-top:4px; font-weight:bold;">BSSID:</label>
              <input type="text" id="apPopupBssidVal" value="${currentBssid}" style="width:100%; box-sizing:border-box; margin-top:2px; padding:2px; font-size:12px;">
              
              <label style="display:block; margin-top:4px; font-weight:bold;">Height(M):</label>
              <input type="text" id="apPopupHeightVal" value="${currentHeight}" style="width:100%; box-sizing:border-box; margin-top:2px; padding:2px; font-size:12px;">
              
              <label style="display:block; margin-top:4px; font-weight:bold;">Floor:</label>
              <input type="text" id="apPopupFloorVal" value="${currentFloor}" style="width:100%; box-sizing:border-box; margin-top:2px; padding:2px; font-size:12px;">
              
              <label style="display:block; margin-top:4px; font-weight:bold;">Map:</label>
              <input type="text" id="apPopupMapVal" value="${currentMap}" style="width:100%; box-sizing:border-box; margin-top:2px; padding:2px; font-size:12px;">
              
              <label style="display:block; margin-top:4px; font-weight:bold;">Area:</label>
              <input type="text" id="apPopupAreaVal" value="${currentArea}" style="width:100%; box-sizing:border-box; margin-top:2px; padding:2px; font-size:12px;">
              
              <label style="display:block; margin-top:4px; font-weight:bold;">Freq(Hz):</label>
              <input type="text" id="apPopupFreqVal" value="${currentFreq}" style="width:100%; box-sizing:border-box; margin-top:2px; padding:2px; font-size:12px;">
              
              <div style="display:flex; justify-content:space-between; margin-top:8px; gap:5px; padding-bottom:5px;">
                <button class="ap-save-popup-btn" style="background:#4CAF50; color:white; border:none; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:11px;">Save</button>
                <button class="ap-cancel-popup-btn" style="background:#f44336; color:white; border:none; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:11px;">Cancel</button>
              </div>
            </div>
          `;
          e.popup.setContent(editFormHtml);

          const newPopupContainer = e.popup.getElement();
          const saveBtn = newPopupContainer.querySelector('.ap-save-popup-btn');
          const cancelBtn = newPopupContainer.querySelector('.ap-cancel-popup-btn');

          saveBtn.addEventListener('click', function(saveEv) {
            L.DomEvent.stopPropagation(saveEv);
            const newName = newPopupContainer.querySelector('#apPopupNameVal').value.trim();
            const newBssid = newPopupContainer.querySelector('#apPopupBssidVal').value.trim();
            const newHeight = newPopupContainer.querySelector('#apPopupHeightVal').value.trim();
            const newFloor = newPopupContainer.querySelector('#apPopupFloorVal').value.trim();
            const newMap = newPopupContainer.querySelector('#apPopupMapVal').value.trim();
            const newArea = newPopupContainer.querySelector('#apPopupAreaVal').value.trim();
            const newFreq = newPopupContainer.querySelector('#apPopupFreqVal').value.trim();

            const oldName = m.options.originalData.ap;
            const oldBssid = m.options.originalData.bssid;
            const oldHeight = m.options.originalData.height;
            const oldFloor = m.options.originalData.floor;
            const oldMap = m.options.originalData.map;
            const oldArea = m.options.originalData.area;
            const oldFreq = m.options.originalData.freq;

            const applyChanges = (name, bssid, height, floor, mapName, area, freq) => {
              m.options.originalData.ap = name;
              m.options.originalData.bssid = bssid;
              m.options.originalData.height = height;
              m.options.originalData.floor = floor;
              m.options.originalData.map = mapName;
              m.options.originalData.area = area;
              m.options.originalData.freq = freq;

              if (m.options.originalRow) {
                if (m.options.apIdx > -1) m.options.originalRow[m.options.apIdx] = name;
                if (m.options.bssidIdx > -1) m.options.originalRow[m.options.bssidIdx] = bssid;
                m.options.originalRow[5] = height;
                m.options.originalRow[6] = floor;
                m.options.originalRow[7] = mapName;
                if (m.options.areaIdx > -1) m.options.originalRow[m.options.areaIdx] = area;
                if (freq !== '-1' && freq !== '') {
                  m.options.originalRow[9] = freq;
                } else {
                  m.options.originalRow[9] = '-1';
                }
              }
            };

            applyChanges(newName, newBssid, newHeight, newFloor, newMap, newArea, newFreq);

            if (typeof pushAction === 'function') {
              console.log('AP Edit Save: Pushing to stack. Old:', {oldName, oldBssid, oldHeight, oldFloor, oldMap, oldArea, oldFreq}, 'New:', {newName, newBssid, newHeight, newFloor, newMap, newArea, newFreq});
              pushAction(
                targetGroup,
                () => {
                  console.log('AP Edit Undo: Restoring:', {oldName, oldBssid, oldHeight, oldFloor, oldMap, oldArea, oldFreq});
                  applyChanges(oldName, oldBssid, oldHeight, oldFloor, oldMap, oldArea, oldFreq);
                  m.closePopup();
                  if (map.hasLayer(errorLinesLayer) && typeof updateErrorAnalysis === 'function') {
                    updateErrorAnalysis();
                  }
                },
                () => {
                  console.log('AP Edit Redo: Applying:', {newName, newBssid, newHeight, newFloor, newMap, newArea, newFreq});
                  applyChanges(newName, newBssid, newHeight, newFloor, newMap, newArea, newFreq);
                  m.closePopup();
                  if (map.hasLayer(errorLinesLayer) && typeof updateErrorAnalysis === 'function') {
                    updateErrorAnalysis();
                  }
                }
              );
            }

            e.popup.setContent(window.getApPopupContent(m));
            m.bindPopup(window.getApPopupContent);
            if (map.hasLayer(errorLinesLayer) && typeof updateErrorAnalysis === 'function') {
              updateErrorAnalysis();
            }
          });

          cancelBtn.addEventListener('click', function(cancelEv) {
            L.DomEvent.stopPropagation(cancelEv);
            e.popup.setContent(window.getApPopupContent(m));
            m.bindPopup(window.getApPopupContent);
          });
        });
      }
    }
  });


  m.on('click', function(ev) {
    L.DomEvent.stopPropagation(ev);
    window.preventMapClick = true;
    setTimeout(() => window.preventMapClick = false, 200);

    const mLatLng = this.getLatLng();
    const coordBox = document.getElementById('coordOutput');
    if (coordBox) {
      coordBox.value = `${mLatLng.lat.toFixed(7)}, ${mLatLng.lng.toFixed(7)}`;
      coordBox.select();
    }

    activeNudgeMarker = this;
    updateDeleteBtn();

    const rType = this.options.originalData.rectype;
    const stat = document.getElementById('status');

    if (typeof window.shouldShowMarkerPopup === 'function' &&
        !window.shouldShowMarkerPopup()) {
      this.closePopup();
      if (stat && !(typeof isDelMode !== 'undefined' && isDelMode)) {
        const markerName = this.options.originalData.ap ||
            this.options.originalData.label || rType || 'Marker';
        stat.innerText = `Selected ${markerName} (${mLatLng.lat.toFixed(7)}, ${
            mLatLng.lng.toFixed(7)})`;
        stat.style.color = 'blue';
      }
    }

    if (rType === 'WP') {
      if (isAddMode &&
          document.querySelector('input[name="addType"]:checked').value ===
              'WP') {
        this.closePopup();
        const pathTag = document.getElementById('wpPathTag') ?
            document.getElementById('wpPathTag').value.trim() || 'aisle' :
            'aisle';

        if (!targetGroup.wpEdges) targetGroup.wpEdges = [];

        const oldEdges = [...targetGroup.wpEdges];
        const oldFocus = targetGroup.wpFocusNode;
        const isShiftPressed = ev.originalEvent && ev.originalEvent.shiftKey;

        if (targetGroup.wpFocusNode && targetGroup.wpFocusNode !== this &&
            !isShiftPressed && !window.addPointOnly) {
          targetGroup.wpEdges.push([targetGroup.wpFocusNode, this, pathTag]);

          const newEdges = [...targetGroup.wpEdges];
          const newFocus = this;
          pushAction(
              targetGroup,
              () => {
                targetGroup.wpEdges = oldEdges;
                targetGroup.wpFocusNode = oldFocus;
                redrawWpLine(targetGroup);
              },
              () => {
                targetGroup.wpEdges = newEdges;
                targetGroup.wpFocusNode = newFocus;
                redrawWpLine(targetGroup);
              });

          if (stat) {
            stat.innerText = 'WP Path Linked!';
            stat.style.color = 'purple';
          }
        } else if (isShiftPressed || window.addPointOnly) {
          if (stat) {
            stat.innerText =
                'Focus shifted to ' + (this.options.originalData.ap || 'WP');
            stat.style.color = 'blue';
          }
        }

        targetGroup.wpFocusNode = this;
        targetGroup.wpInsertEdgeIndex = -1;
        redrawWpLine(targetGroup);

      } else if (isEditMode) {
        targetGroup.wpFocusNode = this;
        targetGroup.wpInsertEdgeIndex = -1;
        if (stat) {
          stat.innerText =
              'Focus set to ' + (this.options.originalData.ap || 'WP');
          stat.style.color = 'blue';
        }
      } else if (typeof isDelMode !== 'undefined' && isDelMode) {
        const typeNode = document.querySelector('input[name="addType"]:checked');
        const activeType = typeNode ? typeNode.value : 'AP';
        const rType = this.options.originalData ? this.options.originalData.rectype : '';
        
        if (rType === activeType) {
          this.closePopup();
          if (typeof window.deleteMarkerFunction === 'function') {
            console.log('DEL Mode: Deleting clicked ' + rType + ' marker.');
            window.deleteMarkerFunction(this, targetGroup);
          } else {
            console.warn('window.deleteMarkerFunction is not defined yet!');
          }
        } else {
          console.log('DEL Mode: Skipped delete. Marker type (' + rType + ') does not match active radio (' + activeType + ').');
        }
      }
    } else {
      // AP and GT Markers
      if (typeof isDelMode !== 'undefined' && isDelMode) {
        const typeNode = document.querySelector('input[name="addType"]:checked');
        const activeType = typeNode ? typeNode.value : 'AP';
        const rType = this.options.originalData ? this.options.originalData.rectype : '';

        if (rType === activeType) {
          this.closePopup();
          if (rType === 'GT' && window.gtDelMode === 'ALL') {
            if (typeof window.deleteAllGtMarkers === 'function') {
              window.deleteAllGtMarkers();
            }
          } else if (typeof window.deleteMarkerFunction === 'function') {
            console.log('DEL Mode: Deleting clicked ' + rType + ' marker.');
            window.deleteMarkerFunction(this, targetGroup);
          } else {
            console.warn('window.deleteMarkerFunction is not defined yet!');
          }
        } else {
          console.log('DEL Mode: Skipped delete. Marker type (' + rType + ') does not match active radio (' + activeType + ').');
        }
      }
    }
  });



  m.on('dragend', function(ev) {
    activeNudgeMarker = ev.target;
    updateDeleteBtn();

    const newLatLng = ev.target.getLatLng();
    const nLat = newLatLng.lat.toFixed(7);
    const nLng = newLatLng.lng.toFixed(7);
    const movedName = ev.target.options.originalData.ap || 'Unknown';

    if (typeof window.shouldShowMarkerPopup !== 'function' ||
        window.shouldShowMarkerPopup()) {
      L.popup()
          .setLatLng(newLatLng)
          .setContent(`<b>${movedName} MOVED!</b><br>New Lat: ${
              nLat}<br>New Lng: ${nLng}`)
          .openOn(map);
    }

    const rArr = ev.target.options.originalRow.slice();
    if (ev.target.options.latIdx > -1) rArr[ev.target.options.latIdx] = nLat;
    if (ev.target.options.lngIdx > -1) rArr[ev.target.options.lngIdx] = nLng;
    ev.target.options.originalRow = rArr;

    ev.target.options.originalData.lat = parseFloat(nLat);
    ev.target.options.originalData.lng = parseFloat(nLng);

    const origLL = this._origLatLng;
    const origRow = this._origRow;
    const newLL = newLatLng;
    const newRow = rArr;

    pushAction(
        targetGroup,
        () => {
          ev.target.setLatLng(origLL);
          ev.target.options.originalRow = origRow;
          ev.target.options.originalData.lat = origLL.lat;
          ev.target.options.originalData.lng = origLL.lng;
          const rType = ev.target.options.originalData.rectype;
          if (rType === 'GT') redrawGtLine(targetGroup);
          if (rType === 'WP') redrawWpLine(targetGroup);
        },
        () => {
          ev.target.setLatLng(newLL);
          ev.target.options.originalRow = newRow;
          ev.target.options.originalData.lat = newLL.lat;
          ev.target.options.originalData.lng = newLL.lng;
          const rType = ev.target.options.originalData.rectype;
          if (rType === 'GT') redrawGtLine(targetGroup);
          if (rType === 'WP') redrawWpLine(targetGroup);
        });

    logAndCopy(rArr);

    const rType = ev.target.options.originalData.rectype;
    if (rType === 'GT') redrawGtLine(targetGroup);
    if (rType === 'WP') {
      targetGroup.wpFocusNode = ev.target;
      targetGroup.wpInsertEdgeIndex = -1;
      redrawWpLine(targetGroup);
    }
    if (map.hasLayer(errorLinesLayer)) updateErrorAnalysis();
  });
}

function redrawGtLine(tabLayer) {
  if (tabLayer.gtLine) {
    tabLayer.removeLayer(tabLayer.gtLine);
    tabLayer.gtLine = null;
  }
  // Safe-guard: Identify if this is meant to be a GT Layer
  const isGT = (tabLayer === overlays['Imported csv GTs']) ||
               (overlays['New GT Layer'] && tabLayer === overlays['New GT Layer']) ||
               (tabLayer.gtMarkers && tabLayer.gtMarkers.length > 0);

  if (isGT && tabLayer.gtMarkers && tabLayer.gtMarkers.length > 1) {
    const sorted = [...tabLayer.gtMarkers].sort((a, b) => {
      const nameA = String(a.gtName || '');
      const nameB = String(b.gtName || '');
      return nameA.localeCompare(
          nameB, undefined, {numeric: true, sensitivity: 'base'});
    });
    const latlngs = sorted.map(m => m.getLatLng());
    tabLayer.gtLine =
        L.polyline(latlngs, {color: 'green', weight: 2, bubblingMouseEvents: true}).addTo(tabLayer);

    tabLayer.gtLine.on('click', function(e) {
      if (isPointerMode) return;

      L.DomEvent.stopPropagation(e);
      window.preventMapClick = true;
      setTimeout(() => window.preventMapClick = false, 200);

      if (isAddMode &&
          document.querySelector('input[name="addType"]:checked').value === 'GT') {
        const pt = map.latLngToLayerPoint(e.latlng);
        let minDistance = Infinity;
        let bestSegmentIndex = -1;

        for (let i = 0; i < sorted.length - 1; i++) {
          const p1 = map.latLngToLayerPoint(sorted[i].getLatLng());
          const p2 = map.latLngToLayerPoint(sorted[i + 1].getLatLng());
          const dist = L.LineUtil.pointToSegmentDistance(pt, p1, p2);
          if (dist < minDistance) {
            minDistance = dist;
            bestSegmentIndex = i;
          }
        }

        if (bestSegmentIndex > -1) {
          const lowerMarker = sorted[bestSegmentIndex];
          const lowerLabel = lowerMarker.options.originalData.label || lowerMarker.gtName || '';
          
          const match = lowerLabel.match(/^(.*?)(\d+)$/);
          let prefix = 'GT-';
          let lowerNum = 0;
          if (match) {
            prefix = match[1];
            lowerNum = parseInt(match[2], 10);
          } else {
            lowerNum = bestSegmentIndex + 1;
          }

          const insertNum = lowerNum + 1;
          const newLabel = prefix + insertNum;

          // Shift labels of all subsequent GT markers in the network
          for (let j = bestSegmentIndex + 1; j < sorted.length; j++) {
            const mToIncrement = sorted[j];
            const oldLabel = mToIncrement.options.originalData.label || mToIncrement.gtName || '';
            const mMatch = oldLabel.match(/^(.*?)(\d+)$/);
            if (mMatch) {
              const mPrefix = mMatch[1];
              const mNum = parseInt(mMatch[2], 10);
              const nextLabel = mPrefix + (mNum + 1);
              mToIncrement.options.originalData.label = nextLabel;
              mToIncrement.options.originalData.ap = nextLabel;
              mToIncrement.gtName = nextLabel;
              if (mToIncrement.options.originalRow && mToIncrement.options.apIdx > -1) {
                mToIncrement.options.originalRow[mToIncrement.options.apIdx] = nextLabel;
              }
            }
          }

          // Trigger a popup update/refresh on the incremented markers
          for (let j = bestSegmentIndex + 1; j < sorted.length; j++) {
            if (typeof window.getGtPopupContent === 'function') {
              sorted[j].setPopupContent(window.getGtPopupContent);
            }
          }

          // Call handleMapClick to place the new GT point at the clicked position with the custom forcedLabel
          if (typeof handleMapClick === 'function') {
            handleMapClick(
                e.latlng.lat.toFixed(7), e.latlng.lng.toFixed(7),
                e.originalEvent && e.originalEvent.shiftKey,
                newLabel
            );
          }
        }
      }
    });
  }
}


function redrawWpLine(tabLayer) {
  if (tabLayer.wpLine) {
    tabLayer.removeLayer(tabLayer.wpLine);
    tabLayer.wpLine = null;
  }

  // Safe-guard: Do NOT draw Yellow WP Lines on a dedicated GT Layer!
  const isGT = (tabLayer === overlays['Imported csv GTs']) ||
               (overlays['New GT Layer'] && tabLayer === overlays['New GT Layer']) ||
               (tabLayer.gtMarkers && tabLayer.gtMarkers.length > 0 && (!tabLayer.wpNodesList || tabLayer.wpNodesList.length === 0));

  if (!isGT && tabLayer.wpEdges && tabLayer.wpEdges.length > 0) {
    const multiLatLngs = tabLayer.wpEdges.map(
        edge => [edge[0].getLatLng(), edge[1].getLatLng()]);
    tabLayer.wpLine = L.polyline(multiLatLngs, {
                         color: 'yellow',
                         weight: 3,
                         bubblingMouseEvents: true
                       }).addTo(tabLayer);


    tabLayer.wpLine.on('click', function(e) {
      if (isPointerMode) return;

      L.DomEvent.stopPropagation(e);
      window.preventMapClick = true;
      setTimeout(() => window.preventMapClick = false, 200);

      const pt = map.latLngToLayerPoint(e.latlng);
      let minDistance = Infinity;
      let bestEdgeIndex = -1;

      for (let i = 0; i < tabLayer.wpEdges.length; i++) {
        const p1 = map.latLngToLayerPoint(tabLayer.wpEdges[i][0].getLatLng());
        const p2 = map.latLngToLayerPoint(tabLayer.wpEdges[i][1].getLatLng());
        const dist = L.LineUtil.pointToSegmentDistance(pt, p1, p2);
        if (dist < minDistance) {
          minDistance = dist;
          bestEdgeIndex = i;
        }
      }

      if (isAddMode &&
          document.querySelector('input[name="addType"]:checked').value ===
              'WP') {
        tabLayer.wpInsertEdgeIndex = bestEdgeIndex;
        handleMapClick(
            e.latlng.lat.toFixed(7), e.latlng.lng.toFixed(7),
            e.originalEvent && e.originalEvent.shiftKey);
      } else {
        if (bestEdgeIndex > -1) {
          openWpPathPopup(e.latlng, bestEdgeIndex, tabLayer, false);
        }
      }
    });
  }
}

function enableDragging(enable) {
  const typeNode = document.querySelector('input[name="addType"]:checked');
  const activeType = typeNode ? typeNode.value : 'AP';

  console.log('enableDragging triggered. Mode enable:', enable, 'Active Type:', activeType);

  map.eachLayer(function(layer) {
    if (layer instanceof L.Marker) {
      if (layer.options.originalRow || layer.options.isCorner) {
        let isEligible = false;
        
        if (enable) {
          if (activeType === 'CORNERS' && layer.options.isCorner) {
            isEligible = true;
          } else if (!layer.options.isCorner && layer.options.originalData && 
                     layer.options.originalData.rectype === activeType) {
            isEligible = true;
          }
        }

        if (enable && isEligible) {
          if (layer.dragging) layer.dragging.enable();
          if (layer._icon) layer._icon.style.cursor = 'move';
        } else {
          if (layer.dragging) layer.dragging.disable();
          if (layer._icon) layer._icon.style.cursor = 'pointer';
        }
      }
    }
  });
}


map.on('overlayadd', () => {
  if (isEditMode) enableDragging(true);
});

function updateLegend() {
  if (layerControl) map.removeControl(layerControl);
  if (Object.keys(overlays).length > 0) {
    layerControl =
        L.control.layers(null, overlays, {collapsed: false}).addTo(map);
  }
}

function loadManualImage() {
  const fileInput = document.getElementById('manualFile');
  if (fileInput.files.length > 0 && storedBounds) {
    const reader = new FileReader();
    reader.onload = function(e) {
      if (imageOverlayLayer && map.hasLayer(imageOverlayLayer))
        map.removeLayer(imageOverlayLayer);
      imageOverlayLayer = L.imageOverlay(e.target.result, storedBounds, {
                             opacity: parseFloat(opacitySlider.value),
                             zIndex: 1
                           }).addTo(map);
      overlays['FP Layer'] = imageOverlayLayer;
      updateLegend();
      document.getElementById('fallback-container').style.display = 'none';
      document.getElementById('status').innerText = 'Manual Image Loaded.';
      document.getElementById('status').style.color = 'green';
      fileInput.value = '';
    };
    reader.readAsDataURL(fileInput.files[0]);
  }
}

window.promptForFloorplan = function(targetFileName) {
  let modal = document.getElementById('fpPromptModal');
  let fileNameBox = document.getElementById('fpPromptFileName');
  let okBtn = document.getElementById('fpPromptOkBtn');

  if (!modal || !fileNameBox || !okBtn) {
    console.warn('Floorplan Prompt Modal elements missing in DOM! Dynamically generating Modal fallback.');
    
    // Remove partial old modal if exists
    if (modal) modal.remove();

    // 1. Create Modal Container
    modal = document.createElement('div');
    modal.id = 'fpPromptModal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    modal.style.zIndex = '999999';
    modal.style.display = 'none';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.fontFamily = 'sans-serif';

    // 2. Create Modal Box
    const box = document.createElement('div');
    box.style.background = 'white';
    box.style.padding = '30px';
    box.style.borderRadius = '8px';
    box.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
    box.style.textAlign = 'center';
    box.style.maxWidth = '450px';
    box.style.width = '85%';

    // 3. Create Title
    const title = document.createElement('h3');
    title.innerText = 'Floor Plan Load Required';
    title.style.marginTop = '0';
    title.style.color = '#2196F3';
    title.style.fontSize = '18px';
    box.appendChild(title);

    // 4. Create Message
    const msg = document.createElement('p');
    msg.style.margin = '15px 0 25px 0';
    msg.style.lineHeight = '1.5';
    msg.style.color = '#333';
    msg.style.fontSize = '14px';
    msg.innerHTML = 'Please select the Floor Plan image file for loading:<br>';
    
    fileNameBox = document.createElement('b');
    fileNameBox.id = 'fpPromptFileName';
    fileNameBox.style.fontSize = '16px';
    fileNameBox.style.color = '#000';
    fileNameBox.style.display = 'inline-block';
    fileNameBox.style.marginTop = '8px';
    fileNameBox.style.background = '#e8f0fe';
    fileNameBox.style.padding = '4px 10px';
    fileNameBox.style.borderRadius = '4px';
    fileNameBox.style.border = '1px solid #d2e3fc';
    msg.appendChild(fileNameBox);
    box.appendChild(msg);

    // 5. Create Button
    okBtn = document.createElement('button');
    okBtn.id = 'fpPromptOkBtn';
    okBtn.innerText = 'OK';
    okBtn.style.backgroundColor = '#4CAF50';
    okBtn.style.color = 'white';
    okBtn.style.border = 'none';
    okBtn.style.padding = '12px 40px';
    okBtn.style.fontSize = '15px';
    okBtn.style.fontWeight = 'bold';
    okBtn.style.borderRadius = '4px';
    okBtn.style.cursor = 'pointer';
    okBtn.style.width = 'auto';
    okBtn.style.display = 'inline-block';

    okBtn.onmouseover = () => okBtn.style.backgroundColor = '#45a049';
    okBtn.onmouseout = () => okBtn.style.backgroundColor = '#4CAF50';

    box.appendChild(okBtn);
    modal.appendChild(box);
    document.body.appendChild(modal);
  }

  if (fileNameBox) fileNameBox.innerText = targetFileName;
  modal.style.display = 'flex';

  okBtn.onclick = async function() {
    modal.style.display = 'none';

    const fallbackContainer = document.getElementById('fallback-container');
    const statusDiv = document.getElementById('status');
    const opacitySlider = document.getElementById('opacitySlider');

    const applyOverlay = function(imageResult, fName) {
      if (imageOverlayLayer && map.hasLayer(imageOverlayLayer)) {
        map.removeLayer(imageOverlayLayer);
      }
      imageOverlayLayer = L.imageOverlay(imageResult, storedBounds, {
                             opacity: parseFloat(opacitySlider ? opacitySlider.value : 0.8),
                             zIndex: 1
                           }).addTo(map);
      overlays['FP Layer'] = imageOverlayLayer;
      updateLegend();
      
      if (storedBounds && storedBounds.length === 2 && storedBounds[0] && storedBounds[1]) {
        try {
          const swObj = (typeof storedBounds[0].lat === 'number') ? storedBounds[0] : [storedBounds[0][0], storedBounds[0][1]];
          const neObj = (typeof storedBounds[1].lat === 'number') ? storedBounds[1] : [storedBounds[1][0], storedBounds[1][1]];
          const bnds = L.latLngBounds(swObj, neObj);
          if (!window.floorplanResetBounds) {
            window.floorplanResetBounds = bnds;
            map.fitBounds(bnds, {padding: [20, 20]});
          }
        } catch (err) {
          console.warn('Fallback floorplanResetBounds assignment failed:', err);
        }
      }

      if (fallbackContainer) fallbackContainer.style.display = 'none';
      if (statusDiv) {
        statusDiv.innerText = `Floorplan Image Loaded: ${fName}`;
        statusDiv.style.color = 'green';
      }
      
      try {
        const fpBaseName = String(fName || '').replace(/\.[^/.]+$/, '').trim();
        const apFpInput = document.getElementById('apDefaultFloorplan');
        if (apFpInput && (!apFpInput.value || apFpInput.value.trim() === '')) {
          apFpInput.value = fpBaseName;
        }
      } catch (e) {
        console.warn('Failed to auto-populate AP Defaults Floor Plan value:', e);
      }
    };



    const invokeFallbackUI = function() {
      if (fallbackContainer) {
        fallbackContainer.style.display = 'block';
        fallbackContainer.style.background = '#fff3cd';
        fallbackContainer.style.border = '2px solid #ffc107';
        fallbackContainer.scrollIntoView({behavior: 'smooth', block: 'center'});
      }
      if (statusDiv) {
        statusDiv.innerHTML = `<span style='color:#856404; font-weight:bold;'>Action Required:</span> Click 'Choose File' below to load Floorplan Image ('${targetFileName}').`;
      }
    };

    if (window.showOpenFilePicker) {
      try {
        const handles = await window.showOpenFilePicker({
          suggestedName: targetFileName,
          types: [{
            description: 'Floorplan Images (.png, .jpg, .webp)',
            accept: {
              'image/*': ['.png', '.jpg', '.jpeg', '.webp']
            }
          }]
        });
        if (handles && handles.length > 0) {
          const file = await handles[0].getFile();
          try {
            await saveHandle('pngHandle', handles[0]);
            localStorage.setItem('lastPngFile', file.name);
          } catch (storageErr) {
            console.warn('Failed to save Floorplan PNG Handle to storage:', storageErr);
          }
          const reader = new FileReader();
          reader.onload = function(e) {
            applyOverlay(e.target.result, file.name);
          };
          reader.readAsDataURL(file);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('showOpenFilePicker inside Modal click failed:', err);
          const manualFile = document.getElementById('manualFile');
          if (manualFile) {
            manualFile.value = '';
            const handleManualChange = function() {
              if (manualFile.files.length > 0) {
                const file = manualFile.files[0];
                try {
                  localStorage.setItem('lastPngFile', file.name);
                  localStorage.removeItem('pngHandle'); // Clear handle so it prefers local file name fallback
                } catch (storageErr) {
                  console.warn('Failed to save Floorplan PNG file name to localStorage:', storageErr);
                }
                const reader = new FileReader();
                reader.onload = function(e) {
                  applyOverlay(e.target.result, file.name);
                  manualFile.removeEventListener('change', handleManualChange);
                  manualFile.value = '';
                };
                reader.readAsDataURL(file);
              }
            };
            manualFile.addEventListener('change', handleManualChange);
            try {
              manualFile.click();
            } catch (clickErr) {
              console.warn('manualFile.click() blocked in Modal click:', clickErr);
              invokeFallbackUI();
            }
          } else {
            invokeFallbackUI();
          }
        }
      }
    } else {
      const manualFile = document.getElementById('manualFile');
      if (manualFile) {
        manualFile.value = '';
        const handleManualChange = function() {
          if (manualFile.files.length > 0) {
            const file = manualFile.files[0];
            try {
              localStorage.setItem('lastPngFile', file.name);
            } catch (storageErr) {
              console.warn('Failed to save Floorplan PNG file name to localStorage:', storageErr);
            }
            const reader = new FileReader();
            reader.onload = function(e) {
              applyOverlay(e.target.result, file.name);
              manualFile.removeEventListener('change', handleManualChange);
              manualFile.value = '';
            };
            reader.readAsDataURL(file);
          }
        };
        manualFile.addEventListener('change', handleManualChange);
        try {
          manualFile.click();
        } catch (clickErr) {
          console.warn('Fallback manualFile.click() blocked in Modal click:', clickErr);
          invokeFallbackUI();
        }
      } else {
        invokeFallbackUI();
      }
    }
  };
};

window.getGtMarkerLabel = function(layer) {
  const currentLayerData = layer.options?.originalData || {};
  if (currentLayerData.label && currentLayerData.label !== '') {
    return currentLayerData.label;
  }
  
  const defaultLabelPrefix = 'GT-';
  const activeTabs = [];
  if (typeof overlays !== 'undefined') {
    Object.keys(overlays).forEach(key => {
      if (key.includes('Tab ID') || key.includes('Imported csv') || key.startsWith('New ')) {
        if (typeof map !== 'undefined' && map.hasLayer(overlays[key])) {
          activeTabs.push(overlays[key]);
        }
      }
    });
  }

  const gtMarkersList = [];
  const seenIds = new Set();

  activeTabs.forEach(tab => {
    if (typeof tab.getLayers === 'function') {
      tab.getLayers().forEach(l => {
        if (l instanceof L.Marker && l.options && l.options.originalData) {
          const d = l.options.originalData;
          const rType = String(d.rectype || 'AP').toUpperCase().trim();
          if (rType === 'GT') {
            const uniqueId = d.rectype + '_' + (d.ap || '') + '_' + (d.lat || '') + '_' + (d.lng || '');
            if (!seenIds.has(uniqueId)) {
              seenIds.add(uniqueId);
              gtMarkersList.push(l);
            }
          }
        }
      });
    }
  });

  const idx = gtMarkersList.indexOf(layer);
  if (idx !== -1) {
    return defaultLabelPrefix + (idx + 1);
  } else {
    return defaultLabelPrefix + (gtMarkersList.length + 1);
  }
};

window.getGtPopupContent = function(layer) {
  const finalLabel = window.getGtMarkerLabel(layer);
  const data = (layer.options && layer.options.originalData) ? layer.options.originalData : {};
  console.log("getGtPopupContent called for GT:", finalLabel, data);
  
  const defaultHeight = document.getElementById('gtDefaultHeight')?.value.trim() || '1.0';
  const defaultError  = document.getElementById('gtDefaultError')?.value.trim()  || '0.1';
  
  const heightVal = (data.height && data.height !== '') ? data.height : defaultHeight;
  const errorVal = (data.error && data.error !== '') ? data.error : defaultError;

  let contentHtml = `<div style="font-size:13px; min-width: 120px;">
    <b>Label:</b> ${finalLabel}<br>
    <b>Height(M):</b> ${heightVal}<br>
    <b>Error(M):</b> ${errorVal}`;

  const activeType = document.querySelector('input[name="addType"]:checked')?.value || 'AP';
  if (typeof isEditMode !== 'undefined' && isEditMode && activeType === 'GT') {
    contentHtml += `<div style="margin-top: 8px; text-align: center;">
      <button class="gt-edit-popup-btn" style="background:#2196F3; color:white; border:none; padding:4px 12px; border-radius:3px; cursor:pointer; font-size:11px; font-weight:bold;">Edit</button>
    </div>`;
  }

  contentHtml += `</div>`;
  return contentHtml;
};

window.getApPopupContent = function(layer) {
  const data = (layer.options && layer.options.originalData) ? layer.options.originalData : {};
  const finalName = data.ap || 'Unknown AP';
  
  const defaultHeight = document.getElementById('apDefaultHeight')?.value.trim() || '2.8';
  const defaultFloor  = document.getElementById('apDefaultFloor')?.value.trim()  || '1';
  const defaultArea   = document.getElementById('apDefaultArea')?.value.trim()   || 'office';
  let defaultMap      = document.getElementById('apDefaultFloorplan')?.value.trim();
  if (!defaultMap) {
    let fName = document.getElementById('target-filename')?.innerText.replace(/\.[^/.]+$/, '');
    if (fName && fName !== 'file') defaultMap = fName;
    else defaultMap = 'UNKNOWN_MAP';
  }
  const defaultFreq   = document.getElementById('apDefaultFreq')?.value.trim() || '-1';
  const defaultBssid  = document.getElementById('apDefaultBssid')?.value.trim() || '60:B7:6E:xx:xx:xx';

  const bssidVal  = data.bssid || defaultBssid;
  const heightVal = (data.height && data.height !== '') ? data.height : defaultHeight;
  const floorVal  = (data.floor && data.floor !== '') ? data.floor : defaultFloor;
  const mapVal    = (data.map && data.map !== '') ? data.map : defaultMap;
  const areaVal   = (data.area && data.area !== '') ? data.area : defaultArea;
  const freqVal   = (data.freq && data.freq !== '') ? data.freq : defaultFreq;

  let contentHtml = `<div style="font-size:13px; min-width: 140px;">
    <b>Label:</b> ${finalName}<br>
    <b>BSSID:</b> ${bssidVal}<br>
    <b>Height(M):</b> ${heightVal}<br>
    <b>Floor:</b> ${floorVal}<br>
    <b>Map:</b> ${mapVal}<br>
    <b>Area:</b> ${areaVal}<br>
    <b>Freq(Hz):</b> ${freqVal}`;

  if (data.error && data.error !== '') {
    contentHtml += `<br><span style="color:red; font-weight:bold;">Error: ${data.error} m</span>`;
  }

  const activeType = document.querySelector('input[name="addType"]:checked')?.value || 'AP';
  if (typeof isEditMode !== 'undefined' && isEditMode && activeType === 'AP') {
    contentHtml += `<div style="margin-top: 8px; text-align: center;">
      <button class="ap-edit-popup-btn" style="background:#2196F3; color:white; border:none; padding:4px 12px; border-radius:3px; cursor:pointer; font-size:11px; font-weight:bold;">Edit</button>
    </div>`;
  }

  contentHtml += `</div>`;
  return contentHtml;
};

function openWpPathPopup(latlng, edgeIdx, tabLayer, isEditingForm = false) {
  const edge = tabLayer.wpEdges[edgeIdx];
  const name1 = edge[0].options.originalData.ap || 'Unknown';
  const name2 = edge[1].options.originalData.ap || 'Unknown';
  const tag = edge[2] || 'aisle';

  let popupContent = `<div style="font-size:13px; text-align:center; min-width: 140px;">
    <b>WP Path Info</b><hr style="margin:4px 0;">
    <b>Nodes:</b> ${name1} &harr; ${name2}<br>`;

  if (isEditingForm) {
    popupContent += `
      <label style="display:block; margin-top:4px; font-weight:bold; text-align:left;">Tag:</label>
      <input type="text" id="wpPopupTagVal" value="${tag}" style="width:100%; box-sizing:border-box; margin-top:2px; padding:2px; font-size:12px;">
      <div style="display:flex; justify-content:space-between; margin-top:8px; gap:5px;">
        <button class="wp-path-save-btn" style="background:#4CAF50; color:white; border:none; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:11px;">Save</button>
        <button class="wp-path-cancel-btn" style="background:#f44336; color:white; border:none; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:11px;">Cancel</button>
      </div>`;
  } else {
    popupContent += `<b>Tag:</b> <span style="color:blue;">${tag}</span>`;
    const activeType = document.querySelector('input[name="addType"]:checked')?.value || 'AP';
    if (typeof isEditMode !== 'undefined' && isEditMode && activeType === 'WP') {
      popupContent += `<div style="margin-top: 8px;">
        <button class="wp-path-edit-btn" style="background:#2196F3; color:white; border:none; padding:4px 12px; border-radius:3px; cursor:pointer; font-size:11px; font-weight:bold;">Edit</button>
      </div>`;
    }
  }
  
  popupContent += `</div>`;

  const popup = L.popup().setLatLng(latlng).setContent(popupContent).openOn(map);

  const container = popup.getElement();
  if (container) {
    const editBtn = container.querySelector('.wp-path-edit-btn');
    const saveBtn = container.querySelector('.wp-path-save-btn');
    const cancelBtn = container.querySelector('.wp-path-cancel-btn');

    if (editBtn) {
      editBtn.addEventListener('click', function(ev) {
        L.DomEvent.stopPropagation(ev);
        openWpPathPopup(latlng, edgeIdx, tabLayer, true);
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', function(ev) {
        L.DomEvent.stopPropagation(ev);
        const newTag = container.querySelector('#wpPopupTagVal').value.trim();
        const oldTag = edge[2] || 'aisle';

        edge[2] = newTag;

        if (typeof pushAction === 'function') {
          pushAction(
            tabLayer,
            () => {
              edge[2] = oldTag;
              redrawWpLine(tabLayer);
              map.closePopup();
            },
            () => {
              edge[2] = newTag;
              redrawWpLine(tabLayer);
              map.closePopup();
            }
          );
        }

        redrawWpLine(tabLayer);
        openWpPathPopup(latlng, edgeIdx, tabLayer, false);
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', function(ev) {
        L.DomEvent.stopPropagation(ev);
        openWpPathPopup(latlng, edgeIdx, tabLayer, false);
      });
    }
  }
}

window.getCornerPopupContent = function(marker, label) {
  const latlng = marker.getLatLng();
  const latVal = latlng.lat.toFixed(7);
  const lngVal = latlng.lng.toFixed(7);

  let contentHtml = `<div style="font-size:13px; min-width: 140px;">
    <b>${label}</b><br>
    Lat: ${latVal}<br>
    Lng: ${lngVal}`;

  const activeType = document.querySelector('input[name="addType"]:checked')?.value || 'AP';
  if (typeof isEditMode !== 'undefined' && isEditMode && activeType === 'CORNERS') {
    contentHtml += `<div style="margin-top: 8px; text-align: center;">
      <button class="corner-edit-popup-btn" style="background:#2196F3; color:white; border:none; padding:4px 12px; border-radius:3px; cursor:pointer; font-size:11px; font-weight:bold;">Edit</button>
    </div>`;
  }

  contentHtml += `</div>`;
  return contentHtml;
};

function attachCornerPopupEvents(marker, label, targetGroup) {
  marker.on('popupopen', function(e) {
    activeNudgeMarker = marker;
    const popupContainer = e.popup.getElement();
    if (!popupContainer) return;

    const editBtn = popupContainer.querySelector('.corner-edit-popup-btn');
    if (editBtn) {
      editBtn.addEventListener('click', function(clickEv) {
        L.DomEvent.stopPropagation(clickEv);
        const latlng = marker.getLatLng();
        const currentLat = latlng.lat.toFixed(7);
        const currentLng = latlng.lng.toFixed(7);

        const editFormHtml = `
          <div style="font-size:13px; min-width: 140px;">
            <b>Edit ${label} Bounds</b><hr style="margin:4px 0;">
            <label style="display:block; margin-top:5px; font-weight:bold;">Latitude:</label>
            <input type="text" id="cornerPopupLatVal" value="${currentLat}" style="width:100%; box-sizing:border-box; margin-top:2px; padding:3px; font-size:12px;">
            <label style="display:block; margin-top:5px; font-weight:bold;">Longitude:</label>
            <input type="text" id="cornerPopupLngVal" value="${currentLng}" style="width:100%; box-sizing:border-box; margin-top:2px; padding:3px; font-size:12px;">
            <div style="display:flex; justify-content:space-between; margin-top:8px; gap:5px;">
              <button class="corner-save-popup-btn" style="background:#4CAF50; color:white; border:none; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:11px;">Save</button>
              <button class="corner-cancel-popup-btn" style="background:#f44336; color:white; border:none; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:11px;">Cancel</button>
            </div>
          </div>
        `;
        e.popup.setContent(editFormHtml);

        const newPopupContainer = e.popup.getElement();
        const saveBtn = newPopupContainer.querySelector('.corner-save-popup-btn');
        const cancelBtn = newPopupContainer.querySelector('.corner-cancel-popup-btn');

        saveBtn.addEventListener('click', function(saveEv) {
          L.DomEvent.stopPropagation(saveEv);
          const newLatStr = newPopupContainer.querySelector('#cornerPopupLatVal').value.trim();
          const newLngStr = newPopupContainer.querySelector('#cornerPopupLngVal').value.trim();

          const newLat = parseFloat(newLatStr);
          const newLng = parseFloat(newLngStr);

          if (isNaN(newLat) || isNaN(newLng)) {
            alert('Please enter valid numeric coordinates!');
            return;
          }

          const oldLatLng = marker.getLatLng();
          const newLatLng = L.latLng(newLat, newLng);

          marker.setLatLng(newLatLng);

          if (typeof window.handleCornerDrag === 'function') {
            window.handleCornerDrag();
          }

          if (typeof pushAction === 'function') {
            pushAction(
              targetGroup,
              () => {
                marker.setLatLng(oldLatLng);
                if (typeof window.handleCornerDrag === 'function') window.handleCornerDrag();
                marker.closePopup();
              },
              () => {
                marker.setLatLng(newLatLng);
                if (typeof window.handleCornerDrag === 'function') window.handleCornerDrag();
                marker.closePopup();
              }
            );
          }

          e.popup.setContent(window.getCornerPopupContent(marker, label));
        });

        cancelBtn.addEventListener('click', function(cancelEv) {
          L.DomEvent.stopPropagation(cancelEv);
          e.popup.setContent(window.getCornerPopupContent(marker, label));
        });
      });
    }
  });
}









