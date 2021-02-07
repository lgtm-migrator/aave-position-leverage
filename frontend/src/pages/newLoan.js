import React from 'react';
import clsx from 'clsx';
import * as ethers from 'ethers';
import { makeStyles } from '@material-ui/core/styles';
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Slider,
  TextField,
} from '@material-ui/core';
import { formatUnits, isZero } from 'utils/big-number';
import { UseWallet } from 'contexts/wallet';
import { useNotifications } from 'contexts/notifications';
import { SUCCESS_COLOR, DANGER_COLOR } from 'config';
import sleep from 'utils/sleep';
import Loader from 'components/Loader';
import ERC20_ABI from 'abis/ERC20.json';
import Select from 'react-select';
import { LeverageButton } from 'utils/takeloan';

const useStyles = makeStyles(theme => ({
  container: {
    '& th, td': {
      borderColor: 'rgba(16, 161, 204, 0.2)',
      top: -1000,
    },
  },
  error: {
    color: DANGER_COLOR,
  },
  success: {
    color: SUCCESS_COLOR,
  },
  leverageSlider: {
    width: 100,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    columnGap: '10px',
  },
  slippagebtn: {
    backgroundColor: 'rgb(45,49,66)',
    border: 'none',
    color: 'white',
    padding: '13px',
    textAlign: 'center',
    textDecoration: 'none',
    display: 'inline-block',
    fontSize: '13px',
    margin: '4px 0.1px',
  },
  takebtn: {
    backgroundColor: 'green',
    border: 'none',
    color: 'white',
    padding: '13px',
    textAlign: 'center',
    margin: '30px 0px',
  },
}));

