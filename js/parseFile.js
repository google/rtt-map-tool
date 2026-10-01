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
 * @fileoverview CSV and Floorplan file parsing for RTT Map Tool.
 * @suppress {lintChecks}
 */

window.processCsvConfigContent = function(text, fileName) {
  if (typeof window.resetAllToolData === 'function') {
    window.resetAllToolData();
  }

  const lines = text.split(/\r?\n/);
  let newMarkersCount = 0;

  let apLayer = overlays['Imported csv APs'];
  if (!apLayer) {
    apLayer = L.layerGroup();
    apLayer.gtMarkers = [];
    apLayer.wpNodesList = [];
    apLayer.wpEdges = [];
    apLayer.wpFocusNode = null;
  }

  let gtLayer = overlays['Imported csv GTs'];
  if (!gtLayer) {
    gtLayer = L.layerGroup();
    gtLayer.gtMarkers = [];
    gtLayer.wpNodesList = [];
    gtLayer.wpEdges = [];
    gtLayer.wpFocusNode = null;
  }

  let wpLayer = overlays['Imported csv WPs'];
  if (!wpLayer) {
    wpLayer = L.layerGroup();
    wpLayer.gtMarkers = [];
    wpLayer.wpNodesList = [];
    wpLayer.wpEdges = [];
    wpLayer.wpFocusNode = null;
  }

  let hasAP = false;
  let hasGT = false;
  let hasWP = false;

  window.importedParams = [];
  let foundBD = false;
  let bdMapName = '';
  let bdSW = null;
  let bdNE = null;


  const preState = [apLayer, gtLayer, wpLayer].map(
      g => ({
        group: g,
        edges: g.wpEdges ? [...g.wpEdges] : [],
        gt: g.gtMarkers ? [...g.gtMarkers] : [],
        wpNodes: g.wpNodesList ? [...g.wpNodesList] : [],
        focus: g.wpFocusNode
      }));

  const importedMarkersBuffer = [];

  const headers = lines[0].split(',').map(s => s.trim().toUpperCase());
  const hasHeaders = headers.includes('LAT') || headers.includes('LATITUDE') || headers.includes('LNG') || headers.includes('LONGITUDE');

  let bIdx = headers.indexOf('BSSID');
  let lI = headers.indexOf('LAT');
  if (lI === -1) lI = headers.indexOf('LATITUDE');
  let lnI = headers.indexOf('LNG');
  if (lnI === -1) lnI = headers.indexOf('LONGITUDE');
  let aI = headers.indexOf('AP');
  if (aI === -1) aI = headers.indexOf('NAME');
  let rI = headers.indexOf('RECTYPE');
  if (rI === -1) rI = 0;
  let arI = headers.indexOf('AREA');
  let eI = headers.indexOf('ERROR');
  let htI = headers.indexOf('HEIGHT');
  if (htI === -1) htI = headers.indexOf('HEIGHT(M)');
  if (htI === -1) htI = headers.indexOf('HEIGTH(M)');
  let flI = headers.indexOf('FLOOR');
  if (flI === -1) flI = headers.indexOf('BUILDING_FLOOR');
  let mI = headers.indexOf('MAP');
  let frI = headers.indexOf('FREQ');
  if (frI === -1) frI = headers.indexOf('FREQUENCY(HZ)');

  let gtLoadCounter = 1;


  for (let i = (hasHeaders ? 1 : 0); i < lines.length; i++) {

    if (!lines[i].trim()) continue;
    const r = lines[i].split(',').map(s => {
      let v = s.trim();
      if (v.startsWith('"') && v.endsWith('"')) {
        v = v.substring(1, v.length - 1).replace(/""/g, '"');
      }
      return v;
    });

    const rectypeVal = String(r[rI] || '').toUpperCase().trim();

    if (rectypeVal === 'PARAM' || rectypeVal === 'PARAMX' || rectypeVal === 'XPARAM') {
      window.importedParams.push(lines[i].trim());
      continue;
    }


    if (rectypeVal === 'BD') {
      const field = String(r[1] || '').toUpperCase().trim();
      const valStr = String(r[2] || '').trim();

      if (field === 'MAP1' || field === 'MAP') {
        bdMapName = valStr;
        const apFpInput = document.getElementById('apDefaultFloorplan');
        if (apFpInput) apFpInput.value = valStr;
      } else if (field === 'SW') {
        const parts = valStr.split(',').map(Number);
        if (parts.length === 2 && !isNaN(parts[0])) bdSW = parts;
      } else if (field === 'NE') {
        const parts = valStr.split(',').map(Number);
        if (parts.length === 2 && !isNaN(parts[0])) bdNE = parts;
      } else if (field === 'FLOOR') {
        window.importedBdFloor = valStr || '1';
        const apFloorInput = document.getElementById('apDefaultFloor');
        if (apFloorInput) apFloorInput.value = valStr || '1';
      } else if (r.length >= 6 && !isNaN(parseFloat(r[2])) && !isNaN(parseFloat(r[3]))) {
        bdMapName = String(r[1]).trim();
        const apFpInput = document.getElementById('apDefaultFloorplan');
        if (apFpInput) apFpInput.value = bdMapName;

        bdSW = [parseFloat(r[2]), parseFloat(r[3])];
        bdNE = [parseFloat(r[4]), parseFloat(r[5])];
        
        const floorStr = r[6] ? String(r[6]).trim() : '1';
        window.importedBdFloor = floorStr;
        const apFloorInput = document.getElementById('apDefaultFloor');
        if (apFloorInput) apFloorInput.value = floorStr;
      }
      foundBD = true;
      continue;
    }


    const isTargetType =
        (rectypeVal === 'AP' || rectypeVal === 'GT' || rectypeVal === 'WP');

    if (isTargetType) {
      let curLI, curLnI, curAI, curBIdx, curArI, curEI;
      let colorVal = 'blue';
      let shapeVal = 'circle';
      let errorVal = '';
      let areaVal = 'NEW_AREA';
      let labelVal = '';
      let bssidVal = '';
      let gtHeightVal = '';

      if (hasHeaders && rectypeVal === 'AP') {
        curLI = lI !== -1 ? lI : 2;
        curLnI = lnI !== -1 ? lnI : 3;
        curAI = aI !== -1 ? aI : 4;
        curBIdx = bIdx !== -1 ? bIdx : 1;
        curArI = arI !== -1 ? arI : 8;
        curEI = eI !== -1 ? eI : 5;

        if (curBIdx !== -1 && r[curBIdx]) bssidVal = String(r[curBIdx]).trim();
        else bssidVal = 'AP_BSSID';

        if (curArI !== -1 && r[curArI]) areaVal = String(r[curArI]).trim();
        if (curEI !== -1 && r[curEI]) errorVal = String(r[curEI]).trim();

        colorVal = String(r[7] || 'blue').trim();
        shapeVal = String(r[6] || 'circle').toLowerCase().trim();
      } else {
        if (rectypeVal === 'GT' || rectypeVal === 'WP') {
          curLI = 3;
          curLnI = 4;

          let possibleName7 = r[7] ? String(r[7]).trim() : '';
          let errVal = '';
          let lblVal = '';
          let htVal = '';

          if (rectypeVal === 'GT') {
            const defaultHeight = document.getElementById('gtDefaultHeight')?.value.trim() || '1.0';
            const defaultError  = document.getElementById('gtDefaultError')?.value.trim()  || '0.1';
            const defaultLabelPrefix = 'GT-';

            const rawHt = r[5] ? String(r[5]).trim() : '';
            htVal = (rawHt && rawHt !== '') ? rawHt : defaultHeight;

            const val6 = r[6] ? String(r[6]).trim() : '';
            const isNumeric6 = (val6 !== '' && !isNaN(parseFloat(val6)) && isFinite(val6));

            if (isNumeric6) {
              errVal = val6;
              const rawLbl = r[7] ? String(r[7]).trim() : '';
              lblVal = (rawLbl && rawLbl !== '') ? rawLbl : (defaultLabelPrefix + gtLoadCounter++);
              curAI = -1; 
            } else {
              curAI = 6;
              errVal = defaultError; 
              const rawLbl = r[6] ? String(r[6]).trim() : '';
              lblVal = (rawLbl && rawLbl !== '') ? rawLbl : (defaultLabelPrefix + gtLoadCounter++);
            }
          } else {
            if (possibleName7 && (possibleName7.startsWith('GT-') || possibleName7.startsWith('WP-') || isNaN(parseFloat(possibleName7)))) {
              curAI = 7;
            } else {
              curAI = 6;
            }
          }

          curBIdx = -1;
          curArI = -1;
          curEI = -1;
          bssidVal = '';
          colorVal = rectypeVal === 'GT' ? 'green' : 'yellow';
          errorVal = errVal;
          labelVal = lblVal;
          gtHeightVal = htVal;
        } else {
          curLI = 2;
          curLnI = 3;
          curAI = 4;
          curBIdx = 1;
          curArI = 8;
          curEI = 5;
          bssidVal = String(r[1] || 'AP_BSSID').trim();
          areaVal = String(r[8] || 'NEW_AREA').trim();
          errorVal = String(r[5] || '').trim();
          if (rectypeVal === 'AP') {
            shapeVal = 'circle';
            colorVal = '#FF9800'; // Rich orange
          } else {
            shapeVal = String(r[6] || 'circle').toLowerCase().trim();
            colorVal = String(r[7] || 'blue').trim();
          }
        }
      }
      
      const latNum = parseFloat(r[curLI]);
      const lngNum = parseFloat(r[curLnI]);
      let nameVal = '';

      if (curAI !== -1 && r[curAI]) {
        nameVal = String(r[curAI]).trim();
      } else {
        if (rectypeVal === 'GT') {
          nameVal = labelVal;
        } else {
          nameVal = 'WP-' + i;
        }
      }


      const hasValidCoords = (!isNaN(latNum) && !isNaN(lngNum));

      if (hasValidCoords) {
        const curHtI = htI !== -1 ? htI : 5;
        const curFlI = flI !== -1 ? flI : 6;
        const curMI = mI !== -1 ? mI : 7;
        const curFrI = frI !== -1 ? frI : 9;

        const origData = {
          ap: nameVal,
          bssid: (rectypeVal === 'GT') ? '' : bssidVal,
          lat: latNum,
          lng: lngNum,
          rectype: rectypeVal,
          shape: shapeVal,
          color: colorVal,
          area: (rectypeVal === 'GT') ? '' : areaVal,
          label: (rectypeVal === 'GT') ? labelVal : '',
          error: (rectypeVal === 'GT') ? errorVal : errorVal,
          height: (rectypeVal === 'GT') ? gtHeightVal : ((rectypeVal === 'AP' && r[curHtI]) ? String(r[curHtI]).trim() : ''),
          floor: (rectypeVal === 'AP' && r[curFlI]) ? String(r[curFlI]).trim() : '',
          map: (rectypeVal === 'AP' && r[curMI]) ? String(r[curMI]).trim() : '',
          freq: (rectypeVal === 'AP' && r[curFrI]) ? String(r[curFrI]).trim() : '',
          originalRow: r
        };






        let myIcon;

        if (rectypeVal === 'GT') {
          myIcon = L.divIcon({
            className: '',
            html: `<div class="custom-marker-css shape-circle" style="background:green;"></div>`,
            iconSize: [10, 10],
            iconAnchor: [5, 5],
            popupAnchor: [0, -6]
          });
        } else if (rectypeVal === 'WP') {
          myIcon = L.divIcon({
            className: '',
            html: `<div class="custom-marker-css shape-circle" style="background:yellow;"></div>`,
            iconSize: [10, 10],
            iconAnchor: [5, 5],
            popupAnchor: [0, -6]
          });
        } else if (rectypeVal === 'AP') {
          myIcon = L.divIcon({
            className: '',
            html: `<div class="custom-marker-css shape-circle" style="background:purple;"></div>`,
            iconSize: [10, 10],
            iconAnchor: [5, 5],
            popupAnchor: [0, -6]
          });

        } else {
          if (shapeVal === 'teardrop' || shapeVal === 'pin' ||
              shapeVal === 'marker') {
            myIcon = createTeardropIcon(colorVal);
          } else {
            const sClass = 'shape-' + shapeVal;
            myIcon = L.divIcon({
              className: '',
              html: `<div class="custom-marker-css ${sClass}" style="background:${colorVal};"></div>`,
              iconSize: [10, 10],
              iconAnchor: [5, 5],
              popupAnchor: [0, -6]
            });
          }
        }


        const m = L.marker([latNum, lngNum], {
          icon: myIcon,
          zIndexOffset: 1000,
          draggable: isEditMode,
          originalRow: r.slice(),
          latIdx: curLI,
          lngIdx: curLnI,
          apIdx: curAI,
          bssidIdx: curBIdx,
          rectypeIdx: rI,
          areaIdx: curArI,
          errorIdx: curEI,
          originalData: origData
        });

        const activeGroupObj = (rectypeVal === 'GT') ?
            gtLayer :
            ((rectypeVal === 'WP') ? wpLayer : apLayer);
        attachMarkerEvents(m, activeGroupObj);

        if (rectypeVal === 'GT') {
          if (typeof window.getGtPopupContent === 'function') {
            m.bindPopup(window.getGtPopupContent);
          } else {
            const defaultLabelPrefix = 'GT-';
            const finalGTLabel = (labelVal && labelVal !== '') ? labelVal : (defaultLabelPrefix + i);
            const defaultHeight = document.getElementById('gtDefaultHeight')?.value.trim() || '1.0';
            const defaultError  = document.getElementById('gtDefaultError')?.value.trim()  || '0.1';
            m.bindPopup(`<div style="font-size:13px;"><b>Label:</b> ${finalGTLabel}<br><b>Height(M):</b> ${defaultHeight}<br><b>Error(M):</b> ${defaultError}</div>`);
          }
        } else if (rectypeVal === 'AP') {
          if (typeof window.getApPopupContent === 'function') {
            m.bindPopup(window.getApPopupContent);
          } else {
            m.bindPopup(`<div style="font-size:13px;"><b>Name:</b> ${nameVal}<br><b>BSSID:</b> ${bssidVal}</div>`);
          }
        } else {
          m.bindPopup(`<div style="font-size:13px;"><b>Label:</b> ${nameVal}</div>`);
        }






      activeGroupObj.addLayer(m);
      allMarkers.push({
        id: nameVal,
        bssid: bssidVal,
        marker: m,
        data: origData
      });

      if (rectypeVal === 'AP') {
        hasAP = true;
      } else if (rectypeVal === 'GT') {
        hasGT = true;
        if (!gtLayer.gtMarkers) gtLayer.gtMarkers = [];
        gtLayer.gtMarkers.push(m);
      } else if (rectypeVal === 'WP') {
        hasWP = true;
        if (!wpLayer.wpNodesList) wpLayer.wpNodesList = [];
        wpLayer.wpNodesList.push(m);
      }
      importedMarkersBuffer.push(m);
      newMarkersCount++;
      logAndCopy(r, true);
      }
    }
  }

  if (foundBD && bdMapName && bdSW && bdNE) {
    storedBounds = [bdSW, bdNE];
    createOrUpdateCorners(bdSW, bdNE);

    const boundsObj = L.latLngBounds(bdSW, bdNE);
    window.floorplanResetBounds = boundsObj;
    map.fitBounds(boundsObj, {padding: [20, 20]});
    if (imageOverlayLayer && map.hasLayer(imageOverlayLayer)) {

      map.removeLayer(imageOverlayLayer);
      imageOverlayLayer = null;
    }

    const fileNameOverlay =
        bdMapName + (bdMapName.toLowerCase().endsWith('.png') ? '' : '.png');
    document.getElementById('fullMapPath').value = fileNameOverlay;
    document.getElementById('target-filename').innerText = fileNameOverlay;

    // Trigger the beautiful pre-selection prompt modal if not reloading previous files!
    if (!window.isReloadingPreviousFiles) {
      try {
        if (typeof window.promptForFloorplan === 'function') {
          window.promptForFloorplan(fileNameOverlay);
        } else {
          console.error('window.promptForFloorplan is NOT a function! Launching fallback UI.');
          const fallbackContainer = document.getElementById('fallback-container');
          const statusDiv = document.getElementById('status');
          if (fallbackContainer) {
            fallbackContainer.style.display = 'block';
            fallbackContainer.style.background = '#fff3cd';
            fallbackContainer.style.border = '2px solid #ffc107';
            fallbackContainer.scrollIntoView({behavior: 'smooth', block: 'center'});
          }
          if (statusDiv) {
            statusDiv.innerHTML = `<span style='color:#856404; font-weight:bold;'>Action Required:</span> Click 'Choose File' below to load Floorplan Image ('${fileNameOverlay}').`;
          }
        }
      } catch (e) {
        console.error('Exception invoking promptForFloorplan:', e);
        const fallbackContainer = document.getElementById('fallback-container');
        const statusDiv = document.getElementById('status');
        if (fallbackContainer) {
          fallbackContainer.style.display = 'block';
          fallbackContainer.style.background = '#fff3cd';
          fallbackContainer.style.border = '2px solid #ffc107';
          fallbackContainer.scrollIntoView({behavior: 'smooth', block: 'center'});
        }
        if (statusDiv) {
          statusDiv.innerHTML = `<span style='color:#856404; font-weight:bold;'>Action Required:</span> Click 'Choose File' below to load Floorplan Image ('${fileNameOverlay}').`;
        }
      }
    }




    const baseVal = document.querySelector('input[name="baseMap"]:checked').value;
    const wantsGoogle = (baseVal === 'google' || baseVal === 'google-earth');
    if (wantsGoogle && loadedConfigGkey) {
      const typeKey = (baseVal === 'google-earth') ? 'hybrid' : 'roadmap';
      const googleType = typeKey;
      setTimeout(() => {
        if (!baseLayers[typeKey]) {
          baseLayers[typeKey] =
              L.gridLayer.googleMutant({type: googleType, maxZoom: 22});
        }
        baseLayers[typeKey].addTo(map);
      }, 50);
    }
  }


  if (hasAP) {
    if (!map.hasLayer(apLayer)) {
      apLayer.addTo(map);
      overlays['Imported csv APs'] = apLayer;
    }
  }
  if (hasGT) {
    redrawGtLine(gtLayer);
    if (!map.hasLayer(gtLayer)) {
      gtLayer.addTo(map);
      overlays['Imported csv GTs'] = gtLayer;
    }
  }
  if (hasWP) {
    if (wpLayer.wpNodesList && wpLayer.wpNodesList.length > 1) {
      if (!wpLayer.wpEdges) wpLayer.wpEdges = [];
      const pathTag = document.getElementById('wpPathTag') ?
          document.getElementById('wpPathTag').value.trim() || 'aisle' :
          'aisle';
      for (let k = 0; k < wpLayer.wpNodesList.length - 1; k++) {
        wpLayer.wpEdges.push(
            [wpLayer.wpNodesList[k], wpLayer.wpNodesList[k + 1], pathTag]);
      }
      wpLayer.wpFocusNode =
          wpLayer.wpNodesList[wpLayer.wpNodesList.length - 1];
    }
    redrawWpLine(wpLayer);
    
    if (overlays['New WP Layer']) {
      if (map.hasLayer(overlays['New WP Layer'])) {
        map.removeLayer(overlays['New WP Layer']);
      }
      delete overlays['New WP Layer'];
    }

    if (!map.hasLayer(wpLayer)) {
      wpLayer.addTo(map);
      overlays['Imported csv WPs'] = wpLayer;
    }
    updateLegend();
  }


  const postState = [apLayer, gtLayer, wpLayer].map(
      g => ({
        group: g,
        edges: g.wpEdges ? [...g.wpEdges] : [],
        gt: g.gtMarkers ? [...g.gtMarkers] : [],
        wpNodes: g.wpNodesList ? [...g.wpNodesList] : [],
        focus: g.wpFocusNode
      }));
  const importedMarkersCopy = [...importedMarkersBuffer];

  pushAction(
      [apLayer, gtLayer, wpLayer],
      () => {
        importedMarkersCopy.forEach(m => {
          if (apLayer.hasLayer(m)) apLayer.removeLayer(m);
          if (gtLayer.hasLayer(m)) gtLayer.removeLayer(m);
          if (wpLayer.hasLayer(m)) wpLayer.removeLayer(m);
          allMarkers = allMarkers.filter(item => item.marker !== m);
        });
        preState.forEach(s => {
          s.group.wpEdges = s.edges;
          s.group.gtMarkers = s.gt;
          s.group.wpNodesList = s.wpNodes;
          s.group.wpFocusNode = s.focus;
          redrawGtLine(s.group);
          redrawWpLine(s.group);
        });
      },
      () => {
        importedMarkersCopy.forEach(m => {
          const rType = String(m.options.originalData.rectype).toUpperCase();
          if (rType === 'AP')
            apLayer.addLayer(m);
          else if (rType === 'GT')
            gtLayer.addLayer(m);
          else if (rType === 'WP')
            wpLayer.addLayer(m);
          allMarkers.push({
            id: m.options.originalData.ap,
            bssid: m.options.originalData.bssid,
            marker: m,
            data: m.options.originalData
          });
        });
        postState.forEach(s => {
          s.group.wpEdges = s.edges;
          s.group.gtMarkers = s.gt;
          s.group.wpNodesList = s.wpNodes;
          s.group.wpFocusNode = s.focus;
          redrawGtLine(s.group);
          redrawWpLine(s.group);
        });
      });

  updateLegend();
  updateDeleteBtn();
  if (typeof updateErrorAnalysis === 'function' && map.hasLayer(errorLinesLayer)) updateErrorAnalysis();
  if (isEditMode) enableDragging(true);

  const stat = document.getElementById('status');
  if (stat) {
    stat.innerText = `CSV Import Success: ${newMarkersCount} markers loaded.`;
    stat.style.color = 'green';
  }
};

