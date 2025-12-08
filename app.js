// === KONFIG ===
let CLIENT_ID = "";        // <-- INDSÆT DIT CLIENT ID
let REDIRECT_URI = "";     // <-- INDSÆT DIN GITHUB PAGES URL (slut med /)
const SCOPES = [
    "user-modify-playback-state",
    "user-read-playback-state"
];

// === STATE ===
let accessToken = null;
let tracks = [];

// === OAUTH ===
function buildAuthUrl() {
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: "token",
        redirect_uri: REDIRECT_URI,
        scope: SCOPES.join(" "),
        show_dialog: "true"
    });
    return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function parseHashForToken() {
    if (!window.location.hash) return null;

    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get("access_token");
    const expiresIn = params.get("expires_in");

    if (token) {
        window.location.hash = "";
        const expiryTime = Date.now() + Number(expiresIn) * 1000;

        localStorage.setItem("spotify_access_token", token);
        localStorage.setItem("spotify_token_expiry", expiryTime);

        return token;
    }
    return null;
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

function updateAuthStatus() {
    const statusEl = document.getElementById("status");
    statusEl.textContent = accessToken
        ? "Logget ind på Spotify"
        : "Ikke logget ind";
}

// === SPOTIFY API ===
async function spotifyFetch(method, endpoint, body) {
    if (!accessToken) throw new Error("Ingen access token");
    const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
        method,
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: body ? JSON.stringify(body) : undefined
    });

    if (res.status === 204) return null;

    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Spotify API fejl ${res.status}: ${msg}`);
    }

    return await res.json();
}

// === TRACKS ===
async function loadTracks() {
    const container = document.getElementById("tracksContainer");

    // 1) Find URL-parameteren ?tracks=...
    const params = new URLSearchParams(window.location.search);
    let playlistUrl = params.get("tracks");

    // 2) Default hvis ingen parameter
    if (!playlistUrl) {
        playlistUrl = "tracks.json";
    }

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
        container.textContent = "Ingen tracks i tracks.json";
        return;
    }

    tracks.forEach(track => {
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
    });
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
            spotifyFetch("PUT", "/me/player/pause")
                .catch(err => console.error("Fejl ved pause:", err));
        }, dur);

    } catch (e) {
        console.error(e);
        alert("Kunne ikke afspille klip. Tjek at en Spotify-enhed er aktiv.");
    }
}

// === INIT ===
window.addEventListener("DOMContentLoaded", () => {
    const tokenFromUrl = parseHashForToken();
    if (tokenFromUrl) {
        accessToken = tokenFromUrl;
    } else {
        accessToken = getStoredToken();
    }

    updateAuthStatus();
    loadTracks();

    document.getElementById("loginBtn").addEventListener("click", () => {
        window.location.href = buildAuthUrl();
    });
});
