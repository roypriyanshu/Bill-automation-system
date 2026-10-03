# =========================================================
# Stage 1: Build Frontend (Vite + React + Tailwind CSS)
# =========================================================
FROM node:20-bookworm-slim AS frontend-builder
WORKDIR /app/frontend

# Copy frontend package manifests and install dependencies
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend source code and build production assets
COPY frontend/ ./
RUN npm run build

# =========================================================
# Stage 2: Production Runtime (Node.js + Python + OCR Engine)
# =========================================================
FROM node:20-bookworm-slim

WORKDIR /app

# Install Python3, pip, and system libraries required for OpenCV & PaddleOCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-dev \
    gcc \
    g++ \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies for OCR & image preprocessing
RUN pip3 install --no-cache-dir --break-system-packages \
    numpy \
    opencv-python-headless \
    pillow \
    pypdfium2 \
    paddlepaddle \
    paddleocr

# Set environment variables
ENV NODE_ENV=production \
    PORT=5000 \
    PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=utf-8 \
    GLOG_minloglevel=2 \
    FLAGS_fraction_of_gpu_memory_to_use=0

# Copy root & backend package files and install backend dependencies
COPY package*.json ./
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Copy backend application source code
COPY backend/ ./backend/

# Copy built frontend assets from builder stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Ensure persistent directories exist with appropriate permissions
RUN mkdir -p /app/backend/uploads /app/backend/data

# Expose backend port
EXPOSE 5000

# Set working directory to backend
WORKDIR /app/backend

# Start the Node.js backend server
CMD ["node", "server.js"]
