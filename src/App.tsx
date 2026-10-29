import React, { useMemo, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { SubstrateRpcClient } from './services/substrateRpc';
import { EvmRpcClient } from './services/evmRpc';

export const App: React.FC = () => {
  const substrateClient = useMemo(() => new SubstrateRpcClient(), []);
  const evmClient = useMemo(() => new EvmRpcClient(), []);

  useEffect(() => {
    // Start direct read-only RPC connections
    substrateClient.connect();
    evmClient.start();

    return () => {
      substrateClient.destroy();
      evmClient.destroy();
    };
  }, [substrateClient, evmClient]);

  return <Dashboard substrateClient={substrateClient} evmClient={evmClient} />;
};

export default App;
