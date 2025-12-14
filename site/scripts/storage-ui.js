function showError(msg) {
    console.error(msg);
    const box = document.getElementById("errorBox");
    if (box) box.textContent = msg;
}

function showBuilderError(msg) {
    const box = document.getElementById("builderError");
    if (box) box.textContent = msg || "";
}

function showImportStatus(msg, isError = false) {
    const box = document.getElementById("importStatus");
    if (box) {
        box.textContent = msg || "";
        box.className = isError ? "mt-2 small text-danger" : "mt-2 small text-success";
    }
}

function showSaveStatus(msg, isError = false) {
    const box = document.getElementById("saveStatus");
    if (box) {
        box.textContent = msg || "";
        box.className = isError ? "mt-2 small text-danger" : "mt-2 small text-success";
    }
}

function showPlaylistStatus(msg, isError = false) {
    const box = document.getElementById("playlistStatus");
    if (box) {
        box.textContent = msg || "";
        box.className = isError ? "mt-2 small text-danger" : "mt-2 small text-success";
    }
}

function showNewPlaylistError(msg) {
    const box = document.getElementById("newPlaylistError");
    if (box) box.textContent = msg || "";
}

/**
 * Update the playlist UI based on storage state
 * @param {Document} doc - The document object
 * @param {Object} storage - The storage instance
 */
async function updatePlaylistUI(document, auth, storage, options = { can_edit: false }, callbacks = {}) {
    const selectEl = document.getElementById("playlistSelect");
    const newButton = document.getElementById("newPlaylistBtn")
    const createButton = document.getElementById("createPlaylistBtn");
    const saveBtn = document.getElementById("saveToStorageBtn");
    const addTrackButton = document.getElementById("addTrackBtn");
    
    if (!selectEl || !newButton || !createButton || !saveBtn ) {
        console.error("Required UI elements not found");
        return;
    }

    // Disable editing if specified
    if(options.can_edit === false){
            newButton.style.display = "none";
            createButton.style.display = "none";
            saveBtn.style.display = "none";
    }

    // Add placeholder
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "-- Select a playlist --";

    /// Set currently selected playlist name
    /// refresh ui when changed
    function setSelectedPlaylist(name) {
        selectEl.value = name || "";
        currentPlaylistName = name || null;
        storage.TrackLists.SaveSelection(window.location, currentPlaylistName);
        
        refreshDropdownList();
    }

    builderTracks = [];

    function buildUriFromInput(input) {
        const id = extractTrackId(input);
        if (!id) return null;
        return {
            uri: "spotify:track:" + id,
            id
        };
    }

    function extractTrackId(input) {
        if (!input) return null;
        input = input.trim();

        if (input.startsWith("spotify:track:")) {
            return input.split(":")[2] || null;
        }

        const openIdx = input.indexOf("open.spotify.com/track/");
        if (openIdx !== -1) {
            const after = input.slice(openIdx + "open.spotify.com/track/".length);
            const qIdx = after.indexOf("?");
            const id = qIdx === -1 ? after : after.slice(0, qIdx);
            return id || null;
        }

        if (input.length === 22 && !input.includes(" ")) {
            return input;
        }

        return null;
    }

    async function addTrackFromUri(uri) {
            showBuilderError("");
            const parsed = buildUriFromInput(uri);

            if (!parsed) {
                showBuilderError("Could not extract a valid track ID from the input.");
                return;
            }

            try {
                const data = await auth.spotifyFetch("GET", "/tracks/" + parsed.id);
                const durationMs = data.duration_ms || 0;
                if (!durationMs) {
                    throw new Error("Track has no duration_ms from API.");
                }

                const index = builderTracks.length + 1;
                const defaultClip = Math.min(2000, durationMs);

                const track = {
                    index,
                    uri: parsed.uri,
                    trackId: parsed.id,
                    durationMs,
                    startMs: 0,
                    clipMs: defaultClip,
                    meta: {
                        name: data.name || "Unknown title",
                        artists: (data.artists || []).map(a => a.name)
                    }
                };


                builderTracks.push(track);
                spotifyInput.value = "";
                //renderTracks();

            } catch (e) {
                console.error("Add track error:", e);
                showBuilderError("Could not fetch track metadata: " + e.message);
            }
    }

    /// Get all playlist names from storage
    /// reload selection state
    function refreshDropdownList() {
        var names = storage.TrackLists.GetAllNames();

        selectEl.innerHTML = "";

        if (names.length === 0) {
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = "(No playlists available)";
            selectEl.appendChild(opt);
            storage.TrackLists.SaveSelection(window.location, null);
            return;
        }

        selectEl.appendChild(placeholder);
        currentPlaylistName = storage.TrackLists.LoadSelection(window.location);

        // Add all playlists
        names.forEach(name => {
            const opt = document.createElement("option");
            opt.value = name;
            opt.textContent = name;
            selectEl.appendChild(opt);
        });

        // Restore previous selection if available
        if (currentPlaylistName && names.includes(currentPlaylistName)) {
            selectEl.value = currentPlaylistName;
        }

        updateSaveButton();
    }

    /// make button reflect current state
    function updateSaveButton() {
        currentPlaylistName = storage.TrackLists.LoadSelection(window.location);

        if (currentPlaylistName) {
            saveBtn.disabled = false;
            saveBtn.textContent = `Save to "${currentPlaylistName}"`;
            builderTracks = storage.TrackLists.LoadList(currentPlaylistName) || [];
        } else {
            saveBtn.disabled = true;
            saveBtn.textContent = "Save Changes";
            builderTracks = [];
        }
        // Update header title
        const headerTitle = document.getElementById("playlistHeaderTitle");
        if (headerTitle) {
            headerTitle.textContent = currentPlaylistName || "(None selected)";
            headerTitle.className = currentPlaylistName ? "text-success" : "text-muted";
        }
    }

    function createNewPlaylist() {
        const nameInput = document.getElementById("newPlaylistNameInput");
        const playlistName = nameInput.value.trim();

        showNewPlaylistError("");

        if (!playlistName) {
            showNewPlaylistError("Please enter a playlist name.");
            return;
        }

        // Check if playlist already exists
        const existingNames = storage.TrackLists.GetAllNames();
        if (existingNames.includes(playlistName)) {
            showNewPlaylistError(`Playlist "${playlistName}" already exists.`);
            return;
        }

        // Create empty playlist
        if (!storage.TrackLists.SaveList(playlistName, [])) {
            showNewPlaylistError("Failed to create playlist.");
            return;
        }

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById("newPlaylistModal"));
        modal.hide();
        
        // Clear input
        nameInput.value = "";
        

        showPlaylistStatus(`Created new playlist "${playlistName}".`, false);
        setSelectedPlaylist(playlistName);
    }

    // Initial load
    refreshDropdownList();
    callbacks.onPlaylistChanged && callbacks.onPlaylistChanged(selectEl.value);

    // Event listeners
    selectEl.addEventListener("change", () => {
        const selectedName = selectEl.value;
        setSelectedPlaylist(selectedName || null);
        callbacks.onPlaylistChanged && callbacks.onPlaylistChanged(selectedName);
    });

    newButton.addEventListener("click", () => {
                const modal = new bootstrap.Modal(document.getElementById("newPlaylistModal"));
                modal.show();
    });
    createButton.addEventListener("click", createNewPlaylist);
    
    addTrackButton.addEventListener("click", async () => {        
        const spotifyInput = document.getElementById("spotifyInput");
        const rawInput = spotifyInput.value.trim();
        if (!rawInput) {
            showBuilderError("Please enter a Spotify track URI or URL.");
            return;
        }
        await addTrackFromUri(rawInput);
    });
}

