"""
Authentication via AWS Cognito.
POST /api/auth/login  → returns { access_token, id_token, token_type, role, name }
"""

import os
import boto3
from botocore.exceptions import ClientError
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from loguru import logger
import requests as req

load_dotenv()

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID")
APP_CLIENT_ID = os.getenv("COGNITO_APP_CLIENT_ID")

router = APIRouter(prefix="/api/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    id_token: str
    token_type: str = "Bearer"
    role: str
    name: str


@router.post("/login", response_model=LoginResponse, summary="AWS Cognito login")
def login(body: LoginRequest):
    """
    Authenticates a user with AWS Cognito and returns tokens.
    """
    client = boto3.client("cognito-idp", region_name=AWS_REGION)
    try:
        response = client.initiate_auth(
            ClientId=APP_CLIENT_ID,
            AuthFlow="USER_PASSWORD_AUTH",
            AuthParameters={"USERNAME": body.email, "PASSWORD": body.password},
        )
        auth_result = response.get("AuthenticationResult", {})
        access_token = auth_result.get("AccessToken")
        id_token = auth_result.get("IdToken")

        user_info = client.get_user(AccessToken=access_token)
        name = body.email
        for attr in user_info.get("UserAttributes", []):
            if attr["Name"] == "name":
                name = attr["Value"]

        return LoginResponse(
            access_token=id_token,
            id_token=id_token,
            role="vendor",
            name=name,
        )

    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        if error_code in ["NotAuthorizedException", "UserNotFoundException"]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )
        elif error_code == "PasswordResetRequiredException":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Password reset required.",
            )
        elif error_code == "UserNotConfirmedException":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User email not confirmed.",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(e),
            )


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str


@router.post("/forgot-password", summary="Initiate password reset")
def forgot_password(body: ForgotPasswordRequest):
    client = boto3.client("cognito-idp", region_name=AWS_REGION)
    try:
        client.forgot_password(ClientId=APP_CLIENT_ID, Username=body.email)
        return {"message": "Password reset code sent to your email."}
    except ClientError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reset-password", summary="Confirm password reset")
def reset_password(body: ResetPasswordRequest):
    client = boto3.client("cognito-idp", region_name=AWS_REGION)
    try:
        client.confirm_forgot_password(
            ClientId=APP_CLIENT_ID,
            Username=body.email,
            ConfirmationCode=body.code,
            Password=body.new_password,
        )
        return {"message": "Password has been reset successfully."}
    except ClientError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/social-login/{provider}", summary="Initiate social login")
def social_login(provider: str):
    """Returns the Cognito Hosted UI URL for the specified provider."""
    domain = os.getenv("COGNITO_DOMAIN")
    redirect_uri = os.getenv("COGNITO_REDIRECT_URI")
    if not domain or not redirect_uri:
        raise HTTPException(
            status_code=500, detail="Cognito domain or redirect URI not configured"
        )
    url = (
        f"https://{domain}/oauth2/authorize"
        f"?identity_provider={provider}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&client_id={APP_CLIENT_ID}"
        f"&scope=email+openid"
    )
    return RedirectResponse(url=url)


@router.get("/callback", summary="Handle OAuth2 callback")
def oauth_callback(code: str = None, error: str = None, error_description: str = None):
    """Exchanges the authorization code for Cognito tokens or handles errors."""
    if error:
        logger.error(f"Cognito OAuth error: {error} - {error_description}")
        return RedirectResponse(url=f"/?error={error}&description={error_description}")

    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")

    domain = os.getenv("COGNITO_DOMAIN")
    redirect_uri = os.getenv("COGNITO_REDIRECT_URI")
    client_secret = os.getenv("COGNITO_CLIENT_SECRET")

    url = f"https://{domain}/oauth2/token"
    data = {
        "grant_type": "authorization_code",
        "client_id": APP_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "code": code,
    }

    auth = None
    if client_secret:
        from requests.auth import HTTPBasicAuth
        auth = HTTPBasicAuth(APP_CLIENT_ID, client_secret)

    try:
        response = req.post(url, data=data, auth=auth)
        response.raise_for_status()
        tokens = response.json()
        return RedirectResponse(url=f"/?access_token={tokens.get('id_token')}")
    except Exception as e:
        logger.error(f"OAuth callback error: {e}")
        return RedirectResponse(url="/?error=auth_failed")
