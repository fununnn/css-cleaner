class CSSCleaner {
    constructor() {
        this.selectors = {};
        this.stats = {};
        this.files = { html: [], css: [] };
        this.filteredSelectors = [];
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadSelectors();
        this.updateUI();
    }

    setupEventListeners() {
        // Control buttons
        document.getElementById('enable-all').addEventListener('click', () => this.toggleAll(true));
        document.getElementById('disable-all').addEventListener('click', () => this.toggleAll(false));
        document.getElementById('restore-original').addEventListener('click', () => this.restore('original'));
        document.getElementById('save-new-css').addEventListener('click', () => this.showSaveModal('new'));
        document.getElementById('overwrite-css').addEventListener('click', () => this.showSaveModal('overwrite'));

        // Search and filter
        document.getElementById('search-input').addEventListener('input', (e) => this.filterSelectors());
        document.getElementById('show-unused').addEventListener('change', () => this.filterSelectors());
        document.getElementById('show-disabled').addEventListener('change', () => this.filterSelectors());

        // HTML file selector
        document.getElementById('html-file-select').addEventListener('change', (e) => {
            this.loadPreview(e.target.value);
        });

        // Save modal
        document.getElementById('modal-close').addEventListener('click', () => this.hideSaveModal());
        document.getElementById('cancel-save').addEventListener('click', () => this.hideSaveModal());
        document.getElementById('confirm-save').addEventListener('click', () => this.saveCSS());

        // Close modal on outside click
        document.getElementById('save-modal').addEventListener('click', (e) => {
            if (e.target.id === 'save-modal') {
                this.hideSaveModal();
            }
        });
    }

    async loadSelectors() {
        try {
            this.setStatus('Loading selectors...', 'loading');
            
            const response = await fetch('/api/selectors');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.selectors = data.selectors;
            this.stats = data.stats;
            this.files = data.files;
            
            // Populate HTML file selector
            this.populateHtmlSelector();
            
            this.setStatus('Selectors loaded successfully', 'success');
            
        } catch (error) {
            console.error('Error loading selectors:', error);
            this.setStatus(`Error loading selectors: ${error.message}`, 'error');
        }
    }

    populateHtmlSelector() {
        const select = document.getElementById('html-file-select');
        select.innerHTML = '<option value="">Select HTML file to preview</option>';
        
        this.files.html.forEach((file, index) => {
            const option = document.createElement('option');
            option.value = file;
            option.textContent = file;
            // Select the first HTML file by default
            if (index === 0) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        
        // Auto-load the first HTML file if available
        if (this.files.html.length > 0) {
            this.loadPreview(this.files.html[0]);
        }
    }

    filterSelectors() {
        const searchTerm = document.getElementById('search-input').value.toLowerCase();
        const showUnused = document.getElementById('show-unused').checked;
        const showDisabled = document.getElementById('show-disabled').checked;

        this.filteredSelectors = Object.keys(this.selectors).filter(selector => {
            const selectorData = this.selectors[selector];
            
            // Search filter
            if (searchTerm && !selector.toLowerCase().includes(searchTerm)) {
                return false;
            }
            
            // Unused filter
            if (showUnused && !selectorData.unused) {
                return false;
            }
            
            // Disabled filter
            if (showDisabled && selectorData.active) {
                return false;
            }
            
            return true;
        });

        this.renderSelectorList();
    }

    renderSelectorList() {
        const container = document.getElementById('selector-list');
        
        if (this.filteredSelectors.length === 0) {
            container.innerHTML = '<div class="no-results">No selectors match your filters</div>';
            return;
        }

        const html = this.filteredSelectors.map(selector => {
            const selectorData = this.selectors[selector];
            const unusedClass = selectorData.unused ? 'unused' : '';
            const activeClass = selectorData.active ? 'active' : 'inactive';
            
            return `
                <div class="selector-item ${unusedClass} ${activeClass}">
                    <label class="selector-label">
                        <input type="checkbox" 
                               ${selectorData.active ? 'checked' : ''} 
                               data-selector="${selector}"
                               class="selector-checkbox">
                        <span class="selector-name">${selector}</span>
                        ${selectorData.unused ? '<span class="unused-badge">❗</span>' : ''}
                    </label>
                    <div class="selector-info">
                        <span class="file-info">Files: ${selectorData.files.join(', ')}</span>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;

        // Add event listeners to checkboxes
        container.querySelectorAll('.selector-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.toggleSelector(e.target.dataset.selector, e.target.checked);
            });
        });
    }

    async toggleSelector(selector, active) {
        try {
            const response = await fetch('/api/toggle', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ selector, active })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.stats = data.stats;
            this.selectors[selector] = data.selector;
            
            this.updateStats();
            this.refreshPreview();
            
            this.setStatus(`${active ? 'Enabled' : 'Disabled'} selector: ${selector}`, 'success');
            
        } catch (error) {
            console.error('Error toggling selector:', error);
            this.setStatus(`Error toggling selector: ${error.message}`, 'error');
        }
    }

    async toggleAll(active) {
        try {
            this.setStatus(`${active ? 'Enabling' : 'Disabling'} all selectors...`, 'loading');
            
            const response = await fetch('/api/toggle-all', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ active })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.stats = data.stats;
            
            // Update local selector states
            Object.keys(this.selectors).forEach(selector => {
                this.selectors[selector].active = active;
            });
            
            this.updateUI();
            this.refreshPreview();
            
            this.setStatus(`${active ? 'Enabled' : 'Disabled'} all selectors`, 'success');
            
        } catch (error) {
            console.error('Error toggling all selectors:', error);
            this.setStatus(`Error toggling selectors: ${error.message}`, 'error');
        }
    }

    async restore(type) {
        try {
            this.setStatus('Restoring selector states...', 'loading');
            
            const response = await fetch('/api/restore', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ type })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            await this.loadSelectors(); // Reload to get updated states
            this.updateUI();
            this.refreshPreview();
            
            this.setStatus('Selector states restored', 'success');
            
        } catch (error) {
            console.error('Error restoring selectors:', error);
            this.setStatus(`Error restoring selectors: ${error.message}`, 'error');
        }
    }

    loadPreview(filename) {
        const iframe = document.getElementById('preview-iframe');
        const noPreview = document.querySelector('.no-preview');
        
        if (!filename) {
            iframe.style.display = 'none';
            noPreview.style.display = 'flex';
            return;
        }

        iframe.src = `/api/preview/${filename}`;
        iframe.style.display = 'block';
        noPreview.style.display = 'none';
        
        this.setStatus(`Loading preview: ${filename}`, 'loading');
        
        iframe.onload = () => {
            this.setStatus(`Preview loaded: ${filename}`, 'success');
        };
        
        iframe.onerror = () => {
            this.setStatus(`Error loading preview: ${filename}`, 'error');
        };
    }

    refreshPreview() {
        const iframe = document.getElementById('preview-iframe');
        if (iframe.src && iframe.src !== 'about:blank') {
            // Force reload by changing src
            const currentSrc = iframe.src;
            iframe.src = 'about:blank';
            setTimeout(() => {
                iframe.src = currentSrc;
            }, 100);
        }
    }

    showSaveModal(mode = 'new') {
        const modal = document.getElementById('save-modal');
        const modalTitle = document.getElementById('modal-title');
        const filenameSection = document.getElementById('filename-section');
        const overwriteWarning = document.getElementById('overwrite-warning');
        const confirmButton = document.getElementById('confirm-save');
        
        // Update modal based on mode
        if (mode === 'overwrite') {
            modalTitle.textContent = 'Overwrite Original CSS Files';
            filenameSection.style.display = 'none';
            overwriteWarning.style.display = 'flex';
            confirmButton.textContent = 'Overwrite Files';
            confirmButton.className = 'btn btn-warning';
            
            // Show files that will be overwritten
            const filesList = document.getElementById('files-to-overwrite');
            filesList.innerHTML = '';
            this.files.css.forEach(file => {
                const li = document.createElement('li');
                li.textContent = file;
                filesList.appendChild(li);
            });
            
            this.currentSaveMode = 'overwrite';
        } else {
            modalTitle.textContent = 'Save as New CSS File';
            filenameSection.style.display = 'block';
            overwriteWarning.style.display = 'none';
            confirmButton.textContent = 'Save';
            confirmButton.className = 'btn btn-success';
            
            this.currentSaveMode = 'new';
        }
        
        // Update statistics
        document.getElementById('save-active-count').textContent = this.stats.active || 0;
        document.getElementById('save-disabled-count').textContent = this.stats.disabled || 0;
        
        const reductionPercent = this.stats.total > 0 
            ? Math.round((this.stats.disabled / this.stats.total) * 100) 
            : 0;
        document.getElementById('size-reduction').textContent = `${reductionPercent}%`;
        
        modal.classList.add('show');
    }

    hideSaveModal() {
        document.getElementById('save-modal').classList.remove('show');
    }

    async saveCSS() {
        try {
            let filename = 'cleaned.css';
            let overwrite = false;
            
            if (this.currentSaveMode === 'overwrite') {
                overwrite = true;
                this.setStatus('Overwriting original CSS files...', 'loading');
            } else {
                filename = document.getElementById('filename-input').value || 'cleaned.css';
                this.setStatus('Saving CSS...', 'loading');
            }
            
            this.hideSaveModal();
            
            const response = await fetch('/api/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ filename, overwrite })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (overwrite) {
                this.setStatus(`Original CSS files overwritten successfully (${data.size} bytes total)`, 'success');
            } else {
                this.setStatus(`CSS saved to ${data.outputPath} (${data.size} bytes)`, 'success');
            }
            
        } catch (error) {
            console.error('Error saving CSS:', error);
            this.setStatus(`Error saving CSS: ${error.message}`, 'error');
        }
    }

    updateUI() {
        this.updateStats();
        this.filterSelectors();
    }

    updateStats() {
        document.getElementById('total-count').textContent = this.stats.total || 0;
        document.getElementById('unused-count').textContent = this.stats.unused || 0;
        document.getElementById('active-count').textContent = this.stats.active || 0;
        document.getElementById('disabled-count').textContent = this.stats.disabled || 0;
    }

    setStatus(message, type = 'info') {
        const statusElement = document.getElementById('status-message');
        statusElement.textContent = message;
        statusElement.className = `status-message ${type}`;
        
        // Auto-clear success/error messages
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                statusElement.textContent = 'Ready';
                statusElement.className = 'status-message';
            }, 3000);
        }
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new CSSCleaner();
});