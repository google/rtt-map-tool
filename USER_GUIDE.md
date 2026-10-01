<!-- disableFinding(LINE_OVER_80) -->
<!-- disableFinding(WHITESPACE_TRAILING) -->

# RTT Map Tool — User Guide

## 1. Introduction & Purpose

**RTT Map Tool** ([rtt-map-tool.html](rtt-map-tool.html)) is an interactive, browser-based geospatial visualization and configuration editor built for **Wi-Fi Round-Trip Time (IEEE 802.11mc / 802.11az Fine Timing Measurement FTM RTT) indoor positioning systems**.

Indoor positioning systems require accurate geographic ground-truthing of building floorplans, precise coordinates and metadata for Wi-Fi Access Points (`AP`), surveyed Ground Truth (`GT`) reference paths, and walkable navigation graphs (`WP`) representing corridors and aisles. Manually calculating and editing these latitude/longitude records in raw spreadsheets or XML files is error-prone and difficult to validate visually.

**What RTT Map Tool Does:**

1. **Georeferences Building Floorplans**: Overlays 2D building floorplan images (`.png`, `.jpg`, `.webp`) onto real-world base maps (**OpenStreetMap**, **Google Maps**, or **Google Earth** satellite imagery) and lets you interactively position or fine-tune the floorplan's Southwest (`SW`) and Northeast (`NE`) bounding corners.
2. **Manages Indoor Positioning Entities**: Provides visual point-and-click, drag, and precision-nudge editing for four core feature types:
   - **Access Points (`AP`)**: Purple circular markers storing BSSID (MAC address), latitude, longitude, installation height, building floor, floorplan name, area type, and frequency.
   - **Ground Truth Points (`GT`)**: Green circular markers connected by a sequential green polyline representing surveyed reference trajectories, along with device height and error tolerance.
   - **Walkable Route Waypoints (`WP`)**: Yellow circular nodes connected by yellow edges (`way` segments with `highway` tags such as `aisle`) for indoor pedestrian routing and particle-filter constraints.
   - **Floorplan Corners (`FP Corners`)**: Black teardrop pins marking the `FP SW` and `FP NE` geographic bounds of the floorplan image overlay.
3. **Evaluates Positioning Accuracy**: Matches estimated positions against Ground Truth / reference markers by `BSSID` across two active marker layers, draws dashed red error vectors on the map, and computes real-time error statistics in meters (**Pairs Found**, **RMSE**, **Median / 50%**, **90th %**, and **Max Error**).
4. **Imports & Exports Standard Formats**: Reads and writes `.csv` positioning configuration files (`PARAM`, `BD`, `AP`, `GT`), fetches multi-tab datasets directly from shared **Google Sheets**, and imports/exports **OpenStreetMap (`.osm` XML)** walkable route graphs.

--------------------------------------------------------------------------------

## 2. Interface Layout Overview

The application window is divided into two main regions:

- **Left Control Sidebar**: Displays the application header and version (`RTT Map Tool: <Version>`) followed by six collapsible/modular subpanels:
  1. **File** — Import configurations (`.csv` or Google Sheets), import `.osm` route graphs, reload previous sessions, or reset parameters.
  2. **Map** — Switch the underlying geographic tile layer (`OSM`, `Google Maps`, `Google Earth`).
  3. **Status** — Inspect real-time operation status messages and the clipboard-synced edit history changelog.
  4. **Params** — Adjust floorplan opacity, inspect bounding coordinates, and configure default values for new `AP`, `GT`, and `WP` records.
  5. **Edit** — Select marker types and interaction modes (`OFF`, `EDIT`, `ADD`, `DEL`), undo/redo actions, view error metrics, capture coordinates, nudge markers, and search by name or BSSID.
  6. **Export** — Download updated `.osm` walkable route graphs and `.csv` positioning configuration files.
- **Interactive Map Canvas (Right Pane)**:
  - **Minimize / Expand Sidebar Button (`<` / `>`)**: Located at the top-left edge of the map canvas; collapses or expands the left sidebar to maximize map viewing area.
  - **Zoom Controls (`+` / `-` / `↻`)**: Located in the top-left corner of the map. Below Zoom In (`+`) and Zoom Out (`-`), the **Reset Floorplan Zoom (`↻`)** button immediately fits the map camera back to the active floorplan's `SW`/`NE` bounds.
  - **Layer Control Legend (Top-Right)**: Appears automatically once layers are loaded or created. Provides checkboxes to toggle visibility of `FP Corners`, `FP Layer` (the floorplan image), imported/created marker layers (`Imported csv APs`, `Imported csv GTs`, `Imported csv WPs`, `Tab ID: <gid>`, `New <Type> Layer`), and `Show Error Lines`.

