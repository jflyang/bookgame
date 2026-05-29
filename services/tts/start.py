"""
Local development startup script for CosyVoice TTS Service.

Usage:
    # First time setup:
    conda create -n cosyvoice python=3.10
    conda activate cosyvoice
    pip install -r requirements.txt
    
    # Download model:
    python download_model.py
    
    # Start service:
    python start.py
"""

import os
import sys
from pathlib import Path

def check_prerequisites():
    """Check that required dependencies and files are available."""
    errors = []
    
    # Check Python version
    if sys.version_info < (3, 10):
        errors.append(f"Python 3.10+ required, got {sys.version}")
    
    # Check key packages
    try:
        import torch
        print(f"  ✓ PyTorch {torch.__version__}")
        if torch.cuda.is_available():
            print(f"  ✓ CUDA available: {torch.cuda.get_device_name(0)}")
        else:
            print("  ⚠ CUDA not available — will use CPU (slow)")
    except ImportError:
        errors.append("PyTorch not installed")
    
    try:
        import fastapi
        print(f"  ✓ FastAPI {fastapi.__version__}")
    except ImportError:
        errors.append("FastAPI not installed: pip install fastapi uvicorn")
    
    try:
        import torchaudio
        print(f"  ✓ torchaudio {torchaudio.__version__}")
    except ImportError:
        errors.append("torchaudio not installed")
    
    # Check model directory
    model_dir = Path(os.environ.get("COSYVOICE_MODEL_DIR", "pretrained_models/Fun-CosyVoice3-0.5B"))
    if model_dir.exists():
        print(f"  ✓ Model directory: {model_dir}")
    else:
        errors.append(f"Model not found at {model_dir}. Run: python download_model.py")
    
    # Check voices directory
    voices_dir = Path(os.environ.get("VOICES_DIR", "./voices"))
    voice_files = list(voices_dir.glob("*_ref.*")) if voices_dir.exists() else []
    if voice_files:
        print(f"  ✓ Voice references: {len(voice_files)} files")
    else:
        print("  ⚠ No voice reference files found in ./voices/")
        print("    Add files like: qiaofeng_ref.wav, xuzhu_ref.wav")
    
    return errors


if __name__ == "__main__":
    print("=" * 50)
    print("CosyVoice TTS Service — Local Development")
    print("=" * 50)
    print()
    print("Checking prerequisites...")
    
    errors = check_prerequisites()
    
    if errors:
        print()
        print("❌ Prerequisites not met:")
        for e in errors:
            print(f"   • {e}")
        print()
        print("Fix the above issues and try again.")
        sys.exit(1)
    
    print()
    print("Starting service on port 50001...")
    print("-" * 50)
    
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "50001")),
        reload=True,
        log_level="info",
    )
