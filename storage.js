// storage.js

const STORAGE_PREFIX = "tracks_";

/**
 * Internal: read all existing tracks from localStorage.
 * Returns:
 *  - items: [{ index, track }]
 *  - idToIndex: { [id]: index }
 *  - maxIndex: highest numeric index used
 */
function readExistingTracks() {
    const items = [];
    const idToIndex = {};
    let maxIndex = -1;

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(STORAGE_PREFIX)) continue;

        const indexStr = key.slice(STORAGE_PREFIX.length);
        const index = parseInt(indexStr, 10);
        if (Number.isNaN(index)) continue;

        try {
            const raw = localStorage.getItem(key);
            if (raw == null) continue;

            const track = JSON.parse(raw);
            items.push({ index, track });
            maxIndex = Math.max(maxIndex, index);

            if (track && typeof track === "object" && track.id != null) {
                idToIndex[String(track.id)] = index;
            }
        } catch (err) {
            console.warn("Failed to parse track from localStorage for key:", key, err);
        }
    }

    return { items, idToIndex, maxIndex };
}

/**
 * Internal: normalize data (array or single object) into an array.
 */
function normalizeTrackList(data) {
    if (Array.isArray(data)) return data;
    if (data == null) return [];
    return [data];
}

/**
 * Save or merge a list of tracks (array or single object).
 * - New IDs are appended as new `tracks_N` keys.
 * - Existing IDs overwrite the existing `tracks_N` entry.
 *
 * Each track is expected to be an object, optionally with a unique `id` field.
 */
export function saveTracks(tracks) {
    const list = normalizeTrackList(tracks);
    if (!list.length) return;

    const { idToIndex, maxIndex } = readExistingTracks();
    let nextIndex = maxIndex + 1;

    for (const track of list) {
        if (!track || typeof track !== "object") {
            console.warn("Skipping non-object track:", track);
            continue;
        }

        let index;
        const hasId = track.id != null;
        if (hasId && idToIndex.hasOwnProperty(String(track.id))) {
            // Overwrite existing entry for this id
            index = idToIndex[String(track.id)];
        } else {
            // Append new entry
            index = nextIndex++;
        }

        const key = STORAGE_PREFIX + index;
        try {
            localStorage.setItem(key, JSON.stringify(track));
        } catch (err) {
            console.error("Failed to save track to localStorage:", track, err);
            // optional: break out or rethrow if you want hard failure
        }
    }
}

/**
 * Get all tracks from localStorage in ascending index order.
 * Returns an array of track objects.
 */
export function getAllTracks() {
    const { items } = readExistingTracks();
    return items
        .sort((a, b) => a.index - b.index)
        .map((entry) => entry.track);
}

/**
 * Clear all tracks_* entries from localStorage.
 */
export function clearAllTracks() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
            keysToRemove.push(key);
        }
    }
    for (const key of keysToRemove) {
        localStorage.removeItem(key);
    }
}

/**
 * Save tracks from a JSON string (e.g. from a textview or a raw string).
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
 * Save tracks from the value of a textview / textarea element.
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
 * Save tracks from a JSON file hosted on the same or remote server.
 * `url` should point to a JSON resource:
 *  - either an array of track objects
 *  - or a single track object
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

    let data;
    try {
        // Try parsing as JSON directly
        data = await response.json();
    } catch (err) {
        console.warn("Response was not directly parseable as JSON, trying as text:", err);
        const text = await response.text();
        return saveTracksFromString(text);
    }

    saveTracks(data);
}
