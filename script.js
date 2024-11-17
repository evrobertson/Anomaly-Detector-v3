// Initialize detected coordinates array and add event listeners
let detectedCoords = [];
let uploadedImage = null; // Store the uploaded image for consistent redrawing

document.addEventListener("DOMContentLoaded", init);

function init() {
    // Initialize image upload and sensitivity slider
    init_image_select();
    document.getElementById("sensitivity-slider").addEventListener("input", detectAnomalies);
}

// Set up image selection and display
function init_image_select() {
    const image_selector = document.getElementById("image-input");
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext('2d');

    image_selector.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            uploadedImage = new Image(); // Store the image in uploadedImage
            uploadedImage.onload = function () {
                // Set canvas dimensions to match the uploaded image
                canvas.width = uploadedImage.width;
                canvas.height = uploadedImage.height;
                ctx.drawImage(uploadedImage, 0, 0); // Draw the image on the canvas
            };
            uploadedImage.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// Detect anomalies based on selected color and sensitivity
function detectAnomalies(color) {
    const sensitivity = 100 - parseInt(document.getElementById("sensitivity-slider").value, 10);
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext('2d');

    // Clear any existing highlights and reset with the original image
    if (uploadedImage) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(uploadedImage, 0, 0); // Reset canvas with original image
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    detectedCoords = [];
    const coordinatesList = document.getElementById("coordinates-list");
    coordinatesList.innerHTML = '';

    // Helper function to detect pixel clusters (anomalies)
    function isAnomalyPixel(r, g, b) {
        if (color === 'yellow') return r > 200 && g > 200 && b < (255 - sensitivity);
        if (color === 'red') return r > g && r > b && r > (255 - sensitivity);
        if (color === 'green') return g > r && g > b && g > (255 - sensitivity);
        if (color === 'blue') return b > r && b > g && b > (255 - sensitivity);
        return false;
    }

    // Detect anomalies by clustering nearby pixels
    const visited = new Set();
    function detectCluster(x, y) {
        const stack = [{ x, y }];
        const pixels = [];
        while (stack.length) {
            const { x, y } = stack.pop();
            const index = (y * canvas.width + x) * 4;
            if (visited.has(index)) continue;
            visited.add(index);

            const r = data[index], g = data[index + 1], b = data[index + 2];
            if (isAnomalyPixel(r, g, b)) {
                pixels.push({ x, y });
                // Add neighboring pixels to stack for cluster detection
                if (x > 0) stack.push({ x: x - 1, y });
                if (x < canvas.width - 1) stack.push({ x: x + 1, y });
                if (y > 0) stack.push({ x, y: y - 1 });
                if (y < canvas.height - 1) stack.push({ x, y: y + 1 });
            }
        }
        return pixels;
    }

    // Iterate through each pixel and detect anomalies
    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            const index = (y * canvas.width + x) * 4;
            if (visited.has(index)) continue;
            
            const r = data[index], g = data[index + 1], b = data[index + 2];
            if (isAnomalyPixel(r, g, b)) {
                const cluster = detectCluster(x, y);
                if (cluster.length > 0) {
                    // Calculate cluster center
                    const centerX = Math.floor(cluster.reduce((sum, p) => sum + p.x, 0) / cluster.length);
                    const centerY = Math.floor(cluster.reduce((sum, p) => sum + p.y, 0) / cluster.length);

                    detectedCoords.push({ x: centerX, y: centerY, size: cluster.length, r, g, b });

                    // Create a button for each detected anomaly with pixel count
                    const listItem = document.createElement("li");
                    listItem.classList.add("clickable-coordinate");
                    listItem.innerHTML = `(${centerX}, ${centerY})<br>${cluster.length}px`;
                    listItem.addEventListener("click", () => highlightAnomaly(centerX, centerY, r, g, b, cluster.length));
                    coordinatesList.appendChild(listItem);

                    // Highlight the anomaly area on the canvas
                    ctx.fillStyle = "rgba(255, 0, 0, 0.2)";
                    cluster.forEach(({ x, y }) => ctx.fillRect(x, y, 1, 1));
                }
            }
        }
    }
    // Render the initial list of coordinates (unsorted by default)
    renderCoordinatesList(detectedCoords);
}

// Highlight selected anomaly and show detailed information
function highlightAnomaly(x, y, r, g, b, size) {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext('2d');
    if (uploadedImage) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(uploadedImage, 0, 0); // Redraw the original image
    }

    // Draw a circle around the selected anomaly
    ctx.beginPath();
    ctx.arc(x, y, Math.max(5, Math.sqrt(size)), 0, 2 * Math.PI);
    ctx.fillStyle = "yellow";
    ctx.fill();

    // Show info box with anomaly details
    showInfoBox(x, y, r, g, b, size);
}

