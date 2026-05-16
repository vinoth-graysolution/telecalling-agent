import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from loguru import logger

from pipecat.runner.utils import parse_telephony_websocket
from pipecat.serializers.exotel import ExotelFrameSerializer
from pipeline.transports.fastapi import (
    FastAPIWebsocketTransport,
    FastAPIWebsocketParams,
)

from inbound.voice_english import run_bot

# ── API routers ──────────────────────────────────────────────────────────────
from api.dashboard import router as dashboard_router
from api.appointments import router as appointments_router
from api.logs import router as logs_router
from api.login import router as login_router
from api.admin_config import router as admin_config_router
from api.admin_users import router as admin_users_router
from api.campaigns import router as campaigns_router
from api.patients import router as patients_router
from api.integrations import router as integrations_router

# ── Validate required env vars at startup ────────────────────────────────────
REQUIRED_ENV_VARS = [
    "OPENAI_API_KEY",
    "DEEPGRAM_API_KEY",
    "SARVAM_API_KEY",
]

missing = [v for v in REQUIRED_ENV_VARS if not os.getenv(v)]
if missing:
    raise EnvironmentError(
        f"Missing required environment variables: {', '.join(missing)}"
    )

app = FastAPI(
    title="Exotel Voicebot API",
    description="REST API for clinic appointment management and dashboard analytics.",
    version="1.0.0",
)

# Register routers
app.include_router(login_router)
app.include_router(dashboard_router)
app.include_router(appointments_router)
app.include_router(logs_router)
app.include_router(admin_config_router)
app.include_router(admin_users_router)
app.include_router(campaigns_router)
app.include_router(patients_router)
app.include_router(integrations_router)


@app.get("/health", tags=["System"])
def health_check():
    return {"status": "ok", "version": "1.0.0"}



@app.get("/health")
async def health_check():
    """Liveness probe — used by load balancers and monitoring."""
    return {"status": "ok"}


@app.websocket("/ws")
async def exotel_websocket(websocket: WebSocket):

    await websocket.accept()
    logger.info("🚀 Exotel WebSocket connected")

    try:
        # ── Detect transport type + parse call metadata ───────────────────
        transport_type, call_data = await parse_telephony_websocket(websocket)
        logger.info(f"Transport detected: {transport_type} | call_data: {call_data}")

        call_sid   = call_data.get("call_id", "")
        stream_sid = call_data.get("stream_id", "")

        if not call_sid:
            logger.warning("⚠️  call_sid is empty — human transfer will not work")

        # ── Exotel serializer ─────────────────────────────────────────────
        serializer = ExotelFrameSerializer(
            stream_sid=stream_sid,
            call_sid=call_sid,
        )

        # ── Pipecat transport ─────────────────────────────────────────────
        transport = FastAPIWebsocketTransport(
            websocket=websocket,
            params=FastAPIWebsocketParams(
                audio_in_enabled=True,
                audio_out_enabled=True,
                add_wav_header=False,
                serializer=serializer,
            ),
        )

        # ── Start voicebot (call_sid now correctly forwarded) ─────────────
        await run_bot(transport, call_sid=call_sid, phone=call_data.get("from_number", "unknown"))

    except WebSocketDisconnect:
        logger.info("📴 WebSocket disconnected cleanly")

    except Exception as exc:
        logger.exception(f"❌ Unhandled error in WebSocket handler: {exc}")
        try:
            await websocket.close(code=1011)  # Internal error
        except Exception:
            pass  # Already closed