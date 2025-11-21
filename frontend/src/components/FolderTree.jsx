import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';
import { clsx } from 'clsx';

const API_URL = 'http://localhost:3001/api';

const FolderNode = ({ name, path, level = 0, onSelect, selectedPath }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [subFolders, setSubFolders] = useState([]);
  const [loading, setLoading] = useState(false);

  const isSelected = selectedPath === path;

  const toggle = async (e) => {
    e.stopPropagation();
    
    if (!isOpen && subFolders.length === 0) {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/folders?path=${encodeURIComponent(path)}`);
        const data = await res.json();
        setSubFolders(data.folders || []);
      } catch (err) {
        console.error("Failed to load folders", err);
      } finally {
        setLoading(false);
      }
    }
    setIsOpen(!isOpen);
  };

  const handleSelect = (e) => {
    e.stopPropagation();
    onSelect(path);
  };

  return (
    <div className="select-none">
      <div 
        className={clsx(
          "flex items-center py-1 px-2 cursor-pointer hover:bg-gray-700 transition-colors text-sm truncate",
          isSelected && "bg-blue-600 hover:bg-blue-700 text-white"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleSelect}
      >
        <div 
          onClick={toggle} 
          className="p-1 mr-1 hover:bg-white/10 rounded"
        >
          {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
        
        {isOpen ? (
          <FolderOpen className={clsx("w-4 h-4 mr-2", isSelected ? "text-white" : "text-yellow-500")} />
        ) : (
          <Folder className={clsx("w-4 h-4 mr-2", isSelected ? "text-white" : "text-yellow-500")} />
        )}
        
        <span className="truncate">{name}</span>
      </div>

      {isOpen && (
        <div>
          {loading && <div className="pl-8 text-xs text-gray-500 py-1">Loading...</div>}
          {subFolders.map(folder => (
            <FolderNode 
              key={folder.path} 
              {...folder} 
              level={level + 1} 
              onSelect={onSelect}
              selectedPath={selectedPath}
            />
          ))}
          {!loading && subFolders.length === 0 && (
            <div className="pl-8 text-xs text-gray-600 py-1 italic">Empty</div>
          )}
        </div>
      )}
    </div>
  );
};

const FolderTree = ({ currentPath, onSelect }) => {
  // We need a root to start the tree. 
  // Since we can't easily list drives, let's start from the current path's parent or just the current path.
  // A better UX for a local app is to allow "Going Up".
  
  const [rootFolders, setRootFolders] = useState([]);
  const [rootPath, setRootPath] = useState(currentPath);

  // Sync rootPath when currentPath changes significantly (e.g. user types a new drive/path)
  useEffect(() => {
    if (!currentPath) return;
    
    // Normalize for comparison (remove trailing slashes, lowercase)
    const normalize = p => p.toLowerCase().replace(/[\\/]$/, '');
    const curr = normalize(currentPath);
    const root = normalize(rootPath);

    // If current path is NOT inside the current root, update root.
    // This allows the user to jump to a new location via the input box.
    if (!curr.startsWith(root)) {
      setRootPath(currentPath);
    }
  }, [currentPath, rootPath]);

  useEffect(() => {
    // Initial load of the root level
    loadFolders(rootPath);
  }, [rootPath]);

  const loadFolders = async (path) => {
    try {
      const res = await fetch(`${API_URL}/folders?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      // We are displaying the contents of 'path', so the nodes are its children.
      // But to make a tree, we usually want to show the root itself?
      // Let's just show the list of folders in the current root.
      setRootFolders(data.folders || []);
    } catch (err) {
      console.error(err);
      setRootFolders([]);
    }
  };

  const goUp = () => {
    // Simple string manipulation for Windows paths
    const parts = rootPath.split(/[\\/]/).filter(p => p); // Filter empty strings
    if (parts.length > 1) {
      parts.pop(); // Remove last segment
      // Handle drive root (e.g. "G:")
      let newPath = parts.join('\\');
      if (newPath.endsWith(':')) newPath += '\\';
      setRootPath(newPath);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-700 w-64 shrink-0">
      <div className="p-2 border-b border-gray-700 flex items-center justify-between bg-gray-800">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Folders</span>
        <button 
          onClick={goUp}
          className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-gray-300"
          title="Go to Parent Folder"
        >
          Up
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto py-2">
        {/* Show the Root Path as a header or just list its contents? */}
        <div className="px-4 py-2 text-xs text-gray-500 break-all border-b border-gray-800 mb-2">
          {rootPath}
        </div>

        {rootFolders.map(folder => (
          <FolderNode 
            key={folder.path} 
            {...folder} 
            onSelect={onSelect}
            selectedPath={currentPath}
          />
        ))}
      </div>
    </div>
  );
};

export default FolderTree;
