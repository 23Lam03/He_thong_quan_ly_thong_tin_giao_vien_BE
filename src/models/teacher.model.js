import mongoose from "mongoose";

const degreeSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true },
    school: { type: String, required: true, trim: true },
    major: { type: String, required: true, trim: true },
    year: { type: Number, required: true },
    isGraduated: { type: Boolean, default: false },
  },
  { _id: false }
);

const teacherSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    code: { type: String, required: true, unique: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    teacherPositions: [{ type: mongoose.Schema.Types.ObjectId, ref: "TeacherPosition" }],
    // Tên trường theo dữ liệu mẫu, giữ để tương thích khi import template
    teacherPositionsId: [{ type: mongoose.Schema.Types.ObjectId, ref: "TeacherPosition" }],
    degrees: { type: [degreeSchema], default: [] },
  },
  { timestamps: true }
);

const Teacher = mongoose.model("Teacher", teacherSchema);

export default Teacher;
