// =====================
//   KONFIG
// =====================

// Sæt disse to:
const CLIENT_ID = "DIN_CLIENT_ID_HER";
const REDIRECT_URI = "https://DIT-BRUGERNAVN.github.io/Quizify/";
// Husk: matcher præcis din redirect URI i Spotify Dashboard
// (inkl. stort/småt og afsluttende / )

// Scopes: nok til at styre playback
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

// Random string til code_verifier / state
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

// base64url-encode af ArrayBuffer
function base64UrlEncode(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64 = window.btoa(binary);
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Lav code_challenge fra code_verifier
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
    statusEl.textContent = message || (accessToken ? "Logget ind på Spotify" : "Ikke logget ind");
}

function showError(msg) {
    console.error(msg);
    const box = document.getElementById("errorBox");
    if (box) box.textContent = msg;
}

// Gemmer token i localStorage
function storeToken(token, expiresInSeconds) {
    accessToken = token;
    const expiryTime = Date.now() + expiresInSeconds * 1000;
    localStorage.setItem("spotify_access_token", token);
    localStorage.setItem("spotify_token_expiry", String(expiryTime));
}

// Henter token fra localStorage hvis den stadig er gyldig
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

// Start login: lav code_verifier/challenge, redirect til Spotify
async function startAuth() {
    try {
        const codeVerifier = generateRandomString(64);
        const codeChallenge = await createCodeChallenge(codeVerifier);
        const state = generateRandomString(16);

        // Gem verifier + state til senere
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

        window.location.href = "https://accounts.spotify.com/authorize?" + params.toString();
    } catch (e) {
        showError("Kunne ikke starte login-flow: " + e.message);
    }
}

// Når vi kommer tilbage fra Spotify med ?code=...
async function handleRedirectCallback() {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
        showError("Spotify login-fejl: " + error);
        // Ryd query params
        url.searchParams.delete("error");
        window.history.replaceState({}, document.title, url.pathname + url.search);
        return;
    }

    if (!code) return; // Ingen callback -> ingenting at gøre

    const storedState = sessionStorage.getItem("spotify_pkce_state");
    if (storedState && returnedState && storedState !== returnedState) {
        showError("State mismatch – login afbrudt.");
        return;
    }

    const codeVerifier = sessionStorage.getItem("spotify_pkce_code_verifier");
    if (!codeVerifier) {
        showError("Mangler code_verifier – prøv at logge ind igen.");
        return;
    }

    // Når vi har code, må vi ikke blive ved med at have den i URL’en:
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    window.history.replaceState({}, document.title, url.pathname + url.search);

    try {
        // Byt code til access_token via token endpoint
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
            throw new Error("Token-fejl " + res.status + ": " + txt);
        }

        const data = await res.json();
        if (!data.access_token) {
            throw new Error("Intet access_token i svar.");
        }

        storeToken(data.access_token, data.expires_in || 3600);
        updateAuthStatus("Logget ind på Spotify");

    } catch (e) {
        showError("Kunne ikke bytte kode til token: " + e.message);
    } finally {
        // ryd PKCE data
        sessionStorage.removeItem("spotify_pkce_code_verifier");
        sessionStorage.removeItem("spotify_pkce_state");
    }
}

// =====================
//   SPOTIFY API WRAPPER
// =====================

async function spotifyFetch(method, endpoint, body) {
    if (!accessToken) throw new Error("Ingen access token");
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
        throw new Error("Spotify API fejl " + res.status + ": " + txt);
    }

    return await res.json();
}

// =====================
//   TRACKS / PLAYLIST
// =====================

async function loadTracks() {
    const container = document.getElementById("tracksContainer");

    // ?tracks=... parameter
    const params = new URLSearchParams(window.location.search);
    let playlistUrl = params.get("tracks");
    if (!playlistUrl) playlistUrl = "tracks.json";

    console.log("Loader tracks fra:", playlistUrl);

    try {
        const res = await fetch(playlistUrl);
        if (!res.ok) throw new Error("Kunne ikke hente playlist: " + playlistUrl);
        tracks = await res.json();
        renderTracks();
    } catch (e) {
        console.error(e);
        container.textContent = "Kunne ikke indlæse " + playlistUrl;
    }
}

function renderTracks() {
    const container = document.getElementById("tracksContainer");
    container.innerHTML = "";

    if (!tracks.length) {
        container.textContent = "Ingen tracks i playlisten.";
        return;
    }

    for (const track of tracks) {
        const div = document.createElement("div");
        div.className = "track";

        const title = document.createElement("div");
        title.textContent = track.name;

        const btn = document.createElement("button");
        btn.textContent = "Spil klip";
        btn.onclick = () => playClip(track);

        div.appendChild(title);
        div.appendChild(btn);
        container.appendChild(div);
    }
}

async function playClip(track) {
    if (!accessToken) {
        alert("Du skal logge ind på Spotify først.");
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
                console.error("Fejl ved pause:", err)
            );
        }, dur);

    } catch (e) {
        console.error(e);
        alert("Kunne ikke afspille klip. Tjek at en Spotify-enhed er aktiv (og ofte at kontoen er Premium).");
    }
}

// =====================
//   INIT
// =====================

window.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("loginBtn").addEventListener("click", () => {
        startAuth();
    });

    // 1) prøv at håndtere evt. redirect fra Spotify (code i URL’en)
    await handleRedirectCallback();

    // 2) hvis vi stadig ikke har token, prøv localStorage
    const stored = getStoredToken();
    if (stored && !accessToken) {
        accessToken = stored;
    }

    updateAuthStatus();

    // 3) load playlist
    loadTracks();
});
