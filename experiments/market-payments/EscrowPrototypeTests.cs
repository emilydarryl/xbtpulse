using System;
using System.Linq;
using NBitcoin;
using Xunit;
public class EscrowPrototypeTests {
[Fact] public void SortedTwoOfThreeScriptMatchesNBitcoin() {
var keys = new[] { new PubKey("0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"),new PubKey("02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5"),new PubKey("02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9") }.OrderBy(k => k.ToHex(), StringComparer.Ordinal).ToArray();
var script=PayToMultiSigTemplate.Instance.GenerateScriptPubKey(2,keys);
Assert.Equal("52210279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f817982102c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee52102f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f953ae",script.ToHex());
Assert.Equal("002012c2ffbc6ec1cf5d746dfbd49b1063356212ea55f43023ffc0145934af20c572",script.WitHash.ScriptPubKey.ToHex());
}
}
