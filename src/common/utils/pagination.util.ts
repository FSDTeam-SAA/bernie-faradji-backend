export const createFilter = (
  search?: string,
  date?: string | Date,
  options?: { searchField?: string; dateField?: string },
): Record<string, any> => {
  const searchField = options?.searchField ?? 'name';
  const dateField   = options?.dateField   ?? 'createdAt';
  const filter: Record<string, any> = {};

  if (search) {
    filter[searchField] = { $regex: search, $options: 'i' };
  }

  if (date) {
    const _date      = new Date(date);
    const startOfDay = new Date(_date.getFullYear(), _date.getMonth(), _date.getDate());
    const endOfDay   = new Date(_date.getFullYear(), _date.getMonth(), _date.getDate() + 1);
    filter[dateField] = { $gte: startOfDay, $lt: endOfDay };
  }

  return filter;
};

/** Top-level meta{} — consumed by ResponseInterceptor */
export const createMeta = (page: number, limit: number, total: number) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
});


export const createPaginationInfo = (page: number, limit: number, totalData: number) => ({
  currentPage:  page,
  totalPages:   Math.ceil(totalData / limit),
  totalData,
  hasNextPage:  page * limit < totalData,
  hasPrevPage:  page > 1,
});
