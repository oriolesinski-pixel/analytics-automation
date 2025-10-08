///Users/oriolesinski/analytics-automation/packages/analytics-platform/src/components/onboarding/ReviewSchema/SitePreviewSandbox.tsx
'use client';

import React, { useMemo } from 'react';

interface SitePreviewSandboxProps {
  selectedRepo: any;
  previewDevice: string;
  schema?: any;
}

export function SitePreviewSandbox({ selectedRepo, previewDevice, schema }: SitePreviewSandboxProps) {
  
  // Check if we have a live URL to display
  const siteUrl = schema?.siteUrl;
  
  // Device-specific wrapper styling
  const getDeviceStyles = () => {
    switch (previewDevice) {
      case 'mobile':
        return {
          width: '375px',
          height: '667px',
          margin: '0 auto',
          border: '12px solid #1f2937',
          borderRadius: '2rem',
          overflow: 'hidden',
          backgroundColor: '#1f2937'
        };
      case 'desktop':
        return {
          width: '100%',
          height: '100%'
        };
      default:
        return {
          width: '100%',
          height: '100%'
        };
    }
  };

  const deviceStyles = getDeviceStyles();

  // If we have a live URL, use it directly
  if (siteUrl) {
    return (
      <div style={deviceStyles}>
        <iframe
          src={siteUrl}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            backgroundColor: '#fff'
          }}
          title="Live Site Preview"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>
    );
  }

  // Otherwise, generate a static preview
  const htmlContent = useMemo(() => {
    const appName = selectedRepo?.name?.replace(/-/g, ' ').replace(/_/g, ' ') || 'Application';
    const appTitle = appName.split(' ').map((word: string) => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${appTitle}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #333;
              background: #f9fafb;
            }
            .container { 
              max-width: 1200px; 
              margin: 0 auto; 
              padding: 0 20px; 
            }
            .header {
              background: white;
              border-bottom: 1px solid #e5e7eb;
              padding: 1rem 0;
            }
            .nav {
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .logo {
              font-size: 1.5rem;
              font-weight: bold;
              color: #1f2937;
            }
            .nav-links {
              display: flex;
              gap: 2rem;
            }
            .nav-links a {
              color: #6b7280;
              text-decoration: none;
              transition: color 0.2s;
            }
            .nav-links a:hover {
              color: #1f2937;
            }
            .placeholder {
              padding: 100px 20px;
              text-align: center;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .placeholder h1 {
              font-size: 3rem;
              margin-bottom: 1rem;
            }
            .placeholder p {
              font-size: 1.25rem;
              opacity: 0.9;
              margin-bottom: 2rem;
            }
            .btn {
              display: inline-block;
              background: white;
              color: #764ba2;
              padding: 12px 32px;
              border-radius: 8px;
              text-decoration: none;
              font-weight: 600;
              transition: transform 0.2s;
            }
            .btn:hover {
              transform: translateY(-2px);
            }
            .info-section {
              padding: 60px 20px;
              background: white;
              margin: 40px auto;
              max-width: 800px;
              border-radius: 12px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .info-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 2rem;
              margin-top: 2rem;
            }
            .info-item {
              text-align: center;
            }
            .info-icon {
              font-size: 2.5rem;
              margin-bottom: 0.5rem;
            }
            .info-title {
              font-weight: 600;
              color: #1f2937;
              margin-bottom: 0.5rem;
            }
            .info-desc {
              color: #6b7280;
              font-size: 0.875rem;
            }
            .badge {
              position: fixed;
              bottom: 20px;
              right: 20px;
              background: #10b981;
              color: white;
              padding: 8px 16px;
              border-radius: 20px;
              font-size: 12px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .pulse {
              width: 8px;
              height: 8px;
              background: white;
              border-radius: 50%;
              animation: pulse 2s infinite;
            }
            @keyframes pulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.5; transform: scale(0.8); }
            }
          </style>
        </head>
        <body>
          <header class="header">
            <div class="container nav">
              <div class="logo">${appTitle}</div>
              <nav class="nav-links">
                <a href="#">Home</a>
                <a href="#">Features</a>
                <a href="#">About</a>
                <a href="#">Contact</a>
              </nav>
            </div>
          </header>
          
          <section class="placeholder">
            <div class="container">
              <h1>Analytics Preview</h1>
              <p>Your application "${appTitle}" is being analyzed</p>
              <a href="#" class="btn">Learn More</a>
            </div>
          </section>
          
          <section class="info-section">
            <div class="container">
              <h2 style="text-align: center; margin-bottom: 1rem;">AI-Powered Analytics</h2>
              <p style="text-align: center; color: #6b7280; margin-bottom: 2rem;">
                Our AI has analyzed your repository and identified key tracking points
              </p>
              
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10"></line>
                      <line x1="12" y1="20" x2="12" y2="4"></line>
                      <line x1="6" y1="20" x2="6" y2="14"></line>
                    </svg>
                  </div>
                  <div class="info-title">Smart Tracking</div>
                  <div class="info-desc">Automatic event detection</div>
                </div>
                <div class="info-item">
                  <div class="info-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <circle cx="12" cy="12" r="6"></circle>
                      <circle cx="12" cy="12" r="2"></circle>
                    </svg>
                  </div>
                  <div class="info-title">Zero Config</div>
                  <div class="info-desc">Works out of the box</div>
                </div>
                <div class="info-item">
                  <div class="info-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                  </div>
                  <div class="info-title">Real-time</div>
                  <div class="info-desc">Instant analytics data</div>
                </div>
              </div>
            </div>
          </section>
          
          <div class="badge">
            <span class="pulse"></span>
            Analytics Active: ${schema?.totalPages || 0} pages, ${schema?.totalComponents || 0} components
          </div>
        </body>
      </html>
    `;
  }, [selectedRepo, schema]);

  // Return static preview when no live URL
  return (
    <div style={deviceStyles}>
      <iframe
        srcDoc={htmlContent}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          backgroundColor: '#fff'
        }}
        title="Site Preview"
        sandbox="allow-same-origin"
      />
    </div>
  );
}