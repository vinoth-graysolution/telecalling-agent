import boto3
import os
from dotenv import load_dotenv

load_dotenv()

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID")

client = boto3.client("cognito-idp", region_name=AWS_REGION)

try:
    response = client.list_users(UserPoolId=USER_POOL_ID)
    users = response.get("Users", [])
    for user in users:
        print(f"Username: {user['Username']}, Status: {user['UserStatus']}")
        for attr in user['Attributes']:
            if attr['Name'] == 'email':
                print(f"  Email: {attr['Value']}")
except Exception as e:
    print(f"Error: {e}")
