"""
JWT authentication & authorization helpers using AWS Cognito (RS256).

Cognito tokens are verified using the public keys (JWKS) provided by AWS.
"""

import os
import requests
from typing import List
from functools import lru_cache

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError
from dotenv import load_dotenv

load_dotenv()

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID")
APP_CLIENT_ID = os.getenv("COGNITO_APP_CLIENT_ID")

COGNITO_ISSUER = f"https://cognito-idp.{AWS_REGION}.amazonaws.com/{USER_POOL_ID}"
JWKS_URL = f"{COGNITO_ISSUER}/.well-known/jwks.json"

_bearer_scheme = HTTPBearer()

@lru_cache()
def get_jwks():
    """Fetch and cache the Cognito public keys."""
    try:
        response = requests.get(JWKS_URL)
        response.raise_for_status()
        return response.json()["keys"]
    except Exception as e:
        raise RuntimeError(f"Failed to fetch JWKS: {e}")

def decode_token(token: str) -> dict:
    """Decode and validate a Cognito JWT; raises HTTPException on failure."""
    try:
        # 1. Get the key ID (kid) from the token header
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        if not kid:
            raise JWTError("Missing kid in token header")

        # 2. Find the corresponding public key in JWKS
        keys = get_jwks()
        key = next((k for k in keys if k["kid"] == kid), None)
        if not key:
            raise JWTError("Public key not found in JWKS")

        # 3. Verify and decode the token
        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=APP_CLIENT_ID,
            issuer=COGNITO_ISSUER
        )

        # 4. Map Cognito 'sub' and custom groups/attributes to internal role structure
        # Cognito typically stores groups in 'cognito:groups'
        groups = payload.get("cognito:groups", [])
        
        # Simple mapping: if 'Admins' group exists, role is 'admin', else 'vendor'
        role = "admin" if "Admins" in groups else "vendor"
        
        return {
            "sub": payload.get("email") or payload.get("sub"), # Use email as primary ID if available
            "role": role,
            "name": payload.get("name") or payload.get("email") or "User",
            "exp": payload.get("exp")
        }

    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Authentication error: {exc}"
        )

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(_bearer_scheme),
) -> dict:
    """FastAPI dependency — validates Bearer JWT and returns the payload."""
    return decode_token(credentials.credentials)

def require_roles(allowed_roles: List[str]):
    """
    Factory that returns a FastAPI dependency enforcing role membership.
    """
    def _check_role(user: dict = Depends(get_current_user)) -> dict:
        role = user.get("role", "")
        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role}' is not authorized for this resource.",
            )
        return user
    return _check_role
