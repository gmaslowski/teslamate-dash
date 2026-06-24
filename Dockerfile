# build
FROM golang:1.22-alpine AS build
WORKDIR /src
RUN apk add --no-cache git
COPY . .
RUN go mod tidy && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/teslamate-dash .

# run (distroless, non-root, static)
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/teslamate-dash /teslamate-dash
EXPOSE 4001
USER nonroot:nonroot
ENTRYPOINT ["/teslamate-dash"]
