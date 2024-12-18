const fileInput = document.getElementById('file-input');
const uploadBtn = document.getElementById('upload-btn');
const imageSelect = document.getElementById('image-select');
const selectedImage = document.getElementById('selected-image');
const gcpList = document.getElementById('gcp-list');
const imageContainer = document.getElementById('image-container');
const downloadCsvBtn = document.getElementById('download-csv-btn');
const newGcpNameInput = document.getElementById('new-gcp-name');
const newGcpLatInput = document.getElementById('new-gcp-lat');
const newGcpLonInput = document.getElementById('new-gcp-lon');
const createGcpBtn = document.getElementById('create-gcp-btn');

let selectedGcp = null;
let currentImageName = null;
// ... (other variables)
const statusField = document.getElementById('status-field'); // Reference to the status field

// Function to update the status field
function updateStatus(message) {
    statusField.textContent = `Status: ${message}`;
}

// Load available GCP names from the backend
function loadAvailableGcps() {
    fetch('/get_all_gcps')
    .then(response => response.json())
    .then(gcps => {
        gcpList.innerHTML = '';
        for (const gcpName in gcps) {
            const li = document.createElement('li');
            li.textContent = gcpName;
            li.addEventListener('click', () => {
                selectGcp(gcpName);
            });
            gcpList.appendChild(li);
        }
        updateStatus('GCPs loaded');
    })
    .catch(error => {
        console.error('Error:', error);
        updateStatus('Error loading GCPs');
    });
}

// Function to create a new GCP
function createNewGcp() {
    const gcpName = newGcpNameInput.value;
    const lat = parseFloat(newGcpLatInput.value);
    const lon = parseFloat(newGcpLonInput.value);

    if (!gcpName || isNaN(lat) || isNaN(lon)) {
        updateStatus('Please enter a GCP name, latitude, and longitude.');
        return;
    }

    fetch('/create_gcp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ gcp_name: gcpName, lat: lat, lon: lon })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            updateStatus(data.error);
        } else {
            updateStatus(data.message);
            newGcpNameInput.value = '';
            newGcpLatInput.value = '';
            newGcpLonInput.value = '';
            loadAvailableGcps();
        }
    })
    .catch(error => {
        console.error('Error:', error);
        updateStatus('Error creating GCP');
    });
}

// Event listener for creating a new GCP
createGcpBtn.addEventListener('click', createNewGcp);

// Upload Button
uploadBtn.addEventListener('click', () => {
    const formData = new FormData();
    const files = fileInput.files; // Get all selected files

    if (files.length === 0) {
        updateStatus('No files selected');
        return;
    }

    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]); // Use 'files' (plural) as the field name
    }

    fetch('/upload_multiple', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            updateStatus(data.error);
        } else {
            updateStatus(`Files uploaded: ${data.filenames.join(', ')}`);
            // Update the image list
            loadImageList();
        }
    })
    .catch(error => {
        console.error('Error:', error);
        updateStatus('Error uploading files');
    });
});

// Image Selection
imageSelect.addEventListener('change', () => {
    currentImageName = imageSelect.value;
    selectedImage.src = `/uploads/${currentImageName}`;
    loadGcpsForImage(currentImageName);
    updateStatus('Image loaded');
});

// Add GCP on image click
selectedImage.addEventListener('click', (event) => {
    if (!selectedGcp || !currentImageName) {
        updateStatus('Please select a GCP and an image first');
        return;
    }

    const rect = selectedImage.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Send data to backend
    fetch('/add_gcp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image_name: currentImageName, x: x, y: y, gcp_name: selectedGcp })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            updateStatus(data.error);
        } else {
            console.log(data.message);
            updateStatus('GCP added to image');
            // Refresh GCP markers for the current image
            loadGcpsForImage(currentImageName);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        updateStatus('Error adding GCP');
    });
});

// Select GCP
function selectGcp(gcpName) {
    selectedGcp = gcpName;
    // Highlight selected GCP in the list (optional)
    const gcpItems = gcpList.querySelectorAll('li');
    gcpItems.forEach(item => {
        item.classList.toggle('selected', item.textContent === gcpName);
    });
    updateStatus('GCP selected');
}

// Load image list on page load
function loadImageList() {
    fetch('/images')
    .then(response => response.json())
    .then(images => {
        imageSelect.innerHTML = '<option value="">Select an Image</option>';
        images.forEach(image => {
            const option = document.createElement('option');
            option.value = image;
            option.text = image;
            imageSelect.appendChild(option);
        });
        updateStatus('Image list loaded');
    })
    .catch(error => {
        console.error('Error:', error);
        updateStatus('Error loading images');
    });
}

// Load GCPs for the selected image and display markers
function loadGcpsForImage(imageName) {
    fetch(`/get_gcps/${imageName}`)
        .then(response => response.json())
        .then(gcps => {
            // Clear existing markers
            const existingMarkers = imageContainer.querySelectorAll('.gcp-marker');
            existingMarkers.forEach(marker => marker.remove());

            // Add new markers
            gcps.forEach(gcp => {
                const marker = document.createElement('div');
                marker.classList.add('gcp-marker');
                marker.style.left = `${gcp.x}px`;
                marker.style.top = `${gcp.y}px`;
                marker.title = gcp.gcp_name; // Show GCP name on hover
                imageContainer.appendChild(marker);
            });
        })
        .catch(error => {
            console.error('Error:', error);
            updateStatus('Error loading GCPs for image');
        });
}

// Download CSV
downloadCsvBtn.addEventListener('click', () => {
    fetch('/download_csv')
        .then(response => response.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'gcps.csv';
            document.body.appendChild(a);
            a.click();
            a.remove();
            updateStatus('CSV downloaded');
        })
        .catch(error => {
            console.error('Error:', error);
            updateStatus('Error downloading CSV');
        });
});

// Initial load
loadImageList();
loadAvailableGcps();
updateStatus('Ready');