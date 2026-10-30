import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    phoneNumber: { type: String, required: true, trim: true },
    address: { type: String, default: "", trim: true },
    identity: { type: String, default: "", trim: true },
    dob: { type: Date, default: null },
    avatar: { type: String, default: "" },
    isDeleted: { type: Boolean, default: false },
    role: { type: String, enum: ["STUDENT", "TEACHER", "ADMIN"], default: "TEACHER" },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