/**
 * Setup pagination for a list of items
 * @param {Array} items - All items to paginate
 * @param {number} itemsPerPage - Items per page (default: 10)
 * @param {Function} renderPage - Callback to render items for current page
 * @returns {Object} Pagination controller
 */
function setupPagination(items, itemsPerPage = 1, renderPage) {
    const tracksList = document.getElementById("tracksList");
    const paginationControls = document.getElementById("paginationControls");
    const prevBtn = document.getElementById("prevPageBtn");
    const nextBtn = document.getElementById("nextPageBtn");
    const pageSelect = document.getElementById("pageSelect");
    const totalPagesSpan = document.getElementById("totalPages");
    const pageRangeStart = document.getElementById("pageRangeStart");
    const pageRangeEnd = document.getElementById("pageRangeEnd");
    const totalTracksSpan = document.getElementById("totalTracks");
    const noTracksHint = document.getElementById("noTracksHint");

    let currentPage = 1;
    let totalPages = 1;

    function updatePagination() {
        totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
        
        // Show/hide pagination controls
        if (items.length === 0) {
            paginationControls.classList.add("d-none");
            noTracksHint.classList.remove("d-none");
            tracksList.innerHTML = "";
            return;
        } else {
            noTracksHint.classList.add("d-none");
        }
        
        if (totalPages <= 1) {
            paginationControls.classList.add("d-none");
        } else {
            paginationControls.classList.remove("d-none");
        }

        // Ensure current page is valid
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        // Update page selector
        pageSelect.innerHTML = "";
        for (let i = 1; i <= totalPages; i++) {
            const opt = document.createElement("option");
            opt.value = i;
            opt.textContent = i;
            if (i === currentPage) opt.selected = true;
            pageSelect.appendChild(opt);
        }

        // Update buttons
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;

        // Update info text
        totalPagesSpan.textContent = totalPages;
        totalTracksSpan.textContent = items.length;
        
        const start = (currentPage - 1) * itemsPerPage + 1;
        const end = Math.min(currentPage * itemsPerPage, items.length);
        pageRangeStart.textContent = start;
        pageRangeEnd.textContent = end;

        // Render current page
        const pageItems = items.slice(start - 1, end);
        if (renderPage) {
            renderPage(pageItems, start - 1);
        }
    }

    // Event listeners
    prevBtn.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            updatePagination();
        }
    });

    nextBtn.addEventListener("click", () => {
        if (currentPage < totalPages) {
            currentPage++;
            updatePagination();
        }
    });

    pageSelect.addEventListener("change", () => {
        currentPage = parseInt(pageSelect.value);
        updatePagination();
    });

    // Initial render
    updatePagination();

    return {
        refresh: (newItems) => {
            items = newItems || [];
            updatePagination();
        },
        goToPage: (page) => {
            currentPage = page;
            updatePagination();
        },
        getCurrentPage: () => currentPage
    };
}

function createStorageApi(){
    return StorageRepo.create();
}