import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import teacherRoutes from "./src/routes/teacher.route.js";
import teacherPositionRoutes from "./src/routes/teacherPosition.route.js";
import { UPLOAD_DIR } from "./src/middleware/upload.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Phục vụ ảnh đại diện giáo viên
app.use("/uploads", express.static(UPLOAD_DIR));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Hệ thống quản lý thông tin giáo viên",
    endpoints: ["/teachers", "/teacher-positions"],
  });
});

app.use("/teachers", teacherRoutes);
app.use("/teacher-positions", teacherPositionRoutes);

app.use((err, req, res, next) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ success: false, message: "Ảnh vượt quá kích thước cho phép (tối đa 5MB)" });
  }
  if (err?.message?.includes("Chỉ chấp nhận ảnh")) {
    return res.status(400).json({ success: false, message: err.message });
  }
  console.error(err);
  res.status(500).json({ success: false, message: "Đã xảy ra lỗi máy chủ" });
});

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.log("Error connecting to MongoDB:", err.message);
  });
