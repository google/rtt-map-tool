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
 * @fileoverview OSM XML import and export for RTT Map Tool.
 * @suppress {lintChecks}
 */

function escapeXml(unsafe) {
  return String(unsafe).replace(/[<>&'"]/g, function(c) {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '\'':
        return '&apos;';
      case '"':
        return '&quot;';
    }
  });
}

document.getElementById('exportOsmBtn').addEventListener('click', function() {
  const activeTabs = [];
  Object.keys(overlays).forEach(key => {
    if (key.includes('Tab ID') || key.includes('Imported csv') ||
        key.startsWith('New ')) {
      activeTabs.push(overlays[key]);
    }
  });

  if (activeTabs.length === 0) {
    alert('No marker tabs are available to export.');
    return;
  }

  const wpMarkers = [];
  let nodeIdCounter = -1;
  let wayIdCounter = -100000;

  activeTabs.forEach(tab => {
    if (tab.layer) {
      tab = tab.layer;
    } else if (typeof tab === 'string') {
      tab = overlays[tab];
    }

    if (tab && tab.getLayers) {
      tab.getLayers().forEach(layer => {
        if (layer instanceof L.Marker && layer.options.originalData) {
          const d = layer.options.originalData;
          if (String(d.rectype).toUpperCase().trim() === 'WP') {
            layer._osmId = nodeIdCounter--;
            wpMarkers.push(layer);
          }
        }
      });
    }
  });

  if (wpMarkers.length === 0) {
    alert('No WP markers found to export.');
    return;
  }

  let xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n<osm version="0.6" generator="MapEditor">\n`;

  wpMarkers.forEach(m => {
    const lat = m.getLatLng().lat.toFixed(7);
    const lng = m.getLatLng().lng.toFixed(7);
    const name = escapeXml(m.options.originalData.ap || '');
    xml +=
        `  <node id="${m._osmId}" visible="true" lat="${lat}" lon="${lng}">\n`;
    if (name) xml += `    <tag k="name" v="${name}" />\n`;
    xml += `  </node>\n`;
  });

  activeTabs.forEach(tab => {
    if (tab.layer) {
      tab = tab.layer;
    } else if (typeof tab === 'string') {
      tab = overlays[tab];
    }

    if (tab && tab.wpEdges && tab.wpEdges.length > 0) {
      tab.wpEdges.forEach(edge => {
        const m1 = edge[0];
        const m2 = edge[1];
        const tag = edge[2] || 'aisle';
        if (m1 && m2 && m1._osmId !== undefined && m2._osmId !== undefined) {
          xml += `  <way id="${wayIdCounter--}" visible="true">\n`;
          xml += `    <nd ref="${m1._osmId}" />\n`;
          xml += `    <nd ref="${m2._osmId}" />\n`;
          xml += `    <tag k="highway" v="${escapeXml(tag)}" />\n`;
          xml += `  </way>\n`;
        }
      });
    }
  });

  xml += `</osm>`;

  const blob = new Blob([xml], {type: 'application/xml;charset=utf-8;'});
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'open-street-map-path.osm');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

window.processOsmContent = function(xmlText, fileName) {
  const activeTabs = [];
  Object.keys(overlays).forEach(key => {
    if (key.includes('Tab ID') || key.includes('Imported csv') ||
        key.startsWith('New ')) {
      if (map.hasLayer(overlays[key]))
        activeTabs.push({key: key, layer: overlays[key]});
    }
  });

  let validTabs = activeTabs.filter(
      t => (t.layer || t).options && (t.layer || t).options.isWP);
  // Fallback checking if it contains WP markers
  if (validTabs.length === 0) {
    validTabs = activeTabs.filter(t => {
      const grp = t.layer || t;
      if (grp.wpNodesList && grp.wpNodesList.length > 0) return true;
      if (t.key && t.key.includes('WP')) return true;
      return false;
    });
  }

  let activeGroup;
  let tplOpts;

  if (validTabs.length > 0) {
    const exactMatch = validTabs.find(t => t.key && t.key.includes('WP'));
    activeGroup = exactMatch ? (exactMatch.layer || exactMatch) :
                               (validTabs[0].layer || validTabs[0]);
    if (activeGroup.layer) activeGroup = activeGroup.layer;

    // Failsafe: Cleanup "New WP Layer" from DOM and Legend if replacing it with imported CSV WPs
    if (overlays['New WP Layer']) {
      if (map.hasLayer(overlays['New WP Layer'])) {
        map.removeLayer(overlays['New WP Layer']);
      }
      delete overlays['New WP Layer'];
    }
  } else {
    activeGroup = overlays['Imported csv WPs'] || overlays['New WP Layer'];
    if (!activeGroup) {
      activeGroup = L.layerGroup();
      activeGroup.gtMarkers = [];
      activeGroup.wpNodesList = [];
      activeGroup.wpEdges = [];
      activeGroup.wpFocusNode = null;
      activeGroup.tabTemplate = {
        latIdx: 2,
        lngIdx: 3,
        apIdx: 4,
        bssidIdx: 1,
        rectypeIdx: 0,
        areaIdx: 8,
        errorIdx: 5,
        originalRow: new Array(10).fill(''),
        originalData: {rectype: 'WP', color: 'blue', shape: 'circle'}
      };
      overlays['Imported csv WPs'] = activeGroup;
    } else {
      // If New WP Layer existed and we adopted it, rename it to 'Imported csv WPs'
      if (overlays['New WP Layer'] && activeGroup === overlays['New WP Layer']) {
        delete overlays['New WP Layer'];
        overlays['Imported csv WPs'] = activeGroup;
      }
    }
    if (!map.hasLayer(activeGroup)) activeGroup.addTo(map);
    updateLegend();
  }

  const allGroupMarkers = activeGroup.getLayers().filter(
      l => l instanceof L.Marker && l.options.originalRow);
  if (allGroupMarkers.length === 0) {
    tplOpts = activeGroup.tabTemplate;
  } else {
    tplOpts = allGroupMarkers[0].options;
  }


  const preStateEdges = activeGroup.wpEdges ? [...activeGroup.wpEdges] : [];
  const preStateGt = activeGroup.gtMarkers ? [...activeGroup.gtMarkers] : [];
  const preStateWpNodes = activeGroup.wpNodesList ? [...activeGroup.wpNodesList] : [];
  const preStateFocus = activeGroup.wpFocusNode;
  const importedOsmMarkers = [];

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  const nodes = xmlDoc.getElementsByTagName('node');
  const ways = xmlDoc.getElementsByTagName('way');

  const nodeMap = {};
  let newMarkersCount = 0;
  let newEdgesCount = 0;

  let maxNum = -1;
  let prefix = 'WP-';
  let padding = 2;

  if (activeGroup.wpNodesList) {
    activeGroup.wpNodesList.forEach(layer => {
      const rType = String(layer.options.originalData.rectype || '')
                      .toUpperCase()
                      .trim();
      if (rType === 'WP') {
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
  }

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const id = node.getAttribute('id');
    const lat = node.getAttribute('lat');
    const lng = node.getAttribute('lon');

    let name = '';
    const tags = node.getElementsByTagName('tag');
    for (let t = 0; t < tags.length; t++) {
      if (tags[t].getAttribute('k') === 'name') {
        name = tags[t].getAttribute('v');
      }
    }

    if (!name) {
      const nextNum = maxNum + 1;
      const nextNumStr = String(nextNum).padStart(padding, '0');
      name = prefix + nextNumStr;
      maxNum++;
    } else {
      const match = name.match(/^(.*?)(\d+)$/);
      if (match) {
        const num = parseInt(match[2], 10);
        if (num > maxNum) maxNum = num;
      }
    }

    const newRow = tplOpts.originalRow.slice();
    const newOriginalData = {
      ...tplOpts.originalData,
      ap: name,
      bssid: 'OSM_IMPORT',
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      rectype: 'WP',
      area: 'NEW_AREA',
      error: ''
    };

    newRow[tplOpts.latIdx] = lat;
    newRow[tplOpts.lngIdx] = lng;
    if (tplOpts.apIdx > -1) newRow[tplOpts.apIdx] = name;
    if (tplOpts.bssidIdx > -1) newRow[tplOpts.bssidIdx] = 'OSM_IMPORT';
    if (tplOpts.rectypeIdx > -1) newRow[tplOpts.rectypeIdx] = 'WP';
    if (tplOpts.areaIdx > -1) newRow[tplOpts.areaIdx] = 'NEW_AREA';

    const myIcon = L.divIcon({
      className: '',
      html: `<div class="custom-marker-css shape-circle" style="background:yellow;"></div>`,
      iconSize: [10, 10],
      iconAnchor: [5, 5],
      popupAnchor: [0, -6]
    });

    const m = L.marker([lat, lng], {
      icon: myIcon,
      zIndexOffset: 1000,
      draggable: isEditMode,
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

    m.bindPopup(`<div style="font-size:13px;"><b>WP#:</b> ${name}<br><b>BSSID:</b> OSM_IMPORT<br><i style="color:red">Imported</i></div>`);
    activeGroup.addLayer(m);

    allMarkers.push(
        {id: name, bssid: 'OSM_IMPORT', marker: m, data: newOriginalData});

    if (!activeGroup.wpNodesList) activeGroup.wpNodesList = [];
    activeGroup.wpNodesList.push(m);

    nodeMap[id] = {marker: m};
    importedOsmMarkers.push(m);
    newMarkersCount++;
    logAndCopy(newRow, true);
  }

  if (!activeGroup.wpEdges) activeGroup.wpEdges = [];
  for (let k = 0; k < ways.length; k++) {
    const way = ways[k];
    const nds = way.getElementsByTagName('nd');

    let wayTag = 'aisle';
    const wTags = way.getElementsByTagName('tag');
    for (let t = 0; t < wTags.length; t++) {
      if (wTags[t].getAttribute('k') === 'highway') {
        wayTag = wTags[t].getAttribute('v');
      }
    }

    for (let j = 0; j < nds.length - 1; j++) {
      const ref1 = nds[j].getAttribute('ref');
      const ref2 = nds[j + 1].getAttribute('ref');
      if (nodeMap[ref1] && nodeMap[ref2] && nodeMap[ref1].marker &&
          nodeMap[ref2].marker) {
        activeGroup.wpEdges.push(
            [nodeMap[ref1].marker, nodeMap[ref2].marker, wayTag]);
        newEdgesCount++;
      }
    }
  }

  const postStateEdges = activeGroup.wpEdges ? [...activeGroup.wpEdges] : [];
  const postStateGt = activeGroup.gtMarkers ? [...activeGroup.gtMarkers] : [];
  const postStateWpNodes =
      activeGroup.wpNodesList ? [...activeGroup.wpNodesList] : [];
  const postStateFocus = activeGroup.wpFocusNode;
  const importedOsmMarkersCopy = [...importedOsmMarkers];

  pushAction(
      activeGroup,
      () => {
        importedOsmMarkersCopy.forEach(m => {
          activeGroup.removeLayer(m);
          allMarkers = allMarkers.filter(item => item.marker !== m);
        });
        activeGroup.wpEdges = preStateEdges;
        activeGroup.gtMarkers = preStateGt;
        activeGroup.wpNodesList = preStateWpNodes;
        activeGroup.wpFocusNode = preStateFocus;
        redrawGtLine(activeGroup);
        redrawWpLine(activeGroup);
      },
      () => {
        importedOsmMarkersCopy.forEach(m => {
          activeGroup.addLayer(m);
          allMarkers.push({
            id: m.options.originalData.ap,
            bssid: m.options.originalData.bssid,
            marker: m,
            data: m.options.originalData
          });
        });
        activeGroup.wpEdges = postStateEdges;
        activeGroup.gtMarkers = postStateGt;
        activeGroup.wpNodesList = postStateWpNodes;
        activeGroup.wpFocusNode = postStateFocus;
        redrawGtLine(activeGroup);
        redrawWpLine(activeGroup);
      });

  activeNudgeMarker = null;
  activeGroup.wpFocusNode = null;

  redrawWpLine(activeGroup);

  if (!map.hasLayer(activeGroup)) activeGroup.addTo(map);

  if (overlays['New WP Layer']) {
    if (map.hasLayer(overlays['New WP Layer'])) {
      map.removeLayer(overlays['New WP Layer']);
    }
    delete overlays['New WP Layer'];
  }

  overlays['Imported csv WPs'] = activeGroup;

  updateLegend();
  updateDeleteBtn();
  if (isEditMode) enableDragging(true);


  const stat = document.getElementById('status');
  if (stat) {
    stat.innerText = `OSM Import Success: ${newMarkersCount} WPs, ${newEdgesCount} Edges.`;
    stat.style.color = 'green';
  }
};

