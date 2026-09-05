"""Fallback router for the TCG project — local-first, Go-niche.

Derived from router.py (SHA AF87C0ECE8996852258D28A857146830E78E056E8C98DA219A7A1F65C941E030).
Changes vs canonical:
- Port 8002 (ROUTER_PORT default), pidfile router-fallback.pid
- Tier-0: local Qwen (Ollama :11434, smtek/Qwen3.8-27B:Q3_K_XL-16gb) ALWAYS first — strongest locally available
- No Devstral plan (removed per user — overengineered)
- Free-tier APIs next (Mistral/Alibaba/Gemini)
- Go (OpenCode Go volume tier) ONLY as niche fallback when router classifies creative/general as more capable
- Optional creative specialist: local Hermes 3 8B (Ollama hermes3:8b) for original writing — add via LOCAL_HERMES env
- All other behavior verbatim (cost guard, key stripping, protocol adapters, endpoints).
"""

import json
import logging
import os
import re
import time
from collections import deque
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse

try:
    from dotenv import load_dotenv

    _here = os.path.dirname(os.path.abspath(__file__))
    for _env_path in (
        os.path.join(_here, ".env"),
    ):
        load_dotenv(_env_path, override=False)
except Exception:
    pass


app = FastAPI(title="TCG Project Fallback Router")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [ROUTER-FALLBACK] %(message)s")
log = logging.getLogger("router-fallback")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.getenv("ROUTER_LOG_FILE", os.path.join(BASE_DIR, "router-fallback.log"))
try:
    _handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
    _handler.setFormatter(logging.Formatter("%(asctime)s [ROUTER-FALLBACK] %(message)s"))
    log.addHandler(_handler)
except Exception as exc:
    log.warning("File logging unavailable: %s", exc)

HOST = os.getenv("ROUTER_HOST", "127.0.0.1")
PORT = int(os.getenv("ROUTER_PORT", "8002"))
SHARED_SECRET = os.getenv("ROUTER_SHARED_SECRET", "")
LOCAL_QWEN_URL = os.getenv("LOCAL_QWEN_URL", "http://127.0.0.1:11434/v1/chat/completions")
LOCAL_HERMES_URL = os.getenv("LOCAL_HERMES_URL", "http://127.0.0.1:11434/v1/chat/completions")
GO_URL = "https://opencode.ai/zen/go/v1"


def provider(name: str, url: str, model: str, key_env: str, protocol: str = "chat", **meta: Any) -> dict:
    return {
        "name": name,
        "url": url,
        "model": model,
        "key": os.getenv(key_env, ""),
        "protocol": protocol,
        **meta,
    }


# Local Qwen ALWAYS available. Free APIs next. Go only as niche (creative/general).
# Mirrors current usage: Muse Spark (orchestrator) + Qwen3.8-27B (local coder) — Go spins only when stronger model is beneficial.
PROVIDERS = {
    "local-qwen": provider("Local Qwen3.8 27B", LOCAL_QWEN_URL, "smtek/Qwen3.8-27B:Q3_K_XL-16gb", "LOCAL_API_KEY", local=True),
    "local-hermes": provider("Local Hermes 3 8B Creative", LOCAL_HERMES_URL, "hermes3:8b", "LOCAL_API_KEY", local=True, creative=True),
    "mistral": provider("Mistral Small", "https://api.mistral.ai/v1/chat/completions", "mistral-small-latest", "MISTRAL_API_KEY"),
    "alibaba_general": provider("Alibaba Qwen Plus", "https://ws-wu3v5ovkydyn0hwz.us-east-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions", "qwen-plus", "ALIBABA_API_KEY"),
    "alibaba_coding": provider("Alibaba Qwen3 Coder Plus", "https://ws-wu3v5ovkydyn0hwz.us-east-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions", "qwen3-coder-plus", "ALIBABA_API_KEY"),
    "gemini": provider("Google Gemini Flash", "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", "gemini-2.5-flash", "GOOGLE_API_KEY", vision=True),
    # Niche Go volume tier — only tried after local+free when router deems stronger model beneficial
    "go_qwen_flash": provider("Go Qwen3.8 Flash", f"{GO_URL}/messages", "qwen3.8-flash", "OPENCODE_GO_API_KEY", protocol="messages"),
    "go_deepseek_flash": provider("Go DeepSeek V4 Flash", f"{GO_URL}/chat/completions", "deepseek-v4-flash", "OPENCODE_GO_API_KEY"),
    "go_glm_flash": provider("Go GLM-5.3 Flash", f"{GO_URL}/chat/completions", "glm-5.3-flash", "OPENCODE_GO_API_KEY"),
}