--------------------------------------------------------------------------------

## 3. Subpanel-by-Subpanel Reference

### 3.1 File Subpanel

Controls all file and spreadsheet ingestion as well as session recovery and parameter resets.

| Control / Field | Type | Description |
| :--- | :--- | :--- |
| **`Config` / `Sheet`** | Radio buttons | Selects the primary configuration source. **`Config`** (default) reveals the local `.csv` file loader; **`Sheet`** reveals the Google Sheets URL loader. |
| **`drag mode`** | Checkbox | Toggles both the `.csv` Configuration loader and `.osm` Walkable Routes loader between standard text-box/button rows and dashed **Drag & Drop** drop zones. Clicking a drop zone also opens the system file browser. |
| **`Configuration (.csv)`** | Read-only text field | *(Visible in `Config` mode)* Displays the filename of the currently loaded `.csv` configuration file. |
| **`Load` (CSV)** | Button (Blue) | *(Visible in `Config` mode)* Opens a file picker to load a `.csv` configuration file containing `PARAM`, `BD`, `AP`, `GT`, and/or `WP` rows. If the file contains a `BD` floorplan record, a **Floor Plan Load Required** modal dialog prompts you to select the corresponding floorplan image file (`.png`, `.jpg`, `.webp`). |
| **`Sheet URL:`** | Text input + dropdown | *(Visible in `Sheet` mode)* URL of a shared Google Sheet. Includes an autocomplete history dropdown of up to 15 recently loaded spreadsheets. |
| **`Browse`** | Button (Orange) | *(Visible in `Sheet` mode)* Opens Google Sheets (`https://sheets.google.com`) in a popup window and arms automatic clipboard detection: copy your spreadsheet URL (`Ctrl+L`, `Ctrl+C`) and return to the RTT Map Tool window (or press `Ctrl+V`) to auto-fill and load the sheet. |
| **`Load` (Sheet)** | Button (Green) | *(Visible in `Sheet` mode)* Reads the configuration tab (`gid=0`) from the specified Google Sheet URL, parses `PARAM` and `BD` records, prompts for the floorplan image if specified, and plots all marker tabs listed in `GIDS`. |
| **`OSM walkable routes (.osm)`** | Read-only text field | Displays the filename of the currently imported `.osm` or `.xml` walkable route graph. |
| **`Load` (OSM)** | Button (Blue) | Opens a file picker to import an OpenStreetMap XML (`.osm`, `.xml`) file containing `<node>` waypoints (`WP`) and `<way>` connectivity edges. |
| **`Reload Previous Files`** | Button (Blue) | Restores the most recently loaded `.csv` configuration (or Google Sheet URL), `.osm` route file, and floorplan image from browser `IndexedDB` file handles and `localStorage` in a single click. |
| **`Reset Params`** | Button (Purple) | Resets all UI fields, default parameters (`AP`, `GT`, `WP`), opacity slider, base map selection, edit mode, search inputs, and collapsible checkboxes back to their initial defaults. |

--------------------------------------------------------------------------------

### 3.2 Map Subpanel

Selects the underlying geographic tile layer rendered beneath the floorplan and markers.

| Control / Field | Type | Description |
| :--- | :--- | :--- |
| **`OSM`** | Radio button | *(Default)* Displays standard OpenStreetMap street tiles (supports zooming up to level 22). Does not require an API key. |
| **`Google Maps`** | Radio button | Switches the base map to Google Maps Roadmap view. Requires a `PARAM,MAP-GKEY,<API_KEY>` entry in the loaded configuration. |
| **`Google Earth`** | Radio button | Switches the base map to Google Earth satellite hybrid imagery (satellite photography with road/place labels). Requires a `PARAM,MAP-GKEY,<API_KEY>` entry in the loaded configuration. |

--------------------------------------------------------------------------------

### 3.3 Status Subpanel

Provides real-time operational feedback and a clipboard-integrated audit trail of marker edits.

