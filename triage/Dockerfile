# jeff triage service — MIT Jev-API-compatible server on GLiFormer-large.
# Repo: logan-markewich/jeff (unverified — confirm API shape first).
# Pinned commit MUST be set before first build; image runs profile `full` only.
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN useradd -m appuser
WORKDIR /app
# TODO(pin): replace HEAD with verified commit once API shape confirmed.
# RUN git clone --depth 1 https://github.com/logan-markewich/jeff.git . \
#   && pip install --no-cache-dir -r requirements.txt
USER appuser
EXPOSE 8083
# CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8083"]
CMD ["python", "-c", "print('jeff image placeholder — pin commit first')"]
