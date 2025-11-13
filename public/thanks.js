// Get URL parameters
const params = new URLSearchParams(window.location.search);
const id = params.get('id');
const name = params.get('name') || '';
const message = params.get('message') || '';

// Build receipt preview
function buildReceipt() {
  // Set the name in the thanks message
  const userNameEl = document.getElementById('userName');
  if (userNameEl) {
    userNameEl.textContent = name;
  }
  
  const receiptPreview = document.getElementById('receiptPreview');
  if (!receiptPreview) return;
  
  const processedImageDataUrl = sessionStorage.getItem('processedImage');
  
  // Clear and build receipt
  receiptPreview.textContent = ''; // Clear first
  
  // Add ID
  receiptPreview.appendChild(document.createTextNode(`#${id}\n\n`));
  
  // Add name
  receiptPreview.appendChild(document.createTextNode(`${name}\n\n`));
  
  // Add message
  receiptPreview.appendChild(document.createTextNode(`${message}\n\n`));
  
  // Add image if available
  if (processedImageDataUrl) {
    const img = document.createElement('img');
    img.src = processedImageDataUrl;
    img.className = 'receipt-image';
    img.alt = 'Your image';
    receiptPreview.appendChild(img);
    receiptPreview.appendChild(document.createTextNode('\n\n'));
    // Clean up sessionStorage after use
    sessionStorage.removeItem('processedImage');
  }
  
  // Add 32 dashes
  receiptPreview.appendChild(document.createTextNode('--------------------------------')); // 32 dashes
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', buildReceipt);
} else {
  buildReceipt();
}

