// Content script for StudoCu PDF Downloader
console.log('StudoCu PDF Downloader content script loaded');

function getUniqueFilename(url, extension = '.pdf') {
  // Extract the file name from the given URL
  const match = url.match(/\/([^\/]+?)\/\d+\?/);
  const baseName = match ? match[1] : 'output_document';
  return `${baseName}${extension}`;
}

function extractImageData() {
  try {
    console.log('🔄 Extracting image data from page...');
    
    // Get all divs with data-page-index attribute
    const pageElements = document.querySelectorAll('div[data-page-index]');
    const totalPages = pageElements.length;
    
    console.log(`📄 Found ${totalPages} pages with data-page-index.`);
    
    if (totalPages === 0) {
      throw new Error('No pages found with data-page-index attribute.');
    }
    
    // Get first image URL from first data-page-index div
    const firstDiv = pageElements[0];
    const img = firstDiv.querySelector('img');
    
    if (!img || !img.src) {
      throw new Error('No image src found in first data-page-index div.');
    }
    
    const firstImgUrl = img.src;
    console.log(`🔗 First image URL: ${firstImgUrl}`);
    
    // Parse the first image URL to get prefix and suffix
    const match = firstImgUrl.match(/(.*?\/bg)(\d+)(\.png\?.*)/);
    if (!match) {
      throw new Error('Could not parse base image URL pattern.');
    }
    
    const [, basePrefix, , baseSuffix] = match;
    console.log(`Base URL prefix: ${basePrefix}`);
    console.log(`Base URL suffix: ${baseSuffix}`);
    
    // Generate filename
    const filename = getUniqueFilename(window.location.href);
    console.log(`📄 PDF will be saved as: ${filename}`);
    
    return {
      totalPages,
      basePrefix,
      baseSuffix,
      filename
    };
    
  } catch (error) {
    console.error('Error extracting image data:', error);
    throw error;
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
  
  if (request.action === 'downloadPDF') {
    try {
      const data = extractImageData();
      sendResponse({ success: true, data });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }
  
  return true; // Keep message channel open for async response
});

// Optional: Add a visual indicator when the extension is active
function addExtensionIndicator() {
  // Check if we're on a StudoCu document page
  if (!window.location.href.includes('studocu.com/') || !window.location.href.includes('/document/')) {
    return;
  }
  
  // Check if indicator already exists
  if (document.getElementById('studocu-pdf-indicator')) {
    return;
  }
  
  const indicator = document.createElement('div');
  indicator.id = 'studocu-pdf-indicator';
  indicator.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 10000;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      font-family: Arial, sans-serif;
    ">
      📄 PDF Downloader Ready
    </div>
  `;
  
  document.body.appendChild(indicator);
  
  // Remove indicator after 3 seconds
  setTimeout(() => {
    const el = document.getElementById('studocu-pdf-indicator');
    if (el) el.remove();
  }, 3000);
}

// Add indicator when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addExtensionIndicator);
} else {
  addExtensionIndicator();
}