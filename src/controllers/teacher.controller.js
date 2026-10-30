import Teacher from "../models/teacher.model.js";
import User from "../models/user.model.js";
import TeacherPosition from "../models/teacherPosition.model.js";
import { generateUniqueCode } from "../utils/generateCode.js";
import { removeAvatarFile } from "../middleware/upload.js";

/**
 * Đường dẫn ảnh đại diện trả về cho frontend.
 */
const buildAvatarUrl = (file) => (file ? `/uploads/${file.filename}` : "");

/**
 * Multipart gửi mọi giá trị dưới dạng chuỗi, các mảng/object cần parse lại.
 */
const parseJsonField = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

/**
 * GET /teachers
 * Lấy danh sách giáo viên kèm thông tin user và vị trí công tác, có phân trang.
 */
export const getTeachers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);

    const filter = { isDeleted: false };
    if (req.query.keyword) {
      const keyword = req.query.keyword.trim();
      filter.userId = {
        $in: await User.find({
          isDeleted: false,
          $or: [
            { name: { $regex: keyword, $options: "i" } },
            { email: { $regex: keyword, $options: "i" } },
            { phoneNumber: { $regex: keyword, $options: "i" } },
          ],
        }).distinct("_id"),
      };
    }

    const [teachers, total] = await Promise.all([
      Teacher.find(filter)
        .populate("userId", "name email phoneNumber address identity dob avatar")
        .populate("teacherPositions", "name code des")
        .populate("teacherPositionsId", "name code des")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Teacher.countDocuments(filter),
    ]);

    const data = teachers.map((teacher) => ({
      _id: teacher._id,
      code: teacher.code,
      name: teacher.userId?.name ?? "",
      email: teacher.userId?.email ?? "",
      phoneNumber: teacher.userId?.phoneNumber ?? "",
      address: teacher.userId?.address ?? "",
      identity: teacher.userId?.identity ?? "",
      dob: teacher.userId?.dob ?? null,
      avatar: teacher.userId?.avatar ?? "",
      isActive: teacher.isActive,
      startDate: teacher.startDate,
      endDate: teacher.endDate,
      teacherPositions: teacher.teacherPositions?.length
        ? teacher.teacherPositions
        : teacher.teacherPositionsId ?? [],
      degrees: teacher.degrees ?? [],
      createdAt: teacher.createdAt,
      updatedAt: teacher.updatedAt,
    }));

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách giáo viên thành công",
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /teachers/:id
 */
export const getTeacherById = async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ _id: req.params.id, isDeleted: false })
      .populate("userId")
      .populate("teacherPositions", "name code des")
      .lean();

    if (!teacher) {
      return res.status(404).json({ success: false, message: "Không tìm thấy giáo viên" });
    }

    return res.status(200).json({ success: true, data: teacher });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /teachers
 * Tạo mới giáo viên: sinh mã 10 chữ số ngẫu nhiên duy nhất, email phải duy nhất.
 */
