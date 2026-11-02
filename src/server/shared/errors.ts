/** Lỗi nghiệp vụ có mã, message tiếng Việt hiển thị được cho người dùng. */
export class AppError extends Error {
  constructor(
    public readonly code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (what = 'Không tìm thấy') => new AppError('NOT_FOUND', what);
export const forbidden = () => new AppError('FORBIDDEN', 'Bạn không có quyền với mục này');
