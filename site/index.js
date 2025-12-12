import { getAllTrackListNames, loadTrackList } from "./storage.js";

// Pagination state
let currentTrackIndex = 0;
let currentTracksArray = [];
let currentPlaylistName = "";

/**
 * Populate the playlist dropdown with available playlists from localStorage.
 */
function populatePlaylistDropdown() {
    const selectEl = document.getElementById("playlistSelect");
    const statusEl = document.getElementById("playlistStatus");

    const trackListNames = getAllTrackListNames();

    selectEl.innerHTML = "";

    if (!trackListNames.length) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "(no playlists found)";
        selectEl.appendChild(opt);
        statusEl.textContent = "No playlists found in localStorage. Create one in the Builder.";
        statusEl.className = "form-text mt-2 text-muted";
        return;
    }

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose a playlist…";
    selectEl.appendChild(placeholder);

    trackListNames.forEach((name, idx) => {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name || `Playlist #${idx + 1}`;
        selectEl.appendChild(opt);
    });

    statusEl.textContent = `Found ${trackListNames.length} playlist(s) in localStorage.`;
    statusEl.className = "form-text mt-2 text-success";
}

/**
 * Update pagination controls based on current index.
 */
function updatePaginationControls() {
    const paginationEl = document.getElementById("paginationControls");
    const counterEl = document.getElementById("trackCounter");
    const prevBtn = document.getElementById("prevTrackBtn");
    const nextBtn = document.getElementById("nextTrackBtn");

    if (!paginationEl || !counterEl || !prevBtn || !nextBtn) return;

    if (currentTracksArray.length === 0) {
        paginationEl.classList.add("d-none");
        return;
    }

    paginationEl.classList.remove("d-none");
    
    // Update counter
    counterEl.textContent = `${currentTrackIndex + 1} of ${currentTracksArray.length}`;
    
    // Enable/disable buttons
    prevBtn.disabled = currentTrackIndex === 0;
    nextBtn.disabled = currentTrackIndex === currentTracksArray.length - 1;
}

/**
 * Display a single track at the current index.
 */
function displayCurrentTrack() {
    const containerEl = document.getElementById("tracksContainer");
    if (!containerEl) return;

    containerEl.innerHTML = "";

    if (!currentTracksArray || currentTracksArray.length === 0) {
        containerEl.innerHTML = '<p class="text-muted">No tracks in this playlist.</p>';
        updatePaginationControls();
        return;
    }

    const track = currentTracksArray[currentTrackIndex];

    // Render the track as a quiz card
    const card = document.createElement("div");
    card.className = "card track-card";

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
    playBtn.onclick = () => {
        if (window.playClip) {
            window.playClip(track);
        } else {
            alert("Please log in with Spotify first.");
        }
    };

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

    confirmBtn.onclick = () => {
        if (window.confirmGuesses) {
            window.confirmGuesses(track, artistValue, songValue, confirmBtn);
        } else {
            alert("Please log in with Spotify first.");
        }
    };

    row2.appendChild(textCols);
    row2.appendChild(confirmBtn);

    body.appendChild(row1);
    body.appendChild(row2);
    card.appendChild(body);
    containerEl.appendChild(card);

    // Update pagination controls
    updatePaginationControls();
}

/**
 * Navigate to previous track.
 */
function goToPreviousTrack() {
    if (currentTrackIndex > 0) {
        currentTrackIndex--;
        displayCurrentTrack();
    }
}

/**
 * Navigate to next track.
 */
function goToNextTrack() {
    if (currentTrackIndex < currentTracksArray.length - 1) {
        currentTrackIndex++;
        displayCurrentTrack();
    }
}

/**
 * Load the selected playlist and display its first track.
 */
function loadSelectedPlaylist() {
    const selectEl = document.getElementById("playlistSelect");
    const selectedName = selectEl.value;

    if (!selectedName) {
        const containerEl = document.getElementById("tracksContainer");
        containerEl.innerHTML = '<p class="text-muted">Please select a playlist.</p>';
        currentTracksArray = [];
        currentTrackIndex = 0;
        updatePaginationControls();
        return;
    }

    const tracks = loadTrackList(selectedName);
    if (tracks) {
        currentTracksArray = tracks;
        currentPlaylistName = selectedName;
        currentTrackIndex = 0;
        displayCurrentTrack();

        // Also make these tracks available globally for app.js to use
        if (window.tracks !== undefined) {
            window.tracks = tracks;
        }
    }
}

/**
 * Initialize the playlist loader UI.
 */
export function initIndexPage() {
    populatePlaylistDropdown();

    // Event listeners
    const playlistSelect = document.getElementById("playlistSelect");
    const usePlaylistBtn = document.getElementById("usePlaylistBtn");
    const refreshPlaylistsBtn = document.getElementById("refreshPlaylistsBtn");
    const prevTrackBtn = document.getElementById("prevTrackBtn");
    const nextTrackBtn = document.getElementById("nextTrackBtn");

    if (playlistSelect) {
        playlistSelect.addEventListener("change", loadSelectedPlaylist);
    }

    if (usePlaylistBtn) {
        usePlaylistBtn.addEventListener("click", loadSelectedPlaylist);
    }

    if (refreshPlaylistsBtn) {
        refreshPlaylistsBtn.addEventListener("click", () => {
            populatePlaylistDropdown();
            const statusEl = document.getElementById("playlistStatus");
            if (statusEl) {
                statusEl.textContent = "Playlists refreshed.";
                statusEl.className = "form-text mt-2 text-info";
            }
        });
    }

    // Pagination button listeners
    if (prevTrackBtn) {
        prevTrackBtn.addEventListener("click", goToPreviousTrack);
    }

    if (nextTrackBtn) {
        nextTrackBtn.addEventListener("click", goToNextTrack);
    }

    // Auto-select first playlist if only one exists
    const trackListNames = getAllTrackListNames();
    if (trackListNames.length === 1) {
        playlistSelect.value = trackListNames[0];
        loadSelectedPlaylist();
    }
}

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", initIndexPage);