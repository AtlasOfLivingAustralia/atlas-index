# TODO: this is a copy from species-lists but changes made probably broke it

# Use an official Maven runtime as a parent image
FROM maven:3.9.6-eclipse-temurin-21 AS builder

# Set the working directory in the container
WORKDIR /app

# Copy the project files into the container
COPY pom.xml .
COPY src ./src

RUN --mount=type=cache,target=/root/.m2,rw mvn clean package -DskipTests

FROM ubuntu:focal

ARG DEBIAN_FRONTEND=noninteractive
ENV SERVER_PORT="8080"

ARG USER=search-service
ARG APP_ARTIFACT=search-service

# Install initial dependencies
RUN apt-get -y update && apt-get -y upgrade && \
        apt-get install -y -q add-apt-key software-properties-common

# Install main dependencies
RUN apt-get install -y -q openjdk-21-jre-headless

# Directories and perms
RUN mkdir -p /data/$APP_ARTIFACT && \
    groupadd -r $USER -g 1000 && useradd -r -g $USER -u 1000 -m $USER && \
    chown -R $USER:$USER /data/$APP_ARTIFACT
WORKDIR /opt/atlas/$APP_ARTIFACT

COPY --from=builder /app/target/search-service-*-SNAPSHOT.jar /opt/atlas/$APP_ARTIFACT/app.jar

# This is an example of how to copy the config file from the host to the container at build time.
# The application will not start without the config file.
# COPY search-service-config.properties /data/search-service/config/search-service-config.properties

USER $USER
EXPOSE $SERVER_PORT

CMD ["java", "-jar", "/opt/atlas/search-service/app.jar"]
