@echo off
REM Import all PostgreSQL batch files into the target database using psql and .env.pg

setlocal
for /f "usebackq tokens=1,2 delims==" %%A in (".env.pg") do set %%A=%%B

REM Import each batch file using full path to psql
F:\pgsql\bin\psql "sslmode=%PGSSLMODE% host=%PGHOST% port=%PGPORT% dbname=%PGDATABASE% user=%PGUSER% password=%PGPASSWORD%" -f fxincapmain_postgres.sql
F:\pgsql\bin\psql "sslmode=%PGSSLMODE% host=%PGHOST% port=%PGPORT% dbname=%PGDATABASE% user=%PGUSER% password=%PGPASSWORD%" -f fxincapmain_postgres_batch2.sql
F:\pgsql\bin\psql "sslmode=%PGSSLMODE% host=%PGHOST% port=%PGPORT% dbname=%PGDATABASE% user=%PGUSER% password=%PGPASSWORD%" -f fxincapmain_postgres_batch3.sql

echo Migration complete.
endlocal
