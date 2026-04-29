FROM eclipse-temurin:21-jdk AS build

WORKDIR /app
COPY . .
RUN chmod +x ./mvnw
RUN ./mvnw -B -DskipTests package

FROM eclipse-temurin:21-jre

WORKDIR /app
COPY --from=build /app/target/personal-accounting-backend-0.1.0.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
