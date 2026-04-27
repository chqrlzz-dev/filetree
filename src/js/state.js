'use strict';

/**
 * TreeManager Specialist
 * Responsibility: Handle the logical tree structure and persistence.
 */
class TreeManager {
  constructor() {
    this.nodes = [{ id: '1', label: 'Main Topic', children: [], expanded: true }];
    this.idCounter = 2;
    this.history = this.initializeHistory();
  }

  // ══════════════════════════════════════════════════
  // PUBLIC ORCHESTRATORS
  // ══════════════════════════════════════════════════

  loadStateFromStorage() {
    const savedState = localStorage.getItem('neural_tree_v6');
    if (!savedState) {
      this.recordHistory();
      return;
    }

    try {
      const parsed = JSON.parse(savedState);
      this.nodes = parsed.data;
      this.idCounter = parsed.counter;
    } catch (error) {
      console.error("Critical: Failed to parse tree state.", error);
    }

    this.synchronizeIdCounter();
    this.recordHistory();
  }

  persistStateToStorage(shouldRecordHistory = true) {
    const statePayload = { data: this.nodes, counter: this.idCounter };
    localStorage.setItem('neural_tree_v6', JSON.stringify(statePayload));
    localStorage.setItem('neural_tree_last_saved', new Date().toISOString());
    
    if (shouldRecordHistory) {
      this.recordHistory();
    }

    if (window.UIController) {
      window.UIController.refreshStatistics();
    }
  }

  addNodeToTree(parentId, siblingAfterId = null) {
    const newNode = this.createDefaultNode(parentId);
    
    if (this.isRootLevel(parentId)) {
      this.insertAtRoot(newNode, siblingAfterId);
    } else {
      this.insertAtParent(newNode, parentId, siblingAfterId);
    }

    if (window.UIController) {
      window.UIController.activeNodeId = newNode.id;
    }

    this.persistStateToStorage();
    UIController.renderApplication();
    setTimeout(() => UIController.focusNodeForEditing(newNode.id), 50);
  }

  removeNodeFromTree(nodeId) {
    const removalSuccessful = this.executeRecursiveRemoval(this.nodes, nodeId);
    if (!removalSuccessful) return;

    this.handlePostRemovalCleanup(nodeId);
    this.persistStateToStorage();
    UIController.renderApplication();
  }

  reorderNode(nodeId, direction) {
    const siblings = this.getNodeSiblings(nodeId);
    if (!siblings) return;

    const currentIndex = siblings.findIndex(node => node.id === nodeId);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (this.isMoveInvalid(siblings, targetIndex)) {
      UIController.notifyUser(`Already at ${direction}`);
      return;
    }

    this.swapArrayElements(siblings, currentIndex, targetIndex);
    this.persistStateToStorage();
    UIController.renderApplication();
  }

  relocateNodeSubtree(movingNodeId, targetNodeId) {
    if (movingNodeId === targetNodeId) return;

    const movingNode = this.findNodeById(movingNodeId);
    const targetNode = this.findNodeById(targetNodeId);

    if (!movingNode || !targetNode) return;
    if (this.isDescendant(movingNode, targetNodeId)) {
      UIController.notifyUser("Cannot move into descendant");
      return;
    }

    this.executeRelocation(movingNode, targetNode);
    this.persistStateToStorage();
    UIController.renderApplication();
  }

  // ══════════════════════════════════════════════════
  // PRIVATE SPECIALISTS
  // ══════════════════════════════════════════════════

  initializeHistory() {
    return {
      stack: [],
      index: -1,
      maxDepth: 50
    };
  }

  recordHistory() {
    this.history.stack = this.history.stack.slice(0, this.history.index + 1);
    this.history.stack.push(JSON.parse(JSON.stringify({ 
      data: this.nodes, 
      counter: this.idCounter 
    })));

    if (this.history.stack.length > this.history.maxDepth) {
      this.history.stack.shift();
    }
    this.history.index = this.history.stack.length - 1;
  }

  undoAsync() {
    if (this.history.index <= 0) return null;
    return this.applyHistoryState(this.history.stack[--this.history.index]);
  }

