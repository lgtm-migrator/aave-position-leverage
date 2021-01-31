import React from 'react';
import fetch from 'unfetch';
import { ethers } from 'ethers';
import Onboard from 'bnc-onboard';
import { CACHE_WALLET_KEY, INFURA_ID } from 'config';
import cache from 'utils/cache';
import NETWORKS from 'networks.json';
import LENDING_POOL_ABI from 'abis/LendingPool.json';
import WETH_GATEWAY_ABI from 'abis/WETHGateway.json';
import FLASH_LOAN_ABI from 'abis/FlashLoan.json';
import CHAINLINK_PRICE_ORACLE_ABI from 'abis/ChainlinkPriceOracle.json';
import ADDRESSES_PROVIDER_ABI from 'abis/AddressesProvider.json';

NETWORKS.kovan.flashLoanAddress = process.env.KOVAN_FLASH_LOAN_CONTRACT_ADDRESS;
NETWORKS.mainnet.flashLoanAddress =
  process.env.MAINNET_FLASH_LOAN_CONTRACT_ADDRESS;

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
  const [lendingPoolAddress, setLendingPoolAddress] = React.useState(null);

  const cfg = React.useMemo(() => {
    if (!network) return {};
    return NETWORKS[network] ?? {};
  }, [network]);

  const addressesProviderContract = React.useMemo(
    () =>
      signer &&
      cfg.addressesProviderAddress &&
      new ethers.Contract(
        cfg.addressesProviderAddress,
        ADDRESSES_PROVIDER_ABI,
        signer
      ),
    [signer, cfg.addressesProviderAddress]
  );

  const lendingPoolContract = React.useMemo(
    () =>
      signer &&
      lendingPoolAddress &&
      new ethers.Contract(lendingPoolAddress, LENDING_POOL_ABI, signer),
    [signer, lendingPoolAddress]
  );

  const wethGatewayContract = React.useMemo(
    () =>
      signer &&
      cfg.wethGatewayAddress &&
      new ethers.Contract(cfg.wethGatewayAddress, WETH_GATEWAY_ABI, signer),
    [signer, cfg.wethGatewayAddress]
  );

  const leverageContract = React.useMemo(
    () =>
      signer &&
      cfg.flashLoanAddress &&
      new ethers.Contract(cfg.flashLoanAddress, FLASH_LOAN_ABI, signer),
    [signer, cfg.flashLoanAddress]
  );

  const priceOracleContract = React.useMemo(
    () =>
      signer &&
      cfg.chainLinkPriceOracleAddress &&
      new ethers.Contract(
        cfg.chainLinkPriceOracleAddress,
        CHAINLINK_PRICE_ORACLE_ABI,
        signer
      ),
    [signer, cfg.chainLinkPriceOracleAddress]
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

  const subgraph = React.useCallback(
    async function(query, variables) {
      const res = await fetch(cfg.subgraph, {
        method: 'POST',
        body: JSON.stringify({ query, variables }),
      });
      const { data } = await res.json();
      return data;
    },
    [cfg.subgraph]
  );

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

  React.useEffect(() => {
    if (!addressesProviderContract) return;
    let isMounted = true;
    (async () => {
      const _lendingPoolAddress = await addressesProviderContract.getLendingPool();
      if (isMounted) {
        setLendingPoolAddress(_lendingPoolAddress);
      }
    })();
    return () => (isMounted = false);
  }, [addressesProviderContract]);

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
        wethGatewayContract,
        leverageContract,
        priceOracleContract,
        subgraph,
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
    wethGatewayContract,
    leverageContract,
    priceOracleContract,
    subgraph,
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
    wethGatewayContract,
    leverageContract,
    priceOracleContract,
    subgraph,
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
