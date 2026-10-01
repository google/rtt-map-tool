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
 * @fileoverview Error metrics and analysis for RTT Map Tool.
 * @suppress {lintChecks}
 */

map.on('overlayadd overlayremove', updateErrorAnalysis);

function updateErrorAnalysis() {
  errorLinesLayer.clearLayers();
  document.getElementById('statsBox').style.display = 'none';

  allMarkers.forEach(item => {
    const d = item.data;
    const rType = String(d.rectype || 'AP').toUpperCase();

    if (rType === 'GT') {
      if (d.error === undefined || d.error === '') {
        d.error = d.isNewGT ? (document.getElementById('gtDefaultError')?.value.trim() || '0.1') : '';
      }
      if (typeof window.getGtPopupContent === 'function') {
        item.marker.bindPopup(window.getGtPopupContent);
      } else {
        const defaultHeight = document.getElementById('gtDefaultHeight')?.value.trim() || '1.0';
        const defaultError  = document.getElementById('gtDefaultError')?.value.trim()  || '0.1';
        const finalLabel = d.label || d.ap;
        item.marker.bindPopup(`<div style="font-size:13px;"><b>Label:</b> ${finalLabel}<br><b>Height(M):</b> ${d.height || defaultHeight}<br><b>Error(M):</b> ${d.error || defaultError}</div>`);
      }
    } else if (rType === 'WP') {
      item.marker.bindPopup(`<div style="font-size:13px;"><b>Label:</b> ${d.ap || 'N/A'}</div>`);
    } else if (rType === 'AP') {
      d.error = '';
      if (typeof window.getApPopupContent === 'function') {
        item.marker.bindPopup(window.getApPopupContent);
      } else {
        const basePopup = `<div style="font-size:13px;"><b>${rType}#:</b> ${
            d.ap || 'N/A'}<br><b>BSSID:</b> ${d.bssid || 'N/A'}</div>`;
        item.marker.bindPopup(basePopup);
      }
    } else {
      d.error = '';
      const basePopup = `<div style="font-size:13px;"><b>${rType}#:</b> ${
          d.ap || 'N/A'}</div>`;
      item.marker.bindPopup(basePopup);
    }
  });


  if (!map.hasLayer(errorLinesLayer)) return;

  const activeTabLayers = [];
  Object.keys(overlays).forEach(key => {
    if (key.includes('Tab ID') || key.includes('Imported csv') ||
        key.startsWith('New ')) {
      if (map.hasLayer(overlays[key])) activeTabLayers.push(overlays[key]);
    }
  });

  if (activeTabLayers.length !== 2) return;

  const layer1Markers = [];
  const layer2Markers = [];

  function extractMarkers(group, arr) {
    group.eachLayer(layer => {
      if (layer instanceof L.Marker && layer.options.originalData)
        arr.push(layer);
    });
  }
  extractMarkers(activeTabLayers[0], layer1Markers);
  extractMarkers(activeTabLayers[1], layer2Markers);

  const errors = [];
  let pairsFound = 0;

  layer1Markers.forEach(m1 => {
    const bssid1 = String(m1.options.originalData.bssid).toLowerCase().trim();
    if (!bssid1) return;

    const match = layer2Markers.find(
        m2 => String(m2.options.originalData.bssid).toLowerCase().trim() ===
            bssid1);

    if (match) {
      pairsFound++;
      const latlng1 = m1.getLatLng();
      const latlng2 = match.getLatLng();
      const dist = latlng1.distanceTo(latlng2);
      errors.push(dist);

      m1.options.originalData.error = dist.toFixed(2);
      match.options.originalData.error = dist.toFixed(2);

      const line = L.polyline(
          [latlng1, latlng2],
          {color: 'red', weight: 2, dashArray: '5, 5', opacity: 0.7});
      errorLinesLayer.addLayer(line);

      const distStr = dist.toFixed(2);
      const appendMsg = `<br><span style="color:red; font-weight:bold;">Error: ${
          distStr} m</span>`;

      const updatePopup = (m) => {
        if (typeof window.getApPopupContent === 'function') {
          m.bindPopup(window.getApPopupContent);
        } else {
          const d = m.options.originalData;
          const rType = String(d.rectype || 'AP').toUpperCase();
          const content = `<div style="font-size:13px;"><b>${rType}#:</b> ${
              d.ap || 'N/A'}<br><b>BSSID:</b> ${d.bssid || 'N/A'}${appendMsg}</div>`;
          m.bindPopup(content);
        }
      };
      updatePopup(m1);
      updatePopup(match);
    }
  });

  if (errors.length > 0) {
    const sumSq = errors.reduce((a, b) => a + (b * b), 0);
    const rmse = Math.sqrt(sumSq / errors.length);
    errors.sort((a, b) => a - b);
    const p50 = errors[Math.floor(errors.length * 0.50)];
    let p90 = errors[Math.floor(errors.length * 0.90)];
    if (p90 === undefined) p90 = errors[errors.length - 1];
    const max = errors[errors.length - 1];

    document.getElementById('statCount').innerText = pairsFound;
    document.getElementById('statRmse').innerText = rmse.toFixed(2);
    document.getElementById('stat50').innerText = p50.toFixed(2);
    document.getElementById('stat90').innerText = p90.toFixed(2);
    document.getElementById('statMax').innerText = max.toFixed(2);
    document.getElementById('statsBox').style.display = 'block';
  }
}
