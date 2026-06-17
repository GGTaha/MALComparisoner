import subprocess
import sys
import os
import time

def run():
    print("==========================================")
    print("Starting Watch Overlap (Backend + Frontend)")
    print("==========================================")

    base_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(base_dir, "api")
    frontend_dir = base_dir

    # Start backend
    print(f"Starting Backend in {backend_dir}...")
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "index:app", "--reload", "--port", "8000"],
        cwd=backend_dir
    )

    # Start frontend
    print(f"Starting Frontend in {frontend_dir}...")
    # On Windows, shell=True is needed to resolve the npm command path
    frontend_proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=frontend_dir,
        shell=True
    )

    print("==========================================")
    print("Both processes started! Press Ctrl+C to stop both.")
    print("==========================================")

    try:
        while True:
            # Check if either process died unexpectedly
            if backend_proc.poll() is not None:
                print("Backend process terminated unexpectedly.")
                break
            if frontend_proc.poll() is not None:
                print("Frontend process terminated unexpectedly.")
                break
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        print("\nShutting down both servers...")
        backend_proc.terminate()
        frontend_proc.terminate()
        try:
            backend_proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            backend_proc.kill()
        try:
            frontend_proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            frontend_proc.kill()
        print("Shutdown complete.")

if __name__ == "__main__":
    run()
