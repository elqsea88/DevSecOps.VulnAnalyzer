@echo off
title DevSecOps MCP Servers
echo.
echo  Starting MCP Servers...
echo  Sonar  MCP  ^>  http://127.0.0.1:3747
echo  Jenkins MCP ^>  http://127.0.0.1:3748
echo.

start "Sonar MCP (3747)"   cmd /k "node sonar-mcp-server.js"
start "Jenkins MCP (3748)" cmd /k "node jenkins-mcp-server.js"

echo  Both servers launched in separate windows.
echo  Close those windows to stop the servers.
echo.
pause
