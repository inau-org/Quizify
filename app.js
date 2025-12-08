// === KONFIG ===
let CLIENT_ID = "0bbfd2ff3da1471dae3b2e35b0714720";        // <-- INDSÆT DIT CLIENT ID
let REDIRECT_URI = "https://inau-org.github.io/Quizify/";     // <-- INDSÆT DIN GITHUB PAGES URL (slut med /)

// =====================
//   KONFIG
// =====================

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
funct
