import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Star, Folder, Image as ImageIcon, Filter, Copy, CheckSquare, Square, GripVertical } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import FolderTree from './components/FolderTree';

const API_URL = 'http://localhost:3001/api';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

function App() {
  const [currentPath, setCurrentPath] = useState('G:\\Code Files\\PhotoPicks'); 
  const [allPhotos, setAllPhotos] = useState([]); // Store all fetched photos
  const [photos, setPhotos] = useState([]); // Store filtered photos
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Resizable panel state
  const [thumbnailWidth, setThumbnailWidth] = useState(300); // Width in pixels
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef(null);
  
  // Grid layout calculation
  const [columnsCount, setColumnsCount] = useState(3);
  
  // Filter State
  const [isRecursive, setIsRecursive] = useState(false);
  const [filterRating, setFilterRating] = useState(0); // 0 = All, 1-5 = Min Rating
  const [filterColor, setFilterColor] = useState('All'); // 'All', 'Red', 'Yellow', etc.
  
  // Copy Tool State
  const [targetFolder, setTargetFolder] = useState('');
  const [copying, setCopying] = useState(false);

  // Fetch photos when path or recursive flag changes
  useEffect(() => {
    fetchPhotos(currentPath, isRecursive);
  }, [currentPath, isRecursive]);

  // Apply filters when photos or filter settings change
  useEffect(() => {
    let result = allPhotos;

    if (filterRating > 0) {
      result = result.filter(p => (p.rating || 0) >= filterRating);
    }

    if (filterColor !== 'All') {
      result = result.filter(p => p.label === filterColor);
    }

    setPhotos(result);
    // Keep selection on the same photo if possible, otherwise reset
    setSelectedIndex(prev => Math.min(prev, Math.max(0, result.length - 1)));
  }, [allPhotos, filterRating, filterColor]);

  const fetchPhotos = async (path, recursive) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/photos?path=${encodeURIComponent(path)}&recursive=${recursive}`);
      const data = await res.json();
      setAllPhotos(data.photos || []);
    } catch (err) {
      console.error("Failed to load photos", err);
      setAllPhotos([]);
    } finally {
      setLoading(false);
    }
  };

  // Update metadata (Rating/Label)
  const updateMetadata = async (rating, label) => {
    const currentPhoto = photos[selectedIndex];
    if (!currentPhoto) return;

    // Optimistic update in both lists
    const updateList = (list) => list.map(p => {
      if (p.path === currentPhoto.path) {
        return {
          ...p,
          ...(rating !== undefined && { rating }),
          ...(label !== undefined && { label })
        };
      }
      return p;
    });

    setAllPhotos(prev => updateList(prev));
    // photos state will update automatically via the useEffect dependency on allPhotos
    
    // Move to next photo after rating/labeling (optional, comment out if unwanted)
    setTimeout(() => {
      setSelectedIndex(prev => Math.min(prev + 1, photos.length - 1));
    }, 100);

    try {
      await fetch(`${API_URL}/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: currentPhoto.path,
          rating,
          label
        })
      });
    } catch (err) {
      console.error("Failed to save metadata", err);
    }
  };

  const copyFilteredPhotos = async () => {
    if (!targetFolder) return alert("Please set a target folder first");
    if (photos.length === 0) return alert("No photos to copy");
    if (!confirm(`Copy ${photos.length} photos to ${targetFolder}?`)) return;

    setCopying(true);
    try {
      // We'll need a new API endpoint for this, or just loop calls (slower but easier)
      // Let's assume we add a bulk copy endpoint
      const res = await fetch(`${API_URL}/copy-files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: photos.map(p => p.path),
          destination: targetFolder
        })
      });
      const data = await res.json();
      alert(`Copied ${data.count} photos!`);
    } catch (err) {
      alert("Failed to copy photos");
      console.error(err);
    } finally {
      setCopying(false);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in input
      if (e.target.tagName === 'INPUT') return;
      
      if (photos.length === 0) return;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, photos.length - 1));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + columnsCount, photos.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - columnsCount, 0));
          break;
        case '1': updateMetadata(1, undefined); break;
        case '2': updateMetadata(2, undefined); break;
        case '3': updateMetadata(3, undefined); break;
        case '4': updateMetadata(4, undefined); break;
        case '5': updateMetadata(5, undefined); break;
        case '0': updateMetadata(0, null); break;
        case '6': updateMetadata(undefined, 'Red'); break;
        case '7': updateMetadata(undefined, 'Yellow'); break;
        case '8': updateMetadata(undefined, 'Green'); break;
        case '9': updateMetadata(undefined, 'Blue'); break;
        default: break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photos, selectedIndex, columnsCount]); 

  // Scroll selected thumbnail into view
  const thumbnailRefs = useRef({});
  useEffect(() => {
    const el = thumbnailRefs.current[selectedIndex];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedIndex]);

  // Handle resize drag
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      
      // Calculate new width from the right edge of the window
      const newWidth = window.innerWidth - e.clientX;
      const clampedWidth = Math.max(250, Math.min(800, newWidth));
      setThumbnailWidth(clampedWidth);
      
      // Calculate columns based on width (assuming ~120px per thumbnail + gaps)
      const cols = Math.max(2, Math.floor((clampedWidth - 16) / 140));
      setColumnsCount(cols);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Calculate columns when width changes
  useEffect(() => {
    const cols = Math.max(2, Math.floor((thumbnailWidth - 16) / 140));
    setColumnsCount(cols);
  }, [thumbnailWidth]);

  const currentPhoto = photos[selectedIndex];
  
  const getColorClass = (label) => {
    switch (label) {
      case 'Red': return 'border-red-500 bg-red-500/20';
      case 'Yellow': return 'border-yellow-500 bg-yellow-500/20';
      case 'Green': return 'border-green-500 bg-green-500/20';
      case 'Blue': return 'border-blue-500 bg-blue-500/20';
      default: return 'border-transparent';
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-200 overflow-hidden">
      {/* Sidebar - Folder Tree */}
      <FolderTree 
        currentPath={currentPath} 
        onSelect={(path) => setCurrentPath(path)} 
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="h-14 bg-gray-800 flex items-center px-4 border-b border-gray-700 shrink-0 space-x-4">
          
          {/* Path Input */}
          <div className="flex items-center flex-1 min-w-0">
            <Folder className="w-5 h-5 mr-2 text-gray-400 shrink-0" />
            <input 
              type="text" 
              value={currentPath} 
              onChange={(e) => setCurrentPath(e.target.value)}
              className="bg-gray-700 border-none text-sm px-2 py-1 rounded w-full focus:ring-1 focus:ring-blue-500 outline-none truncate"
            />
          </div>

          {/* Recursive Toggle */}
          <button 
            onClick={() => setIsRecursive(!isRecursive)}
            className={cn("flex items-center px-3 py-1 rounded text-sm border", isRecursive ? "bg-blue-600 border-blue-500 text-white" : "border-gray-600 text-gray-400 hover:bg-gray-700")}
          >
            {isRecursive ? <CheckSquare className="w-4 h-4 mr-2" /> : <Square className="w-4 h-4 mr-2" />}
            Subfolders
          </button>

          <div className="h-6 w-px bg-gray-600 mx-2"></div>

          {/* Filters */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            
            {/* Rating Filter */}
            <select 
              value={filterRating} 
              onChange={(e) => setFilterRating(Number(e.target.value))}
              className="bg-gray-700 border-none text-sm rounded px-2 py-1 outline-none"
            >
              <option value={0}>All Stars</option>
              <option value={1}>1+ Stars</option>
              <option value={2}>2+ Stars</option>
              <option value={3}>3+ Stars</option>
              <option value={4}>4+ Stars</option>
              <option value={5}>5 Stars</option>
            </select>

            {/* Color Filter */}
            <select 
              value={filterColor} 
              onChange={(e) => setFilterColor(e.target.value)}
              className="bg-gray-700 border-none text-sm rounded px-2 py-1 outline-none"
            >
              <option value="All">All Colors</option>
              <option value="Red">Red</option>
              <option value="Yellow">Yellow</option>
              <option value="Green">Green</option>
              <option value="Blue">Blue</option>
            </select>
          </div>

          <div className="h-6 w-px bg-gray-600 mx-2"></div>

          {/* Copy Tool */}
          <div className="flex items-center space-x-2">
            <input 
              type="text" 
              placeholder="Target Folder..." 
              value={targetFolder}
              onChange={(e) => setTargetFolder(e.target.value)}
              className="bg-gray-700 border-none text-sm px-2 py-1 rounded w-32 focus:w-48 transition-all outline-none"
            />
            <button 
              onClick={copyFilteredPhotos}
              disabled={copying}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm flex items-center disabled:opacity-50"
              title="Copy filtered photos to target folder"
            >
              <Copy className="w-4 h-4 mr-2" />
              {copying ? 'Copying...' : 'Copy'}
            </button>
          </div>

        </div>

        {/* Main View Area with Resizable Thumbnail Panel */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Large Preview */}
          <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
            {currentPhoto ? (
              <>
                <img 
                  src={`${API_URL}/image?file=${encodeURIComponent(currentPhoto.path)}`} 
                  alt={currentPhoto.name}
                  className="max-w-full max-h-full object-contain"
                />
                
                {/* Overlay Info */}
                <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur px-4 py-2 rounded text-white">
                  <div className="font-medium">{currentPhoto.name}</div>
                  <div className="flex items-center mt-1 space-x-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star 
                          key={star} 
                          className={cn("w-4 h-4", star <= (currentPhoto.rating || 0) ? "fill-yellow-400 text-yellow-400" : "text-gray-500")} 
                        />
                      ))}
                    </div>
                    {currentPhoto.label && (
                      <span className={cn("text-xs px-2 py-0.5 rounded-full border", getColorClass(currentPhoto.label))}>
                        {currentPhoto.label}
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-gray-500 flex flex-col items-center">
                <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
                <p>{loading ? "Scanning..." : "No photos found"}</p>
              </div>
            )}
          </div>

          {/* Resize Handle */}
          <div 
            onMouseDown={handleMouseDown}
            className="w-1 bg-gray-700 hover:bg-blue-500 cursor-col-resize transition-colors flex items-center justify-center relative group"
            style={{ userSelect: 'none' }}
          >
            <div className="absolute inset-y-0 w-4 -left-2" /> {/* Invisible wider hit area */}
            <GripVertical className="w-4 h-4 text-gray-600 group-hover:text-blue-400 absolute" />
          </div>

          {/* Vertical Thumbnail Gallery Grid */}
          <div 
            className="bg-gray-800 border-l border-gray-700 overflow-y-auto shrink-0"
            style={{ width: `${thumbnailWidth}px` }}
          >
            <div 
              className="p-2 grid gap-2"
              style={{ 
                gridTemplateColumns: `repeat(${columnsCount}, minmax(0, 1fr))` 
              }}
            >
              {photos.map((photo, idx) => {
                const isSelected = idx === selectedIndex;
                
                return (
                  <div 
                    key={photo.path}
                    ref={el => thumbnailRefs.current[idx] = el}
                    onClick={() => setSelectedIndex(idx)}
                    className={cn(
                      "relative w-full aspect-square cursor-pointer border-2 rounded overflow-hidden group transition-all",
                      isSelected ? "border-white ring-2 ring-blue-500" : "border-transparent hover:border-gray-600",
                      getColorClass(photo.label)
                    )}
                  >
                    <img 
                      src={`${API_URL}/thumbnail?file=${encodeURIComponent(photo.path)}`} 
                      alt={photo.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    
                    {/* Thumbnail Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex justify-center mb-0.5">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star 
                            key={star} 
                            className={cn("w-2.5 h-2.5", star <= (photo.rating || 0) ? "fill-yellow-400 text-yellow-400" : "text-gray-500")} 
                          />
                        ))}
                      </div>
                      <div className="text-[10px] text-gray-300 text-center truncate">{photo.name}</div>
                    </div>
                    
                    {/* Selection indicator - always visible for selected */}
                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-blue-500 rounded-full w-3 h-3 border-2 border-white"></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
