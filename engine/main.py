from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from lancedb.pydantic import LanceModel, Vector
import cv2
import lancedb
import uuid
from PIL import Image
import numpy as np
import datetime
import threading
import os
import sys
import uvicorn
import multiprocessing
from contextlib import asynccontextmanager
import logging

# Stop Hugging Face from checking the internet
os.environ["HF_HUB_OFFLINE"] = "1"

# Stop PyTorch from spawning unnecessary background threads
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"


class VideoModel(LanceModel):
    id: str
    path: str
    name: str
    status: str = "pending"  # pending, processing, done
    tags: list[str] = []
    lastIndexedAt: datetime.datetime = datetime.datetime.now()

class FrameModel(LanceModel):
    video_id: str
    timestamp: float
    vector: Vector(512)

def get_resource_path(relative_path):
    """ Get the absolute path to a resource, works for dev and for PyInstaller """
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        # If running normally (python backend.py), use the current directory
        base_path = os.path.abspath(".")

    return os.path.join(base_path, relative_path)

DB_PATH = get_resource_path(".db")  # This folder will be created on your disk
MODEL_NAME = 'clip-ViT-B-32'
MODEL_PATH = get_resource_path('.models/clip-ViT-B-32')  # Local path to save the model

model = None
db = None

logging.basicConfig(
    level=logging.INFO,
    stream=sys.stdout,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db, model
    db = lancedb.connect(DB_PATH)
    from sentence_transformers import SentenceTransformer

    if not os.path.exists(MODEL_PATH):
        logger.info(f"Downloading model '{MODEL_NAME}' from Hugging Face...")
        model = SentenceTransformer(MODEL_NAME)
        os.makedirs(DB_PATH, exist_ok=True)
        model.save(MODEL_PATH)  # Save the model locally for future use
    else:
        logger.info(f"Loading model '{MODEL_NAME}' from '{MODEL_PATH}...")
        model = SentenceTransformer(MODEL_PATH)

    # Startup code can go here (if needed)
    yield
    # db.close()  
    del model  # Clean up the model from memory on shutdown
    # Shutdown code can go here (if needed)

logger.info("Booting Application.")
app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # Allows all origins
    allow_credentials=True,   # Optional: allow cookies/auth headers
    allow_methods=["*"],      # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],      # Allows all headers
)

