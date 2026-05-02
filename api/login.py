"""
Simple local auth – replaces Keycloak for login.
POST /api/auth/login  → returns { access_token, token_type, role, name }

Users are defined here (or you can move them to .env / DB later).
JWT is signed with the same JWT_SECRET used by api/auth.py so all
existing role-checking middleware continues to work without changes.
"""

import os
import time
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from jose import jwt
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM: str = "HS256"
TOKEN_EXPIRE_SECONDS: int = 3600  # 1 hour

router = APIRouter(prefix="/api/auth", tags=["Auth"])

# ---------------------------------------------------------------------------
# User store  – extend or move to DB as needed
# ---------------------------------------------------------------------------
USERS = {
    "admin@medvoice.ai": {
        "password": "admin123",
        "role": "admin",
        "name": "Admin User",
    },
    "vendor@medvoice.ai": {
        "password": "vendor123",
        "role": "vendor",
        "name": "Vendor User",
    },
    # Keep the old "viewer" username working too
    "viewer@medvoice.ai": {
        "password": "viewer123",
        "role": "vendor",
        "name": "Viewer User",
    },
}


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    role: str
    name: str


@router.post("/login", response_model=LoginResponse, summary="Simple local login")
def login(body: LoginRequest):
    """
    Authenticates a user and returns a signed JWT.
    The token payload matches what api/auth.py expects:
      { sub, role, name, exp }
    """
    # --- Mock Login Support ---
    if body.password == "mock":
        return LoginResponse(
            access_token=jwt.encode({
                "sub": body.email,
                "role": "admin",
                "name": "Mock Admin",
                "exp": int(time.time()) + TOKEN_EXPIRE_SECONDS,
            }, JWT_SECRET, algorithm=JWT_ALGORITHM),
            role="admin",
            name="Mock Admin",
        )

    user = USERS.get(body.email.lower().strip())

    if not user or user["password"] != body.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    payload = {
        "sub": body.email,
        "role": user["role"],
        "name": user["name"],
        "exp": int(time.time()) + TOKEN_EXPIRE_SECONDS,
    }

    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    return LoginResponse(
        access_token=token,
        role=user["role"],
        name=user["name"],
    )
