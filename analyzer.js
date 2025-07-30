const fs = require('fs-extra');
const path = require('path');
const cheerio = require('cheerio');
const postcss = require('postcss');
const { PurgeCSS } = require('purgecss');
const globby = require('globby');
const debug = require('debug')('css-cleaner:analyzer');

/**
 * Analyze project to find HTML and CSS files and determine unused selectors
 * @param {string} projectRoot - Root directory to analyze
 * @returns {Object} Analysis result with selectors, stats, and file info
 */
async function analyzeProject(projectRoot) {
  debug(`Starting analysis of project: ${projectRoot}`);
  
  try {
    // Find HTML files
    const htmlFiles = await findHtmlFiles(projectRoot);
    debug(`Found ${htmlFiles.length} HTML files:`, htmlFiles);
    
    if (htmlFiles.length === 0) {
      throw new Error('No HTML files found in the project');
    }

    // Extract CSS file references from HTML
    const cssFiles = await extractCssFiles(htmlFiles, projectRoot);
    debug(`Found ${cssFiles.length} CSS files:`, cssFiles);
    
    if (cssFiles.length === 0) {
      throw new Error('No CSS files found in HTML references');
    }

    // Parse CSS files and extract selectors
    const allSelectors = await parseAllCssFiles(cssFiles);
    debug(`Extracted ${Object.keys(allSelectors).length} selectors from CSS files`);

    // Analyze selector usage with PurgeCSS
    const unusedSelectors = await findUnusedSelectors(htmlFiles, cssFiles);
    debug(`Found ${unusedSelectors.length} potentially unused selectors`);

    // Build selector state object
    const selectorStates = buildSelectorStates(allSelectors, unusedSelectors);
    
    // Calculate statistics
    const stats = calculateStats(selectorStates);
    
    const result = {
      timestamp: new Date().toISOString(),
      projectRoot,
      selectors: selectorStates,
      stats,
      files: {
        html: htmlFiles.map(f => path.relative(projectRoot, f)),
        css: cssFiles.map(f => path.relative(projectRoot, f))
      }
    };

    debug('Analysis complete', stats);
    return result;
    
  } catch (error) {
    debug('Analysis failed:', error.message);
    throw error;
  }
}

/**
 * Find all HTML files in the project directory
 * @param {string} projectRoot - Root directory to search
 * @returns {Array<string>} Array of HTML file paths
 */
async function findHtmlFiles(projectRoot) {
  const pattern = path.join(projectRoot, '**/*.html').replace(/\\/g, '/');
  const files = await globby([pattern], {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    absolute: true
  });
  return files;
}

/**
 * Extract CSS file references from HTML files
 * @param {Array<string>} htmlFiles - Array of HTML file paths
 * @param {string} projectRoot - Project root directory
 * @returns {Array<string>} Array of CSS file paths
 */
async function extractCssFiles(htmlFiles, projectRoot) {
  const cssFiles = new Set();
  
  for (const htmlFile of htmlFiles) {
    try {
      const htmlContent = await fs.readFile(htmlFile, 'utf8');
      const $ = cheerio.load(htmlContent);
      
      // Find CSS link tags
      $('link[rel="stylesheet"]').each((_, element) => {
        const href = $(element).attr('href');
        if (href && !href.startsWith('http')) {
          const cssPath = path.resolve(path.dirname(htmlFile), href);
          if (fs.existsSync(cssPath)) {
            cssFiles.add(cssPath);
          }
        }
      });
      
      // Find inline style tags (for future enhancement)
      $('style').each((_, element) => {
        // Could extract inline CSS here
      });
      
    } catch (error) {
      debug(`Error reading HTML file ${htmlFile}:`, error.message);
    }
  }
  
  return Array.from(cssFiles);
}

/**
 * Parse all CSS files and extract selectors
 * @param {Array<string>} cssFiles - Array of CSS file paths
 * @returns {Object} Object mapping selectors to their CSS content and metadata
 */
async function parseAllCssFiles(cssFiles) {
  const allSelectors = {};
  
  for (const cssFile of cssFiles) {
    try {
      const cssContent = await fs.readFile(cssFile, 'utf8');
      const root = postcss.parse(cssContent);
      const fileName = path.basename(cssFile);
      
      root.walkRules(rule => {
        const selectors = rule.selector.split(',').map(s => s.trim());
        
        selectors.forEach(selector => {
          if (!allSelectors[selector]) {
            allSelectors[selector] = {
              css: '',
              files: [],
              rules: []
            };
          }
          
          allSelectors[selector].css += rule.toString() + '\n';
          if (!allSelectors[selector].files.includes(fileName)) {
            allSelectors[selector].files.push(fileName);
          }
          allSelectors[selector].rules.push({
            selector: rule.selector,
            declarations: rule.toString()
          });
        });
      });
      
    } catch (error) {
      debug(`Error parsing CSS file ${cssFile}:`, error.message);
    }
  }
  
  return allSelectors;
}

