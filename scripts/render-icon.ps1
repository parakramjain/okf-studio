# Render the code-native SVG logo as the PNG required by the VS Code manifest.
# Geometry and colors match media/okf-studio.svg; no external image service is used.
param([string]$OutputPath = (Join-Path $PSScriptRoot '../media/okf-studio.png'))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$bitmap = New-Object System.Drawing.Bitmap 256,256
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)
$graphics.ScaleTransform(2,2)
$background = New-Object System.Drawing.Drawing2D.GraphicsPath
$background.AddArc(0,0,56,56,180,90)
$background.AddArc(72,0,56,56,270,90)
$background.AddArc(72,72,56,56,0,90)
$background.AddArc(0,72,56,56,90,90)
$background.CloseFigure()
$dark = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#0f172a'))
$teal = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#5eead4')),7
$cyan = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#67e8f9')),6
$white = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#f0fdfa'))
$cyanFill = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#67e8f9'))
foreach ($pen in @($teal,$cyan)) {
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
}
try {
    $graphics.FillPath($dark,$background)
    $graphics.DrawLines($teal,[System.Drawing.PointF[]]@([System.Drawing.PointF]::new(98,31),[System.Drawing.PointF]::new(64,12),[System.Drawing.PointF]::new(18,39),[System.Drawing.PointF]::new(18,89),[System.Drawing.PointF]::new(64,116),[System.Drawing.PointF]::new(110,89),[System.Drawing.PointF]::new(110,55)))
    $graphics.DrawLines($cyan,[System.Drawing.PointF[]]@([System.Drawing.PointF]::new(44,44),[System.Drawing.PointF]::new(76,64),[System.Drawing.PointF]::new(44,84)))
    $graphics.DrawLine($cyan,76,64,101,49)
    $graphics.FillEllipse($white,36,36,16,16)
    $graphics.FillEllipse($white,36,76,16,16)
    $graphics.FillEllipse($white,67,55,18,18)
    $graphics.FillEllipse($cyanFill,95,39,16,16)
    $bitmap.Save([System.IO.Path]::GetFullPath($OutputPath),[System.Drawing.Imaging.ImageFormat]::Png)
} finally {
    foreach ($resource in @($graphics,$bitmap,$background,$dark,$teal,$cyan,$white,$cyanFill)) { $resource.Dispose() }
}
