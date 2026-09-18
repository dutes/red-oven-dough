Add-Type -AssemblyName System.Drawing

$width = 1200
$height = 630
$image = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($image)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

function Brush($hex) {
    return New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($hex))
}

$red = Brush '#a6192e'
$cream = Brush '#f8f3e9'
$gold = Brush '#e9b455'
$navy = Brush '#172b3c'
$crust = Brush '#d9954f'
$cheese = Brush '#f5d386'
$pepperoni = Brush '#c33837'
$shadow = Brush '#791326'
$dim = Brush '#f2d5d4'

$graphics.FillRectangle($red, 0, 0, $width, $height)
$graphics.FillRectangle($navy, 0, 0, $width, 14)
$graphics.FillRectangle($cream, 0, 601, $width, 8)
$graphics.FillRectangle($navy, 0, 609, $width, 21)

$smallFont = New-Object System.Drawing.Font('Arial', 27, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$titleFont = New-Object System.Drawing.Font('Arial', 112, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$subtitleFont = New-Object System.Drawing.Font('Arial', 28, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)

$graphics.DrawString('RED OVEN PIZZA  /  THE DOUGH CALCULATOR', $smallFont, $dim, 65, 63)
$graphics.DrawString('RED OVEN', $titleFont, $cream, 58, 158)
$graphics.DrawString('DOUGH.', $titleFont, $gold, 58, 277)
$graphics.DrawString('Choose your flour. Plan your batch. Bake better pizza.', $subtitleFont, $cream, 66, 443)
$graphics.DrawString('MIX   /   PROVE   /   BAKE', $smallFont, $gold, 66, 539)

$graphics.FillEllipse($shadow, 813, 129, 321, 321)
$graphics.FillEllipse($crust, 793, 102, 321, 321)
$graphics.FillEllipse($cheese, 810, 119, 287, 287)
$graphics.FillEllipse($pepperoni, 866, 159, 54, 54)
$graphics.FillEllipse($pepperoni, 978, 183, 59, 59)
$graphics.FillEllipse($pepperoni, 905, 273, 61, 61)
$graphics.FillEllipse($pepperoni, 1007, 308, 49, 49)
$graphics.FillEllipse($pepperoni, 840, 244, 40, 40)
$graphics.FillEllipse($navy, 947, 140, 9, 9)
$graphics.FillEllipse($navy, 1050, 263, 9, 9)
$graphics.FillEllipse($navy, 864, 334, 9, 9)

$target = Join-Path $PSScriptRoot '..\site\social-card.png'
$image.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$image.Dispose()
foreach ($item in @($red, $cream, $gold, $navy, $crust, $cheese, $pepperoni, $shadow, $dim, $smallFont, $titleFont, $subtitleFont)) {
    $item.Dispose()
}
Write-Output $target