document.getElementById('importOsmBtn').addEventListener('click', async function() {
  try {
    if (window.showOpenFilePicker) {
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: 'OSM Walkable Routes (.osm, .xml)',
          accept: {'text/xml': ['.osm', '.xml']},
        }],
      });
      await saveHandle('osmHandle', handle);
      const file = await handle.getFile();
      localStorage.setItem('lastOsmFile', file.name);
      const text = await file.text();
      const osmBox = document.getElementById('osmPath');
      if (osmBox) osmBox.value = file.name;
      if (typeof window.updateOsmDropZoneLabel === 'function') {
        window.updateOsmDropZoneLabel(file.name);
      }
      window.processOsmContent(text, file.name);
    } else {
      document.getElementById('osmImportFile').value = '';
      document.getElementById('osmImportFile').click();
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error(err);
      alert('Failed to open OSM file: ' + err.message);
    }
  }
});

document.getElementById('osmImportFile').addEventListener('change', function(e) {
  if (!e.target.files || e.target.files.length === 0) return;
  const file = e.target.files[0];
  const osmPathBox = document.getElementById('osmPath');
  if (osmPathBox) osmPathBox.value = file.name;
  if (typeof window.updateOsmDropZoneLabel === 'function') {
    window.updateOsmDropZoneLabel(file.name);
  }
  localStorage.setItem('lastOsmFile', file.name);

  const reader = new FileReader();
  reader.onload = function(ev) {
    window.processOsmContent(ev.target.result, file.name);
    e.target.value = '';
  };
  reader.readAsText(file);
});
