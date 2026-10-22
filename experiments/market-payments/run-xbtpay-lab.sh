# Isolated XBTPay regression runner. No node credentials, wallets, ports or app volumes.
set -eu
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
labroot=${1:?Pass an empty disposable lab directory}
case "$labroot" in /tmp/xbtpay-lab.*) ;; *) echo 'Use a /tmp/xbtpay-lab.* directory' >&2; exit 1;; esac
mkdir -p "$labroot"
test ! -e "$labroot/source"
git clone https://github.com/connorslab/paperclip-btcpay-xbt.git "$labroot/source"
cd "$labroot/source"
git checkout --detach 2302618c428ca697c237572593694e4f0d639271
python3 -m unittest discover -s gateway -p test_gateway.py
python3 scripts/test_lnd_connection.py
python3 scripts/prepare.py
python3 - <<'PY'
from pathlib import Path
p=Path('.build/btcpay/BTCPayServer/BTCPayServer.csproj')
s=p.read_text()
assert 'System.Security.Cryptography.Pkcs' not in s
s=s.replace('</Project>','  <ItemGroup>\n    <PackageReference Include="System.Security.Cryptography.Pkcs" Version="10.0.13" />\n  </ItemGroup>\n</Project>')
p.write_text(s)
PY
cp "$script_dir/EscrowPrototypeTests.cs" .build/btcpay/BTCPayServer.Tests/EscrowPrototypeTests.cs
sdk=mcr.microsoft.com/dotnet/sdk:10.0.400-noble@sha256:4beef5b8919dcaa2dc924233bd069257e883cc7a061e09088a97d152d6a48510
docker run --rm --cpus=2 --memory=3g --pids-limit=512 --cap-drop=ALL --security-opt=no-new-privileges -e DOTNET_CLI_HOME=/tmp/dotnet -v "$labroot/source/.build/nbxplorer:/source" -v "$labroot/source/.build/btcpay/XBTPay/nuget:/packages" -w /source "$sdk" sh -c 'dotnet test NBXplorer.Tests/NBXplorer.Tests.csproj --filter FullyQualifiedName~XbtTests && dotnet pack NBXplorer.Client/NBXplorer.Client.csproj -c Release -o /packages'
docker run --rm --cpus=2 --memory=3g --pids-limit=512 --cap-drop=ALL --security-opt=no-new-privileges -e DOTNET_CLI_HOME=/tmp/dotnet -v "$labroot/source/.build/btcpay:/source" -w /source "$sdk" sh -c 'dotnet test BTCPayServer.Tests/BTCPayServer.Tests.csproj --filter "FullyQualifiedName~XbtTests|FullyQualifiedName~EscrowPrototypeTests" && dotnet list BTCPayServer/BTCPayServer.csproj package --vulnerable --include-transitive'
