def fetch_weather(city: str):
    print(f"Checking rain forecast for {city}")
    return {"temperature": 22, "condition": "sunny", "humidity": 65}

def calculate_average_temperature(readings: list[float]) -> float:
    return sum(readings) / len(readings) if readings else 0.0
