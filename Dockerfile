# Use the contrib version to get Datadog exporter support
FROM otel/opentelemetry-collector-contrib:latest

# Copy your local config into the container
COPY otel-config.yaml /etc/otelcol-contrib/config.yaml

# The default entrypoint for this image is /otelcol-contrib.
# We just need to point it to our config file.
CMD ["--config", "/etc/otelcol-contrib/config.yaml"]
