const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { marked } = require('marked');

const mdPath = path.join(__dirname, 'SUBMISSION.md');
const htmlPath = path.join(__dirname, 'report.html');
const pdfPath = path.join(__dirname, 'SUBMISSION.pdf');

const markdownContent = fs.readFileSync(mdPath, 'utf-8');
let bodyHtml = marked.parse(markdownContent);

// Transform mermaid code blocks into div.mermaid so mermaid.js renders graphical SVGs
bodyHtml = bodyHtml.replace(
  /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
  (match, code) => {
    const unescaped = code
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    return `<div class="mermaid">${unescaped}</div>`;
  }
);

const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Timetable & Room - Cloudflare D1 Mini Project</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Fira+Code:wght@400;500&display=swap');

    @page {
      size: A4;
      margin: 18mm 15mm 18mm 15mm;
      @bottom-right {
        content: counter(page);
      }
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1e293b;
      line-height: 1.6;
      font-size: 13px;
      margin: 0;
      padding: 0;
    }

    h1 {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 8px;
      margin-top: 0;
      margin-bottom: 16px;
    }

    h2 {
      font-size: 18px;
      font-weight: 600;
      color: #1e3a8a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
      margin-top: 24px;
      margin-bottom: 12px;
      page-break-after: avoid;
    }

    h3 {
      font-size: 15px;
      font-weight: 600;
      color: #334155;
      margin-top: 18px;
      margin-bottom: 8px;
      page-break-after: avoid;
    }

    p, li {
      color: #334155;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 12px;
      page-break-inside: avoid;
    }

    th, td {
      border: 1px solid #cbd5e1;
      padding: 7px 10px;
      text-align: left;
    }

    th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: 600;
    }

    tr:nth-child(even) {
      background-color: #f8fafc;
    }

    code {
      font-family: 'Fira Code', monospace;
      font-size: 11.5px;
      background-color: #f1f5f9;
      color: #0f766e;
      padding: 2px 5px;
      border-radius: 4px;
    }

    pre {
      background-color: #0f172a;
      color: #f8fafc;
      padding: 12px 14px;
      border-radius: 6px;
      overflow-x: auto;
      font-family: 'Fira Code', monospace;
      font-size: 11px;
      line-height: 1.45;
      page-break-inside: avoid;
      margin: 12px 0;
    }

    pre code {
      background-color: transparent;
      color: #f8fafc;
      padding: 0;
    }

    blockquote {
      border-left: 4px solid #3b82f6;
      margin: 14px 0;
      padding: 6px 14px;
      background-color: #eff6ff;
      color: #1e40af;
    }

    hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 20px 0;
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 9999px;
      background-color: #dbeafe;
      color: #1d4ed8;
    }

    .mermaid {
      background-color: #f8fafc;
      padding: 15px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      margin: 15px 0;
      text-align: center;
      page-break-inside: avoid;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({ startOnLoad: true, theme: 'neutral' });
  </script>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;

fs.writeFileSync(htmlPath, fullHtml, 'utf-8');
console.log('Generated report.html');

// Try Chrome or Edge
const chromePath = 'C:\\Program Files\\Google\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

let browserPath = fs.existsSync(chromePath) ? chromePath : edgePath;
console.log('Using browser for PDF generation:', browserPath);

const cmd = `"${browserPath}" --headless=new --disable-gpu --run-all-compositor-stages-before-draw --virtual-time-budget=5000 --print-to-pdf="${pdfPath}" --no-pdf-header-footer "${htmlPath}"`;

try {
  execSync(cmd, { stdio: 'inherit' });
  const stats = fs.statSync(pdfPath);
  console.log(`Successfully generated SUBMISSION.pdf (${stats.size} bytes)`);
} catch (err) {
  console.error('Error generating PDF with headless browser:', err);
  process.exit(1);
}
