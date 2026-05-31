import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Garantir que a pasta existe (útil no primeiro deploy)
const uploadsDir = path.resolve(process.cwd(), 'uploads', 'pets');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Formato de imagem inválido. Use JPG, PNG, WebP ou GIF.'));
  }
};

export const uploadPetAvatar = multer({
  storage,
  fileFilter,
  limits: { fileSize: (Number(process.env.MAX_UPLOAD_MB) || 10) * 1024 * 1024 },
}).single('avatar');
