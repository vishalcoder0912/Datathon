const validOrderDirections = new Set(['ASC', 'DESC']);
const validComparisonOperators = new Set(['=', '>=', '<=', '>', '<']);

export const parsePagination = (input = {}) => {
  const requestedPage = Number.parseInt(String(input.page || '1'), 10);
  const requestedPageSize = Number.parseInt(String(input.pageSize || '25'), 10);
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
  const pageSize = Number.isFinite(requestedPageSize) ? Math.min(100, Math.max(1, requestedPageSize)) : 25;

  return {
    page,
    pageSize,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
};

export const paginationMetadata = (pagination, total) => ({
  page: pagination.page,
  pageSize: pagination.pageSize,
  total,
  totalPages: total === 0 ? 0 : Math.ceil(total / pagination.pageSize),
});

const assertIdentifier = (identifier) => {
  if (!/^[a-z_][a-z0-9_.]*$/i.test(identifier)) {
    throw new Error('Unsafe SQL identifier.');
  }
  return identifier;
};

export const createFilterBuilder = (startingParameter = 1) => {
  const clauses = [];
  const parameters = [];

  const add = (sql, values = []) => {
    clauses.push(sql);
    parameters.push(...values);
    return builder;
  };

  const equals = (column, value) => {
    return compare(column, '=', value);
  };

  const compare = (column, operator, value) => {
    if (value === undefined || value === null || value === '') {
      return builder;
    }
    if (!validComparisonOperators.has(operator)) {
      throw new Error('Unsafe SQL comparison operator.');
    }
    const placeholder = `$${startingParameter + parameters.length}`;
    return add(`${assertIdentifier(column)} ${operator} ${placeholder}`, [value]);
  };

  const inList = (column, values) => {
    const normalized = Array.isArray(values) ? values.filter((value) => value !== undefined && value !== null && value !== '') : [];
    if (normalized.length === 0) {
      return builder;
    }
    const placeholder = `$${startingParameter + parameters.length}`;
    return add(`${assertIdentifier(column)} = ANY(${placeholder})`, [normalized]);
  };

  const dateRange = (column, dateFrom, dateTo) => {
    if (dateFrom) {
      compare(column, '>=', dateFrom);
    }
    if (dateTo) {
      compare(column, '<=', dateTo);
    }
    return builder;
  };

  const orderBy = (column, direction = 'ASC') => {
    const normalizedDirection = String(direction).toUpperCase();
    if (!validOrderDirections.has(normalizedDirection)) {
      throw new Error('Unsafe SQL order direction.');
    }
    return `${assertIdentifier(column)} ${normalizedDirection}`;
  };

  const builder = {
    add,
    compare,
    dateRange,
    equals,
    inList,
    orderBy,
    get parameters() {
      return parameters;
    },
    get whereClause() {
      return clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    },
  };

  return builder;
};

export const appendDateRange = (builder, column, dateFrom, dateTo) => {
  if (dateFrom) {
    builder.compare(column, '>=', dateFrom);
  }
  if (dateTo) {
    builder.compare(column, '<=', dateTo);
  }
  return builder;
};
