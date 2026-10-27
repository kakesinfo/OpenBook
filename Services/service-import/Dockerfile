FROM golang:1.26-alpine AS builder

WORKDIR /usr/src/app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/import-service .

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata curl

WORKDIR /usr/src/app

COPY --from=builder /app/import-service /app/import-service

ENV PORT=5003

EXPOSE 5003

CMD ["/app/import-service"]
