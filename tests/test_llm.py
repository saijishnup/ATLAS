from types import SimpleNamespace

import pytest

from backend import config, llm


def stub(content="{}"):
    create = lambda **kw: SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])
    return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))


def test_not_configured(monkeypatch):
    monkeypatch.setattr(config, "LLM_MODEL", "")
    with pytest.raises(llm.NotConfigured):
        llm.chat("x", "s", "u")


def test_daily_cap(monkeypatch):
    for key, value in dict(LLM_MODEL="m", LLM_API_KEY="k", LLM_MODE="hosted", DAILY_LLM_CAP=1).items():
        monkeypatch.setattr(config, key, value)
    monkeypatch.setattr(llm, "_client", stub())
    monkeypatch.setattr(llm, "_cap", {"day": "", "n": 0})
    assert llm.chat("x", "s", "u") == "{}"
    with pytest.raises(llm.CapError):
        llm.chat("x", "s", "u")


def test_status_has_no_secret(monkeypatch):
    monkeypatch.setattr(config, "LLM_BASE_URL", "https://api.groq.com/openai/v1")
    monkeypatch.setattr(config, "LLM_MODEL", "m")
    monkeypatch.setattr(config, "LLM_API_KEY", "secret-key")
    status = llm.status()
    assert status["provider"] == "groq" and status["configured"] is True
    assert "secret-key" not in str(status)


def _conf(monkeypatch, **kw):
    base = dict(LLM_MODEL="a", LLM_API_KEY="k", LLM_MODE="hosted", DAILY_LLM_CAP=0, LLM_JSON_MODE=True)
    for key, value in {**base, **kw}.items():
        monkeypatch.setattr(config, key, value)
    monkeypatch.setattr(llm, "_cap", {"day": "", "n": 0})


def _scripted(calls, replies):
    def create(**kw):
        calls.append(kw)
        r = replies[kw["model"]]
        if isinstance(r, Exception):
            raise r
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=r))])
    return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))


def test_model_list_falls_back_in_order(monkeypatch):
    _conf(monkeypatch, LLM_MODEL="a, b ,c")
    calls = []
    monkeypatch.setattr(llm, "_client", _scripted(calls, {"a": RuntimeError("429"), "b": "  ", "c": "{}"}))
    assert llm.chat("x", "s", "u") == "{}"
    assert [c["model"] for c in calls] == ["a", "b", "c"]


def test_all_models_fail_raises_llm_error(monkeypatch):
    _conf(monkeypatch, LLM_MODEL="a,b")
    monkeypatch.setattr(llm, "_client", _scripted([], {"a": RuntimeError("x"), "b": RuntimeError("down")}))
    with pytest.raises(llm.LLMError, match="b: down"):
        llm.chat("x", "s", "u")


def test_json_mode_flag(monkeypatch):
    calls = []
    _conf(monkeypatch)
    monkeypatch.setattr(llm, "_client", _scripted(calls, {"a": "{}"}))
    llm.chat("x", "s", "u")
    _conf(monkeypatch, LLM_JSON_MODE=False)
    llm.chat("x", "s", "u")
    assert "response_format" in calls[0] and "response_format" not in calls[1]


def test_status_omniroute_and_first_model(monkeypatch):
    _conf(monkeypatch, LLM_MODEL="a,b,c", LLM_BASE_URL="http://localhost:20128/v1", LLM_PROVIDER_LABEL="")
    s = llm.status()
    assert (s["provider"], s["model"], s["fallbacks"]) == ("omniroute", "a", 2)
    monkeypatch.setattr(config, "LLM_PROVIDER_LABEL", "gateway")
    assert llm.status()["provider"] == "gateway"
