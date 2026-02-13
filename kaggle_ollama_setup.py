# ═══════════════════════════════════════════════════════════════════════════════
# Circle for Life — Kaggle Ollama Setup
# ═══════════════════════════════════════════════════════════════════════════════
#
# This script sets up a free LLM API server on Kaggle's GPU.
# Copy-paste this into a Kaggle notebook with GPU enabled.
#
# ╔══════════════════════════════════════════════════════════════════════╗
# ║  BEFORE RUNNING — You MUST configure these Kaggle notebook settings: ║
# ║                                                                      ║
# ║  1. Sidebar → "Session options" → Accelerator → "GPU T4 x2"         ║
# ║     (or "GPU P100" — do NOT leave as "None")                        ║
# ║                                                                      ║
# ║  2. Sidebar → "Session options" → Internet → Toggle ON               ║
# ║     (Internet is OFF by default — script WILL fail without it!)     ║
# ║                                                                      ║
# ║  3. Set your NGROK_AUTH_TOKEN below (free from ngrok.com)            ║
# ╚══════════════════════════════════════════════════════════════════════╝
#
# REQUIREMENTS:
# - Free Kaggle account (https://kaggle.com)
# - Free ngrok account (https://ngrok.com) — get your auth token from dashboard
# - GPU-enabled notebook with Internet ON (free, 30 hours/week)
#
# NOTES:
# - Kaggle sessions last up to 9 hours, then you must restart
# - ngrok free tier gives a new URL each restart — you'll need to update it
# - Choose your model below based on speed vs quality preference
# ═══════════════════════════════════════════════════════════════════════════════

import subprocess
import time
import os
import sys
import shutil

# ─── CONFIGURATION — Edit these values ─────────────────────────────────────

# Your ngrok auth token (get it free from https://dashboard.ngrok.com/get-started/your-authtoken)
NGROK_AUTH_TOKEN = "2X20dXBEzNCwilN82VsXRT2A1YI_H6DH5pKZAakHWb5kXQyc"

# Choose your model (uncomment one):
MODEL = "llama3.2:3b"        # ~2GB — Fast, good quality (recommended for voice calls)
# MODEL = "phi3:mini"        # ~2.3GB — Very fast, decent quality
# MODEL = "mistral:7b"       # ~4.1GB — Higher quality, slower on free GPU
# MODEL = "gemma2:2b"        # ~1.6GB — Smallest, fastest
# MODEL = "qwen2.5:7b"       # ~4.7GB — Strong multilingual support

# ─── PREFLIGHT CHECKS ─────────────────────────────────────────────────────

print("=" * 60)
print("  PREFLIGHT CHECKS")
print("=" * 60)

# Check 1: ngrok token
if NGROK_AUTH_TOKEN == "YOUR_NGROK_AUTH_TOKEN_HERE":
    print()
    print("!" * 60)
    print("  ERROR: You must set your ngrok auth token!")
    print()
    print("  1. Go to https://dashboard.ngrok.com/get-started/your-authtoken")
    print("  2. Sign up for free if you don't have an account")
    print("  3. Copy your auth token")
    print("  4. Replace 'YOUR_NGROK_AUTH_TOKEN_HERE' at the top of this script")
    print("!" * 60)
    raise SystemExit("Missing ngrok auth token")

# Check 2: Internet connectivity
print("\n[CHECK] Testing internet connectivity...")
try:
    import urllib.request
    urllib.request.urlopen("https://httpbin.org/get", timeout=10)
    print("  ✓ Internet is available")
except Exception as e:
    print()
    print("!" * 60)
    print("  ERROR: No internet access!")
    print()
    print("  Kaggle notebooks have Internet DISABLED by default.")
    print("  To fix this:")
    print("  1. Look at the right sidebar in your Kaggle notebook")
    print("  2. Find 'Session options'")
    print("  3. Toggle 'Internet' to ON")
    print("  4. The notebook will restart — then run this cell again")
    print("!" * 60)
    raise SystemExit(f"No internet: {e}")

# Check 3: GPU availability
print("\n[CHECK] Checking GPU...")
gpu_check = subprocess.run("nvidia-smi --query-gpu=name,memory.total --format=csv,noheader",
                           shell=True, capture_output=True, text=True)
