import express from "express";
import {
  getTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  deleteTeacher,
} from "../controllers/teacher.controller.js";
import { uploadAvatar } from "../middleware/upload.js";

const router = express.Router();

router.get("/", getTeachers);
router.post("/", uploadAvatar.single("avatar"), createTeacher);
router.get("/:id", getTeacherById);
router.put("/:id", uploadAvatar.single("avatar"), updateTeacher);
router.delete("/:id", deleteTeacher);

export default router;
