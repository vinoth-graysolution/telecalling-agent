import os
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
from pipecat.services.llm_service import FunctionCallParams
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.sarvam import SarvamTTSService
from pipecat.transcriptions.language import Language
from pipecat.adapters.schemas.tools_schema import ToolsSchema

from pipeline.services.openai.llm import OpenAILLMService
from database.time_utils import get_current_context
from database.utils import get_system_config
from database.tools import (
    check_slot,
    book_slot,
    next_available_slot,
    reschedule_slot,
    cancel_slot,
    transfer_to_human,
)
from database.call_logger import save_call_log, get_transcript_summary

load_dotenv()

# ── Constants ────────────────────────────────────────────────────────────────
# Raising token limit so LLM never gets cut off mid-sentence.
MAX_TOKENS      = 400
LLM_TEMPERATURE = 0.4
LLM_FREQ_PEN    = 0.3

# VAD: how long (seconds) of silence triggers end-of-utterance.
# 0.3 s = fast response; raise to 0.4–0.5 if callers get cut off.
VAD_STOP_SECS   = 0.3

# Deepgram: nova-3 is Deepgram's fastest + most accurate English model.
# en-IN recognises Indian-English accents, which cuts WER significantly.
STT_MODEL       = "nova-3"
STT_LANGUAGE    = "en-IN"

# Sarvam TTS: temperature=0 → deterministic output, no random variance latency.
TTS_MODEL       = "bulbul:v3-beta"
TTS_VOICE       = "shubh"
TTS_PACE        = 1.1
TTS_TEMPERATURE = 0.01  # minimum allowed by Sarvam — near-deterministic & fast


async def run_bot(transport, call_sid: str = "", phone: str = "unknown"):
    """
    Assemble and run the full STT → LLM → TTS pipeline for one call.

    Parameters
    ----------
    transport : FastAPIWebsocketTransport
        The Pipecat transport wrapping the live WebSocket.
    call_sid : str
        Exotel call identifier.  Required for human-transfer to work.
    """

    if not call_sid:
        logger.warning("⚠️  run_bot called without call_sid — human transfer disabled")

    # ── LLM ─────────────────────────────────────────────────────────────────
    llm = OpenAILLMService(
        api_key=os.getenv("OPENAI_API_KEY"),
        model="gpt-4o-mini",
        params=OpenAILLMService.InputParams(
            temperature=LLM_TEMPERATURE,
            max_completion_tokens=MAX_TOKENS,   # was 200 — raised to avoid cut-offs
            frequency_penalty=LLM_FREQ_PEN,
        ),
        retry_on_timeout=True,
    )

    # ── Human-transfer wrapper ───────────────────────────────────────────────
    # Injects the live call_sid at runtime so Exotel Redirect API
    # knows which call to forward.
    async def transfer_to_human_with_sid(params: FunctionCallParams):
        """Transfer the call to a human agent.
        Call this ONLY when the user explicitly asks to speak with
        a human, a doctor, the clinic staff, or a real person."""
        params.call_sid = call_sid
        await transfer_to_human(params)

    transfer_to_human_with_sid.__name__ = "transfer_to_human"

    # ── Tools ────────────────────────────────────────────────────────────────
    tools_schema = ToolsSchema(
        standard_tools=[
            check_slot,
            book_slot,
            next_available_slot,
            reschedule_slot,
            cancel_slot,
            transfer_to_human_with_sid,
        ]
    )
    llm.tools = tools_schema

    llm.register_direct_function(check_slot)
    llm.register_direct_function(book_slot)
    llm.register_direct_function(next_available_slot)
    llm.register_direct_function(reschedule_slot)
    llm.register_direct_function(cancel_slot)
    llm.register_direct_function(transfer_to_human_with_sid)

    # ── STT ──────────────────────────────────────────────────────────────────
    # FIX: explicit model + language.
    # nova-3 + en-IN saves ~200–400 ms per utterance vs the default model.
    stt = DeepgramSTTService(
        api_key=os.getenv("DEEPGRAM_API_KEY"),
        model=STT_MODEL,
        language=STT_LANGUAGE,
    )

    # ── TTS ──────────────────────────────────────────────────────────────────
    # FIX: temperature=0.0 → deterministic, no random compute spikes.
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

    # ── Context ──────────────────────────────────────────────────────────────
    time_context = get_current_context()

    messages = [
        {
            "role": "system",
            "content": get_system_config("inbound_prompt").format(**time_context),
        }
    ]

    context = LLMContext(
        messages=messages,
        tools=tools_schema,
    )

    # ── VAD ──────────────────────────────────────────────────────────────────
    # FIX: explicit stop_secs so VAD doesn't wait too long after silence.
    vad = SileroVADAnalyzer(
        params=VADParams(stop_secs=VAD_STOP_SECS)
    )

    user_agg, assistant_agg = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(vad_analyzer=vad),
    )

    # ── Pipeline ─────────────────────────────────────────────────────────────
    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            user_agg,
            llm,
            tts,
            transport.output(),
            assistant_agg,
        ]
    )

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            audio_in_sample_rate=8000,
            audio_out_sample_rate=8000,
        ),
    )

    # ── Events ───────────────────────────────────────────────────────────────
    @transport.event_handler("on_client_connected")
    async def on_connected(transport, client):
        logger.info(f"📞 Caller connected | call_sid={call_sid}")

        # FIX: inject a "Hello" user turn so the LLM has a clear trigger
        # to greet the caller immediately — eliminates the cold-start pause.
        messages.append({"role": "user", "content": "Hello"})
        await task.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_disconnected(transport, client):
        logger.info(f"📴 Caller {phone} disconnected | call_sid={call_sid}")
        
        # Log the call
        try:
            # transcript is the full conversation history
            transcript = "\n".join([f"{m['role']}: {m['content']}" for m in context.messages])
            summary = get_transcript_summary(context.messages)
            
            # Save logs (this handles both local DB and Zoho)
            save_call_log(
                call_sid=call_sid,
                phone=phone,
                direction="inbound",
                status="completed",
                duration=0,
                transcript=transcript,
                summary=summary,
                decision="Inbound call completed"
            )
        except Exception as e:
            logger.error(f"Failed to log inbound call: {e}")
            
        await task.cancel()

    # ── Run ──────────────────────────────────────────────────────────────────
    logger.info(f"▶️  Starting pipeline | call_sid={call_sid}")
    runner = PipelineRunner(handle_sigint=False)
    await runner.run(task)
    logger.info(f"✅ Pipeline finished | call_sid={call_sid}")