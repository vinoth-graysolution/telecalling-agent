import os
import requests
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from datetime import datetime, timedelta
from database.db import get_connection
from api.auth import require_roles
from integrations.zoho import zoho_service
from loguru import logger

_AUTHORIZED = Depends(require_roles(["admin", "vendor"]))

router = APIRouter(
    prefix="/api/integrations", 
    tags=["Integrations"]
)

@router.get("/zoho/authorize", dependencies=[_AUTHORIZED])
def authorize_zoho(auth=_AUTHORIZED):

    """Redirect to Zoho OAuth consent screen"""
    logger.info(f"Initiating Zoho authorization for user: {auth.get('sub')}")
    client_id = os.getenv("ZOHO_CLIENT_ID")
    redirect_uri = os.getenv("ZOHO_REDIRECT_URI")
    scope = "ZohoCRM.modules.ALL,ZohoCRM.settings.ALL"
    
    user_id = auth.get("sub")
    accounts_url = os.getenv("ZOHO_ACCOUNTS_URL", "https://accounts.zoho.com")
    auth_url = f"{accounts_url}/oauth/v2/auth?scope={scope}&client_id={client_id}&response_type=code&access_type=offline&redirect_uri={redirect_uri}&state={user_id}"
    
    logger.debug(f"Generated Zoho auth URL: {auth_url}")
    return {"url": auth_url}

@router.get("/zoho/callback")
def zoho_callback(code: str, state: str = None):
    """Handle Zoho OAuth redirect and exchange code for tokens"""
    client_id = os.getenv("ZOHO_CLIENT_ID")
    client_secret = os.getenv("ZOHO_CLIENT_SECRET")
    redirect_uri = os.getenv("ZOHO_REDIRECT_URI")
    accounts_url = os.getenv("ZOHO_ACCOUNTS_URL", "https://accounts.zoho.com")
    
    url = f"{accounts_url}/oauth/v2/token"
    data = {
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code"
    }
    
    response = requests.post(url, data=data)
    if response.status_code != 200:
        logger.error(f"Zoho token exchange failed: {response.text}")
        return RedirectResponse(url="/settings?zoho=error")
        
    res_data = response.json()
    access_token = res_data.get("access_token")
    refresh_token = res_data.get("refresh_token")
    expires_in = res_data.get("expires_in", 3600)
    
    # Save to DB
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO integrations (service_name, user_id, access_token, refresh_token, token_expiry)
                VALUES ('zoho_crm', %s, %s, %s, %s)
                ON CONFLICT (service_name, user_id) DO UPDATE SET
                access_token = EXCLUDED.access_token,
                refresh_token = EXCLUDED.refresh_token,
                token_expiry = EXCLUDED.token_expiry
                """,
                (state, access_token, refresh_token, datetime.now() + timedelta(seconds=expires_in))
            )
            conn.commit()
    finally:
        conn.close()
        
    return RedirectResponse(url="/settings?zoho=success")

@router.get("/zoho/status", dependencies=[_AUTHORIZED])
def get_zoho_status(auth=_AUTHORIZED):
    """Check if Zoho is connected for the current user"""
    user_id = auth.get("sub")
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT last_sync, created_at FROM integrations WHERE service_name = 'zoho_crm' AND user_id = %s", (user_id,))
            record = cur.fetchone()
            if record:
                return {
                    "connected": True,
                    "last_sync": record['last_sync'],
                    "connected_since": record['created_at']
                }
            return {"connected": False}
    finally:
        conn.close()

@router.post("/zoho/sync", dependencies=[_AUTHORIZED])
def sync_zoho_leads(auth=_AUTHORIZED):
    """Manually trigger lead sync from Zoho for the current user"""
    user_id = auth.get("sub")
    leads = zoho_service.fetch_leads(user_id)
    if not leads:
        return {"status": "error", "message": "No leads found or connection error"}
        
    conn = get_connection()
    count = 0
    try:
        with conn.cursor() as cur:
            for lead in leads:
                phone = lead.get("Phone") or lead.get("Mobile")
                if not phone: continue
                
                name = f"{lead.get('First_Name', '')} {lead.get('Last_Name', '')}".strip()
                external_id = lead.get("id")
                
                cur.execute(
                    """
                    INSERT INTO patients (name, phone, external_id, source)
                    VALUES (%s, %s, %s, 'zoho')
                    ON CONFLICT (phone) DO UPDATE SET
                    name = EXCLUDED.name,
                    external_id = EXCLUDED.external_id,
                    source = EXCLUDED.source
                    """,
                    (name, phone, external_id)
                )
                count += 1
            
            cur.execute("UPDATE integrations SET last_sync = CURRENT_TIMESTAMP WHERE service_name = 'zoho_crm' AND user_id = %s", (user_id,))
            conn.commit()
    finally:
        conn.close()
        
    return {"status": "success", "message": f"Synced {count} leads from Zoho"}
