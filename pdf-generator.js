// Simple PDF generator without external dependencies
class SimplePDFGenerator {
  constructor() {
    this.pages = [];
  }

  addPage(canvas) {
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    this.pages.push({
      imageData,
      width: canvas.width,
      height: canvas.height
    });
  }

  async generatePDF(filename) {
    // Create a simple PDF-like document using HTML and CSS
    const pdfContent = this.createPDFHTML();
    
    // Create a blob with the content
    const blob = new Blob([pdfContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // Instead of PDF, we'll create a multi-page HTML document
    // that can be printed as PDF by the browser
    const printWindow = window.open(url, '_blank');
    
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        URL.revokeObjectURL(url);
      }, 1000);
    };
  }

  createPDFHTML() {
    const pageHTMLs = this.pages.map((page, index) => `
      <div class="page" style="
        page-break-after: ${index < this.pages.length - 1 ? 'always' : 'auto'};
        width: 100%;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0;
        padding: 0;
      ">
        <img src="${page.imageData}" style="
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        " />
      </div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>StudoCu Document</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; }
          @media print {
            body { margin: 0; }
            .page { 
              page-break-after: always;
              width: 100vw;
              height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .page:last-child { page-break-after: auto; }
          }
        </style>
      </head>
      <body>
        ${pageHTMLs}
      </body>
      </html>
    `;
  }
}

// Alternative: Direct download as images in a ZIP-like structure
class ImageDownloader {
  constructor() {
    this.images = [];
  }

  addImage(canvas, pageNumber) {
    this.images.push({
      canvas,
      pageNumber,
      dataURL: canvas.toDataURL('image/png')
    });
  }

  async downloadAsImages(filename) {
    // Download each image individually
    for (const img of this.images) {
      const link = document.createElement('a');
      link.href = img.dataURL;
      link.download = `${filename}_page_${img.pageNumber.toString(16)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Small delay between downloads
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

window.SimplePDFGenerator = SimplePDFGenerator;
window.ImageDownloader = ImageDownloader;