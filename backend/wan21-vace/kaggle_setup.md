# Kaggle notebook setup — Wan2.1 VACE 1.3B

Use a Kaggle notebook with **GPU enabled**. The notebook is the temporary inference server; the model weights are not stored in GitHub.

## Cell 1 — Clone the app adapter and official model code

```bash
!git clone https://github.com/DynamismCh/AnimateText-Studio.git /kaggle/working/AnimateText-Studio
!git clone https://github.com/Wan-Video/Wan2.1.git /kaggle/working/Wan2.1
```

If the folders already exist in the current session, do not clone over them; use the existing directories or remove the old clone first.

## Cell 2 — Install dependencies

```bash
%cd /kaggle/working/Wan2.1
!pip install -r requirements.txt
!pip install -r /kaggle/working/AnimateText-Studio/backend/wan21-vace/requirements.txt
!pip install "huggingface_hub[cli]"
```

If installation replaces Kaggle's preinstalled PyTorch/CUDA packages, restart the session and check `torch.cuda.is_available()` before continuing.

## Cell 3 — Download the model weights into Kaggle storage

```bash
!hf download Wan-AI/Wan2.1-VACE-1.3B --local-dir /kaggle/working/Wan2.1-VACE-1.3B
```

This is a large download. Keep the model in Kaggle working storage; **do not upload the weights to GitHub**.

## Cell 4 — Check the GPU before generating

```python
import torch, subprocess
print("CUDA available:", torch.cuda.is_available())
if torch.cuda.is_available():
    print("GPU:", torch.cuda.get_device_name(0))
    print("VRAM GiB:", round(torch.cuda.get_device_properties(0).total_memory / 1024**3, 2))
subprocess.run(["nvidia-smi"])
```

## Cell 5 — Start the adapter API

```bash
%cd /kaggle/working/AnimateText-Studio/backend/wan21-vace
%env WAN21_REPO_DIR=/kaggle/working/Wan2.1
%env WAN21_CKPT_DIR=/kaggle/working/Wan2.1-VACE-1.3B
%env WAN21_ALLOWED_ORIGINS=*
!uvicorn server:app --host 0.0.0.0 --port 7860
```

Run the server cell last so it stays running. Open `/api/health` on the notebook's exposed service URL if available. The health response only checks paths; it does not prove generation works.

## First test

Start with one uploaded character and the default short 17-frame prompt. Monitor GPU memory using `nvidia-smi`. The Wan2.1 project documents 8.19 GB for its **T2V-1.3B** model, not necessarily VACE; treat the VACE 11 GB limit as unverified until this test succeeds. If generation fails with CUDA out-of-memory, save the full error before changing settings.

Only after the API generates and serves a real MP4 should you expose it through a secure HTTPS tunnel and set `VITE_WAN21_API_URL` in the frontend deployment. A tunnel address is temporary and the Kaggle session must remain active during generation.
