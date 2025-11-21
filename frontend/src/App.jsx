import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Star, Folder, Image as ImageIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const API_URL = 'http://localhost:3001/api';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

function App() {
  const [currentPath, setCurrentPath] = useState('G:\\Code Files\\PhotoPicks'); // Default start path
  const [photos, setPhotos] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [metadataCache, setMetadataCache] = useState({}); // Cache for ratings/labels

  // Fetch photos when path changes
  useEffect(() => {
    fetchPhotos(currentPath);
  }, [currentPath]);

  const fetchPhotos = async (path) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/photos?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      setPhotos(data.photos || []);
      setSelectedIndex(0);
      
      // Optimistically load metadata for the first few? 
      // Or just load on demand. For now, let's load metadata for the selected one.
    } catch (err) {
      console.error("Failed to load photos", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch metadata for a specific photo
  const fetchMetadata = async (file) => {
    if (metadataCache[file.path]) return; // Already cached

    try {
      const res = await fetch(`${API_URL}/metadata?file=${encodeURIComponent(file.path)}`);
      const data = await res.json();
      setMetadataCache(prev => ({
        ...prev,
        [file.path]: data
      }));
    } catch (err) {
      console.error("Failed to fetch metadata", err);
    }
  };

  // Update metadata (Rating/Label)
  const updateMetadata = async (rating, label) => {
    const currentPhoto = photos[selectedIndex];
    if (!currentPhoto) return;

    // Optimistic update
    setMetadataCache(prev => ({
      ...prev,
      [currentPhoto.path]: {
        ...prev[currentPhoto.path],
        ...(rating !== undefined && { rating }),
        ...(label !== undefined && { label })
      }
    }));

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
      // Revert on failure? For now, just log.
    }
  };

  // Load metadata when selection changes
  useEffect(() => {
    const photo = photos[selectedIndex];
    if (photo) {
      fetchMetadata(photo);
      // Preload next few
      for (let i = 1; i <= 3; i++) {
        if (photos[selectedIndex + i]) fetchMetadata(photos[selectedIndex + i]);
      }
    }
  }, [selectedIndex, photos]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (photos.length === 0) return;

      switch (e.key) {
        case 'ArrowRight':
          setSelectedIndex(prev => Math.min(prev + 1, photos.length - 1));
          break;
        case 'ArrowLeft':
          setSelectedIndex(prev => Math.max(prev - 1, 0));
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
  }, [photos, selectedIndex, metadataCache]); // Dependencies for updateMetadata closure

  // Scroll selected thumbnail into view
  const thumbnailRefs = useRef({});
  useEffect(() => {
    const el = thumbnailRefs.current[selectedIndex];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedIndex]);

  const currentPhoto = photos[selectedIndex];
  const currentMeta = currentPhoto ? (metadataCache[currentPhoto.path] || {}) : {};

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
    <div className="flex flex-col h-screen bg-gray-900 text-gray-200">
      {/* Toolbar */}
      <div className="h-12 bg-gray-800 flex items-center px-4 border-b border-gray-700 shrink-0">
        <Folder className="w-5 h-5 mr-2 text-gray-400" />
        <input 
          type="text" 
          value={currentPath} 
          onChange={(e) => setCurrentPath(e.target.value)}
          className="bg-gray-700 border-none text-sm px-2 py-1 rounded w-96 focus:ring-1 focus:ring-blue-500 outline-none"
        />
        <div className="ml-auto text-xs text-gray-500">
          {photos.length} photos
        </div>
      </div>

      {/* Main Content - Split View */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
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
                        className={cn("w-4 h-4", star <= (currentMeta.rating || 0) ? "fill-yellow-400 text-yellow-400" : "text-gray-500")} 
                      />
                    ))}
                  </div>
                  {currentMeta.label && (
                    <span className={cn("text-xs px-2 py-0.5 rounded-full border", getColorClass(currentMeta.label))}>
                      {currentMeta.label}
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-gray-500 flex flex-col items-center">
              <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
              <p>No photos found in this folder</p>
            </div>
          )}
        </div>

        {/* Filmstrip / Grid */}
        <div className="h-48 bg-gray-800 border-t border-gray-700 flex overflow-x-auto p-2 space-x-2 shrink-0 items-center">
          {photos.map((photo, idx) => {
            const meta = metadataCache[photo.path] || {};
            const isSelected = idx === selectedIndex;
            
            return (
              <div 
                key={photo.path}
                ref={el => thumbnailRefs.current[idx] = el}
                onClick={() => setSelectedIndex(idx)}
                className={cn(
                  "relative h-full aspect-square shrink-0 cursor-pointer border-2 rounded overflow-hidden group transition-all",
                  isSelected ? "border-white ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-800" : "border-transparent hover:border-gray-600",
                  getColorClass(meta.label)
                )}
              >
                <img 
                  src={`${API_URL}/thumbnail?file=${encodeURIComponent(photo.path)}`} 
                  alt={photo.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                
                {/* Thumbnail Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-end">
                  <div className="flex scale-75 origin-bottom-left">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star 
                        key={star} 
                        className={cn("w-3 h-3", star <= (meta.rating || 0) ? "fill-yellow-400 text-yellow-400" : "text-gray-500")} 
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default App;
