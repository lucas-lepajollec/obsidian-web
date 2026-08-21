'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  FolderClosed, Search, ChevronDown, ChevronRight, FileText, PanelLeft, PanelRight,
  PenSquare, BookOpen, Link, Settings, HelpCircle, GitFork, List, X,
  Save, FolderPlus, ChevronsUpDown, Tags, Bookmark, Focus, Menu, FolderTree
} from 'lucide-react';
import { FileNode } from '@/lib/vault';
import { ApiError, apiFetch } from '@/lib/client-api';
import MarkdownViewer from '@/components/MarkdownViewer';
import MarkdownEditor from '@/components/MarkdownEditor';

// ─── Types ──────────────────────────────────────────────
interface SearchResult { filePath: string; fileName: string; matches: string[] }
interface GraphNode { id: number; label: string; title: string; group: 'note' | 'folder' | 'root'; value?: number }
interface GraphEdge { from: number; to: number }
interface GraphDataset { nodes: GraphNode[]; edges: GraphEdge[] }
interface GraphData { links: GraphDataset; folders: GraphDataset }

const EMPTY_GRAPH_DATA: GraphData = {
  links: { nodes: [], edges: [] },
  folders: { nodes: [], edges: [] },
};

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
  const contentRef = useRef('');
  const [fileMtimeMs, setFileMtimeMs] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
  const [graphData, setGraphData] = useState<GraphData>(EMPTY_GRAPH_DATA);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [fontSize, setFontSize] = useState(15);

  // Auth state for edit
  const [showAuth, setShowAuth] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authConfigured, setAuthConfigured] = useState(true);
  const [publicRead, setPublicRead] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const reportError = useCallback((error: unknown, fallback: string) => {
    showToast(error instanceof Error ? error.message : fallback);
    if (error instanceof ApiError && error.status === 401) {
      setIsAuthenticated(false);
      setShowAuth(true);
    }
  }, [showToast]);

  // Load tree + graph
  const refreshTree = useCallback(async () => {
    try {
      const [treeData, graph] = await Promise.all([
        apiFetch<{ tree: FileNode[] }>('/api/vault/tree'),
        apiFetch<GraphData>('/api/vault/graph'),
      ]);
      setTree(treeData.tree);
      setGraphData(graph);
    } catch (error) {
      reportError(error, 'Unable to load the vault.');
    }
  }, [reportError]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ authenticated: boolean; configured: boolean; publicRead: boolean }>('/api/auth/session')
      .then(session => {
        if (cancelled) return;
        setIsAuthenticated(session.authenticated);
        setAuthConfigured(session.configured);
        setPublicRead(session.publicRead);
        if (session.authenticated || session.publicRead) void refreshTree();
        else setShowAuth(true);
      })
      .catch(error => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 503) setAuthConfigured(false);
        setAuthError(error instanceof Error ? error.message : 'Authentication is unavailable.');
        setShowAuth(true);
      });
    queueMicrotask(() => {
      const savedBookmarks = localStorage.getItem('shardnote-bookmarks');
      if (savedBookmarks) {
        try { setBookmarks(JSON.parse(savedBookmarks)); } catch {}
      }
    });
    return () => { cancelled = true; };
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
    let cancelled = false;
    apiFetch<{ content: string; mtimeMs: number }>(`/api/vault/file?path=${encodeURIComponent(activeFile)}`)
      .then(data => {
        if (cancelled) return;
        setContent(data.content);
        setFileMtimeMs(data.mtimeMs);
        setUnsaved(false);
        setIsLoading(false);
      })
      .catch(error => {
        if (cancelled) return;
        setIsLoading(false);
        reportError(error, 'Unable to open this note.');
      });
    return () => { cancelled = true; };
  }, [activeFile, reportError]);

  // Build TOC without duplicating derived state.
  const toc = useMemo(() => {
    const headings: { level: number; text: string; id: string }[] = [];
    const regex = /^(#{1,6})\s+(.+)$/gm;
    let match;
    while ((match = regex.exec(content))) {
      const level = match[1].length;
      const text = match[2].trim();
      const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      headings.push({ level, text, id });
    }
    return headings;
  }, [content]);

  // Save handler
  const handleSave = useCallback(async () => {
    if (!activeFile || !unsaved || isSaving) return;
    const contentToSave = content;
    setIsSaving(true);
    try {
      const result = await apiFetch<{ mtimeMs: number }>('/api/vault/file', {
        method: 'POST',
        body: JSON.stringify({ path: activeFile, content: contentToSave, expectedMtimeMs: fileMtimeMs }),
      });
      setFileMtimeMs(result.mtimeMs);
      if (contentRef.current === contentToSave) {
        setUnsaved(false);
        showToast('Saved safely');
      }
    } catch (error) {
      reportError(error, 'Unable to save this note.');
    } finally {
      setIsSaving(false);
    }
  }, [activeFile, content, fileMtimeMs, isSaving, reportError, showToast, unsaved]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  useEffect(() => {
    if (!unsaved || mode !== 'edit' || !isAuthenticated) return;
    const timer = window.setTimeout(() => void handleSave(), 1500);
    return () => window.clearTimeout(timer);
  }, [content, handleSave, isAuthenticated, mode, unsaved]);

  useEffect(() => {
    const protectUnsaved = (event: BeforeUnloadEvent) => {
      if (!unsaved) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protectUnsaved);
    return () => window.removeEventListener('beforeunload', protectUnsaved);
  }, [unsaved]);

  // Search
  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const data = await apiFetch<{ results: SearchResult[] }>(`/api/vault/search?q=${encodeURIComponent(q)}`);
      setSearchResults(data.results);
    } catch (error) {
      reportError(error, 'Search failed.');
    }
  }, [reportError]);

  // Edit button click
  const handleEditClick = () => {
    if (!isAuthenticated) {
      setShowAuth(true);
    } else {
      setMode(mode === 'edit' ? 'read' : 'edit');
    }
  };

  const handleAuthSubmit = async () => {
    setAuthError('');
    try {
      await apiFetch<{ authenticated: boolean }>('/api/auth/session', {
        method: 'POST',
        body: JSON.stringify({ password: authPassword }),
      });
      setAuthPassword('');
      setIsAuthenticated(true);
      setShowAuth(false);
      setMode('edit');
      await refreshTree();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Sign-in failed.');
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/session', { method: 'DELETE' });
      setIsAuthenticated(false);
      setMode('read');
      setShowSettings(false);
      if (!publicRead) {
        setTree([]);
        setGraphData(EMPTY_GRAPH_DATA);
        setContent('');
        setShowAuth(true);
      }
      showToast('Session verrouillée');
    } catch (error) {
      reportError(error, 'Impossible de verrouiller la session.');
    }
  };

  // Tab Management
  const confirmDiscardChanges = useCallback(() => (
    !unsaved || window.confirm('Cette note contient des modifications non enregistrées. Les abandonner ?')
  ), [unsaved]);

  const openTab = (id: string, type: 'note' | 'graph' | 'empty', path?: string) => {
    if (id !== activeTabId && !confirmDiscardChanges()) return;
    if (type === 'note') {
      setIsLoading(true);
      setMode('read');
    }
    if (!openTabs.find(t => t.id === id)) {
      setOpenTabs(prev => [...prev, { id, type, path }]);
    }
    setActiveTabId(id);
  };

  const closeTab = (id: string, force = false) => {
    if (!force && id === activeTabId && !confirmDiscardChanges()) return;
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

    try {
      await apiFetch('/api/vault/file', {
        method: 'POST',
        body: JSON.stringify({ path, content: `# ${name}\n\n` }),
      });
      await refreshTree();
      openTab(path, 'note', path);
      setIsMobileNavOpen(false);
      showToast('Note créée');
    } catch (error) {
      reportError(error, 'Impossible de créer la note.');
    }
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

    try {
      await apiFetch('/api/vault/file', {
        method: 'PUT',
        body: JSON.stringify({ action: 'mkdir', path }),
      });
      await refreshTree();
      showToast('Dossier créé');
    } catch (error) {
      reportError(error, 'Impossible de créer le dossier.');
    }
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
    
    try {
      await apiFetch('/api/vault/file', {
        method: 'PUT',
        body: JSON.stringify({ action: 'rename', path, newPath }),
      });
      await refreshTree();
      if (!isDir) {
        setOpenTabs(prev => prev.map(t => t.id === path ? { ...t, id: newPath, path: newPath } : t));
        if (activeTabId === path) setActiveTabId(newPath);
      }
      showToast('Renommé');
    } catch (error) {
      reportError(error, 'Impossible de renommer cet élément.');
    }
  };

  const handleDelete = async (path: string) => {
    if (!confirm(`Déplacer ${path} vers la corbeille ShardNote ?`)) return;
    try {
      await apiFetch('/api/vault/file', {
        method: 'DELETE',
        body: JSON.stringify({ path }),
      });
      closeTab(path, true);
      setUnsaved(false);
      await refreshTree();
      showToast('Déplacé dans la corbeille');
    } catch (error) {
      reportError(error, 'Impossible de supprimer cet élément.');
    }
  };

  const toggleBookmark = (path: string) => {
    setBookmarks(prev => {
      const isBookmarked = prev.includes(path);
      const newBks = isBookmarked ? prev.filter(p => p !== path) : [...prev, path];
      localStorage.setItem('shardnote-bookmarks', JSON.stringify(newBks));
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
    
    try {
      await apiFetch('/api/vault/file', {
        method: 'PUT',
        body: JSON.stringify({ action: 'rename', path: sourcePath, newPath }),
      });
      await refreshTree();
      setOpenTabs(prev => prev.map(t => t.id === sourcePath ? { ...t, id: newPath, path: newPath } : t));
      if (activeTabId === sourcePath) setActiveTabId(newPath);
      showToast('Déplacé');
    } catch (error) {
      reportError(error, 'Impossible de déplacer cet élément.');
    }
  };

  // File stats
  const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
  const charCount = content.length;
  const fileName = activeFile?.split('/').pop()?.replace('.md', '') || '';
  const parentPath = activeFile ? activeFile.split('/').slice(0, -1).join(' / ') : '';

  const activeGraphNode = activeFile
    ? graphData.links.nodes.find(node => node.title === activeFile.replace(/\.md$/i, ''))
    : undefined;
  const backlinks = activeGraphNode
    ? graphData.links.edges.filter(edge => edge.from === activeGraphNode.id || edge.to === activeGraphNode.id).length
    : 0;

  return (
    <div className="shardnote-shell flex flex-col h-[100dvh] w-full bg-[#1e1e1e] overflow-hidden">
      {/* NO TITLEBAR REPLACED BY RIBBON/SIDEBAR AREA */}
      
      {/* ─── Mobile Floating Actions (Bubbles) ─── */}
      <button
        type="button"
        onClick={() => { setLeftTab('search'); setIsMobileNavOpen(true); setIsMobileRightOpen(false); }}
        className="mobile-fab mobile-fab-left md:hidden fixed z-[90] flex items-center justify-center cursor-pointer"
        aria-label="Rechercher dans le coffre"
      >
        <Search size={19} className="pointer-events-none" />
      </button>

      <button
        type="button"
        onClick={() => setIsBottomSheetOpen(true)}
        className="mobile-fab mobile-fab-primary mobile-fab-right md:hidden fixed z-[90] flex items-center justify-center cursor-pointer"
        aria-label="Ouvrir les actions rapides"
      >
        <Menu size={19} className="pointer-events-none" />
      </button>

      <div className="flex flex-1 overflow-hidden relative">
        {/* ─── Ribbon (icon bar) ─── */}
        <div className="workspace-rail hidden md:flex w-11 bg-[#181818] border-r border-[#2e2e2e] flex-col items-center py-2 gap-1 flex-shrink-0">
          <RibbonBtn icon={<PanelLeft size={18}/>} tooltip="Explorateur" onClick={() => setLeftOpen(!leftOpen)} active={leftOpen} />
          <RibbonBtn icon={<GitFork size={18}/>} tooltip="Ouvrir la vue graphique" onClick={() => openTab('graph', 'graph')} />
          <div className="flex-1" />
          <RibbonBtn icon={<PanelRight size={18}/>} tooltip="Panneau droit" onClick={() => setRightOpen(!rightOpen)} active={rightOpen} />
          <RibbonBtn icon={<HelpCircle size={18}/>} tooltip="À propos" onClick={() => setShowAbout(true)} />
          <RibbonBtn icon={<Settings size={18}/>} tooltip="Paramètres" onClick={() => setShowSettings(true)} />
        </div>

        {/* ─── Backdrop for Mobile Left Sidebar ─── */}
        {isMobileNavOpen && (
          <div className="mobile-backdrop fixed inset-0 z-40 md:hidden" onClick={() => setIsMobileNavOpen(false)} />
        )}

        {/* ─── Left Sidebar ─── */}
        {(leftOpen || isMobileNavOpen) && (
          <div className={`
            fixed inset-y-0 left-0 z-50 md:z-0 md:relative
            w-[min(88vw,360px)] max-w-none md:w-[280px]
            workspace-sidebar workspace-sidebar-left bg-[#181818] border-r border-[#2e2e2e] flex flex-col flex-shrink-0 overflow-hidden
            transform transition-transform duration-300 ease-in-out
            ${isMobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            ${!leftOpen && !isMobileNavOpen ? 'md:hidden' : ''}
          `}>
            {/* Logo/Branding & Tab headers */}
            <div className="sidebar-header flex flex-col border-b border-[#2e2e2e] relative">
              <button 
                className="workspace-icon-button md:hidden absolute top-2 right-2 p-2 text-[#888] hover:text-[#dcddde] z-10"
                onClick={() => setIsMobileNavOpen(false)}
              >
                <X size={20} />
              </button>
              <div className="sidebar-brand-row flex items-center gap-1.5 px-4 select-none">
                <ShardNoteMark size={20} />
                <span className="text-[13px] font-semibold text-[#eef4ff]">ShardNote</span>
              </div>
              <div className="sidebar-tabs-row flex px-1 gap-1">
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
                  className="w-full px-3 py-1.5 bg-[#1e1e1e] border border-[#333] rounded text-sm text-[#dcddde] outline-none focus:border-[#7487b8] mb-2"
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
        <div className="workspace-main flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]" style={{ fontSize: `${fontSize}px` }}>
          
          {/* Tabs Header */}
          <div className="workspace-tabs flex bg-[#181818] border-none h-[38px] overflow-x-auto flex-shrink-0 hide-scrollbar px-1.5 gap-1 items-center border-b border-[#2e2e2e]">
            {/* PanelLeft menu for left sidebar on mobile */}
            <button 
              className="workspace-icon-button md:hidden p-1 text-[#888] hover:text-[#dcddde] flex-shrink-0 ml-1"
              onClick={() => { setIsMobileNavOpen(true); setIsMobileRightOpen(false); }}
              aria-label="Ouvrir l’explorateur"
            >
              <PanelLeft className="w-6 h-6" />
            </button>
            {openTabs.map(tab => (
              <div 
                key={tab.id} 
                className={`workspace-tab group flex flex-shrink-0 items-center px-3 md:px-3.5 rounded-lg border cursor-pointer max-w-[200px] select-none py-1 ${activeTabId === tab.id ? 'workspace-tab-active bg-[#232630] text-[#eef4ff] border-[#394154] z-10' : 'bg-transparent text-[#828a99] border-transparent hover:bg-[#222630]'}`}
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
          {activeTabId && (
            <div className="workspace-toolbar h-[40px] border-b border-[#2e2e2e] flex flex-nowrap items-center px-3 flex-shrink-0 text-sm bg-[#1e1e1e] z-10 w-full relative">
              {activeTab?.type === 'empty' ? (
                <span className="text-[#8d95a2] font-medium truncate flex-1">Nouvel onglet</span>
              ) : activeTab?.type === 'graph' ? (
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
                    <button className="workspace-icon-button md:hidden p-2 text-[#888] hover:text-[#dcddde]" onClick={() => { setIsMobileRightOpen(true); setIsMobileNavOpen(false); }} aria-label="Ouvrir les informations de la note">
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
                        } catch {
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
          <div className="workspace-canvas flex-1 flex flex-col overflow-y-auto relative bg-[#1e1e1e]">
            {activeTab?.type === 'empty' ? (
              <div className="flex flex-col items-center justify-center h-full text-[#555] p-6 max-w-sm mx-auto w-full">
                <div className="empty-state-mark mb-5" aria-hidden="true">
                  <ShardNoteMark size={44} />
                </div>
                
                <div className="flex flex-col gap-3 w-full">
                  <button 
                    onClick={() => handleCreateNote('')}
                    className="launch-card flex items-center gap-3 px-4 py-3 bg-[#2a2a2a] border border-[#3e3e3e] rounded-xl text-[#dcddde] w-full text-left"
                  >
                    <FileText size={18} className="text-[#888]" />
                    <span className="font-medium">Créer un nouveau fichier</span>
                  </button>
                  <button 
                    onClick={() => { setLeftTab('search'); setIsMobileNavOpen(true); setIsMobileRightOpen(false); }}
                    className="launch-card flex items-center gap-3 px-4 py-3 bg-[#2a2a2a] border border-[#3e3e3e] rounded-xl text-[#dcddde] w-full text-left"
                  >
                    <Search size={18} className="text-[#888]" />
                    <span className="font-medium">Rechercher</span>
                  </button>
                  <button 
                    onClick={() => openTab('graph', 'graph')}
                    className="launch-card flex items-center gap-3 px-4 py-3 bg-[#2a2a2a] border border-[#3e3e3e] rounded-xl text-[#dcddde] w-full text-left"
                  >
                    <GitFork size={18} className="text-[#888]" />
                    <span className="font-medium">Ouvrir la vue graphique</span>
                  </button>
                </div>
              </div>
            ) : activeTab?.type === 'graph' ? (
              <GraphView graphData={graphData} onNodeClick={handleNavigate} />
            ) : isLoading ? (
              <div className="flex items-center justify-center h-full text-[#555] text-sm">Chargement...</div>
            ) : mode === 'read' ? (
              <div key={activeFile} className="note-reading-shell py-5 flex-1">
                <MarkdownViewer content={content} notePath={activeFile ?? undefined} onNavigate={handleNavigate} />
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
          <div className="mobile-backdrop fixed inset-0 z-40 md:hidden" onClick={() => setIsMobileRightOpen(false)} />
        )}

        {/* ─── Right Sidebar ─── */}
        {(rightOpen || isMobileRightOpen) && activeFile && (
          <div className={`
            fixed inset-y-0 right-0 z-50 md:z-0 md:relative
            w-[min(88vw,360px)] max-w-none md:w-[280px]
            workspace-sidebar workspace-sidebar-right bg-[#181818] border-l border-[#2e2e2e] flex flex-col flex-shrink-0 overflow-y-auto
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
                  <span key={tag} className="text-xs bg-[#252930] text-[#aab4cc] px-2 py-0.5 rounded cursor-pointer hover:bg-[#30353d] transition-colors" onClick={() => { handleSearch(tag); setLeftTab('search'); }}>
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
          className={`mobile-sheet-overlay md:hidden fixed inset-0 z-[9999] flex flex-col justify-end ${isBottomSheetOpen ? 'is-open opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        >
          <div className="mobile-backdrop absolute inset-0" onClick={() => setIsBottomSheetOpen(false)} />
          <div 
            className={`mobile-sheet relative border-t rounded-t-[20px] p-3 flex flex-col gap-1 pb-[max(1.5rem,env(safe-area-inset-bottom))] ${isBottomSheetOpen ? 'translate-y-0' : 'translate-y-full'}`}
          >
            <div className="w-12 h-1 bg-[#333] rounded-full mx-auto mb-2" />
            
            <button 
              onClick={() => { setIsBottomSheetOpen(false); handleCreateNote(''); setIsMobileNavOpen(false); setIsMobileRightOpen(false); }}
              className="sheet-action flex items-center gap-3 p-3 rounded-2xl text-white text-base font-medium"
            >
              <div className="sheet-action-icon sheet-action-icon-primary">
                <FileText size={20} />
              </div>
              Créer une note
            </button>
            
            <button 
              onClick={() => { setIsBottomSheetOpen(false); openTab('graph', 'graph'); setIsMobileNavOpen(false); setIsMobileRightOpen(false); }}
              className="sheet-action flex items-center gap-3 p-3 rounded-2xl text-white text-base font-medium"
            >
              <div className="sheet-action-icon">
                <GitFork size={20} />
              </div>
              Ouvrir la vue graphique
            </button>

            <button 
              onClick={() => { setIsBottomSheetOpen(false); setIsMobileRightOpen(true); setIsMobileNavOpen(false); }}
              className="sheet-action flex items-center gap-3 p-3 rounded-2xl text-white text-base font-medium"
            >
              <div className="sheet-action-icon">
                <PanelRight size={20} />
              </div>
              Ouvrir le panneau droit
            </button>
          </div>
        </div>
      </div>

      {/* ─── Status Bar ─── */}
      <div className="flex status-bar">
        <span>{backlinks} backlinks</span>
        <span>{wordCount} mots</span>
        <span>{charCount} caractères</span>
        <div className="flex-1" />
        <span>{isSaving ? 'Sauvegarde…' : unsaved ? 'Modifications non enregistrées' : mode === 'edit' ? 'Édition · sauvegarde auto' : 'Lecture'}</span>
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
            <div className="px-3 py-1.5 hover:bg-[#3d465d] cursor-pointer transition-colors" onClick={() => { toggleBookmark(contextMenu.path); setContextMenu(null); }}>
              {bookmarks.includes(contextMenu.path) ? "Retirer des favoris" : "Ajouter aux favoris"}
            </div>
          )}
          <div className="px-3 py-1.5 hover:bg-[#3d465d] cursor-pointer transition-colors" onClick={() => { setRenamingPath(contextMenu.path); setContextMenu(null); }}>Renommer...</div>
          <div className="px-3 py-1.5 hover:bg-red-500 cursor-pointer transition-colors border-t border-[#444]" onClick={() => { handleDelete(contextMenu.path); setContextMenu(null); }}>Mettre à la corbeille</div>
        </div>
      )}
      {/* ─── Auth Modal ─── */}
      {showAuth && (
        <div className="modal-overlay" onClick={() => (isAuthenticated || publicRead) && setShowAuth(false)}>
          <div className="modal-card p-6 w-[92%] max-w-[400px] relative" onClick={e => e.stopPropagation()}>
            {(isAuthenticated || publicRead) && (
              <button className="absolute top-4 right-4 p-1 text-[#7f899b] hover:text-[#eef4ff]" onClick={() => setShowAuth(false)} aria-label="Fermer">
                <X size={20} />
              </button>
            )}
            <div className="flex items-center gap-3 mb-5">
              <ShardNoteMark size={38} />
              <div>
                <h2 className="text-xl font-bold text-[#eef4ff]">Déverrouiller ShardNote</h2>
                <p className="text-xs text-[#7f899b]">Session privée et sécurisée</p>
              </div>
            </div>
            {!authConfigured ? (
              <div className="rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/10 p-4 text-sm text-[#f6c76f]">
                {authError || 'Configurez SHARDNOTE_PASSWORD et SHARDNOTE_SESSION_SECRET sur le serveur.'}
              </div>
            ) : (
              <>
                <p className="text-sm text-[#9aa5b7] mb-4">Le coffre est privé. Entrez le mot de passe configuré sur le serveur.</p>
                <input
                  type="password"
                  placeholder="Mot de passe"
                  className="auth-input mb-3"
                  value={authPassword}
                  onChange={event => { setAuthPassword(event.target.value); setAuthError(''); }}
                  onKeyDown={event => event.key === 'Enter' && void handleAuthSubmit()}
                  autoComplete="current-password"
                  autoFocus
                />
                {authError && <p className="text-sm text-[#f38b8b] mb-3" role="alert">{authError}</p>}
                <div className="flex gap-2">
                  {publicRead && <button className="auth-btn bg-[#303744] hover:bg-[#3a4352]" onClick={() => setShowAuth(false)}>Continuer en lecture</button>}
                  <button className="auth-btn" onClick={() => void handleAuthSubmit()} disabled={!authPassword}>Déverrouiller</button>
                </div>
              </>
            )}
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
              <label className="block text-sm font-semibold mb-2 text-[#bbb]">Taille de police de l&apos;éditeur ({fontSize}px)</label>
              <input 
                type="range" min="12" max="24" value={fontSize} 
                onChange={e => setFontSize(parseInt(e.target.value))}
                className="w-full accent-[#7487b8]"
              />
            </div>
            <div className="mb-6 rounded-lg border border-[#303744] bg-[#181d27] p-3 text-sm text-[#8d98aa]">
              Sauvegarde automatique après 1,5 seconde · sauvegardes de récupération activées
            </div>
            <div className="flex justify-between gap-3">
              {isAuthenticated && <button className="border border-[#465063] text-[#c8d2e3] px-4 py-2 rounded font-medium hover:bg-[#252c38] transition-colors" onClick={() => void handleLogout()}>Verrouiller</button>}
              <button className="bg-[#596c9b] text-white px-4 py-2 rounded font-medium hover:bg-[#6679a8] transition-colors" onClick={() => setShowSettings(false)}>Fermer</button>
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
            <div className="w-16 h-16 mx-auto bg-[#172033] border border-[#35517a] rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-[#3b82f6]/10">
              <ShardNoteMark size={42} />
            </div>
            <h2 className="text-2xl font-bold mb-2">ShardNote</h2>
            <p className="text-[#8d98aa] mb-2">v1.0.0 · Self-hosted Markdown workspace</p>
            <p className="text-xs text-[#667085] mb-6">Independent project. Not affiliated with Obsidian.</p>
            <button className="bg-[#333] text-white px-6 py-2 rounded-full font-medium hover:bg-[#444] transition-colors" onClick={() => setShowAbout(false)}>Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper Components ──────────────────────────────────

function ShardNoteMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="ShardNote">
      <defs>
        <linearGradient id="shardnote-left" x1="9" y1="14" x2="34" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="#73C7FF" />
          <stop offset="1" stopColor="#3978F6" />
        </linearGradient>
        <linearGradient id="shardnote-right" x1="55" y1="14" x2="31" y2="55" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A78BFA" />
          <stop offset="1" stopColor="#5B6CF9" />
        </linearGradient>
      </defs>
      <path d="M32 14 12 8 7 19v28l25 9V14Z" fill="url(#shardnote-left)" />
      <path d="m32 14 20-6 5 11v28l-25 9V14Z" fill="url(#shardnote-right)" />
      <path d="m12 8 20 6-9 12-16-7 5-11Z" fill="#A6E2FF" opacity=".72" />
      <path d="m52 8-20 6 9 12 16-7-5-11Z" fill="#C4B5FD" opacity=".65" />
      <path d="m23 26 9-12 9 12-9 30-9-30Z" fill="#172033" opacity=".9" />
      <circle cx="32" cy="14" r="2.2" fill="#F8FAFC" />
      <circle cx="23" cy="26" r="2.2" fill="#D8F3FF" />
      <circle cx="41" cy="26" r="2.2" fill="#E7DEFF" />
    </svg>
  );
}

function RibbonBtn({ icon, tooltip, onClick, active }: { icon: React.ReactNode; tooltip: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`workspace-icon-button w-8 h-8 flex items-center justify-center rounded-lg ${active ? 'text-[#eef4ff] bg-[#292f3c]' : 'text-[#6f7888] hover:text-[#c7d1e2]'}`}
    >{icon}</button>
  );
}

function TabIconBtn({ active, onClick, icon, tooltip }: { active: boolean; onClick: () => void; icon: React.ReactNode; tooltip: string }) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`sidebar-tab flex-1 flex items-center justify-center text-xs font-medium border-b-2 ${active ? 'sidebar-tab-active border-transparent text-[#eef4ff]' : 'border-transparent text-[#737d8e] hover:text-[#b8c3d5]'}`}
    >{icon}</button>
  );
}

function HeaderBtn({ icon, tooltip, onClick, active, highlight, className }: { icon: React.ReactNode; tooltip: string; onClick: () => void; active?: boolean; highlight?: boolean; className?: string }) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`workspace-icon-button p-1.5 rounded-lg ${active ? 'bg-[#303849] text-white' : highlight ? 'text-yellow-300' : 'text-[#737d8e] hover:text-[#c7d1e2]'} ${className || ''}`}
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
    if (!isDir) return;
    const timer = window.setTimeout(() => setOpen(expandAllToggle), 0);
    return () => window.clearTimeout(timer);
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
        className={`tree-row flex items-center py-2 md:py-1.5 px-2 rounded-lg cursor-pointer select-none text-sm md:text-[13px] ${isActive && !isRenaming ? 'bg-[#303849] text-white' : 'text-[#aeb7c6] hover:bg-[#252a34]'}`}
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
              className="bg-[#111] text-white px-1 border border-[#7487b8] rounded outline-none w-full"
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
          {result.matches.map((match, index) => (
            <div key={`${result.filePath}-${index}`} className="truncate">
              {highlightQuery(match, query)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function highlightQuery(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const normalizedQuery = query.toLocaleLowerCase();
  return text.split(new RegExp(`(${escaped})`, 'gi')).map((part, index) => (
    part.toLocaleLowerCase() === normalizedQuery
      ? <span key={index} className="text-[#8da2d2] font-semibold">{part}</span>
      : part
  ));
}

import { Network } from 'vis-network';
import { DataSet } from 'vis-data';

// ─── Graph View (vis-network) ───────────────────────────

function GraphView({ graphData, onNodeClick }: { graphData: GraphData; onNodeClick: (title: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const onNodeClickRef = useRef(onNodeClick);
  const [graphMode, setGraphMode] = useState<'links' | 'folders'>('links');
  const activeDataset = graphData[graphMode];

  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  }, [onNodeClick]);

  useEffect(() => {
    const { nodes, edges } = activeDataset;
    if (!containerRef.current || nodes.length === 0) return;

    const visualNodes = nodes.map(node => ({
      id: node.id,
      label: node.label,
      title: node.title,
      group: node.group,
      value: node.value || 1,
      font: {
        color: '#d4d8df',
        size: 12,
        face: 'Segoe UI',
      },
      color: {
        background: '#687590',
        border: '#8c96aa',
        highlight: { background: '#7b89a8', border: '#a8b1c2' },
      },
      shape: 'dot',
      scaling: {
        min: node.group === 'root' ? 12 : node.group === 'folder' ? 8 : 6,
        max: node.group === 'root' ? 22 : node.group === 'folder' ? 17 : 16,
      },
    }));
    const visualEdges = edges.map((edge, index) => ({
      id: `edge-${index}`,
      from: edge.from,
      to: edge.to,
      color: { color: '#343941', highlight: '#7487b8', opacity: 0.8 },
      width: 1,
      selectionWidth: 2,
    }));
    const nodeDataSet = new DataSet(visualNodes);
    const edgeDataSet = new DataSet(visualEdges);
    const data = { nodes: nodeDataSet, edges: edgeDataSet };

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

    const network = new Network(containerRef.current, data, options);
    networkRef.current = network;
    network.once('stabilized', () => network.setOptions({ physics: { enabled: false } }));

    network.on('click', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = nodes.find(n => n.id === nodeId);
        if (node?.group === 'note') onNodeClickRef.current(`${node.title}.md`);
      }
    });

    return () => {
      network.destroy();
      if (networkRef.current === network) networkRef.current = null;
    };
  }, [activeDataset]);

  return (
    <div className="graph-view absolute inset-0">
      {activeDataset.nodes.length === 0 ? (
        <div className="p-8 text-center text-[#555] text-sm">Aucune donnée de graphe</div>
      ) : (
        <>
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
          <div className="graph-toolbar absolute top-3 left-3 z-10 flex items-center gap-2">
            <div className="graph-mode-switch flex items-center" role="group" aria-label="Mode du graphe">
              <button
                type="button"
                className={`graph-mode-button ${graphMode === 'links' ? 'graph-mode-button-active' : ''}`}
                aria-pressed={graphMode === 'links'}
                onClick={() => setGraphMode('links')}
              >
                <Link size={14} />
                <span>Liens internes</span>
              </button>
              <button
                type="button"
                className={`graph-mode-button ${graphMode === 'folders' ? 'graph-mode-button-active' : ''}`}
                aria-pressed={graphMode === 'folders'}
                onClick={() => setGraphMode('folders')}
              >
                <FolderTree size={14} />
                <span>Dossiers</span>
              </button>
            </div>
          </div>
          <button 
            onClick={() => networkRef.current?.fit({ animation: { duration: 500, easingFunction: 'easeInOutQuad' } })} 
            className="graph-control absolute bottom-5 right-5 flex items-center gap-2 px-3 py-2 rounded-lg text-sm z-10"
            title="Recentrer le graphe"
          >
            <Focus size={16} />
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

