const express = require('express');
const cors = require('cors');
const { exiftool } = require('exiftool-vendored');
const sharp = require('sharp');
const glob = require('fast-glob');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Root route for sanity check
app.get('/', (req, res) => {
    res.send('PhotoPicks Backend is running. Please open the Frontend app (usually http://localhost:5173).');
});

// Configuration - In a real app, this might be dynamic or from a config file
// For now, we'll default to a specific directory or let the user pass it via query param
// But for safety, let's start with a hardcoded path or current directory for testing
// The user mentioned "viewing local folders", so we'll likely need an API to list folders or set a root.
// For this MVP, let's assume we serve images from a specific root path passed as a query param or env var.
// Defaulting to the parent directory of the project for demonstration if not specified.
const DEFAULT_ROOT = path.resolve(__dirname, '../..'); // Go up two levels to 'Code Files' or similar

// Helper to get absolute path safely
const getSafePath = (reqPath) => {
    if (!reqPath) return DEFAULT_ROOT;
    // Basic security check to prevent traversing up too far if needed, 
    // but for a local app, we want to access everything.
    return path.resolve(reqPath);
};

// API: List Photos in a Directory (with Metadata)
app.get('/api/photos', async (req, res) => {
    const folderPath = getSafePath(req.query.path);
    const recursive = req.query.recursive === 'true';
    
    try {
        console.log(`Scanning: ${folderPath} (Recursive: ${recursive})`);
        
        // We use exiftool to scan because we need metadata (Rating, Label) for filtering.
        // -json: Output JSON
        // -r: Recursive (if requested)
        // -ext: Filter extensions
        // -fast: Read faster (avoid making thumbnails, just read tags)
        // -Rating -Label: Only read these tags (plus standard ones) to speed it up
        
        const args = [
            '-json',
            '-fast',
            '-ext', 'jpg', '-ext', 'jpeg', '-ext', 'png', '-ext', 'JPG', '-ext', 'JPEG', '-ext', 'PNG',
            '-Rating',
            '-Label',
            '-file:FileName',
            '-file:FileSize',
            '-file:FileModifyDate'
        ];

        if (recursive) {
            args.push('-r');
        }

        args.push(folderPath);

        // exiftool-vendored doesn't expose a raw 'spawn' easily for directory scanning with custom args that returns JSON directly in this way 
        // usually. But .read() is for single files.
        // We can use the underlying child_process or check if the library has a batch mode.
        // The library has `exiftool.read(file)` but for bulk, it's often better to run the command.
        // However, `exiftool-vendored` manages a singleton process. 
        // Let's stick to `glob` for listing files (it's fast) and then batch read metadata?
        // OR, let's try to use the library's batch capabilities if available, or just spawn our own for the list.
        
        // Actually, for a local app, `glob` + `exiftool` batch is safer.
        // Let's use glob to find files, then pass them to exiftool in batches if needed.
        // BUT, passing 1000 args to command line is bad.
        
        // Alternative: Use `exiftool` directly via shell execution for the listing.
        // It is the most robust way to get metadata for a whole folder.
        
        const { execFile } = require('child_process');
        let exiftoolPath;
        try {
            // Try to get the path from the platform-specific package
            exiftoolPath = require('exiftool-vendored.exe');
        } catch (e) {
            // Fallback or non-windows logic (though this user is on Windows)
            // If we can't find the binary, we can't run the batch scan easily.
            console.error("Could not find exiftool binary path:", e);
            throw new Error("Exiftool binary not found");
        }

        // We need to increase maxBuffer because the JSON can be huge for many photos
        execFile(exiftoolPath, args, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
            if (error) {
                console.error("Exiftool error:", stderr);
                // If exiftool fails (e.g. no files), we might just return empty
                return res.json({ path: folderPath, photos: [] });
            }

            try {
                const rawData = JSON.parse(stdout);
                
                const photos = rawData.map(item => ({
                    name: item.FileName,
                    path: item.SourceFile,
                    size: item.FileSize,
                    rating: item.Rating || 0,
                    label: item.Label || null
                }));

                // Sort by name default
                photos.sort((a, b) => a.name.localeCompare(b.name));

                res.json({ path: folderPath, photos });
            } catch (parseErr) {
                console.error("JSON Parse error:", parseErr);
                res.json({ path: folderPath, photos: [] });
            }
        });

    } catch (err) {
        console.error("Error scanning folder:", err);
        res.status(500).json({ error: err.message });
    }
});

// API: List Subfolders
app.get('/api/folders', async (req, res) => {
    const folderPath = getSafePath(req.query.path);
    
    try {
        const items = await fs.promises.readdir(folderPath, { withFileTypes: true });
        const folders = items
            .filter(item => item.isDirectory() && !item.name.startsWith('.')) // Skip hidden folders
            .map(item => ({
                name: item.name,
                path: path.join(folderPath, item.name)
            }));
        
        res.json({ path: folderPath, folders });
    } catch (err) {
        console.error("Error listing folders:", err);
        res.status(500).json({ error: err.message });
    }
});