export const createTeacher = async (req, res) => {
  try {
    const {
      name,
      email,
      phoneNumber,
      address,
      identity,
      dob,
      startDate,
      endDate,
      isActive = true,
      teacherPositions: rawTeacherPositions = [],
      degrees: rawDegrees = [],
    } = req.body;

    const teacherPositions = parseJsonField(rawTeacherPositions, []);
    const degrees = parseJsonField(rawDegrees, []);

    // Kiểm tra đầy đủ các trường bắt buộc (trừ ảnh đại diện)
    const missingFields = [];
    if (!name?.trim()) missingFields.push("họ tên");
    if (!email?.trim()) missingFields.push("email");
    if (!phoneNumber?.trim()) missingFields.push("số điện thoại");
    if (!identity?.trim()) missingFields.push("số CCCD/CMND");
    if (!dob) missingFields.push("ngày sinh");
    if (!address?.trim()) missingFields.push("địa chỉ");
    if (!startDate) missingFields.push("ngày bắt đầu công tác");
    if (!endDate) missingFields.push("ngày kết thúc công tác");
    if (!Array.isArray(teacherPositions) || teacherPositions.length === 0) {
      missingFields.push("vị trí công tác");
    }
    if (!Array.isArray(degrees) || degrees.length === 0) {
      missingFields.push("trình độ học vấn");
    }

    if (missingFields.length > 0) {
      removeAvatarFile(req.file ? buildAvatarUrl(req.file) : "");
      return res.status(400).json({
        success: false,
        message: `Vui lòng nhập đầy đủ: ${missingFields.join(", ")}`,
      });
    }

    const invalidDegree = degrees.find(
      (d) => !d?.type?.trim() || !d?.school?.trim() || !d?.major?.trim() || !d?.year
    );
    if (invalidDegree) {
      removeAvatarFile(req.file ? buildAvatarUrl(req.file) : "");
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ thông tin học vấn (trình độ, trường, chuyên ngành, năm tốt nghiệp)",
      });
    }

    const existUser = await User.findOne({ email: email.trim().toLowerCase() });
    if (existUser) {
      removeAvatarFile(req.file ? buildAvatarUrl(req.file) : "");
      return res.status(400).json({ success: false, message: "Email đã tồn tại trong hệ thống" });
    }

    const code = await generateUniqueCode(
      async (candidate) => (await Teacher.exists({ code: candidate })) !== null,
      10
    );

    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phoneNumber: phoneNumber.trim(),
      address: address?.trim() ?? "",
      identity: identity?.trim() ?? "",
      dob: dob ? new Date(dob) : null,
      avatar: buildAvatarUrl(req.file),
      role: "TEACHER",
      isDeleted: false,
    });

    let teacher;
    try {
      teacher = await Teacher.create({
        userId: user._id,
        code,
        isActive,
        isDeleted: false,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        teacherPositions,
        degrees,
      });
    } catch (teacherError) {
      // Tạo teacher thất bại thì xóa user đã tạo để không để lại dữ liệu mồ côi
      await User.findByIdAndDelete(user._id);
      removeAvatarFile(req.file ? buildAvatarUrl(req.file) : "");
      throw teacherError;
    }

    const populated = await Teacher.findById(teacher._id)
      .populate("userId")
      .populate("teacherPositions", "name code des")
      .lean();

    return res.status(201).json({
      success: true,
      message: "Tạo mới giáo viên thành công",
      data: populated,
    });
  } catch (error) {
    if (error.code === 11000) {
      removeAvatarFile(req.file ? buildAvatarUrl(req.file) : "");
      return res.status(400).json({ success: false, message: "Email hoặc mã giáo viên đã tồn tại" });
    }
    removeAvatarFile(req.file ? buildAvatarUrl(req.file) : "");
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /teachers/:id
 */
export const updateTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ _id: req.params.id, isDeleted: false });
    if (!teacher) {
      return res.status(404).json({ success: false, message: "Không tìm thấy giáo viên" });
    }

    const { name, email, phoneNumber, address, identity, dob, startDate, endDate, isActive, teacherPositions: rawPositions, degrees: rawDegrees } =
      req.body;

    const teacherPositions =
      rawPositions !== undefined ? parseJsonField(rawPositions, []) : undefined;
    const degrees = rawDegrees !== undefined ? parseJsonField(rawDegrees, []) : undefined;

    if (email) {
      const normalizedEmail = email.trim().toLowerCase();
      const existUser = await User.findOne({ email: normalizedEmail, _id: { $ne: teacher.userId } });
      if (existUser) {
        removeAvatarFile(req.file ? buildAvatarUrl(req.file) : "");
        return res.status(400).json({ success: false, message: "Email đã tồn tại trong hệ thống" });
      }
    }

    const currentUser = await User.findById(teacher.userId).lean();
    let avatar = currentUser?.avatar ?? "";

    // Người dùng bấm "Xóa ảnh": xóa file cũ trên server và bỏ trường avatar
    const wantRemoveAvatar =
      req.body.removeAvatar === "1" ||
      req.body.removeAvatar === 1 ||
      req.body.removeAvatar === true ||
      req.body.removeAvatar === "true";

    if (wantRemoveAvatar) {
      removeAvatarFile(currentUser?.avatar);
      avatar = "";
    }

    if (req.file) {
      // Thay ảnh cũ bằng ảnh vừa tải lên
      removeAvatarFile(currentUser?.avatar);
      avatar = buildAvatarUrl(req.file);
    }

    await User.findByIdAndUpdate(
      teacher.userId,
      {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(email !== undefined ? { email: email.trim().toLowerCase() } : {}),
        ...(phoneNumber !== undefined ? { phoneNumber: phoneNumber.trim() } : {}),
        ...(address !== undefined ? { address: address.trim() } : {}),
        ...(identity !== undefined ? { identity: identity.trim() } : {}),
        ...(dob !== undefined ? { dob: dob ? new Date(dob) : null } : {}),
        ...(req.file || wantRemoveAvatar ? { avatar } : {}),
      },
      { new: true }
    );

    Object.assign(teacher, {
      ...(isActive !== undefined ? { isActive } : {}),
      ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
      ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
      ...(teacherPositions !== undefined ? { teacherPositions } : {}),
      ...(degrees !== undefined ? { degrees } : {}),
    });
    await teacher.save();

    const populated = await Teacher.findById(teacher._id)
      .populate("userId")
      .populate("teacherPositions", "name code des")
      .lean();

    return res.status(200).json({ success: true, message: "Cập nhật giáo viên thành công", data: populated });
  } catch (error) {
    if (error.code === 11000) {
      removeAvatarFile(req.file ? buildAvatarUrl(req.file) : "");
      return res.status(400).json({ success: false, message: "Email đã tồn tại trong hệ thống" });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /teachers/:id
 */
export const deleteTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ _id: req.params.id, isDeleted: false });
    if (!teacher) {
      return res.status(404).json({ success: false, message: "Không tìm thấy giáo viên" });
    }

    teacher.isDeleted = true;
    await teacher.save();
    await User.findByIdAndUpdate(teacher.userId, { isDeleted: true });

    return res.status(200).json({ success: true, message: "Xóa giáo viên thành công" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /teacher-positions
 */
export const getTeacherPositions = async (req, res) => {
  try {
    const filter = { isDeleted: false };
    if (req.query.keyword) {
      const keyword = req.query.keyword.trim();
      filter.$or = [
        { name: { $regex: keyword, $options: "i" } },
        { code: { $regex: keyword, $options: "i" } },
      ];
    }

    const positions = await TeacherPosition.find(filter).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách vị trí công tác thành công",
      data: positions,
      total: positions.length,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /teacher-positions
 * Tạo mới vị trí công tác, code phải duy nhất.
 */
export const createTeacherPosition = async (req, res) => {
  try {
    const { name, code, des, isActive = true } = req.body;

    if (!name || !code || !des?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập tên, mã và mô tả vị trí công tác",
      });
    }

    const normalizedCode = code.trim();
    const exist = await TeacherPosition.findOne({ code: normalizedCode });
    if (exist) {
      return res.status(400).json({ success: false, message: "Mã vị trí công tác đã tồn tại" });
    }

    const position = await TeacherPosition.create({
      name: name.trim(),
      code: normalizedCode,
      des: des.trim(),
      isActive,
      isDeleted: false,
    });

    return res.status(201).json({
      success: true,
      message: "Tạo mới vị trí công tác thành công",
      data: position,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Mã vị trí công tác đã tồn tại" });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /teacher-positions/:id
 */
export const updateTeacherPosition = async (req, res) => {
  try {
    const { name, code, des, isActive } = req.body;

    if (des !== undefined && !des.trim()) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập mô tả vị trí công tác",
      });
    }

    if (code) {
      const exist = await TeacherPosition.findOne({ code: code.trim(), _id: { $ne: req.params.id } });
      if (exist) {
        return res.status(400).json({ success: false, message: "Mã vị trí công tác đã tồn tại" });
      }
    }

    const position = await TeacherPosition.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(code !== undefined ? { code: code.trim() } : {}),
        ...(des !== undefined ? { des: des.trim() } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      { new: true }
    );

    if (!position) {
      return res.status(404).json({ success: false, message: "Không tìm thấy vị trí công tác" });
    }

    return res.status(200).json({ success: true, message: "Cập nhật vị trí công tác thành công", data: position });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Mã vị trí công tác đã tồn tại" });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /teacher-positions/:id
 */
export const deleteTeacherPosition = async (req, res) => {
  try {
    const position = await TeacherPosition.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );

    if (!position) {
      return res.status(404).json({ success: false, message: "Không tìm thấy vị trí công tác" });
    }

    return res.status(200).json({ success: true, message: "Xóa vị trí công tác thành công" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
