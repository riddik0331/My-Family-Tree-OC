/* ============================================================
   Family Tree - Client Application Logic (Vanilla JS, ES6)
   ============================================================ */

/* ----------------------------------------------------------
   Constants & Configuration
   ---------------------------------------------------------- */
const STORAGE_KEY = "family-tree-forest";
const CURRENT_DEMO_VERSION = "2026-04-04-family-structure-v2";
const NODE_W = 100;  // node width in px
const NODE_H = 60;   // node height in px
const GEN_GAP = 170; // vertical gap between generations
const CARD_GAP = 10; // horizontal gap between cards

/* ----------------------------------------------------------
   Utility Functions
   ---------------------------------------------------------- */
function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $$(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }
const el = (tag, attrs = {}, ...children) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'dataset' && typeof v === 'object') Object.assign(e.dataset, v);
    else e.setAttribute(k, v);
  }
  for (const ch of children) {
    if (ch != null) e.append(typeof ch === 'string' ? document.createTextNode(ch) : ch);
  }
  return e;
};

/* ----------------------------------------------------------
   State
   ---------------------------------------------------------- */
let forest = [];       // Array of Tree
let activeTreeId = null;
let selectedMemberId = null;

/* ----------------------------------------------------------
   DOM References
   ---------------------------------------------------------- */
const dom = {};

function cacheDom() {
  dom.treeSelect = $('#tree-select');
  dom.btnNewTree = $('#btn-new-tree');
  dom.btnRenameTree = $('#btn-rename-tree');
  dom.btnDeleteTree = $('#btn-delete-tree');
  dom.btnLoadDemo = $('#btn-load-demo');
  dom.btnExportJson = $('#btn-export-json');
  dom.btnImportJson = $('#btn-import-json');
  dom.importJsonInput = $('#import-json-input');
  dom.btnExportSvg = $('#btn-export-svg');
  dom.btnExportSvgPrint = $('#btn-export-svg-print');
  dom.btnAddMember = $('#btn-add-member');
  dom.searchInput = $('#search-input');
  dom.btnClearSearch = $('#btn-clear-search');
  dom.btnResetView = $('#btn-reset-view');
  dom.treeNodes = $('#tree-nodes');
  dom.treeSvg = $('#tree-svg');
  dom.treeArea = $('#tree-area');
  dom.treeScroll = $('#tree-scroll');
  dom.treeEmpty = $('#tree-empty');
  dom.scrollLeft = $('#scroll-left');
  dom.scrollRight = $('#scroll-right');
  // Detail panel
  dom.detailPanel = $('#detail-panel');
  dom.detailEmpty = $('#detail-empty');
  dom.detailContent = $('#detail-content');
  dom.detailPhoto = $('#detail-photo');
  dom.detailPhotoPlaceholder = $('#detail-photo-placeholder');
  dom.detailName = $('#detail-name');
  dom.detailMeta = $('#detail-meta');
  dom.detailBio = $('#detail-bio');
  dom.detailHighlights = $('#detail-highlights');
  dom.detailConnections = $('#detail-connections');
  dom.detailVideoSection = $('#detail-video-section');
  dom.detailVideo = $('#detail-video');
  dom.btnEditMember = $('#btn-edit-member');
  dom.btnDeleteMember = $('#btn-delete-member');
  // Modal
  dom.modalOverlay = $('#modal-overlay');
  dom.modalTitle = $('#modal-title');
  dom.modalClose = $('#modal-close');
  dom.btnFormCancel = $('#btn-form-cancel');
  dom.btnFormSave = $('#btn-form-save');
  dom.memberForm = $('#member-form');
  // Form fields
  dom.fieldId = $('#field-id');
  dom.fieldName = $('#field-name');
  dom.fieldGender = $('#field-gender');
  dom.fieldMaidenName = $('#field-maiden-name');
  dom.fieldFamilyBranch = $('#field-family-branch');
  dom.fieldBirthDate = $('#field-birth-date');
  dom.fieldDeathDate = $('#field-death-date');
  dom.fieldGeneration = $('#field-generation');
  dom.fieldLocation = $('#field-location');
  dom.fieldBirthPlace = $('#field-birth-place');
  dom.fieldMother = $('#field-mother');
  dom.fieldFather = $('#field-father');
  dom.fieldPartner = $('#field-partner');
  dom.fieldBio = $('#field-bio');
  dom.highlightsContainer = $('#highlights-container');
  dom.btnAddHighlight = $('#btn-add-highlight');
  dom.fieldPhoto = $('#field-photo');
  dom.fieldPhotoPath = $('#field-photo-path');
  dom.fieldPhotoPreview = $('#field-photo-preview');
  dom.btnClearPhoto = $('#btn-clear-photo');
  dom.fieldVideo = $('#field-video');
  dom.fieldVideoPath = $('#field-video-path');
  dom.btnClearVideo = $('#btn-clear-video');
  // Photo preview popup
  dom.photoPreviewPopup = $('#photo-preview-popup');
  dom.photoPreviewImg = $('#photo-preview-img');
}

/* ----------------------------------------------------------
   Forest Operations (server + localStorage fallback)
   ---------------------------------------------------------- */
async function loadForest() {
  try {
    const res = await fetch('/api/data');
    const data = await res.json();
    if (data.forest && data.forest.length) {
      forest = data.forest;
      forest.forEach(t => { if (!t.nodePositions) t.nodePositions = {}; });
      activeTreeId = data.activeTreeId || forest[0].id;
      return;
    }
  } catch (e) { /* server not available, try localStorage */ }

  // Fallback: localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      forest = JSON.parse(raw);
      forest.forEach(t => { if (!t.nodePositions) t.nodePositions = {}; });
    }
  } catch (e) { forest = []; }
  if (!forest.length) {
    const defaultTree = createTreeData("Моя семья");
    forest.push(defaultTree);
    activeTreeId = defaultTree.id;
    saveForest();
  }
}

function saveForest() {
  const payload = JSON.stringify({ forest, activeTreeId });
  // Save to server (async, fire-and-forget)
  fetch('/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload
  }).catch(() => {});
  // Keep localStorage as backup
  try { localStorage.setItem(STORAGE_KEY, payload); } catch (e) {}
}

function getActiveTree() {
  return forest.find(t => t.id === activeTreeId) || forest[0];
}

function getMember(tree, id) {
  return tree.members.find(m => m.id === id);
}

/* ----------------------------------------------------------
   Tree CRUD
   ---------------------------------------------------------- */
function createTreeData(name) {
  return {
    id: uuid(),
    name,
    members: [],
    nodePositions: {},
    selectedId: null
  };
}

function createTree(name) {
  const tree = createTreeData(name);
  forest.push(tree);
  saveForest();
  return tree;
}

function deleteTree(id) {
  if (forest.length <= 1) return;
  forest = forest.filter(t => t.id !== id);
  if (activeTreeId === id) activeTreeId = forest[0].id;
  saveForest();
}

function switchTree(id) {
  activeTreeId = id;
  const tree = getActiveTree();
  selectedMemberId = tree.selectedId || null;
  saveForest();
  renderAll();
}

/* ----------------------------------------------------------
   Member CRUD
   ---------------------------------------------------------- */
function createMember(data) {
  const member = {
    id: data.id || uuid(),
    name: data.name || '',
    relationType: data.relationType || 'relative',
    gender: data.gender || '',
    maidenName: data.maidenName || '',
    years: data.years || (data.birthDate ? data.birthDate + (data.deathDate ? ` — ${data.deathDate}` : '') : ''),
    birthDate: data.birthDate || '',
    deathDate: data.deathDate || '',
    location: data.location || '',
    birthPlace: data.birthPlace || '',
    familyBranch: data.familyBranch || '',
    kinship: data.kinship || '',
    generation: parseInt(data.generation) || 1,
    motherId: data.motherId || '',
    fatherId: data.fatherId || '',
    partnerId: data.partnerId || '',
    childrenIds: data.childrenIds || [],
    bio: data.bio || '',
    highlights: data.highlights || [],
    photo: data.photo || '',
    video: data.video || ''
  };
  return member;
}

function addMember(tree, data) {
  const member = createMember(data);
  tree.members.push(member);
  recalculateGenerations(tree);
  saveForest();
  return member;
}

function updateMember(tree, id, data) {
  const idx = tree.members.findIndex(m => m.id === id);
  if (idx === -1) return null;
  const member = { ...tree.members[idx], ...data, id };
  tree.members[idx] = member;
  recalculateGenerations(tree);
  saveForest();
  return member;
}

