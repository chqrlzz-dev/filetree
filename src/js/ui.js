'use strict';

/**
 * UIController Specialist
 * Responsibility: Orchestrate DOM interactions and visual rendering.
 */
const UIController = {
  activeNodeId: null,
  focusNodeId: null,
  dragNodeId: null,
  previewTargetId: null,

  els: {
    nodesRoot: document.getElementById('nodes-root-list'),
    ascii: document.getElementById('ascii-render'),
    search: document.getElementById('node-search'),
    stats: { 
      nodes: document.getElementById('stat-nodes'), 
      depth: document.getElementById('stat-depth') 
    },
    breadcrumb: document.getElementById('breadcrumb-nav'),
    toast: document.getElementById('toast'),
    saveIndicator: document.getElementById('footer-save-indicator')
  },

  // ══════════════════════════════════════════════════
  // PUBLIC ORCHESTRATORS
  // ══════════════════════════════════════════════════

  initializeApplication() {
    this.attachEventListeners();
    this.applyPersistentTheme();
    this.renderApplication();
  },

  renderApplication() {
    const draggingNode = this.dragNodeId ? app.findNodeById(this.dragNodeId) : null;
    
    this.renderSidebarList();
    this.renderNeuralPreview(this.previewTargetId, draggingNode);
    this.renderBreadcrumbNavigation();
    this.refreshStatistics();
  },

  notifyUser(message) {
    this.els.toast.textContent = message;
    this.els.toast.classList.add('show');
    setTimeout(() => this.els.toast.classList.remove('show'), 2000);
  },

  focusNodeForEditing(id) {
    const row = document.querySelector(`.node-row[data-id="${id}"]`);
    if (!row) return;

    const label = row.querySelector('.node-label');
    if (!label) return;

    this.executeFocusAndSelect(label);
  },

  // ── SIDEBAR SPECIALISTS ──

  renderSidebarList() {
    this.els.nodesRoot.innerHTML = '';
    const searchTerm = this.els.search.value.toLowerCase();
    const rootNodes = this.focusNodeId ? [app.findNodeById(this.focusNodeId)] : app.nodes;
    
    this.buildSidebarRecursive(rootNodes, this.els.nodesRoot, searchTerm);
  },

  buildSidebarRecursive(nodes, container, searchTerm) {
    nodes.forEach(node => {
      if (searchTerm && !this.nodeMatchesSearch(node, searchTerm)) return;
      
      const nodeWrapper = document.createElement('div');
      nodeWrapper.className = 'node-item';
      nodeWrapper.appendChild(this.createNodeRowElement(node));

      if (node.children.length > 0) {
        const childContainer = this.createChildContainer(node, searchTerm);
        this.buildSidebarRecursive(node.children, childContainer, searchTerm);
        nodeWrapper.appendChild(childContainer);
      }
      container.appendChild(nodeWrapper);
    });
  },

  createNodeRowElement(node) {
    const depth = this.calculateNodeDepth(node.id);
    const row = document.createElement('div');
    row.className = `node-row ${this.activeNodeId === node.id ? 'active' : ''}`;
    row.dataset.id = node.id;
    row.onclick = (e) => this.handleNodeSelection(e, node);

    const expander = this.createExpanderElement(node);
    const label = this.createLabelElement(node, depth);
    const actions = this.createActionsElement(node);

    row.append(expander, label, actions);
    return row;
  },

  createExpanderElement(node) {
    const expander = document.createElement('div');
    expander.className = `node-expander ${node.expanded ? 'expanded' : ''}`;
    expander.innerHTML = node.children.length > 0 ? '▸' : '';
    expander.onclick = (e) => { 
      e.stopPropagation(); 
      node.expanded = !node.expanded; 
      this.renderApplication(); 
    };
    return expander;
  },

  createLabelElement(node, depth) {
    const label = document.createElement('div');
    label.className = `node-label depth-${Math.min(depth, 5)}`;
    label.contentEditable = true;
    label.textContent = node.label;
    
    label.onfocus = () => { 
      this.activeNodeId = node.id; 
      this.renderNeuralPreview(); 
    };
    label.oninput = (e) => { 
      node.label = e.target.textContent || '...'; 
      this.renderNeuralPreview(); 
      this.refreshStatistics(); 
    };
    label.onblur = () => app.persistStateToStorage();
    
    return label;
  },

  createActionsElement(node) {
    const actions = document.createElement('div');
    actions.className = 'node-actions';
    actions.innerHTML = `
      <div class="flex flex-col gap-0.5 mr-0.5">
        <button class="w-5 h-4 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-[0.5rem] transition-colors" onclick="app.reorderNode('${node.id}', 'up')">▲</button>
        <button class="w-5 h-4 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded text-[0.5rem] transition-colors" onclick="app.reorderNode('${node.id}', 'down')">▼</button>
      </div>
      <button class="action-btn" onclick="UIController.focusOnSubtree('${node.id}')">F</button>
      <button class="action-btn" onclick="app.addNodeToTree('${node.id}')">+</button>
      <button class="action-btn text-red-400" onclick="app.removeNodeFromTree('${node.id}')">✕</button>
    `;
    return actions;
  },

  createChildContainer(node, searchTerm) {
    const container = document.createElement('div');
    container.className = `node-children ${node.expanded || searchTerm ? 'visible' : ''}`;
    if (this.focusNodeId === node.id) {
      container.style.marginLeft = '0';
    }
    return container;
  },

  // ── PREVIEW SPECIALISTS ──

  renderNeuralPreview(dropTargetId = null, draggingNode = null) {
    if (app.nodes.length === 0) {
      this.els.ascii.innerHTML = '';
      return;
    }

    const searchTerm = this.els.search.value.toLowerCase();
    const previewHtml = this.buildPreviewRecursive(app.nodes, '', true, true, false, 0, dropTargetId, draggingNode, searchTerm);
    this.els.ascii.innerHTML = previewHtml;
  },

  buildPreviewRecursive(nodes, prefix, isLastSibling, isRoot, isGhost, depth, dropTargetId, draggingNode, searchTerm) {
    let output = '';

    nodes.forEach((node, index) => {
      const isActuallyLast = index === nodes.length - 1;
      const connector = isRoot ? '' : (isActuallyLast ? '└─ ' : '├─ ');
      const childPrefix = isRoot ? '' : prefix + (isActuallyLast ? '   ' : '│  ');
      
      output += this.generateNodeHtml(node, prefix, connector, isGhost, isRoot, depth, searchTerm);
      
      if (node.id === dropTargetId && draggingNode) {
        output += this.buildPreviewRecursive([draggingNode], childPrefix, node.children.length === 0, false, true, depth + 1, null, null, searchTerm);
      }

      if (node.children.length > 0) {
        output += this.buildPreviewRecursive(node.children, childPrefix, isActuallyLast, false, isGhost, depth + 1, dropTargetId, draggingNode, searchTerm);
        
        if (depth === 0 && !isActuallyLast) {
          output += `<span class="branch ${isGhost ? 'ghost' : ''}">${prefix}│</span>\n`;
        }
      }
    });

    return output;
  },

  generateNodeHtml(node, prefix, connector, isGhost, isRoot, depth, searchTerm) {
    const highlightClass = !isGhost && this.activeNodeId === node.id ? 'highlight' : '';
    const draggingClass = !isGhost && this.dragNodeId === node.id ? 'dragging' : '';
    const ghostClass = isGhost ? 'ghost' : '';
    const rootClass = isRoot && !isGhost ? 'root-node' : '';
    const depthClass = `depth-${Math.min(depth, 5)}`;
    
    let labelDisplay = this.escapeHtml(node.label);
    if (searchTerm && node.label.toLowerCase().includes(searchTerm)) {
      labelDisplay = `<span class="search-match">${labelDisplay}</span>`;
    }

    return `<span class="branch ${ghostClass}">${prefix}${connector}</span><span class="${rootClass} ${highlightClass} ${draggingClass} ${ghostClass} ${depthClass} node-text" data-id="${node.id}" draggable="true">${labelDisplay}</span>\n`;
  },

  // ── EXPORT SPECIALISTS ──

  exportToMarkdownAsync() {
    let markdownOutput = '';
    const buildMarkdown = (nodes, depth) => {
      nodes.forEach(node => {
        const indentation = '  '.repeat(depth);
        markdownOutput += `${indentation}- ${node.label}\n`;
        if (node.children.length) buildMarkdown(node.children, depth + 1);
      });
    };

    buildMarkdown(app.nodes, 0);
    this.initiateDownload(markdownOutput, 'tree.md');
  },

  exportToMermaidAsync() {
    let mermaidOutput = 'graph TD\n';
    const buildMermaid = (nodes) => {
      nodes.forEach(node => {
        const parent = app.findParentOfNode(node.id);
        if (parent) {
          mermaidOutput += `  ${parent.id}["${parent.label}"] --> ${node.id}["${node.label}"]\n`;
        } else {
          mermaidOutput += `  ${node.id}["${node.label}"]\n`;
        }
        if (node.children.length) buildMermaid(node.children);
      });
    };

    buildMermaid(app.nodes);
    this.initiateDownload(mermaidOutput, 'tree.mmd');
  },

  exportToJsonAsync() {
    const jsonOutput = JSON.stringify(app.nodes, null, 2);
    this.initiateDownload(jsonOutput, 'tree.json');
  },

  // ── DATA AND BREADCRUMB SPECIALISTS ──

  refreshStatistics() {
    let totalNodes = 0;
    let maxDepthFound = 0;

    app.traverseNodes(node => {
      totalNodes++;
      const depth = this.calculateNodeDepth(node.id) + 1;
      maxDepthFound = Math.max(maxDepthFound, depth);
    });

    this.els.stats.nodes.textContent = `NODES: ${totalNodes}`;
    this.els.stats.depth.textContent = `DEPTH: ${maxDepthFound}`;

    this.updateSaveIndicator();
  },

  renderBreadcrumbNavigation() {
    if (!this.focusNodeId) {
      this.els.breadcrumb.style.display = 'none';
      return;
    }

    this.els.breadcrumb.style.display = 'flex';
    this.els.breadcrumb.innerHTML = '';
    
    const path = this.constructBreadcrumbPath(this.focusNodeId);
    this.buildBreadcrumbElements(path);
  },

  constructBreadcrumbPath(nodeId) {
    const path = [];
    let current = app.findNodeById(nodeId);
    while (current) {
      path.unshift(current);
      current = app.findParentOfNode(current.id);
    }
    return path;
  },

  buildBreadcrumbElements(path) {
    const rootBreadcrumb = this.createBreadcrumbItem('All Nodes', null);
    this.els.breadcrumb.appendChild(rootBreadcrumb);

    path.forEach(node => {
      const separator = document.createElement('span');
      separator.className = 'breadcrumb-sep';
      separator.textContent = ' / ';
      
      const item = this.createBreadcrumbItem(node.label, node.id);
      this.els.breadcrumb.append(separator, item);
    });
  },

  createBreadcrumbItem(text, id) {
    const span = document.createElement('span');
    span.className = 'breadcrumb-item';
    span.textContent = text;
    span.onclick = () => { 
      this.focusNodeId = id; 
      this.renderApplication(); 
    };
    return span;
  },

  // ── UTILITY SPECIALISTS ──

  handleNodeSelection(e, node) {
    if (this.isEventOnLabelOrAction(e)) return;
    
    this.activeNodeId = node.id;
    this.renderApplication();
  },

  isEventOnLabelOrAction(e) {
    return e.target.classList.contains('node-label') || e.target.closest('button');
  },

  nodeMatchesSearch(node, term) {
    if (node.label.toLowerCase().includes(term)) return true;
    return node.children.some(child => this.nodeMatchesSearch(child, term));
  },

  calculateNodeDepth(id) {
    let depth = 0;
    let current = app.findNodeById(id);
    while (current && (current = app.findParentOfNode(current.id))) {
      depth++;
    }
    return depth;
  },

  focusOnSubtree(id) {
    this.focusNodeId = id;
    this.renderApplication();
  },

  executeFocusAndSelect(element) {
    element.focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  },

  updateSaveIndicator() {
    const lastSaved = localStorage.getItem('neural_tree_last_saved');
    if (lastSaved && this.els.saveIndicator) {
      const timeString = new Date(lastSaved).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      this.els.saveIndicator.textContent = `LAST_SAVED: ${timeString}`;
    }
  },

  setApplicationTheme(themeName) {
    document.body.dataset.theme = themeName;
    localStorage.setItem('neural_theme', themeName);
    
    document.querySelectorAll('.theme-dot').forEach(dot => {
      dot.classList.toggle('active', dot.dataset.setTheme === themeName);
    });
  },

  applyPersistentTheme() {
    const savedTheme = localStorage.getItem('neural_theme') || 'default';
    this.setApplicationTheme(savedTheme);
  },

  initiateDownload(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    this.notifyUser(`Exported ${filename}`);
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // ── EVENT BINDING ──

  attachEventListeners() {
    // Top-level actions
    document.getElementById('btn-add-root').onclick = () => app.addNodeToTree(null);
    document.getElementById('btn-clear-all').onclick = () => this.handleClearRequest();
    this.els.search.oninput = () => this.renderApplication();
    
    // Export actions
    document.getElementById('btn-copy').onclick = () => this.handleClipboardCopy();
    document.getElementById('btn-export-json').onclick = () => this.exportToJsonAsync();
    document.getElementById('btn-export-md').onclick = () => this.exportToMarkdownAsync();
    document.getElementById('btn-export-mmd').onclick = () => this.exportToMermaidAsync();
    document.getElementById('btn-import').onclick = () => this.handleImportRequest();
    document.getElementById('btn-shot').onclick = () => this.handleScreenshotRequest();
    document.getElementById('btn-print').onclick = () => window.print();

    // History and Keyboard
    document.getElementById('btn-undo').onclick = () => this.handleUndoRequest();
    document.getElementById('btn-redo').onclick = () => this.handleRedoRequest();
    document.getElementById('btn-expand-all').onclick = () => this.handleExpandAllToggle();
    window.addEventListener('keydown', (e) => this.handleGlobalKeydown(e));

    // UI elements
    document.querySelectorAll('[data-set-theme]').forEach(dot => {
      dot.onclick = () => this.setApplicationTheme(dot.dataset.setTheme);
    });

    this.attachDragAndDropEvents();
    this.attachPreviewClickEvents();
  },

  handleClearRequest() {
    if (!confirm("Reset everything?")) return;
    app.nodes = [{ id: '1', label: 'Main Topic', children: [], expanded: true }];
    app.idCounter = 2;
    this.activeNodeId = this.focusNodeId = null;
    app.persistStateToStorage();
    this.renderApplication();
  },

  handleClipboardCopy() {
    navigator.clipboard.writeText(this.els.ascii.innerText).then(() => {
      this.notifyUser("Copied Tree");
    });
  },

  handleImportRequest() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => this.executeImport(e.target.files[0]);
    input.click();
  },

  executeImport(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        app.nodes = Array.isArray(data) ? data : [data];
        app.synchronizeIdCounter();
        app.persistStateToStorage();
        this.renderApplication();
        this.notifyUser("Imported Successfully");
      } catch (error) {
        this.notifyUser("Invalid JSON File");
      }
    };
    reader.readAsText(file);
  },

  handleScreenshotRequest() {
    this.notifyUser("Rendering...");
    html2canvas(this.els.ascii, { 
      backgroundColor: getComputedStyle(document.body).getPropertyValue('--bg-surface'), 
      scale: 2 
    }).then(canvas => {
      const link = document.createElement('a');
      link.download = `tree-${Date.now()}.png`;
      link.href = canvas.toDataURL();
      link.click();
      this.notifyUser("Saved Image");
    });
  },

  handleUndoRequest() {
    if (app.undoAsync()) {
      this.renderApplication();
      this.notifyUser("Undo Action");
    }
  },

  handleRedoRequest() {
    if (app.redoAsync()) {
      this.renderApplication();
      this.notifyUser("Redo Action");
    }
  },

  handleExpandAllToggle() {
    const isCurrentlyExpanded = app.nodes[0].expanded;
    app.traverseNodes(node => node.expanded = !isCurrentlyExpanded);
    this.renderApplication();
  },

  handleGlobalKeydown(e) {
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); this.handleUndoRequest(); }
    if (e.ctrlKey && e.key === 'y') { e.preventDefault(); this.handleRedoRequest(); }
  },

  attachDragAndDropEvents() {
    this.els.ascii.ondragstart = (e) => {
      const nodeElement = e.target.closest('.node-text');
      if (nodeElement) {
        this.dragNodeId = nodeElement.dataset.id;
        nodeElement.classList.add('dragging');
      }
    };

    this.els.ascii.ondragend = () => {
      this.dragNodeId = this.previewTargetId = null;
      this.renderApplication();
    };

    this.els.ascii.ondragover = (e) => {
      e.preventDefault();
      const nodeElement = e.target.closest('.node-text');
      if (nodeElement && nodeElement.dataset.id !== this.dragNodeId) {
        if (this.previewTargetId !== nodeElement.dataset.id) {
          this.previewTargetId = nodeElement.dataset.id;
          this.renderNeuralPreview(this.previewTargetId, app.findNodeById(this.dragNodeId));
        }
      }
    };

    this.els.ascii.ondrop = (e) => {
      e.preventDefault();
      const targetElement = e.target.closest('.node-text');
      if (targetElement && this.dragNodeId) {
        app.relocateNodeSubtree(this.dragNodeId, targetElement.dataset.id);
      }
    };
  },

  attachPreviewClickEvents() {
    this.els.ascii.onclick = (e) => {
      const nodeElement = e.target.closest('.node-text');
      if (nodeElement) {
        this.activeNodeId = nodeElement.dataset.id;
        this.renderApplication();
        this.scrollToAndFocus(nodeElement.dataset.id);
      }
    };
  },

  scrollToAndFocus(nodeId) {
    setTimeout(() => {
      const row = document.querySelector(`.node-row[data-id="${nodeId}"]`);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        this.focusNodeForEditing(nodeId);
      }
    }, 100);
  }
};

window.UIController = UIController;
