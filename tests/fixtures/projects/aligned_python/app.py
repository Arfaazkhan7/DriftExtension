from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
import datetime

app = FastAPI(title="Meeting Management API")

class UserLogin(BaseModel):
    username: str
    password: str

class MeetingRequest(BaseModel):
    title: str
    start_time: datetime.datetime
    attendees: list[str]

@app.post("/auth/login")
def login(credentials: UserLogin):
    if credentials.username == "admin" and credentials.password == "secret":
        return {"token": "jwt_authenticated_token_xyz"}
    raise HTTPException(status_code=401, detail="Invalid credentials")

@app.post("/meetings/schedule")
def schedule_meeting(meeting: MeetingRequest):
    meeting_id = f"mtg_{len(meeting.attendees)}"
    send_notification(meeting.attendees, meeting.title)
    return {"id": meeting_id, "status": "scheduled", "title": meeting.title}

def send_notification(attendees: list[str], title: str):
    for attendee in attendees:
        print(f"Sending calendar invite notification to {attendee} for meeting: {title}")
