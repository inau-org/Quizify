// spotify-auth.js
(function (global) {
    const DEFAULT_SCOPES = [
        "user-modify-playback-state",
        "user-read-playback-state",
    ];

    // ---------- PKCE helpers ----------
    function generateRandomString(length = 64) {
        const possible =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
        let text = "";
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        for (let i = 0; i < length; i++) {
            text += possible[array[i] % possible.length];
        }
        return text;
    }

    async function sha256(plain) {
        const encoder = new TextEncoder();
        const data = encoder.encode(plain);
        return await crypto.subtle.digest("SHA-256", data);
    }

    function base64UrlEncode(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary)
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
    }

    async function createCodeChallenge(verifier) {
        const hashed = await sha256(verifier);
        return base64UrlEncode(hashed);
    }

    // ---------- Factory ----------
    function createSpotifyAuth(config) {
        const {
            clientId,
            redirectUri,
            scopes = DEFAULT_SCOPES,
            storageKeyPrefix = "spotify_",
        } = config;

        if (!clientId) {
            throw new Error("SpotifyAuth: clientId is required");
        }
        if (!redirectUri) {
            throw new Error("SpotifyAuth: redirectUri is required");
        }

        // Storage keys are namespaced so quiz + builder don't collide
        const KEY_TOKEN = storageKeyPrefix + "access_token";
        const KEY_EXPIRY = storageKeyPrefix + "token_expiry";
        const KEY_STATE = storageKeyPrefix + "pkce_state";
        const KEY_VERIFIER = storageKeyPrefix + "pkce_code_verifier";

        let accessToken = null;

        function storeToken(token, expiresInSeconds) {
            accessToken = token;
            const expiryTime = Date.now() + expiresInSeconds * 1000;
            localStorage.setItem(KEY_TOKEN, token);
            localStorage.setItem(KEY_EXPIRY, String(expiryTime));
        }

        function getStoredToken() {
            if (accessToken) return accessToken;
            const token = localStorage.getItem(KEY_TOKEN);
            const expiry = localStorage.getItem(KEY_EXPIRY);
            if (!token || !expiry) return null;
            if (Date.now() > Number(expiry)) {
                localStorage.removeItem(KEY_TOKEN);
                localStorage.removeItem(KEY_EXPIRY);
                return null;
            }
            accessToken = token;
            return token;
        }

        async function startAuth() {
            const codeVerifier = generateRandomString(64);
            const codeChallenge = await createCodeChallenge(codeVerifier);
            const state = generateRandomString(16);

            sessionStorage.setItem(KEY_VERIFIER, codeVerifier);
            sessionStorage.setItem(KEY_STATE, state);

            const params = new URLSearchParams({
                client_id: clientId,
                response_type: "code",
                redirect_uri: redirectUri,
                scope: scopes.join(" "),
                code_challenge_method: "S256",
                code_challenge: codeChallenge,
                state,
            });

            window.location.href =
                "https://accounts.spotify.com/authorize?" + params.toString();
        }

        /**
         * Call this once on page load.
         * It will:
         *  - look for ?code=... in the URL
         *  - exchange it for an access token, store it
         *  - clean up the URL
         *  - return the token (or null if nothing to do)
         */
        async function handleRedirectCallback() {
            const url = new URL(window.location.href);
            const code = url.searchParams.get("code");
            const returnedState = url.searchParams.get("state");
            const error = url.searchParams.get("error");

            if (error) {
                throw new Error("Spotify login error: " + error);
            }
            if (!code) {
                // No OAuth redirect in this URL
                return null;
            }

            const storedState = sessionStorage.getItem(KEY_STATE);
            const codeVerifier = sessionStorage.getItem(KEY_VERIFIER);

            if (!storedState || !codeVerifier) {
                throw new Error("Missing PKCE state/verifier in sessionStorage");
            }
            if (storedState !== returnedState) {
                throw new Error("State mismatch, possible CSRF.");
            }

            const body = new URLSearchParams({
                client_id: clientId,
                grant_type: "authorization_code",
                code,
                redirect_uri: redirectUri,
                code_verifier: codeVerifier,
            });

            const res = await fetch("https://accounts.spotify.com/api/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: body.toString(),
            });

            sessionStorage.removeItem(KEY_STATE);
            sessionStorage.removeItem(KEY_VERIFIER);

            if (!res.ok) {
                const txt = await res.text();
                throw new Error("Token error " + res.status + ": " + txt);
            }

            const data = await res.json();
            if (!data.access_token) {
                throw new Error("No access_token returned from Spotify.");
            }

            const expiresIn = Number(data.expires_in || 3600);
            storeToken(data.access_token, expiresIn);

            // Clean up URL (remove ?code= & ?state= from address bar)
            url.searchParams.delete("code");
            url.searchParams.delete("state");
            window.history.replaceState({}, "", url.toString());

            return data.access_token;
        }

        async function spotifyFetch(method, endpoint, body) {
            const token = getStoredToken();
            if (!token) {
                throw new Error("No Spotify access token. Log in first.");
            }

            const res = await fetch("https://api.spotify.com/v1" + endpoint, {
                method,
                headers: {
                    Authorization: "Bearer " + token,
                    "Content-Type": "application/json",
                },
                body: body ? JSON.stringify(body) : undefined,
            });

            if (res.status === 204) return null;
            if (!res.ok) {
                const txt = await res.text();
                throw new Error("Spotify API error " + res.status + ": " + txt);
            }
            return res.json();
        }

        return {
            // Low-level bits, in case you need them:
            getAccessToken: getStoredToken,
            handleRedirectCallback,
            startAuth,
            spotifyFetch,
        };
    }

    global.SpotifyAuth = { create: createSpotifyAuth };
})(window);
