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
} from '@material-ui/core';
import { formatUnits } from 'utils/big-number';
import { useWallet } from 'contexts/wallet';
import { useNotifications } from 'contexts/notifications';
import { SUCCESS_COLOR, DANGER_COLOR } from 'config';
import ERC20_ABI from 'abis/ERC20.json';
import sleep from 'utils/sleep';
import Loader from 'components/Loader';

const useStyles = makeStyles(theme => ({
  container: {
    '& th, td': {
      borderColor: 'rgba(16, 161, 204, 0.2)',
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
}));

export default function() {
  const classes = useStyles();
  const {
    connect,
    isLoaded: walletIsLoaded,
    signer,
    wethGatewayContract,
    lendingPoolContract,
  } = useWallet();
  const { address } = useWallet();
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [collaterals, setCollaterals] = React.useState([]);
  const [debts, setDebts] = React.useState([]);

  React.useEffect(() => {
    if (!walletIsLoaded) return;
    if (!(signer && lendingPoolContract && wethGatewayContract && address))
      return;

    let isMounted = true;
    const unsubs = [() => (isMounted = false)];

    const getCollateralIf = async (
      userConfigData,
      reserveAddress,
      reserveIndex
    ) => {
      const isCollateral =
        (userConfigData >> (reserveIndex * 2 + 1)) & (1 != 0);
      if (!isCollateral) return;
      const reserveData = await lendingPoolContract.getReserveData(
        reserveAddress
      );
      return getCollateral(reserveAddress, reserveData.aTokenAddress);
    };

    const getCollateral = async (reserveAddress, reserveATokenAddress) => {
      const aTokenContract = new ethers.Contract(
        reserveATokenAddress,
        ERC20_ABI,
        signer
      );
      const [amount] = await Promise.all([aTokenContract.balanceOf(address)]);
      if (amount.isZero()) return;

      const tokenContract = new ethers.Contract(
        reserveAddress,
        ERC20_ABI,
        signer
      );

      const [symbol, decimals] = await Promise.all([
        tokenContract.symbol(),
        tokenContract.decimals(),
      ]);
      return {
        contract: tokenContract,
        symbol,
        decimals,
        reserveAddress,
        amount,
      };
    };

    const getDebt = async reserveAddress => {
      const tokenContract = new ethers.Contract(
        reserveAddress,
        ERC20_ABI,
        signer
      );
      const [amount] = await Promise.all([tokenContract.balanceOf(address)]);
      if (amount.isZero()) return;

      const [symbol, decimals] = await Promise.all([
        tokenContract.symbol(),
        tokenContract.decimals(),
      ]);
      return {
        contract: tokenContract,
        symbol,
        decimals,
        reserveAddress,
        amount,
      };
    };

    const load = async () => {
      const [reserveAddresses, userConfig] = await Promise.all([
        lendingPoolContract.getReservesList(),
        lendingPoolContract.getUserConfiguration(address),
      ]);
      const x = await Promise.all([
        ...reserveAddresses.map(getCollateralIf.bind(null, userConfig.data)),
        ...reserveAddresses.map(getDebt),
      ]);
      const collaterals = x.splice(0, reserveAddresses.length);
      const debts = x;

      const [wethAddress, aWETHAddress] = await Promise.all([
        wethGatewayContract.getWETHAddress(),
        wethGatewayContract.getAWETHAddress(),
      ]);
      const [wethCollateral, wethDebt] = await Promise.all([
        getCollateral(wethAddress, aWETHAddress),
        getDebt(wethAddress),
      ]);

      collaterals.push(wethCollateral);
      debts.push(wethDebt);

      if (isMounted) {
        setDebts(debts.filter(o => !!o));
        setCollaterals(collaterals.filter(o => !!o));
        setIsLoaded(true);
      }
    };

    const subscribe = () => {
      const borrowEvent = lendingPoolContract.filters.Borrow(
        null,
        null,
        address
      );
      const repayEvent = lendingPoolContract.filters.Repay(null, address);
      const depositEvent = lendingPoolContract.filters.Borrow(
        null,
        null,
        address
      );
      const withdrawEvent = lendingPoolContract.filters.Repay(null, address);
      const onContractEvent = async () => {
        await sleep(1000);
        await load();
      };
      lendingPoolContract.on(borrowEvent, onContractEvent);
      lendingPoolContract.on(repayEvent, onContractEvent);
      lendingPoolContract.on(depositEvent, onContractEvent);
      lendingPoolContract.on(withdrawEvent, onContractEvent);
      unsubs.push(() => lendingPoolContract.off(borrowEvent, onContractEvent));
      unsubs.push(() => lendingPoolContract.off(repayEvent, onContractEvent));
      unsubs.push(() => lendingPoolContract.off(depositEvent, onContractEvent));
      unsubs.push(() =>
        lendingPoolContract.off(withdrawEvent, onContractEvent)
      );
    };

    load();
    subscribe();
    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [
    signer,
    walletIsLoaded,
    lendingPoolContract,
    wethGatewayContract,
    address,
  ]);

  return (
    <Box className={clsx(classes.container, 'text-center')}>
      {!walletIsLoaded ? null : !address ? (
        <Box py={4}>
          <h2>AAVE 2 Leverage Increase Utility</h2>
          <p>Increase the leverage of your AAVE 2 borrow positions!</p>
          <Button
            color="secondary"
            variant="outlined"
            onClick={() => connect()}
          >
            Connect Wallet
          </Button>
        </Box>
      ) : !isLoaded ? (
        <Loader />
      ) : (
        <Box className={classes.grid}>
          <Box>
            <h2 className="text-left">Your Collateral</h2>
            {!collaterals.length ? (
              <Box>You have no collateral.</Box>
            ) : (
              <Table className={classes.table} aria-label="collateral">
                <TableHead>
                  <TableRow>
                    <TableCell>Asset</TableCell>
                    <TableCell>Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {collaterals.map(collateral => (
                    <Collateral
                      key={collateral.reserveAddress}
                      {...{ collateral }}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </Box>
          <Box>
            <h2 className="text-left">Your Borrows</h2>
            {!debts.length ? (
              <Box>You have no debts.</Box>
            ) : (
              <Table className={classes.table} aria-label="debts">
                <TableHead>
                  <TableRow>
                    <TableCell>Asset</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Leverage</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {debts.map(debt => (
                    <Debt key={debt.reserveAddress} {...{ debt }} />
                  ))}
                </TableBody>
              </Table>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}

function Collateral({ collateral }) {
  // const classes = useStyles();

  return (
    <TableRow>
      <TableCell component="th" scope="row">
        {collateral.symbol}
      </TableCell>
      <TableCell>
        {formatUnits(collateral.amount, collateral.decimals, 2)}
      </TableCell>
    </TableRow>
  );
}

function Debt({ debt }) {
  const classes = useStyles();
  const { tx } = useNotifications();
  const [isWorking, setIsWorking] = React.useState(false);
  const [leverage, setLeverage] = React.useState(2);
  const { leverageContract, address } = useWallet();

  const applyLeverage = async () => {
    try {
      setIsWorking('Applying...');
      await tx('Applying...', 'Applied!', () =>
        leverageContract.apply(debt.reserveAddress, address, leverage)
      );
    } finally {
      setIsWorking(false);
    }
  };

  function valueText(value) {
    return `${value}x`;
  }

  return (
    <TableRow>
      <TableCell component="th" scope="row">
        {debt.symbol}
      </TableCell>
      <TableCell>{formatUnits(debt.amount, debt.decimals, 2)}</TableCell>
      <TableCell>
        <Box className="flex">
          <Box mr={1}>
            <Slider
              value={leverage}
              getAriaValueText={valueText}
              aria-labelledby="leverage-slider"
              valueLabelDisplay="auto"
              step={0.1}
              min={1}
              max={3}
              className={classes.leverageSlider}
              disabled={!!isWorking}
              onChange={(event, leverage) => setLeverage(leverage)}
            />
          </Box>
          <Button
            color="secondary"
            variant="outlined"
            disabled={!!isWorking}
            onClick={applyLeverage}
          >
            APPLY
          </Button>
        </Box>
      </TableCell>
    </TableRow>
  );
}
