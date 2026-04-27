'use strict';

/**
 * UIController Specialist
 * Responsibility: Orchestrate DOM interactions and visual rendering with strict Depth-based color logic.
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
    saveIndicator: document.getElementById('footer-save-indicator'),
    radialContainer: document.getElementById('radial-export-container')
  },

  // ══════════════════════════════════════════════════
  // PUBLIC ORCHESTRATORS
  // ══════════════════════════════════════════════════

  initializeApplication() {
    this.attachEventListeners();
    this.renderApplication();
  },

  renderApplication() {
    const draggingNode = this.dragNodeId ? app.findNodeById(this.dragNodeId) : null;
    
    this.renderSidebarList();
    this.renderTreePreview(this.previewTargetId, draggingNode);
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
    if (label) this.executeFocusAndSelect(label);
  },

  // ── SIDEBAR SPECIALISTS ──

  renderSidebarList() {
    this.els.nodesRoot.innerHTML = '';
    const searchTerm = this.els.search.value.toLowerCase();
    const rootNodes = this.focusNodeId ? [app.findNodeById(this.focusNodeId)] : app.nodes;
    
    this.buildSidebarRecursive(rootNodes, this.els.nodesRoot, searchTerm, 0);
  },

  buildSidebarRecursive(nodes, container, searchTerm, depth) {
    nodes.forEach((node, index) => {
      if (searchTerm && !this.nodeMatchesSearch(node, searchTerm)) return;
      
      const nodeColorIndex = depth % 12;
      
      const nodeWrapper = document.createElement('div');
      nodeWrapper.className = 'node-item';
      nodeWrapper.appendChild(this.createNodeRowElement(node, depth, nodeColorIndex));

      if (node.children.length > 0) {
        const childContainer = this.createChildContainer(node, searchTerm);
        this.buildSidebarRecursive(node.children, childContainer, searchTerm, depth + 1);
        nodeWrapper.appendChild(childContainer);
      }
      container.appendChild(nodeWrapper);
    });
  },

  createNodeRowElement(node, depth, colorIndex) {
    const row = document.createElement('div');
    row.className = `node-row ${this.activeNodeId === node.id ? 'active' : ''}`;
    row.dataset.id = node.id;
    row.onclick = (e) => this.handleNodeSelection(e, node);

    const expander = this.createExpanderElement(node);
    const label = this.createLabelElement(node, colorIndex);
    const actions = this.createActionsElement(node);

    row.append(expander, label, actions);
    return row;
  },

  createExpanderElement(node) {
    const expander = document.createElement('div');
    expander.className = `node-expander ${node.expanded ? 'expanded' : ''}`;
    expander.innerHTML = node.children.length > 0 
      ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${node.expanded ? '90deg' : '0deg'}); transition: transform 0.2s"><path d="M9 18l6-6-6-6"/></svg>` 
      : '';
    expander.onclick = (e) => { 
      e.stopPropagation(); 
      node.expanded = !node.expanded; 
      this.renderApplication(); 
    };
    return expander;
  },

  createLabelElement(node, colorIndex) {
    const label = document.createElement('div');
    label.className = `node-label depth-${colorIndex}`;
    label.contentEditable = true;
    label.textContent = node.label;
    
    label.onfocus = () => { this.activeNodeId = node.id; this.renderTreePreview(); };
    label.oninput = (e) => { 
      node.label = e.target.textContent || '...'; 
      this.renderTreePreview(); 
      this.refreshStatistics(); 
    };
    label.onblur = () => app.persistStateToStorage();
    
    return label;
  },

  createActionsElement(node) {
    const actions = document.createElement('div');
    actions.className = 'node-actions';
    actions.innerHTML = `
      <div class="flex gap-0.5 mr-1 border-r border-white/5 pr-1">
        <button class="btn btn-icon btn-move" title="Move Up" onclick="app.reorderNode('${node.id}', 'up')"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 15l-6-6-6 6"/></svg></button>
        <button class="btn btn-icon btn-move" title="Move Down" onclick="app.reorderNode('${node.id}', 'down')"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 9l6 6 6-6"/></svg></button>
      </div>
      <button class="btn btn-icon btn-focus" title="Isolate Branch" onclick="UIController.focusOnSubtree('${node.id}')"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg></button>
      <button class="btn btn-icon btn-add" title="Add Sub-topic" onclick="app.addNodeToTree('${node.id}')"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 5v14M5 12h14"/></svg></button>
      <button class="btn btn-icon btn-del" title="Delete Topic" onclick="app.removeNodeFromTree('${node.id}')"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
    `;
    return actions;
  },

  createChildContainer(node, searchTerm) {
    const container = document.createElement('div');
    container.className = `node-children ${node.expanded || searchTerm ? 'visible' : ''}`;
    return container;
  },

  // ── PREVIEW SPECIALISTS ──

  renderTreePreview(dropTargetId = null, draggingNode = null) {
    if (app.nodes.length === 0) {
      this.els.ascii.innerHTML = this.getEmptyPreviewPlaceholder();
      return;
    }

    const searchTerm = this.els.search.value.toLowerCase();
    const previewHtml = this.buildPreviewRecursive(app.nodes, [], true, true, 0, dropTargetId, draggingNode, searchTerm);
    
    this.els.ascii.innerHTML = `
      <div class="preview-controls">
        <button class="btn btn-icon" title="Copy Tree" onclick="UIController.handleClipboardCopy()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        </button>
      </div>
      ${previewHtml}
    `;
  },

  getEmptyPreviewPlaceholder() {
    return `<div class="text-center py-20 text-white/10 uppercase tracking-widest font-bold">Architecture Empty</div>`;
  },

  /**
   * Recursive ASCII Builder
   * @param {Array} nodes - Nodes to render
   * @param {Array} prefixData - Array of {char, colorClass} objects representing the line prefix
   */
  buildPreviewRecursive(nodes, prefixData, isLastSibling, isRoot, depth, dropTargetId, draggingNode, searchTerm) {
    let output = '';

    nodes.forEach((node, index) => {
      const isActuallyLast = index === nodes.length - 1;
      
      // Determine the specific color for THIS node's depth
      const myColorIndex = depth % 12;
      const myColorClass = `depth-${myColorIndex}`;

      // 1. Generate the node line
      output += this.generateNodeHtml(node, prefixData, isActuallyLast, isRoot, myColorClass, searchTerm);
      
      // 2. Handle Drag/Drop Ghost
      if (node.id === dropTargetId && draggingNode) {
        const ghostPrefix = isRoot ? [] : [...prefixData, { char: isActuallyLast ? '   ' : '│  ', colorClass: myColorClass }];
        output += this.buildPreviewRecursive([draggingNode], ghostPrefix, true, false, depth + 1, null, null, searchTerm);
      }

      // 3. Recursive Children
      if (node.children.length > 0 && node.expanded) {
        // Vertical line added here belongs to THIS depth.
        // It maintains its color in the prefix of all children.
        const nextPrefixData = isRoot ? [] : [...prefixData, { 
          char: isActuallyLast ? '   ' : '│  ', 
          colorClass: myColorClass 
        }];
        
        output += this.buildPreviewRecursive(node.children, nextPrefixData, isActuallyLast, false, depth + 1, dropTargetId, draggingNode, searchTerm);
        
        // "Shared |" logic: Add visual spacing after deep branches with the depth color
        if (depth === 0 && !isActuallyLast) {
          output += `<span class="branch ${myColorClass}">│</span>\n`;
        }
      }
    });

    return output;
  },

  generateNodeHtml(node, prefixData, isActuallyLast, isRoot, colorClass, searchTerm) {
    const highlightClass = this.activeNodeId === node.id ? 'highlight' : '';
    const draggingClass = this.dragNodeId === node.id ? 'dragging' : '';
    const rootClass = isRoot ? 'root-node' : '';
    
    let labelDisplay = this.escapeHtml(node.label);
    if (searchTerm && node.label.toLowerCase().includes(searchTerm)) {
      labelDisplay = `<span class="search-match">${labelDisplay}</span>`;
    }

    // Prefix: Each segment uses the color of its OWN branch owner
    const prefixHtml = prefixData.map(p => `<span class="branch ${p.colorClass}">${p.char}</span>`).join('');

    // Connector: Belongs to the current node
    const connector = isRoot ? '' : (isActuallyLast ? '└─ ' : '├─ ');

    return `<span class="branch-wrap">${prefixHtml}<span class="branch ${colorClass}">${connector}</span></span><span class="${rootClass} ${highlightClass} ${draggingClass} ${colorClass} node-text" data-id="${node.id}" draggable="true">${labelDisplay}</span>\n`;
  },

  // ── EXPORT SPECIALISTS ──

  exportToMarkdownAsync() {
    let md = '';
    const build = (nodes, d) => {
      nodes.forEach(n => {
        md += `${'  '.repeat(d)}- ${n.label}\n`;
        if (n.children.length) build(n.children, d + 1);
      });
    };
    build(app.nodes, 0);
    this.initiateDownload(md, 'architecture.md');
  },

  exportToMermaidAsync() {
    let mm = 'graph TD\n';
    const build = (nodes) => {
      nodes.forEach(n => {
        const p = app.findParentOfNode(n.id);
        if (p) mm += `  ${p.id}["${p.label}"] --> ${n.id}["${n.label}"]\n`;
        else mm += `  ${n.id}["${n.label}"]\n`;
        if (n.children.length) build(n.children);
      });
    };
    build(app.nodes);
    this.initiateDownload(mm, 'diagram.mmd');
  },

  exportToJsonAsync() {
    this.initiateDownload(JSON.stringify(app.nodes, null, 2), 'source.json');
  },

  refreshStatistics() {
    let count = 0, maxD = 0;
    app.traverseNodes(n => {
      count++;
      maxD = Math.max(maxD, this.calculateNodeDepth(n.id) + 1);
    });
    this.els.stats.nodes.textContent = `NODES: ${count}`;
    this.els.stats.depth.textContent = `DEPTH: ${maxD}`;
    this.updateSaveIndicator();
  },

  renderBreadcrumbNavigation() {
    if (!this.focusNodeId) { this.els.breadcrumb.style.display = 'none'; return; }
    this.els.breadcrumb.style.display = 'flex';
    this.els.breadcrumb.innerHTML = '';
    const path = [];
    let cur = app.findNodeById(this.focusNodeId);
    while (cur) { path.unshift(cur); cur = app.findParentOfNode(cur.id); }
    
    const rootItem = this.createBreadcrumbItem('Root', null);
    this.els.breadcrumb.appendChild(rootItem);
    path.forEach(n => {
      const sep = document.createElement('span');
      sep.className = 'mx-1 opacity-20'; sep.textContent = '/';
      this.els.breadcrumb.append(sep, this.createBreadcrumbItem(n.label, n.id));
    });
  },

  createBreadcrumbItem(text, id) {
    const span = document.createElement('span');
    span.className = 'cursor-pointer hover:text-white transition-colors';
    span.textContent = text;
    span.onclick = () => { this.focusNodeId = id; this.renderApplication(); };
    return span;
  },

  handleNodeSelection(e, node) {
    if (e.target.classList.contains('node-label') || e.target.closest('button')) return;
    this.activeNodeId = node.id;
    this.renderApplication();
  },

  nodeMatchesSearch(node, term) {
    if (node.label.toLowerCase().includes(term)) return true;
    return node.children.some(child => this.nodeMatchesSearch(child, term));
  },

  calculateNodeDepth(id) {
    let d = 0;
    let cur = app.findNodeById(id);
    while (cur && (cur = app.findParentOfNode(cur.id))) d++;
    return d;
  },

  focusOnSubtree(id) { this.focusNodeId = id; this.renderApplication(); },

  executeFocusAndSelect(el) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  },

  updateSaveIndicator() {
    const last = localStorage.getItem('tree_architect_last_saved');
    if (last && this.els.saveIndicator) {
      this.els.saveIndicator.textContent = `Auto-saved: ${new Date(last).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    }
  },

  attachEventListeners() {
    document.getElementById('btn-add-root').onclick = () => app.addNodeToTree(null);
    document.getElementById('btn-clear-all').onclick = () => this.handleClearRequest();
    this.els.search.oninput = () => this.renderApplication();
    document.getElementById('btn-copy').onclick = () => this.handleClipboardCopy();
    document.getElementById('btn-export-json').onclick = () => this.exportToJsonAsync();
    document.getElementById('btn-export-md').onclick = () => this.exportToMarkdownAsync();
    document.getElementById('btn-export-mmd').onclick = () => this.exportToMermaidAsync();
    document.getElementById('btn-import').onclick = () => this.handleImportRequest();
    document.getElementById('btn-shot').onclick = () => this.handleScreenshotRequest();
    document.getElementById('btn-export-radial').onclick = () => this.handleRadialExport();
    document.getElementById('btn-print').onclick = () => window.print();
    document.getElementById('btn-undo').onclick = () => this.handleUndoRequest();
    document.getElementById('btn-redo').onclick = () => this.handleRedoRequest();
    document.getElementById('btn-expand-all').onclick = () => this.handleExpandAllToggle();
    window.onkeydown = (e) => {
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); this.handleUndoRequest(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); this.handleRedoRequest(); }
    };
    this.attachDragAndDropEvents();
    this.attachPreviewClickEvents();
  },

  handleClearRequest() {
    if (!confirm("Reset the entire architecture?")) return;
    app.nodes = [{ id: '1', label: 'Architecture Root', children: [], expanded: true }];
    app.idCounter = 2;
    this.activeNodeId = this.focusNodeId = null;
    app.persistStateToStorage();
    this.renderApplication();
  },

  handleClipboardCopy() {
    const temp = document.createElement('div');
    temp.innerHTML = this.els.ascii.innerHTML;
    const controls = temp.querySelector('.preview-controls');
    if (controls) controls.remove();
    navigator.clipboard.writeText(temp.innerText.trim()).then(() => this.notifyUser("Copied to clipboard"));
  },

  handleImportRequest() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          app.nodes = Array.isArray(data) ? data : [data];
          app.synchronizeIdCounter();
          app.persistStateToStorage();
          this.renderApplication();
          this.notifyUser("Imported successfully");
        } catch (err) { this.notifyUser("Invalid JSON"); }
      };
      reader.readAsText(e.target.files[0]);
    };
    input.click();
  },

  handleScreenshotRequest() {
    this.notifyUser("Capturing render...");
    const controls = this.els.ascii.querySelector('.preview-controls');
    if (controls) controls.style.visibility = 'hidden';
    domtoimage.toPng(this.els.ascii, { bgcolor: '#111111' }).then((url) => {
      if (controls) controls.style.visibility = 'visible';
      const link = document.createElement('a');
      link.download = `architecture-${Date.now()}.png`; link.href = url; link.click();
      this.notifyUser("Image saved");
    });
  },

  handleRadialExport() {
    this.notifyUser("Generating Radial Mind Map...");
    this.els.radialContainer.innerHTML = '';
    
    const width = 1600;
    const height = 1600;
    const radius = width / 2;
    
    const data = { 
      label: "Architecture", 
      children: JSON.parse(JSON.stringify(app.nodes)) 
    };
    
    const tree = d3.tree().size([2 * Math.PI, radius - 250]);
    const root = d3.hierarchy(data);
    tree(root);

    const svg = d3.select(this.els.radialContainer).append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("background-color", "#0a0a0a")
        .append("g")
        .attr("transform", `translate(${width/2},${height/2})`);

    // Links
    svg.append("g")
        .attr("fill", "none")
        .attr("stroke", "#333")
        .attr("stroke-opacity", 0.4)
        .attr("stroke-width", 1.5)
      .selectAll("path")
      .data(root.links())
      .join("path")
        .attr("d", d3.linkRadial()
            .angle(d => d.x)
            .radius(d => d.y));

    // Nodes
    const node = svg.append("g")
      .selectAll("g")
      .data(root.descendants())
      .join("g")
        .attr("transform", d => `rotate(${(d.x * 180 / Math.PI - 90)}) translate(${d.y},0)`);

    node.append("circle")
        .attr("fill", d => d.children ? "#fff" : "#555")
        .attr("r", 4);

    node.append("text")
        .attr("transform", d => `rotate(${d.x >= Math.PI ? 180 : 0})`)
        .attr("dy", "0.31em")
        .attr("x", d => d.x < Math.PI === !d.children ? 8 : -8)
        .attr("text-anchor", d => d.x < Math.PI === !d.children ? "start" : "end")
        .attr("paint-order", "stroke")
        .attr("stroke", "#000")
        .attr("stroke-width", 3)
        .attr("fill", "#fff")
        .style("font-family", "Outfit, sans-serif")
        .style("font-size", "14px")
        .text(d => d.data.label);

    // Give D3 a moment to finalize DOM before capture
    setTimeout(() => {
      // Temporarily make container visible for capture if needed by the library
      const originalVisibility = this.els.radialContainer.style.visibility;
      this.els.radialContainer.style.visibility = 'visible';

      domtoimage.toPng(this.els.radialContainer, {
        width: width,
        height: height,
        bgcolor: '#0a0a0a'
      }).then((url) => {
        this.els.radialContainer.style.visibility = originalVisibility;
        const link = document.createElement('a');
        link.download = `radial-map-${Date.now()}.png`;
        link.href = url;
        link.click();
        this.notifyUser("Radial map exported");
      }).catch(err => {
        this.els.radialContainer.style.visibility = originalVisibility;
        console.error("Radial export failed", err);
        this.notifyUser("Export failed");
      });
    }, 800);
  },

  handleUndoRequest() {
    if (app.undoAsync()) { this.renderApplication(); this.notifyUser("Undo performed"); }
    else this.notifyUser("Nothing to undo");
  },

  handleRedoRequest() {
    if (app.redoAsync()) { this.renderApplication(); this.notifyUser("Redo performed"); }
    else this.notifyUser("Nothing to redo");
  },

  handleExpandAllToggle() {
    let anyCollapsed = false;
    app.traverseNodes(n => { if (!n.expanded) anyCollapsed = true; });
    const target = anyCollapsed;
    app.traverseNodes(n => { n.expanded = target; });
    this.renderApplication();
    this.notifyUser(target ? "Expanded all" : "Collapsed all");
  },

  attachDragAndDropEvents() {
    // 1. Mouse down fallback to ensure draggable is active
    this.els.ascii.addEventListener('mousedown', (e) => {
      const el = e.target.closest('.node-text');
      if (el) el.setAttribute('draggable', 'true');
    });

    // 2. Drag Start
    this.els.ascii.addEventListener('dragstart', (e) => {
      const el = e.target.closest('.node-text');
      if (el) {
        this.dragNodeId = el.dataset.id;
        el.classList.add('dragging');
        
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', el.dataset.id);
        
        // Custom drag image or behavior can go here
        setTimeout(() => el.style.opacity = '0.3', 0);
      }
    });

    // 3. Drag End
    this.els.ascii.addEventListener('dragend', (e) => {
      const el = e.target.closest('.node-text');
      if (el) {
        el.classList.remove('dragging');
        el.style.opacity = '1';
      }
      this.dragNodeId = null;
      this.previewTargetId = null;
      this.renderApplication();
    });

    // 4. Drag Over
    this.els.ascii.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      const el = e.target.closest('.node-text');
      if (el && el.dataset.id !== this.dragNodeId) {
        if (this.previewTargetId !== el.dataset.id) {
          this.previewTargetId = el.dataset.id;
          this.renderTreePreview(this.previewTargetId, app.findNodeById(this.dragNodeId));
        }
      } else if (!el && this.previewTargetId !== null) {
        this.previewTargetId = null;
        this.renderTreePreview();
      }
    });

    // 5. Drop
    this.els.ascii.addEventListener('drop', (e) => {
      e.preventDefault();
      const el = e.target.closest('.node-text');
      if (el && this.dragNodeId && this.dragNodeId !== el.dataset.id) {
        app.relocateNodeSubtree(this.dragNodeId, el.dataset.id);
      }
      this.dragNodeId = null;
      this.previewTargetId = null;
    });

    window.addEventListener('dragover', (e) => e.preventDefault(), false);
    window.addEventListener('drop', (e) => e.preventDefault(), false);
  },

  attachPreviewClickEvents() {
    this.els.ascii.onclick = (e) => {
      const el = e.target.closest('.node-text');
      if (el) { this.activeNodeId = el.dataset.id; this.renderApplication(); this.scrollToAndFocus(el.dataset.id); }
    };
  },

  scrollToAndFocus(id) {
    setTimeout(() => {
      const row = document.querySelector(`.node-row[data-id="${id}"]`);
      if (row) { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); this.focusNodeForEditing(id); }
    }, 100);
  },

  initiateDownload(content, filename) {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    this.notifyUser(`Exported ${filename}`);
  },

  escapeHtml(text) {
    const div = document.createElement('div'); div.textContent = text; return div.innerHTML;
  }
};

window.UIController = UIController;
