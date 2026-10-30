import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");

// Đảm bảo thư mục lưu ảnh tồn tại
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const EXT_BY_MIME = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = EXT_BY_MIME[file.mimetype] || path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
  },
});

export const uploadAvatar = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(new Error("Chỉ chấp nhận ảnh có định dạng JPG, PNG, WEBP hoặc GIF"));
    }
    cb(null, true);
  },
});

/**
 * Xóa file ảnh cũ khỏi thư mục uploads (bỏ qua lỗi nếu không tồn tại).
 */
export const removeAvatarFile = (avatarUrl) => {
  if (!avatarUrl) return;
  const fileName = path.basename(avatarUrl);
  if (!fileName) return;
  const filePath = path.join(UPLOAD_DIR, fileName);
  fs.promises.unlink(filePath).catch(() => {});
};
