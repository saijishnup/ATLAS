import threading
import time

from openai import OpenAI

from backend import config


class LLMError(Exception):
	pass


class NotConfigured(LLMError):
	pass


class CapError(Exception):
	pass


_client = None
_cap = {"day": "", "n": 0}
_lock = threading.Lock()


def _count():
	if config.DAILY_LLM_CAP <= 0:
		return
	today = time.strftime("%Y-%m-%d", time.gmtime())
	with _lock:
		if _cap["day"] != today:
			_cap.update(day=today, n=0)
		if _cap["n"] >= config.DAILY_LLM_CAP:
			raise CapError("daily LLM call cap reached")
		_cap["n"] += 1


def models() -> list[str]:
	"""LLM_MODEL may hold several ids separated by commas: tried in order."""
	return [m.strip() for m in config.LLM_MODEL.split(",") if m.strip()]


def chat(name: str, system: str, user: str) -> str:
	"""name = calling agent (used by the fake in tests)."""
	global _client
	local = config.LLM_MODE == "local"
	names = models()
	if not (names and (config.LLM_API_KEY or local)):
		raise NotConfigured("LLM not configured: set LLM_BASE_URL, LLM_API_KEY and LLM_MODEL in .env")
	_count()
	if _client is None:
		_client = OpenAI(
			base_url=config.LLM_BASE_URL or None,
			api_key=config.LLM_API_KEY or "none",
			timeout=config.LLM_TIMEOUT,
			max_retries=0 if len(names) > 1 else 2,  # with fallbacks, move to the next model instead of retrying
		)
	if local:
		user += "\n/no_think"
	args = dict(temperature=0.2, messages=[{"role": "system", "content": system}, {"role": "user", "content": user}])
	if config.LLM_JSON_MODE:
		args["response_format"] = {"type": "json_object"}
	last = "no reply"
	for model in names:
		try:
			text = _client.chat.completions.create(model=model, **args).choices[0].message.content or ""
		except Exception as e:
			last = f"{model}: {e}"
			continue
		if text.strip():
			return text
		last = f"{model}: empty reply"
	raise LLMError(last[:200])


def status() -> dict:
	u = config.LLM_BASE_URL
	provider = (
		config.LLM_PROVIDER_LABEL or ("omniroute" if ":20128" in u else None)
		or ("gemini" if "googleapis" in u else "groq" if "groq" in u
			else "local" if "localhost" in u or "127.0.0.1" in u else "custom")
	)
	names = models()
	ok = bool(names and (config.LLM_API_KEY or config.LLM_MODE == "local"))
	return {"provider": provider, "model": names[0] if names else "", "fallbacks": max(len(names) - 1, 0),
		"mode": config.LLM_MODE, "configured": ok}
