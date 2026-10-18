# Mickey Studio local video worker

Runs Lightricks LTX-Video 2B 0.9.8 distilled on the user's NVIDIA GPU. The API binds to `127.0.0.1:8765`; images and generated videos stay on the computer. This worker is used by both the website and the Premiere extension.

## First-time setup on Windows

1. Install Python 3.10 and Git.
2. Clone the official [LTX-Video repository](https://github.com/Lightricks/LTX-Video) to `%LOCALAPPDATA%\MickeyStudio\LTX-Video`.
3. Create the environment and install PyTorch with CUDA 12.1, then install the official LTX package and this worker's requirements:

```powershell
py -3.10 -m venv .venv
.venv\Scripts\python -m pip install --upgrade pip
.venv\Scripts\python -m pip install torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cu121
.venv\Scripts\python -m pip install -e "$env:LOCALAPPDATA\MickeyStudio\LTX-Video[inference]"
.venv\Scripts\python -m pip install -r requirements.txt
```

4. Start the worker from this directory:

```powershell
$env:LTX_ROOT = "$env:LOCALAPPDATA\MickeyStudio\LTX-Video"
.venv\Scripts\python -m uvicorn app:app --host 127.0.0.1 --port 8765
```

The first generation downloads the official model checkpoint, upscaler and text encoder from Hugging Face. Use the **LTX Video 2B distilled** weights under their [Lightricks Open Weights License](https://huggingface.co/Lightricks/LTX-Video/blob/main/LTX-Video-Open-Weights-License-0.X.txt). The service caps local generations at five seconds and 480p before the model's upscale pass to fit a 12GB GPU.
