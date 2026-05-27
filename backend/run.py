"""启动后端服务"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# 把 ffmpeg 加入 PATH（Whisper 解码音频需要）
_ffmpeg_dir = os.path.join(os.path.dirname(__file__), "..", "..")
if os.path.exists(os.path.join(_ffmpeg_dir, "ffmpeg.exe")):
    os.environ["PATH"] = _ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")

import uvicorn

if __name__ == "__main__":
    print("=" * 50)
    print("服务已启动，打开浏览器访问:")
    print("  http://localhost:8002/api/ocr/demo")
    print("=" * 50)
    uvicorn.run("app.main:app", host="0.0.0.0", port=8002, timeout_keep_alive=300, timeout_graceful_shutdown=30)