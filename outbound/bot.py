import os
import sys

# Ensure the project root is on the path so `database`, `prompt`, etc. can be imported
_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from dotenv import load_dotenv
from loguru import logger
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import parse_telephony_websocket
from pipecat.serializers.exotel import ExotelFrameSerializer
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.transports.base_transport import BaseTransport

# Use the custom transport — same as the working inbound bot.
# The stock pipecat FastAPIWebsocketTransport does NOT handle Exotel's
# media-stream framing correctly, which causes "audio not received" warnings.
from pipeline.transports.fastapi import (
    FastAPIWebsocketParams,
    FastAPIWebsocketTransport,
)
from pipeline.services.openai.llm import OpenAILLMService
# from pipecat.services.elevenlabs.tts import ElevenLabsHttpTTSService
from pipecat.services.sarvam import SarvamTTSService
from prompt.banking_prompt import get_system_prompt
from pipecat.transcriptions.language import Language
from database.time_utils import get_current_context

TTS_MODEL       = "bulbul:v3-beta"
TTS_VOICE       = "shubh"
TTS_PACE        = 1.1
TTS_TEMPERATURE = 0.01

load_dotenv(override=True)


async def run_bot(transport: BaseTransport, handle_sigint: bool):
    llm = OpenAILLMService(
        api_key=os.getenv("OPENAI_API_KEY"),
        model="gpt-4o-mini",
    )

    stt = DeepgramSTTService(
        api_key=os.getenv("DEEPGRAM_API_KEY"),
        model="nova-3",
        language="en-IN",
    )

    
    tts = SarvamTTSService(
        api_key=os.getenv("SARVAM_API_KEY"),
        model=TTS_MODEL,
        voice_id=TTS_VOICE,
        params=SarvamTTSService.InputParams(
            language=Language.EN,
            pace=TTS_PACE,
            temperature=TTS_TEMPERATURE,
        ),
    )

    time_context = get_current_context()
    messages = [
        {
            "role": "system",
            "content": get_system_prompt(time_context),
        }
    ]

    context = LLMContext(messages=messages)

    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            vad_analyzer=SileroVADAnalyzer(
                params=VADParams(stop_secs=0.3)
            ),
        ),
    )

    pipeline = Pipeline(
        [
            transport.input(),       # WebSocket input from Exotel
            stt,                     # Speech-To-Text
            user_aggregator,
            llm,                     # LLM (returns plain spoken text)
            tts,                     # Text-To-Speech
            transport.output(),      # WebSocket output to Exotel
            assistant_aggregator,
        ]
    )

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            audio_in_sample_rate=8000,
            audio_out_sample_rate=8000,
            enable_metrics=True,
            enable_usage_metrics=True,
        ),
    )

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info("📞 Outbound call connected — vijay will greet the customer")
        logger.info("🤖 Injecting [CALL STARTED] trigger to fire LLM → TTS → Audio pipeline")
        # Inject a system-level user turn to tell the LLM to start the call.
        # Maya will immediately say "Hello, am I speaking with Praveen Kumar?"
        # and then follow the structured IDENTITY → DISCLOSURE → EMI_DETAILS → CLOSING flow.
        messages.append({
            "role": "user",
            "content": (
                "[CALL STARTED] The customer has just picked up the phone. "
                "Begin the call immediately with the IDENTITY verification step. "
                "Greet naturally and ask to confirm the customer's name."
            ),
        })
        logger.info("📤 Queuing LLMRunFrame to trigger vijay's opening greeting...")
        await task.queue_frames([LLMRunFrame()])
        logger.info("✅ LLMRunFrame queued — waiting for LLM response and TTS audio")

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info("📴 Outbound call disconnected")
        await task.cancel()

    runner = PipelineRunner(handle_sigint=handle_sigint)
    await runner.run(task)


async def bot(runner_args: RunnerArguments):
    """Main bot entry point compatible with Pipecat Cloud."""

    transport_type, call_data = await parse_telephony_websocket(runner_args.websocket)
    logger.info(f"Auto-detected transport: {transport_type}")

    serializer = ExotelFrameSerializer(
        stream_sid=call_data.get("stream_id", ""),
        call_sid=call_data.get("call_id", ""),
    )

    transport = FastAPIWebsocketTransport(
        websocket=runner_args.websocket,
        params=FastAPIWebsocketParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            add_wav_header=False,
            serializer=serializer,
        ),
    )

    handle_sigint = runner_args.handle_sigint

    await run_bot(transport, handle_sigint)