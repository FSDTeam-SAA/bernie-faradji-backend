export interface IPaginationQuery {
  page?:   string;
  limit?:  string;
  search?: string;
  date?:   string;
}

export interface IMeta {
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

export interface IPaginationInfo {
  currentPage:  number;
  totalPages:   number;
  totalData:    number;
  hasNextPage:  boolean;
  hasPrevPage:  boolean;
}

export interface IPaginatedResponse<T> {
  message: string;
  meta:    IMeta;
  data:    T;
}
