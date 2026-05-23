const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `meal-${uniqueSuffix}${ext}`);
  }
});

// File filter - accept only images
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('סוג קובץ לא נתמך. אנא העלה תמונה בפורמט JPEG, PNG או WebP.'), false);
  }
};

// Multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

/**
 * Middleware to compress and resize uploaded images using sharp.
 * Runs after multer has saved the original file.
 */
async function compressImage(req, res, next) {
  if (!req.file) {
    return next();
  }

  try {
    const filePath = req.file.path;
    const ext = path.extname(filePath).toLowerCase();
    const compressedFileName = `compressed-${req.file.filename}`;
    const compressedPath = path.join(UPLOAD_DIR, compressedFileName);

    let sharpInstance = sharp(filePath)
      .resize(1024, 1024, {
        fit: 'inside',
        withoutEnlargement: true
      });

    // Apply format-specific compression
    if (ext === '.png') {
      sharpInstance = sharpInstance.png({ quality: 80 });
    } else if (ext === '.webp') {
      sharpInstance = sharpInstance.webp({ quality: 80 });
    } else {
      sharpInstance = sharpInstance.jpeg({ quality: 80 });
    }

    await sharpInstance.toFile(compressedPath);

    // Remove original and replace with compressed
    fs.unlinkSync(filePath);
    fs.renameSync(compressedPath, filePath);

    next();
  } catch (error) {
    console.error('Image compression error:', error);
    // Continue even if compression fails - the original image is still usable
    next();
  }
}

module.exports = { upload, compressImage };
