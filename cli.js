#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const open = require('open');
const debug = require('debug')('css-cleaner:cli');
const { analyzeProject } = require('./analyzer');
const { startServer } = require('./server');

const program = new Command();

program
  .name('css-cleaner')
  .description('CLI tool to efficiently detect and remove unused CSS selectors')
  .version('1.0.0')
  .argument('[directory]', 'Target directory to analyze', '.')
  .option('-p, --port <port>', 'Server port', '3456')
  .option('--no-open', 'Do not open browser automatically')
  .option('-r, --restore <file>', 'Restore from session file')
  .option('-v, --verbose', 'Verbose output')
  .action(async (directory, options) => {
    try {
      const projectRoot = path.resolve(process.cwd(), directory);
      
      console.log(chalk.blue('🧹 CSS Cleaner'));
      console.log(chalk.gray(`Analyzing project: ${projectRoot}`));
      
      if (options.verbose) {
        debug.enabled = true;
      }

      // Check if target directory exists
      if (!await fs.pathExists(projectRoot)) {
        console.error(chalk.red(`Error: Directory '${directory}' does not exist`));
        process.exit(1);
      }

      // Restore from session if specified
      let analysisResult;
      if (options.restore) {
        const sessionFile = path.resolve(options.restore);
        if (!await fs.pathExists(sessionFile)) {
          console.error(chalk.red(`Error: Session file '${options.restore}' does not exist`));
          process.exit(1);
        }
        
        console.log(chalk.yellow(`📁 Restoring from session: ${sessionFile}`));
        analysisResult = await fs.readJson(sessionFile);
      } else {
        // Analyze project
        console.log(chalk.yellow('📊 Analyzing HTML and CSS files...'));
        analysisResult = await analyzeProject(projectRoot);
        
        if (!analysisResult || !analysisResult.selectors) {
          console.error(chalk.red('Error: No CSS files found or analysis failed'));
          process.exit(1);
        }
      }

      // Display analysis summary
      const stats = analysisResult.stats || {};
      console.log(chalk.green(`✅ Analysis complete!`));
      console.log(chalk.gray(`   Total selectors: ${stats.total || 0}`));
      console.log(chalk.gray(`   Unused candidates: ${stats.unused || 0}`));
      console.log(chalk.gray(`   HTML files: ${analysisResult.files?.html?.length || 0}`));
      console.log(chalk.gray(`   CSS files: ${analysisResult.files?.css?.length || 0}`));

      // Start server
      const port = parseInt(options.port);
      console.log(chalk.yellow(`🚀 Starting server on port ${port}...`));
      
      const server = await startServer(port, analysisResult, projectRoot);
      
      console.log(chalk.green(`✅ Server started at http://localhost:${port}`));
      
      // Open browser
      if (options.open) {
        console.log(chalk.blue('🌐 Opening browser...'));
        await open(`http://localhost:${port}`);
      }

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n🛑 Shutting down server...'));
        server.close(() => {
          console.log(chalk.green('✅ Server closed'));
          process.exit(0);
        });
      });

      // Keep process alive
      console.log(chalk.gray('Press Ctrl+C to stop the server'));
      
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// Handle unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error);
  process.exit(1);
});

// Parse command line arguments
program.parse();