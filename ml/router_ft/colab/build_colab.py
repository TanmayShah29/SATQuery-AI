"""Build the Colab package for the 3B stretch run: a data zip and a run-all notebook.

  uv run python colab/build_colab.py      (from ml/router_ft)

Outputs in ml/router_ft/colab/:
  router_ft_3b_data.zip   SFT train/valid (+ valid rows with ids), schema.py, a manifest with sha256s.
                          No test data: the test set never leaves this machine.
  finetune_3b.ipynb       Open in Colab, Runtime > Change runtime type > T4 GPU, Run all.

The notebook mirrors lora_config.yaml (the local 1.5B run): LoRA rank 8, scale 20 (PEFT alpha = 160),
all seven linear projections in the last 16 layers, Adam, lr 5e-5, effective batch 8, 400 optimizer
steps, loss on the answer only, a checkpoint every 50 steps picked by val exact match. Differences
forced by the hardware: QLoRA (bitsandbytes nf4, fp16 compute) on CUDA instead of MLX 4-bit, and
Qwen/Qwen2.5-3B-Instruct from Hugging Face. The winner is merged into the fp16 base and exported as
GGUF Q4_K_M, the same quantisation as Ollama's qwen2.5:3b baseline, so evaluation here is like for like.
"""

import hashlib
import json
import zipfile
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent
ROUTER_FT = HERE.parent
SFT = ROUTER_FT.parents[1] / "data" / "router_ft" / "sft"
CFG = yaml.safe_load((ROUTER_FT / "lora_config.yaml").read_text())

BASE_MODEL = "Qwen/Qwen2.5-3B-Instruct"
N_LAYERS = 36  # Qwen2.5-3B
OPT_STEPS = CFG["iters"] // CFG["grad_accumulation_steps"]
SAVE_EVERY = CFG["save_every"] // CFG["grad_accumulation_steps"]
FILES = {"train.jsonl": SFT / "train.jsonl", "valid.jsonl": SFT / "valid.jsonl",
         "valid_rows.jsonl": SFT / "valid_rows.jsonl", "schema.py": ROUTER_FT / "schema.py"}


def build_zip():
    manifest = {}
    with zipfile.ZipFile(HERE / "router_ft_3b_data.zip", "w", zipfile.ZIP_DEFLATED) as z:
        for name, path in FILES.items():
            data = path.read_bytes()
            if name.endswith(".jsonl"):
                assert b'"test-' not in data, f"{name} contains test ids"
            manifest[name] = hashlib.sha256(data).hexdigest()
            z.writestr(name, data)
        z.writestr("manifest.json", json.dumps(manifest, indent=2))
    return manifest


def md(text):
    return {"cell_type": "markdown", "metadata": {}, "source": text.strip().splitlines(keepends=True)}


def code(text):
    return {"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [],
            "source": text.strip().splitlines(keepends=True)}


