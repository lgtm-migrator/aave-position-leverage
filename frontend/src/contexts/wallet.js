import React from 'react';
import { ethers } from 'ethers';
import Onboard from 'bnc-onboard';
import { CACHE_WALLET_KEY, INFURA_ID } from 'config';
import cache from 'utils/cache';
import NETWORKS from 'networks.json';
import LENDING_POOL_ABI from 'abis/LendingPool.json';
// import ERC20_ABI from 'abis/ERC20.json';

const DEFAULT_NETWORK_ID = 1;

const WALLETS = [
  { walletName: 'metamask', preferred: true },
  {
    walletName: 'walletConnect',
    infuraKey: INFURA_ID,
    preferred: true,
  },
];

const WalletContext = React.createContext(null);

let onboard;

export function WalletProvider({ children }) {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [address, setAddress] = React.useState(null);
  const [signer, setSigner] = React.useState(null);
  const [network, setNetwork] = React.useState('');

  const cfg = React.useMemo(() => {
    if (!network) return {};
    return NETWORKS[network] ?? {};
  }, [network]);

  const lendingPoolContract = React.useMemo(
    () =>
      signer &&
      cfg.lendingPool &&
      new ethers.Contract(cfg.lendingPool, LENDING_POOL_ABI, signer),
    [signer, cfg.lendingPool]
  );

  const connect = React.useCallback(
    async tryCached => {
      if (address) return;

      let cachedWallet;
      if (tryCached) {
        cachedWallet = cache(CACHE_WALLET_KEY);
        if (!cachedWallet) return;
      }

      if (!onboard) {
        onboard = Onboard({
          dappId: '',
          networkId: await getDefaultNetworkId(),
          walletSelect: {
            wallets: WALLETS,
          },
        });
      }

      if (
        !(cachedWallet
          ? await onboard.walletSelect(cachedWallet)
          : await onboard.walletSelect())
      )
        return;
      await onboard.walletCheck();

      const {
        wallet: { name: walletName, provider: web3Provider },
      } = onboard.getState();

      if (~walletName.indexOf('MetaMask')) {
        cache(CACHE_WALLET_KEY, walletName);
      }

      web3Provider.on('accountsChanged', () => {
        window.location.reload();
      });
      web3Provider.on('chainChanged', () => {
        window.location.reload();
      });
      // web3Provider.on('disconnect', () => {
      //   disconnect();
      // });

      const provider = new ethers.providers.Web3Provider(web3Provider);
      const signer = provider.getSigner();

      setSigner(signer);
      setAddress(await signer.getAddress());
    },
    [address]
  );

  async function disconnect() {
    cache(CACHE_WALLET_KEY, null);
    setAddress(null);
    setSigner(null);
  }

  React.useEffect(() => {
    if (!signer) return;
    let isMounted = true;
    (async () => {
      const net = await signer.provider.getNetwork();
      if (isMounted) {
        setNetwork(~['homestead'].indexOf(net.name) ? 'mainnet' : net.name);
      }
    })();
    return () => (isMounted = false);
  }, [signer]);

  React.useEffect(() => {
    let isMounted = true;
    (async () => {
      await connect(true);
      if (isMounted) setIsLoaded(true);
    })();
    return () => (isMounted = false);
  }, [connect]);

  return (
    <WalletContext.Provider
      value={{
        isLoaded,
        address,
        connect,
        disconnect,
        config: cfg,
        network,
        signer,
        lendingPoolContract,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = React.useContext(WalletContext);
  if (!context) {
    throw new Error('Missing wallet context');
  }
  const {
    isLoaded,
    address,
    connect,
    disconnect,
    config,
    network,
    signer,
    lendingPoolContract,
  } = context;

  return {
    isLoaded,
    address,
    connect,
    disconnect,
    config,
    network,
    signer,
    availableNetworkNames: Object.keys(NETWORKS),
    lendingPoolContract,
  };
}

// https://github.com/Synthetixio/staking/blob/c42ac534ba774d83caca183a52348c8b6260fcf4/utils/network.ts#L5
async function getDefaultNetworkId() {
  try {
    if (window?.web3?.eth?.net) {
      const networkId = await window.web3.eth.net.getId();
      return Number(networkId);
    } else if (window?.web3?.version?.network) {
      return Number(window?.web3.version.network);
    } else if (window?.ethereum?.networkVersion) {
      return Number(window?.ethereum?.networkVersion);
    }
    return DEFAULT_NETWORK_ID;
  } catch (e) {
    console.log(e);
    return DEFAULT_NETWORK_ID;
  }
}
