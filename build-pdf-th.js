const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { marked } = require('marked');

const mdPath = path.join(__dirname, 'PROJECT_EXPLANATION_TH.md');
const htmlPath = path.join(__dirname, 'explanation_th.html');
const pdfPath = path.join(__dirname, 'PROJECT_EXPLANATION_TH.pdf');

const markdownContent = fs.readFileSync(mdPath, 'utf-8');
const bodyHtml = marked.parse(markdownContent);

const fullHtml = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>คู่มืออธิบายระบบและสถาปัตยกรรม - Timetable & Room (Cloudflare D1)</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Inter:wght@400;600;700&family=Fira+Code:wght@400;500&display=swap');

    @page {
      size: A4;
      margin: 18mm 15mm 18mm 15mm;
      @bottom-right {
        content: counter(page);
      }
    }

    body {
      font-family: 'Sarabun', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif;
      color: #1e293b;
      line-height: 1.65;
      font-size: 13.5px;
      margin: 0;
      padding: 0;
    }

    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 2.5px solid #2563eb;
      padding-bottom: 8px;
      margin-top: 0;
      margin-bottom: 14px;
    }

    h2 {
      font-size: 17px;
      font-weight: 700;
      color: #1d4ed8;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 5px;
      margin-top: 22px;
      margin-bottom: 10px;
      page-break-after: avoid;
    }

    h3 {
      font-size: 14.5px;
      font-weight: 600;
      color: #334155;
      margin-top: 16px;
      margin-bottom: 8px;
      page-break-after: avoid;
    }

    p, li {
      color: #334155;
    }

    li {
      margin-bottom: 4px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 12px;
      page-break-inside: avoid;
    }

    th, td {
      border: 1px solid #cbd5e1;
      padding: 7px 10px;
      text-align: left;
      vertical-align: top;
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
      border-left: 4px solid #2563eb;
      margin: 12px 0;
      padding: 8px 14px;
      background-color: #eff6ff;
      color: #1e40af;
      border-radius: 0 4px 4px 0;
    }

    hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 18px 0;
    }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;

fs.writeFileSync(htmlPath, fullHtml, 'utf-8');
console.log('Generated explanation_th.html');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browserPath = fs.existsSync(chromePath) ? chromePath : edgePath;

console.log('Using browser for PDF generation:', browserPath);

const cmd = `"${browserPath}" --headless=new --disable-gpu --run-all-compositor-stages-before-draw --virtual-time-budget=4000 --print-to-pdf="${pdfPath}" --no-pdf-header-footer "${htmlPath}"`;

try {
  execSync(cmd, { stdio: 'inherit' });
  const stats = fs.statSync(pdfPath);
  console.log(`Successfully generated PROJECT_EXPLANATION_TH.pdf (${stats.size} bytes)`);
} catch (err) {
  console.error('Error generating PDF:', err);
  process.exit(1);
}
