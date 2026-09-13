# Contributing to XBT Pulse

Issues and pull requests are welcome for attribution corrections, documented adapter schemas, accessibility improvements, bugs and methodology questions. Read the [operator guide](docs/operators.md) and [API reference](docs/api.md) first.

## Operator integrations

You do not need to install our scraper or give us SSH access. An operator-owned adapter can implement the telemetry contract. Describe the software/build, process supervisor, metrics source, counter units, reset behavior and reporting scope. Include sanitized examples. Do not post full production configuration, miner identifiers, tokens, passwords or private network details.

Mark examples as synthetic when they are synthetic. Distinguish template builders from payout coordinators and disclose overlapping measurements. A hashrate counter or public Stratum connection does not establish independent templates. Compatibility approval is separate from a rating.

## Development

Use Node.js 24 and Python 3. Copy `.env.example` to a local `.env`; never commit it. Run:

```sh
npm run check
npm test
python3 -m unittest discover -s collector -p test_datum.py
python3 -m unittest discover -s collector/ratum -p test_ratum.py
python3 collector/package.py --check
```

Explain the problem, final behavior, evidence and validation in your pull request. Preserve unknown/unassessed states instead of manufacturing scores or zero values. Update relevant documentation when behavior changes.

Do not silently replace an already distributed versioned archive. Collector release changes need an intentional version, matching source, checksum and installation guidance. The existing v1.0.0 ZIP remains unchanged for reviewers comparing it with source. Release checksum signatures are verified in CI; see docs/release-signing.md. The private signing key is never stored in CI.

Submit only work you have permission to contribute under AGPL-3.0-or-later and retain third-party attribution. See LICENSE. Public issues are not the place for vulnerabilities or private operator applications; see SECURITY.md.