if gpu_check.returncode == 0 and gpu_check.stdout.strip():
    gpu_info = gpu_check.stdout.strip()
    print(f"  ✓ GPU found: {gpu_info}")
else:
    print("  ⚠ WARNING: No GPU detected!")
    print("    Set Accelerator to 'GPU T4 x2' or 'GPU P100' in sidebar → Session options")
    print("    Continuing anyway (will use CPU — very slow for large models)...")
    time.sleep(3)

print("\n  All preflight checks passed!\n")

# ─── STEP 1: Install Ollama ────────────────────────────────────────────────

print("=" * 60)
print("  STEP 1: Installing Ollama...")
print("=" * 60)
sys.stdout.flush()

# Kaggle doesn't have zstd pre-installed — Ollama's archive needs it
print("  Installing zstd (required for Ollama extraction)...")
sys.stdout.flush()
os.system("apt-get update -qq && apt-get install -y -qq zstd > /dev/null 2>&1")

# Clean up any broken previous download
if os.path.exists("/usr/local/bin/ollama"):
    os.remove("/usr/local/bin/ollama")

# Official install script (includes GPU libraries + sets up PATH)
print("  Running official Ollama install script...")
sys.stdout.flush()
os.system("curl -fsSL https://ollama.com/install.sh | sh")

# Final verification
if not shutil.which("ollama"):
    print()
    print("!" * 60)
    print("  ERROR: Ollama installation failed!")
    print()
    print("  Try running these manually in a separate cell:")
    print("  !apt-get install -y zstd")
    print("  !curl -fsSL https://ollama.com/install.sh | sh")
    print("  !ollama --version")
    print()
    print("  Then run this script again.")
    print("!" * 60)
    raise SystemExit("Ollama installation failed")

os.system("ollama --version")
print("  ✓ Ollama installed successfully!")

# ─── STEP 2: Start Ollama server ───────────────────────────────────────────

print("\n" + "=" * 60)
print("  STEP 2: Starting Ollama server...")
print("=" * 60)

# Set environment for GPU support and listening on all interfaces
ollama_env = {**os.environ}
ollama_env["OLLAMA_HOST"] = "0.0.0.0:11434"
ollama_env["OLLAMA_ORIGINS"] = "*"  # Allow CORS from any origin

# Start ollama serve in background
ollama_process = subprocess.Popen(
    ["ollama", "serve"],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    env=ollama_env
)

# Wait for server to be ready
import urllib.request
server_ready = False
for i in range(45):  # Wait up to 45 seconds
    try:
        req = urllib.request.Request("http://localhost:11434/api/version")
        with urllib.request.urlopen(req, timeout=2) as resp:
            if resp.status == 200:
                import json
                data = json.loads(resp.read())
                print(f"  ✓ Ollama server is running! Version: {data.get('version', 'unknown')}")
                server_ready = True
                break
    except Exception:
        pass
    time.sleep(1)
    if (i + 1) % 10 == 0:
        print(f"  Waiting for server... ({i+1}s)")

if not server_ready:
    # Try to get error output
    try:
        ollama_process.terminate()
        _, stderr = ollama_process.communicate(timeout=5)
        print(f"  Server stderr: {stderr.decode()[-500:]}")
    except:
        pass
    print()
    print("!" * 60)
    print("  ERROR: Ollama server failed to start!")
    print("  This might be a GPU driver issue.")
    print("  Try selecting a different Accelerator in notebook settings.")
    print("!" * 60)
    raise SystemExit("Ollama server failed to start")

# ─── STEP 3: Pull the model ───────────────────────────────────────────────

print("\n" + "=" * 60)
print(f"  STEP 3: Downloading model '{MODEL}'...")
print(f"  (This may take 1-5 minutes depending on model size)")
print("=" * 60)

# Use subprocess with real-time output so the user can see download progress
pull_process = subprocess.Popen(
    f"ollama pull {MODEL}",
    shell=True,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True
)

# Stream output
for line in pull_process.stdout:
    line = line.strip()
    if line:
        print(f"  {line}")

