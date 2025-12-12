/**
 * Update the login UI based on authentication state
 * @param {Document} doc - The document object
 * @param {Object} auth - The SpotifyAuth instance
 */
async function updateLoginUI(doc, auth) {
    const loginBtn = doc.getElementById("loginBtn");
    const loginStatus = doc.getElementById("loginStatus");
    const errorBox = doc.getElementById("errorBox");

    if (!loginBtn || !loginStatus) {
        console.error("Required UI elements not found");
        return;
    }

    try {
        // Check if we have a token
        let token = auth.getAccessToken();

        if (!token) {
            // Try to handle OAuth callback
            token = await auth.handleRedirectCallback();
        }

        if (!token) {
            // No token - setup login button
            loginStatus.textContent = "Not logged in";
            loginBtn.addEventListener("click", () => {
                auth.startAuth();
            });
        } else {
            // Token exists - fetch user data and update UI
            try {
                const userData = await auth.spotifyFetch("GET", "/me");
                
                // Hide login status text
                loginStatus.classList.add("d-none");

                // Show user profile
                if (userProfile) {
                    userProfile.classList.remove("d-none");
                    
                    // Set user avatar
                    if (userAvatar && userData.images && userData.images.length > 0) {
                        userAvatar.src = userData.images[0].url;
                    } else if (userAvatar) {
                        // Fallback to default avatar
                        userAvatar.src = "https://via.placeholder.com/60/1DB954/FFFFFF?text=" + 
                                        (userData.display_name?.[0] || "U");
                    }
                    
                    // Set user name
                    if (userName) {
                        userName.textContent = userData.display_name || "Spotify User";
                    }
                }

                loginStatus.textContent = `Logged in as ${userData.display_name}`;
                loginBtn.textContent = "Logged In";
                loginBtn.classList.remove("btn-success");
                loginBtn.classList.add("btn-outline-success");
                loginBtn.disabled = true;
                
                return userData;
            } catch (error) {
                console.error("Error fetching user data:", error);
                loginStatus.textContent = "Logged in";
                loginBtn.textContent = "Logged In";
                loginBtn.disabled = true;
            }
        }
    } catch (error) {
        console.error("Auth error:", error);
        loginStatus.textContent = "Authentication error";
        if (errorBox) {
            errorBox.textContent = error.message;
        }
    }
}

/**
 * Update device status UI and setup event listeners
 * @param {Document} doc - The document object
 * @param {Object} auth - The SpotifyAuth instance
 */
async function updateDeviceStatusUI(doc, auth) {
    const deviceStatus = doc.getElementById("deviceStatus");
    const deviceHint = doc.getElementById("deviceHint");
    const openSpotifyBtn = doc.getElementById("openSpotifyBtn");
    
    if (!deviceStatus || !openSpotifyBtn) {
        console.error("Device UI elements not found");
        return;
    }

    // Function to check and update device status
    async function checkAndUpdateDevices() {
        try {
            const data = await auth.spotifyFetch("GET", "/me/player/devices");
            const activeDevice = data.devices?.find(device => device.is_active);
            
            if (!activeDevice || data.devices?.length === 0) {
                hasActiveDevice = false;
                deviceStatus.textContent = "No active device detected";
                deviceStatus.className = "small m-2 text-warning";
                openSpotifyBtn.classList.remove("d-none");
                deviceHint.classList.remove("d-none");
            } else {
                hasActiveDevice = true;
                deviceStatus.textContent = `Active device: ${activeDevice.name}`;
                deviceStatus.className = "small m-2 text-success";
                deviceHint.classList.add("d-none");
                openSpotifyBtn.classList.add("d-none");
            }
        } catch (error) {
            console.error("Error checking devices:", error);
            hasActiveDevice = false;
            deviceStatus.textContent = "Unable to check devices";
            deviceStatus.className = "small m-2 text-danger";
            openSpotifyBtn.classList.remove("d-none");
        }
    }

    // Setup periodic background refresh
    intervalId = setInterval(async () => {
        // Only check if page is visible to save API calls
        if (!document.hidden) {
            await checkAndUpdateDevices();
        }
    }, 10000);

    // Cleanup interval when page is unloaded
    window.addEventListener("beforeunload", () => {
        if (intervalId) {
            clearInterval(intervalId);
        }
    });

    // Setup "Open Spotify" button listener
    openSpotifyBtn.addEventListener("click", () => {
        window.open("https://open.spotify.com", "_blank");
    });

    // Perform initial device check
    await checkAndUpdateDevices();
}

/**
 * Create SpotifyAuth instance with automatic redirect detection
 * @param {string} clientId - Spotify client ID
 * @param {string} productionRedirectUri - Production redirect URI
 * @returns {Object} SpotifyAuth instance
 */
function createAuth(clientId, productionRedirectUri) {
    const isLocal = window.location.hostname === "localhost" || 
                    window.location.hostname === "127.0.0.1";
    
    const redirectUri = isLocal 
        ? "http://127.0.0.1:8000/Quizify/" 
        : productionRedirectUri;

    return SpotifyAuth.create({
        clientId: clientId,
        redirectUri: redirectUri,
        storageKeyPrefix: "spotify_"
    });
}