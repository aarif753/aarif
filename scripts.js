// ==============================================
// Shared Configuration and Utilities
// ==============================================

// Initialize EmailJS (replace with your actual credentials)
emailjs.init('24sxryXs3Nz3gt--f');

// Generate a unique request ID
function generateRequestId() {
    return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ==============================================
// User-Facing Application Functions
// ==============================================

let currentRequestId = '';
let userEmail = '';
let editedImageUrl = '';
let statusCheckInterval = null;
let countdownInterval = null;
let remainingTime = 24 * 60 * 60; // 24 hours in seconds

function initUserApp() {
    setupUserEventListeners();
    
    // Check if returning to check status
    const urlParams = new URLSearchParams(window.location.search);
    const requestId = urlParams.get('requestId');
    if (requestId) {
        currentRequestId = requestId;
        checkRequestStatus(requestId);
        document.getElementById('aiAnimation').style.display = 'block';
        document.getElementById('uploadForm').style.display = 'none';
        startCountdown();
    }
}

function setupUserEventListeners() {
    // File upload/drop handlers
    const dropZone = document.getElementById('dropZone');
    if (!dropZone) return;
    
    dropZone.addEventListener('click', () => {
        document.getElementById('imageUpload').click();
    });
    
    document.getElementById('imageUpload').addEventListener('change', (e) => {
        if (e.target.files.length) previewImage(e.target.files[0]);
    });
    
    // Drag and drop handlers
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#6e48aa';
        dropZone.style.backgroundColor = 'rgba(110, 72, 170, 0.1)';
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '#ccc';
        dropZone.style.backgroundColor = 'rgba(110, 72, 170, 0.05)';
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#ccc';
        dropZone.style.backgroundColor = 'rgba(110, 72, 170, 0.05)';
        if (e.dataTransfer.files.length) {
            document.getElementById('imageUpload').files = e.dataTransfer.files;
            previewImage(e.dataTransfer.files[0]);
        }
    });
    
    // Form submission
    document.getElementById('submitBtn')?.addEventListener('click', processImage);
    
    // Download button
    document.getElementById('downloadBtn')?.addEventListener('click', downloadEditedImage);
}

function previewImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('imagePreview').src = e.target.result;
        document.getElementById('imagePreview').style.display = 'block';
        document.querySelector('#dropZone p').textContent = 'Change photo';
    };
    reader.readAsDataURL(file);
}

function processImage() {
    const email = document.getElementById('userEmail').value;
    const instructions = document.getElementById('editInstructions').value;
    const imageFile = document.getElementById('imageUpload').files[0];

    if (!imageFile || !email || !instructions) {
        alert('Please fill all fields and upload an image');
        return;
    }

    // Generate unique request ID
    currentRequestId = generateRequestId();
    userEmail = email;
    
    // Update status link
    const statusUrl = `${window.location.origin}${window.location.pathname}?requestId=${currentRequestId}`;
    document.getElementById('statusLink').href = statusUrl;
    document.getElementById('statusLink').textContent = statusUrl;
    document.getElementById('requestIdDisplay').textContent = currentRequestId;

    // Show AI animation
    document.getElementById('uploadForm').style.display = 'none';
    document.getElementById('aiAnimation').style.display = 'block';

    // Start progress animation
    startProgressAnimation();
    startCountdown();
    
    // Start checking status periodically
    statusCheckInterval = setInterval(() => {
        checkRequestStatus(currentRequestId);
    }, 5000); // Check every 5 seconds

    // Convert image to base64
    const reader = new FileReader();
    reader.onload = (e) => {
        const imageBase64 = e.target.result;

        // Save request to database
        saveRequestToDatabase({
            requestId: currentRequestId,
            userEmail: email,
            instructions: instructions,
            originalImage: imageBase64,
            status: 'processing',
            timestamp: new Date().toISOString()
        });

        // Notify admin
        notifyAdmin(currentRequestId, email, instructions);
    };
    reader.readAsDataURL(imageFile);
}

function startProgressAnimation() {
    let progress = 0;
    const progressBar = document.getElementById('progressBar');
    const progressInterval = setInterval(() => {
        progress += Math.random() * 5;
        progressBar.style.width = `${Math.min(progress, 80)}%`;
        if (progress >= 80) clearInterval(progressInterval);
    }, 500);
}

function startCountdown() {
    clearInterval(countdownInterval);
    remainingTime = 24 * 60 * 60; // Reset to 24 hours
    
    countdownInterval = setInterval(() => {
        remainingTime--;
        
        const hours = Math.floor(remainingTime / 3600);
        const minutes = Math.floor((remainingTime % 3600) / 60);
        const seconds = remainingTime % 60;
        
        document.getElementById('time').textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (remainingTime <= 0) {
            clearInterval(countdownInterval);
        }
    }, 1000);
}

function checkRequestStatus(requestId) {
    getRequestFromDatabase(requestId).then(request => {
        if (request && request.status === 'completed') {
            // Request is complete!
            clearInterval(statusCheckInterval);
            clearInterval(countdownInterval);
            completeProcessing(request.editedImage);
        }
    });
}

function completeProcessing(editedImageUrl) {
    // Fill progress bar
    document.getElementById('progressBar').style.width = '100%';
    
    // Show result after delay
    setTimeout(() => {
        document.getElementById('aiAnimation').style.display = 'none';
        document.getElementById('resultSection').style.display = 'block';
        document.getElementById('resultImage').src = editedImageUrl;
        window.editedImageUrl = editedImageUrl;
        
        // Send completion email
        sendCompletionEmail(userEmail, currentRequestId, editedImageUrl);
    }, 1500);
}

