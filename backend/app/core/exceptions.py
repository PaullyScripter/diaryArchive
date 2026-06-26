from fastapi import status


class DiaryArchiveException(Exception):  # noqa: N818
    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    code: str = "internal_error"
    message: str = "An unexpected error occurred"

    def __init__(self, message: str | None = None):
        if message:
            self.message = message


class NotFoundException(DiaryArchiveException):
    status_code: int = status.HTTP_404_NOT_FOUND
    code: str = "not_found"
    message: str = "Resource not found"


class PermissionDeniedException(DiaryArchiveException):
    status_code: int = status.HTTP_403_FORBIDDEN
    code: str = "forbidden"
    message: str = "You do not have permission to perform this action"


class ValidationException(DiaryArchiveException):
    status_code: int = status.HTTP_422_UNPROCESSABLE_ENTITY
    code: str = "validation_error"
    message: str = "Validation failed"


class RateLimitException(DiaryArchiveException):
    status_code: int = status.HTTP_429_TOO_MANY_REQUESTS
    code: str = "rate_limited"
    message: str = "Too many requests. Please try again later."


class AuthenticationException(DiaryArchiveException):
    status_code: int = status.HTTP_401_UNAUTHORIZED
    code: str = "unauthorized"
    message: str = "Not authenticated"


class ConflictException(DiaryArchiveException):
    status_code: int = status.HTTP_409_CONFLICT
    code: str = "conflict"
    message: str = "Resource already exists"
