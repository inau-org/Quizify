// storage-ui-helpers.js
//
// Requires storage.js in the same folder.
// Handles UI population, playlist loading, and selecting the active playlist.
//
// Public:
//   initPlaylistLoader({ 
//      selectId, statusId, loadBtnId, useBtnId, localFile, tracksContainerId 
//   });
//
// Default IDs match the HTML you already use.

import {
    getAllTrackListNames,
    loadTrackList,
    saveTrackListFromUrl
} from "./storage.js";

/**
 * Get user-friendly playlist name from track list name.
 */
function getPlaylistLabel(playlist, index) {
    return (
        playlist.name ||
        playlist.title ||
        playlist.id ||
        `Playlist #${index + 1}`
    );
}

/**
 * Populate dropdown with playlist objects.
 */
function populateDropdown(selectEl, playlists) {
    selectEl.innerHTML = "";

    if (!playlists.length) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "(no playlists found)";
        selectEl.appendChild(opt);
        return;
    }

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose a playlist…";
    selectEl.appendChild(placeholder);

    playlists.forEach((pl, idx) => {
        const opt = document.createElement("option");
        opt.value = String(idx);
        opt.textContent = getPlaylistLabel(pl, idx);
        selectEl.appendChild(opt);
    });
}

/**
 * Load all playlists from local JSON file (e.g. tracks.json)
 */
async function importFromLocalFile(statusEl, selectEl, localFile = "./tracks.json") {
    statusEl.textContent = `Loading playlists from ${localFile}…`;

    try {
        await saveTracksFromUrl(localFile);

        const playlists = getAllTracks();
        populateDropdown(selectEl, playlists);

        statusEl.textContent =
            `Loaded ${playlists.length} playlist(s) from ${localFile} and saved to localStorage.`;

        return playlists;
    } catch (err) {
        console.error(err);
        statusEl.textContent = "Failed to load playlists (see console).";
        return [];
    }
}

/**
 * Sets the selected playlist as the "active_playlist" in localStorage.
 */
function setActivePlaylist(playlists, index, statusEl) {
    if (!index && index !== 0) {
        statusEl.textContent = "Please select a playlist first.";
        return;
    }

    const playlist = playlists[index];
    if (!playlist) {
        statusEl.textContent = "Selected playlist not found.";
        return;
    }

    try {
        localStorage.setItem("active_playlist", JSON.stringify(playlist));
        statusEl.textContent =
            `Active playlist set to: ${playlist.name || playlist.title || playlist.id}.`;

        // Emit event for other JS parts if needed
        document.dispatchEvent(
            new CustomEvent("playlistSelected", { detail: playlist })
        );
    } catch (err) {
        console.error(err);
        statusEl.textContent = "Failed to set active playlist.";
    }
}

/**
 * Main initializer for your playlist loading UI.
 */
export function initPlaylistLoader(options = {}) {
    const {
        selectId = "playlistSelect",
        statusId = "status",
        loadBtnId = "loadFromFileBtn",
        useBtnId = "usePlaylistBtn",
        localFile = "./tracks.json"
    } = options;

    const selectEl = document.getElementById(selectId);
    const statusEl = document.getElementById(statusId);
    const loadBtn = document.getElementById(loadBtnId);
    const useBtn = document.getElementById(useBtnId);

    if (!selectEl || !statusEl || !loadBtn || !useBtn) {
        console.error("Playlist loader UI not found. Check IDs:", {
            selectId, statusId, loadBtnId, useBtnId
        });
        return;
    }

    let playlists = [];

    // --- Events ---

    loadBtn.addEventListener("click", async () => {
        playlists = await importFromLocalFile(statusEl, selectEl, localFile);
    });

    useBtn.addEventListener("click", () => {
        const idx = Number(selectEl.value);
        setActivePlaylist(playlists, idx, statusEl);
    });

    // --- On startup ---

    (async function init() {
        playlists = getAllTrackListNames();

        if (!playlists.length) {
            playlists.appendChild(await importFromLocalFile(statusEl, selectEl, localFile));
        } else {
            populateDropdown(selectEl, playlists);
            statusEl.textContent =
                `Loaded ${playlists.length} playlist(s) from localStorage.`;
        }
    })();
}
