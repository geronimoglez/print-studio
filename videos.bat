@echo off
REM === Lab 3D — Videos 360 para Mercado Libre ===
REM Doble-clic para generar y publicar los videos 360 de los modelos de UNA pieza (los multi-pieza
REM se descartan solos). Si YouTube no esta conectado, deja los clips listos y te dice que falta.
cd /d "%~dp0"
call npm run videos
echo.
echo ====== Listo. Puedes cerrar esta ventana. ======
pause