# Allow local providers to run without a real key — they use Bearer x
for _k in ("local-qwen", "local-hermes"):
    if not PROVIDERS[_k]["key"]:
        PROVIDERS[_k]["key"] = "x"

CODING_RE = re.compile(r"\b(?:python|javascript|typescript|code|def|function|class|api|json|html|css|sql|bash|powershell|git|bug|refactor|debug|npm|node|fastapi|react)\b")
events = deque(maxlen=50)
started_at = time.time()


def auth_ok(request: Request) -> bool:
    return not SHARED_SECRET or request.headers.get("Authorization", "") == f"Bearer {SHARED_SECRET}"


def text_from_part(part: Any) -> str:
    if isinstance(part, str):
        return part
    if isinstance(part, dict):
        if part.get("type") in ("text", "input_text"):
            return str(part.get("text", ""))
    return ""


def normalize_messages(payload: dict, protocol: str) -> list[dict]:
    if protocol == "chat":
        return payload.get("messages", [])
    if protocol == "responses":
        source = payload.get("input", "")
        if isinstance(source, str):
            return [{"role": "user", "content": source}]
        result = []
        for item in source or []:
            if not isinstance(item, dict):
                continue
            role = item.get("role", "user")
            content = item.get("content", "")
            if isinstance(content, list):
                content = [
                    {"type": "text", "text": text_from_part(part)} if part.get("type") == "input_text" else
                    {"type": "image_url", "image_url": {"url": part.get("image_url", "")}} if part.get("type") == "input_image" else part
                    for part in content if isinstance(part, dict)
                ]
            result.append({"role": role, "content": content})
        return result
    result = []
    system = payload.get("system")
    if system:
        result.append({"role": "system", "content": system if isinstance(system, str) else " ".join(text_from_part(x) for x in system)})
    for message in payload.get("messages", []):
        if not isinstance(message, dict):
            continue
        content = message.get("content", "")
        if isinstance(content, list):
            converted = []
            for part in content:
                if isinstance(part, dict) and part.get("type") == "image":
                    source = part.get("source", {})
                    if source.get("type") == "url":
                        converted.append({"type": "image_url", "image_url": {"url": source.get("url", "")}})
                    else:
                        converted.append(part)
                else:
                    converted.append(part)
            content = converted
        result.append({**message, "content": content})
    return result


def has_image(messages: list[dict]) -> bool:
    return any(
        isinstance(m.get("content"), list)
        and any(isinstance(part, dict) and part.get("type") in ("image_url", "image", "input_image") for part in m["content"])
        for m in messages
    )


def classify(messages: list[dict]) -> str:
    if has_image(messages):
        return "vision"
    text = " ".join(text_from_part(m.get("content", "")) for m in messages).lower()[:20000]
    if CODING_RE.search(text):
        return "coding"
    if len(text) < 120:
        return "simple"
    if any(word in text for word in ("card text", "flavor", "creative", "story", "lore")):
        return "creative"
    return "general"


# Local Qwen ALWAYS first — strongest locally available. Free next. Go niche last (creative/general only).
CHAINS = {
    "simple": ["local-qwen", "mistral", "alibaba_general", "gemini"],
    "coding": ["local-qwen", "alibaba_coding", "mistral", "gemini"],
    "creative": ["local-qwen", "local-hermes", "mistral", "gemini", "go_qwen_flash", "go_glm_flash"],
    "general": ["local-qwen", "mistral", "alibaba_general", "gemini", "go_deepseek_flash", "go_glm_flash"],
    "vision": ["local-qwen", "gemini"],
}


def _assert_cost_ordering() -> None:
    # Local Qwen is cheapest and must be first where present
    for category, chain in CHAINS.items():
        if "local-qwen" in chain and chain[0] != "local-qwen":
            raise RuntimeError(f"Cost-guard violation: local-qwen must be first in chain {category!r}")
        seen_premium = False
        for key in chain:
            entry = PROVIDERS[key]
            if entry.get("premium"):
                seen_premium = True
            elif seen_premium:
                raise RuntimeError(
                    "Cost-guard violation: non-premium %r follows premium %r in "
                    "chain %r. Protected providers must be terminal fallbacks only."
                    % (key, chain[chain.index(key) - 1], category)
                )


_assert_cost_ordering()


