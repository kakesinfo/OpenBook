FROM golang:1.23-alpine AS builder

WORKDIR /usr/src/app

RUN apk add --no-cache build-base

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -o /app/media-service .

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/media-service /app/media-service

ENV PORT=5002 \
    DATA_DIR=/data/media \
    MAX_WIDTH=640 \
    MAX_HEIGHT=960 \
    WEBP_QUALITY=82

EXPOSE 5002

CMD ["/app/media-service"]
