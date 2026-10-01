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
 * @fileoverview Config and Google Maps API loader for RTT Map Tool.
 * @suppress {lintChecks}
 */

let loadedConfigGkey = null;
window.importedParams = [];
window.importedBdFloor = '1';

function loadGoogleMapsApi(key) {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve();
      return;
    }
    window.initGoogleMaps = function() {
      resolve();
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${
        key}&loading=async&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error(
        'Failed to load Google Maps API. Check your API key and Network.'));
    document.head.appendChild(script);
  });
}

document.querySelectorAll('input[name="baseMap"]').forEach(radio => {
  radio.addEventListener('change', async function() {
    const val = this.value;
    const wantsGoogle = (val === 'google' || val === 'google-earth');
    const googleType = (val === 'google-earth') ? 'hybrid' : 'roadmap';
    const statusDiv = document.getElementById('status');

    if (wantsGoogle) {
      if (!loadedConfigGkey) {
        statusDiv.innerText =
            'Please import a map containing a MAP_GKEY first.';
        document.getElementById('mapOsm').checked = true;
        return;
      }
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
          statusDiv.innerText = (val === 'google-earth') ?
              'Google Earth Loaded.' :
              'Google Maps Loaded.';
          statusDiv.style.color = 'green';
        }, 50);

      } catch (e) {
        console.error(e);
        statusDiv.innerText =
            'Error loading Google Maps. Check Key Restrictions.';
        statusDiv.style.color = 'red';
        document.getElementById('mapOsm').checked = true;
        if (!map.hasLayer(baseLayers.osm)) baseLayers.osm.addTo(map);
      }
    } else {
      [baseLayers.roadmap, baseLayers.hybrid].forEach(l => {
        if (l && map.hasLayer(l)) map.removeLayer(l);
      });
      if (!map.hasLayer(baseLayers.osm)) baseLayers.osm.addTo(map);
      statusDiv.innerText = 'Switched to OpenStreetMap.';
      statusDiv.style.color = 'blue';
    }
  });
});

function parseConfig(rows) {
  const config = {};
  window.importedParams = [];
  window.importedBdFloor = '1';

  rows.forEach(r => {
    const fullRowStrs =
        (r.fullRow ||
         []).map(x => x !== null && x !== undefined ? String(x).trim() : '');
    const rt = fullRowStrs[0] ? fullRowStrs[0].toUpperCase() : '';

    if (rt === 'XPARAM' || rt === 'PARAM' || rt === 'PARAMX') {
      const k = fullRowStrs[1] ? fullRowStrs[1].toUpperCase() : '';
      const v = fullRowStrs[2] ? fullRowStrs[2] : '';

      if (k === 'GIDS') {
        const vals = fullRowStrs.slice(2).filter(x => x !== '');
        config.gids = vals.join(',').replace(/\s+/g, '');
      } else if (k === 'PATH') {
        config.path = v;
      } else if (k === 'MAP1' || k === 'MAP') {
        config.map1 = v;
      } else if (k === 'MAP1-NE' || k === 'NE') {
        config.ne = v;
      } else if (k === 'MAP1-SW' || k === 'SW') {
        config.sw = v;
      } else if (k === 'MAP-GKEY') {
        config.gkey = v;
      }
      
      // Preserve the EXACT comma-separated reconstruction of the parameters
      window.importedParams.push(fullRowStrs.join(','));
    } else if (rt === 'BD') {
      const field = fullRowStrs[1] ? fullRowStrs[1].toUpperCase() : '';
      if (field === 'MAP1' || field === 'MAP') {
        const valStr = fullRowStrs[2] ? fullRowStrs[2].trim() : '';
        config.map1 = valStr;
        const apFpInput = document.getElementById('apDefaultFloorplan');
        if (apFpInput) apFpInput.value = valStr;
      } else if (field === 'SW') {
        config.sw = fullRowStrs[2] ? fullRowStrs[2].trim() : '';
      } else if (field === 'NE') {
        config.ne = fullRowStrs[2] ? fullRowStrs[2].trim() : '';
      } else if (field === 'FLOOR') {
        const valStr = fullRowStrs[2] ? fullRowStrs[2].trim() : '1';
        window.importedBdFloor = valStr;
        const apFloorInput = document.getElementById('apDefaultFloor');
        if (apFloorInput) apFloorInput.value = valStr;
      } else if (fullRowStrs.length >= 6 && !isNaN(parseFloat(fullRowStrs[2])) && !isNaN(parseFloat(fullRowStrs[3]))) {
        config.map1 = fullRowStrs[1] ? fullRowStrs[1].trim() : '';
        const apFpInput = document.getElementById('apDefaultFloorplan');
        if (apFpInput) apFpInput.value = config.map1;

        config.sw = (fullRowStrs[2] && fullRowStrs[3]) ? (fullRowStrs[2] + ',' + fullRowStrs[3]) : '';
        config.ne = (fullRowStrs[4] && fullRowStrs[5]) ? (fullRowStrs[4] + ',' + fullRowStrs[5]) : '';
        
        const floorStr = fullRowStrs[6] ? fullRowStrs[6].trim() : '1';
        window.importedBdFloor = floorStr;
        const apFloorInput = document.getElementById('apDefaultFloor');
        if (apFloorInput) apFloorInput.value = floorStr;
      }
    }
  });

  return config;
}