export default function() {
  const classes = useStyles();
  const {
    connect,
    address,
    isLoaded: walletIsLoaded,
    signer,
    wethGatewayContract,
    lendingPoolContract,
    subgraph,
  } = UseWallet();

  const [collateralToken, setCollateralToken] = React.useState(null);
  const [debtToken, setDebtToken] = React.useState(null);
  const [leverage, setLeverage] = React.useState(null);
  const [slippage, setSlippage] = React.useState(null);
  const [collateralAmount, setCollateralAmount] = React.useState(null);

  /*React.useEffect(() => {
    if (!walletIsLoaded) return;
    if (!(signer && lendingPoolContract && wethGatewayContract && address))
      return;

    let isMounted = true;
    const unsubs = [() => (isMounted = false)];

    const load = async () => {
      const { users } = await subgraph(
        `
        query {
          reserves {
            symbol
            underlyingAsset
            usageAsCollateralEnabled
          }
        }
        
      `,
        {}
      );

      alert(typeof users);

      if (isMounted) {
        setIsLoaded(true);
      }
    };

    load();
    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [
    signer,
    walletIsLoaded,
    lendingPoolContract,
    wethGatewayContract,
    address,
    subgraph,
  ]);*/

  const AAVETokens = [
    {
      baseLTVasCollateral: '7500',
      symbol: 'TUSD',
      underlyingAsset: '0x0000000000085d4780b73119b644ae5ecd22b376',
      usageAsCollateralEnabled: true,
    },
    {
      baseLTVasCollateral: '0',
      symbol: 'GUSD',
      underlyingAsset: '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd',
      usageAsCollateralEnabled: false,
    },
    {
      baseLTVasCollateral: '4000',
      symbol: 'YFI',
      underlyingAsset: '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e',
      usageAsCollateralEnabled: true,
    },
    {
      baseLTVasCollateral: '7000',
      symbol: 'BAT',
      underlyingAsset: '0x0d8775f648430679a709e98d2b0cb6250d2887ef',
      usageAsCollateralEnabled: true,
    },
    {
      baseLTVasCollateral: '6000',
      symbol: 'MANA',
      underlyingAsset: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942',
      usageAsCollateralEnabled: true,
    },
    {
      baseLTVasCollateral: '6000',
      symbol: 'UNI',
      underlyingAsset: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
      usageAsCollateralEnabled: true,
    },
    {
      baseLTVasCollateral: '7000',
      symbol: 'WBTC',
      underlyingAsset: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      usageAsCollateralEnabled: true,
    },
    {
      baseLTVasCollateral: '5500',
      symbol: 'REN',
      underlyingAsset: '0x408e41876cccdc0f92210600ef50372656052a38',
      usageAsCollateralEnabled: true,
    },
    {
      baseLTVasCollateral: '0',
      symbol: 'BUSD',
      underlyingAsset: '0x4fabb145d64652a948d72533023f6e7a623c7c53',
      usageAsCollateralEnabled: false,
    },
    {
      baseLTVasCollateral: '7000',
      symbol: 'LINK',
      underlyingAsset: '0x514910771af9ca656af840dff83e8264ecf986ca',
      usageAsCollateralEnabled: true,
    },
    {
      baseLTVasCollateral: '0',
      symbol: 'SUSD',
      underlyingAsset: '0x57ab1ec28d129707052df4df418d58a2d46d5f51',
      usageAsCollateralEnabled: false,
    },
    {
      baseLTVasCollateral: '7500',
      symbol: 'DAI',
      underlyingAsset: '0x6b175474e89094c44da98b954eedeac495271d0f',
      usageAsCollateralEnabled: true,
    },
    {
      baseLTVasCollateral: '5000',
      symbol: 'AAVE',
      underlyingAsset: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
      usageAsCollateralEnabled: true,
    },
    {
      baseLTVasCollateral: '6000',
      symbol: 'MKR',
      underlyingAsset: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2',
      usageAsCollateralEnabled: true,
    },
    {
      baseLTVasCollateral: '8000',
      symbol: 'USDC',
      underlyingAsset: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      usageAsCollateralEnabled: true,
    },
    {
      baseLTVasCollateral: '5500',
      symbol: 'BAL',
      underlyingAsset: '0xba100000625a3754423978a60c9317c58a424e3d',
      usageAsCollateralEnabled: true,
    },
    {
      baseLTVasCollateral: '1500',
      symbol: 'SNX',
      underlyingAsset: '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
      usageAsCollateralEnabled: true,
    },
    {
      baseLTVasCollateral: '8000',
      symbol: 'WETH',
      underlyingAsset: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      usageAsCollateralEnabled: true,
    },
    {
      baseLTVasCollateral: '4000',
      symbol: 'CRV',
      underlyingAsset: '0xd533a949740bb3306d119cc777fa900ba034cd52',
      usageAsCollateralEnabled: true,
    },
    {
      baseLTVasCollateral: '0',
      symbol: 'USDT',
      underlyingAsset: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      usageAsCollateralEnabled: false,
    },
    {
      baseLTVasCollateral: '6000',
      symbol: 'KNC',
      underlyingAsset: '0xdd974d5c2e2928dea5f71b9825b8b646686bd200',
      usageAsCollateralEnabled: true,
    },
    {
      baseLTVasCollateral: '6000',
      symbol: 'ZRX',
      underlyingAsset: '0xe41d2489571d322189246dafa5ebde1f4699f498',
      usageAsCollateralEnabled: true,
    },
    {
      baseLTVasCollateral: '5500',
      symbol: 'ENJ',
      underlyingAsset: '0xf629cbd94d3791c9250152bd8dfbdf380e2a3b9c',
      usageAsCollateralEnabled: true,
    },
  ];

  const Leverages = [1, 2, 3, 4];
  const Slippages = [1, 2, 3, 4, 5];
  // const Requirements

  return (
    <Box className={clsx(classes.container, 'text-center')}>
      <h2>Take a Loan</h2>

      <h3>Collateral Token:</h3>
      <Select
        defaultValue={collateralToken}
        onChange={setCollateralToken}
        options={AAVETokens.map(tok =>
          tok.usageAsCollateralEnabled
            ? { value: tok.symbol, label: tok.symbol }
            : null
        ).filter(val => val != null)}
      />
      <h3>Debt Token:</h3>
      <Select
        defaultValue={debtToken}
        onChange={setDebtToken}
        options={AAVETokens.map(tok => {
          return { value: tok.symbol, label: tok.symbol };
        }).filter(val => val != null)}
      />
      <span>Leverage:</span>
      {Leverages.map(lev => (
        <button
          className={classes.slippagebtn}
          onClick={e => {
            setLeverage(lev);
            e.target.style.color = 'orange';
          }}
        >
          {lev}x
        </button>
      ))}
      <br></br>
      <span>Slippage:</span>
      {Slippages.map(slip => (
        <button
          className={classes.slippagebtn}
          onClick={e => {
            setSlippage(slip);
            e.target.style.color = 'orange';
          }}
        >
          {slip}%
        </button>
      ))}
      <br></br>
      <span style={{ position: 'relative', top: 15, left: -10 }}>
        Collateral Amount:
      </span>
      <TextField
        id="outlined-basic"
        variant="outlined"
        onChange={e => setCollateralAmount(e.target.value)}
      ></TextField>
      <br></br>
      {collateralAmount &&
        debtToken &&
        collateralToken &&
        leverage &&
        slippage && (
          <LeverageButton
            {...{
              vars: {
                collateral: new ethers.Contract(
                  AAVETokens.find(
                    val => val.symbol == collateralToken.value
                  ).underlyingAsset,
                  ERC20_ABI,
                  signer
                ),
                collateralBalance: collateralAmount,
                LTV: AAVETokens.find(val => val.symbol == collateralToken.value)
                  .baseLTVasCollateral,
                debtToken: new ethers.Contract(
                  AAVETokens.find(
                    val => val.symbol == debtToken.value
                  ).underlyingAsset,
                  ERC20_ABI,
                  signer
                ),
                slippage: slippage,
                leverage: leverage,
              },
            }}
          ></LeverageButton>
        )}
    </Box>
  );
}