function downloadEditedImage() {
    const a = document.createElement('a');
    a.href = window.editedImageUrl;
    a.download = `edited-photo_${currentRequestId}.jpg`;
    a.click();
}

// ==============================================
// Admin-Facing Application Functions
// ==============================================

let currentEditingRequest = null;

function initAdminApp() {
    loadRequests();
    setupAdminEventListeners();
}

function setupAdminEventListeners() {
    // Edited image upload
    document.getElementById('editedImageUpload')?.addEventListener('change', (e) => {
        if (e.target.files.length) {
            const reader = new FileReader();
            reader.onload = (event) => {
                document.getElementById('editedImagePreview').src = event.target.result;
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    });
    
    // Modal buttons
    document.getElementById('cancelEditBtn')?.addEventListener('click', () => {
        document.getElementById('imageEditorModal').style.display = 'none';
    });
    
    document.getElementById('submitEditedImageBtn')?.addEventListener('click', completeAdminRequest);
}

function loadRequests() {
    getRequestsFromDatabase().then(requests => {
        const requestsList = document.getElementById('requestsList');
        if (!requestsList) return;
        
        requestsList.innerHTML = '';
        
        requests.forEach(request => {
            const requestCard = document.createElement('div');
            requestCard.className = 'request-card';
            
            requestCard.innerHTML = `
                <img src="${request.originalImage}" class="request-image">
                <div class="request-meta">
                    <p><strong>Email:</strong> ${request.userEmail}</p>
                    <p><strong>Request:</strong> ${request.instructions}</p>
                    <p><strong>Status:</strong> 
                        <span class="request-status ${request.status === 'completed' ? 'status-completed' : 'status-processing'}">
                            ${request.status}
                        </span>
                    </p>
                </div>
                <div class="action-buttons">
                    <button class="edit-btn" data-id="${request.requestId}">
                        ${request.status === 'completed' ? 'View' : 'Edit'}
                    </button>
                </div>
            `;
            
            requestsList.appendChild(requestCard);
        });
        
        // Add event listeners to edit buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const requestId = e.target.getAttribute('data-id');
                openEditor(requestId);
            });
        });
    });
}

function openEditor(requestId) {
    getRequestFromDatabase(requestId).then(request => {
        if (!request) return;
        
        currentEditingRequest = request;
        
        // Populate modal
        document.getElementById('modalRequestId').textContent = request.requestId;
        document.getElementById('modalEmail').textContent = request.userEmail;
        document.getElementById('modalInstructions').textContent = request.instructions;
        document.getElementById('originalImagePreview').src = request.originalImage;
        
        // Clear edited image
        document.getElementById('editedImagePreview').src = '';
        document.getElementById('editedImageUpload').value = '';
        
        // Update modal title based on status
        document.getElementById('modalTitle').textContent = 
            request.status === 'completed' ? 'View Completed Request' : 'Edit Image';
        
        // Show modal
        document.getElementById('imageEditorModal').style.display = 'block';
    });
}

function completeAdminRequest() {
    const editedImage = document.getElementById('editedImagePreview').src;
    
    if (!editedImage) {
        alert('Please upload an edited image first');
        return;
    }
    
    // Update the request in database
    updateRequestInDatabase(currentEditingRequest.requestId, {
        status: 'completed',
        editedImage: editedImage,
        completedAt: new Date().toISOString()
    }).then(() => {
        alert('Request marked as completed!');
        document.getElementById('imageEditorModal').style.display = 'none';
        loadRequests();
    });
}

// ==============================================
// Database Functions (using localStorage)
// ==============================================

function saveRequestToDatabase(request) {
    const requests = JSON.parse(localStorage.getItem('aiPhotoRequests') || '[]');
    requests.push(request);
    localStorage.setItem('aiPhotoRequests', JSON.stringify(requests));
    return Promise.resolve();
}

function getRequestFromDatabase(requestId) {
    const requests = JSON.parse(localStorage.getItem('aiPhotoRequests') || '[]');
    return Promise.resolve(requests.find(req => req.requestId === requestId));
}

function getRequestsFromDatabase() {
    const requests = JSON.parse(localStorage.getItem('aiPhotoRequests') || '[]');
    return Promise.resolve(requests);
}

function updateRequestInDatabase(requestId, updates) {
    const requests = JSON.parse(localStorage.getItem('aiPhotoRequests') || '[]');
    const requestIndex = requests.findIndex(req => req.requestId === requestId);
    
    if (requestIndex !== -1) {
        requests[requestIndex] = { ...requests[requestIndex], ...updates };
        localStorage.setItem('aiPhotoRequests', JSON.stringify(requests));
    }
    
    return Promise.resolve();
}

// ==============================================
// Email/Notification Functions
// ==============================================

function notifyAdmin(requestId, email, instructions) {
    console.log('Admin notified of new request:', { requestId, email, instructions });
    return Promise.resolve();
}

function sendCompletionEmail(email, requestId, imageUrl) {
    console.log('Completion email sent to:', email);
    return Promise.resolve();
}

// ==============================================
// Initialize the Appropriate App
// ==============================================

document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on admin page or user page
    if (document.getElementById('requestsList')) {
        initAdminApp();
    } else {
        initUserApp();
    }
});