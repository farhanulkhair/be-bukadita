/**
 * Generate pagination metadata
 * @param {number} totalCount - Total number of records
 * @param {number} page - Current page number (1-based)
 * @param {number} limit - Number of records per page
 * @returns {object} Pagination metadata
 */
const paginate = (totalCount, page = 1, limit = 10) => {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.max(1, parseInt(limit, 10) || 10);
  const totalPages = Math.ceil(totalCount / safeLimit) || 0;
  const hasNextPage = safePage < totalPages;
  const hasPrevPage = safePage > 1;
  return {
    page: safePage,
    limit: safeLimit,
    total: totalCount,
    totalPages,
    hasNextPage,
    hasPrevPage,
  };
};

module.exports = {
  paginate,
};
