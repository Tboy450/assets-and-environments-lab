param([string]$InitialDirectory=$env:ASSET_STUDIO_PICKER_INITIAL)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Application]::EnableVisualStyles()
$taskDialog=New-Object System.Windows.Forms.OpenFileDialog
$taskDialog.InitialDirectory=$InitialDirectory
$taskDialog.Title='Choose assets to add to your local lab'
$taskDialog.Multiselect=$true
$taskDialog.CheckFileExists=$true
$taskDialog.Filter='Assets|*.blend;*.blend1;*.glb;*.gltf;*.obj;*.fbx;*.hip;*.hiplc;*.hipnc;*.hda;*.hdalc;*.hdanc;*.bgeo;*.sc;*.vdb;*.usd;*.usdc;*.abc;*.zip;*.7z;*.png;*.jpg;*.jpeg;*.webp;*.gif;*.exr;*.hdr;*.wav;*.mp3;*.ogg;*.mp4;*.webm|All files|*.*'
try{
  if($taskDialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){ConvertTo-Json -InputObject @($taskDialog.FileNames) -Compress}else{'[]'}
}finally{$taskDialog.Dispose()}
