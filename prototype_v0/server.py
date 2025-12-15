from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pyperclip
import uvicorn
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("PasserV0")

app = FastAPI(title="Passer v0", description="LAN Clipboard Bridge Prototype")

class ClipboardContent(BaseModel):
    text: str

@app.get("/")
def read_root():
    return {"status": "online", "message": "Passer v0 is running"}

@app.get("/pull")
def pull_clipboard():
    try:
        content = pyperclip.paste()
        # Handle empty clipboard or non-text content gracefully
        # Log the content for user verification
        preview = content[:50] + "..." if len(content) > 50 else content
        logger.info(f"PULL: Sending '{preview}'")
        return {"text": content}
    except Exception as e:
        logger.error(f"PULL Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/push")
def push_clipboard(content: ClipboardContent):
    try:
        pyperclip.copy(content.text)
        preview = content.text[:50] + "..." if len(content.text) > 50 else content.text
        logger.info(f"PUSH: PC Clipboard updated to: '{preview}'")
        return {"status": "success", "copied_length": len(content.text)}
    except Exception as e:
        logger.error(f"PUSH Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # Host 0.0.0.0 is critical for LAN access
    uvicorn.run(app, host="0.0.0.0", port=8000)
