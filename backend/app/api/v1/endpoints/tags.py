from fastapi import APIRouter, Query

from app.core.exceptions import ValidationException
from app.services.tag_service import search_tags

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("/search")
async def tag_search(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
):
    if not q.strip():
        raise ValidationException("Query is required")
    results = await search_tags(q.strip(), limit)
    return {"data": results}