// API: Get Thumbnail
app.get('/api/thumbnail', async (req, res) => {
    const filePath = req.query.file;
    if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).send('File not found');
    }

    try {
        await sharp(filePath)
            .rotate() // Auto-rotate based on EXIF orientation
            .resize(300, 300, { fit: 'inside' })
            .jpeg({ quality: 80 })
            .toBuffer()
            .then(buffer => {
                res.type('image/jpeg');
                res.send(buffer);
            });
    } catch (err) {
        console.error("Error generating thumbnail:", err);
        res.status(500).send('Error generating thumbnail');
    }
});

// API: Get Full Image (for large view)
app.get('/api/image', async (req, res) => {
    const filePath = req.query.file;
    if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).send('File not found');
    }
    
    try {
        // Apply auto-rotation for images displayed in the browser
        const image = sharp(filePath);
        await image.rotate(); // Auto-rotate based on EXIF orientation
        
        res.type('image/jpeg');
        image.jpeg({ quality: 95 }).pipe(res);
    } catch (err) {
        console.error("Error serving image:", err);
        // Fallback: send original file if sharp fails
        try {
            res.sendFile(filePath);
        } catch (fallbackErr) {
            res.status(500).send('Error serving image');
        }
    }
});

// API: Get Metadata
app.get('/api/metadata', async (req, res) => {
    const filePath = req.query.file;
    if (!filePath) return res.status(400).send('Missing file path');

    try {
        const tags = await exiftool.read(filePath);
        res.json({
            rating: tags.Rating || 0,
            label: tags.Label || '',
            // Add other relevant tags if needed
        });
    } catch (err) {
        console.error("Error reading metadata:", err);
        res.status(500).json({ error: err.message });
    }
});

// API: Update Metadata (Rating/Label)
app.post('/api/metadata', async (req, res) => {
    const { file, rating, label } = req.body;
    if (!file) return res.status(400).send('Missing file path');

    const tagsToWrite = {};
    
    if (rating !== undefined) {
        // Write to multiple tags for maximum compatibility
        tagsToWrite['Rating'] = rating;
        tagsToWrite['XMP:Rating'] = rating;
        // Windows Explorer uses RatingPercent (0-99)
        const ratingMap = { 0: 0, 1: 1, 2: 25, 3: 50, 4: 75, 5: 99 };
        tagsToWrite['RatingPercent'] = ratingMap[rating] || 0;
    }

    try {
        // If updating label, we also want to update Keywords (Tags) for Windows Explorer
        if (label !== undefined) {
            tagsToWrite['Label'] = label;
            tagsToWrite['XMP:Label'] = label;

            // Read existing keywords to preserve them
            const currentMeta = await exiftool.read(file);
            let keywords = currentMeta.Keywords || [];
            // Ensure it's an array (exiftool might return a string for single keyword)
            if (typeof keywords === 'string') keywords = [keywords];
            
            // Remove known color labels from keywords to avoid duplicates/conflicts
            const colorLabels = ['Red', 'Yellow', 'Green', 'Blue', 'Purple', 'Orange', 'Gray'];
            keywords = keywords.filter(k => !colorLabels.includes(k));
            
            // Add the new label as a keyword
            if (label) {
                keywords.push(label);
            }

            tagsToWrite['Keywords'] = keywords;
            tagsToWrite['Subject'] = keywords; // XMP:Subject
            tagsToWrite['XPKeywords'] = keywords.join(';'); // Windows specific
        }

        // Write metadata and prevent creating a backup file (_original)
        await exiftool.write(file, tagsToWrite, ['-overwrite_original']);
        res.json({ success: true });
    } catch (err) {
        console.error("Error writing metadata:", err);
        res.status(500).json({ error: err.message });
    }
});

// API: Copy Files
app.post('/api/copy-files', async (req, res) => {
    const { files, destination } = req.body;
    if (!files || !Array.isArray(files) || !destination) {
        return res.status(400).json({ error: 'Invalid request' });
    }

    try {
        // Ensure destination exists
        if (!fs.existsSync(destination)) {
            await fs.promises.mkdir(destination, { recursive: true });
        }

        let count = 0;
        for (const file of files) {
            const fileName = path.basename(file);
            const destPath = path.join(destination, fileName);
            
            // Copy file (overwrite if exists? or skip? let's overwrite for now or use copyFile)
            await fs.promises.copyFile(file, destPath);
            count++;
        }

        res.json({ success: true, count });
    } catch (err) {
        console.error("Error copying files:", err);
        res.status(500).json({ error: err.message });
    }
});

// Cleanup exiftool process on exit
process.on('exit', () => exiftool.end());

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
