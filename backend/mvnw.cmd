@echo off
setlocal

set "MAVEN_VERSION=3.9.9"
set "BASE_DIR=%~dp0"
set "MAVEN_DIR=%BASE_DIR%.mvn\apache-maven-%MAVEN_VERSION%"
set "MAVEN_BIN=%MAVEN_DIR%\bin\mvn.cmd"
set "MAVEN_ZIP=%BASE_DIR%.mvn\apache-maven-%MAVEN_VERSION%-bin.zip"
set "MAVEN_URL=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/%MAVEN_VERSION%/apache-maven-%MAVEN_VERSION%-bin.zip"

if not exist "%MAVEN_BIN%" (
  if not exist "%BASE_DIR%.mvn" mkdir "%BASE_DIR%.mvn"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "if (!(Test-Path '%MAVEN_ZIP%')) { Invoke-WebRequest -Uri '%MAVEN_URL%' -OutFile '%MAVEN_ZIP%' }; Expand-Archive -Path '%MAVEN_ZIP%' -DestinationPath '%BASE_DIR%.mvn' -Force"
)

call "%MAVEN_BIN%" %*
exit /b %ERRORLEVEL%
