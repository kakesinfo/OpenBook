FROM golang:1.25-alpine AS builder

WORKDIR /usr/src/app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/scraper-service .

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata curl

WORKDIR /usr/src/app

COPY --from=builder /app/scraper-service /app/scraper-service
COPY sources_config.json /usr/src/app/sources_config.json

ENV PORT=5001

EXPOSE 5001

CMD ["/app/scraper-service"]
