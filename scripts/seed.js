/**
 * Import dữ liệu mẫu vào MongoDB.
 * Nguồn: mock_data/school.users.json, school.teachers.json, school.teacherpositions.json
 * Chạy: npm run seed
 */
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

import User from "../src/models/user.model.js";
import Teacher from "../src/models/teacher.model.js";
import TeacherPosition from "../src/models/teacherPosition.model.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "mock_data");

const readJson = (fileName) =>
  JSON.parse(fs.readFileSync(path.join(DATA_DIR, fileName), "utf8"));

const oid = (value) => new mongoose.Types.ObjectId(String(value));

const connect = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");
};

const importUsers = async () => {
  const raw = readJson("school.users.json");
  const docs = [];
  for (const item of raw) {
    docs.push({
      _id: oid(item._id.$oid),
      name: item.name ?? "Người dùng",
      email: item.email ?? `user_${item._id.$oid}@school.edu.vn`,
      phoneNumber: item.phoneNumber ?? "0000000000",
      address: item.address ?? "",
      identity: item.identity ?? "",
      dob: item.dob?.$date ? new Date(item.dob.$date) : null,
      role: item.role ?? "TEACHER",
      isDeleted: false,
    });
  }
  await User.bulkWrite(docs.map((doc) => ({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } })));
  console.log(`Imported ${docs.length} users`);
};

const importPositions = async () => {
  const raw = readJson("school.teacherpositions.json");
  const docs = raw.map((item) => ({
    _id: oid(item._id.$oid),
    name: item.name,
    code: item.code,
    des: item.des ?? "",
    isActive: item.isActive ?? true,
    isDeleted: false,
  }));
  await TeacherPosition.bulkWrite(
    docs.map((doc) => ({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } }))
  );
  console.log(`Imported ${docs.length} teacher positions`);
};

const importTeachers = async () => {
  const raw = readJson("school.teachers.json");
  const existingUserIds = new Set((await User.find().distinct("_id")).map(String));

  // Bổ sung user cho các giáo viên có userId không tồn tại trong dữ liệu mẫu
  const missing = [];
  for (const item of raw) {
    const userId = String(item.userId?.$oid ?? "");
    if (userId && !existingUserIds.has(userId)) missing.push(userId);
  }
  for (const userId of missing) {
    const shortId = userId.slice(-8);
    await User.create({
      _id: oid(userId),
      name: "Giáo viên",
      email: `teacher_${shortId}@school.edu.vn`,
      phoneNumber: "0000000000",
      address: "",
      identity: "",
      dob: null,
      role: "TEACHER",
      isDeleted: false,
    });
    console.log(`Created placeholder user for teacher ${userId}`);
  }

  const docs = raw.map((item) => ({
    _id: oid(item._id.$oid),
    userId: oid(item.userId.$oid),
    code: item.code,
    isActive: item.isActive ?? true,
    isDeleted: false,
    startDate: item.startDate?.$date ? new Date(item.startDate.$date) : null,
    endDate: item.endDate?.$date ? new Date(item.endDate.$date) : null,
    teacherPositions: (item.teacherPositionsId ?? []).map((p) => oid(p.$oid)),
    teacherPositionsId: (item.teacherPositionsId ?? []).map((p) => oid(p.$oid)),
    degrees: (item.degrees ?? []).map((d) => ({
      type: d.type ?? "",
      school: d.school ?? "",
      major: d.major ?? "",
      year: d.year ?? null,
      isGraduated: d.isGraduated ?? false,
    })),
  }));

  await Teacher.bulkWrite(docs.map((doc) => ({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } })));
  console.log(`Imported ${docs.length} teachers`);
};

const run = async () => {
  await connect();
  await importUsers();
  await importPositions();
  await importTeachers();
  await mongoose.connection.close();
  console.log("Seed completed");
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
