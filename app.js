// =====================
//   CONFIG
// =====================

// Set these two:
const CLIENT_ID = "0bbfd2ff3da1471dae3b2e35b0714720";         // your real client id
const REDIRECT_URI = "https://inau-org.github.io/Quizify/";    // your real Pages URL

// Scopes
const SCOPES = [
    "user-modify-playback-state",
    "user-read-playback-state"
];

// =====================
//   STATE
// =====================

let accessToken = null;
let tracks = [];

// =====================
//   PKCE HELPERS
// =====================

function generateRandomString(length = 64) {
    const possible =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    let text = "";
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
        text += possible[array[i] % possible.length];
    }
    return text;
}

function base64UrlEncode(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64 = window.btoa(binary);
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createCodeChallenge(codeVerifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    return base64UrlEncode(digest);
}

// =====================
//   AUTH FLOW (PKCE)
// =====================

function updateAuthStatus(message) {
    const statusEl = document.getElementById("status");
    const loginBtn = document.getElementById("loginBtn");

    if (!statusEl || !loginBtn) return;

    if (accessToken) {
        statusEl.textContent = message || "Logged in with Spotify";

        // button: grey, disabled, "Already logged in"
        loginBtn.textContent = "Already logged in";
        loginBtn.classList.remove("btn-success");
        loginBtn.classList.add("btn-secondary");
        loginBtn.disabled = true;
    } else {
        statusEl.textContent = message || "Not logged in";

        // button: green, active, "Log in with Spotify"
        loginBtn.textContent = "Log in with Spotify";
        loginBtn.classList.remove("btn-secondary");
        loginBtn.classList.add("btn-success");
        loginBtn.disabled = false;
    }
}

function showError(msg) {
    console.error(msg);
    const box = document.getElementById("errorBox");
    if (box) box.textContent = msg;
}

function storeToken(token, expiresInSeconds) {
    accessToken = token;
    const expiryTime = Date.now() + expiresInSeconds * 1000;
    localStorage.setItem("spotify_access_token", token);
    localStorage.setItem("spotify_token_expiry", String(expiryTime));

    // Immediately reflect in UI
    updateAuthStatus("Logged in with Spotify");
}

function getStoredToken() {
    const token = localStorage.getItem("spotify_access_token");
    const expiry = localStorage.getItem("spotify_token_expiry");
    if (!token || !expiry) return null;
    if (Date.now() > Number(expiry)) {
        localStorage.removeItem("spotify_access_token");
        localStorage.removeItem("spotify_token_expiry");
        return null;
    }
    return token;
}

async function startAuth() {
    try {
        const codeVerifier = generateRandomString(64);
        const codeChallenge = await createCodeChallenge(codeVerifier);
        const state = generateRandomString(16);

        sessionStorage.setItem("spotify_pkce_code_verifier", codeVerifier);
        sessionStorage.setItem("spotify_pkce_state", state);

        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            response_type: "code",
            redirect_uri: REDIRECT_URI,
            scope: SCOPES.join(" "),
            code_challenge_method: "S256",
            code_challenge: codeChallenge,
            state
        });

        window.location.href =
            "https://accounts.spotify.com/authorize?" + params.toString();

    } catch (e) {
        showError("Could not start login flow: " + e.message);
    }
}

async function handleRedirectCallback() {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
        showError("Spotify login error: " + error);
        url.searchParams.delete("error");
        window.history.replaceState({}, document.title, url.pathname + url.search);
        return;
    }

    if (!code) return;

    const storedState = sessionStorage.getItem("spotify_pkce_state");
    if (storedState && returnedState && storedState !== returnedState) {
        showError("State mismatch — login aborted.");
        return;
    }

    const codeVerifier = sessionStorage.getItem("spotify_pkce_code_verifier");
    if (!codeVerifier) {
        showError("Missing code_verifier — please log in again.");
        return;
    }

    url.searchParams.delete("code");
    url.searchParams.delete("state");
    window.history.replaceState({}, document.title, url.pathname + url.search);

    try {
        const body = new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type: "authorization_code",
            code,
            redirect_uri: REDIRECT_URI,
            code_verifier: codeVerifier
        });

        const res = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString()
        });

        if (!res.ok) {
            const txt = await res.text();
            throw new Error("Token error " + res.status + ": " + txt);
        }

        const data = await res.json();
        if (!data.access_token) {
            throw new Error("No access_token in response.");
        }

        storeToken(data.access_token, data.expires_in || 3600);

    } catch (e) {
        showError("Could not exchange code for token: " + e.message);
    } finally {
        sessionStorage.removeItem("spotify_pkce_code_verifier");
        sessionStorage.removeItem("spotify_pkce_state");
    }
}

