import { Router } from 'express';

type RequestSample = {
  title: string;
  method: 'GET' | 'POST';
  path: string;
  body?: Record<string, unknown>;
};

const samples: RequestSample[] = [
  {
    title: 'Health Check',
    method: 'GET',
    path: '/health'
  },
  {
    title: 'Current Auth Session',
    method: 'GET',
    path: '/api/auth/me'
  },
  {
    title: 'Logout Current Session',
    method: 'POST',
    path: '/api/auth/logout',
    body: {}
  },
  {
    title: 'Import Symbols Catalog',
    method: 'POST',
    path: '/api/symbols/import',
    body: {}
  },
  {
    title: 'Grouped Symbols Catalog',
    method: 'GET',
    path: '/api/symbols/grouped'
  },
  {
    title: 'Search Symbols Catalog',
    method: 'GET',
    path: '/api/symbols/search?q=%D8%AE%D9%88%D8%AF%D8%B1%D9%88'
  },
  {
    title: 'Analyze Symbol - Default Windows',
    method: 'GET',
    path: '/api/stocks/%D9%81%D9%85%D9%84%DB%8C/analysis'
  },
  {
    title: 'Analyze Symbol - Force Refresh',
    method: 'GET',
    path: '/api/stocks/%D8%AE%D9%88%D8%AF%D8%B1%D9%88/analysis?forceRefresh=true'
  },
  {
    title: 'Analyze Symbol - Custom Windows',
    method: 'GET',
    path: '/api/stocks/%D8%B4%D9%BE%D9%86%D8%A7/analysis?weeklyWindow=7&monthlyWindow=30&quarterlyWindow=90&forceRefresh=false&includeRealLegal=false'
  },
  {
    title: 'Analyze Symbol - Include Real Legal History',
    method: 'GET',
    path: '/api/stocks/%D9%81%D9%85%D9%84%DB%8C/analysis?includeRealLegal=true'
  },
  {
    title: 'Analyze Symbol - View New ADX ATR Liquidity Fields',
    method: 'GET',
    path: '/api/stocks/%D9%81%D9%85%D9%84%DB%8C/analysis?forceRefresh=true'
  },
  {
    title: 'Force Refresh Symbol History',
    method: 'POST',
    path: '/api/stocks/%D9%81%D9%85%D9%84%DB%8C/refresh',
    body: {
      includeRealLegal: false
    }
  },
  {
    title: 'Force Refresh Symbol History With Real Legal',
    method: 'POST',
    path: '/api/stocks/%D8%AE%D9%88%D8%AF%D8%B1%D9%88/refresh',
    body: {
      includeRealLegal: true
    }
  },
  {
    title: 'Get Stored History',
    method: 'GET',
    path: '/api/stocks/%D9%81%D9%85%D9%84%DB%8C/history?limit=20&offset=0'
  },
  {
    title: 'Get Latest Stored Metric',
    method: 'GET',
    path: '/api/stocks/%D9%81%D9%85%D9%84%DB%8C/latest'
  },
  {
    title: 'Manual Signal Scan - Specific Symbols',
    method: 'POST',
    path: '/api/stocks/scan',
    body: {
      symbols: ['فملی', 'خودرو'],
      forceRefresh: false,
      includeRealLegal: false
    }
  },
  {
    title: 'Invalid Window Validation Example',
    method: 'GET',
    path: '/api/stocks/%D9%81%D9%85%D9%84%DB%8C/analysis?weeklyWindow=30&monthlyWindow=7&quarterlyWindow=90'
  }
];

const escapeHtml = (value: string): string => {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
};

const renderSample = (sample: RequestSample, index: number): string => {
  const safePath = escapeHtml(sample.path);
  const safeTitle = escapeHtml(sample.title);

  if (sample.method === 'GET') {
    return `
      <li>
        <div class="row">
          <span class="method get">GET</span>
          <a href="${safePath}" target="_blank" rel="noopener noreferrer">${safeTitle}</a>
        </div>
        <code>${safePath}</code>
      </li>
    `;
  }

  const body = JSON.stringify(sample.body ?? {}, null, 2);
  const safeBody = escapeHtml(body);

  return `
    <li>
      <div class="row">
        <span class="method post">POST</span>
        <button type="button" onclick="runPostSample(${index})">${safeTitle}</button>
      </div>
      <code>${safePath}</code>
      <pre>${safeBody}</pre>
    </li>
  `;
};

const renderHomePage = (): string => {
  const sampleScript = JSON.stringify(samples);
  const list = samples.map(renderSample).join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Market API Requests</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Arial, sans-serif;
      }
      body {
        margin: 0;
        padding: 24px;
        background: #f6f7f9;
        color: #111827;
      }
      main {
        max-width: 920px;
        margin: 0 auto;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 24px;
      }
      p {
        margin: 0 0 24px;
        color: #4b5563;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 12px;
      }
      li {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 14px 16px;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
        flex-wrap: wrap;
      }
      .method {
        display: inline-block;
        min-width: 48px;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
        text-align: center;
      }
      .get {
        background: #dcfce7;
        color: #166534;
      }
      .post {
        background: #dbeafe;
        color: #1d4ed8;
      }
      a,
      button {
        color: #111827;
        font: inherit;
      }
      a {
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
      button {
        border: 0;
        background: transparent;
        padding: 0;
        cursor: pointer;
        text-align: left;
      }
      code,
      pre {
        display: block;
        margin: 0;
        padding: 10px 12px;
        background: #f9fafb;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        overflow-x: auto;
        white-space: pre-wrap;
        word-break: break-word;
        font-family: Consolas, monospace;
        font-size: 12px;
      }
      pre {
        margin-top: 8px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Market API Request Samples</h1>
      <p>All links use the same base URL as the app that serves this page.</p>
      <ul>${list}</ul>
    </main>
    <script>
      const samples = ${sampleScript};

      async function runPostSample(index) {
        const sample = samples[index];
        const newWindow = window.open('', '_blank', 'noopener,noreferrer');

        if (!newWindow) {
          return;
        }

        newWindow.document.write('<pre>Loading...</pre>');

        try {
          const response = await fetch(sample.path, {
            method: sample.method,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(sample.body ?? {})
          });
          const text = await response.text();
          newWindow.document.open();
          newWindow.document.write('<pre>' + text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;') + '</pre>');
          newWindow.document.close();
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Request failed';
          newWindow.document.open();
          newWindow.document.write('<pre>' + message.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;') + '</pre>');
          newWindow.document.close();
        }
      }
    </script>
  </body>
</html>`;
};

export const rootRouter = Router();

rootRouter.get('/', (_request, response) => {
  response.type('html').send(renderHomePage());
});
