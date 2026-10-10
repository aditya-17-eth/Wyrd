param([Parameter(Mandatory=$true)][string]$AccountName)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskForge = Join-Path $taskRoot '.tools\foundry\forge.exe'
$taskCast = Join-Path $taskRoot '.tools\foundry\cast.exe'
$taskExpected = '0xd4febe16aefc4498828bf439fd4c6eb569a37666'
# --sender and vm.startBroadcast below require a loaded signer for this exact address.
# Foundry refuses broadcast when the selected keystore cannot sign for Wallet A.
$env:UNDERWRITER_A = $taskExpected
$taskChain = (& $taskCast chain-id --rpc-url 'https://testnet-rpc.monad.xyz').Trim()
if ($taskChain -ne '10143') { throw 'Wrong network. Deployment refused.' }
Push-Location (Join-Path $taskRoot 'contracts')
try {
    & $taskForge script 'script/Deploy.s.sol:Deploy' --rpc-url 'https://testnet-rpc.monad.xyz' --sender $taskExpected --account $AccountName --broadcast --gas-estimate-multiplier 110
    if ($LASTEXITCODE -ne 0) { throw 'Deployment failed or is incomplete; inspect broadcast records before retrying.' }
} finally { Pop-Location }
node (Join-Path $PSScriptRoot 'record-deployment.mjs')
