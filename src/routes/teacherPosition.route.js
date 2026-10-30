import express from "express";
import {
  getTeacherPositions,
  createTeacherPosition,
  updateTeacherPosition,
  deleteTeacherPosition,
} from "../controllers/teacher.controller.js";

const router = express.Router();

router.get("/", getTeacherPositions);
router.post("/", createTeacherPosition);
router.put("/:id", updateTeacherPosition);
router.delete("/:id", deleteTeacherPosition);

export default router;
