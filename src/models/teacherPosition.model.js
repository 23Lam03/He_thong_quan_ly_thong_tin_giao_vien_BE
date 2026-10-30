import mongoose from "mongoose";

const teacherPositionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true },
    des: { type: String, required: true, default: "", trim: true },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const TeacherPosition = mongoose.model("TeacherPosition", teacherPositionSchema);

export default TeacherPosition;
