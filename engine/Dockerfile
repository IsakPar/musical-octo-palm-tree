# =============================================================================
# Poly-Rust Trading Engine - Multi-Stage Docker Build
# =============================================================================
# Build: docker build -t poly-rust .
# Run:   docker run --env-file .env poly-rust
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build the Rust binary
# -----------------------------------------------------------------------------
FROM rust:1.75-slim-bookworm AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy manifests first for dependency caching
COPY Cargo.toml Cargo.lock* ./

# Copy benches directory (referenced in Cargo.toml)
COPY benches ./benches

# Create a dummy main.rs to build dependencies
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy actual source code
COPY src ./src

# Build the actual binary (touch to invalidate cache)
RUN touch src/main.rs && cargo build --release

# -----------------------------------------------------------------------------
# Stage 2: Create minimal runtime image
# -----------------------------------------------------------------------------
FROM debian:bookworm-slim AS runtime

# Install runtime dependencies (OpenSSL for HTTPS/WSS)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN useradd -m -u 1000 trader
USER trader

WORKDIR /app

# Copy the binary from builder
COPY --from=builder /app/target/release/poly-rust /usr/local/bin/poly-rust

# Install curl for health checks
USER root
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
USER trader

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Expose health check port
EXPOSE 8080

# Default environment (override with --env-file or -e)
ENV RUST_LOG=poly_rust=info
ENV DRY_RUN=true
ENV SUMTO100_PAPER_TRADING=true

# Run the trading engine
CMD ["poly-rust"]
