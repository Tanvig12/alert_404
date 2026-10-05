import json

from .fallback_summary import generate_fallback_summary
from .ollama_client import OllamaClient
from .prompt_builder import build_incident_prompt


class IncidentSummarizer:
    def __init__(self, client=None):
        self.client = client or OllamaClient()

    def summarize(self, incident, correlation=None, risk=None, mitre=None):
        # Make a normal report first. It is used if Ollama is unavailable.
        report = generate_fallback_summary(incident, correlation, risk, mitre)

        try:
            prompt = build_incident_prompt(incident, correlation, risk, mitre)
            ai_text = self.client.generate(prompt)
            ai_report = self.read_json(ai_text)
            report.update(ai_report)
            report["provider"] = "ollama"
            report["model"] = self.client.model
            report["fallback_used"] = False
        except Exception as error:
            report["ai_error"] = str(error)

        return report

    @staticmethod
    def read_json(text):
        start = text.find("{")
        end = text.rfind("}")

        if start == -1 or end == -1:
            raise ValueError("AI response did not contain JSON")

        return json.loads(text[start:end + 1])
