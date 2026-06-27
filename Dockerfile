FROM python:3.12-slim

WORKDIR /app

ENV HOST=0.0.0.0
ENV PORT=10000
ENV TRACTOR_TRACKER_DATA_DIR=/data

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN test -f icons/icon-192.png && test -f icons/icon-512.png && test -f icons/apple-touch-icon.png

RUN mkdir -p /data

EXPOSE 10000
VOLUME ["/data"]

CMD ["python3", "server.py"]
