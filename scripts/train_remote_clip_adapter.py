#!/usr/bin/env python3
"""
SatQuery AI - Remote Sensing Domain Adaptation Training Pipeline
Target: SIH26167 (ISRO / Space Applications Centre) §4.1

Trains a lightweight contrastive domain adapter (BigEarthNetDomainAdapter)
on top of the frozen RemoteCLIP foundation backbone using real Earth observation image-text pairs.
Generates genuine training logs, loss curves, and 100% reproducible baseline vs adapted retrieval metrics.
"""

import argparse
import json
import logging
import math
import os
import random
import subprocess
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional

import numpy as np
from PIL import Image
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("RS-Adapter-Train")

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
BENCHMARK_DIR = DATA_DIR / "benchmarks" / "bigearthnet_txt"
WEIGHTS_DIR = DATA_DIR / "weights"
WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)


def set_deterministic_seed(seed: int = 42) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


class BigEarthNetDomainAdapter(nn.Module):
    """
    Lightweight residual projection head adapting foundation visual-language representations
    specifically to multi-spectral Earth observation and CORINE land-cover taxonomy.
    """

    def __init__(self, embed_dim: int = 512, hidden_dim: int = 256):
        super().__init__()
        self.embed_dim = embed_dim

        # Visual residual projection
        self.visual_proj = nn.Sequential(
            nn.Linear(embed_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.GELU(),
            nn.Linear(hidden_dim, embed_dim),
        )
        self.visual_norm = nn.LayerNorm(embed_dim)

        # Text residual projection
        self.text_proj = nn.Sequential(
            nn.Linear(embed_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.GELU(),
            nn.Linear(hidden_dim, embed_dim),
        )
        self.text_norm = nn.LayerNorm(embed_dim)

        # Learnable logit temperature scale (initialized to ln(1/0.07))
        self.logit_scale = nn.Parameter(torch.ones([]) * math.log(1 / 0.07))

    def project_visual(self, v: torch.Tensor) -> torch.Tensor:
        """Adapts visual embedding with residual skip connection and L2 normalization."""
        projected = v + self.visual_proj(v)
        projected = self.visual_norm(projected)
        return F.normalize(projected, p=2, dim=-1)

    def project_text(self, t: torch.Tensor) -> torch.Tensor:
        """Adapts text embedding with residual skip connection and L2 normalization."""
        projected = t + self.text_proj(t)
        projected = self.text_norm(projected)
        return F.normalize(projected, p=2, dim=-1)

    def forward(self, v: torch.Tensor, t: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        z_v = self.project_visual(v)
        z_t = self.project_text(t)
        logit_scale = self.logit_scale.exp().clamp(max=100.0)
        return z_v, z_t, logit_scale


class EncodedItemDataset(Dataset):
    """PyTorch Dataset wrapper around pre-encoded items."""

    def __init__(self, items: List[Dict[str, Any]]):
        self.items = items

    def __len__(self) -> int:
        return len(self.items)

    def __getitem__(self, idx: int) -> Dict[str, Any]:
        return self.items[idx]


class BigEarthNetDataset:
    """Dataset loading BigEarthNet.txt image-text evaluation pairs with real ViT-B/32 neural encodings."""

    def __init__(
        self,
        json_path: Path,
        chips_dir: Path,
        open_clip_model,
        preprocess,
        tokenizer,
        device: str = "cpu",
        embed_dim: int = 512
    ):
        self.json_path = json_path
        self.chips_dir = chips_dir
        self.embed_dim = embed_dim
        self.device = device

        raw_items: List[Dict[str, Any]] = []
        if json_path.exists():
            with open(json_path, "r", encoding="utf-8") as f:
                raw = json.load(f)
                raw_items = raw if isinstance(raw, list) else []

        self.encoded_items: List[Dict[str, Any]] = []
        logger.info(f"Encoding {len(raw_items)} challenge pairs via RemoteCLIP ViT-B/32 backbone...")

        dropped_count = 0
        for idx, item in enumerate(raw_items):
            patch_id = item.get("patch_id", f"patch_{idx}")
            ground_truth = item.get("ground_truth", "")
            category = item.get("category", "")
            img_file = self.chips_dir / f"{patch_id}.jpg"

            if not img_file.exists() or not ground_truth or not item.get("is_real_image", True) or item.get("is_simulated", False):
                logger.warning(f"Skipping pair {patch_id}: missing file, missing text, or non-real imagery flag.")
                dropped_count += 1
                continue

            try:
                # 1. Encode real image with open_clip visual backbone
                pil_img = Image.open(img_file).convert("RGB")
                img_t = preprocess(pil_img).unsqueeze(0).to(device)
                with torch.no_grad():
                    feat = open_clip_model.encode_image(img_t)
                    feat = F.normalize(feat, dim=-1)
                    img_emb = feat.squeeze(0).cpu()

                # 2. Encode text with open_clip text transformer
                prompt = f"Satellite remote sensing imagery of {ground_truth}"
                tokens = tokenizer([prompt]).to(device)
                with torch.no_grad():
                    t_feat = open_clip_model.encode_text(tokens)
                    t_feat = F.normalize(t_feat, dim=-1)
                    text_emb = t_feat.squeeze(0).cpu()

                self.encoded_items.append({
                    "patch_id": patch_id,
                    "category": category,
                    "ground_truth": ground_truth,
                    "img_emb": img_emb,
                    "text_emb": text_emb,
                    "has_real_image": True,
                })
            except Exception as e:
                logger.error(f"Error encoding chip {img_file.name}: {e}")
                dropped_count += 1

        logger.info(f"Encoded {len(self.encoded_items)} real image-text pairs cleanly (dropped {dropped_count} incomplete pairs).")

    def get_stratified_split(self, train_ratio: float = 0.70, seed: int = 42) -> Tuple[EncodedItemDataset, EncodedItemDataset]:
        """Performs a reproducible stratified train/eval split based on item categories."""
        by_category = defaultdict(list)
        for item in self.encoded_items:
            by_category[item["category"]].append(item)

        train_items = []
        eval_items = []

        rng = random.Random(seed)
        for cat, items_list in sorted(by_category.items()):
            shuffled = list(items_list)
            rng.shuffle(shuffled)

            if len(shuffled) == 1:
                # If only 1 item in category, put it in training
                train_items.extend(shuffled)
            else:
                n_train = max(1, int(round(len(shuffled) * train_ratio)))
                n_train = min(n_train, len(shuffled) - 1)  # Ensure at least 1 eval item if len > 1
                train_items.extend(shuffled[:n_train])
                eval_items.extend(shuffled[n_train:])

        logger.info(
            f"Stratified Split (seed={seed}): {len(train_items)} train items, {len(eval_items)} eval items "
            f"across {len(by_category)} categories."
        )
        return EncodedItemDataset(train_items), EncodedItemDataset(eval_items)


def compute_contrastive_loss(
    z_v: torch.Tensor,
    z_t: torch.Tensor,
    logit_scale: torch.Tensor
) -> torch.Tensor:
    """Symmetric InfoNCE contrastive cross-entropy loss."""
    logits_per_image = logit_scale * z_v @ z_t.T
    logits_per_text = logits_per_image.T

    batch_size = z_v.size(0)
    labels = torch.arange(batch_size, device=z_v.device)

    loss_i = F.cross_entropy(logits_per_image, labels)
    loss_t = F.cross_entropy(logits_per_text, labels)
    return (loss_i + loss_t) / 2.0


def evaluate_retrieval(
    adapter: Optional[BigEarthNetDomainAdapter],
    dataset: EncodedItemDataset,
    device: str
) -> Dict[str, float]:
    """Computes Top-1 and Top-3 image-text retrieval accuracy across the dataset."""
    if len(dataset) == 0:
        return {"top1_accuracy": 0.0, "top3_accuracy": 0.0}

    all_img = []
    all_text = []

    for i in range(len(dataset)):
        item = dataset[i]
        all_img.append(item["img_emb"])
        all_text.append(item["text_emb"])

    v_batch = torch.stack(all_img).to(device)
    t_batch = torch.stack(all_text).to(device)

    with torch.no_grad():
        if adapter is not None:
            adapter.eval()
            z_v = adapter.project_visual(v_batch)
            z_t = adapter.project_text(t_batch)
        else:
            z_v = F.normalize(v_batch, p=2, dim=-1)
            z_t = F.normalize(t_batch, p=2, dim=-1)

        sim_matrix = z_v @ z_t.T
        ranks = sim_matrix.argsort(dim=-1, descending=True)
        targets = torch.arange(len(dataset), device=device).unsqueeze(1)

        top1 = float((ranks[:, :1] == targets).float().mean().item() * 100.0)
        k3 = min(3, len(dataset))
        top3 = float((ranks[:, :k3] == targets).any(dim=-1).float().mean().item() * 100.0)

    return {
        "top1_accuracy": round(top1, 2),
        "top3_accuracy": round(top3, 2)
    }


def get_git_commit_sha() -> str:
    try:
        out = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=str(BASE_DIR), stderr=subprocess.DEVNULL)
        return out.decode("utf-8").strip()
    except Exception:
        return "uncommitted_local_build"


def train(
    epochs: int = 25,
    batch_size: int = 16,
    lr: float = 1e-4,
    device_name: Optional[str] = None,
    seed: int = 42
) -> Dict[str, Any]:
    """Executes genuine contrastive adapter training on real benchmark imagery."""
    set_deterministic_seed(seed)

    device = device_name or ("mps" if torch.backends.mps.is_available() else "cpu")
    logger.info(f"Starting BigEarthNet Domain Adaptation on device: {device.upper()} (seed={seed})")

    json_path = BENCHMARK_DIR / "bigearthnet_eval_50.json"
    chips_dir = BENCHMARK_DIR / "chips"

    if not json_path.exists():
        logger.error(f"Benchmark definition file missing at: {json_path}")
        return {"status": "error", "message": "Dataset missing"}

    import open_clip
    try:
        open_clip_model, _, preprocess = open_clip.create_model_and_transforms('ViT-B-32', load_weights=False)
        checkpoint_path = WEIGHTS_DIR / "RemoteCLIP-ViT-B-32.pt"
        if not checkpoint_path.exists():
            raise FileNotFoundError(
                f"RemoteCLIP foundation checkpoint missing at {checkpoint_path}. "
                "The RS-adapted backbone is mandatory; refusing to train on a stock encoder."
            )
        open_clip.load_checkpoint(open_clip_model, str(checkpoint_path))
        open_clip_model = open_clip_model.to(device).eval()
        tokenizer = open_clip.get_tokenizer('ViT-B-32')
        logger.info("Loaded RemoteCLIP-ViT-B/32 foundation backbone into training harness.")
    except Exception as e:
        raise RuntimeError(f"Could not load RemoteCLIP backbone for training: {e}") from e

    full_dataset = BigEarthNetDataset(
        json_path,
        chips_dir,
        open_clip_model=open_clip_model,
        preprocess=preprocess,
        tokenizer=tokenizer,
        device=device,
        embed_dim=512
    )

    train_dataset, eval_dataset = full_dataset.get_stratified_split(train_ratio=0.70, seed=seed)

    # 1. Evaluate baseline zero-shot accuracy on held-out evaluation set
    baseline_eval = evaluate_retrieval(None, eval_dataset, device)
    baseline_train = evaluate_retrieval(None, train_dataset, device)
    logger.info(f"[Baseline Zero-Shot Eval Set] Top-1: {baseline_eval['top1_accuracy']}%, Top-3: {baseline_eval['top3_accuracy']}%")

    # 2. Instantiate Adapter
    adapter = BigEarthNetDomainAdapter(embed_dim=512, hidden_dim=256).to(device)
    optimizer = torch.optim.AdamW(adapter.parameters(), lr=lr, weight_decay=1e-2)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    loader = DataLoader(train_dataset, batch_size=min(batch_size, len(train_dataset)), shuffle=True)

    # 3. Training Loop
    loss_history = []
    t_start = time.perf_counter()

    for epoch in range(1, epochs + 1):
        adapter.train()
        epoch_loss = 0.0
        steps = 0

        for batch in loader:
            v = batch["img_emb"].to(device)
            t = batch["text_emb"].to(device)

            optimizer.zero_grad()
            z_v, z_t, logit_scale = adapter(v, t)
            loss = compute_contrastive_loss(z_v, z_t, logit_scale)
            loss.backward()
            optimizer.step()

            epoch_loss += loss.item()
            steps += 1

        scheduler.step()
        avg_loss = epoch_loss / max(1, steps)
        loss_history.append(round(avg_loss, 4))

        if epoch % 5 == 0 or epoch == epochs:
            logger.info(f"Epoch [{epoch:02d}/{epochs:02d}] - Contrastive InfoNCE Loss: {avg_loss:.4f} - LR: {scheduler.get_last_lr()[0]:.6f}")

    train_time_sec = round(time.perf_counter() - t_start, 2)
    logger.info(f"Training completed in {train_time_sec}s.")

    # 4. Evaluate adapted performance on held-out evaluation set
    adapted_eval = evaluate_retrieval(adapter, eval_dataset, device)
    adapted_train = evaluate_retrieval(adapter, train_dataset, device)

    delta_top1 = round(adapted_eval["top1_accuracy"] - baseline_eval["top1_accuracy"], 2)
    delta_top3 = round(adapted_eval["top3_accuracy"] - baseline_eval["top3_accuracy"], 2)

    logger.info(f"[Adapted Model Held-Out Eval] Top-1: {adapted_eval['top1_accuracy']}% (Delta: +{delta_top1}%), Top-3: {adapted_eval['top3_accuracy']}% (Delta: +{delta_top3}%)")
    logger.info(f"[Adapted Model Train Set] Top-1: {adapted_train['top1_accuracy']}%, Top-3: {adapted_train['top3_accuracy']}%")

    # 5. Save Artifacts to data/weights
    weights_path = WEIGHTS_DIR / "bigearthnet_adapter.pt"
    metrics_path = WEIGHTS_DIR / "training_metrics.json"

    torch.save(adapter.state_dict(), weights_path)
    logger.info(f"[+] Saved trained adapter weights to: {weights_path}")

    git_sha = get_git_commit_sha()
    distinct_categories = len(set(x["category"] for x in full_dataset.encoded_items))

    metrics_payload = {
        "status": "success",
        "target_problem_statement": "SIH26167",
        "target_organization": "ISRO / Space Applications Centre (SAC)",
        "dataset": "BigEarthNet.txt (arXiv:2603.29630) + Real Remote Sensing Benchmark",
        "foundation_backbone": "RemoteCLIP-ViT-B/32",
        "adapter_architecture": "Residual Cross-Modal Projection Head (512 -> 256 -> 512)",
        "parameters_adapted": sum(p.numel() for p in adapter.parameters()),
        "epochs": epochs,
        "batch_size": batch_size,
        "learning_rate": lr,
        "seed": seed,
        "git_commit_sha": git_sha,
        "total_real_samples": len(full_dataset.encoded_items),
        "train_samples": len(train_dataset),
        "eval_samples": len(eval_dataset),
        "num_categories": distinct_categories,
        "training_duration_seconds": train_time_sec,
        "hardware_device": device,
        "loss_curve": loss_history,
        "final_loss": loss_history[-1],
        "eval_heldout_baseline": baseline_eval,
        "eval_heldout_adapted": adapted_eval,
        "train_baseline": baseline_train,
        "train_adapted": adapted_train,
        "delta_heldout": {
            "top1_improvement_pct": delta_top1,
            "top3_improvement_pct": delta_top3,
        },
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics_payload, f, indent=2)
    logger.info(f"[+] Saved training metrics and provenance logs to: {metrics_path}")

    return metrics_payload


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train BigEarthNet Domain Adapter for RemoteCLIP")
    parser.add_argument("--epochs", type=int, default=25, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=16, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    args = parser.parse_args()

    train(epochs=args.epochs, batch_size=args.batch_size, lr=args.lr, seed=args.seed)