  redoAsync() {
    if (this.history.index >= this.history.stack.length - 1) return null;
    return this.applyHistoryState(this.history.stack[++this.history.index]);
  }

  applyHistoryState(state) {
    const deepCopy = JSON.parse(JSON.stringify(state));
    this.nodes = deepCopy.data;
    this.idCounter = deepCopy.counter;
    return true;
  }

  synchronizeIdCounter() {
    let maxId = 0;
    this.traverseNodes(node => {
      const idAsNumber = parseInt(node.id);
      if (!isNaN(idAsNumber)) maxId = Math.max(maxId, idAsNumber);
    });
    this.idCounter = maxId + 1;
  }

  traverseNodes(callback, nodes = this.nodes) {
    nodes.forEach(node => {
      callback(node);
      if (node.children) this.traverseNodes(callback, node.children);
    });
  }

  findNodeById(id, nodes = this.nodes) {
    for (const node of nodes) {
      if (node.id === id) return node;
      const foundInSubtree = this.findNodeById(id, node.children);
      if (foundInSubtree) return foundInSubtree;
    }
    return null;
  }

  findParentOfNode(childId, nodes = this.nodes, parent = null) {
    for (const node of nodes) {
      if (node.id === childId) return parent;
      const foundInSubtree = this.findParentOfNode(childId, node.children, node);
      if (foundInSubtree) return foundInSubtree;
    }
    return null;
  }

  createDefaultNode(parentId) {
    let label = "New Topic";
    if (!this.isRootLevel(parentId)) {
      const parentNode = this.findNodeById(parentId);
      label = parentNode ? `Subtopic of ${parentNode.label}` : label;
    } else {
      label = `Topic ${this.idCounter}`;
    }

    return { 
      id: String(this.idCounter++), 
      label, 
      children: [], 
      expanded: true 
    };
  }

  isRootLevel(id) {
    return id === null;
  }

  insertAtRoot(node, siblingAfterId) {
    if (siblingAfterId) {
      const index = this.nodes.findIndex(n => n.id === siblingAfterId);
      this.nodes.splice(index + 1, 0, node);
    } else {
      this.nodes.push(node);
    }
  }

  insertAtParent(node, parentId, siblingAfterId) {
    const parent = this.findNodeById(parentId);
    if (!parent) return;

    if (siblingAfterId) {
      const index = parent.children.findIndex(n => n.id === siblingAfterId);
      parent.children.splice(index + 1, 0, node);
    } else {
      parent.children.push(node);
    }
    parent.expanded = true;
  }

  executeRecursiveRemoval(nodeList, idToRemove) {
    const index = nodeList.findIndex(node => node.id === idToRemove);
    if (index !== -1) {
      nodeList.splice(index, 1);
      return true;
    }

    return nodeList.some(node => this.executeRecursiveRemoval(node.children, idToRemove));
  }

  handlePostRemovalCleanup(nodeId) {
    if (UIController.activeNodeId === nodeId) UIController.activeNodeId = null;
    if (UIController.focusNodeId === nodeId) UIController.focusNodeId = null;
  }

  getNodeSiblings(nodeId) {
    const parent = this.findParentOfNode(nodeId);
    return parent ? parent.children : this.nodes;
  }

  isMoveInvalid(siblings, targetIndex) {
    return targetIndex < 0 || targetIndex >= siblings.length;
  }

  swapArrayElements(array, indexA, indexB) {
    [array[indexA], array[indexB]] = [array[indexB], array[indexA]];
  }

  isDescendant(parentNode, targetId) {
    return parentNode.children.some(child => 
      child.id === targetId || this.isDescendant(child, targetId)
    );
  }

  executeRelocation(movingNode, targetNode) {
    const oldParent = this.findParentOfNode(movingNode.id);
    const siblings = oldParent ? oldParent.children : this.nodes;
    
    siblings.splice(siblings.findIndex(n => n.id === movingNode.id), 1);
    targetNode.children.push(movingNode);
    targetNode.expanded = true;
    UIController.activeNodeId = movingNode.id;
  }
}

window.TreeManager = TreeManager;
