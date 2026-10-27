# Prepara la carpeta «para-subir-a-github» con solo lo que hace falta publicar:
# el programa. Ni los ejemplos (llevan nombres reales) ni el LEEME, y nunca datos
# (esos viven en el navegador, no en ficheros).
# Uso: clic derecho → Ejecutar con PowerShell, o  powershell -File preparar-github.ps1
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$dest = Join-Path $raiz 'para-subir-a-github'

# la versión tiene que coincidir en los tres sitios
$vApp   = [regex]::Match((Get-Content (Join-Path $raiz 'js\app.js') -Raw -Encoding UTF8), "APP_VERSION = '([^']+)'").Groups[1].Value
$vSw    = [regex]::Match((Get-Content (Join-Path $raiz 'sw.js') -Raw -Encoding UTF8), "VERSION = 'mis-cuentas-([^']+)'").Groups[1].Value
$vHtml  = [regex]::Match((Get-Content (Join-Path $raiz 'index.html') -Raw -Encoding UTF8), 'data-build="([^"]+)"').Groups[1].Value
if ($vApp -ne $vSw -or $vApp -ne $vHtml) { throw "Las versiones no coinciden: app.js $vApp · sw.js $vSw · index.html $vHtml" }

if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory $dest | Out-Null
foreach ($f in 'index.html', 'manifest.webmanifest', 'sw.js') { Copy-Item (Join-Path $raiz $f) $dest }
foreach ($d in 'css', 'js') { Copy-Item (Join-Path $raiz $d) (Join-Path $dest $d) -Recurse }
New-Item -ItemType Directory (Join-Path $dest 'icons') | Out-Null
Get-ChildItem (Join-Path $raiz 'icons') -File | Where-Object { $_.Extension -ne '.ico' } | Copy-Item -Destination (Join-Path $dest 'icons')
# sin Jekyll: GitHub Pages sirve los ficheros tal cual
New-Item -ItemType File (Join-Path $dest '.nojekyll') | Out-Null
@"
# Mis cuentas

Presupuesto de casa y finanzas personales. App web instalable (PWA), sin servidor.

**Los datos no se suben a ningún sitio**: se guardan en el navegador de cada dispositivo
(localStorage). Este repositorio solo tiene el programa.

Versión $vApp
"@ | Set-Content (Join-Path $dest 'README.md') -Encoding UTF8

"Versión $vApp lista en: $dest"
Get-ChildItem $dest -Recurse -File -Force | ForEach-Object { '  ' + $_.FullName.Substring($dest.Length + 1) }
