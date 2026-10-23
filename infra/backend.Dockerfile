FROM ruby:3.3.10
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client-17 imagemagick \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV BUNDLE_FROZEN=true
COPY backend/Gemfile backend/Gemfile.lock ./
RUN --mount=type=cache,id=cpq-gems,target=/app/vendor/cache \
    bundle install --local || bundle install
COPY backend/ ./
EXPOSE 3000
CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0"]
