'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FolderClosed, Search, ChevronDown, ChevronRight, FileText, PanelLeft, PanelRight,
  PenSquare, BookOpen, Link, Settings, HelpCircle, GitFork, List, X, Lock,
  Save, Plus, FolderPlus, ChevronsUpDown, Tags, Bookmark, Focus, Menu, ChevronLeft, MoreHorizontal
} from 'lucide-react';
import { FileNode } from '@/lib/vault';
import MarkdownViewer from '@/components/MarkdownViewer';
import MarkdownEditor from '@/components/MarkdownEditor';

// ─── Types ──────────────────────────────────────────────
interface SearchResult { filePath: string; fileName: string; matches: string[] }
interface GraphNode { id: number; label: string; title: string; group?: string; value?: number }
interface GraphEdge { from: number; to: number }

interface TabState {
  id: string; // e.g. "graph" or "Tutoriels/Bienvenue.md"
  type: 'note' | 'graph' | 'empty';
  path?: string;
}

// ─── Main App ───────────────────────────────────────────
export default function Home() {
  // Vault state
  const [tree, setTree] = useState<FileNode[]>([]);
  
  // Tabs State
  const [openTabs, setOpenTabs] = useState<TabState[]>([{ id: 'empty-1', type: 'empty' }]);
  const [activeTabId, setActiveTabId] = useState<string | null>('empty-1');

  // Bookmarks
  const [bookmarks, setBookmarks] = useState<string[]>([]);

  // Context Menu & Renaming State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, path: string, isDir: boolean } | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [expandAllToggle, setExpandAllToggle] = useState<boolean>(false);

  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // UI state
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isMobileRightOpen, setIsMobileRightOpen] = useState(false);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [leftTab, setLeftTab] = useState<'files' | 'search' | 'bookmarks'>('files');
  const [mode, setMode] = useState<'read' | 'edit'>('read');
  const [unsaved, setUnsaved] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // Graph state
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [fontSize, setFontSize] = useState(15);

  // Auth state for edit
  const [showAuth, setShowAuth] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // TOC
  const [toc, setToc] = useState<{ level: number; text: string; id: string }[]>([]);

  // Load tree + graph
  const refreshTree = useCallback(() => {
    fetch('/api/vault/tree').then(r => r.json()).then(d => d.tree && setTree(d.tree));
    fetch('/api/vault/graph').then(r => r.json()).then(d => setGraphData(d));
  }, []);

  useEffect(() => {
    refreshTree();
    const savedBookmarks = localStorage.getItem('obsidian-bookmarks');
    if (savedBookmarks) {
      try { setBookmarks(JSON.parse(savedBookmarks)); } catch {}
    }
  }, [refreshTree]);

  // Context Menu general closing
  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Derived active components
  const activeTab = openTabs.find(t => t.id === activeTabId);
  const activeFile = activeTab?.type === 'note' ? activeTab.path : null;

  // Load file content when activeFile changes
  useEffect(() => {
    if (!activeFile) return;
    setIsLoading(true);
    setMode('read');
    fetch(`/api/vault/file?path=${encodeURIComponent(activeFile)}`)
      .then(r => r.json())
      .then(d => {
        setContent(d.content ?? '# Fichier non trouvé');
        setUnsaved(false);
        setIsLoading(false);
      });
  }, [activeFile]);

  // Build TOC when content changes
  useEffect(() => {
    const headings: { level: number; text: string; id: string }[] = [];
    const regex = /^(#{1,6})\s+(.+)$/gm;
    let match;
    while ((match = regex.exec(content))) {
      const level = match[1].length;
      const text = match[2].trim();
      const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      headings.push({ level, text, id });
    }
    setToc(headings);
  }, [content]);

  // Ctrl+S save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // Save handler
  const handleSave = useCallback(async () => {
    if (!activeFile || !unsaved) return;
    const res = await fetch('/api/vault/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: activeFile, content, password: authPassword }),
    });
    if (res.ok) {
      setUnsaved(false);
      showToast('Sauvegardé ✓');
    } else {
      showToast('Erreur de sauvegarde');
    }
  }, [activeFile, content, authPassword, unsaved]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  // Search
  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const res = await fetch(`/api/vault/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setSearchResults(data.results || []);
  }, []);

  // Edit button click
  const handleEditClick = () => {
    if (!isAuthenticated) {
      setShowAuth(true);
    } else {
      setMode(mode === 'edit' ? 'read' : 'edit');
    }
  };

  const handleAuthSubmit = () => {
    setIsAuthenticated(true);
    setShowAuth(false);
    setMode('edit');
  };

  // Tab Management
  const openTab = (id: string, type: 'note' | 'graph' | 'empty', path?: string) => {
    if (!openTabs.find(t => t.id === id)) {
      setOpenTabs(prev => [...prev, { id, type, path }]);
    }
    setActiveTabId(id);
  };

  const closeTab = (id: string) => {
    setOpenTabs(prev => {
      const idx = prev.findIndex(t => t.id === id);
      const newTabs = prev.filter(t => t.id !== id);
      if (newTabs.length > 0 && activeTabId === id) {
        setActiveTabId(newTabs[Math.max(0, idx - 1)].id);
      } else if (newTabs.length === 0) {
        const emptyId = `empty-${Date.now()}`;
        setActiveTabId(emptyId);
        return [{ id: emptyId, type: 'empty' }];
      }
      return newTabs;
    });
  };

  const handleNavigate = (path: string) => {
    const allFiles = flattenTree(tree);
    const targetName = path.endsWith('.md') ? path : path + '.md';
    if (allFiles.some(f => f.path === targetName)) {
      openTab(targetName, 'note', targetName);
      return;
    }
    const match = allFiles.find(f => f.path.endsWith('/' + targetName) || f.name === targetName);
    if (match) {
      openTab(match.path, 'note', match.path);
    } else {
      openTab(targetName, 'note', targetName);
    }
  };

  // Create file/folder
  const handleCreateNote = async (parentFolder = '') => {
    const finalDir = parentFolder ? (parentFolder.endsWith('/') ? parentFolder : parentFolder + '/') : '';
    let name = 'Sans titre';
    let path = `${finalDir}${name}.md`;
    let count = 1;
    const allFiles = flattenTree(tree);
    while (allFiles.some(f => f.path === path)) {
      name = `Sans titre ${count}`;
      path = `${finalDir}${name}.md`;
      count++;
    }

    await fetch('/api/vault/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content: `# ${name}\n\n`, password: authPassword }),
    });
    refreshTree();
    openTab(path, 'note', path);
    setIsMobileNavOpen(false); // Close mobile nav when file created
    showToast('Note créée ✓');
  };

  const handleCreateFolder = async (parentFolder = '') => {
    const finalDir = parentFolder ? (parentFolder.endsWith('/') ? parentFolder : parentFolder + '/') : '';
    let name = 'Nouveau dossier';
    let path = finalDir + name;
    let count = 1;
    while (JSON.stringify(tree).includes(`"path":"${path}"`)) {
      name = `Nouveau dossier ${count}`;
      path = finalDir + name;
      count++;
    }

    await fetch('/api/vault/file', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mkdir', path, password: authPassword }),
    });
    refreshTree();
    showToast('Dossier créé ✓');
  };

  // File Operations
  const handleRenameSubmit = async (path: string, isDir: boolean, newName: string) => {
    const oldName = path.split('/').pop() || '';
    setRenamingPath(null); // Close input
    
    if (!newName || newName === oldName || newName === oldName.replace('.md', '')) return;
    
    // Auto append .md for files if missing (but user input usually doesn't have it natively, so we append carefully)
    const finalNewName = newName + (isDir ? '' : (newName.endsWith('.md') ? '' : '.md'));
    
    const parts = path.split('/');
    parts[parts.length - 1] = finalNewName;
    const newPath = parts.join('/');
    
    await fetch('/api/vault/file', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rename', path, newPath, password: authPassword }),
    });
    refreshTree();
    
    if (!isDir) {
      setOpenTabs(prev => prev.map(t => t.id === path ? { ...t, id: newPath, path: newPath } : t));
      if (activeTabId === path) setActiveTabId(newPath);
    }
    showToast('Renommé ✓');
  };

  const handleDelete = async (path: string) => {
    if (!confirm(`Supprimer définitivement ${path} ?`)) return;
    await fetch('/api/vault/file', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, password: authPassword }),
    });
    closeTab(path);
    refreshTree();
    showToast('Supprimé ✓');
  };

  const toggleBookmark = (path: string) => {
    setBookmarks(prev => {
      const isBookmarked = prev.includes(path);
      const newBks = isBookmarked ? prev.filter(p => p !== path) : [...prev, path];
      localStorage.setItem('obsidian-bookmarks', JSON.stringify(newBks));
      return newBks;
    });
    showToast('Favoris mis à jour ✓');
  };

  const handleDrop = async (e: React.DragEvent, targetFolder: string) => {
    e.preventDefault();
    e.stopPropagation();
    const sourcePath = e.dataTransfer.getData('text/plain');
    if (!sourcePath || sourcePath === targetFolder) return;
    
    const fileName = sourcePath.split('/').pop() || '';
    const newPath = targetFolder ? `${targetFolder}/${fileName}` : fileName;
    
    if (sourcePath === newPath) return; // same dir
    
    await fetch('/api/vault/file', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rename', path: sourcePath, newPath, password: authPassword }),
    });
    refreshTree();
    
    setOpenTabs(prev => prev.map(t => t.id === sourcePath ? { ...t, id: newPath, path: newPath } : t));
    if (activeTabId === sourcePath) setActiveTabId(newPath);
    showToast('Déplacé ✓');
  };

  // File stats
  const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
  const charCount = content.length;
  const fileName = activeFile?.split('/').pop()?.replace('.md', '') || '';
  const parentPath = activeFile ? activeFile.split('/').slice(0, -1).join(' / ') : '';

  const backlinks = activeFile ? graphData.edges.filter(e => {
    const targetNode = graphData.nodes.find(n => n.id === e.to);
    const sourceNode = graphData.nodes.find(n => n.id === e.from);
    const fileTitle = activeFile.replace('.md', '').split('/').pop();
    return targetNode?.title?.endsWith(fileTitle || '') || sourceNode?.title?.endsWith(fileTitle || '');
  }).length : 0;

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-[#1e1e1e] overflow-hidden">
      {/* NO TITLEBAR REPLACED BY RIBBON/SIDEBAR AREA */}
      
      {/* ─── Mobile Floating Actions (Bubbles) ─── */}
      <button
        type="button"
        onClick={() => { setLeftTab('search'); setIsMobileNavOpen(true); setIsMobileRightOpen(false); }}
        className="md:hidden fixed bottom-[6vh] left-4 z-[90] w-12 h-12 bg-[#353535] border border-[#444] rounded-full shadow-xl flex items-center justify-center text-white cursor-pointer active:bg-[#555] transition-colors"
      >
        <Search size={20} className="pointer-events-none" />
      </button>

      <button
        type="button"
        onClick={() => setIsBottomSheetOpen(true)}
        className="md:hidden fixed bottom-[6vh] right-4 z-[90] w-12 h-12 bg-[#7c3aed] border border-[#6b21a8] rounded-full shadow-xl flex items-center justify-center text-white cursor-pointer active:bg-[#8b5cf6] transition-colors"
      >
        <Menu size={20} className="pointer-events-none" />
      </button>

      <div className="flex flex-1 overflow-hidden relative">
        {/* ─── Ribbon (icon bar) ─── */}
        <div className="hidden md:flex w-11 bg-[#181818] border-r border-[#2e2e2e] flex-col items-center py-2 gap-1 flex-shrink-0">
          <RibbonBtn icon={<PanelLeft size={18}/>} tooltip="Explorateur" onClick={() => setLeftOpen(!leftOpen)} active={leftOpen} />
          <RibbonBtn icon={<GitFork size={18}/>} tooltip="Ouvrir la vue graphique" onClick={() => openTab('graph', 'graph')} />
          <div className="flex-1" />
          <RibbonBtn icon={<PanelRight size={18}/>} tooltip="Panneau droit" onClick={() => setRightOpen(!rightOpen)} active={rightOpen} />
          <RibbonBtn icon={<HelpCircle size={18}/>} tooltip="À propos" onClick={() => setShowAbout(true)} />
          <RibbonBtn icon={<Settings size={18}/>} tooltip="Paramètres" onClick={() => setShowSettings(true)} />
        </div>

        {/* ─── Backdrop for Mobile Left Sidebar ─── */}
        {isMobileNavOpen && (
          <div className="fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity" onClick={() => setIsMobileNavOpen(false)} />
        )}

        {/* ─── Left Sidebar ─── */}
        {(leftOpen || isMobileNavOpen) && (
          <div className={`
            fixed inset-y-0 left-0 z-50 md:z-0 md:relative
            w-[80vw] max-w-[320px] md:w-[280px] md:max-w-none
            bg-[#181818] border-r border-[#2e2e2e] flex flex-col flex-shrink-0 overflow-hidden
            transform transition-transform duration-300 ease-in-out
            ${isMobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            ${!leftOpen && !isMobileNavOpen ? 'md:hidden' : ''}
          `}>
            {/* Logo/Branding & Tab headers */}
            <div className="flex flex-col border-b border-[#2e2e2e] bg-[#1a1a1a] relative">
              <button 
                className="absolute top-2 right-2 p-2 text-[#888] hover:text-[#dcddde] z-10"
                onClick={() => setIsMobileNavOpen(false)}
              >
                <X size={20} />
              </button>
              <div className="flex items-center gap-1.5 px-4 py-3 select-none">
                <svg viewBox="0 0 100 100" width="18" height="18" className="opacity-80">
                  <defs><linearGradient id="a" x1="82.85" y1="30.41" x2="51.26" y2="105.9" gradientTransform="matrix(1,0,0,-1,-22.41,110.97)" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#6c56cc"/><stop offset="1" stopColor="#9785e5"/></linearGradient></defs>
                  <polygon points="62.61,0 30.91,17.52 18,45.45 37.57,90.47 65.35,100 70.44,89.8 81,26.39 62.61,0" fill="#34208c"/>
                  <polygon points="81,26.39 61.44,14.41 34.43,35.7 65.35,100 70.44,89.8 81,26.39" fill="url(#a)"/>
                </svg>
                <span className="text-[13px] font-semibold text-[#dcddde]">Obsidian-Web</span>
              </div>
              <div className="flex px-1 gap-1 pb-1">
                <TabIconBtn active={leftTab === 'files'} onClick={() => setLeftTab('files')} icon={<FolderClosed size={16}/>} tooltip="Fichiers" />
                <TabIconBtn active={leftTab === 'search'} onClick={() => setLeftTab('search')} icon={<Search size={16}/>} tooltip="Recherche" />
                <TabIconBtn active={leftTab === 'bookmarks'} onClick={() => setLeftTab('bookmarks')} icon={<Bookmark size={16}/>} tooltip="Favoris" />
              </div>
            </div>

            {leftTab === 'files' ? (
              <div 
                className="flex-1 overflow-y-auto p-1"
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, '')}
              >
                <div className="px-2 py-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#888] uppercase tracking-wider">Vault</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { handleCreateNote(''); setIsMobileNavOpen(false); }} className="text-[#888] hover:text-[#dcddde] p-1.5 rounded hover:bg-[#252525]" title="Nouvelle note"><FileText className="w-[18px] h-[18px] md:w-4 md:h-4" /></button>
                    <button onClick={() => handleCreateFolder('')} className="text-[#888] hover:text-[#dcddde] p-1.5 rounded hover:bg-[#252525]" title="Nouveau dossier"><FolderPlus className="w-[18px] h-[18px] md:w-4 md:h-4" /></button>
                    <button onClick={() => setExpandAllToggle(prev => !prev)} className="text-[#888] hover:text-[#dcddde] p-1.5 rounded hover:bg-[#252525]" title="Tout plier / déplier"><ChevronsUpDown className="w-[18px] h-[18px] md:w-4 md:h-4" /></button>
                  </div>
                </div>
                <TreeNodes 
                  nodes={tree} 
                  activeFile={activeFile || null} 
                  onSelect={(p) => { openTab(p, 'note', p); setIsMobileNavOpen(false); }} 
                  level={0}
                  onContextMenu={(e, p, isDir) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, path: p, isDir }); }}
                  onDrop={handleDrop}
                  renamingPath={renamingPath}
                  onRenameSubmit={handleRenameSubmit}
                  expandAllToggle={expandAllToggle}
                />
              </div>
            ) : leftTab === 'search' ? (
              <div className="flex-1 overflow-y-auto p-2">
                <input
                  type="search"
                  placeholder="Rechercher..."
                  className="w-full px-3 py-1.5 bg-[#1e1e1e] border border-[#333] rounded text-sm text-[#dcddde] outline-none focus:border-[#7c3aed] mb-2"
                  value={searchQuery}
                  onChange={e => handleSearch(e.target.value)}
                  autoFocus
                />
                {searchResults.length === 0 && searchQuery.length >= 2 && (
                  <p className="text-xs text-[#666] text-center mt-4">Aucun résultat.</p>
                )}
                {searchResults.map(r => (
                  <SearchResultItem key={r.filePath} result={r} query={searchQuery} onSelect={(p) => { openTab(p, 'note', p); setLeftTab('files'); }} />
                ))}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-2">
                <div className="px-2 py-2 mb-2 border-b border-[#2e2e2e]">
                  <span className="text-[11px] font-semibold text-[#888] uppercase tracking-wider">Favoris</span>
                </div>
                {bookmarks.length === 0 ? (
                  <p className="text-xs text-[#666] text-center mt-4">Aucun favoris.</p>
                ) : (
                  bookmarks.map(b => (
                    <div 
                      key={b} 
                      className="flex items-center justify-between py-1.5 md:py-1 px-2 mb-1 rounded text-sm md:text-[13px] text-[#bbb] hover:bg-[#252525] cursor-pointer" 
                      onClick={() => { openTab(b, 'note', b); setIsMobileNavOpen(false); }}
                      onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, path: b, isDir: false }); }}
                    >
                      <div className="truncate flex-1"><Bookmark size={14} className="inline mr-2 opacity-50"/>{b.split('/').pop()?.replace('.md', '')}</div>
                      <button className="opacity-0 hover:opacity-100 hover:text-red-400" onClick={(e) => { e.stopPropagation(); toggleBookmark(b); }}><X size={12}/></button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── Workspace ─── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]" style={{ fontSize: `${fontSize}px` }}>
          
          {/* Tabs Header */}
          <div className="flex bg-[#181818] border-none h-[44px] overflow-x-auto flex-shrink-0 hide-scrollbar pt-1 px-1 gap-1 items-end border-b border-[#2e2e2e]">
            {/* PanelLeft menu for left sidebar on mobile */}
            <button 
              className="md:hidden p-1 text-[#888] hover:text-[#dcddde] flex-shrink-0 ml-1 mb-1" 
              onClick={() => { setIsMobileNavOpen(true); setIsMobileRightOpen(false); }}
            >
              <PanelLeft className="w-6 h-6" />
            </button>
            {openTabs.map(tab => (
              <div 
                key={tab.id} 
                className={`group flex flex-shrink-0 items-center px-3 md:px-4 rounded-t-md border border-b-0 cursor-pointer max-w-[200px] select-none transition-colors pb-1.5 pt-1.5 -mb-px ${activeTabId === tab.id ? 'bg-[#1e1e1e] text-[#dcddde] border-[#2e2e2e] z-10' : 'bg-transparent text-[#888] border-transparent hover:bg-[#222]'}`} 
                onClick={() => setActiveTabId(tab.id)}
              >
                {tab.type === 'graph' ? <GitFork size={14} className="mr-2 opacity-70"/> : <FileText size={14} className="mr-2 opacity-70"/>}
                <span className="truncate pr-1 text-sm md:text-[13px] font-medium">
                  {tab.type === 'graph' ? 'Vue graphique' : tab.type === 'empty' ? 'Nouvel onglet' : tab.path?.split('/').pop()?.replace('.md', '')}
                </span>
                <div 
                  className={`w-6 h-6 md:w-5 md:h-5 flex-shrink-0 rounded-sm flex items-center justify-center transition-colors hover:bg-[#333] ${activeTabId === tab.id ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}`}
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                >
                  <X className="w-3.5 h-3.5 md:w-3 md:h-3"/>
                </div>
              </div>
            ))}
          </div>

          {/* Tab Actions Header (Active Tab Details) */}
          {activeTabId && activeTab?.type !== 'empty' && (
            <div className="h-[44px] border-b border-[#2e2e2e] flex flex-nowrap items-center px-3 flex-shrink-0 text-sm bg-[#1e1e1e] shadow-sm z-10 w-full relative">
              {activeTab?.type === 'graph' ? (
                <span className="text-[#dcddde] font-medium truncate flex-1">Vue graphique</span>
              ) : activeFile ? (
                <>
                  <div className="flex items-center truncate flex-1 mr-2">
                    {parentPath && <span className="text-[#666] hidden sm:inline mr-1 truncate">{parentPath} /</span>}
                    <span className="text-[#dcddde] font-medium truncate">{fileName}</span>
                    {unsaved && <span className="ml-2 w-2 h-2 rounded-full flex-shrink-0 bg-yellow-500 inline-block" />}
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    {/* Burger for right sidebar on mobile */}
                    <button className="md:hidden p-2 text-[#888] hover:text-[#dcddde]" onClick={() => { setIsMobileRightOpen(true); setIsMobileNavOpen(false); }}>
                      <PanelRight className="w-[22px] h-[22px]" />
                    </button>
                    {mode === 'edit' && (
                      <HeaderBtn icon={<Save className="w-[18px] h-[18px] md:w-4 md:h-4" />} tooltip="Sauvegarder (Ctrl+S)" onClick={handleSave} highlight={unsaved} />
                    )}
                    <HeaderBtn icon={<PanelRight className="w-[18px] h-[18px] md:w-4 md:h-4" />} tooltip="Panneau droit" onClick={() => setRightOpen(!rightOpen)} active={rightOpen} className="hidden md:flex" />
                    <div className="w-px h-4 bg-[#333] mx-1 hidden md:block"></div>
                    <HeaderBtn icon={<PenSquare className="w-[22px] h-[22px] md:w-4 md:h-4" />} tooltip="Éditer" onClick={handleEditClick} active={mode === 'edit'} />
                    <HeaderBtn icon={<BookOpen className="w-[22px] h-[22px] md:w-4 md:h-4" />} tooltip="Lecture" onClick={() => setMode('read')} active={mode === 'read'} />
                    <HeaderBtn icon={<Link className="w-[22px] h-[22px] md:w-4 md:h-4" />} tooltip="Copier l'URL" onClick={() => { 
                      if (navigator.clipboard && window.isSecureContext) {
                        navigator.clipboard.writeText(window.location.href)
                          .then(() => showToast('URL copiée'))
                          .catch(() => showToast('Erreur de copie'));
                      } else {
                        // Fallback HTTP
                        try {
                          const textArea = document.createElement("textarea");
                          textArea.value = window.location.href;
                          textArea.style.position = "fixed";
                          textArea.style.left = "-999999px";
                          textArea.style.top = "-999999px";
                          document.body.appendChild(textArea);
                          textArea.focus();
                          textArea.select();
                          document.execCommand('copy');
                          textArea.remove();
                          showToast('URL copiée');
                        } catch (e) {
                          showToast('Erreur: impossible de copier');
                        }
                      }
                    }} />
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 flex flex-col overflow-y-auto relative bg-[#1e1e1e]">
            {activeTab?.type === 'empty' ? (
              <div className="flex flex-col items-center justify-center h-full text-[#555] p-6 max-w-sm mx-auto w-full">
                <svg viewBox="0 0 100 100" width="64" height="64" className="opacity-20 mb-8">
                  <polygon points="62.61,0 30.91,17.52 18,45.45 37.57,90.47 65.35,100 70.44,89.8 81,26.39 62.61,0" fill="currentColor"/>
                </svg>
                
                <div className="flex flex-col gap-3 w-full">
                  <button 
                    onClick={() => handleCreateNote('')}
                    className="flex items-center gap-3 px-4 py-3 bg-[#2a2a2a] hover:bg-[#333] border border-[#3e3e3e] rounded-lg text-[#dcddde] transition-colors w-full text-left shadow-sm"
                  >
                    <FileText size={18} className="text-[#888]" />
                    <span className="font-medium">Créer un nouveau fichier</span>
                  </button>
                  <button 
                    onClick={() => { setLeftTab('search'); setIsMobileNavOpen(true); setIsMobileRightOpen(false); }}
                    className="flex items-center gap-3 px-4 py-3 bg-[#2a2a2a] hover:bg-[#333] border border-[#3e3e3e] rounded-lg text-[#dcddde] transition-colors w-full text-left shadow-sm"
                  >
                    <Search size={18} className="text-[#888]" />
                    <span className="font-medium">Rechercher</span>
                  </button>
                  <button 
                    onClick={() => openTab('graph', 'graph')}
                    className="flex items-center gap-3 px-4 py-3 bg-[#2a2a2a] hover:bg-[#333] border border-[#3e3e3e] rounded-lg text-[#dcddde] transition-colors w-full text-left shadow-sm"
                  >
                    <GitFork size={18} className="text-[#888]" />
                    <span className="font-medium">Ouvrir la vue graphique</span>
                  </button>
                </div>
              </div>
            ) : activeTab?.type === 'graph' ? (
              <GraphView nodes={graphData.nodes} edges={graphData.edges} onNodeClick={(title) => handleNavigate(title)} />
            ) : isLoading ? (
              <div className="flex items-center justify-center h-full text-[#555] text-sm">Chargement...</div>
            ) : mode === 'read' ? (
              <div className="py-8 flex-1">
                <MarkdownViewer content={content} onNavigate={handleNavigate} />
              </div>
            ) : (
              <MarkdownEditor
                content={content}
                onChange={v => { setContent(v); setUnsaved(true); }}
                onSave={() => handleSave()}
              />
            )}
          </div>
        </div>

        {/* ─── Backdrop for Mobile Right Sidebar ─── */}
        {isMobileRightOpen && (
          <div className="fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity" onClick={() => setIsMobileRightOpen(false)} />
        )}

        {/* ─── Right Sidebar ─── */}
        {(rightOpen || isMobileRightOpen) && activeFile && (
          <div className={`
            fixed inset-y-0 right-0 z-50 md:z-0 md:relative
            w-[80vw] max-w-[320px] md:w-[280px] md:max-w-none
            bg-[#181818] border-l border-[#2e2e2e] flex flex-col flex-shrink-0 overflow-y-auto
            transform transition-transform duration-300 ease-in-out
            ${isMobileRightOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
            ${!rightOpen && !isMobileRightOpen ? 'md:hidden' : ''}
          `}>
            <SideSection title="Sommaire" icon={<List size={14}/>}>
              {toc.length === 0 ? (
                <p className="text-xs text-[#555] px-3">Aucun titre trouvé</p>
              ) : (
                <div className="px-2">
                  {toc.map((h, i) => (
                    <a key={i} href={`#${h.id}`} className="block text-[13px] text-[#999] hover:text-[#dcddde] py-0.5 truncate transition-colors" style={{ paddingLeft: `${(h.level - 1) * 12}px` }}>
                      {h.text}
                    </a>
                  ))}
                </div>
              )}
            </SideSection>

            <SideSection title="Tags" icon={<Tags size={14}/>}>
              <div className="px-3 flex flex-wrap gap-1">
                {extractTags(content).map(tag => (
                  <span key={tag} className="text-xs bg-[#2a2a2a] text-[#e98c37] px-2 py-0.5 rounded cursor-pointer hover:bg-[#353535] transition-colors" onClick={() => { handleSearch(tag); setLeftTab('search'); }}>
                    {tag}
                  </span>
                ))}
                {extractTags(content).length === 0 && <p className="text-xs text-[#555]">Aucun tag</p>}
              </div>
            </SideSection>

            <SideSection title={`Liens (${backlinks})`} icon={<GitFork size={14}/>}>
              <p className="text-xs text-[#555] px-3">{backlinks} mention(s)</p>
            </SideSection>
          </div>
        )}

        {/* ─── Bottom Sheet Menu (Mobile) ─── */}
        <div 
          className={`md:hidden fixed inset-0 z-[9999] flex flex-col justify-end transition-opacity duration-300 ${isBottomSheetOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        >
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsBottomSheetOpen(false)} />
          <div 
            className={`relative bg-[#1a1a1a] border-t border-[#2e2e2e] rounded-t-2xl p-4 flex flex-col gap-2 pb-8 shadow-2xl transition-transform duration-300 transform ${isBottomSheetOpen ? 'translate-y-0' : 'translate-y-full'}`}
          >
            <div className="w-12 h-1 bg-[#333] rounded-full mx-auto mb-2" />
            
            <button 
              onClick={() => { setIsBottomSheetOpen(false); handleCreateNote(''); setIsMobileNavOpen(false); setIsMobileRightOpen(false); }}
              className="flex items-center gap-3 p-3 rounded-xl active:bg-[#333] transition-colors text-white text-base font-medium"
            >
              <div className="w-10 h-10 rounded-full bg-[#7c3aed] flex items-center justify-center">
                <FileText size={20} />
              </div>
              Créer une note
            </button>
            
            <button 
              onClick={() => { setIsBottomSheetOpen(false); openTab('graph', 'graph'); setIsMobileNavOpen(false); setIsMobileRightOpen(false); }}
              className="flex items-center gap-3 p-3 rounded-xl active:bg-[#333] transition-colors text-white text-base font-medium"
            >
              <div className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center border border-[#3e3e3e]">
                <GitFork size={20} />
              </div>
              Ouvrir la vue graphique
            </button>

            <button 
              onClick={() => { setIsBottomSheetOpen(false); setIsMobileRightOpen(true); setIsMobileNavOpen(false); }}
              className="flex items-center gap-3 p-3 rounded-xl active:bg-[#333] transition-colors text-white text-base font-medium"
            >
              <div className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center border border-[#3e3e3e]">
                <PanelRight size={20} />
              </div>
              Ouvrir le panneau droit
            </button>
          </div>
        </div>
      </div>

      {/* ─── Status Bar ─── */}
      <div className="hidden md:flex status-bar">
        <span>{backlinks} backlinks</span>
        <span>{wordCount} mots</span>
        <span>{charCount} caractères</span>
        <div className="flex-1" />
        <span>{mode === 'edit' ? 'Édition' : 'Lecture'}</span>
      </div>

      {/* ─── Toast ─── */}
      {toast && <div className="toast">{toast}</div>}

      {/* ─── Context Menu ─── */}
      {contextMenu && (
        <div 
          className="fixed bg-[#2a2a2a] border border-[#444] rounded shadow-lg overflow-hidden z-[10000] text-[13px] text-[#dcddde] min-w-[150px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          { !contextMenu.isDir && (
            <div className="px-3 py-1.5 hover:bg-[#7c3aed] cursor-pointer transition-colors" onClick={() => { toggleBookmark(contextMenu.path); setContextMenu(null); }}>
              {bookmarks.includes(contextMenu.path) ? "Retirer des favoris" : "Ajouter aux favoris"}
            </div>
          )}
          <div className="px-3 py-1.5 hover:bg-[#7c3aed] cursor-pointer transition-colors" onClick={() => { setRenamingPath(contextMenu.path); setContextMenu(null); }}>Renommer...</div>
          <div className="px-3 py-1.5 hover:bg-red-500 cursor-pointer transition-colors border-t border-[#444]" onClick={() => { handleDelete(contextMenu.path); setContextMenu(null); }}>Supprimer (Definitif)</div>
        </div>
      )}
      {/* ─── Auth Modal ─── */}
      {showAuth && (
        <div className="modal-overlay" onClick={() => setShowAuth(false)}>
          <div className="modal-card p-6 w-[92%] max-w-[400px] relative" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 p-1 text-[#666] hover:text-[#999]" onClick={() => setShowAuth(false)}>
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-[#dcddde]"><Lock size={20}/> Authentification</h2>
            <p className="text-sm text-[#999] mb-6">Un mot de passe est requis pour accéder au mode édition.</p>
            <input 
              type="password" 
              placeholder="Mot de passe" 
              className="auth-input mb-4" 
              value={authPassword}
              onChange={e => setAuthPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAuthSubmit()}
              autoFocus
            />
            <div className="flex gap-2">
              <button className="auth-btn bg-[#444] hover:bg-[#555]" onClick={() => setShowAuth(false)}>Annuler</button>
              <button className="auth-btn" onClick={handleAuthSubmit}>Déverrouiller</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Settings Modal ─── */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-card p-6 w-[90%] max-w-[400px] relative" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 p-1 text-[#666] hover:text-[#999] md:hidden" onClick={() => setShowSettings(false)}>
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Settings size={20}/> Paramètres</h2>
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2 text-[#bbb]">Taille de police de l'éditeur ({fontSize}px)</label>
              <input 
                type="range" min="12" max="24" value={fontSize} 
                onChange={e => setFontSize(parseInt(e.target.value))}
                className="w-full accent-[#7c3aed]"
              />
            </div>
            <div className="flex justify-end">
              <button className="bg-[#7c3aed] text-white px-4 py-2 rounded font-medium hover:bg-[#8b5cf6] transition-colors" onClick={() => setShowSettings(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── About Modal ─── */}
      {showAbout && (
        <div className="modal-overlay" onClick={() => setShowAbout(false)}>
          <div className="modal-card p-6 text-center w-[90%] max-w-[400px] relative" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 p-1 text-[#666] hover:text-[#999] md:hidden" onClick={() => setShowAbout(false)}>
              <X size={20} />
            </button>
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-[#7c3aed] to-[#34208c] rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <svg viewBox="0 0 100 100" width="32" height="32" className="text-white fill-current">
                <polygon points="62.61,0 30.91,17.52 18,45.45 37.57,90.47 65.35,100 70.44,89.8 81,26.39 62.61,0" opacity="0.9"/>
                <polygon points="81,26.39 61.44,14.41 34.43,35.7 65.35,100 70.44,89.8 81,26.39" opacity="0.6"/>
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2">Obsidian-Web</h2>
            <p className="text-[#999] mb-6">v0.1.0 • Interface web pour Obsidian</p>
            <button className="bg-[#333] text-white px-6 py-2 rounded-full font-medium hover:bg-[#444] transition-colors" onClick={() => setShowAbout(false)}>Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper Components ──────────────────────────────────

function RibbonBtn({ icon, tooltip, onClick, active }: { icon: React.ReactNode; tooltip: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${active ? 'text-[#dcddde] bg-[#2a2a2a]' : 'text-[#666] hover:text-[#999] hover:bg-[#222]'}`}
    >{icon}</button>
  );
}

function TabIconBtn({ active, onClick, icon, tooltip }: { active: boolean; onClick: () => void; icon: React.ReactNode; tooltip: string }) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`flex-1 flex items-center justify-center py-2 text-xs font-medium border-b-2 transition-colors ${active ? 'border-[#7c3aed] text-[#dcddde] bg-[#222]' : 'border-transparent text-[#666] hover:text-[#999] hover:bg-[#222]'}`}
    >{icon}</button>
  );
}

function HeaderBtn({ icon, tooltip, onClick, active, highlight, className }: { icon: React.ReactNode; tooltip: string; onClick: () => void; active?: boolean; highlight?: boolean; className?: string }) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`p-1.5 rounded transition-colors ${active ? 'bg-[#353535] text-white' : highlight ? 'text-yellow-400 hover:bg-[#2a2a2a]' : 'text-[#666] hover:text-[#999] hover:bg-[#2a2a2a]'} ${className || ''}`}
    >{icon}</button>
  );
}

function SideSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-[#2e2e2e]">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#888] hover:text-[#bbb] transition-colors">
        {open ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
        {icon}
        {title}
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}

// ─── Tree View ──────────────────────────────────────────

interface TreeProps {
  nodes: FileNode[]; 
  activeFile: string | null; 
  onSelect: (p: string) => void; 
  level: number;
  onContextMenu: (e: React.MouseEvent, p: string, isDir: boolean) => void;
  onDrop: (e: React.DragEvent, folderPath: string) => void;
  renamingPath: string | null;
  onRenameSubmit: (path: string, isDir: boolean, newName: string) => void;
  expandAllToggle: boolean;
}

function TreeNodes({ nodes, activeFile, onSelect, level, onContextMenu, onDrop, renamingPath, onRenameSubmit, expandAllToggle }: TreeProps) {
  return (
    <>
      {nodes.map(n => (
        <TreeNode 
          key={n.path} 
          nodes={nodes}
          node={n} 
          activeFile={activeFile}
          onSelect={onSelect}
          level={level}
          onContextMenu={onContextMenu}
          onDrop={onDrop}
          renamingPath={renamingPath}
          onRenameSubmit={onRenameSubmit}
          expandAllToggle={expandAllToggle}
        />
      ))}
    </>
  );
}

function TreeNode({ node, activeFile, onSelect, level, onContextMenu, onDrop, renamingPath, onRenameSubmit, expandAllToggle }: TreeProps & { node: FileNode }) {
  const [open, setOpen] = useState(false);
  const isDir = node.type === 'directory';
  const isActive = activeFile === node.path;
  const isRenaming = renamingPath === node.path;

  useEffect(() => {
    if (isDir) setOpen(expandAllToggle);
  }, [expandAllToggle, isDir]);

  return (
    <>
      <div
        onClick={() => isDir ? setOpen(!open) : onSelect(node.path)}
        onContextMenu={(e) => onContextMenu(e, node.path, isDir)}
        draggable={!isRenaming}
        onDragStart={(e) => e.dataTransfer.setData('text/plain', node.path)}
        onDragOver={isDir ? e => e.preventDefault() : undefined}
        onDrop={isDir ? e => onDrop(e, node.path) : undefined}
        className={`flex items-center py-2 md:py-1.5 px-2 rounded cursor-pointer select-none text-sm md:text-[13px] transition-colors ${isActive && !isRenaming ? 'bg-[#353535] text-white' : 'text-[#bbb] hover:bg-[#252525]'}`}
        style={{ paddingLeft: `${level * 14 + 8}px` }}
      >
        <span className="mr-2 opacity-60 flex-shrink-0">
          {isDir ? (open ? <ChevronDown size={16}/> : <ChevronRight size={16}/>) : <FileText size={16} className="opacity-40"/>}
        </span>
        <span className="truncate flex-1">
          {isRenaming ? (
            <input 
              type="text" 
              defaultValue={node.name.replace('.md', '')}
              autoFocus
              className="bg-[#111] text-white px-1 border border-[#7c3aed] rounded outline-none w-full"
              onClick={e => e.stopPropagation()}
              onBlur={(e) => onRenameSubmit(node.path, isDir, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRenameSubmit(node.path, isDir, e.currentTarget.value);
                if (e.key === 'Escape') onRenameSubmit(node.path, isDir, node.name);
              }}
            />
          ) : (
            node.name.replace('.md', '')
          )}
        </span>
      </div>
      {isDir && open && node.children && (
        <TreeNodes 
          nodes={node.children} 
          activeFile={activeFile} 
          onSelect={onSelect} 
          level={level + 1} 
          onContextMenu={onContextMenu} 
          onDrop={onDrop} 
          renamingPath={renamingPath} 
          onRenameSubmit={onRenameSubmit} 
          expandAllToggle={expandAllToggle} 
        />
      )}
    </>
  );
}

// ─── Search Result ──────────────────────────────────────

function SearchResultItem({ result, query, onSelect }: { result: SearchResult; query: string; onSelect: (p: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 py-2 md:py-1.5 px-2 rounded cursor-pointer text-sm md:text-[13px] text-[#bbb] hover:bg-[#252525]" onClick={() => onSelect(result.filePath)}>
        <FileText size={16} className="opacity-40 flex-shrink-0"/>
        <span className="truncate flex-1">{result.filePath.replace('.md', '')}</span>
        <span className="text-[11px] bg-[#2a2a2a] text-[#888] px-1.5 rounded cursor-pointer" onClick={e => { e.stopPropagation(); setOpen(!open); }}>{result.matches.length}</span>
      </div>
      {open && (
        <div className="ml-6 text-xs text-[#777] space-y-0.5 pb-1">
          {result.matches.map((m, i) => <div key={i} className="truncate" dangerouslySetInnerHTML={{ __html: highlightQuery(m, query) }} />)}
        </div>
      )}
    </div>
  );
}

function highlightQuery(text: string, query: string): string {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<span class="text-[#7c3aed] font-semibold">$1</span>');
}

import { Network } from 'vis-network';
import { DataSet } from 'vis-data';

// ─── Graph View (vis-network) ───────────────────────────

function GraphView({ nodes, edges, onNodeClick }: { nodes: GraphNode[]; edges: GraphEdge[]; onNodeClick: (title: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);

  useEffect(() => {
    if (!containerRef.current || nodes.length === 0) return;

    const data = {
      nodes: new DataSet(
        nodes.map(n => ({
          id: n.id,
          label: n.label,
          title: n.title,
          group: n.group,
          value: n.value || 1,
          font: { color: '#dcddde', size: 12, face: 'Inter' },
          color: {
            background: n.group === 'tag' ? '#e98c37' : '#666666',
            border: n.group === 'tag' ? '#b56d2b' : '#444444',
            highlight: { background: '#8b5cf6', border: '#a78bfa' }
          },
          shape: 'dot',
          scaling: { min: 4, max: 15 },
        }))
      ),
      edges: new DataSet(
        edges.map((e, idx) => ({
          id: `edge-${idx}`,
          from: e.from,
          to: e.to,
          color: { color: '#333', highlight: '#7c3aed' },
          width: 1,
          selectionWidth: 2,
        }))
      )
    };

    const options = {
      physics: {
        forceAtlas2Based: { gravitationalConstant: -50, centralGravity: 0.01, springLength: 100, springConstant: 0.08 },
        maxVelocity: 50,
        solver: 'forceAtlas2Based',
        timestep: 0.35,
        stabilization: { iterations: 150 }
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        zoomView: true,
        dragView: true
      },
      edges: { smooth: false },
      layout: { improvedLayout: false }
    };

    networkRef.current = new Network(containerRef.current, data, options);

    // We removed strict constraints to allow free zooming, but we can still listen to zoom if needed in the future.

    networkRef.current.on('click', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.group !== 'tag') {
          onNodeClick(node.title + '.md');
        }
      }
    });

    return () => {
      networkRef.current?.destroy();
    };
  }, [nodes, edges, onNodeClick]);

  return (
    <div className="absolute inset-0 bg-[#1e1e1e]">
      {nodes.length === 0 ? (
        <div className="p-8 text-center text-[#555] text-sm">Aucune donnée de graphe</div>
      ) : (
        <>
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
          <button 
            onClick={() => networkRef.current?.fit({ animation: { duration: 500, easingFunction: 'easeInOutQuad' } })} 
            className="absolute bottom-6 right-6 flex items-center gap-2 bg-[#2a2a2a] hover:bg-[#353535] text-[#dcddde] px-3 py-2 rounded shadow-lg border border-[#444] text-sm transition-colors z-10"
            title="Recentrer le graphe"
          >
            <Focus size={16} className="text-[#8b5cf6]" />
            Recentrer
          </button>
        </>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────

function flattenTree(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = [];
  for (const n of nodes) {
    if (n.type === 'file') result.push(n);
    if (n.children) result.push(...flattenTree(n.children));
  }
  return result;
}

function extractTags(content: string): string[] {
  const tags = content.match(/(?:^|\s)#([a-zA-Z0-9_\u00C0-\u024F]+)/g) || [];
  return [...new Set(tags.map(t => t.trim()))];
}

