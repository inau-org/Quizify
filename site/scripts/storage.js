(function (global) {
    const STORAGE_PREFIX = "tracklist:";
    const STORAGE_SELECTION_STATE = "selected_tracklist:";

    /**
     * Normalize data into an array of tracks.
     */
    function normalizeTrackList(data) {
        if (Array.isArray(data)) return data;
        if (data == null) return [];
        return [data];
    }

    /**
     * Save gui state under a given name.
     *
     * Resulting storage key: selected_tracklist:uri
     */
    function saveTrackListSelection(uri, name) {
        const key = STORAGE_SELECTION_STATE + uri;
        try {
            localStorage.setItem(key, name);
        } catch (err) {
            console.error("Failed to save track list selection:", err);
        }
    }

    /**
     * Load gui selection state for uri.
     */
    function loadTrackListSelection(uri) {
        if (!uri) throw new Error("loadTrackListSelection: uri is required");

        const key = STORAGE_SELECTION_STATE + uri;
        const name = localStorage.getItem(key);
        if (!name) return null;
        return name;
    }

    /**
     * Save a track list under a given name.
     *
     * Resulting storage key: tracklist:<name>
     */
    function saveTrackList(name, tracks) {
        if (!name) throw new Error("saveTrackList: name is required");

        const list = normalizeTrackList(tracks);
        const key = STORAGE_PREFIX + name;

        try {
            localStorage.setItem(key, JSON.stringify(list));
        } catch (err) {
            console.error("Failed to save track list:", err);
        }
    }

    /**
     * Load a track list by name.
     */
    function loadTrackList(name) {
        if (!name) throw new Error("loadTrackList: name is required");

        const key = STORAGE_PREFIX + name;
        const raw = localStorage.getItem(key);
        if (!raw) return null;

        try {
            const data = JSON.parse(raw);
            return Array.isArray(data) ? data : null;
        } catch (err) {
            console.error("Failed to parse track list:", err);
            return null;
        }
    }

    /**
     * Delete a named track list.
     */
    function deleteTrackList(name) {
        const key = STORAGE_PREFIX + name;
        localStorage.removeItem(key);
    }

    /**
     * Get all saved track list names.
     */
    function getAllTrackListNames() {
        const names = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);

            if (key.startsWith(STORAGE_PREFIX)) {
                names.push(key.slice(STORAGE_PREFIX.length));
            }
        }

        return names;
    }

    /**
     * Save a track list from a JSON string (textarea, raw text, etc.).
     */
    function saveTrackListFromString(name, jsonString) {
        let data;

        try {
            data = JSON.parse(jsonString);
        } catch (err) {
            console.error("JSON parsing error:", err);
            throw err;
        }

        saveTrackList(name, data);
    }

    /**
     * Load a track list and return it as a pretty JSON string.
     */
    function getTrackListAsString(name, pretty = true) {
        const list = loadTrackList(name);
        if (!list) return "";

        return pretty ? JSON.stringify(list, null, 2) : JSON.stringify(list);
    }

    /**
     * Save a track list from a URL (remote JSON file).
     */
    async function saveTrackListFromUrl(name, url) {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to fetch track list from URL: ${response.status}`);
        }

        try {
            const data = await response.json();
            saveTrackList(name, data);
        } catch (e) {
            // fallback to text (if not pure JSON)
            const text = await response.text();
            saveTrackListFromString(name, text);
        }
    }

    /**
     * Save a track list from a local JSON file via <input type="file">.
     */
    function saveTrackListFromFile(name, file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
                try {
                    saveTrackListFromString(name, reader.result);
                    resolve();
                } catch (e) {
                    reject(e);
                }
            };

            reader.onerror = () => reject(reader.error);

            reader.readAsText(file, "utf-8");
        });
    }

    function createStorageApi(){
        return {
            TrackLists : 
            {
                GetAllNames: getAllTrackListNames,
                SaveList: saveTrackList,
                LoadList: loadTrackList,
                SaveSelection: saveTrackListSelection,
                LoadSelection: loadTrackListSelection,
            },
        };
    }

    global.StorageRepo = { create: createStorageApi };
})(window);