def messages_to_responses(messages: list[dict], payload: dict) -> dict:
    instructions = "\n".join(text_from_part(m.get("content", "")) for m in messages if m.get("role") == "system")
    items = [{"role": m.get("role", "user"), "content": m.get("content", "")} for m in messages if m.get("role") != "system"]
    result = {"model": payload.get("model", ""), "input": items}
    if instructions:
        result["instructions"] = instructions
    for key in ("tools", "temperature", "max_output_tokens", "stream"):
        if key in payload:
            result[key] = payload[key]
    return result


def messages_to_anthropic(messages: list[dict], payload: dict) -> dict:
    system = "\n".join(text_from_part(m.get("content", "")) for m in messages if m.get("role") == "system")
    converted_messages = []
    for message in messages:
        if message.get("role") == "system":
            continue
        content = message.get("content", "")
        if isinstance(content, list):
            converted_content = []
            for part in content:
                if isinstance(part, dict) and part.get("type") == "image_url":
                    url = part.get("image_url", {}).get("url", "")
                    if url.startswith("data:"):
                        media, encoded = url.split(",", 1)
                        media_type = media[5:].split(";", 1)[0]
                        converted_content.append({"type": "image", "source": {"type": "base64", "media_type": media_type, "data": encoded}})
                    else:
                        converted_content.append({"type": "image", "source": {"type": "url", "url": url}})
                else:
                    converted_content.append(part)
            content = converted_content
        converted_messages.append({**message, "content": content})
    result = {"model": payload.get("model", ""), "messages": converted_messages, "max_tokens": payload.get("max_tokens", 4096)}
    if system:
        result["system"] = system
    for key in ("tools", "temperature", "top_p", "stream"):
        if key in payload:
            result[key] = payload[key]
    return result


def extract_text(data: dict, protocol: str) -> str:
    if protocol == "responses":
        if isinstance(data.get("output_text"), str):
            return data["output_text"]
        pieces = []
        for item in data.get("output", []) or []:
            for part in item.get("content", []) if isinstance(item, dict) else []:
                if isinstance(part, dict) and isinstance(part.get("text"), str):
                    pieces.append(part["text"])
        return "\n".join(pieces)
    if protocol == "messages":
        return "\n".join(part.get("text", "") for part in data.get("content", []) if isinstance(part, dict) and part.get("type") == "text")
    choices = data.get("choices", [])
    return choices[0].get("message", {}).get("content", "") if choices else ""