pull_process.wait()
if pull_process.returncode != 0:
    print(f"\n  ⚠ Pull returned code {pull_process.returncode}")
    print("  Trying alternative model name...")
    # Try without version tag
    alt_model = MODEL.split(":")[0]
    subprocess.run(f"ollama pull {alt_model}", shell=True)

# Verify the model is ready with a quick test
print(f"\n  Testing model '{MODEL}'...")
try:
    import urllib.request
    test_data = json.dumps({
        "model": MODEL,
        "messages": [{"role": "user", "content": "Say hello in one word."}],
        "max_tokens": 10,
    }).encode()
    req = urllib.request.Request(
        "http://localhost:11434/v1/chat/completions",
        data=test_data,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        result = json.loads(resp.read())
        test_content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        print(f"  ✓ Model test successful! Response: {test_content}")
except Exception as e:
    print(f"  ⚠ Model test warning: {e}")
    print("  The model may still work — continuing...")

# ─── STEP 4: Install and start ngrok ──────────────────────────────────────

print("\n" + "=" * 60)
print("  STEP 4: Setting up ngrok tunnel...")
print("=" * 60)

subprocess.run([sys.executable, "-m", "pip", "install", "pyngrok", "-q"], check=True)

from pyngrok import ngrok, conf

conf.get_default().auth_token = NGROK_AUTH_TOKEN

try:
    tunnel = ngrok.connect(11434, "http")
    public_url = tunnel.public_url
except Exception as e:
    print(f"\n  ERROR starting ngrok: {e}")
    print("  Make sure your NGROK_AUTH_TOKEN is correct.")
    print("  Get one free at: https://dashboard.ngrok.com/get-started/your-authtoken")
    raise SystemExit(f"ngrok failed: {e}")

# ─── STEP 5: Print the connection info ────────────────────────────────────

print("\n")
print("╔" + "═" * 58 + "╗")
print("║" + "  SUCCESS! Your free AI backend is running!".center(58) + "║")
print("╠" + "═" * 58 + "╣")
print("║" + f"  Public URL:    {public_url}".ljust(58) + "║")
print("║" + f"  Model:         {MODEL}".ljust(58) + "║")
print("║" + f"  API Endpoint:  {public_url}/v1/chat/completions".ljust(58) + "║")
print("╠" + "═" * 58 + "╣")
print("║" + "  HOW TO USE IN CIRCLE FOR LIFE:".ljust(58) + "║")
print("║" + "".ljust(58) + "║")
print("║" + "  1. Go to the AI Agents page".ljust(58) + "║")
print("║" + "  2. Select 'Kaggle / Ollama (Free GPU)' as provider".ljust(58) + "║")
print("║" + f"  3. Paste URL: {public_url}".ljust(58) + "║")
print("║" + f"  4. Model: {MODEL}".ljust(58) + "║")
print("║" + "  5. Click 'Call' on any agent!".ljust(58) + "║")
print("╠" + "═" * 58 + "╣")
print("║" + "  ⚠ KEEP THIS NOTEBOOK RUNNING!".ljust(58) + "║")
print("║" + "  Closing it stops the server.".ljust(58) + "║")
print("╚" + "═" * 58 + "╝")

# ─── STEP 6: Keep alive ──────────────────────────────────────────────────

print("\nServer is running. Status updates every 5 minutes...\n")

while True:
    try:
        req = urllib.request.Request("http://localhost:11434/api/version")
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status == 200:
                tunnels = ngrok.get_tunnels()
                tunnel_url = tunnels[0].public_url if tunnels else "DISCONNECTED"
                print(f"  [{time.strftime('%H:%M:%S')}] ✓ Server OK | URL: {tunnel_url} | Model: {MODEL}")
            else:
                print(f"  [{time.strftime('%H:%M:%S')}] ⚠ Server returned {resp.status}")
    except Exception as e:
        print(f"  [{time.strftime('%H:%M:%S')}] ✗ ERROR: {e}")
        # Try to restart ollama if it died
        if ollama_process.poll() is not None:
            print("  Ollama process died! Restarting...")
            ollama_process = subprocess.Popen(
                ["ollama", "serve"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=ollama_env
            )
            time.sleep(10)
    time.sleep(300)  # Check every 5 minutes
