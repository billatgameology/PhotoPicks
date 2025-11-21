# PhotoPicks

A lightweight, local photo selection and rating app inspired by Adobe Lightroom. Browse your photo folders, rate images with stars, apply color labels, and export your selections—all while writing metadata directly into your image files.

## Features

### 📁 Folder Navigation
- **Folder Tree View**: Browse your photo directories with an expandable tree sidebar
- **Path Input**: Jump to any folder by pasting its path
- **Recursive Scanning**: Enable "Subfolders" to load all photos from nested directories at once

### ⭐ Rating & Labeling
- **Star Ratings**: Rate photos 1-5 stars using keyboard shortcuts (1-5 keys)
- **Color Labels**: Apply Red, Yellow, Green, or Blue labels (6-9 keys)
- **Metadata Writing**: Ratings and labels are written directly to image EXIF/XMP data
- **Auto-Advance**: Automatically moves to the next photo after rating

### 🔍 Filtering
- **Rating Filter**: Show only photos with a minimum star rating (e.g., "3+ Stars")
- **Color Filter**: Filter by color label
- **Live Updates**: Filters apply instantly as you rate photos

### 🖼️ Viewing
- **Large Preview**: Full-size image display with zoom
- **Grid Gallery**: Resizable thumbnail panel with multi-column grid
- **Auto-Rotation**: Respects EXIF orientation data (fixes rotated phone photos)
- **Keyboard Navigation**:
  - Arrow keys: Navigate photos (Left/Right, Up/Down in grid)
  - 1-5: Set star rating
  - 6-9: Set color label (Red, Yellow, Green, Blue)
  - 0: Clear rating and label

### 📤 Export
- **Copy Filtered Photos**: Select a target folder and copy all currently filtered photos with one click
- **Portable Metadata**: Since ratings are in the files themselves, they work in Lightroom, Bridge, and Windows Explorer

## Installation

### Prerequisites
- **Node.js** (v16 or higher): [Download here](https://nodejs.org/)
- **Git** (optional, for cloning): [Download here](https://git-scm.com/)

### Setup Steps

1. **Clone or Download the Repository**
   ```powershell
   git clone https://github.com/billatgameology/PhotoPicks.git
   cd PhotoPicks
   ```

2. **Install Backend Dependencies**
   ```powershell
   cd backend
   npm install
   ```

3. **Install Frontend Dependencies**
   ```powershell
   cd ../frontend
   npm install
   ```

## Running the App

You need to run both the backend and frontend servers simultaneously.

### Option 1: Two Terminal Windows

**Terminal 1 - Backend Server:**
```powershell
cd backend
npm start
```
> Server will run on `http://localhost:3001`

**Terminal 2 - Frontend:**
```powershell
cd frontend
npm run dev
```
> Frontend will open at `http://localhost:5173`

### Option 2: Single Command (Windows)
```powershell
cd backend ; Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$pwd' ; npm start" ; cd ../frontend ; npm run dev
```

Once both are running, open your browser to **http://localhost:5173**

## User Guide

### Getting Started

1. **Select a Folder**
   - Click on folders in the left sidebar, or
   - Paste a folder path in the top input bar (e.g., `D:\Photos\Vacation 2024`)

2. **Browse Photos**
   - Use **Left/Right arrow keys** to navigate
   - Use **Up/Down arrow keys** to jump rows in the grid
   - Click any thumbnail to view it

3. **Rate and Label**
   - Press **1-5** to set star rating
   - Press **6** for Red, **7** for Yellow, **8** for Green, **9** for Blue
   - Press **0** to clear both rating and label
   - The app auto-advances to the next photo after each action

4. **Filter Your Selections**
   - Use the **Rating** dropdown to show only high-rated photos (e.g., "5 Stars")
   - Use the **Color** dropdown to filter by label
   - Check **Subfolders** to scan all nested folders

5. **Export Your Picks**
   - Set filters to show only the photos you want
   - Enter a target folder path (e.g., `D:\Best Photos`)
   - Click **Copy** to export filtered photos

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **1-5** | Set star rating (1 = lowest, 5 = highest) |
| **0** | Clear rating and color label |
| **6** | Apply Red label |
| **7** | Apply Yellow label |
| **8** | Apply Green label |
| **9** | Apply Blue label |
| **←/→** | Previous/Next photo |
| **↑/↓** | Navigate by rows in grid view |

### Adjusting the Grid

- **Drag the vertical divider** between the preview and thumbnails to resize the panel
- The grid automatically adjusts columns based on width (2-6 columns)

## Technical Details

### Supported Formats
- JPG/JPEG
- PNG

### Metadata Storage
Ratings and labels are written to:
- `XMP:Rating` (Lightroom standard)
- `EXIF:Rating` (Windows Explorer)
- `RatingPercent` (Windows compatibility)
- `Keywords` and `XMP:Label` (for color labels)

This ensures compatibility with Adobe Lightroom, Bridge, and Windows File Explorer.

### Architecture
- **Backend**: Node.js + Express
  - File system operations
  - ExifTool for metadata reading/writing
  - Sharp for image processing and thumbnails
- **Frontend**: React + Vite + Tailwind CSS
  - Responsive UI with resizable panels
  - Real-time filtering
  - Optimistic updates for snappy UX

## Troubleshooting

### Backend won't start - "Port already in use"
```powershell
# Kill the process using port 3001
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess -Force
npm start
```

### Images appear rotated
Restart the backend server - the auto-rotation feature requires the latest code.

### Metadata not showing in Windows Explorer
- Windows caches file properties. Press F5 in File Explorer or reopen the file properties window.
- Some fields (like Rating) may take a moment to update in the UI.

### Recursive scan is slow
This is normal for folders with thousands of photos. ExifTool reads metadata for every file, which can take time. Consider scanning smaller date ranges.

## Development

### Backend Dev Mode (auto-restart on changes)
```powershell
cd backend
npm run dev
```

### Frontend Dev Mode (default)
```powershell
cd frontend
npm run dev
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **ExifTool** by Phil Harvey - Industry-standard metadata tool
- **Sharp** - High-performance image processing
- **Vite** - Lightning-fast frontend tooling