document.getElementById('importCsvConfigBtn').addEventListener('click', async function() {
  try {
    if (window.showOpenFilePicker) {
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: 'CSV Configuration Files',
          accept: {'text/csv': ['.csv']},
        }],
      });
      await saveHandle('csvHandle', handle);
      const file = await handle.getFile();
      localStorage.setItem('lastCsvFile', file.name);
      localStorage.setItem('lastLoadType', 'csv');
      const text = await file.text();
      const csvBox = document.getElementById('csvConfigPath');
      if (csvBox) csvBox.value = file.name;
      if (typeof window.updateCsvDropZoneLabel === 'function') {
        window.updateCsvDropZoneLabel(file.name);
      }
      window.processCsvConfigContent(text, file.name);
    } else {
      document.getElementById('csvConfigImportFile').value = '';
      document.getElementById('csvConfigImportFile').click();
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error(err);
      alert('Failed to open CSV file: ' + err.message);
    }
  }
});

document.getElementById('csvConfigImportFile').addEventListener('change', function(e) {
  if (!e.target.files || e.target.files.length === 0) return;
  const file = e.target.files[0];
  const csvConfigPathBox = document.getElementById('csvConfigPath');
  if (csvConfigPathBox) csvConfigPathBox.value = file.name;
  if (typeof window.updateCsvDropZoneLabel === 'function') {
    window.updateCsvDropZoneLabel(file.name);
  }
  localStorage.setItem('lastCsvFile', file.name);
  localStorage.setItem('lastLoadType', 'csv');

  const reader = new FileReader();
  reader.onload = function(ev) {
    window.processCsvConfigContent(ev.target.result, file.name);
    e.target.value = '';
  };
  reader.readAsText(file);
});

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

