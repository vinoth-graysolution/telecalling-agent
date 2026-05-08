import os
import requests
import time
from datetime import datetime, timedelta
from database.db import get_connection
from loguru import logger

class ZohoCRMService:
    def __init__(self):
        self.accounts_url = os.getenv("ZOHO_ACCOUNTS_URL", "https://accounts.zoho.com")
        
        # Dynamically set base_url based on accounts_url domain (.com, .in, .eu, etc.)
        domain = self.accounts_url.split('.')[-1]
        self.base_url = f"https://www.zohoapis.{domain}/crm/v3"
        
        self.client_id = os.getenv("ZOHO_CLIENT_ID")
        self.client_secret = os.getenv("ZOHO_CLIENT_SECRET")
        self.redirect_uri = os.getenv("ZOHO_REDIRECT_URI")

    def _get_integration_record(self, user_id=None):
        conn = get_connection()
        try:
            with conn.cursor() as cur:
                if user_id:
                    cur.execute("SELECT * FROM integrations WHERE service_name = 'zoho_crm' AND user_id = %s", (user_id,))
                else:
                    # Fallback for backward compatibility or global sync
                    cur.execute("SELECT * FROM integrations WHERE service_name = 'zoho_crm' AND user_id IS NULL")
                return cur.fetchone()
        finally:
            conn.close()

    def get_access_token(self, user_id=None):
        record = self._get_integration_record(user_id)
        if not record:
            return None

        # Check if expired
        if record['token_expiry'] and datetime.now() < record['token_expiry'] - timedelta(minutes=5):
            return record['access_token']

        # Refresh token
        return self.refresh_token(record['refresh_token'], user_id)

    def refresh_token(self, refresh_token, user_id=None):
        logger.info(f"Refreshing Zoho access token for user {user_id}")
        url = f"{self.accounts_url}/oauth/v2/token"
        data = {
            "refresh_token": refresh_token,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "refresh_token"
        }
        
        response = requests.post(url, data=data)
        if response.status_code != 200:
            logger.error(f"Failed to refresh Zoho token: {response.text}")
            return None
            
        res_data = response.json()
        access_token = res_data.get("access_token")
        expires_in = res_data.get("expires_in", 3600)
        
        # Update DB
        conn = get_connection()
        try:
            with conn.cursor() as cur:
                if user_id:
                    cur.execute(
                        "UPDATE integrations SET access_token = %s, token_expiry = %s WHERE service_name = 'zoho_crm' AND user_id = %s",
                        (access_token, datetime.now() + timedelta(seconds=expires_in), user_id)
                    )
                else:
                    cur.execute(
                        "UPDATE integrations SET access_token = %s, token_expiry = %s WHERE service_name = 'zoho_crm' AND user_id IS NULL",
                        (access_token, datetime.now() + timedelta(seconds=expires_in))
                    )
                conn.commit()
        finally:
            conn.close()
            
        return access_token

    def fetch_leads(self, user_id=None):
        token = self.get_access_token(user_id)
        if not token:
            return []

        headers = {"Authorization": f"Zoho-oauthtoken {token}"}
        url = f"{self.base_url}/Leads?fields=Last_Name,First_Name,Phone,Mobile,id"
        
        response = requests.get(url, headers=headers)
        if response.status_code != 200:
            logger.error(f"Failed to fetch Zoho leads: {response.text}")
            return []
            
        return response.json().get("data", [])

    def log_call(self, phone, direction, duration, status, transcript_summary, user_id=None):
        token = self.get_access_token(user_id)
        if not token:
            return False

        # 1. Find lead/contact by phone
        # Note: In production, you'd search both Leads and Contacts
        lead_id = self._find_record_by_phone(phone, token)
        if not lead_id:
            logger.warning(f"Could not find Zoho record for phone {phone}")
            return False

        # 2. Post to Calls module
        headers = {"Authorization": f"Zoho-oauthtoken {token}"}
        url = f"{self.base_url}/Calls"
        
        call_data = {
            "data": [
                {
                    "Who_Id": {"id": lead_id},
                    "Call_Type": "Outbound" if direction == "outbound" else "Inbound",
                    "Subject": f"AI Telecalling - {status}",
                    "Call_Duration": str(duration),
                    "Description": transcript_summary,
                    "Call_Start_Time": datetime.now().isoformat()
                }
            ]
        }
        
        response = requests.post(url, headers=headers, json=call_data)
        if response.status_code not in [200, 201]:
            logger.error(f"Failed to log call to Zoho: {response.text}")
            return False
            
        return True

    def _find_record_by_phone(self, phone, token):
        headers = {"Authorization": f"Zoho-oauthtoken {token}"}
        # Simplified search
        url = f"{self.base_url}/Leads/search?phone={phone}&fields=id,Last_Name,First_Name"
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            data = response.json().get("data")
            if data:
                return data[0]["id"]
        return None

zoho_service = ZohoCRMService()
