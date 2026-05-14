import logging
import os
import xml.etree.ElementTree as ET
from contextlib import asynccontextmanager

import aiohttp
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.websockets import WebSocketState

load_dotenv(override=True)

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Validate required env vars at startup ─────────────────────────────────────
_EXOTEL_PHONE_NUMBER = os.getenv("EXOTEL_PHONE_NUMBER") or os.getenv("EXOTEL_WHATSAPP_NUMBER")
if not _EXOTEL_PHONE_NUMBER:
    raise RuntimeError(
        "Caller number not set. Define EXOTEL_PHONE_NUMBER (or EXOTEL_WHATSAPP_NUMBER) in .env"
    )

# ── Deferred bot import — fail fast at startup ────────────────────────────────
try:
    from bot import bot as run_bot  # noqa: E402  (after env validation)
    from pipecat.runner.types import WebSocketRunnerArguments
except ImportError as exc:
    raise RuntimeError(f"Failed to import bot module at startup: {exc}") from exc


# ── Helpers ───────────────────────────────────────────────────────────────────


async def make_exotel_call(session: aiohttp.ClientSession, to_number: str, from_number: str) -> dict:
    """Make an outbound call using Exotel's Connect API."""
    api_key = os.getenv("EXOTEL_API_KEY")
    api_token = os.getenv("EXOTEL_API_TOKEN")
    # Support both EXOTEL_ACCOUNT_SID and legacy EXOTEL_SID
    sid = os.getenv("EXOTEL_ACCOUNT_SID") or os.getenv("EXOTEL_SID")
    subdomain = os.getenv("EXOTEL_SUBDOMAIN", "api.in.exotel.com")

    if not all([api_key, api_token, sid]):
        raise ValueError(
            "Missing Exotel credentials. Required in .env: "
            "EXOTEL_API_KEY, EXOTEL_API_TOKEN, EXOTEL_ACCOUNT_SID"
        )

    # Exotel Connect API endpoint (uses regional subdomain)
    url = f"https://{subdomain}/v1/Accounts/{sid}/Calls/connect"

    # Use form data for Exotel Connect Two Numbers API
    data = {
        "From": from_number,     # Bot number (called first, connects to WebSocket via App Bazaar)
        "To": to_number,         # Customer number (called second, after bot "answers")
        "CallerId": from_number,  # Your ExoPhone number
        "CallType": "trans",      # Transactional call
    }

    auth = aiohttp.BasicAuth(api_key, api_token)
    timeout = aiohttp.ClientTimeout(total=15)

    async with session.post(url, data=data, auth=auth, timeout=timeout) as response:
        result_text = await response.text()

        if response.status != 200:
            raise Exception(f"Exotel API error ({response.status}): {result_text}")

        # Parse XML response safely
        call_sid = "unknown"
        try:
            root = ET.fromstring(result_text)
            call_sid = root.findtext(".//Sid") or "unknown"
        except ET.ParseError:
            logger.warning("Could not parse Exotel XML response; raw: %s", result_text[:200])

        logger.info("Exotel call initiated — CallSid: %s", call_sid)
        return {"status": "call_initiated", "call_sid": call_sid}


# ── Lifespan ──────────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create shared aiohttp session for Exotel API calls
    app.state.session = aiohttp.ClientSession()
    logger.info("aiohttp session created")
    yield
    await app.state.session.close()
    logger.info("aiohttp session closed")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(lifespan=lifespan)

# TODO: Restrict allow_origins to specific domains before deploying to production
_ALLOWED_ORIGINS = os.getenv("CORS_ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routes ────────────────────────────────────────────────────────────────────


@app.post("/start")
async def initiate_outbound_call(request: Request) -> JSONResponse:
    """Handle outbound call request and initiate call via Exotel."""
    logger.info("Received outbound call request")

    # Initialize call_sid so it's always bound before the return statement
    call_sid = "unknown"

    try:
        data = await request.json()

        if not data.get("dialout_settings"):
            raise HTTPException(
                status_code=400, detail="Missing 'dialout_settings' in the request body"
            )

        if not data["dialout_settings"].get("phone_number"):
            raise HTTPException(
                status_code=400, detail="Missing 'phone_number' in dialout_settings"
            )

        phone_number = str(data["dialout_settings"]["phone_number"])
        logger.info("Processing outbound call to %s", phone_number)

        try:
            call_result = await make_exotel_call(
                session=request.app.state.session,
                to_number=phone_number,
                from_number=_EXOTEL_PHONE_NUMBER,
            )
            call_sid = call_result.get("call_sid", "unknown")

        except Exception as e:
            logger.error("Error initiating Exotel call: %s", e)
            raise HTTPException(status_code=500, detail=f"Failed to initiate call: {str(e)}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Unexpected error: %s", e)
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

    return JSONResponse(
        {
            "call_sid": call_sid,
            "status": "call_initiated",
            "phone_number": phone_number,
        }
    )


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """Handle WebSocket connection from Exotel Media Streams."""
    await websocket.accept()
    logger.info("WebSocket connection accepted for outbound call")

    try:
        runner_args = WebSocketRunnerArguments(websocket=websocket)
        runner_args.handle_sigint = False
        await run_bot(runner_args)

    except Exception as e:
        logger.error("Error in WebSocket endpoint: %s", e)
        if websocket.client_state != WebSocketState.DISCONNECTED:
            try:
                await websocket.close()
            except Exception:
                pass  # Already closed — ignore


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)