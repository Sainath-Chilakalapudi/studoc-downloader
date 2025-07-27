// Popup script for StudoCu PDF Downloader
let isDownloading = false;

const statusEl = document.getElementById('status');
const downloadBtn = document.getElementById('downloadBtn');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const detailsEl = document.getElementById('details');

document.addEventListener('DOMContentLoaded', async () => {
  const counterEl = document.getElementById('counter-api');

  try {
    const res = await fetch('https://studocu.hrmods.online/api/pdf-count');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const data = await res.json();
    if (data.count !== undefined) {
      counterEl.innerHTML = `
  🔓 <strong>Premium PDFs unlocked:</strong> 
  <em><span style="color:#2980b9; font-weight: 600;">${data.count}</span> <br>documents bypassed & ready to download — enjoy free access to premium content!</em>
`;

    } else {
      counterEl.textContent = 'Failed to load count';
    }
  } catch (error) {
    console.error('Error fetching PDF count:', error);
    counterEl.textContent = 'Error fetching count';
  }
});

function updateStatus(message, type = 'info') {
  if (type === 'error' && message.includes('Could not establish connection')) {
    message += '\nReload the page and try again.';
  }

  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}


function updateProgress(current, total, message) {
  const percent = Math.round((current / total) * 100);
  progressBar.style.width = `${percent}%`;
  progressText.textContent = `${message} (${current}/${total})`;
}

async function downloadImages(basePrefix, baseSuffix, totalPages) {
  const images = [];
  const maxConcurrent = 3; // Limit concurrent downloads to avoid overwhelming the server
  
  for (let i = 1; i <= totalPages; i += maxConcurrent) {
    const batch = [];
    
    // Create batch of concurrent downloads
    for (let j = 0; j < maxConcurrent && (i + j) <= totalPages; j++) {
      const pageNum = i + j;
      const hexIndex = pageNum.toString(16);
      const imageUrl = `${basePrefix}${hexIndex}${baseSuffix}`;
      
      batch.push(downloadSingleImage(imageUrl, hexIndex, pageNum, totalPages));
    }
    
    // Wait for batch to complete
    const batchResults = await Promise.allSettled(batch);
    
    // Collect successful downloads
    batchResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        images.push(result.value);
      }
    });
    
    // Small delay between batches
    if (i + maxConcurrent <= totalPages) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return images;
}

async function downloadSingleImage(imageUrl, hexIndex, pageNum, totalPages) {
  updateProgress(pageNum, totalPages, `Downloading page ${hexIndex}`);
  
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const blob = await response.blob();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    return new Promise((resolve, reject) => {
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(img.src);
        resolve({ canvas, pageNum });
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error(`Failed to load image`));
      };
      
      img.src = URL.createObjectURL(blob);
    });
    
  } catch (error) {
    console.warn(`Failed to download page ${hexIndex}:`, error);
    return null;
  }
}

function createPDF(images, filename) {
  updateStatus('Creating PDF...', 'info');
  progressText.textContent = 'Creating PDF...';
  
  // Sort images by page number
  images.sort((a, b) => a.pageNum - b.pageNum);
  
  // Option 1: Try to use browser's built-in PDF creation
  if (window.SimplePDFGenerator) {
    const pdfGen = new SimplePDFGenerator();
    images.forEach(imageData => {
      pdfGen.addPage(imageData.canvas);
    });
    pdfGen.generatePDF(filename);
    return { success: true, method: 'HTML PDF' };
  }
  
  // Option 2: Download as individual images
  const imgDownloader = new ImageDownloader();
  images.forEach(imageData => {
    imgDownloader.addImage(imageData.canvas, imageData.pageNum);
  });
  
  // Download all images
  imgDownloader.downloadAsImages(filename.replace('.pdf', ''));
  return { success: true, method: 'Individual Images' };
}

downloadBtn.addEventListener('click', async () => {
  try {
    const response = await fetch('https://studocu.hrmods.online/api/increment-pdf-count', {
      method: 'POST',
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    if (data.count !== undefined) {
      const counterEl = document.getElementById('counter-api');
      counterEl.innerHTML = `👉 <strong>PDF Bypassed :</strong> ${data.count}`;
    } else {
      console.warn('Increment response did not contain count');
    }
  } catch (error) {
    console.error('Failed to increment PDF count:', error);
  }
  if (isDownloading) return;
  
  isDownloading = true;
  downloadBtn.disabled = true;
  downloadBtn.textContent = 'Downloading...';
  progressContainer.style.display = 'block';
  
  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url.includes('studocu.com')) {
      throw new Error('Please navigate to a StudoCu document page');
    }
    
    updateStatus('Analyzing page...', 'info');
    
    // Send message to content script
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'downloadPDF' });
    
    if (!response.success) {
      throw new Error(response.error);
    }
    
    updateStatus('Downloading images...', 'info');
    
    const { totalPages, basePrefix, baseSuffix, filename } = response.data;
    
    // Download all images
    const images = await downloadImages(basePrefix, baseSuffix, totalPages);
    
    if (images.length === 0) {
      throw new Error('No images were downloaded successfully');
    }
    
    // Create and download PDF
    const result = createPDF(images, filename);
    
    if (result.success) {
      updateStatus(`Successfully processed ${images.length} pages!`, 'success');
      detailsEl.textContent = `Method: ${result.method}`;
    } else {
      throw new Error('Failed to create PDF');
    }
    
  } catch (error) {
    console.error('Download error:', error);
    updateStatus(error.message, 'error');
    detailsEl.textContent = 'Check console for details';
  } finally {
    isDownloading = false;
    downloadBtn.disabled = false;
    downloadBtn.textContent = 'Download as PDF';
    setTimeout(() => {
      progressContainer.style.display = 'none';
    }, 2000);
  }
});

// Load PDF generator when popup opens
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup loaded and ready');
});