
// Variables for session management and camera stream
let sessionActive = false;
let cameraStream = null;

// IndexedDB setup
const DB_NAME = "PhotoCaptureApp";
const SESSION_STORE_NAME = "session_photos";
const ALL_PHOTOS_STORE_NAME = "all_photos";
const DB_VERSION = 1;

// Get references to UI elements
const startSessionButton = document.getElementById("startSession");
const capturePhotoButton = document.getElementById("capturePhoto");
const endSessionButton = document.getElementById("endSession");
const shareSessionPhotosButton = document.getElementById("shareSessionPhotos");
const deleteSessionPhotosButton = document.getElementById("deleteSessionPhotos");
const videoElement = document.getElementById("video");
const canvasElement = document.getElementById("canvas");
const context = canvasElement.getContext("2d");
const sessionPhotoGallery = document.getElementById("session-photo-gallery");
const allPhotoGallery = document.getElementById("all-photo-gallery");
const errorMessage = document.getElementById("error-message");
let switchCameraButton = document.getElementById('switchCamera');

// Function to clear error messages
function clearError() {
    errorMessage.textContent = "";
}

// Function to show error messages
function showError(message) {
    console.error(message);
    errorMessage.textContent = message;
}

// Function to request camera permissions
async function requestCameraPermission() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoElement.srcObject = cameraStream;
        return true;
    } catch (error) {
        showError("Camera permission denied.");
        return false;
    }
}

// Function to request location permissions
function requestLocationPermission() {
    return new Promise((resolve, reject) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => resolve(position),
                (error) => {
                    let errorMessage;
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage = "Permission denied.";
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage = "Position unavailable.";
                            break;
                        case error.TIMEOUT:
                            errorMessage = "Request timed out.";
                            break;
                        default:
                            errorMessage = "An unknown error occurred.";
                            break;
                    }
                    reject(new Error(errorMessage));
                }
            );
        } else {
            reject(new Error("Geolocation not supported."));
        }
    });
}

// Function to get address from coordinates
async function getAddressFromCoordinates(lat, lon) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.display_name) {
            return data.display_name;
        } else {
            return "No address found.";
        }
    } catch (error) {
        return "Error getting address.";
    }
}