/**
 * Find unused selectors using PurgeCSS
 * @param {Array<string>} htmlFiles - Array of HTML file paths
 * @param {Array<string>} cssFiles - Array of CSS file paths
 * @returns {Array<string>} Array of unused selector names
 */
async function findUnusedSelectors(htmlFiles, cssFiles) {
  try {
    const purgeCSSResults = await new PurgeCSS().purge({
      content: htmlFiles,
      css: cssFiles,
      rejected: true,
      variables: true
    });
    
    const rejectedSelectors = [];
    purgeCSSResults.forEach(result => {
      if (result.rejected) {
        result.rejected.forEach(selector => {
          rejectedSelectors.push(selector);
        });
      }
    });
    
    return rejectedSelectors;
    
  } catch (error) {
    debug('PurgeCSS analysis failed, using fallback method:', error.message);
    return await findUnusedSelectorsBasic(htmlFiles, cssFiles);
  }
}

/**
 * Basic fallback method to find unused selectors
 * @param {Array<string>} htmlFiles - Array of HTML file paths
 * @param {Array<string>} cssFiles - Array of CSS file paths
 * @returns {Array<string>} Array of potentially unused selector names
 */
async function findUnusedSelectorsBasic(htmlFiles, cssFiles) {
  const usedClasses = new Set();
  const usedIds = new Set();
  const usedTags = new Set();
  
  // Extract used selectors from HTML
  for (const htmlFile of htmlFiles) {
    try {
      const htmlContent = await fs.readFile(htmlFile, 'utf8');
      const $ = cheerio.load(htmlContent);
      
      // Extract classes
      $('[class]').each((_, element) => {
        const classes = $(element).attr('class').split(/\s+/);
        classes.forEach(cls => {
          if (cls.trim()) usedClasses.add(cls.trim());
        });
      });
      
      // Extract IDs
      $('[id]').each((_, element) => {
        const id = $(element).attr('id');
        if (id) usedIds.add(id);
      });
      
      // Extract tag names
      $('*').each((_, element) => {
        usedTags.add(element.tagName?.toLowerCase());
      });
      
    } catch (error) {
      debug(`Error analyzing HTML file ${htmlFile}:`, error.message);
    }
  }
  
  // Get all CSS selectors
  const allSelectors = await parseAllCssFiles(cssFiles);
  const unusedSelectors = [];
  
  // Simple heuristic to find unused selectors
  Object.keys(allSelectors).forEach(selector => {
    const cleanSelector = selector.replace(/[:\[\]>~+\s]/g, '');
    
    if (selector.startsWith('.')) {
      const className = selector.substring(1).split(/[:\[\]>~+\s]/)[0];
      if (!usedClasses.has(className)) {
        unusedSelectors.push(selector);
      }
    } else if (selector.startsWith('#')) {
      const idName = selector.substring(1).split(/[:\[\]>~+\s]/)[0];
      if (!usedIds.has(idName)) {
        unusedSelectors.push(selector);
      }
    } else {
      const tagName = selector.split(/[:\[\]>~+\s]/)[0].toLowerCase();
      if (!usedTags.has(tagName) && !['html', 'body', '*'].includes(tagName)) {
        unusedSelectors.push(selector);
      }
    }
  });
  
  return unusedSelectors;
}

/**
 * Build selector state object for UI
 * @param {Object} allSelectors - All parsed selectors
 * @param {Array<string>} unusedSelectors - List of unused selectors
 * @returns {Object} Selector states for UI
 */
function buildSelectorStates(allSelectors, unusedSelectors) {
  const selectorStates = {};
  const unusedSet = new Set(unusedSelectors);
  
  Object.keys(allSelectors).forEach(selector => {
    const isUnused = unusedSet.has(selector);
    selectorStates[selector] = {
      unused: isUnused,
      active: !isUnused, // Default: enable used selectors, disable unused ones
      css: allSelectors[selector].css,
      files: allSelectors[selector].files,
      usedIn: [] // To be populated by more detailed analysis if needed
    };
  });
  
  return selectorStates;
}

/**
 * Calculate statistics for the analysis
 * @param {Object} selectorStates - Selector states object
 * @returns {Object} Statistics object
 */
function calculateStats(selectorStates) {
  const total = Object.keys(selectorStates).length;
  let unused = 0;
  let disabled = 0;
  
  Object.values(selectorStates).forEach(state => {
    if (state.unused) unused++;
    if (!state.active) disabled++;
  });
  
  return {
    total,
    unused,
    disabled,
    used: total - unused
  };
}

module.exports = {
  analyzeProject,
  findHtmlFiles,
  extractCssFiles,
  parseAllCssFiles,
  findUnusedSelectors
};