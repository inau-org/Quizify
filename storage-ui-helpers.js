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
 * Display tracks in the tracksContainer div using the quiz card format from app.js.
 */
function displayTracks(containerEl, tracks, playlistName) {
    if (!containerEl) return;

    containerEl.innerHTML = "";

    if (!tracks || !tracks.length) {
        containerEl.innerHTML = '<p class="text-muted">No tracks in this playlist.</p>';
        return;
    }

    // Add playlist info header
    const heading = document.createElement("div");
    heading.className = "alert alert-info mb-3";
    heading.textContent = `Playlist: ${playlistName} (${tracks.length} track${tracks.length !== 1 ? 's' : ''})`;
    containerEl.appendChild(heading);

    // Render each track as a quiz card (matching app.js renderTracks format)
    for (const track of tracks) {
        const card = document.createElement("div");
        card.className = "card track-card mb-2";

        const body = document.createElement("div");
        body.className = "card-body";

        // --- Row 1: label + Play Clip button (right aligned) ---
        const row1 = document.createElement("div");
        row1.className = "d-flex justify-content-between align-items-center mb-2";

        const label = document.createElement("div");
        label.className = "fw-bold";
        label.textContent = track.name || track.title || track.id || "Untitled";

        const playBtn = document.createElement("button");
        playBtn.textContent = "Play Clip";
        playBtn.className = "btn btn-outline-primary btn-sm btn-quiz";
        playBtn.onclick = () => playClip(track);

        row1.appendChild(label);
        row1.appendChild(playBtn);

        // --- Row 2: Artist | Song | Confirm guesses (right aligned) ---
        const row2 = document.createElement("div");
        row2.className = "d-flex justify-content-between align-items-center";

        const textCols = document.createElement("div");
        textCols.className = "d-flex flex-wrap gap-3";

        const artistWrapper = document.createElement("span");
        artistWrapper.className = "me-3";
        const artistLabel = document.createElement("span");
        artistLabel.className = "fw-semibold me-1";
        artistLabel.textContent = "Artist:";
        const artistValue = document.createElement("span");
        artistValue.className = "text-muted artist-name";
        artistValue.textContent = "???";

        artistWrapper.appendChild(artistLabel);
        artistWrapper.appendChild(artistValue);

        const songWrapper = document.createElement("span");
        const songLabel = document.createElement("span");
        songLabel.className = "fw-semibold me-1";
        songLabel.textContent = "Song:";
        const songValue = document.createElement("span");
        songValue.className = "text-muted song-title";
        songValue.textContent = "???";

        songWrapper.appendChild(songLabel);
        songWrapper.appendChild(songValue);

        textCols.appendChild(artistWrapper);
        textCols.appendChild(songWrapper);

        const confirmBtn = document.createElement("button");
        confirmBtn.textContent = "Confirm guesses";
        confirmBtn.className = "btn btn-success btn-sm btn-quiz";

        confirmBtn.onclick = () =>
            confirmGuesses(track, artistValue, songValue, confirmBtn);

        row2.appendChild(textCols);
        row2.appendChild(confirmBtn);

        body.appendChild(row1);
        body.appendChild(row2);
        card.appendChild(body);
        containerEl.appendChild(card);
    }
}

/**
 * Get track ID from Spotify URI.
 */
function getTrackIdFromUri(uri) {
    if (!uri) return null;
    const parts = uri.split(":");
    return parts[2] || null;
}

/**
 * Spotify API wrapper (requires accessToken from app.js global scope).
 */
async function spotifyFetch(method, endpoint, body) {
    // Access the global accessToken from app.js
    if (!window.accessToken) throw new Error("No access token");
    const res = await fetch("https://api.spotify.com/v1" + endpoint, {
        method,
        headers: {
            "Authorization": "Bearer " + window.accessToken,
            "Content-Type": "application/json"
        },
        body: body ? JSON.stringify(body) : undefined
    });

    if (res.status === 204) return null;

    if (!res.ok) {
        const txt = await res.text();
        throw new Error("Spotify API error " + res.status + ": " + txt);
    }

    return await res.json();
}

/**
 * Play a track clip (matching app.js playClip functionality).
 */
async function playClip(track) {
    if (!window.accessToken) {
        alert("Please log in with Spotify first.");
        return;
    }

    try {
        await spotifyFetch("PUT", "/me/player/play", {
            uris: [track.uri],
            position_ms: track.startMs
        });

        const dur = track.durationMs || 2000;

        setTimeout(() => {
            spotifyFetch("PUT", "/me/player/pause").catch(err =>
                console.error("Pause error:", err)
            );
        }, dur);

    } catch (e) {
        console.error("Play error:", e);
        alert(
            "Could not play clip. Check you have an active Spotify device and (usually) a Premium account."
        );
    }
}

/**
 * Confirm guesses and reveal track info (matching app.js confirmGuesses functionality).
 */
async function confirmGuesses(track, artistEl, songEl, buttonEl) {
    if (!window.accessToken) {
        alert("Please log in with Spotify first.");
        return;
    }

    // Disable button and keep it green
    buttonEl.disabled = true;
    buttonEl.textContent = "Guesses confirmed";

    try {
        // If we already fetched metadata once, reuse it
        if (!track._artistName || !track._trackTitle) {
            const trackId = getTrackIdFromUri(track.uri);
            if (!trackId) {
                throw new Error("Invalid track URI: " + track.uri);
            }

            const data = await spotifyFetch("GET", "/tracks/" + trackId);

            track._artistName = (data.artists || [])
                .map(a => a.name)
                .join(", ") || "Unknown artist";

            track._trackTitle = data.name || "Unknown title";
        }

        artistEl.textContent = track._artistName;
        songEl.textContent = track._trackTitle;
        artistEl.classList.remove("text-muted");
        songEl.classList.remove("text-muted");

    } catch (e) {
        console.error("Reveal error:", e);
        const errorBox = document.getElementById("errorBox");
        if (errorBox) errorBox.textContent = "Could not load track info: " + e.message;
        // Re-enable button so you can try again
        buttonEl.disabled = false;
        buttonEl.textContent = "Confirm guesses";
    }
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

        // Display tracks in container using quiz format
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