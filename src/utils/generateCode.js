/**
 * Sinh chuỗi số ngẫu nhiên gồm `length` chữ số, duy nhất trong collection.
 * Dùng cho mã giáo viên (10 chữ số) và mã vị trí công tác.
 */
export const generateRandomCode = (length = 10) => {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
};

/**
 * Sinh mã duy nhất, tự retry khi trùng.
 * @param {(code: string) => Promise<boolean>} existsChecker hàm trả về true nếu mã đã tồn tại
 */
export const generateUniqueCode = async (existsChecker, length = 10, maxRetry = 20) => {
  for (let attempt = 0; attempt < maxRetry; attempt++) {
    const code = generateRandomCode(length);
    const exists = await existsChecker(code);
    if (!exists) return code;
  }
  throw new Error("Không thể sinh mã duy nhất, vui lòng thử lại");
};
