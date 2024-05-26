// IndexedDB setup
const DB_NAME = "PhotoCaptureApp";
const SESSION_STORE_NAME = "session_photos";
const DB_VERSION = 1;

// Get references to UI elements
const sessionPhotoGallery = document.getElementById("session-photo-gallery");
const shareSessionPhotosButton = document.getElementById("shareSessionPhotos");
const deleteSessionPhotosButton = document.getElementById("deleteSessionPhotos");
const errorMessage = document.getElementById("error-message");

// Function to clear error messages
function clearError() {
    errorMessage.textContent = "";
}

// Function to show error messages
function showError(message) {
    console.error(message);
    errorMessage.textContent = message;
}

// Function to open IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(SESSION_STORE_NAME)) {
                db.createObjectStore(SESSION_STORE_NAME, { keyPath: "id", autoIncrement: true });
            }
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

// Function to retrieve all stored photos from the session_photos store in IndexedDB
async function getSessionPhotos() {
    const db = await openDB();
    const transaction = db.transaction([SESSION_STORE_NAME], "readonly");
    const objectStore = transaction.objectStore(SESSION_STORE_NAME);

    return new Promise((resolve, reject) => {
        const request = objectStore.getAll();

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

// Function to delete session photos from IndexedDB
async function deleteSessionPhotos() {
    if (confirm("Are you sure you want to delete all session photos?")) {
        try {
            const db = await openDB();
            const transaction = db.transaction([SESSION_STORE_NAME], "readwrite");
            const objectStore = transaction.objectStore(SESSION_STORE_NAME);
            await objectStore.clear();
            sessionPhotoGallery.innerHTML = ""; // Clear the gallery
            shareSessionPhotosButton.disabled = true; // Disable share button
            deleteSessionPhotosButton.disabled = true; // Disable delete button
        } catch (error) {
            showError("Error deleting session photos: " + error.message);
        }
    }
}

// Function to share session photos
async function shareSessionPhotos() {
    try {
        const sessionPhotos = await getSessionPhotos();

        if (sessionPhotos.length === 0) {
            showError("No session photos to share.");
            return;
        }

        const photoFiles = sessionPhotos.map((photo) => new File([photo.blob], "session_snapshot.png", { type: "image/png" }));

        if (navigator.canShare && navigator.canShare({ files: photoFiles })) {
            try {
                await navigator.share({
                    files: photoFiles,
                    title: "Session Photos",
                    text: "Here are the session photos I took!",
                });
            } catch (error) {
                showError("Error sharing session photos: " + error.message);
            }
        } else {
            showError("Web Share API does not support sharing files in this browser.");
        }
    } catch (error) {
        showError("Error sharing session photos: " + error.message);
    }
}

// Function to load session photos when the page initializes
async function loadSessionPhotos() {
    try {
        const sessionPhotos = await getSessionPhotos();

        sessionPhotoGallery.innerHTML = ""; // Clear existing session photos in the gallery

        sessionPhotos.forEach((photo) => {
            const imgElement = document.createElement("img");
            imgElement.src = URL.createObjectURL(photo.blob); // Display the session photo
            imgElement.className = "photo-thumbnail"; // Styled thumbnail
            sessionPhotoGallery.appendChild(imgElement);
        });

        if (sessionPhotos.length > 0) {
            shareSessionPhotosButton.disabled = false; // Enable share button if there are photos to share
            deleteSessionPhotosButton.disabled = false; // Enable delete button if there are photos to delete
        }
    } catch (error) {
        showError("Error loading session photos: " + error.message);
    }
}

// Event listeners for the buttons
shareSessionPhotosButton.addEventListener("click", shareSessionPhotos); // Share session photos
deleteSessionPhotosButton.addEventListener("click", deleteSessionPhotos); // Delete session photos

// Load session photos when initializing the app
loadSessionPhotos();
