"""Small, cost-aware OpenAI-compatible router for the TCG project.

The router is intentionally policy-first:
1. Existing API-key providers are tried before OpenCode Go.
2. High-volume Go models are tried before mid-tier models.
3. Premium Go models are terminal fallbacks only.

The public surface accepts chat completions, Responses, and Messages requests.
Internally requests are normalized to chat-style messages, then adapted only
when the selected upstream requires another protocol.
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
    # The project copy is canonical; these fallbacks allow the installed
    # Hermes copy to provide existing local secrets without duplicating them.
    for _env_path in (
        os.path.join(_here, ".env"),
        r"C:\Users\Blayne\AppData\Local\hermes\router\.env",
        r"C:\Users\Blayne\AppData\Local\hermes\.env",
    ):
        load_dotenv(_env_path, override=False)
except Exception:
    pass


app = FastAPI(title="TCG Project AI Router")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [ROUTER] %(message)s")
log = logging.getLogger("router")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.getenv("ROUTER_LOG_FILE", os.path.join(BASE_DIR, "router.log"))
try:
    _handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
    _handler.setFormatter(logging.Formatter("%(asctime)s [ROUTER] %(message)s"))
    log.addHandler(_handler)
except Exception as exc:
    log.warning("File logging unavailable: %s", exc)

HOST = os.getenv("ROUTER_HOST", "127.0.0.1")
PORT = int(os.getenv("ROUTER_PORT", "8000"))
SHARED_SECRET = os.getenv("ROUTER_SHARED_SECRET", "")
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


# External keys deliberately appear before every Go entry in the chains.
PROVIDERS = {
    "mistral": provider("Mistral Small", "https://api.mistral.ai/v1/chat/completions", "mistral-small-latest", "MISTRAL_API_KEY"),
    "alibaba_general": provider("Alibaba Qwen Plus", "https://ws-wu3v5ovkydyn0hwz.us-east-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions", "qwen-plus", "ALIBABA_API_KEY"),
    "alibaba_coding": provider("Alibaba Qwen3 Coder Plus", "https://ws-wu3v5ovkydyn0hwz.us-east-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions", "qwen3-coder-plus", "ALIBABA_API_KEY"),
    "gemini": provider("Google Gemini Flash", "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", "gemini-2.5-flash", "GOOGLE_API_KEY", vision=True),
    # High-volume Go models. These consume the subscription's shared quota,
    # but are preferred over expensive Go models because their allowance is larger.
    "go_deepseek_flash": provider("Go DeepSeek V4 Flash", f"{GO_URL}/chat/completions", "deepseek-v4-flash", "OPENCODE_GO_API_KEY"),
    "go_glm_flash": provider("Go GLM-5.3 Flash", f"{GO_URL}/chat/completions", "glm-5.3-flash", "OPENCODE_GO_API_KEY"),
    "go_longcat": provider("Go LongCat-2.0", f"{GO_URL}/chat/completions", "longcat-2.0", "OPENCODE_GO_API_KEY"),
    "go_qwen_flash": provider("Go Qwen3.8 Flash", f"{GO_URL}/messages", "qwen3.8-flash", "OPENCODE_GO_API_KEY", "messages"),
    "go_mini_max_fast": provider("Go MiniMax M2.7", f"{GO_URL}/messages", "minimax-m2.7", "OPENCODE_GO_API_KEY", "messages"),
    "go_luna": provider("Go GPT 5.6 Luna", f"{GO_URL}/responses", "gpt-5.6-luna", "OPENCODE_GO_API_KEY", "responses"),
    # Mid-tier Go specialists.
    "go_kimi_code": provider("Go Kimi K2.7 Code", f"{GO_URL}/chat/completions", "kimi-k2.7-code", "OPENCODE_GO_API_KEY"),
    "go_kimi": provider("Go Kimi K2.6", f"{GO_URL}/chat/completions", "kimi-k2.6", "OPENCODE_GO_API_KEY"),
    "go_deepseek_pro": provider("Go DeepSeek V4 Pro", f"{GO_URL}/chat/completions", "deepseek-v4-pro", "OPENCODE_GO_API_KEY"),
    "go_qwen_plus": provider("Go Qwen3.7 Plus", f"{GO_URL}/messages", "qwen3.7-plus", "OPENCODE_GO_API_KEY", "messages"),
    "go_mini_max": provider("Go MiniMax M3", f"{GO_URL}/messages", "minimax-m3", "OPENCODE_GO_API_KEY", "messages"),
    "go_vision": provider("Go DeepSeek V4 Flash Vision", f"{GO_URL}/chat/completions", "deepseek-v4-flash-vision-exp", "OPENCODE_GO_API_KEY", vision=True),
    # Protected: these are never placed before ordinary providers.
    "go_glm_premium": provider("Go GLM-5.3 (protected)", f"{GO_URL}/chat/completions", "glm-5.3", "OPENCODE_GO_API_KEY", premium=True),
    "go_kimi_premium": provider("Go Kimi K3 (protected)", f"{GO_URL}/chat/completions", "kimi-k3", "OPENCODE_GO_API_KEY", premium=True),
}


# Complete live catalog from the Go API/docs as of 2026-09-01. ``route``
# indicates whether the model is currently eligible for automatic routing.
GO_CATALOG = {
    "grok-4.6": {"protocol": "responses", "tier": "protected", "route": False},
    "glm-5.3-flash": {"protocol": "chat", "tier": "volume", "route": True},
    "glm-5.3": {"protocol": "chat", "tier": "protected", "route": True},
    "glm-5.2": {"protocol": "chat", "tier": "mid", "route": False},
    "glm-5.1": {"protocol": "chat", "tier": "mid", "route": False},
    "gpt-5.6-luna": {"protocol": "responses", "tier": "volume", "route": True},
    "kimi-k3": {"protocol": "chat", "tier": "protected", "route": True},
    "kimi-k2.7-code": {"protocol": "chat", "tier": "mid", "route": True},
    "kimi-k2.6": {"protocol": "chat", "tier": "mid", "route": True},
    "longcat-2.0": {"protocol": "chat", "tier": "volume", "route": True},
    "mimo-v2.5": {"protocol": "chat", "tier": "volume", "route": False},
    "mimo-v2.5-pro": {"protocol": "chat", "tier": "mid", "route": False},
    "minimax-m3": {"protocol": "messages", "tier": "mid", "route": True},
    "minimax-m2.7": {"protocol": "messages", "tier": "volume", "route": True},
    "muse-spark-1.2-contributor": {"protocol": "responses", "tier": "volume", "route": False},
    "qwen3.8-max": {"protocol": "messages", "tier": "protected", "route": False},
    "qwen3.8-flash": {"protocol": "messages", "tier": "volume", "route": True},
    "qwen3.7-max": {"protocol": "messages", "tier": "protected", "route": False},
    "qwen3.7-plus": {"protocol": "messages", "tier": "mid", "route": True},
    "qwen3.6-plus": {"protocol": "messages", "tier": "mid", "route": False},
    "deepseek-v4-pro": {"protocol": "chat", "tier": "mid", "route": True},
    "deepseek-v4-flash": {"protocol": "chat", "tier": "volume", "route": True},
    "deepseek-v4-flash-vision-exp": {"protocol": "chat", "tier": "volume", "route": True, "vision": True},
    "hy4-preview": {"protocol": "chat", "tier": "volume", "route": False},
    "hy3": {"protocol": "chat", "tier": "volume", "route": False},
    # API-only/legacy catalog entries; retained for visibility, not routing.
    "kimi-k2.5": {"protocol": "chat", "tier": "legacy", "route": False},
    "glm-5": {"protocol": "chat", "tier": "legacy", "route": False},
    "minimax-m2.5": {"protocol": "messages", "tier": "legacy", "route": False},
    "qwen3.5-plus": {"protocol": "messages", "tier": "legacy", "route": False},
    "mimo-v2-pro": {"protocol": "chat", "tier": "legacy", "route": False},
    "mimo-v2-omni": {"protocol": "chat", "tier": "legacy", "route": False},
    "hy3-preview": {"protocol": "chat", "tier": "legacy", "route": False},
    "grok-4.5": {"protocol": "responses", "tier": "legacy", "route": False},
}

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


CHAINS = {
    "simple": ["mistral", "alibaba_general", "gemini", "go_longcat", "go_deepseek_flash"],
    "creative": ["mistral", "gemini", "alibaba_general", "go_longcat", "go_mini_max_fast", "go_luna"],
    "coding": ["alibaba_coding", "mistral", "gemini", "go_deepseek_flash", "go_glm_flash", "go_kimi_code", "go_deepseek_pro", "go_glm_premium"],
    "general": ["mistral", "alibaba_general", "gemini", "go_deepseek_flash", "go_longcat", "go_qwen_flash", "go_mini_max_fast", "go_deepseek_pro", "go_glm_premium"],
    "vision": ["gemini", "go_vision", "go_deepseek_flash", "go_luna"],
}


def _assert_cost_ordering() -> None:
    # Cost guard: a premium (protected) provider must never be tried before an
    # ordinary provider. If a future edit promotes one, fail fast at startup
    # with a clear message instead of silently spending premium tokens.
    for category, chain in CHAINS.items():
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
    return {"id": f"router-{int(time.time() * 1000)}", "object": "chat.completion", "created": int(time.time()), "model": model, "choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}], "usage": {}}


def as_responses_response(text: str, model: str) -> dict:
    return {"id": f"router-{int(time.time() * 1000)}", "object": "response", "created_at": int(time.time()), "model": model, "output_text": text, "output": [{"type": "message", "role": "assistant", "content": [{"type": "output_text", "text": text}]}]}


def as_messages_response(text: str, model: str) -> dict:
    return {"id": f"router-{int(time.time() * 1000)}", "type": "message", "role": "assistant", "model": model, "content": [{"type": "text", "text": text}], "stop_reason": "end_turn", "stop_sequence": None, "usage": {}}


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
            if not entry["key"]:
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
    return {"status": "ok", "uptime_seconds": round(time.time() - started_at), "events": list(events), "catalog": GO_CATALOG}


@app.get("/v1/models")
async def models():
    return {"object": "list", "data": [{"id": "hermes-router-auto", "object": "model", "owned_by": "tcg-project"}]}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("router:app", host=HOST, port=PORT, reload=os.getenv("ROUTER_RELOAD", "") == "1")
