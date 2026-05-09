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
from pipecat.services.sarvam import SarvamTTSService
from pipecat.transcriptions.language import Language
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

from database.utils import get_system_config
from database.time_utils import get_current_context
from database.call_logger import save_call_log, get_transcript_summary

load_dotenv(override=True)


async def run_bot(transport: BaseTransport, handle_sigint: bool, phone: str = "unknown"):
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
        model="bulbul:v3-beta",
        voice_id="shubh",
        params=SarvamTTSService.InputParams(
            language=Language.EN,
            pace=1.1,
            temperature=0.01,
        ),
    )

    time_context = get_current_context()
    messages = [
        {
            "role": "system",
            "content": get_system_config("outbound_prompt").format(**time_context),
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
        logger.info("📞 Outbound call connected — triggering greeting")
        # Inject a "Hello" user turn so the LLM greets the caller immediately
        messages.append({"role": "user", "content": "Hello"})
        await task.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info(f"📴 Outbound call to {phone} disconnected")
        
        # Log the call
        try:
            call_sid = transport._params.serializer.call_sid
            # transcript is the full conversation history
            transcript = "\n".join([f"{m['role']}: {m['content']}" for m in context.messages])
            summary = get_transcript_summary(context.messages)
            
            # Save logs (this handles both local DB and Zoho)
            save_call_log(
                call_sid=call_sid,
                phone=phone,
                direction="outbound",
                status="completed",
                duration=0, # Need to track duration if possible
                transcript=transcript,
                summary=summary,
                decision="Call completed successfully"
            )
        except Exception as e:
            logger.error(f"Failed to log call: {e}")
            
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

    await run_bot(transport, handle_sigint, call_data.get("to_number", "unknown"))