def index_video_to_db(video: VideoModel):
    if not os.path.exists(video.path): 
        raise FileNotFoundError(f"Video not found: {video.path}")

    videos_table = db.open_table("videos")
    videos_table.update(where=f"id = '{video.id}'", values={"status": "processing"})

    frames_table = db.open_table("frames")

    cap = cv2.VideoCapture(video.path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    seconds_per_frame = 2
    frame_step = int(fps * seconds_per_frame)
    
    batch = [] # Buffer to write to DB in chunks (faster)
    frame_count = 0
    
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
            
        if frame_count % frame_step == 0:
            # AI Inference
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(rgb_frame)
            embedding = model.encode(pil_image).tolist() # Convert to standard List for DB
            
            timestamp = frame_count / fps
            
            # Add to batch
            batch.append({
                "video_id": video.id,
                "timestamp": timestamp,
                "vector": embedding
            })
            
            # Flush batch every 50 frames to save RAM
            if len(batch) >= 50:
                frames_table.add(batch)
                batch = []

        frame_count += 1
        
    # Flush remaining
    if batch:
        frames_table.add(batch)
        
    videos_table.update(where=f"id = '{video.id}'", values={"status": "completed", "lastIndexedAt": datetime.datetime.now()})
    # frames_table.optimize() # Optional: optimize the index after adding new data
    cap.release()

@app.get("/search")
def search(query: str|None = None, tags: list[str] = []):
    videos_table = db.open_table("videos")
    frames_table = db.open_table("frames")

    upper_bound = 0.75
    frames = frames_table.search(model.encode(query).tolist()).metric("cosine").select(["video_id", "timestamp"]).distance_range(upper_bound=upper_bound).limit(100).to_list() if query else []
    tags_in_clause = f"[{', '.join(repr(x) for x in tags)}]" if tags else "['']"
    # video_ids_in_clause = f"({', '.join(repr(x.video_id) for x in video_ids)})" if video_ids else "('')"
    video_ids = set(x["video_id"] for x in frames)
    video_ids_in_clause = f"({', '.join(repr(x) for x in video_ids)})" if video_ids else "('')"

    videos = videos_table.search().where(f"array_has_any(tags, {tags_in_clause})").where(f"id IN {video_ids_in_clause}").to_list() 

    for idx, frame in enumerate(frames):
        frame['video'] = next((v for v in videos if v["id"] == frame['video_id']), None)
        frame['similarity_score'] = 1 - frame['_distance']  # Convert distance to similarity
        # The similarity_score from 0.25 to 0.45 is equal to confidence 0 to 100
        frame['confidence'] = ((frame['similarity_score'] - 0.15) / (0.45 - 0.25)) if 0.15 <= frame['similarity_score'] <= 0.45 else 0


    return {"results": frames}

@app.get("/videos")
def list_videos():
    videos_table = db.open_table("videos")
    videos = videos_table.search().to_pydantic(VideoModel)
    videos.sort(key=lambda x: x.lastIndexedAt, reverse=True)

    return {"results": videos}

@app.delete("/videos/{video_id}", status_code=204)
def delete_video(video_id: str):
    videos_table = db.open_table("videos")
    frames_table = db.open_table("frames")
    videos_table.delete(f"id = '{video_id}'")
    frames_table.delete(f"video_id = '{video_id}'")

    return Response(status_code=204)


class IndexVideoRequest(LanceModel):
    path: str

@app.post("/index")
def index(request: IndexVideoRequest):
    videos_table = db.open_table("videos")
    name = os.path.basename(request.path)
    video = VideoModel(id=uuid.uuid4().hex, path=request.path, name=name, tags=[])
    videos_table.add([video])
    index_video_to_db(video)
    return {"video_id": video.id}

@app.post("/index/{video_id}")
def index(video_id: str):
    videos_table = db.open_table("videos")
    video = videos_table.search().where(f"id = '{video_id}'").limit(1).to_pydantic(VideoModel)
    video = video[0] if video else None
    if not video:
        return Response(content="Unalbe to reIndex the video", media_type="text/plain", status_code=404)

    try:
        index_video_to_db(video)
    except Exception as e:
        return Response(content=f"Error indexing video: {str(e)}", media_type="text/plain", status_code=500)

    return {"video_id": video.id}

@app.get("/frame")
def get_frame(video_id: str, timestamp: float):
    videos_table = db.open_table("videos")

    video = videos_table.search().where(f"id = '{video_id}'").limit(1).to_pydantic(VideoModel)
    video = video[0] if video else None
    if not video:
        return {"error": "Video not found"}

    cap = cv2.VideoCapture(video.path)
    cap.set(cv2.CAP_PROP_POS_MSEC, timestamp * 1000)  # Set position in milliseconds
    ret, frame = cap.read()
    cap.release()

    if not ret:
        return {"error": "Could not read frame at the specified timestamp"}

    # Convert frame to base64 for easy transmission (optional)
    ret, buffer = cv2.imencode('.jpg', frame)

    if not ret:
        return Response(content="Could not encode frame", media_type="text/plain", status_code=500)

    return Response(content=buffer.tobytes(), media_type="image/jpeg")

@app.get("/sprite")
def get_sprite(video_id: str, timestamp: float):
    videos_table = db.open_table("videos")

    video = videos_table.search().where(f"id = '{video_id}'").limit(1).to_pydantic(VideoModel)
    video = video[0] if video else None
    if not video:
        return {"error": "Video not found"}

    cap = cv2.VideoCapture(video.path)
    cap.set(cv2.CAP_PROP_POS_MSEC, timestamp * 1000)  # Set position in milliseconds
    ret, frame = cap.read()

    if not ret:
        return {"error": "Could not read frame at the specified timestamp"}

    height, width, _ = frame.shape
    sprite = np.zeros((height, width * 10, 3), dtype=np.uint8) # Create a blank sprite image to hold 10 frames
    timestamp = timestamp - 4 * 2 # Start from 9 frames before the requested timestamp (assuming 2 seconds per frame)

    if timestamp < 0:
        timestamp = 0

    for i in range(10):
        cap.set(cv2.CAP_PROP_POS_MSEC, timestamp * 1000)  # Set position in milliseconds
        ret, frame = cap.read()

        if not ret:
            break

        if frame.shape[:2] != (height, width):
            frame = cv2.resize(frame, (width, height))

        sprite[:, i*width:(i+1)*width, :] = frame # Place the frame in the correct position in the sprite
        timestamp += 2 # Move to the next frame (assuming 2 seconds per frame)

    cap.release()
    ret, buffer = cv2.imencode('.jpg', sprite)
    if not ret:
        return Response(content="Could not encode frame", media_type="text/plain", status_code=500)

    return Response(content=buffer.tobytes(), media_type="image/jpeg")

@app.get("/install")
def install():
    db.create_table("videos", schema=VideoModel, mode="overwrite")
    frames_table = db.create_table("frames", schema=FrameModel, mode="overwrite")
    return {"status": "LanceDB tables created!"}

def polite_suicide_when_orphaned():
    """Waits for Tauri to die, then asks Uvicorn to shut down gracefully."""
    try:
        # Blocks quietly until the Tauri pipe breaks
        sys.stdin.read()
    except Exception:
        pass
    finally:
        print("Tauri parent died. Triggering graceful shutdown...")
        
        # Instead of os._exit(0), we send a standard termination signal to ourselves.
        # Uvicorn catches this, stops HTTP traffic, and runs the lifespan shutdown.
        if os.name == 'nt':
            # Windows standard termination
            os.kill(os.getpid(), signal.SIGTERM)
        else:
            # Mac/Linux standard termination
            os.kill(os.getpid(), signal.SIGTERM)

if __name__ == '__main__':
    multiprocessing.freeze_support()
    threading.Thread(target=polite_suicide_when_orphaned, daemon=True)
    uvicorn.run(app, host="0.0.0.0", port=58000, reload=False)
