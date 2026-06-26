from fastapi import Request
from fastapi.responses import JSONResponse

from app.core.exceptions import DiaryArchiveException


async def diaryarchive_exception_handler(
    request: Request, exc: DiaryArchiveException
) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
            }
        },
    )
