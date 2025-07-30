const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const debug = require('debug')('css-cleaner:server');

let currentAnalysis = null;
let currentProjectRoot = null;

/**
 * Start the Express server
 * @param {number} port - Port to listen on
 * @param {Object} analysisResult - Analysis result from analyzer
 * @param {string} projectRoot - Project root directory
 * @returns {Object} Express server instance
 */
async function startServer(port, analysisResult, projectRoot) {
  const app = express();
  
  // Store analysis data
  currentAnalysis = analysisResult;
  currentProjectRoot = projectRoot;
  
  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'dist')));
  
  // Logging middleware
  app.use((req, res, next) => {
    debug(`${req.method} ${req.path}`);
    next();
  });

  // API Routes

  /**
   * GET /api/selectors - Get all selectors with their states
   */
  app.get('/api/selectors', (req, res) => {
    try {
      res.json({
        selectors: currentAnalysis.selectors,
        stats: calculateCurrentStats(),
        files: currentAnalysis.files,
        projectRoot: currentProjectRoot
      });
    } catch (error) {
      debug('Error getting selectors:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/toggle - Toggle selector active state
   */
  app.post('/api/toggle', (req, res) => {
    try {
      const { selector, active } = req.body;
      
      if (!selector || typeof active !== 'boolean') {
        return res.status(400).json({ error: 'Missing selector or active parameter' });
      }
      
      if (!currentAnalysis.selectors[selector]) {
        return res.status(404).json({ error: 'Selector not found' });
      }
      
      currentAnalysis.selectors[selector].active = active;
      debug(`Toggled selector ${selector} to ${active}`);
      
      const newStats = calculateCurrentStats();
      res.json({
        success: true,
        stats: newStats,
        selector: currentAnalysis.selectors[selector]
      });
      
    } catch (error) {
      debug('Error toggling selector:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/toggle-all - Toggle all selectors
   */
  app.post('/api/toggle-all', (req, res) => {
    try {
      const { active } = req.body;
      
      if (typeof active !== 'boolean') {
        return res.status(400).json({ error: 'Missing active parameter' });
      }
      
      Object.keys(currentAnalysis.selectors).forEach(selector => {
        currentAnalysis.selectors[selector].active = active;
      });
      
      debug(`Toggled all selectors to ${active}`);
      
      const newStats = calculateCurrentStats();
      res.json({
        success: true,
        stats: newStats
      });
      
    } catch (error) {
      debug('Error toggling all selectors:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/restore - Restore selector states
   */
  app.post('/api/restore', (req, res) => {
    try {
      const { type } = req.body;
      
      if (type === 'original') {
        // Restore to original analysis state
        Object.keys(currentAnalysis.selectors).forEach(selector => {
          const selectorData = currentAnalysis.selectors[selector];
          selectorData.active = !selectorData.unused;
        });
        debug('Restored to original state');
      } else if (type === 'all') {
        // Enable all selectors
        Object.keys(currentAnalysis.selectors).forEach(selector => {
          currentAnalysis.selectors[selector].active = true;
        });
        debug('Restored all selectors to active');
      }
      
      const newStats = calculateCurrentStats();
      res.json({
        success: true,
        stats: newStats
      });
      
    } catch (error) {
      debug('Error restoring selectors:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/save - Save cleaned CSS
   */
  app.post('/api/save', async (req, res) => {
    try {
      const { filename = 'cleaned.css', overwrite = false } = req.body;
      
      // Generate cleaned CSS content
      const cleanedCSS = generateCleanedCSS();
      
      let outputPath;
      let savedFiles = [];
      
      if (overwrite) {
        // Overwrite original CSS files
        for (const cssFile of currentAnalysis.files.css) {
          const originalPath = path.join(currentProjectRoot, cssFile);
          
          // Create backup first
          const backupDir = path.join(currentProjectRoot, 'backup');
          await fs.ensureDir(backupDir);
          const backupPath = path.join(backupDir, `${cssFile}.backup.${Date.now()}`);
          await fs.copy(originalPath, backupPath);
          
          // Overwrite original
          await fs.writeFile(originalPath, cleanedCSS, 'utf8');
          savedFiles.push(cssFile);
          
          debug(`Overwritten ${originalPath}, backup saved to ${backupPath}`);
        }
        
        outputPath = 'Original CSS files';
      } else {
        // Save as new file
        outputPath = path.join(currentProjectRoot, filename);
        await fs.writeFile(outputPath, cleanedCSS, 'utf8');
        savedFiles.push(filename);
        
        debug(`Saved cleaned CSS to ${outputPath}`);
      }
      
      // Save session
      const sessionPath = path.join(currentProjectRoot, 'session.json');
      await fs.writeJson(sessionPath, currentAnalysis, { spaces: 2 });
      
      const stats = calculateCurrentStats();
      res.json({
        success: true,
        outputPath: overwrite ? outputPath : path.relative(currentProjectRoot, outputPath),
        sessionPath: path.relative(currentProjectRoot, sessionPath),
        overwritten: overwrite,
        savedFiles: savedFiles,
        stats,
        size: cleanedCSS.length
      });
      
    } catch (error) {
      debug('Error saving CSS:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/css - Get current CSS based on active selectors
   */
  app.get('/api/css', (req, res) => {
    try {
      const cleanedCSS = generateCleanedCSS();
      res.setHeader('Content-Type', 'text/css');
      res.send(cleanedCSS);
    } catch (error) {
      debug('Error generating CSS:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/preview/:file - Serve HTML files with modified CSS
   */
  app.get('/api/preview/:file(*)', async (req, res) => {
    try {
      const requestedFile = req.params.file;
      const filePath = path.join(currentProjectRoot, requestedFile);
      
      // Security check - ensure file is within project root
      const resolvedPath = path.resolve(filePath);
      const resolvedRoot = path.resolve(currentProjectRoot);
      
      if (!resolvedPath.startsWith(resolvedRoot)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      if (!await fs.pathExists(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      const htmlContent = await fs.readFile(filePath, 'utf8');
      
      // Replace CSS links with our dynamic CSS endpoint
      const modifiedHtml = htmlContent.replace(
        /<link\s+[^>]*rel=["']stylesheet["'][^>]*>/gi,
        '<link rel="stylesheet" href="/api/css">'
      );
      
      res.setHeader('Content-Type', 'text/html');
      res.send(modifiedHtml);
      
    } catch (error) {
      debug('Error serving preview:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Serve the main UI
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });

  // Error handling middleware
  app.use((error, req, res, next) => {
    debug('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  });

  // Start server
  const server = app.listen(port, () => {
    debug(`Server listening on port ${port}`);
  });

  return server;
}

/**
 * Generate cleaned CSS from active selectors
 * @returns {string} Cleaned CSS content
 */
function generateCleanedCSS() {
  let cleanedCSS = '';
  
  Object.keys(currentAnalysis.selectors).forEach(selector => {
    const selectorData = currentAnalysis.selectors[selector];
    if (selectorData.active) {
      cleanedCSS += selectorData.css;
    }
  });
  
  return cleanedCSS;
}

/**
 * Calculate current statistics based on selector states
 * @returns {Object} Current statistics
 */
function calculateCurrentStats() {
  const total = Object.keys(currentAnalysis.selectors).length;
  let unused = 0;
  let active = 0;
  let disabled = 0;
  
  Object.values(currentAnalysis.selectors).forEach(selectorData => {
    if (selectorData.unused) unused++;
    if (selectorData.active) active++;
    if (!selectorData.active) disabled++;
  });
  
  return {
    total,
    unused,
    used: total - unused,
    active,
    disabled
  };
}

module.exports = {
  startServer
};