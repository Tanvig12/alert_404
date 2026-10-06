FROM rust:1.89-slim AS build
WORKDIR /app
COPY Cargo.toml Cargo.lock* ./
COPY src ./src
RUN cargo build --release
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* && useradd -m appuser
USER appuser
COPY --from=build /app/target/release/soc-correlator /usr/local/bin/soc-correlator
EXPOSE 8081
CMD ["soc-correlator"]