// =====================
//   SPOTIFY API WRAPPER
// =====================

async function spotifyFetch(method, endpoint, body) {
    if (!accessToken) throw new Error("No access token");
    const res = await fetch("https://api.spotify.com/v1" + endpoint, {
        method,
        headers: {
            "Authorization": "Bearer " + accessToken,
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

// =====================
//   DEVICE STATUS / HELP
// =====================

function updateDeviceUi(hasActiveDevice, devices) {
    const statusEl = document.getElementById("deviceStatus");
    const openBtn = document.getElementById("openSpotifyBtn");

    if (!statusEl || !openBtn) return;

    if (!accessToken) {
        statusEl.textContent = "";
        openBtn.classList.add("d-none");
        return;
    }

    if (hasActiveDevice) {
        const activeNames = (devices || [])
            .filter(d => d.is_active)
            .map(d => d.name)
            .join(", ");

        statusEl.textContent = activeNames
            ? `Active device: ${activeNames}`
            : "Active playback device detected.";
        openBtn.classList.add("d-none");
    } else {
        statusEl.textContent =
            "No active Spotify device found. Open Spotify and start any track once, then try again.";
        openBtn.classList.remove("d-none");
    }
}

async function checkDevices() {
    if (!accessToken) {
        updateDeviceUi(false, []);
        return;
    }
    try {
        const data = await spotifyFetch("GET", "/me/player/devices");
        const devices = data.devices || [];
        const hasActive = devices.some(d => d.is_active);
        updateDeviceUi(hasActive, devices);
    } catch (e) {
        console.error("Error fetching devices:", e);
        // Don't spam error box, just log
    }
}

// =====================
//   TRACKS / PLAYLIST
// =====================

async function loadTracks() {
    const container = document.getElementById("tracksContainer");

    const params = new URLSearchParams(window.location.search);
    let playlistUrl = params.get("tracks");
    if (!playlistUrl) playlistUrl = "tracks.json";

    console.log("Loading tracks from:", playlistUrl);

    try {
        const res = await fetch(playlistUrl);
        if (!res.ok) throw new Error("Could not load playlist: " + playlistUrl);
        tracks = await res.json();
        renderTracks();
    } catch (e) {
        console.error(e);
        container.textContent = "Could not load " + playlistUrl;
    }
}

function getTrackIdFromUri(uri) {
    if (!uri) return null;
    const parts = uri.split(":");
    return parts[2] || null;
}

function renderTracks() {
    const container = document.getElementById("tracksContainer");
    container.innerHTML = "";

    if (!tracks.length) {
        container.textContent = "No tracks in playlist.";
        return;
    }

    for (const track of tracks) {
        const card = document.createElement("div");
        card.className = "card track-card";

        const body = document.createElement("div");
        body.className = "card-body";

        // --- Row 1: label + Play Clip button (right aligned) ---
        const row1 = document.createElement("div");
        row1.className = "d-flex justify-content-between align-items-center mb-2";

        const label = document.createElement("div");
        label.textContent = track.name;

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
        container.appendChild(card);
    }
}

// =====================
//   CONFIRM / REVEAL
// =====================

async function confirmGuesses(track, artistEl, songEl, buttonEl) {
    if (!accessToken) {
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
        showError("Could not load track info: " + e.message);
        // Re-enable button so you can try again
        buttonEl.disabled = false;
        buttonEl.textContent = "Confirm guesses";
    }
}

// =====================
//   PLAYBACK
// =====================

async function playClip(track) {
    if (!accessToken) {
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

// =====================
//   INIT
// =====================

window.addEventListener("DOMContentLoaded", async () => {
    const loginBtn = document.getElementById("loginBtn");
    if (loginBtn) {
        loginBtn.addEventListener("click", () => {
            startAuth();
        });
    }

    const openSpotifyBtn = document.getElementById("openSpotifyBtn");
    if (openSpotifyBtn) {
        openSpotifyBtn.addEventListener("click", () => {
            // safest cross-platform: open web player (which often launches the app on mobile)
            window.open("https://open.spotify.com/", "_blank");
        });
    }

    // Handle redirect back from Spotify (code in URL)
    await handleRedirectCallback();

    // Use stored token if still valid
    const stored = getStoredToken();
    if (stored && !accessToken) {
        accessToken = stored;
    }

    // Update login UI
    updateAuthStatus();

    // Check devices (if logged in)
    checkDevices();

    // Load playlist
    loadTracks();
});
