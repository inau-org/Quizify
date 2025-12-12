/**
 * Update the playlist UI based on storage state
 * @param {Document} doc - The document object
 * @param {Object} storage - The storage instance
 */
async function updatePlaylistUI(document, storage) {
    const selectEl = document.getElementById("playlistSelect");
    
    if (!selectEl ) {
        console.error("Required UI elements not found");
        return;
    }

    function refreshDropdownList() {
        var names = storage.TrackLists.GetAllNames();

        selectEl.innerHTML = "";

        if (names.length === 0) {
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = "(No playlists available)";
            selectEl.appendChild(opt);
            storage.saveTrackListSelectionState(window.location, null);
            return;
        }

        // Add placeholder
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "-- Select a playlist --";
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

    function populatePlaylistDropdown() {
        const selectEl = document.getElementById("playlistSelect");
        const names = storage.TrackLists.GetAllNames();

        selectEl.innerHTML = "";

        if (names.length === 0) {
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = "(No playlists available)";
            selectEl.appendChild(opt);
            updateSaveButton();
            return;
        }

        // Add placeholder
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "-- Select a playlist --";
        selectEl.appendChild(placeholder);

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

    function loadSelectedPlaylist() {
        const selectEl = document.getElementById("playlistSelect");
        const selectedName = selectEl.value;

        if (!selectedName) {
            currentPlaylistName = null;
            builderTracks.length = 0;
            renderTracks();
            showPlaylistStatus("No playlist selected.", true);
            updateSaveButton();
            return;
        }

        const tracks = loadPlaylistFromStorage(selectedName);
        if (!tracks) {
            showPlaylistStatus(`Could not load playlist "${selectedName}".`, true);
            return;
        }

        currentPlaylistName = selectedName;
        builderTracks.length = 0;

        // Convert stored tracks to builder format
        tracks.forEach((t, idx) => {
            builderTracks.push({
                index: idx + 1,
                uri: t.uri,
         //       trackId: extractTrackId(t.uri),
                durationMs: 0, // Will be fetched if needed
                startMs: t.startMs || 0,
                clipMs: t.durationMs || 2000,
                meta: {
                    name: t.name || `Song #${idx + 1}`,
                    artists: []
                }
            });
        });

    //    renderTracks();
    //    showPlaylistStatus(`Loaded "${selectedName}" with ${tracks.length} track(s).`, false);
        updateSaveButton();
    }

    function updateSaveButton() {
        const saveBtn = document.getElementById("saveToStorageBtn");
        if (currentPlaylistName) {
            saveBtn.disabled = false;
            saveBtn.textContent = `Save to "${currentPlaylistName}"`;
        } else {
            saveBtn.disabled = true;
            saveBtn.textContent = "Save Changes";
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
        const existingNames = getAllPlaylistNames();
        if (existingNames.includes(playlistName)) {
            showNewPlaylistError(`Playlist "${playlistName}" already exists.`);
            return;
        }

        // Create empty playlist
        if (!savePlaylistToStorage(playlistName, [])) {
            showNewPlaylistError("Failed to create playlist.");
            return;
        }

        // Update UI
        populatePlaylistDropdown();
        const selectEl = document.getElementById("playlistSelect");
        selectEl.value = playlistName;
        currentPlaylistName = playlistName;

        // Clear tracks
        builderTracks.length = 0;
        renderTracks();

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById("newPlaylistModal"));
        modal.hide();

        // Clear input
        nameInput.value = "";

        showPlaylistStatus(`Created new playlist "${playlistName}".`, false);
        updateSaveButton();
    }

    //refreshDropdownList();

    // Event listeners
    selectEl.addEventListener("change", () => {
     //   loadSelectedPlaylist();
    });
}

function createStorageApi(){
    return StorageRepo.create();
}