document.getElementById('exportCsvBtn').addEventListener('click', function() {
  const activeTabs = [];
  Object.keys(overlays).forEach(key => {
    if (key.includes('Tab ID') || key.includes('Imported csv') ||
        key.startsWith('New ')) {
      if (map.hasLayer(overlays[key])) {
        activeTabs.push(overlays[key]);
      }
    }
  });

  if (activeTabs.length === 0) {
    alert('No marker tabs are currently enabled on the map.');
    return;
  }

  const apMarkersList = [];
  const gtMarkersList = [];
  const wpMarkersList = [];

  const seenIds = new Set();

  activeTabs.forEach(tab => {
    tab.getLayers().forEach(layer => {
      if (layer instanceof L.Marker && layer.options.originalData) {
        const d = layer.options.originalData;
        const uniqueId = (d.rectype === 'GT' || d.rectype === 'WP') ? 
          (d.rectype + '_' + (d.ap || '') + '_' + (d.lat || '') + '_' + (d.lng || '')) :
          (d.rectype + '_' + d.ap + '_' + d.bssid);

        if (!seenIds.has(uniqueId)) {
          seenIds.add(uniqueId);


          const rType = String(d.rectype || 'AP').toUpperCase().trim();
          if (rType === 'GT')
            gtMarkersList.push(d);
          else if (rType === 'WP')
            wpMarkersList.push(d);
          else
            apMarkersList.push(d);
        }
      }
    });
  });

  let csvContent = `# PARAM,<KEY>,<VALUE>
# BD,<MAP>,<SW_LATITUDE>,<SW_LONGITUDE>,<NE_LATITUDE>,<NE_LONGITUDE>,<BUILDING_FLOOR>
# AP,<BSSID>,<LATITUDE>,<LONGITUDE>,<AP#>,<HEIGHT(M)>,<BUILDING_FLOOR>,<MAP>,<AREA>,<FREQUENCY(HZ)>
# GT,<0>,<0>,<LATITUDE>,<LONGITUDE>,<HEIGHT(M)>,<ERROR(M)>,<AREA>\n\n`;


  if (window.importedParams && window.importedParams.length > 0) {
    csvContent += window.importedParams.join('\n') + '\n\n';
  }

  let fName = document.getElementById('target-filename')
                  .innerText.replace(/\.[^/.]+$/, '');
  if (fName === 'file') fName = 'UNKNOWN_MAP';

  const swStr = document.getElementById('swCorner').value;
  const neStr = document.getElementById('neCorner').value;
  const floorNum = window.importedBdFloor || '1';

  if (swStr && neStr && swStr.includes(',')) {
    const swArr = swStr.split(',');
    const neArr = neStr.split(',');
    csvContent += `BD,${fName},${swArr[0]},${swArr[1]},${neArr[0]},${
        neArr[1]},${floorNum}\n\n`;
  }

  if (apMarkersList.length > 0) {
    apMarkersList.forEach(d => {
      const defaultHeight = document.getElementById('apDefaultHeight')?.value.trim() || '2.8';
      const defaultFloor  = document.getElementById('apDefaultFloor')?.value.trim()  || '1';
      const defaultArea   = document.getElementById('apDefaultArea')?.value.trim()   || 'office';
      
      let defaultMap = document.getElementById('apDefaultFloorplan')?.value.trim();
      if (!defaultMap) {
        let fName = document.getElementById('target-filename').innerText.replace(/\.[^/.]+$/, '');
        if (fName !== 'file') defaultMap = fName;
        else defaultMap = 'UNKNOWN_MAP';
      }

      const defaultFreq = document.getElementById('apDefaultFreq')?.value.trim() || '-1';

      const finalHeight = (d.height && d.height !== '') ? d.height : defaultHeight;
      const finalFloor  = (d.floor  && d.floor  !== '') ? d.floor  : defaultFloor;
      const finalMap    = (d.map    && d.map    !== '') ? d.map    : defaultMap;
      const finalArea   = (d.area   && d.area   !== 'NEW_AREA' && d.area !== '') ? d.area : defaultArea;
      const finalFreq   = (d.freq   && d.freq   !== '') ? d.freq   : defaultFreq;

      const row = [
        escapeCSV(d.rectype || 'AP'), 
        escapeCSV(d.bssid   || ''),
        escapeCSV(d.lat     || ''), 
        escapeCSV(d.lng     || ''), 
        escapeCSV(d.ap      || ''),
        escapeCSV(finalHeight), 
        escapeCSV(finalFloor),
        escapeCSV(finalMap), 
        escapeCSV(finalArea)
      ];

      if (finalFreq !== '-1' && finalFreq !== '') {
        row.push(escapeCSV(finalFreq));
      }

      csvContent += row.join(',') + '\n';
    });
    csvContent += '\n';
  }


  if (gtMarkersList.length > 0) {
    gtMarkersList.forEach((d, idx) => {
      const defaultHeight = document.getElementById('gtDefaultHeight')?.value.trim() || '1.0';
      const defaultError  = document.getElementById('gtDefaultError')?.value.trim()  || '0.1';
      const defaultLabelPrefix = 'GT-';

      const finalHeight = (d.height && d.height !== '') ? d.height : defaultHeight;
      const finalError  = (d.error  && d.error  !== '') ? d.error  : defaultError;
      
      const finalLabel = (d.label && d.label !== '' && !d.isNewGT) ? d.label : (defaultLabelPrefix + (idx + 1));

      const row = [
        escapeCSV(d.rectype || 'GT'),
        '0', 
        '0', 
        escapeCSV(d.lat || ''),
        escapeCSV(d.lng || ''), 
        escapeCSV(finalHeight),
        escapeCSV(finalError), 
        escapeCSV(finalLabel)
      ];
      csvContent += row.join(',') + '\n';
    });
    csvContent += '\n';
  }




  const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});

  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'map_export_config.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});


