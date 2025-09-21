/**
 * Generate pagination metadata
 * @param {number} totalCount - Total number of records
 * @param {number} page - Current page number (1-based)
 * @param {number} limit - Number of records per page
 * @returns {object} Pagination metadata
 */
const paginate = (totalCount, page = 1, limit = 10) => {
  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    currentPage: page,
    totalPages,
    totalCount,
    limit,
    hasNextPage,
    hasPrevPage,
    nextPage: hasNextPage ? page + 1 : null,
    prevPage: hasPrevPage ? page - 1 : null,
  };
};

module.exports = {
  paginate,
};
