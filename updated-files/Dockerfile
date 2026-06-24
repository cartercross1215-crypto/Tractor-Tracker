FROM python:3.12-slim

WORKDIR /app

ENV HOST=0.0.0.0
ENV PORT=8000
ENV TRACTOR_TRACKER_DATA_DIR=/data

COPY . .

RUN mkdir -p /data

EXPOSE 8000
VOLUME ["/data"]

CMD ["python3", "server.py"]
