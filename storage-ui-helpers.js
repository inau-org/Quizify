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
function getPlaylistLabel(name, index) {
    return name || `Playlist #${index + 1}`;
}

/**
 * Populate dropdown with track list names from localStorage.
 */
function populateDropdown(selectEl, trackListNames) {
    selectEl.innerHTML = "";

    if (!trackListNames.length) {
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

    trackListNames.forEach((name, idx) => {
        const opt = document.createElement("option");
        opt.value = name; // Store the actual name as value
        opt.textContent = getPlaylistLabel(name, idx);
        selectEl.appendChild(opt);
    });
}

/**
 * Display tracks in the tracksContainer div.
 */
function displayTracks(containerEl, tracks, playlistName) {
    if (!containerEl) return;

    containerEl.innerHTML = "";

    if (!tracks || !tracks.length) {
        containerEl.innerHTML = '<p class="text-muted">No tracks in this playlist.</p>';
        return;
    }

    const heading = document.createElement("h3");
    heading.className = "h6 mb-3";
    heading.textContent = `Playlist: ${playlistName} (${tracks.length} track${tracks.length !== 1 ? 's' : ''})`;
    containerEl.appendChild(heading);

    tracks.forEach((track, idx) => {
        const card = document.createElement("div");
        card.className = "card track-card p-3 mb-2";

        const title = document.createElement("div");
        title.className = "fw-bold";
        title.textContent = `${idx + 1}. ${track.name || track.title || track.id || 'Untitled'}`;

        const details = document.createElement("div");
        details.className = "small text-muted mt-1";
        details.innerHTML = `
            <div><strong>ID:</strong> ${track.id || 'N/A'}</div>
            <div><strong>URI:</strong> ${track.uri || 'N/A'}</div>
            <div><strong>Start:</strong> ${track.startMs || 0}ms | <strong>Duration:</strong> ${track.durationMs || 0}ms</div>
        `;

        card.appendChild(title);
        card.appendChild(details);
        containerEl.appendChild(card);
    });
}

/**
 * Load all playlists from local JSON file (e.g. tracks.json)
 */
async function importFromLocalFile(statusEl, selectEl, localFile = "./tracks.json", playlistName = "default") {
    statusEl.textContent = `Loading playlist from ${localFile}…`;

    try {
        await saveTrackListFromUrl(playlistName, localFile);

        const trackListNames = getAllTrackListNames();
        populateDropdown(selectEl, trackListNames);

        statusEl.textContent =
            `Loaded playlist "${playlistName}" from ${localFile} and saved to localStorage.`;

        return trackListNames;
    } catch (err) {
        console.error(err);
        statusEl.textContent = "Failed to load playlist (see console).";
        return [];
    }
}

/**
 * Sets the selected track list as the "active_playlist" in localStorage
 * and displays it in the tracks container.
 */
function setActivePlaylist(trackListName, statusEl, tracksContainerEl) {
    if (!trackListName) {
        statusEl.textContent = "Please select a playlist first.";
        return;
    }

    const tracks = loadTrackList(trackListName);

    if (!tracks) {
        statusEl.textContent = `Playlist "${trackListName}" not found.`;
        return;
    }

    try {
        localStorage.setItem("active_playlist", JSON.stringify(tracks));
        statusEl.textContent = `Active playlist set to: ${trackListName} (${tracks.length} tracks)`;

        // Display tracks in container
        displayTracks(tracksContainerEl, tracks, trackListName);

        // Emit event for other JS parts if needed
        document.dispatchEvent(
            new CustomEvent("playlistSelected", {
                detail: {
                    name: trackListName,
                    tracks: tracks
                }
            })
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
        statusId = "playlistStatus",
        loadBtnId = "loadFromFileBtn",
        useBtnId = "usePlaylistBtn",
        localFile = "./tracks.json",
        tracksContainerId = "tracksContainer",
        defaultPlaylistName = "default"
    } = options;

    const selectEl = document.getElementById(selectId);
    const statusEl = document.getElementById(statusId);
    const loadBtn = document.getElementById(loadBtnId);
    const useBtn = document.getElementById(useBtnId);
    const tracksContainerEl = document.getElementById(tracksContainerId);

    if (!selectEl || !statusEl || !loadBtn || !useBtn) {
        console.error("Playlist loader UI not found. Check IDs:", {
            selectId, statusId, loadBtnId, useBtnId
        });
        return;
    }

    let trackListNames = [];

    // --- Events ---

    loadBtn.addEventListener("click", async () => {
        trackListNames = await importFromLocalFile(statusEl, selectEl, localFile, defaultPlaylistName);
    });

    useBtn.addEventListener("click", () => {
        const selectedName = selectEl.value;
        setActivePlaylist(selectedName, statusEl, tracksContainerEl);
    });

    // Also allow selecting directly from dropdown
    selectEl.addEventListener("change", () => {
        const selectedName = selectEl.value;
        if (selectedName) {
            const tracks = loadTrackList(selectedName);
            if (tracks && tracksContainerEl) {
                displayTracks(tracksContainerEl, tracks, selectedName);
            }
        }
    });

    // --- On startup ---

    (async function init() {
        trackListNames = getAllTrackListNames();

        if (!trackListNames.length) {
            trackListNames = await importFromLocalFile(statusEl, selectEl, localFile, defaultPlaylistName);
        } else {
            populateDropdown(selectEl, trackListNames);
            statusEl.textContent =
                `Found ${trackListNames.length} playlist(s) in localStorage.`;
        }

        // If there's only one playlist, auto-select it
        if (trackListNames.length === 1 && tracksContainerEl) {
            const tracks = loadTrackList(trackListNames[0]);
            displayTracks(tracksContainerEl, tracks, trackListNames[0]);
        }
    })();
}