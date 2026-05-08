import os
import boto3
import sys
from dotenv import load_dotenv

load_dotenv()

def create_user(email, password, role="admin"):
    region = os.getenv("AWS_REGION", "us-east-1")
    user_pool_id = os.getenv("COGNITO_USER_POOL_ID")
    
    if not user_pool_id or user_pool_id == "us-east-1_XXXXXXXXX":
        print("Error: COGNITO_USER_POOL_ID is not set in .env")
        return

    client = boto3.client("cognito-idp", region_name=region)

    try:
        # 1. Create the user
        print(f"Creating user {email}...")
        client.admin_create_user(
            UserPoolId=user_pool_id,
            Username=email,
            UserAttributes=[
                {"Name": "email", "Value": email},
                {"Name": "email_verified", "Value": "true"},
                {"Name": "name", "Value": email.split('@')[0].capitalize()}
            ],
            MessageAction="SUPPRESS" # Don't send welcome email
        )

        # 2. Set the password
        print(f"Setting password for {email}...")
        client.admin_set_user_password(
            UserPoolId=user_pool_id,
            Username=email,
            Password=password,
            Permanent=True
        )

        # 3. Create 'Admins' group if it doesn't exist (for role mapping)
        if role == "admin":
            try:
                client.create_group(
                    GroupName="Admins",
                    UserPoolId=user_pool_id,
                    Description="Administrator group"
                )
                print("Created 'Admins' group.")
            except client.exceptions.GroupExistsException:
                pass

            # 4. Add user to Admins group
            print(f"Adding {email} to 'Admins' group...")
            client.admin_add_user_to_group(
                UserPoolId=user_pool_id,
                Username=email,
                GroupName="Admins"
            )

        print(f"Successfully created {role} user: {email}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python scratch/create_cognito_user.py <email> <password> [role]")
        sys.exit(1)
    
    email = sys.argv[1]
    password = sys.argv[2]
    role = sys.argv[3] if len(sys.argv) > 3 else "admin"
    
    create_user(email, password, role)
