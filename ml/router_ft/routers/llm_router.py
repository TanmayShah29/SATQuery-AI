"""LLM routers: one prompt, three backends (MLX local, Ollama local, Groq/OpenRouter API).

Every LLM baseline sees the same prompt:
  * system: the labelling rules (generate.RULES, the written spec from GUIDELINES.md);
  * optional few-shot examples, taken ONLY from the training split (fixed, seeded, two per
    intent), given as user/assistant turns;
  * user: the hints and the query.
The reply must be the JSON decision. Anything that doesn't parse or fails schema.validate is
counted as invalid, i.e. wrong on every field. No repair, no retries on content.
"""

import json
import random
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx

import generate
import schema
from common import TRAIN, read_jsonl

LLAMACPP_PORT = 8081
FEWSHOT_SEED = 3
FEWSHOT_PER_INTENT = 2


def fewshot_examples(k_per_intent: int = FEWSHOT_PER_INTENT, seed: int = FEWSHOT_SEED) -> List[Dict[str, Any]]:
    """Deterministic few-shot set from TRAIN only, spread over intents and slices."""
    rows = read_jsonl(TRAIN)
    assert all(r["id"].startswith("train-") for r in rows), "few-shot examples must come from the training split"
    rng = random.Random(seed)
    out = []
    for intent in schema.INTENTS:
        pool = [r for r in rows if r["label"]["intent"] == intent]
        rng.shuffle(pool)
        seen_slices = set()
        for r in pool:  # prefer different slices within an intent
            if len([x for x in out if x["label"]["intent"] == intent]) == k_per_intent:
                break
            if r["slices"][0] in seen_slices:
                continue
            seen_slices.add(r["slices"][0])
            out.append(r)
    rng.shuffle(out)
    return out


def _user_turn(query: str, hints: Dict[str, bool]) -> str:
    return f"Hints: {json.dumps(hints)}\nQuery: {query}\nReturn only the JSON label."


def build_messages(query: str, hints: Dict[str, bool], shots: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    msgs = [{"role": "system", "content": generate.RULES}]
    for ex in shots:
        msgs.append({"role": "user", "content": _user_turn(ex["query"], ex["hints"])})
        msgs.append({"role": "assistant", "content": json.dumps(ex["label"])})
    msgs.append({"role": "user", "content": _user_turn(query, hints)})
    return msgs


def parse_reply(text: str) -> Tuple[Optional[Dict[str, Any]], List[str]]:
    """The first {...} block in the reply (models sometimes add a code fence), validated."""
    if not text or "{" not in text:
        return None, ["no JSON object in reply"]
    return schema.parse(text[text.find("{"):text.rfind("}") + 1])


def build_batch_messages(items, shots):
    """Several queries in one request (used only where per-query calls don't fit a free-tier cap).
    Same rules and few-shot examples as build_messages, given inline; each query is labelled independently."""
    examples = "\n".join(json.dumps({"query": ex["query"], "hints": ex["hints"], "label": ex["label"]}, ensure_ascii=False)
                         for ex in shots)
    batch = "\n".join(json.dumps({"i": k, "query": it["query"], "hints": it["hints"]}, ensure_ascii=False)
                      for k, it in enumerate(items))
    user = (f"Label each query below independently by the rules. Labelled examples:\n{examples}\n\nQueries:\n{batch}\n\n"
            'Return only JSON: {"labels": [{"i": 0, "label": {...}}, ...]} with one entry per query, same i.')
    return [{"role": "system", "content": generate.RULES}, {"role": "user", "content": user}]


class LLMRouter:
    """route(query, hints) -> (decision | None, info). info has raw text, errors and latency."""

    def __init__(self, backend: str, model: str, shots: int = 0, max_tokens: int = 300,
                 adapter_path: Optional[str] = None, prompt: str = "rules"):
        """prompt="rules": the labelling rules as system prompt (baselines). prompt="sft": the one-line
        system prompt the fine-tuned model was trained with (prepare_sft.SYSTEM), no rules, no shots."""
        self.backend, self.model, self.max_tokens, self.prompt = backend, model, max_tokens, prompt
        self.shots = fewshot_examples() if shots and prompt == "rules" else []
        if backend == "mlx":
            from mlx_lm import load
            from mlx_lm.sample_utils import make_sampler
            self._mlx_model, self._tok = load(model, adapter_path=adapter_path)
            self._sampler = make_sampler(temp=0.0)
        elif backend == "groq":
            self._headers = generate._client_headers()
            self.max_tokens = max(max_tokens, 6000)  # gpt-oss reasoning tokens count against max_tokens; batches need more
        elif backend not in ("ollama", "llamacpp"):
            raise ValueError(backend)

    def _complete(self, messages) -> str:
        if self.backend == "mlx":
            from mlx_lm import generate as mlx_generate
            prompt = self._tok.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)
            return mlx_generate(self._mlx_model, self._tok, prompt=prompt, max_tokens=self.max_tokens,
                                sampler=self._sampler)
        if self.backend == "ollama":
            r = httpx.post("http://127.0.0.1:11434/api/chat", timeout=300, json={
                "model": self.model, "messages": messages, "stream": False, "format": "json",
                # num_ctx: Ollama's 2048 default would silently cut the few-shot prompt
                "options": {"temperature": 0, "num_ctx": 4096, "num_predict": self.max_tokens}})
            r.raise_for_status()
            return r.json()["message"]["content"]
        if self.backend == "llamacpp":  # a local llama-server, e.g. a base GGUF + a LoRA applied at runtime
            r = httpx.post(f"http://127.0.0.1:{LLAMACPP_PORT}/v1/chat/completions", timeout=300, json={
                "messages": messages, "temperature": 0, "max_tokens": self.max_tokens})
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
        text, _ = generate.call_groq(self.model, messages, self._headers, temperature=0, max_tokens=self.max_tokens)
        return text

    def route(self, query: str, hints: Dict[str, bool]):
        t0 = time.perf_counter()
        if self.prompt == "sft":
            from prepare_sft import SYSTEM
            messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": _user_turn(query, hints)}]
        else:
            messages = build_messages(query, hints, self.shots)
        text = self._complete(messages)
        latency_ms = (time.perf_counter() - t0) * 1000
        pred, errors = parse_reply(text)
        return pred, {"raw": text, "errors": errors, "latency_ms": round(latency_ms, 1)}

    def route_batch(self, items):
        """[(decision | None, info)] for items [{"query", "hints"}]; latency is the request time / batch size."""
        t0 = time.perf_counter()
        text = self._complete(build_batch_messages(items, self.shots))
        per_item_ms = round((time.perf_counter() - t0) * 1000 / len(items), 1)
        try:
            got = {e["i"]: e.get("label") for e in generate.parse_items(text, "labels")
                   if isinstance(e, dict) and isinstance(e.get("i"), int)}
        except ValueError:
            got = {}
        out = []
        for k in range(len(items)):
            ok, errors = schema.validate(got.get(k))
            out.append((schema.canonicalize(got[k]) if ok else None,
                        {"raw": json.dumps(got.get(k)), "errors": errors, "latency_ms": per_item_ms, "batched": len(items)}))
        return out
