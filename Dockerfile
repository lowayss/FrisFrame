FROM python:3.11-slim

# Install FFmpeg for video rendering support
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy application code into the container
COPY . .

# Expose the default port
EXPOSE 8766

# Define environment variables
ENV HOST=0.0.0.0
ENV PORT=8766
ENV ENABLE_LICENSE_CHECK=true
ENV FRISFRAME_REQUIRE_ORIGIN=true
ENV FRISFRAME_SECURE_COOKIES=true

# Run the server
CMD ["python3", "server.py"]
