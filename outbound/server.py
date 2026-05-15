import os
import traceback
import xml.etree.ElementTree as ET
from contextlib import asynccontextmanager

import aiohttp
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# ----------------- LOAD ENV ----------------- #

load_dotenv(override=True)

EXOTEL_API_KEY = os.getenv("EXOTEL_API_KEY")
EXOTEL_API_TOKEN = os.getenv("EXOTEL_API_TOKEN")
EXOTEL_SID = os.getenv("EXOTEL_SID")
EXOTEL_SUBDOMAIN = os.getenv("EXOTEL_SUBDOMAIN", "api.exotel.com")
EXOTEL_PHONE_NUMBER = os.getenv("EXOTEL_PHONE_NUMBER")

# ----------------- VALIDATION ----------------- #

required_envs = {
    "EXOTEL_API_KEY": EXOTEL_API_KEY,
    "EXOTEL_API_TOKEN": EXOTEL_API_TOKEN,
    "EXOTEL_SID": EXOTEL_SID,
    "EXOTEL_PHONE_NUMBER": EXOTEL_PHONE_NUMBER,
}

missing = [key for key, value in required_envs.items() if not value]

if missing:
    raise ValueError(f"Missing environment variables: {', '.join(missing)}")


# ----------------- HELPERS ----------------- #


def validate_phone_number(number: str):
    """
    Validate E.164 phone number format.
    Example: +919876543210
    """
    if not number.startswith("+"):
        raise HTTPException(
            status_code=400,
            detail="Phone number must be in E.164 format. Example: +919876543210",
        )


async def make_exotel_call(
    session: aiohttp.ClientSession,
    to_number: str,
    from_number: str,
):
    """
    Make outbound call using Exotel Connect API.
    """

    url = f"https://{EXOTEL_SUBDOMAIN}/v1/Accounts/{EXOTEL_SID}/Calls/connect.json"

    payload = {
        "From": from_number,
        "To": to_number,
        "CallerId": EXOTEL_PHONE_NUMBER,
        "CallType": "trans",
        "TimeLimit": "3600",
        "TimeOut": "30",
    }

    auth = aiohttp.BasicAuth(EXOTEL_API_KEY, EXOTEL_API_TOKEN)

    print("\n========== EXOTEL REQUEST ==========")
    print("URL:", url)
    print("Payload:", payload)
    print("====================================\n")

    async with session.post(url, data=payload, auth=auth) as response:
        response_text = await response.text()

        print("\n========== EXOTEL RESPONSE ==========")
        print("Status:", response.status)
        print(response_text)
        print("=====================================\n")

        if response.status not in [200, 201]:
            raise Exception(
                f"Exotel API error ({response.status}): {response_text}"
            )

        # Parse XML response
        try:
            root = ET.fromstring(response_text)

            sid_element = root.find(".//Sid")

            call_sid = sid_element.text if sid_element is not None else "unknown"

        except Exception:
            call_sid = "unknown"

        return {
            "status": "call_initiated",
            "call_sid": call_sid,
        }


# ----------------- FASTAPI LIFESPAN ----------------- #


@asynccontextmanager
async def lifespan(app: FastAPI):

    timeout = aiohttp.ClientTimeout(total=30)

    app.state.session = aiohttp.ClientSession(timeout=timeout)

    print("✅ aiohttp session started")

    yield

    await app.state.session.close()

    print("✅ aiohttp session closed")


# ----------------- FASTAPI APP ----------------- #

app = FastAPI(
    title="Outbound Calling Server",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------- ROUTES ----------------- #


@app.get("/")
async def health_check():
    return {
        "status": "running",
        "service": "outbound-calling-server",
    }


@app.post("/start")
async def initiate_outbound_call(request: Request):

    print("\n📞 Received outbound call request")

    try:
        body = await request.json()

        dialout_settings = body.get("dialout_settings")

        if not dialout_settings:
            raise HTTPException(
                status_code=400,
                detail="Missing 'dialout_settings'",
            )

        phone_number = dialout_settings.get("phone_number")

        if not phone_number:
            raise HTTPException(
                status_code=400,
                detail="Missing 'phone_number'",
            )

        phone_number = str(phone_number).strip()

        validate_phone_number(phone_number)

        print(f"📲 Calling customer: {phone_number}")

        result = await make_exotel_call(
            session=request.app.state.session,
            to_number=phone_number,
            from_number=EXOTEL_PHONE_NUMBER,
        )

        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "call_sid": result["call_sid"],
                "phone_number": phone_number,
            },
        )

    except HTTPException:
        raise

    except Exception as e:

        traceback.print_exc()

        raise HTTPException(
            status_code=500,
            detail=str(e),
        )


# ----------------- WEBSOCKET ----------------- #


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):

    await websocket.accept()

    print("🔌 WebSocket connected")

    try:
        from bot import bot
        from pipecat.runner.types import WebSocketRunnerArguments

        runner_args = WebSocketRunnerArguments(websocket=websocket)

        runner_args.handle_sigint = False

        await bot(runner_args)

    except Exception:

        traceback.print_exc()

        await websocket.close()

        print("❌ WebSocket closed due to error")


# ----------------- MAIN ----------------- #

if __name__ == "__main__":

    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=7860,
        reload=True,
    )