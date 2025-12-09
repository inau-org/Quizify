const STORAGE_KEY = "tracks_json";

/**
 * Internal: normalize data (array or single object) into an array.
 */
function normalizeTrackList(data) {
    if (Array.isArray(data)) return data;
    if (data == null) return [];
    return [data];
}

/**
 * Internal: read the entire track list from localStorage.
 *
 * Returns:
 *  - list: array of track objects (may be empty)
 */
function readTrackList() {
    let list = [];

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw != null) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                list = parsed;
            } else {
                console.warn("Stored track data is not an array. Resetting.");
            }
        }
    } catch (err) {
        console.warn("Failed to parse track list from localStorage:", err);
    }

    return { list };
}

/**
 * Save a list of tracks (array or single object) under a single key.
 *
 * The data format matches `tracks.json`:
 * [
 *   {
 *     "id": "clip1",
 *     "name": "song 1",
 *     "uri": "spotify:track:...",
 *     "startMs": 30000,
 *     "durationMs": 2000
 *   },
 *   ...
 * ]
 */
export function saveTracks(tracks) {
    const list = normalizeTrackList(tracks);
    if (!list.length) {
        // If you want to clear when given empty, uncomment:
        // localStorage.removeItem(STORAGE_KEY);
        return;
    }

    try {
        const jsonString = JSON.stringify(list);
        localStorage.setItem(STORAGE_KEY, jsonString);
    } catch (err) {
        console.error("Failed to save track list to localStorage:", err);
    }
}

/**
 * Get all tracks as an array of objects.
 */
export function getAllTracks() {
    const { list } = readTrackList();
    return list;
}

/**
 * Get all tracks as a JSON string.
 * `pretty = true` will format with indentation (nice for textareas / files).
 */
export function getTracksAsString(pretty = true) {
    const tracks = getAllTracks();
    return pretty ? JSON.stringify(tracks, null, 2) : JSON.stringify(tracks);
}

/**
 * Clear the stored track list.
 */
export function clearAllTracks() {
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Save tracks from a JSON string (e.g. from a textfield or raw string).
 *
 * The JSON may be:
 *  - an array of track objects
 *  - a single track object
 */
export function saveTracksFromString(jsonString) {
    if (typeof jsonString !== "string") {
        throw new Error("saveTracksFromString expects a string");
    }

    let data;
    try {
        data = JSON.parse(jsonString);
    } catch (err) {
        console.error("Failed to parse JSON string for tracks:", err);
        throw err;
    }

    saveTracks(data);
}

/**
 * Save tracks from the value of a textfield / textarea element.
 *
 * Example usage in HTML:
 *   <textarea id="trackInput"></textarea>
 *   <button onclick="importFromTextView('trackInput')">Import</button>
 */
export function saveTracksFromTextView(elementIdOrElement) {
    let el = elementIdOrElement;

    if (typeof elementIdOrElement === "string") {
        el = document.getElementById(elementIdOrElement);
    }

    if (!el || !("value" in el)) {
        throw new Error("saveTracksFromTextView: invalid element or element id");
    }

    const jsonString = el.value;
    return saveTracksFromString(jsonString);
}

/**
 * Load tracks from localStorage and put the JSON into a textfield / textarea.
 *
 * Example:
 *   <textarea id="trackOutput"></textarea>
 *   <button onclick="loadTracksIntoTextView('trackOutput')">Load</button>
 */
export function loadTracksIntoTextView(elementIdOrElement, pretty = true) {
    let el = elementIdOrElement;

    if (typeof elementIdOrElement === "string") {
        el = document.getElementById(elementIdOrElement);
    }

    if (!el || !("value" in el)) {
        throw new Error("loadTracksIntoTextView: invalid element or element id");
    }

    el.value = getTracksAsString(pretty);
}

/**
 * Save tracks from a JSON file hosted on the same or remote server.
 * `url` should point to JSON with:
 *  - an array of track objects, or
 *  - a single track object
 */
export async function saveTracksFromUrl(url) {
    if (!url || typeof url !== "string") {
        throw new Error("saveTracksFromUrl expects a non-empty URL string");
    }

    let response;
    try {
        response = await fetch(url);
    } catch (err) {
        console.error("Network error fetching tracks JSON from URL:", url, err);
        throw err;
    }

    if (!response.ok) {
        const error = new Error(`Failed to fetch JSON from ${url}: ${response.status} ${response.statusText}`);
        console.error(error);
        throw error;
    }

    try {
        // Try parsing as JSON directly
        const data = await response.json();
        saveTracks(data);
    } catch (err) {
        console.warn("Response was not directly parseable as JSON, trying as text:", err);
        const text = await response.text();
        return saveTracksFromString(text);
    }
}

/**
 * Save tracks from a local JSON file selected via <input type="file">.
 *
 * Example usage in HTML:
 *   <input type="file" id="fileInput" accept="application/json"
 *          onchange="importFromFile(this.files[0])" />
 */
export function saveTracksFromFile(file) {
    if (!file || !(file instanceof File)) {
        throw new Error("saveTracksFromFile expects a File object");
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            try {
                const text = reader.result;
                saveTracksFromString(String(text));
                resolve();
            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = () => {
            reject(reader.error || new Error("Unknown FileReader error"));
        };

        reader.readAsText(file, "utf-8");
    });
}
