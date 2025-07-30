# CSS Unused Cleaner

🧹 **Detect and remove unused CSS selectors with intuitive browser UI**

A powerful CLI tool that analyzes your HTML/CSS files, identifies unused selectors, and provides a browser-based interface for safe cleanup with real-time preview.

## ✨ Features

- 🔍 **Smart Analysis**: Automatically detects HTML and CSS files in your project
- 🌐 **Browser Interface**: Intuitive web UI for managing selectors
- 📱 **Real-time Preview**: See changes instantly with live HTML preview
- 🎯 **Categorized Selectors**: Organized by Layout, Typography, Components, etc.
- 💾 **Safe Cleanup**: Create new files or backup originals before overwriting
- ⚡ **Fast & Lightweight**: Built with performance in mind

## 🚀 Quick Start

```bash
# Run on current directory
npx css-unused-cleaner

# Run on specific directory
npx css-unused-cleaner ./my-website

# Specify custom port
npx css-unused-cleaner --port 3000
```

The tool will:
1. Analyze your HTML/CSS files
2. Open browser interface at `http://localhost:3456`
3. Show categorized selectors with usage status
4. Allow safe removal with preview

## 📊 Browser Interface

### Categorized Selector View
- 🏗️ **Layout & Structure**: containers, grids, flexbox
- 📝 **Typography**: headings, text, fonts
- 🎯 **Header**: navigation, branding, hero sections
- 📦 **Cards & Components**: widgets, modals, alerts
- 🔘 **Buttons**: CTAs, form buttons
- 📋 **Forms**: inputs, validation, contact forms
- And more...

### Safety Features
- **Dual Save Options**: Create new files or overwrite with backup
- **Usage Indicators**: Clear marking of unused selectors
- **Real-time Stats**: Track cleanup progress
- **Instant Preview**: See changes before saving

## 📁 Supported Project Types

- ✅ Static HTML/CSS websites
- ✅ Bootstrap projects
- ✅ WordPress themes
- ✅ React build outputs
- ✅ Documentation sites
- ✅ E-commerce sites
- ✅ Nested project structures

## 🛠️ CLI Options

```bash
npx css-unused-cleaner [directory] [options]

Options:
  -p, --port <port>     Server port (default: 3456)
  --no-open            Don't open browser automatically
  -h, --help           Display help information
  -V, --version        Display version number
```

## 📸 Example Output

```
🧹 CSS Cleaner
Analyzing project: /path/to/your/website
📊 Analyzing HTML and CSS files...
✅ Analysis complete!
   Total selectors: 247
   Unused candidates: 89
   HTML files: 5
   CSS files: 3
🚀 Starting server on port 3456...
✅ Server started at http://localhost:3456
🌐 Opening browser...
```

## 🏃‍♂️ Workflow

1. **Analyze**: Scan HTML/CSS files and detect unused selectors
2. **Review**: Use browser UI to examine categorized selectors
3. **Preview**: See real-time changes in HTML preview
4. **Clean**: Save optimized CSS with unused selectors removed
5. **Deploy**: Use cleaned CSS files in production

## 🤝 Why CSS Unused Cleaner?

- **Human-friendly**: Visual interface beats command-line only tools
- **Safe & Reliable**: Always backup, never break your site
- **Smart Categorization**: Find selectors by logical grouping
- **Production Ready**: Handle real-world project complexity

## 📋 Requirements

- Node.js 16.0.0 or higher
- Modern web browser for interface

## 🐛 Issues & Support

Found a bug or have a suggestion? Please [open an issue](https://github.com/css-cleaner/css-cleaner/issues).

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

Made with ❤️ for cleaner, faster websites