| Control / Field | Type | Description |
| :--- | :--- | :--- |
| **`Show Changelog`** | Checkbox | Expands or hides the **Change Log (History)** text area. |
| **`Change Log (History):`** | Read-only textarea | *(Visible when `Show Changelog` is checked)* Logs every marker addition, drag movement, single/batch nudge, deletion, and floorplan corner adjustment. Whenever a marker is added, moved, or nudged, its updated row is formatted as tab-separated values (TSV) and **automatically copied to your system clipboard** for direct pasting into Google Sheets or Excel. |
| **`Status:`** | Read-only console | Displays a color-coded scrolling log (up to 50 recent messages) showing file import progress, active edit/delete modes, selected marker coordinates, and system warnings or errors. |

--------------------------------------------------------------------------------

### 3.4 Params Subpanel

Controls floorplan overlay geometry and default metadata values assigned to newly created or exported markers.

| Control / Field | Type | Description |
| :--- | :--- | :--- |
| **`Show`** | Checkbox | Expands or collapses the **Params** configuration section. |
| **`Floorplan Opacity:`** | Range slider (`0`–`1`) | Adjusts the opacity of the overlaid building floorplan image in `0.1` increments (default `0.8`). Lowering opacity allows you to see underlying satellite/street features when aligning building corners. |
| **`Map Image Target:`** | Read-only text field | Shows the target floorplan image filename parsed from the loaded configuration's `BD` or `MAP1` parameter. |
| **`Choose File` (Fallback Box)** | File input | *(Appears only if the browser blocks the Floorplan prompt modal)* Lets you manually select the target floorplan image file from disk. |
| **`SW Corner:`** | Read-only text field | Displays the current `latitude,longitude` (7 decimal places) of the Southwest floorplan corner (`FP SW`). Updates live when dragged or nudged. |
| **`NE Corner:`** | Read-only text field | Displays the current `latitude,longitude` (7 decimal places) of the Northeast floorplan corner (`FP NE`). Updates live when dragged or nudged. |
| **`Target GIDs (Marker Tabs):`** | Read-only text field | Displays the comma-separated Google Sheet tab IDs (`GIDS`) configured for marker loading. |

#### AP Defaults Sub-Section

Defines default attributes applied when adding new `AP` markers on the map (or filling in missing attributes during CSV export):

| Field | Default Value | Description |
| :--- | :--- | :--- |
| **`BSSID`** | `60:B7:6E:xx:xx:xx` | Default MAC address / BSSID assigned to newly placed `AP` markers. |
| **`HEIGHT(M)`** | `2.8` | Default mounting height of the Access Point above the floor in meters. |
| **`FLOOR`** | `1` | Default building floor identifier (automatically updated if a `BD` record specifies a floor). |
| **`FLOOR PLAN`** | *(Auto-populated)* | Floorplan identifier associated with the AP (automatically populated from the `BD` map name or loaded floorplan filename). |
| **`AREA`** | `office` | Default environment/zone classification tag (e.g., `office`, `lobby`, `corridor`). |
| **`FREQ (HZ)`** | `-1` | Operating channel frequency in Hz. If left as `-1` or blank, the optional frequency column is omitted upon CSV export. |

#### GT Defaults Sub-Section

Defines default attributes applied to Ground Truth (`GT`) survey points:

| Field | Default Value | Description |
| :--- | :--- | :--- |
| **`HEIGHT(M)`** | `1.0` | Default height of the test device / receiver above the floor in meters. |
| **`ERROR(M)`** | `0.1` | Default ground truth measurement tolerance / expected error in meters. |

#### WP Defaults Sub-Section

Defines default attributes for Walkable Route (`WP`) edges:

| Field | Default Value | Description |
| :--- | :--- | :--- |
| **`WP-PATH TAG`** | `aisle` | Default OpenStreetMap `highway` tag (`<tag k="highway" v="..." />`) assigned to newly drawn walkable route segments. |

--------------------------------------------------------------------------------

### 3.5 Edit Subpanel

Provides all interactive map editing tools, undo/redo history, BSSID error statistics, coordinate inspection, precision nudging, and marker search.

#### Marker Type & Mode Controls

