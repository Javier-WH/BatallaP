# Wrapper para ejecutar smoke tests en Windows/PowerShell
# Usa las credenciales del .env

$env:USERNAME = "Javier"
$env:PASSWORD = "123456"
npm test
