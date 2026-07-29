FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
# Primero solo los manifiestos: así el restore se cachea y no se repite cuando
# cambia el código. (Ver backend/.dockerignore: el .env y bin/obj del host no
# entran al contexto.)
COPY VocacionalTest.sln .
COPY src/VocacionalTest.Domain/VocacionalTest.Domain.csproj src/VocacionalTest.Domain/
COPY src/VocacionalTest.Application/VocacionalTest.Application.csproj src/VocacionalTest.Application/
COPY src/VocacionalTest.Infrastructure/VocacionalTest.Infrastructure.csproj src/VocacionalTest.Infrastructure/
COPY src/VocacionalTest.Api/VocacionalTest.Api.csproj src/VocacionalTest.Api/
RUN dotnet restore VocacionalTest.sln
COPY . .
RUN dotnet publish src/VocacionalTest.Api/VocacionalTest.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
# La imagen base trae ASPNETCORE_HTTP_PORTS=8080. El puerto se fija ACÁ (archivo
# versionado) y no en un .env del operador: el EXPOSE, el `ports` del compose, el
# healthcheck y el proxy_pass de nginx asumen 5000, y si Kestrel escucha en otro
# puerto todo /api devuelve 502 y el contenedor queda unhealthy para siempre.
ENV ASPNETCORE_URLS=http://+:5000
# Entorno seguro por defecto: en Development se publica Swagger y las páginas de
# error con stack trace + SQL (que incluye la PII del estudiante).
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 5000
# APP_UID (1654) lo define la imagen base justamente para no correr como root.
# 5000 > 1024, así que no hace falta privilegio para bindear.
USER $APP_UID
ENTRYPOINT ["dotnet", "VocacionalTest.Api.dll"]
