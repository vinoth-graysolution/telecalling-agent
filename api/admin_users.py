"""
Admin User Management via AWS Cognito.

Endpoints:
  GET    /api/admin/users            - list all users in the pool
  POST   /api/admin/users            - create a new Cognito user
  DELETE /api/admin/users/{username} - disable a user
"""

import os
import boto3
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from loguru import logger
from api.auth import require_roles

load_dotenv()

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID")

router = APIRouter(prefix="/api/admin/users", tags=["Admin Users"])
_ADMIN_ONLY = Depends(require_roles(["admin"]))


class CreateUserRequest(BaseModel):
    email: str
    name: str
    role: str = "vendor"  # "admin" or "vendor"


def _cognito_client():
    return boto3.client("cognito-idp", region_name=AWS_REGION)


@router.get("", summary="List all Cognito users")
def list_users(auth=_ADMIN_ONLY):
    client = _cognito_client()
    try:
        response = client.list_users(UserPoolId=USER_POOL_ID, Limit=60)
        users = []
        for u in response.get("Users", []):
            attrs = {a["Name"]: a["Value"] for a in u.get("Attributes", [])}
            users.append({
                "username": u["Username"],
                "email": attrs.get("email", u["Username"]),
                "name": attrs.get("name", ""),
                "status": u["UserStatus"],
                "enabled": u["Enabled"],
                "created_at": u["UserCreateDate"].isoformat(),
            })
        return users
    except ClientError as e:
        logger.error(f"Error listing users: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", summary="Create a new Cognito user")
def create_user(body: CreateUserRequest, auth=_ADMIN_ONLY):
    client = _cognito_client()
    try:
        user_attrs = [
            {"Name": "email", "Value": body.email},
            {"Name": "email_verified", "Value": "true"},
        ]
        if body.name:
            user_attrs.append({"Name": "name", "Value": body.name})

        response = client.admin_create_user(
            UserPoolId=USER_POOL_ID,
            Username=body.email,
            UserAttributes=user_attrs,
            DesiredDeliveryMediums=["EMAIL"],
        )

        # Add to the appropriate Cognito group
        group_name = "Admins" if body.role == "admin" else "Vendors"
        try:
            client.admin_add_user_to_group(
                UserPoolId=USER_POOL_ID,
                Username=body.email,
                GroupName=group_name,
            )
        except ClientError as ge:
            logger.warning(f"Could not add user to group '{group_name}': {ge}")

        return {
            "message": f"User {body.email} created. A temporary password was sent to their email.",
            "username": response["User"]["Username"],
        }

    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        if error_code == "UsernameExistsException":
            raise HTTPException(status_code=409, detail="A user with this email already exists.")
        logger.error(f"Error creating user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{username}", summary="Disable a Cognito user")
def disable_user(username: str, auth=_ADMIN_ONLY):
    client = _cognito_client()
    try:
        client.admin_disable_user(UserPoolId=USER_POOL_ID, Username=username)
        return {"message": f"User {username} has been disabled."}
    except ClientError as e:
        logger.error(f"Error disabling user: {e}")
        raise HTTPException(status_code=500, detail=str(e))
