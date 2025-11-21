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

// API: List Photos in a Directory
app.get('/api/photos', async (req, res) => {
    const folderPath = getSafePath(req.query.path);
    
    try {
        console.log(`Scanning: ${folderPath}`);
        // Find jpg and png files
        const files = await glob(['*.{jpg,jpeg,png,JPG,JPEG,PNG}'], { 
            cwd: folderPath, 
            absolute: true,
            stats: true 
        });

        // We need to get metadata for these files. 
        // Reading metadata for ALL files at once might be slow. 
        // Strategy: Return list of files first, then fetch metadata lazily or in batches?
        // Or just read basic stats.
        // For a "lightweight" app, let's try to read metadata for the visible ones, 
        // but to sort/filter we might need it all. 
        // Let's start by just returning the file list and basic stats.
        
        const photoList = files.map(file => ({
            name: file.name,
            path: file.path,
            size: file.stats.size,
            mtime: file.stats.mtime
        }));

        res.json({ path: folderPath, photos: photoList });
    } catch (err) {
        console.error("Error scanning folder:", err);
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
        const transform = sharp(filePath)
            .resize(300, 300, { fit: 'inside' })
            .jpeg({ quality: 80 });
        
        res.type('image/jpeg');
        transform.pipe(res);
    } catch (err) {
        console.error("Error generating thumbnail:", err);
        res.status(500).send('Error generating thumbnail');
    }
});

// API: Get Full Image (for large view)
app.get('/api/image', (req, res) => {
    const filePath = req.query.file;
    if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).send('File not found');
    }
    res.sendFile(filePath);
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

        await exiftool.write(file, tagsToWrite);
        res.json({ success: true });
    } catch (err) {
        console.error("Error writing metadata:", err);
        res.status(500).json({ error: err.message });
    }
});

// Cleanup exiftool process on exit
process.on('exit', () => exiftool.end());

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
