from pydantic import BaseModel


class SocialStateRequest(BaseModel):
    active: bool