// Display anomaly details in info box
function showInfoBox(x, y, r, g, b, size) {
    const infoBox = document.getElementById("info-box");
    const infoBoxContent = document.getElementById("info-box-content");
    const backgroundColor = calculateBackgroundColor();
    const colorDifference = calculateColorDifference(r, g, b, backgroundColor);

    infoBoxContent.innerHTML = `
        <strong>Color Difference:</strong> ${colorDifference.toFixed(2)}<br>
        <strong>Anomaly RGB:</strong> (${r}, ${g}, ${b})<br>
        <strong>Background RGB:</strong> (${backgroundColor.r.toFixed(2)}, ${backgroundColor.g.toFixed(2)}, ${backgroundColor.b.toFixed(2)})<br>
        <strong>Size:</strong> ${size} pixels
    `;
    infoBox.style.display = 'block';
}

// Calculate average background color of the image
function calculateBackgroundColor() {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let totalR = 0, totalG = 0, totalB = 0, count = 0;

    for (let i = 0; i < imageData.length; i += 4) {
        totalR += imageData[i];
        totalG += imageData[i + 1];
        totalB += imageData[i + 2];
        count++;
    }
    return { r: totalR / count, g: totalG / count, b: totalB / count };
}

// Calculate Euclidean color difference between anomaly and background
function calculateColorDifference(r, g, b, backgroundColor) {
    return Math.sqrt(
        Math.pow(r - backgroundColor.r, 2) +
        Math.pow(g - backgroundColor.g, 2) +
        Math.pow(b - backgroundColor.b, 2)
    );
}

// Toggle display of mouse coordinates on hover
function toggleCoordinateDisplay() {
    const showCoordinates = document.getElementById("toggle-coordinates").checked;
    const tooltip = document.getElementById("coordinate-tooltip") || createTooltip();
    const canvas = document.getElementById("canvas");

    // Update tooltip position on mouse movement
    canvas.addEventListener("mousemove", (event) => {
        if (!showCoordinates) return;
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor(event.clientX - rect.left);
        const y = Math.floor(event.clientY - rect.top);
        tooltip.style.display = "block";
        tooltip.style.left = `${event.pageX + 15}px`;
        tooltip.style.top = `${event.pageY + 15}px`;
        tooltip.textContent = `(${x}, ${y})`;
    });

    // Hide tooltip when mouse leaves the canvas
    canvas.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
    });
}

// Create a tooltip for showing coordinates
function createTooltip() {
    const tooltip = document.createElement("div");
    tooltip.id = "coordinate-tooltip";
    document.body.appendChild(tooltip);
    tooltip.style.position = "absolute";
    tooltip.style.background = "rgba(0, 0, 0, 0.7)";
    tooltip.style.color = "#fff";
    tooltip.style.padding = "5px 8px";
    tooltip.style.borderRadius = "4px";
    tooltip.style.fontSize = "12px";
    tooltip.style.pointerEvents = "none";
    tooltip.style.display = "none";
    return tooltip;
}
// Sort the anomalies based on the selected option
function sortCoordinates() {
    const sortOption = document.getElementById("sort-options").value;
    let sortedCoords = [...detectedCoords]; // Make a copy to sort

    if (sortOption === "size-asc") {
        // Sort by size (small to large)
        sortedCoords.sort((a, b) => a.size - b.size);
    } else if (sortOption === "size-desc") {
        // Sort by size (large to small)
        sortedCoords.sort((a, b) => b.size - a.size);
    } else if (sortOption === "left-to-right") {
        // Sort by x-coordinate (left to right)
        sortedCoords.sort((a, b) => a.x - b.x);
    }

    // Update the displayed coordinate list
    renderCoordinatesList(sortedCoords);
}
// Render the list of coordinates as buttons
function renderCoordinatesList(coords) {
    const coordinatesList = document.getElementById("coordinates-list");
    coordinatesList.innerHTML = ''; // Clear the list

    coords.forEach(({ x, y, size, r, g, b }) => {
        const listItem = document.createElement("li");
        listItem.classList.add("clickable-coordinate");
        listItem.innerHTML = `(${x}, ${y})<br>${size}px`;
        listItem.addEventListener("click", () => highlightAnomaly(x, y, r, g, b, size));
        coordinatesList.appendChild(listItem);
    });
}

// Close info box when close button is clicked
document.getElementById("info-box-close").addEventListener("click", () => {
    document.getElementById("info-box").style.display = 'none';
});