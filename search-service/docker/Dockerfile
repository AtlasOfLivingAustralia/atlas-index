# search-service image, built by the backend pipeline (cicd/backend) and usable locally:
#   docker build -f search-service/docker/Dockerfile search-service
#
# The jar is compiled on the build platform and copied into each target platform's runtime image,
# so multi-arch builds (buildx --platform linux/amd64,linux/arm64) do not run Maven under emulation.
# Configuration is not baked in: mount /data/search-service/config/search-service-config.properties
# (see search-service/helm).

FROM --platform=$BUILDPLATFORM public.ecr.aws/docker/library/maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN --mount=type=cache,target=/root/.m2,rw mvn -B clean package -DskipTests

FROM public.ecr.aws/docker/library/eclipse-temurin:21-jre-jammy

ENV SERVER_PORT="8080"
ARG USER=search-service
ARG APP_ARTIFACT=search-service

RUN groupadd -r $USER -g 1000 && useradd -r -g $USER -u 1000 -m $USER && \
    mkdir -p /data/$APP_ARTIFACT && chown -R $USER:$USER /data/$APP_ARTIFACT

WORKDIR /opt/atlas/$APP_ARTIFACT
COPY --from=builder /app/target/search-service-*.jar /opt/atlas/$APP_ARTIFACT/app.jar

USER $USER
EXPOSE $SERVER_PORT

CMD ["java", "-jar", "/opt/atlas/search-service/app.jar"]
