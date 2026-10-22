"""Apply the XBT receipt correction to the pinned private XBTPay source.

The payment prompt holds an estimate for another payment. Accounting contains
fees actually included in the invoice total. Do not subtract an unused estimate
from a settled invoice's item price. Other configured assets retain their UI.
"""
import pathlib
import sys

root = pathlib.Path(sys.argv[1]).resolve()
path = root / 'BTCPayServer/Controllers/UIInvoiceController.UI.cs'
source = path.read_text()
marker = '// XBT receipt: display the fee included in accounting, not an unused next-payment estimate.'
if marker in source:
    assert source.count('NetworkFee = displayedNetworkFee,') == 1
    assert source.count('OrderAmount = ShowMoney(accounting.TotalDue - displayedNetworkFee),') == 1
    print('XBT receipt correction already applied.')
    raise SystemExit()
anchor = '            var model = new CheckoutModel\n'
assert source.count(anchor) == 1, 'Unexpected checkout source; stopped without changes.'
source = source.replace(anchor, '''            // XBT receipt: display the fee included in accounting, not an unused next-payment estimate.
            var displayedNetworkFee = paymentMethodId.ToString() == "XBT-CHAIN"
                ? Math.Max(0.0m, accounting.PaymentMethodFee - prompt.TweakFee)
                : prompt.PaymentMethodFee - prompt.TweakFee;
''' + anchor)
replacements = {
    'OrderAmount = ShowMoney(accounting.TotalDue - (prompt.PaymentMethodFee - prompt.TweakFee)),':
        'OrderAmount = ShowMoney(accounting.TotalDue - displayedNetworkFee),',
    'NetworkFee = prompt.PaymentMethodFee - prompt.TweakFee,':
        'NetworkFee = displayedNetworkFee,',
}
for before, after in replacements.items():
    assert source.count(before) == 1, 'Unexpected fee expression; stopped without changes.'
    source = source.replace(before, after)
path.write_text(source)
print('Applied XBT charged-fee receipt correction.')