| Control / Field | Type | Description |
| :--- | :--- | :--- |
| **`Show Nudge`** | Checkbox | Shows or hides the **Nudge Position Relative to FP** control block at the bottom of the Edit subpanel. |
| **Target Marker Type (`AP` \| `GT` \| `WP` \| `FP Corners`)** | Radio buttons | Selects which feature class is targeted by `EDIT`, `ADD`, `DEL`, and `Nudge` operations:<br>• **`AP`**: Wi-Fi Access Points (purple circles).<br>• **`GT`**: Ground Truth survey points (green circles connected in sequence by a green polyline).<br>• **`WP`**: Walkable Route waypoints (yellow circles connected by yellow graph edges).<br>• **`FP Corners`**: Floorplan Southwest (`FP SW`) and Northeast (`FP NE`) corner pins (black teardrops).<br>*(Note: Selecting `AP`, `GT`, or `WP` when no layer for that type exists automatically creates a `New <Type> Layer`.)* |
| **Interaction Mode (`OFF` \| `EDIT` \| `ADD` \| `DEL`)** | Segmented radio bar | Controls how mouse clicks and drags interact with the map:<br>• **`OFF`** *(Default)*: View-only navigation mode. Clicking a marker opens its info popup and copies its coordinates to the coordinate box.<br>• **`EDIT`**: Enables dragging for markers of the active Target Marker Type and adds an inline **`Edit`** button inside marker and path popups to modify attributes (`Label`, `BSSID`, `Height`, `Floor`, `Map`, `Area`, `Freq` for `AP`; `Height` and `Error` for `GT`; `Tag` for `WP` edges; exact numeric `Latitude`/`Longitude` for `FP Corners`).<br>• **`ADD`**: Clicking the map places a new marker of the active Target Marker Type:<br>&nbsp;&nbsp;– **`AP`**: Places a new auto-numbered `AP` marker (e.g., `AP-01`, `AP-02`) using `AP Defaults`.<br>&nbsp;&nbsp;– **`GT`**: Appends a new `GT` marker to the end of the path, **or** if you click directly on an existing green `GT` line segment, inserts a new `GT` point into that segment and automatically increments all subsequent `GT` labels.<br>&nbsp;&nbsp;– **`WP`**: Places a new `WP` node (or splits an existing yellow `WP` edge if clicked directly on a yellow segment) and sets it as the active focus node.<br>&nbsp;&nbsp;– **`FP Corners`**: Creates `FP SW` and `FP NE` corner pins around the clicked location if they do not already exist.<br>• **`DEL`**: Clicking a marker of the active Target Marker Type deletes it. Deleting a single `GT` marker automatically decrements the numbering of all higher-numbered `GT` markers so the sequence stays contiguous. |
| **`Del ONLY selected` \| `Del ALL`** | Toggle buttons | *(Visible only when Target Type = `GT` and Mode = `DEL`)*<br>• **`Del ONLY selected`** *(Default)*: Clicking a `GT` marker deletes only that marker.<br>• **`Del ALL`**: Immediately deletes **all** `GT` markers across active layers in a single undoable operation. |
| **`Add Point+Path to Focus` \| `Add Point ONLY`** | Segmented radio bar | *(Visible only when Target Type = `WP` and Mode = `ADD`)*<br>• **`Add Point+Path to Focus`** *(Default)*: Clicking the map creates a new `WP` node and connects it with a yellow edge to the currently focused `WP` node; clicking an existing `WP` node links the focus node to that clicked node. *(Tip: Hold `Shift` while clicking to shift focus or place an unconnected node without creating an edge.)*<br>• **`Add Point ONLY`**: Places unconnected `WP` nodes on the map (or shifts focus when clicking an existing `WP` node) without adding edges. |
| **`Undo Last`** | Button (Orange) | Reverts the most recent action (add, drag, nudge, popup attribute edit, delete, or file import) on any visible layer. |
| **`Redo Last`** | Button (Orange) | Re-applies the most recently undone action on any visible layer. |

#### Error Statistics, Coordinate Pointer, Nudge & Search Controls