function parseRawRows(rawRows, returnComplex) {
  const res = [];
  const idx = {
    lat: -1,
    lng: -1,
    color: -1,
    shape: -1,
    ap: -1,
    bssid: -1,
    rectype: -1,
    key: -1,
    val: -1,
    height: -1,
    floor: -1,
    bldgFloor: -1,
    area: -1,
    c1: -1,
    c2: -1,
    error: -1,
    map: -1,
    freq: -1,
    label: -1
  };
  let startIndex = 0;

  if (rawRows.length > 0) {
    const headers = rawRows[0].map(s => String(s || '').toUpperCase().trim());
    if (headers.some(
            h => h.includes('LAT') || h.includes('BSSID') || h === 'KEY' ||
                h === 'VALUE' || h.includes('RECORD_TYPE') ||
                h.includes('RECORD-TYPE'))) {
      startIndex = 1;
      headers.forEach((l, i) => {
        if (l.includes('LAT')) idx.lat = i;
        if (l.includes('LNG') || l.includes('LONG')) idx.lng = i;
        if (l.includes('COLOR')) idx.color = i;
        if (l.includes('SHAPE')) idx.shape = i;
        if (l.includes('AP#') || l === 'AP') idx.ap = i;
        if (l.includes('BSSID')) idx.bssid = i;
        if (l.includes('RECORD_TYPE') || l.includes('RECORD-TYPE'))
          idx.rectype = i;
        if (l === 'KEY') idx.key = i;
        if (l === 'VALUE') idx.val = i;
        if (l.includes('HEIGHT')) idx.height = i;
        if (l === 'FLOOR') idx.floor = i;
        if (l.includes('BUILDING_FLOOR')) idx.bldgFloor = i;
        if (l === 'AREA') idx.area = i;
        if (l === 'C1') idx.c1 = i;
        if (l === 'C2') idx.c2 = i;
        if (l.includes('ERROR')) idx.error = i;
        if (l === 'MAP') idx.map = i;
        if (l.includes('FREQ')) idx.freq = i;
        if (l.includes('LABEL')) idx.label = i;
      });
    } else {
      idx.rectype = 0;
      idx.bssid = 1;
      idx.lat = 2;
      idx.lng = 3;
      idx.ap = 4;
      idx.error = 5;
      idx.area = 8;
      idx.key = 1;
      idx.val = 2;
    }
  }

  const headers = rawRows.length > 0 ?
      rawRows[0].map(s => String(s || '').toUpperCase().trim()) :
      [];
  const hasHeaders = headers.includes('LAT') || headers.includes('LATITUDE') ||
      headers.includes('LNG') || headers.includes('LONGITUDE');

  for (let i = startIndex; i < rawRows.length; i++) {
    const cols = rawRows[i].map(
        s => String(s !== null && s !== undefined ? s : '').trim());
    if (cols.every(c => c === '') || (cols[0] && cols[0].startsWith('#')))
      continue;
    const getC = (cIdx) => cIdx > -1 ? (cols[cIdx] || '') : '';

    const rectypeVal = getC(idx.rectype).toUpperCase();
    let curLatIdx = idx.lat;
    let curLngIdx = idx.lng;
    let curApIdx = idx.ap;
    let curBssidIdx = idx.bssid;
    let curAreaIdx = idx.area;
    let curColor = getC(idx.color) || 'blue';
    let curShape = getC(idx.shape) || 'circle';

    let errVal = '';
    let lblVal = '';
    let htVal = '';

    if (hasHeaders && rectypeVal === 'AP') {
      curLatIdx = idx.lat !== -1 ? idx.lat : 2;
      curLngIdx = idx.lng !== -1 ? idx.lng : 3;
      curApIdx = idx.ap !== -1 ? idx.ap : 4;
      curBssidIdx = idx.bssid !== -1 ? idx.bssid : 1;
      curAreaIdx = idx.area !== -1 ? idx.area : 8;
      curColor = getC(idx.color) || 'blue';
      curShape = getC(idx.shape) || 'circle';
    } else {
      if (rectypeVal === 'GT' || rectypeVal === 'WP') {
        curLatIdx = 3;
        curLngIdx = 4;

        let possibleName7 = cols[7] ? String(cols[7]).trim() : '';

        if (rectypeVal === 'GT') {
          const defaultHeight =
              document.getElementById('gtDefaultHeight')?.value.trim() || '1.0';
          const defaultError =
              document.getElementById('gtDefaultError')?.value.trim() || '0.1';
          const defaultLabelPrefix = 'GT-';

          const rawHt = cols[5] ? String(cols[5]).trim() : '';
          htVal = (rawHt && rawHt !== '') ? rawHt : defaultHeight;

          const val6 = cols[6] ? String(cols[6]).trim() : '';
          const isNumeric6 =
              (val6 !== '' && !isNaN(parseFloat(val6)) && isFinite(val6));

          if (isNumeric6) {
            errVal = val6;
            const rawLbl = cols[7] ? String(cols[7]).trim() : '';
            lblVal =
                (rawLbl && rawLbl !== '') ? rawLbl : (defaultLabelPrefix + (i));
            curApIdx = -1;
          } else {
            curApIdx = 6;
            errVal = defaultError;
            const rawLbl = cols[6] ? String(cols[6]).trim() : '';
            lblVal =
                (rawLbl && rawLbl !== '') ? rawLbl : (defaultLabelPrefix + (i));
          }
        } else {
          if (possibleName7 &&
              (possibleName7.startsWith('GT-') ||
               possibleName7.startsWith('WP-') ||
               isNaN(parseFloat(possibleName7)))) {
            curApIdx = 7;
          } else {
            curApIdx = 6;
          }
        }

        curBssidIdx = -1;
        curAreaIdx = -1;
        curColor = rectypeVal === 'GT' ? 'green' : 'yellow';
        curShape = 'circle';
      } else {
        curLatIdx = 2;
        curLngIdx = 3;
        curApIdx = 4;
        curBssidIdx = 1;
        curAreaIdx = 8;
        curColor = getC(idx.color) || 'blue';
        curShape = getC(idx.shape) || 'circle';
      }
    }

    const item = {
      rectype: rectypeVal,
      key: getC(idx.key),
      val: getC(idx.val),
      color: curColor,
      shape: curShape,
      ap: (rectypeVal === 'GT') ? lblVal : getC(curApIdx),
      bssid: (rectypeVal === 'GT') ?
          '' :
          (curBssidIdx > -1 ? getC(curBssidIdx) : (rectypeVal + '_BSSID')),
      height: (rectypeVal === 'GT') ? htVal : getC(idx.height),
      error: (rectypeVal === 'GT') ? errVal : getC(idx.error),
      floor: getC(idx.floor),
      bldgFloor: getC(idx.bldgFloor),
      area: (rectypeVal === 'GT') ?
          '' :
          (curAreaIdx > -1 ? getC(curAreaIdx) : 'NEW_AREA'),
      c1: getC(idx.c1),
      c2: getC(idx.c2),
      map: getC(idx.map),
      freq: getC(idx.freq),
      label: (rectypeVal === 'GT') ? lblVal : getC(idx.label),
      fullRow: cols
    };

    if (curLatIdx > -1 && curLngIdx > -1) {
      const lat = getC(curLatIdx);
      const lng = getC(curLngIdx);
      if (!isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
        item.lat = parseFloat(lat);
        item.lng = parseFloat(lng);
      }
    }
    res.push(item);
  }

  return returnComplex ? {
    markers: res,
    latIdx: idx.lat,
    lngIdx: idx.lng,
    apIdx: idx.ap,
    bssidIdx: idx.bssid,
    rectypeIdx: idx.rectype,
    areaIdx: idx.area,
    errorIdx: idx.error
  } :
                         res;
}

