from fastapi import APIRouter

from app.api.v1.endpoints import auth, diaries, discover, health, me_, tags, users

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(diaries.router)
api_router.include_router(me_.router)
api_router.include_router(tags.router)
api_router.include_router(discover.router)
