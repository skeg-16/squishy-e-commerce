class AppError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    Object.assign(this, { status, code, fields });
  }
}
const fail = (status, code, message, fields) => { throw new AppError(status, code, message, fields); };
module.exports = { AppError, fail };