function fetchTab(sheetId, gid, resourceKey, returnComplex) {
  return new Promise(async (resolve) => {
    const rKey = resourceKey ? '&resourcekey=' + resourceKey : '';
    const preferredPrefix =
        window.workingSheetUserPrefix || window.currentSheetUserPrefix || '';

    // 1. Try standard Fetch on CSV endpoint (Bypasses all GViz truncation &
    // type logic). Do NOT pass {credentials: 'include'} here because Google's
    // CSV export returns 'Access-Control-Allow-Origin: *', which browsers
    // reject when credentials mode is 'include'.
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${
          sheetId}/export?format=csv&gid=${gid}${rKey}`;
      const resp = await fetch(csvUrl);
      if (resp.ok) {
        const text = await resp.text();
        if (text && !text.toLowerCase().includes('<html')) {
          const lines = text.split(/\r?\n/);
          const rawRows = [];
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('#')) continue;
            const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
                             .map(s => s.replace(/^"|"$/g, '').trim());
            rawRows.push(cols);
          }
          return resolve(parseRawRows(rawRows, returnComplex));
        }
      }
    } catch (e) {
      console.log('CSV fetch failed, falling back to JSONP...');
    }

    // 2. Fallback to GViz JSONP (supports multi-account sessions u/0, u/1, u/2)
    // Pass headers=1 so GViz does not swallow XPARAM/config rows into column
    // labels.
    const candidatePrefixes = [];
    [preferredPrefix, '', 'u/0/', 'u/1/', 'u/2/'].forEach(p => {
      if (p !== undefined && !candidatePrefixes.includes(p)) {
        candidatePrefixes.push(p);
      }
    });

    const tryGvizWithPrefix = (prefix) => {
      return new Promise((resGviz) => {
        const cbName = '__gvizCb_' +
            Math.random().toString(36).substring(2, 10) + '_' + Date.now();
        const url = `https://docs.google.com/spreadsheets/${prefix}d/${
            sheetId}/gviz/tq?tqx=out:json;responseHandler:${
            cbName}&headers=1&gid=${gid}${rKey}`;
        const script = document.createElement('script');
        let finished = false;
        const cleanup = () => {
          finished = true;
          try {
            delete window[cbName];
          } catch (e) {
            window[cbName] = undefined;
          }
          if (script.parentNode) script.remove();
        };
        window[cbName] = function(resp) {
          if (finished) return;
          cleanup();
          if (!resp || resp.status === 'error' || !resp.table) {
            resGviz(null);
          } else {
            window.workingSheetUserPrefix = prefix;
            resGviz(parseData(resp.table, returnComplex));
          }
        };
        script.src = url;
        script.onerror = () => {
          if (finished) return;
          cleanup();
          resGviz(null);
        };
        document.head.appendChild(script);
      });
    };

    for (const prefix of candidatePrefixes) {
      const result = await tryGvizWithPrefix(prefix);
      if (result &&
          (Array.isArray(result) ?
               result.length > 0 :
               (result.markers && result.markers.length >= 0))) {
        return resolve(result);
      }
    }

    resolve([]);
  });
}

function parseData(table, returnComplex) {
  const rawRows = [];
  if (table.cols && table.cols.length > 0) {
    const headerRow = table.cols.map(
        c => (c && c.label !== null && c.label !== undefined) ?
            String(c.label).trim() :
            '');
    if (headerRow.some(cell => cell !== '')) {
      rawRows.push(headerRow);
    }
  }
  if (table.rows && table.rows.length > 0) {
    table.rows.forEach(r => {
      if (!r || !r.c) return;
      const rowCols = r.c.map(cell => {
        if (!cell) return '';
        if (cell.v !== null && cell.v !== undefined)
          return String(cell.v).trim();
        if (cell.f !== null && cell.f !== undefined)
          return String(cell.f).trim();
        return '';
      });
      if (rowCols.some(cell => cell !== '')) {
        rawRows.push(rowCols);
      }
    });
  }
  return parseRawRows(rawRows, returnComplex);
}
