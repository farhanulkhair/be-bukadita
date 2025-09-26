// Standardized response helpers
// Shape: { error: boolean, code: string, message: string, data?: any }

function success(res, code, message, data, status = 200) {
  const body = { error: false, code, message };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
}

function failure(res, code, message, status = 400, data) {
  const body = { error: true, code, message };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
}

module.exports = { success, failure };
