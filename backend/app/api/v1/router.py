from fastapi import APIRouter

from app.api.v1.endpoints import admin, auth, comments, diaries, discover, health, media, me_, notifications, reports, search, social, tags, users

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(diaries.router)
api_router.include_router(comments.router)
api_router.include_router(social.router)
api_router.include_router(notifications.router)
api_router.include_router(me_.router)
api_router.include_router(tags.router)
api_router.include_router(discover.router)
api_router.include_router(search.router)
api_router.include_router(reports.router)
api_router.include_router(media.router)
api_router.include_router(admin.router)