function deleteMember(tree, id) {
  const member = getMember(tree, id);
  if (!member) return;
  // Remove references from other members
  tree.members.forEach(m => {
    if (m.motherId === id) m.motherId = '';
    if (m.fatherId === id) m.fatherId = '';
    if (m.partnerId === id) m.partnerId = '';
    m.childrenIds = m.childrenIds.filter(cid => cid !== id);
  });
  // Remove from nodePositions
  delete tree.nodePositions[id];
  tree.members = tree.members.filter(m => m.id !== id);
  recalculateGenerations(tree);
  if (tree.selectedId === id) tree.selectedId = null;
  saveForest();
}

/* ----------------------------------------------------------
   Generation Recalculation
   ---------------------------------------------------------- */
function recalculateGenerations(tree) {
  if (!tree.members.length) return;
  const maxIter = tree.members.length + 3;
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (const m of tree.members) {
      // Если нет родителей — не трогаем поколение (пользователь установил вручную)
      if (!m.motherId && !m.fatherId) continue;
      let gen = 1;
      if (m.motherId) {
        const mother = getMember(tree, m.motherId);
        if (mother) gen = Math.max(gen, mother.generation + 1);
      }
      if (m.fatherId) {
        const father = getMember(tree, m.fatherId);
        if (father) gen = Math.max(gen, father.generation + 1);
      }
      // Партнёры должны быть на одном уровне (без +1 — они не родители)
      if (m.partnerId) {
        const partner = getMember(tree, m.partnerId);
        if (partner) gen = Math.max(gen, partner.generation);
      }
      if (gen !== m.generation) { m.generation = gen; changed = true; }
    }
    // Sync partner generations — обоюдный max, чтобы не тянуть вниз
    for (const m of tree.members) {
      if (m.partnerId) {
        const partner = getMember(tree, m.partnerId);
        if (partner && partner.generation !== m.generation) {
          const maxGen = Math.max(partner.generation, m.generation);
          partner.generation = maxGen;
          m.generation = maxGen;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  // Clamp
  tree.members.forEach(m => { m.generation = Math.min(8, Math.max(1, m.generation)); });
}

/* ----------------------------------------------------------
   Auto Layout
   ---------------------------------------------------------- */
function getDefaultTreeLayout(tree, filterFn) {
  const positions = {};
  const filtered = tree.members.filter(filterFn || (() => true));
  if (!filtered.length) return positions;

  // Group by generation
  const byGen = {};
  filtered.forEach(m => {
    const g = m.generation || 1;
    if (!byGen[g]) byGen[g] = [];
    byGen[g].push(m);
  });

  const gens = Object.keys(byGen).map(Number).sort((a, b) => a - b);
  const maxGen = gens.length ? gens[gens.length - 1] : 1;

    // Calculate Y for each generation (center vertically)
    const totalHeight = (maxGen) * GEN_GAP + NODE_H;
    const offsetY = 20;

    for (const gen of gens) {
      const members = byGen[gen];
      // Group by family (parent pair or partner pair)
      const families = [];
      const used = new Set();
      for (const m of members) {
        if (used.has(m.id)) continue;
        // Partner pair
        if (m.partnerId) {
          const partner = getMember(tree, m.partnerId);
          if (partner && byGen[gen] && byGen[gen].some(p => p.id === partner.id)) {
            families.push([m, partner]);
            used.add(m.id);
            used.add(partner.id);
            continue;
          }
        }
        families.push([m]);
        used.add(m.id);
      }

      // Calculate X positions for each family
      let x = 44;
      // gen=1 (старшее поколение) — вверху; чем больше gen, тем ниже
      const y = offsetY + (gen - 1) * GEN_GAP;

      for (const family of families) {
        const fWidth = family.length * NODE_W + (family.length - 1) * CARD_GAP;
      // Center the family group
      let fx = x;
      for (const m of family) {
        const savedPos = tree.nodePositions[m.id];
        const px = savedPos && savedPos.x !== undefined ? savedPos.x : fx;
        positions[m.id] = { x: px, y };
        tree.nodePositions[m.id] = { x: px, y };
        fx += NODE_W + CARD_GAP;
      }
      x += fWidth + 44;
    }
  }

  return positions;
}

/* ----------------------------------------------------------
   Render Tree
   ---------------------------------------------------------- */
let _dragState = null;

function renderAll() {
  const tree = getActiveTree();
  if (!tree) return;

  // Update tree select
  updateTreeSelect();

  // Update empty state
  if (!tree.members.length) {
    dom.treeEmpty.style.display = 'block';
    dom.treeNodes.innerHTML = '';
    dom.treeSvg.innerHTML = '';
    dom.detailContent.style.display = 'none';
    dom.detailEmpty.style.display = 'flex';
    return;
  }
  dom.treeEmpty.style.display = 'none';

  // Search filter
  const searchVal = dom.searchInput.value.trim().toLowerCase();

  const filterFn = (m) => {
    if (searchVal) {
      return m.name.toLowerCase().includes(searchVal) ||
             m.location.toLowerCase().includes(searchVal) ||
             m.familyBranch.toLowerCase().includes(searchVal) ||
             (m.kinship || '').toLowerCase().includes(searchVal);
    }
    return true;
  };

  const positions = getDefaultTreeLayout(tree, m => filterFn(m));
  renderNodes(tree, positions, filterFn);
  renderLinks(tree, positions, filterFn);

  // Highlight selected
  if (selectedMemberId) {
    const node = $(`[data-id="${selectedMemberId}"]`);
    if (node) node.classList.add('selected');
    showDetail(tree, selectedMemberId);
  } else {
    dom.detailContent.style.display = 'none';
    dom.detailEmpty.style.display = 'flex';
  }
}

function renderNodes(tree, positions, filterFn) {
  dom.treeNodes.innerHTML = '';
  // Возвращаем SVG обратно в tree-nodes (он был очищен innerHTML)
  dom.treeNodes.appendChild(dom.treeSvg);

  // Generation labels
  const byGen = {};
  tree.members.forEach(m => {
    if (!filterFn || filterFn(m)) {
      const g = m.generation || 1;
      if (!byGen[g]) byGen[g] = [];
      byGen[g].push(m);
    }
  });

  const gens = Object.keys(byGen).map(Number).sort((a, b) => a - b);
  const maxGen = gens.length ? gens[gens.length - 1] : 1;

  for (const gen of gens) {
    const first = byGen[gen][0];
    const pos = positions[first.id];
    if (pos) {
      const label = el('div', {
        className: 'generation-label',
        style: { top: `${pos.y + NODE_H/2 - 30}px`, left: '4px' }
      }, `Поколение ${gen}`);
      dom.treeNodes.appendChild(label);
    }
  }

  // Nodes
  for (const m of tree.members) {
    if (filterFn && !filterFn(m)) continue;
    const pos = positions[m.id];
    if (!pos) continue;

    const genderIcon = m.gender === 'female' ? '♀' : m.gender === 'male' ? '♂' : '👤';
    const nameParts = m.name.split(' ');
    const shortName = nameParts.length > 1 ? `${nameParts[0]} ${nameParts[1][0]}.` : m.name;

    const node = el('div', {
      className: `tree-node ${m.gender || 'other'}`,
      dataset: { id: m.id },
      style: {
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${NODE_W}px`
      }
    },
      el('span', { className: 'node-gender-icon' }, genderIcon),
      el('div', { className: 'node-name' }, shortName),
      m.years ? el('div', { className: 'node-years' }, m.years) : null
    );

    node.addEventListener('click', (e) => {
      e.stopPropagation();
      selectMember(tree, m.id);
    });

    // Drag-and-drop
    node.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const startX = e.clientX;
      const startLeft = parseFloat(node.style.left);
      _dragState = { node, startX, startLeft, id: m.id, moved: false };
    });

    dom.treeNodes.appendChild(node);
  }

  // Set scroll container size (отталкиваемся от реальных позиций, а не от количества поколений)
  const maxX = Math.max(...Object.values(positions).map(p => p.x + NODE_W + 44), 800);
  const maxY = Math.max(...Object.values(positions).map(p => p.y + NODE_H + 60), 600);
  dom.treeNodes.style.width = `${maxX}px`;
  dom.treeNodes.style.height = `${maxY}px`;
}

function renderLinks(tree, positions, filterFn) {
  const svg = dom.treeSvg;
  svg.innerHTML = '';
  svg.setAttribute('width', dom.treeNodes.style.width || '100%');
  svg.setAttribute('height', dom.treeNodes.style.height || '100%');

  const visibleIds = new Set(
    tree.members.filter(m => !filterFn || filterFn(m)).map(m => m.id)
  );

  const ns = 'http://www.w3.org/2000/svg';

  // Family map: motherId+fatherId -> children
  const familyMap = {};
  for (const m of tree.members) {
    if (!filterFn || filterFn(m)) {
      const key = `${m.motherId}|${m.fatherId}`;
      if (!familyMap[key]) familyMap[key] = [];
      familyMap[key].push(m);
    }
  }

  // For each family: draw parent bus -> lines to children
  for (const [key, children] of Object.entries(familyMap)) {
    const [motherId, fatherId] = key.split('|');
    const parentIds = [motherId, fatherId].filter(Boolean);
    const visibleChildren = children.filter(c => visibleIds.has(c.id));
    if (!visibleChildren.length) continue;

    const parentNodes = parentIds.map(id => positions[id]).filter(Boolean);
    if (!parentNodes.length) {
      // No parent nodes, just children
      continue;
    }

    // Parent bus line — горизонтальная шина над детьми,
    // соединяет вертикальные линии от родителей
    const childPositions = visibleChildren.map(c => positions[c.id]).filter(Boolean);
    if (!childPositions.length) continue;

    // Y шины — чуть выше верхнего ребёнка
    const busY = Math.min(...childPositions.map(p => p.y)) - 15;

    // X шины — от левого родителя до правого ребёнка (или правого родителя)
    const allBusXs = [
      ...childPositions.map(p => p.x + NODE_W / 2),
      ...parentNodes.map(p => p.x + NODE_W / 2)
    ];
    const busMinX = Math.min(...allBusXs);
    const busMaxX = Math.max(...allBusXs);

    // Горизонтальная шина (рисуем всегда, если есть разброс по X)
    if (busMaxX - busMinX > 1) {
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', busMinX);
      line.setAttribute('y1', busY);
      line.setAttribute('x2', busMaxX);
      line.setAttribute('y2', busY);
      line.classList.add('tree-link');
      svg.appendChild(line);
    }

    // Вертикальные линии от шины вниз к каждому ребёнку
    for (const child of visibleChildren) {
      const cp = positions[child.id];
      if (!cp) continue;
      const cx = cp.x + NODE_W / 2;
      const cy = cp.y;
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', cx);
      line.setAttribute('y1', busY);
      line.setAttribute('x2', cx);
      line.setAttribute('y2', cy);
      line.classList.add('tree-link');
      svg.appendChild(line);
    }

    // Вертикальные линии от родителей вниз к шине
    for (const pid of parentIds) {
      const pp = positions[pid];
      if (!pp) continue;
      const px = pp.x + NODE_W / 2;
      const py = pp.y + NODE_H;
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', px);
      line.setAttribute('y1', py);
      line.setAttribute('x2', px);
      line.setAttribute('y2', busY);
      line.classList.add('tree-link');
      svg.appendChild(line);
    }
  }

  // Partner links
  for (const m of tree.members) {
    if (!filterFn || !filterFn(m)) continue;
    if (!m.partnerId) continue;
    const partner = getMember(tree, m.partnerId);
    if (!partner) continue;
    const mp = positions[m.id];
    const pp = positions[partner.id];
    if (!mp || !pp) continue;
    // Only draw if both visible
    if (!visibleIds.has(m.id) || !visibleIds.has(partner.id)) continue;
    // Draw only once (m.id < partner.id)
    if (m.id >= partner.id) continue;

    // Строго горизонтальная линия между правым краем левого партнёра
    // и левым краем правого партнёра на уровне середины их карточек
    const leftX = mp.x + NODE_W;
    const rightX = pp.x;
    // Единая Y — середина между центрами обеих карточек (строго горизонтально)
    const midY = (mp.y + NODE_H / 2 + pp.y + NODE_H / 2) / 2;

    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', leftX);
    line.setAttribute('y1', midY);
    line.setAttribute('x2', rightX);
    line.setAttribute('y2', midY);
    line.classList.add('tree-link', 'partner-link');
    svg.appendChild(line);
  }
}

/* ----------------------------------------------------------
   Drag-and-Drop
   ---------------------------------------------------------- */

/** Read current node positions directly from DOM (CSS style attributes). */
function readNodePositionsFromDOM() {
  const positions = {};
  $$('.tree-node').forEach(n => {
    const id = n.dataset.id;
    if (id) {
      positions[id] = {
        x: parseFloat(n.style.left) || 0,
        y: parseFloat(n.style.top) || 0
      };
    }
  });
  return positions;
}

document.addEventListener('mousemove', (e) => {
  if (!_dragState) return;
  const dx = e.clientX - _dragState.startX;
  if (Math.abs(dx) > 3) _dragState.moved = true;
  const newLeft = Math.max(0, _dragState.startLeft + dx);
  _dragState.node.style.left = `${newLeft}px`;

  // Update stored position in real-time
  const tree = getActiveTree();
  tree.nodePositions[_dragState.id] = {
    x: newLeft,
    y: parseFloat(_dragState.node.style.top) || 0
  };

  // Re-render SVG links from current DOM positions (bypass filter during drag)
  const domPositions = readNodePositionsFromDOM();
  renderLinks(tree, domPositions, () => true);
});

document.addEventListener('mouseup', () => {
  if (!_dragState) return;
  if (_dragState.moved) {
    const tree = getActiveTree();
    const left = parseFloat(_dragState.node.style.left);
    const top = parseFloat(_dragState.node.style.top);
    tree.nodePositions[_dragState.id] = { x: left, y: top };
    saveForest();
    // Final re-render to sync links with saved positions + filter
    renderAll();
  }
  _dragState = null;
});

/* ----------------------------------------------------------
   Select & Detail
   ---------------------------------------------------------- */
function selectMember(tree, id) {
  selectedMemberId = id;
  tree.selectedId = id;
  saveForest();

  // Update node highlighting
  $$('.tree-node').forEach(n => n.classList.remove('selected'));
  const node = $(`[data-id="${id}"]`);
  if (node) node.classList.add('selected');

  showDetail(tree, id);
}

function showDetail(tree, id) {
  const member = getMember(tree, id);
  if (!member) return;

  dom.detailEmpty.style.display = 'none';
  dom.detailContent.style.display = 'flex';

  // Photo
  if (member.photo) {
    dom.detailPhoto.src = member.photo;
    dom.detailPhoto.style.display = 'block';
    dom.detailPhotoPlaceholder.style.display = 'none';
  } else {
    dom.detailPhoto.style.display = 'none';
    dom.detailPhotoPlaceholder.style.display = 'flex';
  }

  // Name
  dom.detailName.textContent = member.name || 'Без имени';

  // Meta
  let metaHtml = '';
  if (member.years) metaHtml += `<span>${member.years}</span>`;
  if (member.gender === 'female' && member.maidenName) metaHtml += `<span class="meta-divider">·</span><span>урожд. ${member.maidenName}</span>`;
  if (member.familyBranch) metaHtml += `<span class="meta-divider">·</span><span>${member.familyBranch}</span>`;
  if (member.location) metaHtml += `<br><span>📍 ${member.location}</span>`;
  dom.detailMeta.innerHTML = metaHtml;

  // Bio
  dom.detailBio.textContent = member.bio || '—';

  // Highlights
  dom.detailHighlights.innerHTML = '';
  if (member.highlights && member.highlights.length) {
    member.highlights.forEach(h => {
      const li = el('li', {}, h);
      dom.detailHighlights.appendChild(li);
    });
  } else {
    const li = el('li', { style: { color: 'var(--color-text-light)' } }, '—');
    dom.detailHighlights.appendChild(li);
  }

  // Connections
  let connHtml = '';
  if (member.motherId) {
    const mother = getMember(tree, member.motherId);
    connHtml += `<div class="conn-item"><span class="conn-label">Мать:</span><span class="conn-value" data-id="${member.motherId}">${mother ? mother.name : '—'}</span></div>`;
  }
  if (member.fatherId) {
    const father = getMember(tree, member.fatherId);
    connHtml += `<div class="conn-item"><span class="conn-label">Отец:</span><span class="conn-value" data-id="${member.fatherId}">${father ? father.name : '—'}</span></div>`;
  }
  if (member.partnerId) {
    const partner = getMember(tree, member.partnerId);
    connHtml += `<div class="conn-item"><span class="conn-label">Партнёр:</span><span class="conn-value" data-id="${member.partnerId}">${partner ? partner.name : '—'}</span></div>`;
  }
  if (member.childrenIds && member.childrenIds.length) {
    const children = member.childrenIds.map(cid => getMember(tree, cid)).filter(Boolean);
    connHtml += `<div class="conn-item"><span class="conn-label">Дети:</span><span>${children.map(c => `<span class="conn-value" data-id="${c.id}">${c.name}</span>`).join(', ')}</span></div>`;
  }
  dom.detailConnections.innerHTML = connHtml || '<div style="color:var(--color-text-light)">—</div>';

  // Click handler for connection links
  $$('.conn-value', dom.detailConnections).forEach(el => {
    el.addEventListener('click', () => {
      const cid = el.dataset.id;
      if (cid) selectMember(tree, cid);
    });
  });

  // Video
  if (member.video) {
    dom.detailVideoSection.style.display = 'block';
    dom.detailVideo.src = member.video;
  } else {
    dom.detailVideoSection.style.display = 'none';
    dom.detailVideo.src = '';
  }
}

/* ----------------------------------------------------------
   Tree Select Dropdown
   ---------------------------------------------------------- */
function updateTreeSelect() {
  dom.treeSelect.innerHTML = '';
  forest.forEach(t => {
    const opt = el('option', { value: t.id }, t.name);
    if (t.id === activeTreeId) opt.selected = true;
    dom.treeSelect.appendChild(opt);
  });
}

/* ----------------------------------------------------------
   Modal (Add/Edit Member)
   ---------------------------------------------------------- */
let editingMemberId = null;

function toggleMaidenField(gender) {
  const row = $('#form-row-maiden');
  if (row) {
    row.style.display = (gender === 'male') ? 'none' : '';
  }
}

function populateForm(member) {
  dom.fieldId.value = member.id || '';
  dom.fieldName.value = member.name || '';
  dom.fieldGender.value = member.gender || '';
  toggleMaidenField(member.gender || '');
  dom.fieldMaidenName.value = member.maidenName || '';
  dom.fieldFamilyBranch.value = member.familyBranch || '';
  dom.fieldBirthDate.value = member.birthDate || '';
  dom.fieldDeathDate.value = member.deathDate || '';
  dom.fieldGeneration.value = member.generation || '';
  dom.fieldLocation.value = member.location || '';
  dom.fieldBirthPlace.value = member.birthPlace || '';
  dom.fieldBio.value = member.bio || '';
  dom.fieldPhotoPath.value = member.photo || '';
  dom.fieldVideoPath.value = member.video || '';

  // Photo preview
  if (member.photo) {
    dom.fieldPhotoPreview.src = member.photo;
    dom.fieldPhotoPreview.style.display = 'block';
  } else {
    dom.fieldPhotoPreview.style.display = 'none';
  }

  // Highlights
  dom.highlightsContainer.innerHTML = '';
  if (member.highlights && member.highlights.length) {
    member.highlights.forEach(h => {
      addHighlightRow(h);
    });
  } else {
    addHighlightRow('');
  }

  // Populate parent/partner selects
  populateRelationSelects(member);
}

function populateRelationSelects(currentMember) {
  const tree = getActiveTree();
  const members = tree.members
    .filter(m => m.id !== (currentMember ? currentMember.id : null))
    .sort((a, b) => {
      const aParts = a.name.split(' ');
      const bParts = b.name.split(' ');
      // По фамилии (первое слово)
      const aSurname = (aParts[0] || '').toLowerCase();
      const bSurname = (bParts[0] || '').toLowerCase();
      if (aSurname !== bSurname) return aSurname < bSurname ? -1 : 1;
      // По имени (второе слово)
      const aName = (aParts[1] || '').toLowerCase();
      const bName = (bParts[1] || '').toLowerCase();
      if (aName !== bName) return aName < bName ? -1 : 1;
      // По отчеству (третье слово)
      const aPatr = (aParts[2] || '').toLowerCase();
      const bPatr = (bParts[2] || '').toLowerCase();
      return aPatr < bPatr ? -1 : aPatr > bPatr ? 1 : 0;
    });

  const motherSelect = dom.fieldMother;
  const fatherSelect = dom.fieldFather;
  const partnerSelect = dom.fieldPartner;

  motherSelect.innerHTML = '<option value="">— Не указана —</option>';
  fatherSelect.innerHTML = '<option value="">— Не указан —</option>';
  partnerSelect.innerHTML = '<option value="">— Не указан(а) —</option>';

  // Фильтр по полу: мать — женщины, отец — мужчины, партнёр — противоположный пол
  const partnerGender = currentMember
    ? (currentMember.gender === 'male' ? 'female'
        : currentMember.gender === 'female' ? 'male'
        : null)
    : null;

  for (const m of members) {
    if (m.gender === 'female') motherSelect.appendChild(el('option', { value: m.id }, m.name));
    if (m.gender === 'male') fatherSelect.appendChild(el('option', { value: m.id }, m.name));
    if (!partnerGender || m.gender === partnerGender) {
      partnerSelect.appendChild(el('option', { value: m.id }, m.name));
    }
  }

  // Set selected values directly (cloneNode не копирует selected IDL-свойство)
  if (currentMember) {
    if (currentMember.motherId) motherSelect.value = currentMember.motherId;
    if (currentMember.fatherId) fatherSelect.value = currentMember.fatherId;
    if (currentMember.partnerId) partnerSelect.value = currentMember.partnerId;
  }
}

function addHighlightRow(value = '') {
  const row = el('div', { className: 'highlight-row' },
    el('input', { type: 'text', className: 'form-input highlight-input', placeholder: 'Например: Участник войны', value }),
    el('button', {
      type: 'button',
      className: 'btn btn-sm btn-ghost highlight-remove',
      'aria-label': 'Удалить факт',
      onclick: () => row.remove()
    }, '✕')
  );
  dom.highlightsContainer.appendChild(row);
}

function openModal(member = null) {
  editingMemberId = member ? member.id : null;
  dom.modalTitle.textContent = member ? 'Редактировать родственника' : 'Добавить родственника';
  populateForm(member || {});
  dom.modalOverlay.classList.add('active');
}

function closeModal() {
  dom.modalOverlay.classList.remove('active');
  editingMemberId = null;
}

function saveForm() {
  const tree = getActiveTree();

  const name = dom.fieldName.value.trim();
  if (!name) { alert('Пожалуйста, введите имя и фамилию.'); return; }

  // Collect highlights
  const highlightInputs = $$('.highlight-input', dom.highlightsContainer);
  const highlights = highlightInputs.map(inp => inp.value.trim()).filter(Boolean);

  const data = {
    name,
    gender: dom.fieldGender.value,
    maidenName: dom.fieldMaidenName.value.trim(),
    familyBranch: dom.fieldFamilyBranch.value.trim(),
    birthDate: dom.fieldBirthDate.value,
    deathDate: dom.fieldDeathDate.value,
    generation: parseInt(dom.fieldGeneration.value) || 1,
    location: dom.fieldLocation.value.trim(),
    birthPlace: dom.fieldBirthPlace.value.trim(),
    motherId: dom.fieldMother.value,
    fatherId: dom.fieldFather.value,
    partnerId: dom.fieldPartner.value,
    bio: dom.fieldBio.value.trim(),
    highlights,
    photo: dom.fieldPhotoPath.value,
    video: dom.fieldVideoPath.value
  };

  // Auto-generate years from dates
  data.years = '';
  if (data.birthDate) {
    data.years = data.birthDate;
    if (data.deathDate) data.years += ` — ${data.deathDate}`;
  }

  if (editingMemberId) {
    const oldMember = getMember(tree, editingMemberId);
    const oldPartnerId = oldMember ? oldMember.partnerId : '';
    updateMember(tree, editingMemberId, data);
    // Sync new partner back-reference
    const updated = getMember(tree, editingMemberId);
    if (updated && data.partnerId) {
      const partner = getMember(tree, data.partnerId);
      if (partner && partner.partnerId !== updated.id) {
        partner.partnerId = updated.id;
      }
    }
    // Clean up old partner's back-reference if partner changed
    if (oldPartnerId && oldPartnerId !== data.partnerId) {
      const oldPartner = getMember(tree, oldPartnerId);
      if (oldPartner && oldPartner.partnerId === editingMemberId) {
        oldPartner.partnerId = '';
      }
    }
  } else {
    const member = addMember(tree, data);
    // If parents/partner specified, update their childrenIds/partnerId
    if (data.motherId) {
      const mother = getMember(tree, data.motherId);
      if (mother && !mother.childrenIds.includes(member.id)) mother.childrenIds.push(member.id);
    }
    if (data.fatherId) {
      const father = getMember(tree, data.fatherId);
      if (father && !father.childrenIds.includes(member.id)) father.childrenIds.push(member.id);
    }
    if (data.partnerId) {
      const partner = getMember(tree, data.partnerId);
      if (partner && partner.partnerId !== member.id) partner.partnerId = member.id;
    }
    saveForest();
  }
  // Sync all partner back-references (на случай, если партнёр изменился)
  for (const m of tree.members) {
    if (m.partnerId) {
      const partner = getMember(tree, m.partnerId);
      if (partner && !partner.partnerId) {
        partner.partnerId = m.id;
      }
    }
  }
  saveForest();

  closeModal();
  renderAll();
}

/* ----------------------------------------------------------
   Photo Upload
   ---------------------------------------------------------- */
async function uploadFile(file) {
  if (!file) return null;
  // Try server upload first
  try {
    const formData = new FormData();
    formData.append('file', file);
    const resp = await fetch('/api/upload', { method: 'POST', body: formData });
    if (resp.ok) {
      const data = await resp.json();
      return data.path;
    }
  } catch (e) { /* server may be offline */ }

  // Fallback: data URL
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

/* ----------------------------------------------------------
   SVG Export
   ---------------------------------------------------------- */
function exportSVG(printQuality = false) {
  const tree = getActiveTree();
  if (!tree.members.length) { alert('Дерево пусто. Нечего экспортировать.'); return; }

  const positions = getDefaultTreeLayout(tree);
  const allIds = new Set(tree.members.map(m => m.id));

  // Calculate dimensions
  const padding = 40;
  const maxX = Math.max(...Object.values(positions).map(p => p.x + NODE_W + padding), 400);
  const maxY = Math.max(...Object.values(positions).map(p => p.y + NODE_H + padding), 400);

  // Build SVG
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('xmlns', ns);
  svg.setAttribute('width', maxX);
  svg.setAttribute('height', maxY);
  svg.setAttribute('viewBox', `0 0 ${maxX} ${maxY}`);

  // Defs: shadows, gradients
  const defs = document.createElementNS(ns, 'defs');
  defs.innerHTML = `
    <filter id="card-shadow">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.1"/>
    </filter>
  `;
  svg.appendChild(defs);

  // Background
  const bg = document.createElementNS(ns, 'rect');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', '#f5f1ea');
  svg.appendChild(bg);

  // Draw links (same logic as renderLinks but in SVG)
  const familyMap = {};
  for (const m of tree.members) {
    const key = `${m.motherId}|${m.fatherId}`;
    if (!familyMap[key]) familyMap[key] = [];
    familyMap[key].push(m);
  }

  for (const [key, children] of Object.entries(familyMap)) {
    const [motherId, fatherId] = key.split('|');
    const parentIds = [motherId, fatherId].filter(Boolean);
    const visibleChildren = children.filter(c => allIds.has(c.id));
    if (!visibleChildren.length) continue;
    const childPositions = visibleChildren.map(c => positions[c.id]).filter(Boolean);
    if (!childPositions.length) continue;
    const parentPositions = parentIds.map(id => positions[id]).filter(Boolean);
    if (!parentPositions.length) continue;

    const busY = Math.min(...childPositions.map(p => p.y)) - 15;
    const busXs = [
      ...childPositions.map(p => p.x + NODE_W / 2),
      ...parentPositions.map(p => p.x + NODE_W / 2)
    ];
    const busMinX = Math.min(...busXs);
    const busMaxX = Math.max(...busXs);

    if (busMaxX - busMinX > 1) {
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', busMinX); line.setAttribute('y1', busY);
      line.setAttribute('x2', busMaxX); line.setAttribute('y2', busY);
      line.setAttribute('stroke', '#c4a882'); line.setAttribute('stroke-width', '2'); line.setAttribute('fill', 'none');
      svg.appendChild(line);
    }

    for (const child of visibleChildren) {
      const cp = positions[child.id];
      if (!cp) continue;
      const cx = cp.x + NODE_W / 2;
      const cy = cp.y;
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', cx); line.setAttribute('y1', busY);
      line.setAttribute('x2', cx); line.setAttribute('y2', cy);
      line.setAttribute('stroke', '#c4a882'); line.setAttribute('stroke-width', '2'); line.setAttribute('fill', 'none');
      svg.appendChild(line);
    }

    for (const pid of parentIds) {
      const pp = positions[pid];
      if (!pp) continue;
      const px = pp.x + NODE_W / 2;
      const py = pp.y + NODE_H;
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', px); line.setAttribute('y1', py);
      line.setAttribute('x2', px); line.setAttribute('y2', busY);
      line.setAttribute('stroke', '#c4a882'); line.setAttribute('stroke-width', '2'); line.setAttribute('fill', 'none');
      svg.appendChild(line);
    }
  }

  // Partner links
  for (const m of tree.members) {
    if (!m.partnerId) continue;
    const partner = getMember(tree, m.partnerId);
    if (!partner || m.id >= partner.id) continue;
    const mp = positions[m.id];
    const pp = positions[partner.id];
    if (!mp || !pp) continue;
    // Строго горизонтальная линия между партнёрами
    const midY = (mp.y + NODE_H / 2 + pp.y + NODE_H / 2) / 2;
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', mp.x + NODE_W);
    line.setAttribute('y1', midY);
    line.setAttribute('x2', pp.x);
    line.setAttribute('y2', midY);
    line.setAttribute('stroke', '#5b4a3f');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-dasharray', '4 3');
    line.setAttribute('fill', 'none');
    svg.appendChild(line);
  }

  // Draw nodes
  for (const m of tree.members) {
    const pos = positions[m.id];
    if (!pos) continue;
    const x = pos.x;
    const y = pos.y;
    const w = NODE_W;
    const h = NODE_H;
    const r = 8;

    // Card background
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('rx', r);
    rect.setAttribute('fill', 'rgba(255,255,255,0.85)');
    rect.setAttribute('stroke', 'rgba(255,255,255,0.6)');
    rect.setAttribute('stroke-width', '1');
    rect.setAttribute('filter', 'url(#card-shadow)');
    svg.appendChild(rect);

    // Name text
    const nameParts = m.name.split(' ');
    const shortName = nameParts.length > 1 ? `${nameParts[0]} ${nameParts[1][0]}.` : m.name;
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', x + w / 2);
    text.setAttribute('y', y + h / 2 - 6);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-family', 'Manrope, sans-serif');
    text.setAttribute('font-size', printQuality ? '12' : '11');
    text.setAttribute('font-weight', '600');
    text.setAttribute('fill', '#2c241b');
    text.textContent = shortName;
    svg.appendChild(text);

    if (m.years) {
      const yText = document.createElementNS(ns, 'text');
      yText.setAttribute('x', x + w / 2);
      yText.setAttribute('y', y + h / 2 + 14);
      yText.setAttribute('text-anchor', 'middle');
      yText.setAttribute('font-family', 'Manrope, sans-serif');
      yText.setAttribute('font-size', printQuality ? '10' : '9');
      yText.setAttribute('fill', '#7a6b5d');
      yText.textContent = m.years;
      svg.appendChild(yText);
    }
  }

  // Serialize and download
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svg);
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `family-tree-${tree.name.replace(/\s+/g, '-')}${printQuality ? '-print' : ''}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ----------------------------------------------------------
   JSON Import/Export
   ---------------------------------------------------------- */
function exportJSON() {
  const tree = getActiveTree();
  if (!tree.members.length) { alert('Дерево пусто.'); return; }
  const data = { name: tree.name, members: tree.members };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `family-tree-${tree.name.replace(/\s+/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.members || !Array.isArray(data.members)) {
        alert('Неверный формат JSON. Ожидается объект с полем "members".');
        return;
      }
      const tree = getActiveTree();
      tree.members = data.members.map(m => createMember(m));
      tree.nodePositions = {};
      recalculateGenerations(tree);
      tree.selectedId = null;
      saveForest();
      renderAll();
      alert(`Импортировано ${tree.members.length} родственников.`);
    } catch (err) {
      alert('Ошибка при импорте JSON: ' + err.message);
    }
  };
  reader.readAsText(file);
}

/* ----------------------------------------------------------
   Photo Preview Popup
   ---------------------------------------------------------- */
function setupPhotoPreview() {
  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-preview]');
    if (!target || target.tagName !== 'IMG' || !target.src) return;
    if (target.src.startsWith('data:') || target.src.startsWith('http')) {
      dom.photoPreviewImg.src = target.src;
      dom.photoPreviewPopup.classList.add('active');
      const rect = target.getBoundingClientRect();
      const popW = 300;
      dom.photoPreviewPopup.style.left = `${Math.min(rect.right + 10, window.innerWidth - popW - 10)}px`;
      dom.photoPreviewPopup.style.top = `${Math.max(10, rect.top - 10)}px`;
    }
  });

  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('[data-preview]')) {
      dom.photoPreviewPopup.classList.remove('active');
    }
  });
}

/* ----------------------------------------------------------
   Demo Data
   ---------------------------------------------------------- */
function loadDemoData() {
  const storedVersion = localStorage.getItem('family-tree-demo-version');
  // Always load fresh demo for demo trees
  const demoData = getDemoTrees();
  // Remove old demo trees
  forest = forest.filter(t => !t._demo);
  // Add or update demo trees
  demoData.forEach(demo => {
    const existing = forest.find(t => t.name === demo.name);
    if (existing) {
      existing.members = demo.members;
      existing.nodePositions = {};
      recalculateGenerations(existing);
    } else {
      forest.push(demo);
    }
  });
  localStorage.setItem('family-tree-demo-version', CURRENT_DEMO_VERSION);
  activeTreeId = demoData[0].id;
  saveForest();
  renderAll();
}

function getDemoTrees() {
  return [
    getDemoOrlovs(),
    getDemoRudenski(),
    getDemoZakutski()
  ];
}

function getDemoOrlovs() {
  const tree = createTreeData("Семья Орловых");
  tree._demo = true;

  const members = [
    { name: "Иван Орлов", gender: "male", relationType: "ancestor", kinship: "Прадедушка", years: "1910 — 1985", generation: 4, familyBranch: "Орловы" },
    { name: "Мария Орлова", gender: "female", relationType: "ancestor", kinship: "Прабабушка", years: "1912 — 1990", generation: 4, familyBranch: "Орловы", maidenName: "Соколова" },
    { name: "Пётр Орлов", gender: "male", relationType: "parent", kinship: "Дедушка", years: "1935 — 2001", generation: 3, familyBranch: "Орловы" },
    { name: "Анна Орлова", gender: "female", relationType: "parent", kinship: "Бабушка", years: "1938 — 2015", generation: 3, familyBranch: "Орловы", maidenName: "Кузнецова" },
    { name: "Сергей Орлов", gender: "male", relationType: "parent", kinship: "Отец", years: "1960 — 2020", generation: 2, familyBranch: "Орловы" },
    { name: "Елена Орлова", gender: "female", relationType: "parent", kinship: "Мать", years: "1962 — ", generation: 2, familyBranch: "Орловы", maidenName: "Васильева" },
    { name: "Дмитрий Орлов", gender: "male", relationType: "child", kinship: "Сын", years: "1985 — ", generation: 1, familyBranch: "Орловы" },
    { name: "Ольга Орлова", gender: "female", relationType: "child", kinship: "Дочь", years: "1988 — ", generation: 1, familyBranch: "Орловы", maidenName: "Орлова" },
    { name: "Алексей Орлов", gender: "male", relationType: "child", kinship: "Внук", years: "2010 — ", generation: 1, familyBranch: "Орловы" },
    { name: "Наталья Орлова", gender: "female", relationType: "partner", kinship: "Жена", years: "1987 — ", generation: 1, familyBranch: "Орловы", maidenName: "Попова" },
    { name: "Виктор Орлов", gender: "male", relationType: "relative", kinship: "Брат", years: "1965 — ", generation: 2, familyBranch: "Орловы" },
  ];

  // Create members and link them
  const created = members.map(m => addMember(tree, m));

  // Link relationships
  // Ivan (0) + Maria (1) -> Petr (2)
  created[2].motherId = created[1].id; // Maria
  created[2].fatherId = created[0].id; // Ivan
  created[0].childrenIds.push(created[2].id);
  created[1].childrenIds.push(created[2].id);

  // Petr (2) + Anna (3) -> Sergey (4), Victor (10)
  created[4].motherId = created[3].id;
  created[4].fatherId = created[2].id;
  created[10].motherId = created[3].id;
  created[10].fatherId = created[2].id;
  created[2].childrenIds.push(created[4].id, created[10].id);
  created[3].childrenIds.push(created[4].id, created[10].id);
  created[2].partnerId = created[3].id;
  created[3].partnerId = created[2].id;

  // Sergey (4) + Elena (5) -> Dmitry (6), Olga (7)
  created[6].motherId = created[5].id;
  created[6].fatherId = created[4].id;
  created[7].motherId = created[5].id;
  created[7].fatherId = created[4].id;
  created[4].childrenIds.push(created[6].id, created[7].id);
  created[5].childrenIds.push(created[6].id, created[7].id);
  created[4].partnerId = created[5].id;
  created[5].partnerId = created[4].id;

  // Dmitry (6) + Natalya (9) -> Alexey (8)
  created[8].motherId = created[9].id;
  created[8].fatherId = created[6].id;
  created[6].childrenIds.push(created[8].id);
  created[9].childrenIds.push(created[8].id);
  created[6].partnerId = created[9].id;
  created[9].partnerId = created[6].id;

  recalculateGenerations(tree);
  tree.members.forEach(m => { delete m.id; }); // IDs will be regenerated
  // Actually, addMember already created IDs. We need to rebuild.
  // Simpler: rebuild from scratch
  const rawMembers = tree.members;
  tree.members = [];
  const idMap = {};
  for (const m of rawMembers) {
    const oldId = m.id;
    delete m.id;
    const newMember = addMember(tree, m);
    idMap[oldId] = newMember.id;
  }
  // Relink
  const membersArr = tree.members;
  membersArr.forEach(m => {
    // Convert IDs via map
  });
  // This is getting complicated. Let's just rebuild from scratch with IDs.
  // Simpler approach below.
  return createDemoOrlovsClean();
}

function createDemoOrlovsClean() {
  const tree = createTreeData("Тестовое дерево");
  tree._demo = true;

  // После recalculateGenerations():
  //   Поколение 1 (сверху) — Иван + Мария (супруги)
  //   Поколение 2          — Пётр + Анна   (супруги, их сын)
  //   Поколение 3 (снизу)  — Алексей (сын Петра и Анны)
  const raw = [
    { name: "Иван Орлов",   gender: "male",   relationType: "parent", kinship: "Отец",   years: "1960 — 2020", familyBranch: "Орловы" },
    { name: "Мария Орлова", gender: "female", relationType: "parent", kinship: "Мать",   years: "1962 — ",    familyBranch: "Орловы", maidenName: "Васильева" },
    { name: "Пётр Орлов",   gender: "male",   relationType: "child",  kinship: "Сын",    years: "1985 — ",    familyBranch: "Орловы" },
    { name: "Анна Орлова",  gender: "female", relationType: "partner", kinship: "Жена",  years: "1987 — ",    familyBranch: "Орловы", maidenName: "Попова" },
    { name: "Алексей Орлов",gender: "male",   relationType: "child",  kinship: "Внук",   years: "2010 — ",    familyBranch: "Орловы" },
  ];

  const [ivan, maria, petr, anna, alexey] = raw.map(m => createMember(m));
  tree.members = [ivan, maria, petr, anna, alexey];

  // Иван + Мария — супруги
  ivan.partnerId = maria.id;
  maria.partnerId = ivan.id;
  ivan.childrenIds = [petr.id];
  maria.childrenIds = [petr.id];

  // Пётр — их сын
  petr.motherId = maria.id;
  petr.fatherId = ivan.id;

  // Пётр + Анна — супруги
  petr.partnerId = anna.id;
  anna.partnerId = petr.id;
  petr.childrenIds = [alexey.id];
  anna.childrenIds = [alexey.id];

  // Алексей — их сын
  alexey.motherId = anna.id;
  alexey.fatherId = petr.id;

  recalculateGenerations(tree);
  return tree;
}

function getDemoRudenski() {
  const tree = createTreeData("Родовід Руденських");
  tree._demo = true;

  const raw = [
    { name: "Михайло Руденський", gender: "male", relationType: "ancestor", kinship: "Прадід", years: "1885 — 1955", generation: 4, familyBranch: "Руденські" },
    { name: "Оксана Руденська", gender: "female", relationType: "ancestor", kinship: "Прабаба", years: "1888 — 1960", generation: 4, familyBranch: "Руденські", maidenName: "Ковальчук" },
    { name: "Іван Руденський", gender: "male", relationType: "parent", kinship: "Дід", years: "1912 — 1980", generation: 3, familyBranch: "Руденські" },
    { name: "Марія Руденська", gender: "female", relationType: "parent", kinship: "Баба", years: "1915 — 1995", generation: 3, familyBranch: "Руденські", maidenName: "Шевченко" },
    { name: "Петро Руденський", gender: "male", relationType: "parent", kinship: "Батько", years: "1938 — 2010", generation: 2, familyBranch: "Руденські" },
    { name: "Ганна Руденська", gender: "female", relationType: "parent", kinship: "Мати", years: "1940 — 2018", generation: 2, familyBranch: "Руденські", maidenName: "Бондаренко" },
    { name: "Олег Руденський", gender: "male", relationType: "child", kinship: "Син", years: "1965 — ", generation: 1, familyBranch: "Руденські" },
    { name: "Наталія Руденська", gender: "female", relationType: "child", kinship: "Донька", years: "1968 — ", generation: 1, familyBranch: "Руденські" },
    { name: "Тарас Руденський", gender: "male", relationType: "child", kinship: "Онук", years: "1995 — ", generation: 1, familyBranch: "Руденські" },
    { name: "Ірина Руденська", gender: "female", relationType: "partner", kinship: "Дружина", years: "1967 — ", generation: 1, familyBranch: "Руденські", maidenName: "Лисенко" },
  ];

  const members = raw.map(m => createMember(m));
  tree.members = members;

  members[2].motherId = members[1].id;
  members[2].fatherId = members[0].id;
  members[2].partnerId = members[3].id;
  members[3].partnerId = members[2].id;

  members[4].motherId = members[3].id;
  members[4].fatherId = members[2].id;
  members[4].partnerId = members[5].id;
  members[5].partnerId = members[4].id;

  members[6].motherId = members[5].id;
  members[6].fatherId = members[4].id;
  members[7].motherId = members[5].id;
  members[7].fatherId = members[4].id;

  members[6].partnerId = members[9].id;
  members[9].partnerId = members[6].id;

  members[8].motherId = members[9].id;
  members[8].fatherId = members[6].id;

  members[0].childrenIds = [members[2].id];
  members[1].childrenIds = [members[2].id];
  members[2].childrenIds = [members[4].id];
  members[3].childrenIds = [members[4].id];
  members[4].childrenIds = [members[6].id, members[7].id];
  members[5].childrenIds = [members[6].id, members[7].id];
  members[6].childrenIds = [members[8].id];
  members[9].childrenIds = [members[8].id];

  recalculateGenerations(tree);
  return tree;
}

function getDemoZakutski() {
  const tree = createTreeData("Родовід Закутських");
  tree._demo = true;

  const raw = [
    // Generation 5
    { name: "Степан Закутський", gender: "male", relationType: "ancestor", kinship: "Прапрадід", years: "1845 — 1918", generation: 5, familyBranch: "Закутські" },
    { name: "Євдокія Закутська", gender: "female", relationType: "ancestor", kinship: "Прапрабаба", years: "1848 — 1922", generation: 5, familyBranch: "Закутські", maidenName: "Ткаченко" },
    // Generation 4
    { name: "Данило Закутський", gender: "male", relationType: "ancestor", kinship: "Прадід", years: "1870 — 1942", generation: 4, familyBranch: "Закутські" },
    { name: "Параска Закутська", gender: "female", relationType: "ancestor", kinship: "Прабаба", years: "1872 — 1945", generation: 4, familyBranch: "Закутські", maidenName: "Онищенко" },
    { name: "Омелько Закутський", gender: "male", relationType: "ancestor", kinship: "Прадід", years: "1875 — 1943", generation: 4, familyBranch: "Закутські" },
    { name: "Мотря Закутська", gender: "female", relationType: "ancestor", kinship: "Прабаба", years: "1878 — 1948", generation: 4, familyBranch: "Закутські", maidenName: "Дорошенко" },
    // Generation 3
    { name: "Ілля Закутський", gender: "male", relationType: "parent", kinship: "Дід", years: "1898 — 1975", generation: 3, familyBranch: "Закутські" },
    { name: "Варвара Закутська", gender: "female", relationType: "parent", kinship: "Баба", years: "1900 — 1980", generation: 3, familyBranch: "Закутські", maidenName: "Павленко" },
    { name: "Федір Закутський", gender: "male", relationType: "parent", kinship: "Дід", years: "1902 — 1978", generation: 3, familyBranch: "Закутські" },
    { name: "Марфа Закутська", gender: "female", relationType: "parent", kinship: "Баба", years: "1905 — 1982", generation: 3, familyBranch: "Закутські", maidenName: "Левченко" },
    // Generation 2
    { name: "Микола Закутський", gender: "male", relationType: "parent", kinship: "Батько", years: "1928 — 2005", generation: 2, familyBranch: "Закутські" },
    { name: "Ольга Закутська", gender: "female", relationType: "parent", kinship: "Мати", years: "1930 — 2019", generation: 2, familyBranch: "Закутські", maidenName: "Гриценко" },
    { name: "Василь Закутський", gender: "male", relationType: "parent", kinship: "Дядько", years: "1932 — 2010", generation: 2, familyBranch: "Закутські" },
    { name: "Марія Закутська", gender: "female", relationType: "parent", kinship: "Тітка", years: "1935 — 2015", generation: 2, familyBranch: "Закутські", maidenName: "Закутська" },
    // Generation 1
    { name: "Андрій Закутський", gender: "male", relationType: "child", kinship: "Син", years: "1955 — ", generation: 1, familyBranch: "Закутські" },
    { name: "Людмила Закутська", gender: "female", relationType: "child", kinship: "Донька", years: "1958 — ", generation: 1, familyBranch: "Закутські" },
    { name: "Борис Закутський", gender: "male", relationType: "child", kinship: "Син", years: "1960 — ", generation: 1, familyBranch: "Закутські" },
    { name: "Тетяна Закутська", gender: "female", relationType: "child", kinship: "Донька", years: "1962 — ", generation: 1, familyBranch: "Закутські" },
    { name: "Ігор Закутський", gender: "male", relationType: "child", kinship: "Онук", years: "1982 — ", generation: 1, familyBranch: "Закутські" },
    { name: "Оксана Закутська", gender: "female", relationType: "child", kinship: "Онука", years: "1985 — ", generation: 1, familyBranch: "Закутські" },
    { name: "Дмитро Закутський", gender: "male", relationType: "child", kinship: "Онук", years: "1988 — ", generation: 1, familyBranch: "Закутські" },
    { name: "Надія Закутська", gender: "female", relationType: "child", kinship: "Онука", years: "1990 — ", generation: 1, familyBranch: "Закутські" },
    // Partners gen 1
    { name: "Катерина Закутська", gender: "female", relationType: "partner", kinship: "Дружина", years: "1957 — ", generation: 1, familyBranch: "Закутські", maidenName: "Мельник" },
    { name: "Галина Закутська", gender: "female", relationType: "partner", kinship: "Дружина", years: "1962 — ", generation: 1, familyBranch: "Закутські", maidenName: "Савченко" },
    // Partners gen 2
    { name: "Софія Закутська", gender: "female", relationType: "partner", kinship: "Дружина", years: "1930 — 2008", generation: 2, familyBranch: "Закутські", maidenName: "Кравченко" },
    // Gen 3 partners
    { name: "Уляна Закутська", gender: "female", relationType: "partner", kinship: "Дружина", years: "1903 — 1976", generation: 3, familyBranch: "Закутські", maidenName: "Романенко" },
    // Additional
    { name: "Петро Закутський", gender: "male", relationType: "child", kinship: "Правнук", years: "2010 — ", generation: 1, familyBranch: "Закутські" },
    { name: "Анна Закутська", gender: "female", relationType: "child", kinship: "Правнучка", years: "2012 — ", generation: 1, familyBranch: "Закутські" },
    { name: "Михайло Закутський", gender: "male", relationType: "child", kinship: "Правнук", years: "2015 — ", generation: 1, familyBranch: "Закутські" },
    { name: "Олена Закутська", gender: "female", relationType: "child", kinship: "Правнучка", years: "2018 — ", generation: 1, familyBranch: "Закутські" },
    { name: "Сергій Закутський", gender: "male", relationType: "relative", kinship: "Брат", years: "1963 — ", generation: 1, familyBranch: "Закутські" },
    { name: "Віра Закутська", gender: "female", relationType: "child", kinship: "Онука", years: "1992 — ", generation: 1, familyBranch: "Закутські" },
  ];

  const members = raw.map(m => createMember(m));
  tree.members = members;

  // Gen 5 -> Gen 4
  members[2].motherId = members[1].id;
  members[2].fatherId = members[0].id;
  members[3].motherId = members[1].id;
  members[3].fatherId = members[0].id;
  members[0].childrenIds = [members[2].id, members[3].id];
  members[1].childrenIds = [members[2].id, members[3].id];

  // Gen 4 links
  members[2].partnerId = members[3].id;
  members[3].partnerId = members[2].id;
  members[4].partnerId = members[5].id;
  members[5].partnerId = members[4].id;

  // Gen 4 -> Gen 3
  members[6].motherId = members[3].id;
  members[6].fatherId = members[2].id;
  members[8].motherId = members[5].id;
  members[8].fatherId = members[4].id;
  members[2].childrenIds = [members[6].id];
  members[3].childrenIds = [members[6].id];
  members[4].childrenIds = [members[8].id];
  members[5].childrenIds = [members[8].id];

  members[6].partnerId = members[7].id;
  members[7].partnerId = members[6].id;
  members[8].partnerId = members[9].id;
  members[9].partnerId = members[8].id;

  // Gen 3 -> Gen 2
  members[10].motherId = members[7].id;
  members[10].fatherId = members[6].id;
  members[11].motherId = members[7].id;
  members[11].fatherId = members[6].id;
  members[12].motherId = members[9].id;
  members[12].fatherId = members[8].id;
  members[13].motherId = members[9].id;
  members[13].fatherId = members[8].id;

  members[6].childrenIds = [members[10].id, members[11].id];
  members[7].childrenIds = [members[10].id, members[11].id];
  members[8].childrenIds = [members[12].id, members[13].id];
  members[9].childrenIds = [members[12].id, members[13].id];

  members[10].partnerId = members[24].id; // Mykola + Sofia
  members[24].partnerId = members[10].id;
  members[11].partnerId = members[10].id; // Olga's partner is Mykola (polygamy not supported, keep simple)

  // Gen 2 -> Gen 1
  members[14].motherId = members[11].id;
  members[14].fatherId = members[10].id;
  members[15].motherId = members[11].id;
  members[15].fatherId = members[10].id;
  members[16].motherId = members[11].id;
  members[16].fatherId = members[10].id;
  members[17].motherId = members[11].id;
  members[17].fatherId = members[10].id;

  members[10].childrenIds = [members[14].id, members[15].id, members[16].id, members[17].id];
  members[11].childrenIds = [members[14].id, members[15].id, members[16].id, members[17].id];

  members[14].partnerId = members[22].id;
  members[22].partnerId = members[14].id;
  members[16].partnerId = members[23].id;
  members[23].partnerId = members[16].id;

  // Gen 1 children
  members[18].motherId = members[22].id;
  members[18].fatherId = members[14].id;
  members[19].motherId = members[22].id;
  members[19].fatherId = members[14].id;
  members[20].motherId = members[23].id;
  members[20].fatherId = members[16].id;
  members[21].motherId = members[23].id;
  members[21].fatherId = members[16].id;

  members[14].childrenIds = [members[18].id, members[19].id];
  members[22].childrenIds = [members[18].id, members[19].id];
  members[16].childrenIds = [members[20].id, members[21].id];
  members[23].childrenIds = [members[20].id, members[21].id];

  // More children
  members[25].motherId = members[19].id;
  members[25].fatherId = members[18].id;
  members[26].motherId = members[19].id;
  members[26].fatherId = members[18].id;
  members[27].motherId = members[19].id;
  members[27].fatherId = members[18].id;
  members[28].motherId = members[19].id;
  members[28].fatherId = members[18].id;
  members[18].childrenIds = [members[25].id, members[26].id, members[27].id, members[28].id];
  members[19].childrenIds = [members[25].id, members[26].id, members[27].id, members[28].id];

  members[29].motherId = members[23].id;
  members[29].fatherId = members[16].id;
  members[16].childrenIds.push(members[29].id);
  members[23].childrenIds.push(members[29].id);

  members[30].motherId = members[23].id;
  members[30].fatherId = members[16].id;
  members[16].childrenIds.push(members[30].id);
  members[23].childrenIds.push(members[30].id);

  recalculateGenerations(tree);
  return tree;
}

/* ----------------------------------------------------------
   Event Binding
   ---------------------------------------------------------- */
function bindEvents() {
  // Tree management
  dom.treeSelect.addEventListener('change', () => switchTree(dom.treeSelect.value));
  dom.btnNewTree.addEventListener('click', () => {
    const name = prompt('Введите название нового дерева:', 'Моя семья');
    if (name && name.trim()) {
      const tree = createTree(name.trim());
      activeTreeId = tree.id;
      saveForest();
      renderAll();
    }
  });
  dom.btnDeleteTree.addEventListener('click', () => {
    if (forest.length <= 1) { alert('Нельзя удалить последнее дерево.'); return; }
    if (confirm('Удалить активное дерево? Это действие нельзя отменить.')) {
      deleteTree(activeTreeId);
      renderAll();
    }
  });
  dom.btnRenameTree.addEventListener('click', () => {
    const tree = getActiveTree();
    const newName = prompt('Введите новое название дерева:', tree.name);
    if (newName && newName.trim()) {
      tree.name = newName.trim();
      saveForest();
      renderAll();
    }
  });

  // Demo
  dom.btnLoadDemo.addEventListener('click', () => {
    if (confirm('Загрузить демо-данные? Текущие данные будут заменены в совпадающих деревьях.')) {
      loadDemoData();
    }
  });

  // Import/Export
  dom.btnExportJson.addEventListener('click', exportJSON);
  dom.btnImportJson.addEventListener('click', () => dom.importJsonInput.click());
  dom.importJsonInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
      importJSON(e.target.files[0]);
      e.target.value = '';
    }
  });

  // SVG Export
  dom.btnExportSvg.addEventListener('click', () => exportSVG(false));
  dom.btnExportSvgPrint.addEventListener('click', () => exportSVG(true));

  // Gender → toggle maiden name
  dom.fieldGender.addEventListener('change', () => toggleMaidenField(dom.fieldGender.value));

  // Add member
  dom.btnAddMember.addEventListener('click', () => openModal(null));

  // Search
  dom.searchInput.addEventListener('input', () => renderAll());
  dom.btnClearSearch.addEventListener('click', () => {
    dom.searchInput.value = '';
    renderAll();
  });
  dom.btnResetView.addEventListener('click', () => {
    const tree = getActiveTree();
    tree.nodePositions = {};
    saveForest();
    renderAll();
  });

  // Detail panel actions
  dom.btnEditMember.addEventListener('click', () => {
    if (selectedMemberId) {
      const tree = getActiveTree();
      const member = getMember(tree, selectedMemberId);
      if (member) openModal(member);
    }
  });
  dom.btnDeleteMember.addEventListener('click', () => {
    if (!selectedMemberId) return;
    if (confirm('Удалить этого родственника? Все связи будут очищены.')) {
      const tree = getActiveTree();
      deleteMember(tree, selectedMemberId);
      selectedMemberId = null;
      renderAll();
    }
  });

  // Modal
  dom.modalClose.addEventListener('click', closeModal);
  dom.btnFormCancel.addEventListener('click', closeModal);
  dom.modalOverlay.addEventListener('click', (e) => {
    if (e.target === dom.modalOverlay) closeModal();
  });
  dom.btnFormSave.addEventListener('click', saveForm);

  // Highlights
  dom.btnAddHighlight.addEventListener('click', () => addHighlightRow(''));

  // Photo upload
  dom.fieldPhoto.addEventListener('change', async (e) => {
    if (e.target.files.length) {
      const path = await uploadFile(e.target.files[0]);
      if (path) {
        dom.fieldPhotoPath.value = path;
        dom.fieldPhotoPreview.src = path;
        dom.fieldPhotoPreview.style.display = 'block';
      }
    }
  });
  dom.btnClearPhoto.addEventListener('click', () => {
    dom.fieldPhoto.value = '';
    dom.fieldPhotoPath.value = '';
    dom.fieldPhotoPreview.style.display = 'none';
  });

  // Video upload
  dom.fieldVideo.addEventListener('change', async (e) => {
    if (e.target.files.length) {
      const path = await uploadFile(e.target.files[0]);
      if (path) dom.fieldVideoPath.value = path;
    }
  });
  dom.btnClearVideo.addEventListener('click', () => {
    dom.fieldVideo.value = '';
    dom.fieldVideoPath.value = '';
  });

  // Scroll buttons
  dom.scrollLeft.addEventListener('click', () => {
    dom.treeScroll.scrollBy({ left: -300, behavior: 'smooth' });
  });
  dom.scrollRight.addEventListener('click', () => {
    dom.treeScroll.scrollBy({ left: 300, behavior: 'smooth' });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

/* ----------------------------------------------------------
   Initialization
   ---------------------------------------------------------- */
async function init() {
  cacheDom();
  await loadForest();
  setupPhotoPreview();
  bindEvents();

  // activeTreeId уже установлен в loadForest (из сервера или из localStorage)
  if (!activeTreeId || !forest.some(t => t.id === activeTreeId)) {
    activeTreeId = forest[0].id;
  }

  renderAll();
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