def build_notebook(manifest):
    cells = [
        md(f"""
# SatQuery router: LoRA fine-tune of Qwen2.5-3B (stretch run)

**Before you start:** Runtime → Change runtime type → **T4 GPU** → Save. Then Runtime → **Run all**.

You'll be asked twice, both in cell 3:
1. **Allow Google Drive.** Everything is saved to `MyDrive/router_ft_3b/`.
2. **Upload** `router_ft_3b_data.zip` (only the first time; it's then kept in Drive).

**If Colab disconnects or resets:** reconnect, set the T4 GPU again, and press **Run all**. Checkpoints live
in Drive, so a finished training run is reused instead of repeated (merge and GGUF export rerun, ~15 min).

Takes about 45–60 minutes on a free T4. When it's done, download the folder `MyDrive/router_ft_3b/`
(GGUF ≈ 1.9 GB, adapter ≈ 60 MB) and tell Claude where it is. Test data is not in this notebook;
evaluation happens locally.

Settings mirror the local 1.5B run (`ml/router_ft/lora_config.yaml`): rank {CFG['lora_parameters']['rank']}, scale
{CFG['lora_parameters']['scale']}, last {CFG['num_layers']} layers, lr {CFG['learning_rate']}, effective batch
{CFG['batch_size'] * CFG['grad_accumulation_steps']}, {OPT_STEPS} optimizer steps, checkpoint every {SAVE_EVERY} steps chosen by val exact match.
Note: Qwen2.5-3B is under the Qwen Research License (non-commercial), unlike the Apache-2.0 1.5B.
"""),
        code("""
# 1. GPU check
import torch, subprocess
assert torch.cuda.is_available(), "No GPU: Runtime > Change runtime type > T4 GPU, then Run all again"
print(subprocess.run(["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv"], capture_output=True, text=True).stdout)
"""),
        code("""
# 2. Libraries (Colab already has torch and transformers)
!pip -q install -U peft bitsandbytes accelerate
# Colab ships an old torchao that current peft refuses to load (ImportError in PeftModel.from_pretrained);
# nothing in this notebook uses torchao.
!pip -q uninstall -y torchao
import importlib.metadata as md
VERSIONS = {p: md.version(p) for p in ["torch", "transformers", "peft", "bitsandbytes", "accelerate"]}
print(VERSIONS)
"""),
        code(f"""
# 3. Google Drive (all outputs live there, so a Colab reset loses nothing) + the data zip
import hashlib, json, os, shutil, zipfile
from google.colab import drive, files
drive.mount("/content/drive")
DRIVE = "/content/drive/MyDrive/router_ft_3b"; os.makedirs(DRIVE, exist_ok=True)
ZIP = f"{{DRIVE}}/router_ft_3b_data.zip"
if not os.path.exists(ZIP):
    up = files.upload()
    shutil.copy(next(iter(up)), ZIP)
os.makedirs("/content/data", exist_ok=True)
zipfile.ZipFile(ZIP).extractall("/content/data")
manifest = json.load(open("/content/data/manifest.json"))
assert manifest == {json.dumps(manifest)}, "this zip is not the one the notebook was built for"
for name, digest in manifest.items():
    assert hashlib.sha256(open(f"/content/data/{{name}}", "rb").read()).hexdigest() == digest, name
import sys; sys.path.insert(0, "/content/data")
import schema
read = lambda p: [json.loads(l) for l in open(p) if l.strip()]
train, valid, valid_rows = read("/content/data/train.jsonl"), read("/content/data/valid.jsonl"), read("/content/data/valid_rows.jsonl")
assert not any(r["id"].startswith("test-") for r in valid_rows)
print(len(train), "train,", len(valid), "valid: data OK")
"""),
        code(f"""
# 4. Settings (mirror lora_config.yaml)
CFG = dict(base="{BASE_MODEL}", rank={CFG['lora_parameters']['rank']}, alpha={CFG['lora_parameters']['rank'] * CFG['lora_parameters']['scale']:g},
           layers=list(range({N_LAYERS - CFG['num_layers']}, {N_LAYERS})), lr={CFG['learning_rate']}, micro_batch={CFG['batch_size']},
           grad_accum={CFG['grad_accumulation_steps']}, opt_steps={OPT_STEPS}, save_every={SAVE_EVERY}, max_len={CFG['max_seq_length']}, seed={CFG['seed']},
           targets=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"])
OUT = f"{{DRIVE}}/run"; os.makedirs(OUT, exist_ok=True)  # checkpoints + logs in Drive
print(CFG)
"""),
        code("""
# 5. Load Qwen2.5-3B-Instruct in 4-bit and attach LoRA
import random, numpy as np
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
random.seed(CFG["seed"]); np.random.seed(CFG["seed"]); torch.manual_seed(CFG["seed"])
tok = AutoTokenizer.from_pretrained(CFG["base"])
bnb = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_use_double_quant=True,
                         bnb_4bit_compute_dtype=torch.float16)
model = AutoModelForCausalLM.from_pretrained(CFG["base"], quantization_config=bnb, device_map={"": 0})
model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=True)
model = get_peft_model(model, LoraConfig(r=CFG["rank"], lora_alpha=CFG["alpha"], lora_dropout=0.0, bias="none",
                                         target_modules=CFG["targets"], layers_to_transform=CFG["layers"],
                                         task_type="CAUSAL_LM"))
model.print_trainable_parameters()
"""),
        code("""
# 6. Tokenise: loss only on the assistant answer (like mlx_lm --mask-prompt)
def encode(ex):
    msgs = ex["messages"]
    full = tok.apply_chat_template(msgs, tokenize=False)
    prompt = tok.apply_chat_template(msgs[:-1], tokenize=False, add_generation_prompt=True)
    ids = tok(full, add_special_tokens=False)["input_ids"][: CFG["max_len"]]
    n_prompt = len(tok(prompt, add_special_tokens=False)["input_ids"])
    return ids, [-100] * n_prompt + ids[n_prompt:]

train_enc = [encode(ex) for ex in train]
assert all(any(l != -100 for l in lab) for _, lab in train_enc), "an example has no answer tokens"
print("longest example:", max(len(i) for i, _ in train_enc), "tokens")

def collate(batch):
    n = max(len(i) for i, _ in batch)
    ids = torch.full((len(batch), n), tok.pad_token_id); lab = torch.full((len(batch), n), -100); att = torch.zeros((len(batch), n), dtype=torch.long)
    for k, (i, l) in enumerate(batch):
        ids[k, : len(i)] = torch.tensor(i); lab[k, : len(l)] = torch.tensor(l); att[k, : len(i)] = 1
    return ids.cuda(), att.cuda(), lab.cuda()
"""),
        code("""
# 7. Val exact match: greedy decoding, the same parsing and schema check as the local harness
@torch.no_grad()
def val_exact(batch_size=16):
    model.eval(); model.config.use_cache = True; tok.padding_side = "left"
    right = 0; valid_n = 0
    for s in range(0, len(valid), batch_size):
        chunk = valid[s: s + batch_size]
        prompts = [tok.apply_chat_template(ex["messages"][:-1], tokenize=False, add_generation_prompt=True) for ex in chunk]
        enc = tok(prompts, return_tensors="pt", padding=True, add_special_tokens=False).to("cuda")
        with torch.autocast("cuda", dtype=torch.float16):
            out = model.generate(**enc, max_new_tokens=120, do_sample=False, pad_token_id=tok.pad_token_id)
        for k, ex in enumerate(chunk):
            text = tok.decode(out[k, enc["input_ids"].shape[1]:], skip_special_tokens=True)
            pred, _ = schema.parse(text[text.find("{"): text.rfind("}") + 1]) if "{" in text else (None, [])
            gold = valid_rows[s + k]["label"]
            valid_n += pred is not None
            right += pred is not None and pred == schema.canonicalize(gold)
    model.train(); model.config.use_cache = False; tok.padding_side = "right"
    return right / len(valid), valid_n / len(valid)

# valid.jsonl and valid_rows.jsonl are written in the same order by prepare_sft.py; check it
assert all(json.loads(ex["messages"][-1]["content"]) == r["label"] for ex, r in zip(valid, valid_rows))
"""),
        code("""
# 8. Train (~30 min). A checkpoint every `save_every` optimizer steps, each scored on val.
#    Skipped if a finished run is already in Drive.
import time
TRAINED = os.path.exists(f"{OUT}/train_log.json")
if TRAINED:
    log = json.load(open(f"{OUT}/train_log.json"))["log"]
    print("training already finished in an earlier session; reusing", f"{OUT}/train_log.json")
if not TRAINED:
    params = [p for p in model.parameters() if p.requires_grad]
    opt = torch.optim.Adam(params, lr=CFG["lr"])
    scaler = torch.amp.GradScaler("cuda")
    model.train(); model.config.use_cache = False; tok.padding_side = "right"
    rng = random.Random(CFG["seed"]); order = []
    log, step, micro, t0 = [], 0, 0, time.time()
    while step < CFG["opt_steps"]:
        if not order:
            order = list(range(len(train_enc))); rng.shuffle(order)
        batch = [train_enc[order.pop()] for _ in range(min(CFG["micro_batch"], len(order)))]
        ids, att, lab = collate(batch)
        with torch.autocast("cuda", dtype=torch.float16):
            loss = model(input_ids=ids, attention_mask=att, labels=lab).loss / CFG["grad_accum"]
        scaler.scale(loss).backward(); micro += 1
        if micro % CFG["grad_accum"]:
            continue
        scaler.step(opt); scaler.update(); opt.zero_grad(set_to_none=True); step += 1
        if step % 10 == 0:
            print(f"step {step}/{CFG['opt_steps']}  loss {loss.item() * CFG['grad_accum']:.4f}  {time.time() - t0:.0f}s", flush=True)
        if step % CFG["save_every"] == 0:
            model.save_pretrained(f"{OUT}/ckpt-{step:04d}")
            exact, valid_rate = val_exact()
            log.append({"step": step, "val_exact": exact, "val_valid": valid_rate, "elapsed_s": round(time.time() - t0)})
            print("  val", log[-1], flush=True)
    json.dump({"cfg": CFG, "versions": VERSIONS, "log": log}, open(f"{OUT}/train_log.json", "w"), indent=2)
"""),
        code("""
# 9. Pick the checkpoint with the best val exact match (ties -> earlier), same rule as select_checkpoint.py
best = max(log, key=lambda r: (r["val_exact"], -r["step"]))
BEST = f"{OUT}/ckpt-{best['step']:04d}"
json.dump({"selected_step": best["step"], "by_step": log, "criterion": "val exact match, ties to earlier"},
          open(f"{OUT}/selection.json", "w"), indent=2)
print("selected", best)
import gc
model = None; opt = None; gc.collect(); torch.cuda.empty_cache()
"""),
        code("""
# 10. Merge the adapter into the fp16 base (merged model stays on the Colab disk; adapter zip goes to Drive)
from peft import PeftModel
from packaging.version import Version
dtype_kw = "dtype" if Version(VERSIONS["transformers"]) >= Version("4.56") else "torch_dtype"  # renamed in 4.56
base = AutoModelForCausalLM.from_pretrained(CFG["base"], device_map={"": 0}, **{dtype_kw: torch.float16})
merged = PeftModel.from_pretrained(base, BEST).merge_and_unload()
merged.save_pretrained("/content/merged", safe_serialization=True); tok.save_pretrained("/content/merged")
shutil.make_archive(f"{DRIVE}/adapter_best", "zip", BEST)
del base, merged; gc.collect(); torch.cuda.empty_cache()
"""),
        code("""
# 11. Export GGUF Q4_K_M with llama.cpp (same quantisation as Ollama's qwen2.5:3b)
%cd /content
!git clone -q --depth 1 https://github.com/ggml-org/llama.cpp
!pip -q install ./llama.cpp/gguf-py sentencepiece protobuf
!python llama.cpp/convert_hf_to_gguf.py /content/merged --outtype f16 --outfile /content/router-3b-f16.gguf || (pip -q install -r llama.cpp/requirements/requirements-convert_hf_to_gguf.txt && python llama.cpp/convert_hf_to_gguf.py /content/merged --outtype f16 --outfile /content/router-3b-f16.gguf)
!cmake -S llama.cpp -B llama.cpp/build -DGGML_CUDA=OFF -DLLAMA_CURL=OFF > /dev/null && cmake --build llama.cpp/build --target llama-quantize -j 4 > /dev/null
!llama.cpp/build/bin/llama-quantize /content/router-3b-f16.gguf /content/router-3b-q4_k_m.gguf Q4_K_M
"""),
        code("""
# 12. Copy to Drive and print what to download
h = hashlib.sha256()
with open("/content/router-3b-q4_k_m.gguf", "rb") as f:
    for block in iter(lambda: f.read(1 << 24), b""):
        h.update(block)
digest = h.hexdigest()
shutil.copy("/content/router-3b-q4_k_m.gguf", DRIVE)
json.dump({"gguf_sha256": digest, "selected_step": best["step"], "val_exact": best["val_exact"], "versions": VERSIONS},
          open(f"{DRIVE}/export.json", "w"), indent=2)
for f in sorted(os.listdir(DRIVE)):
    print(f"{f:28s} {os.path.getsize(f'{DRIVE}/{f}') / 1e6:8.1f} MB")
print("\\nDone. Download the Google Drive folder router_ft_3b/ and tell Claude where it is.")
"""),
    ]
    nb = {"cells": cells, "metadata": {"accelerator": "GPU", "colab": {"gpuType": "T4", "provenance": []},
                                       "kernelspec": {"name": "python3", "display_name": "Python 3"}},
          "nbformat": 4, "nbformat_minor": 0}
    (HERE / "finetune_3b.ipynb").write_text(json.dumps(nb, indent=1))


if __name__ == "__main__":
    m = build_zip()
    build_notebook(m)
    print("wrote", HERE / "router_ft_3b_data.zip", "and", HERE / "finetune_3b.ipynb")