| Control / Field | Type | Description |
| :--- | :--- | :--- |
| **`Error Statistics (Meters)`** | Metrics panel | *(Automatically appears when two marker layers with matching BSSIDs are visible and `Show Error Lines` is checked in the map legend)* Displays:<br>• **`Pairs Found:`** — Count of BSSID-matched marker pairs between the two layers.<br>• **`RMSE:`** — Root Mean Square Error in meters.<br>• **`Median (50%):`** — 50th percentile distance error in meters.<br>• **`90th %:`** — 90th percentile distance error in meters.<br>• **`Max Error:`** — Largest single distance error in meters. |
| **`PTR`** | Toggle button | Toggles **Pointer Mode** on (green) or off (gray). When active, switches Interaction Mode to `OFF`, changes the cursor to a crosshair, and drops a red target reticle wherever you click on the map. |
| **`Click on map for coordinate.`** | Read-only text field | Displays the `latitude, longitude` (to 7 decimal places) of the most recently clicked map location or marker, and auto-selects the text for quick copying. |
| **`single` \| `all` (Nudge Scope)** | Radio buttons | *(Visible when `Show Nudge` is checked; requires `EDIT` mode)*<br>• **`single`** *(Default)*: Nudges only the currently selected marker (must match the active Target Marker Type).<br>• **`all`**: Mass-nudges **all** markers in visible layers (or both `FP SW` and `FP NE` corners simultaneously when `FP Corners` is selected). |
| **`show pop-up`** | Checkbox | *(Visible when `Show Nudge` is checked; default checked)* When unchecked, suppresses marker info popups when clicking, dragging, or searching markers so you can view and nudge markers without popup occlusion. |
| **`▲` / `▼` / `◀` / `▶` (Nudge Arrows)** | Directional buttons | *(Visible when `Show Nudge` is checked; requires `EDIT` mode)* Shifts the target marker(s) North (`▲`, `+Lat`), South (`▼`, `-Lat`), West (`◀`, `-Lng`), or East (`▶`, `+Lng`) by the step value in **`Nudge (degs)`**. |
| **`Nudge (degs)`** | Text input | *(Visible when `Show Nudge` is checked)* Step size in decimal degrees per arrow click (default `0.000001`°, which is approximately `11 cm` in latitude). |
| **`Search (Name or BSSID):`** | Text input + `Go` button | Searches all loaded markers by name/label (e.g., `AP-05`, `GT-10`, `WP-02`) or `BSSID` substring. Clicking **`Go`** (or pressing `Enter`) flies the map to zoom level 22 on the matched marker, selects it for nudging, and displays `Result X of Y`. Clicking **`Go`** repeatedly cycles through all matching markers. |

--------------------------------------------------------------------------------

### 3.6 Export Subpanel

Generates downloadable files containing your edited positioning configuration and walkable route graph.

| Control / Field | Type | Description |
| :--- | :--- | :--- |
| **`Export OSM`** | Button (Purple) | Exports all `WP` waypoints (`<node>`) and connected yellow route edges (`<way>` with `<tag k="highway" v="..." />`) from active layers as an OpenStreetMap XML file named **`open-street-map-path.osm`**. |
| **`Export CSV`** | Button (Blue) | Exports all `PARAM` directives, the `BD` floorplan bounds record (`BD,<MAP>,<SW_LAT>,<SW_LNG>,<NE_LAT>,<NE_LNG>,<FLOOR>`), all `AP` records, and all `GT` records from currently visible layers as a configuration CSV file named **`map_export_config.csv`**. |

--------------------------------------------------------------------------------

## 4. Example End-to-End Walkthrough

Below is a typical workflow demonstrating how to load a building configuration, align a floorplan, calibrate Access Points (`AP`), survey Ground Truth (`GT`) points, construct a walkable route graph (`WP`), and export the final files.

### Step 1: Launch the Tool and Load a Configuration
1. Start a local web server in the repository directory (`python3 -m http.server 8080`) and open `http://localhost:8080/rtt-map-tool.html` in your browser.
2. In the **File** subpanel, keep **`Config`** selected and click the blue **`Load`** button (or check **`drag mode`** and drag-and-drop your `.csv` file, such as `CL4-2-Config.csv`, into the drop zone).
3. When the **Floor Plan Load Required** modal dialog appears requesting the building floorplan image (e.g., `CL4-2.png`), click **`OK`** and select `CL4-2.png` from your computer.
4. The map automatically zooms to the floorplan bounds, overlays the floorplan image (`FP Layer`), places the black **`FP SW`** and **`FP NE`** corner pins, and plots any imported `AP`, `GT`, and `WP` markers.