// IndexedDB functions
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(SESSION_STORE_NAME)) {
                db.createObjectStore(SESSION_STORE_NAME, { keyPath: "id", autoIncrement: true });
            }
            if (!db.objectStoreNames.contains(ALL_PHOTOS_STORE_NAME)) {
                db.createObjectStore(ALL_PHOTOS_STORE_NAME, { keyPath: "id", autoIncrement: true });
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

// Function to save a photo in IndexedDB
async function savePhoto(storeName, photoBlob, metadata) {
    const db = await openDB();
    const transaction = db.transaction([storeName], "readwrite");
    const objectStore = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
        const request = objectStore.add({
            blob: photoBlob,
            metadata,
            timestamp: Date.now(),
        });

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

// Function to retrieve all stored photos from a specific store in IndexedDB
async function getAllPhotos(storeName) {
    const db = await openDB();
    const transaction = db.transaction([storeName], "readonly");
    const objectStore = transaction.objectStore(storeName);

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

// Function to start the session
async function startSession() {
    clearError();

    const hasCameraPermission = await requestCameraPermission();
    if (!hasCameraPermission) {
        return;
    }

    try {
        await requestLocationPermission();

        // Clear previous session photos before starting a new session
        await clearStore(SESSION_STORE_NAME);
        
        // show the camera container when session starts
        document.querySelector('.camera-container').style.display = "flex";
        
        sessionActive = true; // Set session active

        const controlsElement = document.getElementById("controls");
         controlsElement.style.display = "flex";

        const controlsNonActive = document.getElementById("controls-non-active");
        controlsNonActive.classList.add("hide"); // Hide the "Start Session" button
        
        sessionPhotoGallery.style.display = "grid"; 

        endSessionButton.disabled = false; // Enable end session button
        endSessionButton.style.display = "block";  // Show the "End Session" button
        
        capturePhotoButton.disabled = false; 
        capturePhotoButton.style.display = "block"; 

        
        
        // Reset the session photo gallery
        sessionPhotoGallery.innerHTML = "";

    } catch (error) {
        showError("Error starting session: " + error.message);
    }
}

// Function to capture a photo during a session
async function capturePhoto() {
    if (!sessionActive) {
        showError("Session not active. Start the session first.");
        return;
    }

    try {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;

        context.drawImage(videoElement, 0, 0, videoElement.videoWidth, videoElement.videoHeight);

        const currentDateTime = new Date().toLocaleString();

        const position = await requestLocationPermission();
        const { latitude, longitude } = position.coords;

        const address = await getAddressFromCoordinates(latitude, longitude);

        context.fillStyle = "white";
        context.font = "15px Arial";
        context.fillText(`${currentDateTime}`, 10, 30);
        context.fillText(`${address}`, 10, 60);

        const photoBlob = await new Promise((resolve) => canvasElement.toBlob(resolve, "image/png"));

        // Open the IndexedDB before saving the photo
        const db = await openDB();

        // Save the photo in the session store
        await savePhoto(SESSION_STORE_NAME, photoBlob, { timestamp: currentDateTime, location: { latitude, longitude }, address });

        // Display the captured photo in the gallery
        const imgElement = document.createElement("img");
        imgElement.src = URL.createObjectURL(photoBlob); // Thumbnail image
        imgElement.className = "photo-thumbnail"; // Styled thumbnail
        sessionPhotoGallery.appendChild(imgElement);
       
        shareSessionPhotosButton.style.display = "block";
        shareSessionPhotosButton.disabled = false;

        // Enable delete buttons after capturing a photo
        deleteSessionPhotosButton.style.display = "block";
        deleteSessionPhotosButton.disabled = false;

    } catch (error) {
        showError("Error capturing photo: " + error.message);
    }
}

// Get the list of available cameras
navigator.mediaDevices.enumerateDevices()
    .then(devices => {
        let cameras = devices.filter(device => device.kind === 'videoinput');
        if (cameras.length > 1) {
            switchCameraButton.disabled = false;
            switchCameraButton.addEventListener('click', switchCamera);
        }
    });

function switchCamera() {
    // Get the current camera
    let currentCamera = video.srcObject.getVideoTracks()[0];

    // Get the list of available cameras
    navigator.mediaDevices.enumerateDevices()
        .then(devices => {
            let cameras = devices.filter(device => device.kind === 'videoinput');
            let backCamera = cameras.find(device => device.label.toLowerCase().includes('back'));

            // Switch to the back camera
            if (backCamera) {
                video.srcObject.getVideoTracks()[0].stop();
                navigator.mediaDevices.getUserMedia({ video: { deviceId: backCamera.deviceId } })
                    .then(stream => {
                        video.srcObject = stream;
                    });
            }
        });
}

// Function to end the session and move session photos to all photos store
async function endSession() {
    if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
    }


    try {
        // Get all session photos
        const sessionPhotos = await getAllPhotos(SESSION_STORE_NAME);

        // Move session photos to the all_photos store
        for (const sessionPhoto of sessionPhotos) {
            await savePhoto(ALL_PHOTOS_STORE_NAME, sessionPhoto.blob, sessionPhoto.metadata);
        }

        // Redirect to another page after completing all operations
        window.location.href = "sessionGallery.html";


    } catch (error) {
        showError("Error ending session: " + error.message);
    }
}

// Function to clear an IndexedDB store
async function clearStore(storeName) {
    const db = await openDB();
    const transaction = db.transaction([storeName], "readwrite");
    const objectStore = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
        const request = objectStore.clear();

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

// Function to load all photos from the all_photos store
async function loadSessionPhotos() {
    try {
        const sessionPhotos = await getAllPhotos(SESSION_STORE_NAME);
        const sessionPhotoGallery = document.getElementById("session-photo-gallery");

        sessionPhotoGallery.innerHTML = ""; // Clear existing session photos in the gallery

        sessionPhotos.forEach((photo) => {
            const imgElement = document.createElement("img");
            imgElement.src = URL.createObjectURL(photo.blob); // Display the session photo
            imgElement.className = "photo-thumbnail"; // Styled thumbnail
            sessionPhotoGallery.appendChild(imgElement);
        });

        if (sessionPhotos.length > 0) {
            shareSessionPhotosButton.style.display =  "block"; 
            shareSessionPhotosButton.disabled = false; // Enable share button if there are photos to share
            deleteSessionPhotosButton.style.display =  "block"; 
            deleteSessionPhotosButton.disabled = false; // Enable delete button after capturing a photo
            deleteSessionPhotosButton.style.display =  "block"; 
            deleteSessionPhotosButton.disabled = false; // Enable delete button after capturing a photo
        }

    } catch (error) {
        showError("Error loading session photos: " + error.message);
    }
}


// Function to delete session photos
async function deleteSessionPhotos() {
    if (confirm("Are you sure you want to delete all session photos?")) {
        try {
            await clearStore(SESSION_STORE_NAME);
            sessionPhotoGallery.innerHTML = ""; // Clear the gallery
            deleteSessionPhotosButton.disabled = true; // Disable delete button
        } catch (error) {
            showError("Error deleting session photos: " + error.message);
        }
    }
}

// Event listeners for the buttons
startSessionButton.addEventListener("click", startSession); // Start the session
capturePhotoButton.addEventListener("click", capturePhoto); // Capture a photo
endSessionButton.addEventListener("click", endSession); // End the session
deleteSessionPhotosButton.addEventListener("click", deleteSessionPhotos); // Delete session photos



// Event listener for sharing session photos
shareSessionPhotosButton.addEventListener("click", async () => {
    const sessionPhotos = await getAllPhotos(SESSION_STORE_NAME);

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
});


// Load all stored photos when initializing the app
loadAllPhotos();