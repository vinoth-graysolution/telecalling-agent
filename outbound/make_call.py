from fastapi import FastAPI
import requests

app = FastAPI()

@app.get("/make-call")
def make_call():

    url = "https://psychologically-nonprecious-vonnie.ngrok-free.dev/start"

    payload = {
        "dialout_settings": {
            "phone_number": "+919952825938"
            # "phone_number": "+919698350966"
        }
    }

    response = requests.post(url, json=payload)

    return {
        "status_code": response.status_code,
        "response": response.text
    }