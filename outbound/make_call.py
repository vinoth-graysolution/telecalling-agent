import logging
import os
import re

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# ── Validate required env vars at startup ─────────────────────────────────────
OUTBOUND_SERVER_URL = os.getenv("OUTBOUND_SERVER_URL")
if not OUTBOUND_SERVER_URL:
    raise RuntimeError(
        "OUTBOUND_SERVER_URL is not set in .env. "
        "Example: OUTBOUND_SERVER_URL=http://localhost:7860/start"
    )

# ── FastAPI app with Swagger metadata ─────────────────────────────────────────
app = FastAPI(
    title="Axis Finance Bank – Outbound Call Trigger",
    description=(
        "Use this API to initiate an outbound EMI reminder call via Exotel.\n\n"
        "The AI agent Vijay will call the customer, verify identity, "
        "remind about the upcoming EMI, and offer a payment link if needed."
    ),
    version="1.0.0",
)


class MakeCallRequest(BaseModel):
    phone_number: str = Field(
        ...,
        example="+919952825938",
        description=(
            "Customer's phone number in E.164 format. "
            "Example: +919952825938 (India)"
        ),
    )

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not re.match(r"^\+\d{7,15}$", v):
            raise ValueError(
                "Phone number must be in E.164 format (e.g. +919952825938)"
            )
        return v


class MakeCallResponse(BaseModel):
    status: str
    phone_number: str
    server_status_code: int
    server_response: str


# ── Endpoint ───────────────────────────────────────────────────────────────────
@app.post(
    "/make-call",
    response_model=MakeCallResponse,
    summary="Initiate an outbound EMI reminder call",
    description=(
        "Triggers Vijay (AI voice agent) to call the given phone number. "
        "The call flow:\n"
        "1. Verify customer identity\n"
        "2. Deliver EMI reminder\n"
        "3. Ask payment status\n"
        "4. Offer WhatsApp payment link if needed\n"
        "5. Close politely"
    ),
    tags=["Outbound Calls"],
)
async def make_call(body: MakeCallRequest) -> MakeCallResponse:
    payload = {
        "dialout_settings": {
            "phone_number": body.phone_number,
        }
    }

    logger.info("Initiating outbound call to %s via %s", body.phone_number, OUTBOUND_SERVER_URL)

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(OUTBOUND_SERVER_URL, json=payload)
    except httpx.TimeoutException:
        logger.error("Request to outbound server timed out")
        raise HTTPException(status_code=504, detail="Upstream server timed out")
    except httpx.RequestError as e:
        logger.error("Failed to reach outbound server: %s", e)
        raise HTTPException(status_code=502, detail=f"Failed to reach server: {e}")

    logger.info(
        "Outbound server responded with status %s for %s",
        response.status_code, body.phone_number,
    )

    return MakeCallResponse(
        status="call_initiated" if response.status_code == 200 else "failed",
        phone_number=body.phone_number,
        server_status_code=response.status_code,
        server_response=response.text,
    )