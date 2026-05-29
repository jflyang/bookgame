"""
Download CosyVoice model files.

Supports both ModelScope (China) and HuggingFace (international).
"""

import os
import sys
from pathlib import Path


def download_from_modelscope():
    """Download from ModelScope (faster in China)."""
    from modelscope import snapshot_download
    
    model_dir = "pretrained_models/Fun-CosyVoice3-0.5B"
    print(f"Downloading Fun-CosyVoice3-0.5B to {model_dir}...")
    snapshot_download("FunAudioLLM/Fun-CosyVoice3-0.5B-2512", local_dir=model_dir)
    print(f"✓ Model downloaded to {model_dir}")
    return model_dir


def download_from_huggingface():
    """Download from HuggingFace (international)."""
    from huggingface_hub import snapshot_download
    
    model_dir = "pretrained_models/Fun-CosyVoice3-0.5B"
    print(f"Downloading Fun-CosyVoice3-0.5B to {model_dir}...")
    snapshot_download("FunAudioLLM/Fun-CosyVoice3-0.5B-2512", local_dir=model_dir)
    print(f"✓ Model downloaded to {model_dir}")
    return model_dir


if __name__ == "__main__":
    print("=" * 50)
    print("CosyVoice Model Downloader")
    print("=" * 50)
    print()
    
    target_dir = Path("pretrained_models/Fun-CosyVoice3-0.5B")
    if target_dir.exists() and any(target_dir.iterdir()):
        print(f"Model already exists at {target_dir}")
        print("Delete the directory to re-download.")
        sys.exit(0)
    
    print("Select download source:")
    print("  1. ModelScope (recommended for China)")
    print("  2. HuggingFace (international)")
    print()
    
    choice = input("Enter choice (1/2): ").strip()
    
    if choice == "1":
        try:
            download_from_modelscope()
        except ImportError:
            print("modelscope package not installed. Run: pip install modelscope")
            sys.exit(1)
    elif choice == "2":
        try:
            download_from_huggingface()
        except ImportError:
            print("huggingface_hub package not installed. Run: pip install huggingface_hub")
            sys.exit(1)
    else:
        print("Invalid choice.")
        sys.exit(1)
    
    print()
    print("Done! You can now start the TTS service with: python start.py")
