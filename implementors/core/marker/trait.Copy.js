(function() {var implementors = {};
implementors["moonbeam_rpc_core_trace"] = [{"text":"impl Copy for RequestBlockId","synthetic":false,"types":[]},{"text":"impl Copy for RequestBlockTag","synthetic":false,"types":[]}];
implementors["moonbeam_rpc_primitives_debug"] = [{"text":"impl Copy for TraceType","synthetic":false,"types":[]},{"text":"impl Copy for CallType","synthetic":false,"types":[]},{"text":"impl Copy for CreateType","synthetic":false,"types":[]}];
implementors["moonbeam_rpc_trace"] = [{"text":"impl Copy for CacheBatchId","synthetic":false,"types":[]}];
implementors["moonbeam_runtime"] = [{"text":"impl Copy for Runtime","synthetic":false,"types":[]}];
implementors["parachain_staking"] = [{"text":"impl&lt;T:&nbsp;Copy&gt; Copy for Range&lt;T&gt;","synthetic":false,"types":[]},{"text":"impl Copy for CollatorStatus","synthetic":false,"types":[]},{"text":"impl&lt;BlockNumber:&nbsp;Copy&gt; Copy for RoundInfo&lt;BlockNumber&gt;","synthetic":false,"types":[]}];
implementors["precompiles"] = [{"text":"impl&lt;R:&nbsp;Copy&gt; Copy for MoonbeamPrecompiles&lt;R&gt;","synthetic":false,"types":[]}];
if (window.register_implementors) {window.register_implementors(implementors);} else {window.pending_implementors = implementors;}})()