def as_chat_response(text: str, model: str) -> dict:
    return {"id": f"router-fallback-{int(time.time() * 1000)}", "object": "chat.completion", "created": int(time.time()), "model": model, "choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}], "usage": {}}


def as_responses_response(text: str, model: str) -> dict:
    return {"id": f"router-fallback-{int(time.time() * 1000)}", "object": "response", "created_at": int(time.time()), "model": model, "output_text": text, "output": [{"type": "message", "role": "assistant", "content": [{"type": "output_text", "text": text}]}]}


def as_messages_response(text: str, model: str) -> dict:
    return {"id": f"router-fallback-{int(time.time() * 1000)}", "type": "message", "role": "assistant", "model": model, "content": [{"type": "text", "text": text}], "stop_reason": "end_turn", "stop_sequence": None, "usage": {}}


RESPONSES_ONLY_KEYS = ("input", "output", "instructions", "status", "store", "previous_response_id", "reasoning", "tools")


def _strip_incompatible_keys(payload: dict, target_protocol: str) -> dict:
    cleaned = {k: v for k, v in payload.items() if k != "stream"}
    if target_protocol == "chat":
        for k in RESPONSES_ONLY_KEYS:
            cleaned.pop(k, None)
    return cleaned


async def call_upstream(client: httpx.AsyncClient, entry: dict, messages: list[dict], payload: dict, incoming_protocol: str) -> tuple[dict, str] | None:
    request_payload = _strip_incompatible_keys(payload, entry["protocol"])
    request_payload["model"] = entry["model"]
    request_payload["stream"] = False
    if entry["protocol"] == "responses":
        request_payload = messages_to_responses(messages, request_payload)
    elif entry["protocol"] == "messages":
        request_payload = messages_to_anthropic(messages, request_payload)
    else:
        request_payload["messages"] = messages
    try:
        response = await client.post(entry["url"], headers={"Authorization": f"Bearer {entry['key']}", "Content-Type": "application/json"}, json=request_payload)
        if response.status_code != 200:
            log.warning("FAIL %s from %s (%s)", response.status_code, entry["name"], entry["model"])
            return None
        return response.json(), entry["protocol"]
    except (httpx.HTTPError, ValueError) as exc:
        log.warning("ERROR from %s: %s", entry["name"], exc)
        return None


def convert_response(data: dict, upstream_protocol: str, incoming_protocol: str, model: str) -> dict:
    if upstream_protocol == incoming_protocol:
        data["model"] = model
        return data
    text = extract_text(data, upstream_protocol)
    if incoming_protocol == "responses":
        return as_responses_response(text, model)
    if incoming_protocol == "messages":
        return as_messages_response(text, model)
    return as_chat_response(text, model)


def record(category: str, entry: dict | None, status: str) -> None:
    events.append({"at": datetime.now(timezone.utc).isoformat(), "category": category, "model": entry["model"] if entry else None, "provider": entry["name"] if entry else None, "status": status})


def sse_response(data: dict, protocol: str) -> StreamingResponse:
    text = extract_text(data, protocol)
    if protocol == "responses":
        created = {"type": "response.created", "response": data}
        delta = {"type": "response.output_text.delta", "delta": text, "response_id": data.get("id")}
        completed = {"type": "response.completed", "response": data}
        body = "".join(f"event: {event['type']}\ndata: {json.dumps(event)}\n\n" for event in (created, delta, completed))
    elif protocol == "messages":
        start = {"type": "message_start", "message": data}
        block_start = {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}}
        block_delta = {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": text}}
        block_stop = {"type": "content_block_stop", "index": 0}
        stop = {"type": "message_stop"}
        body = "".join(f"event: {event['type']}\ndata: {json.dumps(event)}\n\n" for event in (start, block_start, block_delta, block_stop, stop))
    else:
        chunk = {"id": data.get("id"), "object": "chat.completion.chunk", "created": data.get("created", int(time.time())), "model": data.get("model"), "choices": [{"index": 0, "delta": {"role": "assistant", "content": text}, "finish_reason": None}]}
        final = {**chunk, "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]}
        body = f"data: {json.dumps(chunk)}\n\ndata: {json.dumps(final)}\n\ndata: [DONE]\n\n"
    return StreamingResponse(iter([body.encode()]), media_type="text/event-stream")


async def route_request(request: Request, incoming_protocol: str):
    if not auth_ok(request):
        return JSONResponse({"error": {"message": "Unauthorized"}}, status_code=401)
    payload = await request.json()
    messages = normalize_messages(payload, incoming_protocol)
    category = classify(messages)
    log.info("Task: %s", category)
    timeout = float(os.getenv("ROUTER_TIMEOUT", "60"))
    async with httpx.AsyncClient(timeout=timeout) as client:
        for key in CHAINS[category]:
            entry = PROVIDERS[key]
            # Local providers have dummy key "x" — never skip them for missing real key
            if not entry["key"] and not entry.get("local"):
                continue
            log.info("Trying %s (%s)", entry["name"], entry["model"])
            result = await call_upstream(client, entry, messages, payload, incoming_protocol)
            if result is None:
                record(category, entry, "failed")
                continue
            data, upstream_protocol = result
            output = convert_response(data, upstream_protocol, incoming_protocol, entry["model"])
            record(category, entry, "success")
            log.info("SUCCESS: %s", entry["model"])
            if payload.get("stream"):
                return sse_response(output, incoming_protocol)
            return JSONResponse(output)
    record(category, None, "exhausted")
    return JSONResponse({"error": {"message": "All configured providers failed for this request.", "category": category}}, status_code=503)


@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    return await route_request(request, "chat")


@app.post("/v1/responses")
async def responses(request: Request):
    return await route_request(request, "responses")


@app.post("/v1/messages")
async def messages(request: Request):
    return await route_request(request, "messages")


@app.get("/v1/health")
async def health():
    return {"status": "ok", "uptime_seconds": round(time.time() - started_at), "providers": len(PROVIDERS)}


@app.get("/v1/router/status")
async def status(request: Request):
    if not auth_ok(request):
        return JSONResponse({"error": {"message": "Unauthorized"}}, status_code=401)
    return {"status": "ok", "uptime_seconds": round(time.time() - started_at), "events": list(events), "catalog": {}}


@app.get("/v1/models")
async def models():
    return {"object": "list", "data": [{"id": "hermes-router-auto", "object": "model", "owned_by": "tcg-project"}]}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("router-fallback:app", host=HOST, port=PORT, reload=os.getenv("ROUTER_RELOAD", "") == "1")
