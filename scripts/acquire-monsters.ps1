$ErrorActionPreference='Stop'
$assetRoot=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $assetRoot
$catalog=Get-Content -LiteralPath 'art\sources\quaternius\blend-catalog.json' -Raw -Encoding UTF8 | ConvertFrom-Json
$choices=@('Big/Orc','Big/Tribal','Big/Orc_Skull','Big/Dino','Big/BlueDemon','Big/Yeti','Big/Demon','Blob/Mushnub_Evolved','Blob/Mushnub','Blob/Wizard','Flying/Ghost','Flying/Demon','Flying/Pigeon')
$records=@()
foreach($choice in $choices){
    $group,$name=$choice.Split('/')
    $item=$catalog | Where-Object { $_.Group -eq $group -and $_.Name -eq "$name.blend Binary" }
    if(-not $item){throw "Missing catalog model: $choice"}
    $target=Join-Path $assetRoot ("art\sources\quaternius\"+$group+'_'+$name+'.blend')
    $uri='https://drive.usercontent.google.com/download?id='+$item.Id+'&export=download&confirm=t'
    Invoke-WebRequest -Uri $uri -OutFile $target -UseBasicParsing -TimeoutSec 90
    $header=[IO.File]::ReadAllBytes($target)
    if([Text.Encoding]::ASCII.GetString($header,0,[Math]::Min(7,$header.Length)) -ne 'BLENDER'){throw "Invalid Blender source: $choice"}
    $records+=[pscustomobject]@{Author='Quaternius';License='CC0-1.0';Pack='Ultimate Monsters';Source='https://quaternius.com/packs/ultimatemonsters.html';FileId=$item.Id;Model=$choice;File=$target;Bytes=$header.Length;SHA256=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLower()}
    Write-Host "Downloaded $choice ($($header.Length) bytes)"
}
Invoke-WebRequest -Uri 'https://drive.usercontent.google.com/download?id=1CtLGgAKj-6a6GGNVNQT7GRPM7uyo9Fj8&export=download&confirm=t' -OutFile 'art\sources\quaternius\Atlas_Monsters.png' -UseBasicParsing -TimeoutSec 60
Invoke-WebRequest -Uri 'https://drive.usercontent.google.com/download?id=16GqsDGESyEOfRbc4dS7EqAwkIUSIW4_y&export=download&confirm=t' -OutFile 'docs\licenses\Quaternius-Ultimate-Monsters-CC0.txt' -UseBasicParsing -TimeoutSec 60
if(-not ((Get-Content -LiteralPath 'docs\licenses\Quaternius-Ultimate-Monsters-CC0.txt' -Raw) -match 'CC0|public domain')){throw 'Unexpected model license'}
$records | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath 'art\sources\quaternius\manifest.json' -Encoding UTF8
