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
        body.className = "card-body d-flex justify-content-between align-items-center";

        const title = document.createElement("div");
        title.textContent = track.name;

        const btn = document.createElement("button");
        btn.textContent = "Play Clip";
        btn.className = "btn btn-outline-primary btn-sm";
        btn.onclick = () => playClip(track);

        body.appendChild(title);
        body.appendChild(btn);
        card.appendChild(body);
        container.appendChild(card);
    }
}

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
        alert("Could not play clip. Check you have an active Spotify device and (usually) a Premium account.");
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

    // Try to handle redirect from Spotify (code in URL)
    await handleRedirectCallback();

    // If we already had a stored token, use it
    const stored = getStoredToken();
    if (stored && !accessToken) {
        accessToken = stored;
    }

    // Update UI according to token state
    updateAuthStatus();

    // Load playlist
    loadTracks();
});
