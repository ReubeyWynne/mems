# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY BearHunt/BearHunt.csproj BearHunt/package.json BearHunt/package-lock.json BearHunt/
RUN dotnet restore BearHunt/BearHunt.csproj

# Install Node.js for Lightning CSS CLI
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN cd BearHunt && npm ci

COPY . .
WORKDIR /src/BearHunt
RUN dotnet publish -c Release -o /app --no-restore

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .

ENV ASPNETCORE_URLS=http://+:8080
ENV DOTNET_GCHeapHardLimit=0x8000000
EXPOSE 8080
ENTRYPOINT ["dotnet", "BearHunt.dll"]
