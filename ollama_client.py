import json
from urllib.request import Request, urlopen


class OllamaClient:
    def __init__(self):
        self.model = "llama3.2"
        self.url = "http://127.0.0.1:11434/api/generate"

    def generate(self, prompt):
        # Send the prompt to Ollama and return its text answer.
        data = json.dumps({"model": self.model, "prompt": prompt, "stream": False}).encode()
        request = Request(
            self.url,
            data=data,
            headers={"Content-Type": "application/json"},
        )
        with urlopen(request, timeout=30) as response:
            answer = json.loads(response.read().decode())
        return answer["response"]