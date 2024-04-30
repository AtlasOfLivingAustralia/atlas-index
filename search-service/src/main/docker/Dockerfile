# TODO: this is a copy from species-lists but changes made probably broke it

# Use an official Maven runtime as a parent image
FROM maven:3.9.6-eclipse-temurin-21 AS builder

RUN apt-get install -y -q openjdk-21-jdk openjdk-21-jre

# Set the working directory in the container
WORKDIR /app

# Copy the project files into the container
COPY pom.xml .
COPY src ./src

# Build the Maven project and create a WAR file
RUN mvn clean package -DskipTests

FROM ubuntu:focal

ARG DEBIAN_FRONTEND=noninteractive
ENV SERVER_PORT="8080"

# Install initial dependencies
RUN apt-get -y update && \
        apt-get install -y -q add-apt-key software-properties-common

ARG APT_KEY_DONT_WARN_ON_DANGEROUS_USAGE=DontWarn
ARG USER=search-service
ARG APP_ARTIFACT=search-service

# Install main dependencies
RUN apt-get install -y -q openjdk-21-jdk openjdk-21-jre

# Directories and perms
RUN mkdir -p /data/$APP_ARTIFACT && \
    groupadd -r $USER -g 1000 && useradd -r -g $USER -u 1000 -m $USER && \
    chown -R $USER:$USER /data/$APP_ARTIFACT
WORKDIR /opt/atlas/$APP_ARTIFACT

COPY --from=builder /app/target/search-service-*-SNAPSHOT.jar /opt/atlas/$APP_ARTIFACT/app.jar

USER $USER
EXPOSE $SERVER_PORT

CMD ["java", "-jar", "app.jar", "--spring.config.location=classpath:file:///data/search-service/config/search-service-config.properties"]
