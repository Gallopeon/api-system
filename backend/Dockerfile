FROM docker.m.daocloud.io/library/rust:1.94-slim-bookworm AS builder
WORKDIR /app

# 1. Build dependencies only (layer cached unless Cargo.toml/Cargo.lock or .cargo/config changes)
COPY Cargo.toml Cargo.lock ./
COPY .cargo ./.cargo
RUN mkdir -p src && echo 'fn main() {}' > src/main.rs
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release --locked && \
    rm -rf src

# 2. Build actual application (only recompiles changed source files)
#    Binary must be copied out of the cache mount so COPY --from can find it
COPY src ./src
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release --locked && \
    cp target/release/api-control-backend /app/api-control-backend

FROM docker.m.daocloud.io/library/debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/api-control-backend /usr/local/bin/api-control-backend
EXPOSE 8080
ENV APP_BIND=0.0.0.0:8080
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
    CMD curl -sf http://localhost:8080/health/live || exit 1
CMD ["api-control-backend"]