### Step 2: Align the Floorplan with the Base Map
1. In the **Map** subpanel, select **`OSM`** (or **`Google Earth`** if your config includes a `MAP-GKEY`).
2. In the **Params** subpanel, check **`Show`** and drag the **`Floorplan Opacity:`** slider to `0.5` so you can see both the building outline on the base map and the overlaid floorplan image.
3. In the **Edit** subpanel:
   - Select **`FP Corners`** as the target marker type.
   - Switch the interaction mode pill from `OFF` to **`EDIT`**.
   - Drag the black **`FP SW`** and **`FP NE`** teardrop pins on the map until the floorplan walls align with the satellite/street building footprint.
   - For sub-meter adjustments, check **`Show Nudge`**, select **`single`** (to nudge the last-clicked corner) or **`all`** (to shift the entire floorplan without changing its size), set **`Nudge (degs)`** to `0.000001`, and click the **`▲` / `▼` / `◀` / `▶`** arrows.
4. Slide **`Floorplan Opacity:`** back to `0.8`.

### Step 3: Place and Edit Wi-Fi Access Points (`AP`)
1. In the **Params** subpanel (with **`Show`** checked), verify the **AP Defaults** fields (for example: `HEIGHT(M)` = `2.8`, `FLOOR` = `2`, `AREA` = `office`).
2. In the **Edit** subpanel:
   - Select **`AP`** as the target marker type.
   - Switch the mode pill to **`ADD`**.
   - Click on the floorplan at each physical Wi-Fi Access Point location to drop new purple `AP` markers (`AP-01`, `AP-02`, etc.).
3. To customize an individual Access Point's MAC address (`BSSID`) or height:
   - Switch the mode pill to **`EDIT`**.
   - Click the purple `AP` marker on the map to open its popup, then click the blue **`Edit`** button inside the popup.
   - Enter the exact `BSSID` (e.g., `60:B7:6E:12:34:56`), `Label`, or `Height(M)` and click **`Save`**.
   - You can also drag any `AP` marker to refine its position, or use the **`Search (Name or BSSID):`** box to locate a specific AP (e.g., type `AP-05` and click **`Go`**).

### Step 4: Define a Ground Truth (`GT`) Survey Path
1. In the **Edit** subpanel, select **`GT`** as the target marker type and switch the mode pill to **`ADD`**.
2. Click sequentially along a hallway on the floorplan to place green `GT` survey points (`GT-01`, `GT-02`, `GT-03`, ...). A green polyline automatically connects them in numerical order.
3. **Inserting a point mid-path**: While in `GT` + `ADD` mode, click directly on the green line segment between `GT-01` and `GT-02`. A new `GT-02` marker is inserted at that spot, and all subsequent markers (`GT-02` → `GT-03`, etc.) are automatically re-numbered.
4. **Deleting a point**: Switch to **`DEL`** mode (keeping `Del ONLY selected` active) and click any `GT` marker to remove it; subsequent `GT` markers automatically decrement their numbers to close the gap. (If you make a mistake at any point, click the orange **`Undo Last`** button.)

### Step 5: Construct a Walkable Route Graph (`WP`)
1. In the **Edit** subpanel, select **`WP`** as the target marker type and switch the mode pill to **`ADD`**.
2. Ensure **`Add Point+Path to Focus`** is selected.
3. Click along the centerlines of corridors and aisles:
   - Your first click places `WP-01` and makes it the focus node.
   - Each subsequent click places a new `WP` node (`WP-02`, `WP-03`, ...) and links it to the previous focus node with a yellow walkable edge tagged with the `WP-PATH TAG` value (`aisle`).
   - To branch off from an earlier junction (e.g., `WP-02`), hold **`Shift`** and click `WP-02` to move focus back to `WP-02` without drawing a new edge, then release `Shift` and click down the side corridor.
   - To connect a loop back to an existing waypoint, simply click that existing `WP` marker while in `Add Point+Path to Focus` mode.
   - To split an existing corridor segment and insert a junction node, click directly on the yellow line segment.

### Step 6: Export Your Updated Configuration and OSM Graph
1. In the **Export** subpanel:
   - Click **`Export CSV`** (blue) to download **`map_export_config.csv`** containing all `PARAM` rows, the updated `BD` floorplan bounds, and all `AP` and `GT` records.
   - Click **`Export OSM`** (purple) to download **`open-street-map-path.osm`** containing all `WP` `<node>` and `<way>` elements.
2. In your next browser session, click **`Reload Previous Files`** in the **File** subpanel to immediately restore your workspace.
