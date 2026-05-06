import requests
from fastapi import FastAPI
from pydantic import BaseModel, Field

# ── FastAPI app with Swagger metadata ─────────────────────────────────────────
app = FastAPI(
    title="Axis Finance Bank – Outbound Call Trigger",
    description=(
        "Use this API to initiate an outbound EMI reminder call via Exotel.\n\n"
        "The AI agent **Vijay** will call the customer, verify identity, "
        "remind about the upcoming EMI, and offer a payment link if needed."
    ),
    version="1.0.0",
)

# ── Ngrok / server URL ─────────────────────────────────────────────────────────
OUTBOUND_SERVER_URL = "https://psychologically-nonprecious-vonnie.ngrok-free.dev/start"


# ── Request / Response models ──────────────────────────────────────────────────
class MakeCallRequest(BaseModel):
    phone_number: str = Field(
        ...,
        example="+919952825938",
        description=(
            "Customer's phone number in E.164 format. "
            "Example: +919952825938 (India)"
        ),
    )


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
def make_call(body: MakeCallRequest) -> MakeCallResponse:
    payload = {
        "dialout_settings": {
            "phone_number": body.phone_number,
        }
    }

    response = requests.post(OUTBOUND_SERVER_URL, json=payload, timeout=15)

    return MakeCallResponse(
        status="call_initiated" if response.status_code == 200 else "failed",
        phone_number=body.phone_number,
        server_status_code=response.status_code,
        server_response=response.text,
    )