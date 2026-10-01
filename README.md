<!-- disableFinding(LINE_OVER_80) -->
<!-- disableFinding(WHITESPACE_TRAILING) -->

# RTT Map Tool

**RTT Map Tool** is a browser-based geospatial visualization and configuration
editor for Wi-Fi Round-Trip Time (IEEE 802.11mc/az FTM RTT) indoor positioning
systems. It allows researchers and engineers to align building floorplans with
geographic coordinates, place and calibrate Wi-Fi Access Points (`AP`), define
Ground Truth (`GT`) survey paths, construct OpenStreetMap (`OSM`) walkable route
graphs (`WP`), and analyze BSSID positioning accuracy.

> **Disclaimer:** This is not an officially supported Google product. This
> project is not eligible for the
> [Google Open Source Software Vulnerability Rewards Program](https://bughunters.google.com/open-source-security).

--------------------------------------------------------------------------------

## Key Features

-   **Configuration & Data Import/Export**:
    -   Load and export positioning configuration files (`.csv`) containing
        `PARAM`, `BD` (Building Floorplan bounds), `AP` (Wi-Fi Access Points),
        and `GT` (Ground Truth) records.
    -   Import configurations and multi-tab survey datasets directly from Google
        Sheets URLs.
-   **Floorplan Image Alignment**:
    -   Overlay building floorplan images (`.png`, `.jpg`) onto OpenStreetMap,
        Google Maps, or Google Earth satellite layers.
    -   Interactively drag or nudge Southwest (`SW`) and Northeast (`NE`)
        floorplan corners with live aspect-ratio and opacity controls.
-   **Interactive Marker & Graph Editing**:
    -   Add, drag, delete, and fine-tune `AP`, `GT`, and `WP` markers using
        directional nudge controls (`10cm` to `10m` step sizes) or Mass Nudge
        across an entire layer.
    -   Construct and export walkable navigation graphs in standard `.osm` XML
        format (`way` and `node` elements).
    -   Full Undo/Redo stack for marker movements, additions, deletions, and
        corner adjustments.
-   **Error Analysis & Metrics**:
    -   Compare measured positioning estimates against Ground Truth markers
        matched by BSSID or sequence and inspect mean, standard deviation,
        median, and 67th/90th percentile error metrics.

--------------------------------------------------------------------------------

## Getting Started

### Running Locally

1.  Clone or download this repository.
2.  Open `rtt-map-tool.html` directly in any modern web browser (Chrome, Edge,
    Firefox, Safari), or serve the directory over HTTP:

    ```bash
    python3 -m http.server 8080
    ```

    Then visit `http://localhost:8080/rtt-map-tool.html`.

### Building a Standalone Single-File HTML Bundle

To inline `rtt-map-tool.css` and all JavaScript modules under `js/` into a
single portable HTML file (`rtt-map-tool-out.html`):

```bash
./export.sh --inline
```

--------------------------------------------------------------------------------

## Usage Overview

1.  **Load Configuration**:
    -   In the **File** panel, select **Config** and click **Load** (or enable
        `drag mode` to drag-and-drop a `.csv` configuration file such as
        `CL4-2-Config.csv`).
    -   Alternatively, select **Sheet**, paste a shared Google Sheets URL, and
        click **Load**.
2.  **Overlay a Floorplan**:
    -   In the **Floorplan** panel, load a floorplan image (e.g., `CL4-2.png`)
        and adjust the opacity slider or `SW`/`NE` bounding coordinates.
3.  **Edit Markers & Walkable Routes**:
    -   Use the **Edit** panel to toggle between `AP`, `GT`, `WP`, or `FP
        Corners` and choose an edit mode (`mov`, `add`, `ins`, `del`, `nud`).
    -   Load or export `.osm` walkable route files from the **File** /
        **Export** panels.
4.  **Export Updates**:
    -   Use the **Export** panel to download updated `.csv` configurations or
        `.osm` route files.

--------------------------------------------------------------------------------

## Project Structure

-   `rtt-map-tool.html` — Main application UI and entry point.
-   `rtt-map-tool.css` — Application stylesheet.
-   `js/` — Modular JavaScript components (see [`js/readme.md`](js/readme.md)
    for module details).
-   `export.sh` — Build utility to bundle CSS and JS into a standalone HTML
    file.
-   `deploy-web.sh` — Helper script for versioning and deploying the standalone
    bundle via `scp`.

--------------------------------------------------------------------------------

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to contribute
and sign the Google Contributor License Agreement (CLA).

## License

This project is licensed under the Apache License, Version 2.0. See the
[LICENSE](LICENSE) file for details.
