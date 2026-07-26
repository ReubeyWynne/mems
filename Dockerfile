# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY BearHunt/BearHunt.csproj BearHunt/
RUN dotnet restore BearHunt/BearHunt.csproj
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
